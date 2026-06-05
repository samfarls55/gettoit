// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// Unit tests for the Foursquare shaping / filter-mapping primitives.
// These are pure-function tests â€” no network, no Deno permissions.
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
  CANDIDATE_POOL_FLOOR_CATEGORY_IDS,
  computeGeoBucket,
  CUISINE_CATEGORY_MAP,
  DIETARY_CHIP_MAP,
  ENTERTAINMENT_VENUE_CATEGORY_NAMES,
  estimateWalkMinutes,
  extractDietaryTags,
  findCuisineCategory,
  findDietaryMapping,
  FOURSQUARE_API_VERSION,
  FOURSQUARE_BASE_URL,
  type FoursquareSearchResult,
  NIGHTLIFE_CATEGORY_NAMES,
  photoToUrl,
  shapeFoursquareResult,
  THIN_RESULTS_THRESHOLD,
} from "./foursquare.ts";

// ---------------------------------------------------------------------------
// Pinned constants â€” guard against accidental floating-version regressions.
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
// Geo bucketing â€” cache-key first tier.
// ---------------------------------------------------------------------------

Deno.test("computeGeoBucket â€” nearby points share a bucket", () => {
  // Both points are inside a ~555 m square; cache key must collapse them.
  const a = computeGeoBucket(40.7128, -74.0060); // NYC City Hall
  const b = computeGeoBucket(40.7130, -74.0062);
  assertEquals(a, b);
});

Deno.test("computeGeoBucket â€” distant points get different buckets", () => {
  const nyc = computeGeoBucket(40.7128, -74.0060);
  const sf = computeGeoBucket(37.7749, -122.4194);
  assertEquals(nyc === sf, false);
});

Deno.test("computeGeoBucket â€” string format is stable + deterministic", () => {
  // 4dp on each axis ensures the bucket name is identical across
  // platforms regardless of float rendering quirks.
  const key = computeGeoBucket(40.7128, -74.0060);
  assertEquals(/^-?\d+\.\d{4}_-?\d+\.\d{4}$/.test(key), true);
});

// ---------------------------------------------------------------------------
// Query building â€” wire parameters Foursquare expects.
// ---------------------------------------------------------------------------

Deno.test("buildFoursquareQuery â€” emits ll, radius, limit, fields", () => {
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

Deno.test("buildFoursquareQuery â€” halal + kosher chips emit category ids", () => {
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { dietary: ["halal", "kosher"] },
  });
  const ids = plan.query.get("fsq_category_ids");
  assertExists(ids);
  // Sort-stable list â€” order doesn't depend on chip input order.
  // Live Foursquare hex taxonomy ids (probed 2026-05-17): kosher
  // 52e81612bcbc57f1066b79fc sorts before halal 52e81612bcbc57f1066b79ff.
  assertEquals(
    ids,
    "52e81612bcbc57f1066b79fc,52e81612bcbc57f1066b79ff",
  );
  assertEquals(plan.emitted_tags.sort(), ["halal", "kosher"]);
});

Deno.test("buildFoursquareQuery â€” gluten chip becomes a post-fetch filter, not a wire param", () => {
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { dietary: ["gluten"] },
  });
  // Foursquare's free-tier search endpoint has no server-side `tastes`
  // filter â€” coverage research recommended post-filtering instead.
  assertEquals(plan.query.has("tastes"), false);
  assertEquals(plan.post_filters.require_taste_tokens.length > 0, true);
  assertEquals(plan.emitted_tags, ["gluten_free_options"]);
});

Deno.test("buildFoursquareQuery â€” shellfish chip becomes a disclaimer, not a filter", () => {
  // Lock 1 update pending: Foursquare carries no kitchen-protocol
  // allergen data, so the chip is recorded as a disclaimer for the
  // verdict rule chip and the engine never tries to filter on it.
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { dietary: ["shellfish"] },
  });
  // tb-25 / ADR 0012: a disclaimer-only chip contributes no category id,
  // so the candidate-pool floor is seeded â€” fsq_category_ids is the
  // eight-category floor, never empty.
  assertEquals(
    plan.query.get("fsq_category_ids"),
    [...CANDIDATE_POOL_FLOOR_CATEGORY_IDS].sort().join(","),
  );
  assertEquals(plan.post_filters.require_taste_tokens, []);
  assertEquals(plan.post_filters.disclaimers, ["no_shellfish_unverified"]);
});

Deno.test("buildFoursquareQuery â€” 'Nothing tonight' chip is a no-op", () => {
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { dietary: ["Nothing tonight"] },
  });
  // tb-25 / ADR 0012: the no-op chip contributes no category id, so the
  // category-id set is empty and the candidate-pool floor is seeded.
  assertEquals(
    plan.query.get("fsq_category_ids"),
    [...CANDIDATE_POOL_FLOOR_CATEGORY_IDS].sort().join(","),
  );
  assertEquals(plan.post_filters.disclaimers, []);
  assertEquals(plan.emitted_tags, []);
});

Deno.test("buildFoursquareQuery â€” price_tier becomes max_price (clamped 1..4)", () => {
  const tier1 = buildFoursquareQuery({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { price_tier: 1 },
  });
  assertEquals(tier1.query.get("max_price"), "1");

  // Out-of-range inputs clamp rather than throw â€” the proxy should be
  // tolerant of forwards-incompatible quiz copy changes.
  const tier99 = buildFoursquareQuery({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { price_tier: 99 },
  });
  assertEquals(tier99.query.get("max_price"), "4");
});

Deno.test("buildFoursquareQuery â€” open_at DHHMM token passes through verbatim", () => {
  const plan = buildFoursquareQuery({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { open_at: "3T1900" },
  });
  // Foursquare wants the recurring weekday + local-time token as-is â€”
  // never a timestamp. `3T1900` = Wednesday 19:00.
  assertEquals(plan.query.get("open_at"), "3T1900");
});

Deno.test("buildFoursquareQuery â€” malformed open_at is dropped by the pattern guard", () => {
  for (const bad of ["not-a-date", "2026-05-13T18:00:00Z", "1778695200", "0T1900", "3T2500"]) {
    const plan = buildFoursquareQuery({
      lat: 0, lng: 0, radius_meters: 100,
      filters: { open_at: bad },
    });
    assertEquals(plan.query.has("open_at"), false, `expected drop for "${bad}"`);
  }
});

// ---------------------------------------------------------------------------
// Cache-key signature â€” same filters always hash to the same string.
// ---------------------------------------------------------------------------

Deno.test("buildQuerySignature â€” chip order doesn't change the signature", () => {
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

Deno.test("buildQuerySignature â€” different chip sets get different signatures", () => {
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

Deno.test("buildQuerySignature â€” signature does not encode the geo position", () => {
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

Deno.test("buildQuerySignature â€” gluten post-filter is encoded", () => {
  const withGluten = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { dietary: ["gluten"] },
  });
  const without = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
  });
  assertEquals(withGluten === without, false);
});

Deno.test("buildQuerySignature â€” disclaimer chip is encoded", () => {
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

Deno.test("estimateWalkMinutes â€” converts metres to minutes at 80 m/min", () => {
  // 800 m at 80 m/min = 10 minutes.
  assertEquals(estimateWalkMinutes(800), 10);
  // 1 m rounds up to the 1-min floor.
  assertEquals(estimateWalkMinutes(1), 1);
});

Deno.test("estimateWalkMinutes â€” undefined distance returns null", () => {
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
  categories: [
    { fsq_category_id: "4bf58dd8d48988d1d3941735", name: "Vegan and Vegetarian Restaurant" },
  ],
  location: { formatted_address: "123 Main St" },
  price: 2,
  hours: { display: "Open until 10pm", open_now: true },
  photos: [{ prefix: "https://img.fsq.com/", suffix: "/abc.jpg" }],
  tastes: ["vegan menu", "plant-based"],
  distance: 240,
  // TB-16 â€” reputation-axis metadata.
  rating: 8.4,
  stats: { total_ratings: 312, total_tips: 18 },
  date_created: "2019-06-01",
});

Deno.test("shapeFoursquareResult â€” maps the documented fields", () => {
  const shaped = shapeFoursquareResult(SAMPLE_RESULT, []);
  assertExists(shaped);
  assertEquals(shaped.fsq_place_id, "fsq-abc-123");
  assertEquals(shaped.name, "Vegan Hut");
  assertEquals(shaped.lat, 40.7130);
  assertEquals(shaped.lng, -74.0061);
  assertEquals(shaped.price_tier, 2);
  assertEquals(shaped.walk_minutes_estimate, 3); // ceil(240/80) = 3
  assertEquals(shaped.address, "123 Main St");
  assertEquals(shaped.categories, ["Vegan and Vegetarian Restaurant"]);
  assertEquals(shaped.hours?.display, "Open until 10pm");
  assertEquals(shaped.hours?.open_now, true);
  assertEquals(shaped.photos[0], "https://img.fsq.com/400x400/abc.jpg");
});

Deno.test("shapeFoursquareResult â€” projects the reputation-axis metadata", () => {
  // TB-16: rating / stats.total_ratings / date_created pass through for
  // the iOS Q5VenueClassifier's reputation axis.
  const shaped = shapeFoursquareResult(SAMPLE_RESULT, []);
  assertExists(shaped);
  assertEquals(shaped.rating, 8.4);
  assertEquals(shaped.total_ratings, 312);
  assertEquals(shaped.date_created, "2019-06-01");
});

Deno.test("shapeFoursquareResult â€” reputation fields shape as null when absent", () => {
  // Coverage is uneven across venues â€” a venue Foursquare returns no
  // rating / stats / date_created for shapes those fields as null
  // rather than dropping the whole row.
  const shaped = shapeFoursquareResult(
    {
      ...SAMPLE_RESULT,
      rating: undefined,
      stats: undefined,
      date_created: undefined,
    },
    [],
  );
  assertExists(shaped);
  assertEquals(shaped.rating, null);
  assertEquals(shaped.total_ratings, null);
  assertEquals(shaped.date_created, null);
});

Deno.test("shapeFoursquareResult â€” projects the tastes vibe signal", () => {
  // TB-18: the raw `tastes` tag cloud passes through onto the shaped
  // row so the iOS Q5VenueClassifier can read it for the Q4 vibe axis.
  const shaped = shapeFoursquareResult(SAMPLE_RESULT, []);
  assertExists(shaped);
  assertEquals(shaped.tastes, ["vegan menu", "plant-based"]);
});

Deno.test("shapeFoursquareResult â€” tastes shapes as [] when absent", () => {
  // A venue Foursquare returns no `tastes` for shapes as an empty
  // array â€” no minimum-coverage drop, the classifier just gets nothing
  // to nudge on.
  const shaped = shapeFoursquareResult(
    { ...SAMPLE_RESULT, tastes: undefined },
    [],
  );
  assertExists(shaped);
  assertEquals(shaped.tastes, []);
});

Deno.test("buildFoursquareQuery â€” requests the reputation-axis fields", () => {
  // TB-16: the fields param must ask Foursquare for rating / stats /
  // date_created or the reputation axis has nothing to classify on.
  const plan = buildFoursquareQuery({
    lat: 40.7,
    lng: -74.0,
    radius_meters: 1000,
  });
  const fields = plan.query.get("fields") ?? "";
  assertEquals(fields.includes("rating"), true);
  assertEquals(fields.includes("stats"), true);
  assertEquals(fields.includes("date_created"), true);
});

Deno.test("shapeFoursquareResult â€” skips rows missing required fields", () => {
  // Missing name â†’ return null rather than emit a placeholder row.
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

Deno.test("shapeFoursquareResult â€” dietary tags pull from emitted_tags + categories", () => {
  // The vegan/vegetarian category id on the result alone is enough to
  // emit the tag even if the caller didn't query for it.
  const shaped = shapeFoursquareResult(SAMPLE_RESULT, []);
  assertExists(shaped);
  assertEquals(shaped.dietary_tags.includes("vegan_friendly"), true);
});

Deno.test("shapeFoursquareResult â€” gluten taste token surfaces as tag", () => {
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    categories: [],
    tastes: ["gluten-free"],
  }, []);
  assertExists(shaped);
  assertEquals(shaped.dietary_tags.includes("gluten_free_options"), true);
});

Deno.test("shapeFoursquareResult â€” disclaimer tags pass through from emitted set", () => {
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
// bug-15 â€” shape-time primary-class gate + entertainment-venue backstop.
//
// ADR 0012 amendment: the query-time floor is an OR allowlist on
// `fsq_category_ids` and cannot exclude a multi-category bar that also
// carries a meal category (Robert's Western World tagged
// `["Bar","Burger Joint","Rock Club"]` matches the floor's Restaurant parent
// via Burger Joint and rides into the candidate pool with Bar as
// `categories[0]`, which `VerdictStore.swift:276` then renders as the
// verdict's venue type). This gate is the structural companion: enforced
// at shape-time on the human category names, returning null for any venue
// whose primary is nightlife or an entertainment venue, and for any venue
// whose category set crosses nightlife with an entertainment-venue tag.
// ---------------------------------------------------------------------------

Deno.test("NIGHTLIFE_CATEGORY_NAMES carves Sports Bar + Gastropub out", () => {
  // ADR 0012 carve-out â€” Sports Bar is the meal-class member of the Bar
  // branch (people eat full meals there); Gastropub is the food-primary
  // member of the gastronomy branch. Ratified 2026-05-19.
  const lc = NIGHTLIFE_CATEGORY_NAMES.map((n) => n.toLowerCase());
  assertEquals(lc.includes("sports bar"), false);
  assertEquals(lc.includes("gastropub"), false);
  // Sanity-check the rule is meaningful: the canonical leak category is in.
  assertEquals(lc.includes("bar"), true);
});

Deno.test("ENTERTAINMENT_VENUE_CATEGORY_NAMES contains the spec's five members", () => {
  // bug-15 desired-behavior list: Music Venue, Rock Club, Night Club,
  // Bowling Alley, Stadium.
  const lc = ENTERTAINMENT_VENUE_CATEGORY_NAMES.map((n) => n.toLowerCase());
  assertEquals(lc.includes("music venue"), true);
  assertEquals(lc.includes("rock club"), true);
  assertEquals(lc.includes("night club"), true);
  assertEquals(lc.includes("bowling alley"), true);
  assertEquals(lc.includes("stadium"), true);
});

Deno.test("shapeFoursquareResult â€” bug-15 â€” primary 'Bar' cut", () => {
  // Robert's Western World shape: categories[0]='Bar' falls into the
  // nightlife set â†’ row drops to null. Burger Joint riding along does
  // not rescue it.
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    name: "Robert's Western World",
    categories: [
      { name: "Bar" },
      { name: "Burger Joint" },
      { name: "Rock Club" },
    ],
  }, []);
  assertEquals(shaped, null);
});

Deno.test("shapeFoursquareResult â€” bug-15 â€” primary 'Music Venue' cut", () => {
  // A music-venue-primary row drops on the entertainment-venue branch.
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    name: "Exit/In",
    categories: [
      { name: "Music Venue" },
      { name: "American Restaurant" },
    ],
  }, []);
  assertEquals(shaped, null);
});

Deno.test("shapeFoursquareResult â€” bug-15 â€” meal primary + nightlife-only kept (Trattoria Il Mulino)", () => {
  // A food-primary restaurant that happens to have a bar inside â€” the
  // 19-venue bucket from the bug. Stays in the pool.
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    name: "Trattoria Il Mulino",
    categories: [
      { name: "Italian Restaurant" },
      { name: "Bar" },
    ],
  }, []);
  assertExists(shaped);
  assertEquals(shaped.name, "Trattoria Il Mulino");
});

Deno.test("shapeFoursquareResult â€” bug-15 â€” meal primary + nightlife + entertainment-venue cut (Pinewood Social)", () => {
  // Entertainment-venue backstop â€” even though the primary is a
  // restaurant category, the combination of a nightlife tag and an
  // entertainment-venue tag marks the venue as a functional
  // entertainment complex and drops it.
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    name: "Pinewood Social",
    categories: [
      { name: "American Restaurant" },
      { name: "Bar" },
      { name: "Bowling Alley" },
    ],
  }, []);
  assertEquals(shaped, null);
});

Deno.test("shapeFoursquareResult â€” bug-15 â€” primary 'Sports Bar' kept (carve-out)", () => {
  // Sports Bar is the explicit meal-class carve-out from the Bar branch.
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    name: "Neighbors",
    categories: [{ name: "Sports Bar" }],
  }, []);
  assertExists(shaped);
  assertEquals(shaped.name, "Neighbors");
});

Deno.test("shapeFoursquareResult â€” bug-15 â€” primary 'Gastropub' kept (carve-out)", () => {
  // Gastropub is the second explicit carve-out.
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    name: "Husk",
    categories: [{ name: "Gastropub" }],
  }, []);
  assertExists(shaped);
  assertEquals(shaped.name, "Husk");
});

Deno.test("shapeFoursquareResult â€” bug-15 â€” unknown primary kept", () => {
  // Taxonomy-drift guard: a primary name the gate does not recognise is
  // kept. The query-time floor already constrained the upstream set so
  // we do not over-cut on unfamiliar category strings.
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    name: "Brand New Concept",
    categories: [{ name: "Mystery Category That Does Not Exist Yet" }],
  }, []);
  assertExists(shaped);
  assertEquals(shaped.name, "Brand New Concept");
});

Deno.test("shapeFoursquareResult â€” bug-15 â€” case-insensitive name match", () => {
  // Foursquare display strings have stable casing today, but the gate
  // matches on lower-cased names so a future surface that returns
  // 'BAR' or 'bar' still drops.
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    name: "Lowercase Bar",
    categories: [{ name: "bar" }, { name: "burger joint" }],
  }, []);
  assertEquals(shaped, null);
});

Deno.test("shapeFoursquareResult â€” bug-15 â€” primary 'Sports Bar' + entertainment-venue is NOT cut by primary branch", () => {
  // Sports Bar is not in the nightlife set, so the entertainment-venue
  // backstop (which requires both a nightlife AND an entertainment-venue
  // hit) does not trigger from a Sports-Bar-only nightlife signal.
  // Documents the deliberate carve-out behaviour.
  const shaped = shapeFoursquareResult({
    ...SAMPLE_RESULT,
    name: "Carve-out Sports Bar Stadium",
    categories: [{ name: "Sports Bar" }, { name: "Stadium" }],
  }, []);
  assertExists(shaped);
  assertEquals(shaped.name, "Carve-out Sports Bar Stadium");
});

// Regression â€” the exact 36-option pool that produced the Robert's verdict
// in prod room d11b3983-a8f6-4741-81a5-309ba038a2f6 on 2026-05-19T20:41:15Z.
// Reconstructed minimally as a fixture (fsq_place_id, name, lat, lng,
// categories) â€” those are the only fields the bug-15 gate reads.
const PROD_ROOM_D11B3983_POOL: ReadonlyArray<FoursquareSearchResult> = Object
  .freeze([
    { fsq_place_id: "fsq-1", name: "Chick-fil-A", latitude: 36.156, longitude: -86.795, categories: [{ name: "Fried Chicken Joint" }] },
    { fsq_place_id: "fsq-2", name: "Coco Greens", latitude: 36.152, longitude: -86.805, categories: [{ name: "Vegan and Vegetarian Restaurant" }, { name: "Massage Clinic" }, { name: "Spa" }] },
    { fsq_place_id: "fsq-3", name: "Chick-fil-A", latitude: 36.193, longitude: -86.800, categories: [{ name: "Fast Food Restaurant" }] },
    { fsq_place_id: "fsq-4", name: "Jack Brown's Beer & Burger Joint", latitude: 36.176, longitude: -86.786, categories: [{ name: "Burger Joint" }] },
    { fsq_place_id: "fsq-5", name: "Hattie B's Hot Chicken", latitude: 36.160, longitude: -86.779, categories: [{ name: "Fried Chicken Joint" }] },
    // The leak â€” categories[0] = 'Bar' (nightlife).
    { fsq_place_id: "fsq-6", name: "Robert's Western World", latitude: 36.161, longitude: -86.778, categories: [{ name: "Bar" }, { name: "Burger Joint" }, { name: "Rock Club" }] },
    { fsq_place_id: "fsq-7", name: "Morton's The Steakhouse", latitude: 36.16, longitude: -86.78, categories: [{ name: "Steakhouse" }] },
    { fsq_place_id: "fsq-8", name: "Tin Roof Broadway", latitude: 36.16, longitude: -86.78, categories: [{ name: "Diner" }] },
    // Sports Bar carve-out â€” kept.
    { fsq_place_id: "fsq-9", name: "Neighbors", latitude: 36.16, longitude: -86.78, categories: [{ name: "Sports Bar" }] },
    // Primary 'Brewery' is in the nightlife set â€” cut. Accepted false-cut.
    { fsq_place_id: "fsq-10", name: "Tennessee Brew Works", latitude: 36.16, longitude: -86.78, categories: [{ name: "Brewery" }, { name: "American Restaurant" }] },
    { fsq_place_id: "fsq-11", name: "Cook Out", latitude: 36.16, longitude: -86.78, categories: [{ name: "Burger Joint" }, { name: "Fast Food Restaurant" }] },
    { fsq_place_id: "fsq-12", name: "Folk", latitude: 36.16, longitude: -86.78, categories: [{ name: "Pizzeria" }] },
    { fsq_place_id: "fsq-13", name: "Redheaded Stranger", latitude: 36.16, longitude: -86.78, categories: [{ name: "Taco Restaurant" }, { name: "Breakfast Spot" }] },
    { fsq_place_id: "fsq-14", name: "Velvet Taco", latitude: 36.16, longitude: -86.78, categories: [{ name: "Taco Restaurant" }] },
    { fsq_place_id: "fsq-15", name: "Slim & Husky's Pizza Beeria", latitude: 36.16, longitude: -86.78, categories: [{ name: "Pizzeria" }, { name: "Food and Beverage Service" }] },
    { fsq_place_id: "fsq-16", name: "San Antonio Taco Co.", latitude: 36.16, longitude: -86.78, categories: [{ name: "Taco Restaurant" }, { name: "Mexican Restaurant" }, { name: "Tex-Mex Restaurant" }] },
    // Meal-primary + nightlife (no entertainment-venue) â€” kept.
    { fsq_place_id: "fsq-17", name: "The Slider House", latitude: 36.16, longitude: -86.78, categories: [{ name: "Burger Joint" }, { name: "Bar" }] },
    { fsq_place_id: "fsq-18", name: "Waldo's Chicken & Beer", latitude: 36.16, longitude: -86.78, categories: [{ name: "Fried Chicken Joint" }] },
    { fsq_place_id: "fsq-19", name: "Torchy's Tacos", latitude: 36.16, longitude: -86.78, categories: [{ name: "Taco Restaurant" }] },
    { fsq_place_id: "fsq-20", name: "Mellow Mushroom", latitude: 36.16, longitude: -86.78, categories: [{ name: "Pizzeria" }] },
    { fsq_place_id: "fsq-21", name: "Chipotle Mexican Grill", latitude: 36.16, longitude: -86.78, categories: [{ name: "Mexican Restaurant" }, { name: "Burrito Restaurant" }, { name: "Taco Restaurant" }] },
    { fsq_place_id: "fsq-22", name: "Chipotle Mexican Grill", latitude: 36.16, longitude: -86.78, categories: [{ name: "Mexican Restaurant" }] },
    { fsq_place_id: "fsq-23", name: "Joyland", latitude: 36.16, longitude: -86.78, categories: [{ name: "Burger Joint" }, { name: "Fried Chicken Joint" }] },
    { fsq_place_id: "fsq-24", name: "The Diner", latitude: 36.16, longitude: -86.78, categories: [{ name: "Diner" }] },
    // Meal-primary + nightlife â€” kept.
    { fsq_place_id: "fsq-25", name: "Batters Box Bar & Grill", latitude: 36.16, longitude: -86.78, categories: [{ name: "Restaurant" }, { name: "Bar" }] },
    // Sports Bar primary â€” kept.
    { fsq_place_id: "fsq-26", name: "Losers Bar", latitude: 36.16, longitude: -86.78, categories: [{ name: "Sports Bar" }, { name: "Dive Bar" }] },
    { fsq_place_id: "fsq-27", name: "Sonic Drive-In", latitude: 36.16, longitude: -86.78, categories: [{ name: "Fast Food Restaurant" }, { name: "Burger Joint" }] },
    { fsq_place_id: "fsq-28", name: "Wingstop", latitude: 36.16, longitude: -86.78, categories: [{ name: "Wings Joint" }] },
    { fsq_place_id: "fsq-29", name: "Jersey Mike's Subs", latitude: 36.16, longitude: -86.78, categories: [{ name: "Sandwich Spot" }, { name: "Deli" }] },
    { fsq_place_id: "fsq-30", name: "Al Taglio Pizzeria", latitude: 36.16, longitude: -86.78, categories: [{ name: "Pizzeria" }] },
    { fsq_place_id: "fsq-31", name: "White Castle", latitude: 36.16, longitude: -86.78, categories: [{ name: "Fast Food Restaurant" }, { name: "American Restaurant" }, { name: "Burger Joint" }] },
    { fsq_place_id: "fsq-32", name: "Emmy Squared Pizza", latitude: 36.16, longitude: -86.78, categories: [{ name: "Pizzeria" }] },
    { fsq_place_id: "fsq-33", name: "KFC", latitude: 36.16, longitude: -86.78, categories: [{ name: "Fried Chicken Joint" }, { name: "Fast Food Restaurant" }] },
    { fsq_place_id: "fsq-34", name: "Chicken & Wings", latitude: 36.16, longitude: -86.78, categories: [{ name: "Wings Joint" }] },
    { fsq_place_id: "fsq-35", name: "Subway", latitude: 36.16, longitude: -86.78, categories: [{ name: "Sandwich Spot" }, { name: "Fast Food Restaurant" }] },
    { fsq_place_id: "fsq-36", name: "Burger King", latitude: 36.16, longitude: -86.78, categories: [{ name: "Fast Food Restaurant" }] },
  ]);

Deno.test("shapeFoursquareResult â€” bug-15 â€” regression: prod room d11b3983 pool drops Robert's, keeps both Sports Bars", () => {
  // The exact 36-option pool that produced the Robert's Western World
  // verdict in prod room d11b3983-a8f6-4741-81a5-309ba038a2f6 on
  // 2026-05-19. Source row: supabase `options` table (queried 2026-05-19).
  const survivors = PROD_ROOM_D11B3983_POOL
    .map((r) => shapeFoursquareResult(r, []))
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .map((s) => s.name);

  // The leak vanishes.
  assertEquals(survivors.includes("Robert's Western World"), false);
  // The two Sports-Bar-primary venues stay.
  assertEquals(survivors.includes("Neighbors"), true);
  assertEquals(survivors.includes("Losers Bar"), true);
  // Tennessee Brew Works (Brewery-primary) is an accepted false-cut.
  assertEquals(survivors.includes("Tennessee Brew Works"), false);
  // Meal-primary + nightlife-only bars are kept (19-venue bucket).
  assertEquals(survivors.includes("The Slider House"), true);
  assertEquals(survivors.includes("Batters Box Bar & Grill"), true);
  // Non-bar restaurants untouched.
  assertEquals(survivors.includes("Hattie B's Hot Chicken"), true);
  assertEquals(survivors.includes("Velvet Taco"), true);
});

// ---------------------------------------------------------------------------
// Post-filter (taste tokens).
// ---------------------------------------------------------------------------

Deno.test("applyPostFilters â€” keeps results that include at least one synonym per group", () => {
  const has: FoursquareSearchResult = {
    ...SAMPLE_RESULT,
    tastes: ["gluten-free", "vegan menu"],
  };
  const missing: FoursquareSearchResult = {
    ...SAMPLE_RESULT,
    tastes: ["vegan menu"],
  };
  // One requirement group: ["gluten-free", "gluten free"] â€” synonyms OR'd.
  const filtered = applyPostFilters(
    [has, missing],
    [["gluten-free", "gluten free"]],
  );
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].tastes, ["gluten-free", "vegan menu"]);
});

Deno.test("applyPostFilters â€” empty group list is a no-op", () => {
  const filtered = applyPostFilters([SAMPLE_RESULT], []);
  assertEquals(filtered.length, 1);
});

Deno.test("applyPostFilters â€” multiple groups all need at least one match", () => {
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

Deno.test("DIETARY_CHIP_MAP â€” every Q1 chip from the PRD is mapped", () => {
  // PRD Â§"Quiz copy": Gluten Â· Dairy Â· Shellfish Â· Needs vegan options Â· Halal-only Â· Nothing tonight
  // The map normalizes to lowercased single-word chips.
  for (const chip of ["gluten", "dairy", "shellfish", "vegan", "halal"]) {
    assertExists(findDietaryMapping(chip), `${chip} chip is unmapped`);
  }
});

Deno.test("DIETARY_CHIP_MAP â€” disclaimers map covers allergen chips", () => {
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

Deno.test("extractDietaryTags â€” independent of caller's emitted_tags", () => {
  const tagsFromCategory = extractDietaryTags(
    { ...SAMPLE_RESULT, tastes: [] },
    [],
  );
  // The vegan category alone is enough; the emitted_tags input only
  // augments, never gates.
  assertEquals(tagsFromCategory.includes("vegan_friendly"), true);
});

Deno.test("photoToUrl â€” composes prefix + size + suffix", () => {
  assertEquals(
    photoToUrl({ prefix: "https://img.x/", suffix: "/y.jpg" }),
    "https://img.x/400x400/y.jpg",
  );
});

// Ensure the chip map has no duplicate entries.
Deno.test("DIETARY_CHIP_MAP â€” no duplicate chip names", () => {
  const chips = DIETARY_CHIP_MAP.map((m) => m.chip);
  assertEquals(chips.length, new Set(chips).size);
});

// Regression guard for the 2026-05-17 category-id fix. The legacy short
// numeric ids (e.g. "13303") return HTTP 400 from the post-2025
// Foursquare surface; every taxonomy id must be a 24-char hex string.
const HEX24_CATEGORY_ID = /^[0-9a-f]{24}$/;

Deno.test("CUISINE_CATEGORY_MAP â€” every id is a live hex taxonomy id", () => {
  for (const m of CUISINE_CATEGORY_MAP) {
    assertEquals(
      HEX24_CATEGORY_ID.test(m.fsq_category_id),
      true,
      `cuisine ${m.cuisine} id "${m.fsq_category_id}" is not a 24-char hex id`,
    );
  }
});

Deno.test("DIETARY_CHIP_MAP â€” every category-strategy id is a live hex taxonomy id", () => {
  for (const m of DIETARY_CHIP_MAP) {
    if (m.strategy !== "category" || !m.fsq_category_ids) continue;
    for (const id of m.fsq_category_ids.split(",")) {
      assertEquals(
        HEX24_CATEGORY_ID.test(id),
        true,
        `dietary ${m.chip} id "${id}" is not a 24-char hex id`,
      );
    }
  }
});

Deno.test("extractDietaryTags â€” reads the post-2025 fsq_category_id field", () => {
  // The category-id key migrated from `id` to `fsq_category_id` on the
  // 2025 Foursquare surface; a halal-category venue must still tag.
  const tags = extractDietaryTags(
    {
      ...SAMPLE_RESULT,
      tastes: [],
      categories: [
        { fsq_category_id: "52e81612bcbc57f1066b79ff", name: "Halal Restaurant" },
      ],
    },
    [],
  );
  assertEquals(tags.includes("halal"), true);
});

// ---------------------------------------------------------------------------
// Cuisine advisory tag (tb-17) â€” per-call category scoping.
// ---------------------------------------------------------------------------

/** The eight QuizCuisine ids the iOS Q1 surface emits. Kept in sync with
 *  `legacy Swift ios/Sources/App/QuizCoordinator.swift` enum `QuizCuisine`. */
const QUIZ_CUISINE_IDS = [
  "mexican",
  "italian",
  "japanese",
  "chinese",
  "thai",
  "indian",
  "american",
  "mediterranean",
];

Deno.test("CUISINE_CATEGORY_MAP â€” every QuizCuisine id maps to a category", () => {
  for (const id of QUIZ_CUISINE_IDS) {
    const mapping = findCuisineCategory(id);
    assertExists(mapping, `${id} cuisine is unmapped`);
    // The category id must be a non-empty Foursquare taxonomy id.
    assertEquals(mapping.fsq_category_id.length > 0, true);
  }
});

Deno.test("CUISINE_CATEGORY_MAP â€” no duplicate cuisine ids", () => {
  const ids = CUISINE_CATEGORY_MAP.map((m) => m.cuisine);
  assertEquals(ids.length, new Set(ids).size);
});

Deno.test("findCuisineCategory â€” is case- and whitespace-tolerant", () => {
  const a = findCuisineCategory("Mexican");
  const b = findCuisineCategory("  mexican  ");
  assertExists(a);
  assertExists(b);
  assertEquals(a.fsq_category_id, b.fsq_category_id);
});

Deno.test("findCuisineCategory â€” unknown cuisine returns undefined", () => {
  assertEquals(findCuisineCategory("klingon"), undefined);
  assertEquals(findCuisineCategory(""), undefined);
});

Deno.test("buildFoursquareQuery â€” cuisine tag applies the mapped category to the wire query", () => {
  const mexican = findCuisineCategory("mexican");
  assertExists(mexican);
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { cuisine: "mexican" },
  });
  assertEquals(plan.query.get("fsq_category_ids"), mexican.fsq_category_id);
});

Deno.test("buildFoursquareQuery â€” general call (no cuisine tag) stays un-cuisine-scoped but carries the floor", () => {
  // research-01 Â§3.2: the mandatory general call supplies non-craved
  // breadth and must NOT be cuisine-filtered. tb-25 / ADR 0012: it IS
  // venue-class floored â€” the floor is orthogonal to cuisine (every
  // cuisine is a Restaurant child, so the Q5 cuisine-drop card survives).
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
  });
  assertEquals(
    plan.query.get("fsq_category_ids"),
    [...CANDIDATE_POOL_FLOOR_CATEGORY_IDS].sort().join(","),
  );
});

Deno.test("buildFoursquareQuery â€” unknown cuisine degrades to the general query (no error)", () => {
  // An unknown cuisine id must not throw and must not leak onto the wire.
  // tb-25 / ADR 0012: with no resolvable cuisine category, the set is
  // empty and degrades to the floored general query.
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { cuisine: "klingon" },
  });
  assertEquals(
    plan.query.get("fsq_category_ids"),
    [...CANDIDATE_POOL_FLOOR_CATEGORY_IDS].sort().join(","),
  );
});

Deno.test("buildFoursquareQuery â€” cuisine + dietary categories both reach the wire", () => {
  // A per-cuisine call can still carry the profile dietary category
  // (e.g. a halal member craving Mexican). Both ids land in the
  // sorted, comma-joined fsq_category_ids list.
  const mexican = findCuisineCategory("mexican");
  assertExists(mexican);
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { cuisine: "mexican", dietary: ["halal"] },
  });
  const ids = plan.query.get("fsq_category_ids");
  assertExists(ids);
  const idSet = new Set(ids.split(","));
  assertEquals(idSet.has(mexican.fsq_category_id), true);
  assertEquals(idSet.has("52e81612bcbc57f1066b79ff"), true); // halal category
});

Deno.test("buildQuerySignature â€” cuisine tag changes the cache signature", () => {
  // Two per-cuisine calls at the same geo must not collide in the
  // cache, and a per-cuisine call must not collide with the general call.
  const general = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
  });
  const mexican = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { cuisine: "mexican" },
  });
  const italian = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { cuisine: "italian" },
  });
  assertEquals(general === mexican, false);
  assertEquals(mexican === italian, false);
});

Deno.test("buildQuerySignature â€” unknown cuisine signs identically to the general call", () => {
  // An unknown cuisine degrades to the general query, so it must also
  // share the general call's cache row rather than minting a dead one.
  const general = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
  });
  const unknown = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { cuisine: "klingon" },
  });
  assertEquals(general, unknown);
});

// ---------------------------------------------------------------------------
// Candidate-pool floor (tb-25 / ADR 0012) â€” the venue-type allowlist seeded
// onto any Foursquare call whose category-id set is otherwise empty.
// ---------------------------------------------------------------------------

/** The eight live-probed (2026-05-19) hex taxonomy ids of the floor:
 *  Restaurant, Sports Bar, Food Court, Food Truck, Food Stand, Cafeteria,
 *  Breakfast Spot, Bagel Shop. Kept here so the test asserts the exact
 *  membership the ADR specifies, independently of the module constant. */
const FLOOR_IDS_EXPECTED = [
  "4d4b7105d754a06374d81259", // Restaurant (parent â€” descendant-inclusive)
  "4bf58dd8d48988d11d941735", // Sports Bar
  "4bf58dd8d48988d120951735", // Food Court
  "4bf58dd8d48988d1cb941735", // Food Truck
  "5283c7b4e4b094cb91ad6b1b", // Food Stand
  "4bf58dd8d48988d128941735", // Cafeteria
  "4bf58dd8d48988d143941735", // Breakfast Spot
  "4bf58dd8d48988d179941735", // Bagel Shop
];

Deno.test("CANDIDATE_POOL_FLOOR_CATEGORY_IDS â€” is a single exported eight-id constant", () => {
  // ADR 0012: the floor lives in one named, exported constant â€” the
  // canonical source of truth alongside CUISINE_CATEGORY_MAP.
  assertEquals(CANDIDATE_POOL_FLOOR_CATEGORY_IDS.length, 8);
  assertEquals(
    [...CANDIDATE_POOL_FLOOR_CATEGORY_IDS].sort(),
    [...FLOOR_IDS_EXPECTED].sort(),
  );
});

Deno.test("CANDIDATE_POOL_FLOOR_CATEGORY_IDS â€” every member is a live hex taxonomy id", () => {
  for (const id of CANDIDATE_POOL_FLOOR_CATEGORY_IDS) {
    assertEquals(
      HEX24_CATEGORY_ID.test(id),
      true,
      `floor id "${id}" is not a 24-char hex id`,
    );
  }
});

Deno.test("buildFoursquareQuery â€” general call seeds the eight-category floor", () => {
  // ADR 0012: a general call carries no cuisine and no dietary category,
  // so its category-id set is empty and the floor is seeded.
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
  });
  const ids = plan.query.get("fsq_category_ids");
  assertExists(ids);
  assertEquals(
    ids,
    [...CANDIDATE_POOL_FLOOR_CATEGORY_IDS].sort().join(","),
  );
});

Deno.test("buildFoursquareQuery â€” per-cuisine call carries only the cuisine id, floor NOT OR-appended", () => {
  // ADR 0012: fsq_category_ids is OR semantics â€” appending the floor to
  // a per-cuisine call would OR-broaden it straight back to all
  // restaurants. The floor is a fallback, never an addition.
  const mexican = findCuisineCategory("mexican");
  assertExists(mexican);
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { cuisine: "mexican" },
  });
  assertEquals(plan.query.get("fsq_category_ids"), mexican.fsq_category_id);
});

Deno.test("buildFoursquareQuery â€” dietary category present means the floor is NOT added", () => {
  // ADR 0012: a dietary category is a hard veto, correctly narrower than
  // the floor. A non-empty category set suppresses the floor.
  const plan = buildFoursquareQuery({
    lat: 40.7128,
    lng: -74.0060,
    radius_meters: 1600,
    filters: { dietary: ["halal"] },
  });
  // Only the halal category id â€” no floor members.
  assertEquals(plan.query.get("fsq_category_ids"), "52e81612bcbc57f1066b79ff");
});

Deno.test("buildFoursquareQuery â€” fsq_category_ids is never emitted empty", () => {
  // The core invariant: every call shape emits a non-empty category id
  // list. General, disclaimer-only, no-op, and unknown-cuisine calls all
  // fall back to the floor.
  const shapes = [
    {},
    { dietary: ["shellfish"] }, // disclaimer-only â€” no category id
    { dietary: ["Nothing tonight"] }, // no-op chip
    { cuisine: "klingon" }, // unknown cuisine
  ];
  for (const filters of shapes) {
    const plan = buildFoursquareQuery({
      lat: 0, lng: 0, radius_meters: 100, filters,
    });
    const ids = plan.query.get("fsq_category_ids");
    assertExists(ids, `expected fsq_category_ids for ${JSON.stringify(filters)}`);
    assertEquals(ids.length > 0, true);
  }
});

Deno.test("buildQuerySignature â€” floor seeding is signature-stable across the change", () => {
  // The floor is deterministic, so two general calls at the same geo
  // still produce the identical signature â€” the floor must not introduce
  // any cache-key churn.
  const a = buildQuerySignature({ lat: 0, lng: 0, radius_meters: 100 });
  const b = buildQuerySignature({ lat: 0, lng: 0, radius_meters: 100 });
  assertEquals(a, b);
  // An unknown-cuisine call degrades to the general query and must still
  // share the general call's cache row even with the floor seeded.
  const unknown = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { cuisine: "klingon" },
  });
  assertEquals(a, unknown);
  // A per-cuisine call (floor NOT seeded) still signs distinctly from
  // the general/floored call.
  const mexican = buildQuerySignature({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { cuisine: "mexican" },
  });
  assertEquals(a === mexican, false);
});
