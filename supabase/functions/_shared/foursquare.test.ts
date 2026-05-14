// Unit tests for the Foursquare shaping / filter-mapping primitives.
// These are pure-function tests — no network, no Deno permissions.
//
// Run from `supabase/functions/` via `deno test --allow-net --allow-env --allow-read`.

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyPostFilters,
  buildFoursquareQuery,
  buildQuerySignature,
  computeGeoBucket,
  DIETARY_CHIP_MAP,
  estimateWalkMinutes,
  extractDietaryTags,
  findDietaryMapping,
  FOURSQUARE_API_VERSION,
  FOURSQUARE_BASE_URL,
  type FoursquareSearchResult,
  photoToUrl,
  shapeFoursquareResult,
  THIN_RESULTS_THRESHOLD,
} from "./foursquare.ts";

// ---------------------------------------------------------------------------
// Pinned constants — guard against accidental floating-version regressions.
// ---------------------------------------------------------------------------

Deno.test("API version is pinned to the ADR 0002 verified date", () => {
  assertEquals(FOURSQUARE_API_VERSION, "2025-06-17");
});

Deno.test("Base URL points to the post-2025 migration host", () => {
  assertEquals(FOURSQUARE_BASE_URL, "https://places-api.foursquare.com");
  // The legacy api.foursquare.com surface returns HTTP 410.
  assertEquals(FOURSQUARE_BASE_URL.includes("/v3"), false);
});

// ---------------------------------------------------------------------------
// Geo bucketing — cache-key first tier.
// ---------------------------------------------------------------------------

Deno.test("computeGeoBucket — nearby points share a bucket", () => {
  // Both points are inside a ~555 m square; cache key must collapse them.
  const a = computeGeoBucket(40.7128, -74.0060); // NYC City Hall
  const b = computeGeoBucket(40.7130, -74.0062);
  assertEquals(a, b);
});

Deno.test("computeGeoBucket — distant points get different buckets", () => {
  const nyc = computeGeoBucket(40.7128, -74.0060);
  const sf = computeGeoBucket(37.7749, -122.4194);
  assertEquals(nyc === sf, false);
});

Deno.test("computeGeoBucket — string format is stable + deterministic", () => {
  // 4dp on each axis ensures the bucket name is identical across
  // platforms regardless of float rendering quirks.
  const key = computeGeoBucket(40.7128, -74.0060);
  assertEquals(/^-?\d+\.\d{4}_-?\d+\.\d{4}$/.test(key), true);
});

// ---------------------------------------------------------------------------
// Query building — wire parameters Foursquare expects.
// ---------------------------------------------------------------------------

Deno.test("buildFoursquareQuery — emits ll, radius, limit, fields", () => {
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
  });
  assertEquals(plan.query.get("ll"), "40.7128,-74.006");
  assertEquals(plan.query.get("radius"), "1600");
  assertEquals(plan.query.get("limit"), "50");
  assertExists(plan.query.get("fields"));
});

Deno.test("buildFoursquareQuery — halal + kosher chips emit category ids", () => {
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { dietary: ["halal", "kosher"] },
  });
  const ids = plan.query.get("fsq_category_ids");
  assertExists(ids);
  // Sort-stable list — order doesn't depend on chip input order.
  assertEquals(ids, "13351,13352");
  assertEquals(plan.emitted_tags.sort(), ["halal", "kosher"]);
});

Deno.test("buildFoursquareQuery — gluten chip becomes a post-fetch filter, not a wire param", () => {
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { dietary: ["gluten"] },
  });
  // Foursquare's free-tier search endpoint has no server-side `tastes`
  // filter — coverage research recommended post-filtering instead.
  assertEquals(plan.query.has("tastes"), false);
  assertEquals(plan.post_filters.require_taste_tokens.length > 0, true);
  assertEquals(plan.emitted_tags, ["gluten_free_options"]);
});

Deno.test("buildFoursquareQuery — shellfish chip becomes a disclaimer, not a filter", () => {
  // Lock 1 update pending: Foursquare carries no kitchen-protocol
  // allergen data, so the chip is recorded as a disclaimer for the
  // verdict rule chip and the engine never tries to filter on it.
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { dietary: ["shellfish"] },
  });
  assertEquals(plan.query.has("fsq_category_ids"), false);
  assertEquals(plan.post_filters.require_taste_tokens, []);
  assertEquals(plan.post_filters.disclaimers, ["no_shellfish_unverified"]);
});

Deno.test("buildFoursquareQuery — 'Nothing tonight' chip is a no-op", () => {
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { dietary: ["Nothing tonight"] },
  });
  assertEquals(plan.query.has("fsq_category_ids"), false);
  assertEquals(plan.post_filters.disclaimers, []);
  assertEquals(plan.emitted_tags, []);
});

Deno.test("buildFoursquareQuery — price_tier becomes max_price (clamped 1..4)", () => {
  const tier1 = buildFoursquareQuery({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { price_tier: 1 },
  });
  assertEquals(tier1.query.get("max_price"), "1");

  // Out-of-range inputs clamp rather than throw — the proxy should be
  // tolerant of forwards-incompatible quiz copy changes.
  const tier99 = buildFoursquareQuery({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { price_tier: 99 },
  });
  assertEquals(tier99.query.get("max_price"), "4");
});

Deno.test("buildFoursquareQuery — open_at ISO converts to unix seconds", () => {
  const plan = buildFoursquareQuery({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { open_at: "2026-05-13T18:00:00Z" },
  });
  // 1778695200 = 2026-05-13T18:00:00Z (unix seconds, UTC)
  assertEquals(plan.query.get("open_at"), "1778695200");
});

Deno.test("buildFoursquareQuery — invalid open_at is silently dropped", () => {
  const plan = buildFoursquareQuery({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { open_at: "not-a-date" },
  });
  assertEquals(plan.query.has("open_at"), false);
});

// ---------------------------------------------------------------------------
// Cache-key signature — same filters always hash to the same string.
// ---------------------------------------------------------------------------

Deno.test("buildQuerySignature — chip order doesn't change the signature", () => {
  const a = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { dietary: ["halal", "kosher"] },
  });
  const b = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { dietary: ["kosher", "halal"] },
  });
  assertEquals(a, b);
});

Deno.test("buildQuerySignature — different chip sets get different signatures", () => {
  const halal = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { dietary: ["halal"] },
  });
  const kosher = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { dietary: ["kosher"] },
  });
  assertEquals(halal === kosher, false);
});

Deno.test("buildQuerySignature — signature does not encode the geo position", () => {
  // Cache key is (geo_bucket, signature). The signature must be a
  // pure function of the *non-geo* filter set so two distant searches
  // with the same filters share signature rows.
  const here = buildQuerySignature({
    lat: 40.7128, lng: -74.0060, radius_meters: 100,
    filters: { dietary: ["halal"] },
  });
  const there = buildQuerySignature({
    lat: 37.7749, lng: -122.4194, radius_meters: 100,
    filters: { dietary: ["halal"] },
  });
  assertEquals(here, there);
});

Deno.test("buildQuerySignature — gluten post-filter is encoded", () => {
  const withGluten = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { dietary: ["gluten"] },
  });
  const without = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
  });
  assertEquals(withGluten === without, false);
});

Deno.test("buildQuerySignature — disclaimer chip is encoded", () => {
  // A shellfish-only chip set produces no wire query parameter, but it
  // still has to produce a distinct cache row so its disclaimers
  // propagate to the client.
  const withDisclaimer = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { dietary: ["shellfish"] },
  });
  const without = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
  });
  assertEquals(withDisclaimer === without, false);
});

// ---------------------------------------------------------------------------
// Walk-time estimate.
// ---------------------------------------------------------------------------

Deno.test("estimateWalkMinutes — converts metres to minutes at 80 m/min", () => {
  // 800 m at 80 m/min = 10 minutes.
  assertEquals(estimateWalkMinutes(800), 10);
  // 1 m rounds up to the 1-min floor.
  assertEquals(estimateWalkMinutes(1), 1);
});

Deno.test("estimateWalkMinutes — undefined distance returns null", () => {
  assertEquals(estimateWalkMinutes(undefined), null);
});

// ---------------------------------------------------------------------------
// Result shaping.
// ---------------------------------------------------------------------------

const SAMPLE_RESULT: FoursquareSearchResult = Object.freeze({
  fsq_place_id: "fsq-abc-123",
  name: "Vegan Hut",
  latitude: 40.7130,
  longitude: -74.0061,
  categories: [{ id: "13377", name: "Vegan Restaurant" }],
  location: { formatted_address: "123 Main St" },
  price: 2,
  hours: { display: "Open until 10pm", open_now: true },
  photos: [{ prefix: "https://img.fsq.com/", suffix: "/abc.jpg" }],
  tastes: ["vegan menu", "plant-based"],
  distance: 240,
});

Deno.test("shapeFoursquareResult — maps the documented fields", () => {
  const shaped = shapeFoursquareResult(SAMPLE_RESULT, []);
  assertExists(shaped);
  assertEquals(shaped.fsq_place_id, "fsq-abc-123");
  assertEquals(shaped.name, "Vegan Hut");
  assertEquals(shaped.lat, 40.7130);
  assertEquals(shaped.lng, -74.0061);
  assertEquals(shaped.price_tier, 2);
  assertEquals(shaped.walk_minutes_estimate, 3); // ceil(240/80) = 3
  assertEquals(shaped.address, "123 Main St");
  assertEquals(shaped.categories, ["Vegan Restaurant"]);
  assertEquals(shaped.hours?.display, "Open until 10pm");
  assertEquals(shaped.hours?.open_now, true);
  assertEquals(shaped.photos[0], "https://img.fsq.com/400x400/abc.jpg");
});

Deno.test("shapeFoursquareResult — skips rows missing required fields", () => {
  // Missing name → return null rather than emit a placeholder row.
  assertEquals(
    shapeFoursquareResult({ ...SAMPLE_RESULT, name: "" }, []),
    null,
  );
  assertEquals(
    shapeFoursquareResult(
      { ...SAMPLE_RESULT, latitude: undefined as unknown as number },
      [],
    ),
    null,
  );
});

Deno.test("shapeFoursquareResult — dietary tags pull from emitted_tags + categories", () => {
  // The vegan category id (13377) on the result alone is enough to
  // emit the tag even if the caller didn't query for it.
  const shaped = shapeFoursquareResult(SAMPLE_RESULT, []);
  assertExists(shaped);
  assertEquals(shaped.dietary_tags.includes("vegan_friendly"), true);
});

Deno.test("shapeFoursquareResult — gluten taste token surfaces as tag", () => {
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    categories: [],
    tastes: ["gluten-free"],
  }, []);
  assertExists(shaped);
  assertEquals(shaped.dietary_tags.includes("gluten_free_options"), true);
});

Deno.test("shapeFoursquareResult — disclaimer tags pass through from emitted set", () => {
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    tastes: [],
    categories: [],
  }, ["no_shellfish_unverified"]);
  assertExists(shaped);
  assertEquals(
    shaped.dietary_tags.includes("no_shellfish_unverified"),
    true,
  );
});

// ---------------------------------------------------------------------------
// Post-filter (taste tokens).
// ---------------------------------------------------------------------------

Deno.test("applyPostFilters — keeps results that include at least one synonym per group", () => {
  const has: FoursquareSearchResult = {
    ...SAMPLE_RESULT,
    tastes: ["gluten-free", "vegan menu"],
  };
  const missing: FoursquareSearchResult = {
    ...SAMPLE_RESULT,
    tastes: ["vegan menu"],
  };
  // One requirement group: ["gluten-free", "gluten free"] — synonyms OR'd.
  const filtered = applyPostFilters(
    [has, missing],
    [["gluten-free", "gluten free"]],
  );
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].tastes, ["gluten-free", "vegan menu"]);
});

Deno.test("applyPostFilters — empty group list is a no-op", () => {
  const filtered = applyPostFilters([SAMPLE_RESULT], []);
  assertEquals(filtered.length, 1);
});

Deno.test("applyPostFilters — multiple groups all need at least one match", () => {
  const onlyOneGroup: FoursquareSearchResult = {
    ...SAMPLE_RESULT,
    tastes: ["gluten-free"],
  };
  const bothGroups: FoursquareSearchResult = {
    ...SAMPLE_RESULT,
    tastes: ["gluten-free", "vegan menu"],
  };
  const filtered = applyPostFilters(
    [onlyOneGroup, bothGroups],
    [["gluten-free"], ["vegan menu", "vegan options"]],
  );
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].fsq_place_id, bothGroups.fsq_place_id);
});

// ---------------------------------------------------------------------------
// Dietary chip map sanity.
// ---------------------------------------------------------------------------

Deno.test("DIETARY_CHIP_MAP — every Q1 chip from the PRD is mapped", () => {
  // PRD §"Quiz copy": Gluten · Dairy · Shellfish · Needs vegan options · Halal-only · Nothing tonight
  // The map normalizes to lowercased single-word chips.
  for (const chip of ["gluten", "dairy", "shellfish", "vegan", "halal"]) {
    assertExists(findDietaryMapping(chip), `${chip} chip is unmapped`);
  }
});

Deno.test("DIETARY_CHIP_MAP — disclaimers map covers allergen chips", () => {
  // Per research-report Option C: dairy + shellfish + nuts have no
  // Foursquare signal, so they MUST land in the disclaimer bucket.
  for (const chip of ["dairy", "shellfish", "nuts"]) {
    const mapping = findDietaryMapping(chip);
    assertExists(mapping);
    assertEquals(mapping.strategy, "disclaimer");
  }
});

Deno.test("THIN_RESULTS_THRESHOLD is a small positive integer", () => {
  // Sanity: don't let a refactor turn this into 0 (always trigger
  // MapKit) or 100 (never use Foursquare).
  assertEquals(THIN_RESULTS_THRESHOLD > 0, true);
  assertEquals(THIN_RESULTS_THRESHOLD < 10, true);
});

Deno.test("extractDietaryTags — independent of caller's emitted_tags", () => {
  const tagsFromCategory = extractDietaryTags(
    { ...SAMPLE_RESULT, tastes: [] },
    [],
  );
  // The vegan category alone is enough; the emitted_tags input only
  // augments, never gates.
  assertEquals(tagsFromCategory.includes("vegan_friendly"), true);
});

Deno.test("photoToUrl — composes prefix + size + suffix", () => {
  assertEquals(
    photoToUrl({ prefix: "https://img.x/", suffix: "/y.jpg" }),
    "https://img.x/400x400/y.jpg",
  );
});

// Ensure the chip map has no duplicate entries.
Deno.test("DIETARY_CHIP_MAP — no duplicate chip names", () => {
  const chips = DIETARY_CHIP_MAP.map((m) => m.chip);
  assertEquals(chips.length, new Set(chips).size);
});
