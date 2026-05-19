// Integration tests for the PlacesProxy core orchestrator.
//
// Exercises the cache miss → Foursquare fetch → cache write → cache hit
// loop against a recorded Foursquare response payload (no real HTTP).

import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type CacheAdapter,
  type CacheRow,
  FoursquareUpstreamError,
  handlePlacesProxy,
  isCacheRowFresh,
  PlacesProxyInputError,
  type ProxyDeps,
  validateInput,
} from "./places-proxy-core.ts";
import {
  CANDIDATE_POOL_FLOOR_CATEGORY_IDS,
  FOURSQUARE_API_VERSION,
  type FoursquareSearchResponse,
  type PlacesProxyInput,
  THIN_RESULTS_THRESHOLD,
} from "./foursquare.ts";

/** The sorted, comma-joined candidate-pool floor (tb-25 / ADR 0012) —
 *  the wire value of `fsq_category_ids` on any call whose category set
 *  is otherwise empty. */
const FLOOR_WIRE = [...CANDIDATE_POOL_FLOOR_CATEGORY_IDS].sort().join(",");

// ---------------------------------------------------------------------------
// Test fixtures.
// ---------------------------------------------------------------------------

/** Recorded Foursquare response — fields verified against the live
 *  surface 2026-05-13 (ADR 0002 §"Live API surface verified"). */
const RECORDED_FOURSQUARE_RESPONSE: FoursquareSearchResponse = {
  results: [
    {
      fsq_place_id: "fsq-place-001",
      name: "Halal Hut",
      latitude: 40.7130,
      longitude: -74.0062,
      categories: [
        { fsq_category_id: "52e81612bcbc57f1066b79ff", name: "Halal Restaurant" },
      ],
      location: { formatted_address: "1 Main St, NYC" },
      price: 2,
      hours: { display: "11am–10pm", open_now: true },
      photos: [{ prefix: "https://fsq.example/", suffix: "/p1.jpg" }],
      tastes: ["lamb", "kebab"],
      distance: 160,
    },
    {
      fsq_place_id: "fsq-place-002",
      name: "Kosher Korner",
      latitude: 40.7135,
      longitude: -74.0068,
      categories: [
        { fsq_category_id: "52e81612bcbc57f1066b79fc", name: "Kosher Restaurant" },
      ],
      location: { formatted_address: "2 Main St, NYC" },
      price: 3,
      hours: { display: "noon–9pm", open_now: false },
      photos: [],
      tastes: [],
      distance: 320,
    },
    {
      fsq_place_id: "fsq-place-003",
      name: "Gluten-Smart Bistro",
      latitude: 40.7140,
      longitude: -74.0080,
      categories: [
        { fsq_category_id: "4bf58dd8d48988d14e941735", name: "American Restaurant" },
      ],
      location: { formatted_address: "3 Main St, NYC" },
      price: 2,
      hours: { display: "5pm–11pm", open_now: true },
      photos: [{ prefix: "https://fsq.example/", suffix: "/p3.jpg" }],
      tastes: ["gluten-free", "farm to table"],
      distance: 800,
    },
  ],
};

/** In-memory cache adapter for tests. */
class MemoryCache implements CacheAdapter {
  private store = new Map<string, CacheRow>();
  public reads = 0;
  public writes = 0;

  private key(geo_h3: string, query_signature: string): string {
    return `${geo_h3}::${query_signature}`;
  }

  get(geo_h3: string, query_signature: string): Promise<CacheRow | null> {
    this.reads++;
    return Promise.resolve(this.store.get(this.key(geo_h3, query_signature)) ?? null);
  }

  put(row: CacheRow): Promise<void> {
    this.writes++;
    this.store.set(this.key(row.geo_h3, row.query_signature), row);
    return Promise.resolve();
  }

  /** Direct seed for the cache-hit test path. */
  seed(row: CacheRow): void {
    this.store.set(this.key(row.geo_h3, row.query_signature), row);
  }

  size(): number {
    return this.store.size;
  }
}

/** Builds a fetch stub that records the URL + headers it saw and
 *  returns the supplied response. */
function stubFetch(
  response: Response,
): { fetch: ProxyDeps["fetch"]; calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  return {
    calls,
    fetch: (input, init) => {
      calls.push({ url: String(input), init });
      // Return a clone so the response can be reused across tests if
      // the caller chains .text()/.json().
      return Promise.resolve(response.clone());
    },
  };
}

function recordedResponse(body: FoursquareSearchResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildDeps(overrides: Partial<ProxyDeps> = {}): {
  cache: MemoryCache;
  fetchCalls: { url: string; init?: RequestInit }[];
  deps: ProxyDeps;
} {
  const cache = new MemoryCache();
  const stub = stubFetch(recordedResponse(RECORDED_FOURSQUARE_RESPONSE));
  return {
    cache,
    fetchCalls: stub.calls,
    deps: {
      cache,
      fetch: stub.fetch,
      apiKey: "test-api-key",
      now: () => new Date("2026-05-13T12:00:00Z"),
      ...overrides,
    },
  };
}

const TYPICAL_INPUT: PlacesProxyInput = {
  lat: 40.7128,
  lng: -74.0060,
  radius_meters: 1600,
  filters: { dietary: ["halal"] },
};

// ---------------------------------------------------------------------------
// Cache hit / miss / write.
// ---------------------------------------------------------------------------

Deno.test("cache miss — calls Foursquare, writes cache, returns shaped rows", async () => {
  const { cache, fetchCalls, deps } = buildDeps();
  const result = await handlePlacesProxy(TYPICAL_INPUT, deps);

  // 1. Foursquare was actually called.
  assertEquals(fetchCalls.length, 1);
  // 2. With the right headers — bearer key + pinned version.
  const headers = fetchCalls[0].init?.headers as Record<string, string>;
  assertEquals(headers["Authorization"], "Bearer test-api-key");
  assertEquals(headers["X-Places-Api-Version"], FOURSQUARE_API_VERSION);
  // 3. URL targets the post-migration host, not the v3 legacy.
  assertEquals(fetchCalls[0].url.startsWith("https://places-api.foursquare.com/places/search?"), true);
  // 4. Cache was written.
  assertEquals(cache.writes, 1);
  // 5. Response carries the shaped rows.
  assertEquals(result.places.length, 3);
  assertEquals(result.places[0].fsq_place_id, "fsq-place-001");
  assertEquals(result.served_from_cache, false);
});

Deno.test("cache hit — returns cached rows without calling Foursquare", async () => {
  const { cache, fetchCalls, deps } = buildDeps();
  // First call populates the cache.
  await handlePlacesProxy(TYPICAL_INPUT, deps);
  assertEquals(fetchCalls.length, 1);
  // Second call must be served from cache.
  const second = await handlePlacesProxy(TYPICAL_INPUT, deps);
  assertEquals(fetchCalls.length, 1, "Foursquare must NOT be called on a fresh-cache hit");
  assertEquals(second.served_from_cache, true);
  assertEquals(second.places.length, 3);
  // Sanity: only one cache row stored.
  assertEquals(cache.size(), 1);
});

Deno.test("cache miss — same geo but different filter set creates a second row", async () => {
  const { cache, fetchCalls, deps } = buildDeps();
  await handlePlacesProxy(TYPICAL_INPUT, deps);
  await handlePlacesProxy({ ...TYPICAL_INPUT, filters: { dietary: ["kosher"] } }, deps);
  assertEquals(fetchCalls.length, 2);
  assertEquals(cache.size(), 2);
});

Deno.test("cache hit — same geo, identical filter set with reordered chips hits the same row", async () => {
  const { fetchCalls, deps } = buildDeps();
  await handlePlacesProxy({
    ...TYPICAL_INPUT,
    filters: { dietary: ["halal", "kosher"] },
  }, deps);
  await handlePlacesProxy({
    ...TYPICAL_INPUT,
    filters: { dietary: ["kosher", "halal"] },
  }, deps);
  assertEquals(fetchCalls.length, 1, "filter-order permutation must hit the same cache row");
});

Deno.test("cache miss — expired cache row triggers re-fetch", async () => {
  const { cache, fetchCalls, deps } = buildDeps({
    now: () => new Date("2026-05-15T13:00:00Z"), // > 24h after the stale row
  });
  cache.seed({
    geo_h3: "40.7130_-74.0060",
    query_signature: "anything",
    payload: { places: [], disclaimers: [] },
    cached_at: "2026-05-13T12:00:00Z",
  });
  await handlePlacesProxy(TYPICAL_INPUT, deps);
  // Expired hit → went to Foursquare, then wrote a fresh row.
  assertEquals(fetchCalls.length, 1);
});

// ---------------------------------------------------------------------------
// Dietary-tag round-trip.
// ---------------------------------------------------------------------------

Deno.test("dietary filter — halal chip puts category id on the Foursquare wire", async () => {
  const { fetchCalls, deps } = buildDeps();
  await handlePlacesProxy(TYPICAL_INPUT, deps);
  const url = new URL(fetchCalls[0].url);
  assertEquals(
    url.searchParams.get("fsq_category_ids"),
    "52e81612bcbc57f1066b79ff",
  );
});

Deno.test("dietary filter — gluten chip is applied post-fetch, not on the wire", async () => {
  const { fetchCalls, deps } = buildDeps();
  await handlePlacesProxy({
    ...TYPICAL_INPUT,
    filters: { dietary: ["gluten"] },
  }, deps);
  const url = new URL(fetchCalls[0].url);
  // tb-25 / ADR 0012: gluten is a `tastes` post-filter and contributes
  // no category id, so the category set is empty and the candidate-pool
  // floor is seeded — the wire carries the floor, never empty.
  assertEquals(url.searchParams.get("fsq_category_ids"), FLOOR_WIRE);
});

Deno.test("dietary filter — gluten post-filter rejects results without the taste token", async () => {
  // Use a fresh deps so the stub fetch returns the recorded payload —
  // only the "Gluten-Smart Bistro" entry has a matching taste token.
  const { deps } = buildDeps();
  const result = await handlePlacesProxy({
    ...TYPICAL_INPUT,
    filters: { dietary: ["gluten"] },
  }, deps);
  assertEquals(result.places.length, 1);
  assertEquals(result.places[0].fsq_place_id, "fsq-place-003");
  assertEquals(result.places[0].dietary_tags.includes("gluten_free_options"), true);
});

Deno.test("dietary filter — shellfish chip surfaces as disclaimer in the response", async () => {
  const { deps } = buildDeps();
  const result = await handlePlacesProxy({
    ...TYPICAL_INPUT,
    filters: { dietary: ["shellfish"] },
  }, deps);
  assertEquals(result.disclaimers, ["no_shellfish_unverified"]);
  // The shaped rows carry the disclaimer tag so the engine + verdict
  // surface can render the rule chip text.
  assert(result.places.every((p) => p.dietary_tags.includes("no_shellfish_unverified")));
});

// ---------------------------------------------------------------------------
// Cuisine advisory tag (tb-17) — per-call category scoping.
// ---------------------------------------------------------------------------

Deno.test("cuisine tag — per-cuisine call puts the mapped category on the Foursquare wire", async () => {
  const { fetchCalls, deps } = buildDeps();
  await handlePlacesProxy({
    ...TYPICAL_INPUT,
    filters: { cuisine: "italian" },
  }, deps);
  const url = new URL(fetchCalls[0].url);
  // Italian Restaurant maps to Foursquare category 4bf58dd8d48988d110941735.
  assertEquals(
    url.searchParams.get("fsq_category_ids"),
    "4bf58dd8d48988d110941735",
  );
});

Deno.test("cuisine tag — mandatory general call is NOT cuisine-scoped but carries the floor", async () => {
  const { fetchCalls, deps } = buildDeps();
  await handlePlacesProxy({
    ...TYPICAL_INPUT,
    filters: {},
  }, deps);
  const url = new URL(fetchCalls[0].url);
  // tb-25 / ADR 0012: the general call carries no cuisine id, so the
  // candidate-pool floor is seeded — venue-class floored, not
  // cuisine-scoped. The floor is orthogonal to cuisine.
  assertEquals(url.searchParams.get("fsq_category_ids"), FLOOR_WIRE);
});

Deno.test("cuisine tag — unknown cuisine degrades to the general query without error", async () => {
  const { fetchCalls, deps } = buildDeps();
  const result = await handlePlacesProxy({
    ...TYPICAL_INPUT,
    filters: { cuisine: "klingon" },
  }, deps);
  const url = new URL(fetchCalls[0].url);
  // tb-25 / ADR 0012: an unresolvable cuisine leaves the category set
  // empty, so it degrades to the floored general query.
  assertEquals(url.searchParams.get("fsq_category_ids"), FLOOR_WIRE);
  // Degrades gracefully — full result set, no error surfaced.
  assertEquals(result.places.length, 3);
});

Deno.test("cuisine tag — per-cuisine and general calls occupy distinct cache rows", async () => {
  const { cache, fetchCalls, deps } = buildDeps();
  await handlePlacesProxy({ ...TYPICAL_INPUT, filters: {} }, deps);
  await handlePlacesProxy({ ...TYPICAL_INPUT, filters: { cuisine: "thai" } }, deps);
  assertEquals(fetchCalls.length, 2);
  assertEquals(cache.size(), 2);
});

Deno.test("validateInput — keeps a valid cuisine tag on the filters", () => {
  const v = validateInput({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { cuisine: "mexican" },
  });
  assertEquals(v.filters?.cuisine, "mexican");
});

Deno.test("validateInput — tolerates a missing / non-string cuisine key", () => {
  // The general call omits `cuisine` entirely; a malformed value must
  // not throw — it simply drops to undefined.
  const noKey = validateInput({ lat: 0, lng: 0, radius_meters: 100, filters: {} });
  assertEquals(noKey.filters?.cuisine, undefined);
  const badType = validateInput({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { cuisine: 42 },
  });
  assertEquals(badType.filters?.cuisine, undefined);
});

Deno.test("validateInput — keeps a valid open_at DHHMM token", () => {
  const v = validateInput({
    lat: 0, lng: 0, radius_meters: 100,
    filters: { open_at: "3T1900" },
  });
  assertEquals(v.filters?.open_at, "3T1900");
});

Deno.test("validateInput — tolerates a missing open_at key", () => {
  const v = validateInput({ lat: 0, lng: 0, radius_meters: 100, filters: {} });
  assertEquals(v.filters?.open_at, undefined);
});

Deno.test("validateInput — rejects a malformed open_at loudly", () => {
  // A present-but-malformed open_at is a client bug. Reject with a 400
  // rather than swallowing it — a swallowed bad open_at (the unix-epoch
  // format) is exactly what silently broke the Q5 fetch pipeline.
  for (const bad of ["2026-05-13T18:00:00Z", "1778695200", "0T1900", "3T2500", "3T1960"]) {
    assertThrows(
      () =>
        validateInput({
          lat: 0, lng: 0, radius_meters: 100,
          filters: { open_at: bad },
        }),
      PlacesProxyInputError,
      "open_at",
      `expected reject for "${bad}"`,
    );
  }
});

// ---------------------------------------------------------------------------
// Thin-results signal — iOS MapKit fallback trigger.
// ---------------------------------------------------------------------------

Deno.test("thin-results — empty Foursquare response sets is_thin=true", async () => {
  const cache = new MemoryCache();
  const stub = stubFetch(recordedResponse({ results: [] }));
  const result = await handlePlacesProxy(TYPICAL_INPUT, {
    cache,
    fetch: stub.fetch,
    apiKey: "test-api-key",
    now: () => new Date("2026-05-13T12:00:00Z"),
  });
  assertEquals(result.is_thin, true);
  assertEquals(result.places.length, 0);
});

Deno.test("thin-results — fewer than THIN_RESULTS_THRESHOLD rows sets is_thin=true", async () => {
  // Provide one result — below the threshold.
  const cache = new MemoryCache();
  const stub = stubFetch(recordedResponse({
    results: [RECORDED_FOURSQUARE_RESPONSE.results[0]],
  }));
  const result = await handlePlacesProxy(TYPICAL_INPUT, {
    cache,
    fetch: stub.fetch,
    apiKey: "test-api-key",
    now: () => new Date("2026-05-13T12:00:00Z"),
  });
  assertEquals(result.is_thin, true);
  assertEquals(result.places.length < THIN_RESULTS_THRESHOLD, true);
});

Deno.test("thin-results — Foursquare 5xx returns is_thin=true (graceful fallback)", async () => {
  const cache = new MemoryCache();
  const stub = stubFetch(new Response("upstream down", { status: 503 }));
  const result = await handlePlacesProxy(TYPICAL_INPUT, {
    cache,
    fetch: stub.fetch,
    apiKey: "test-api-key",
    now: () => new Date("2026-05-13T12:00:00Z"),
  });
  assertEquals(result.is_thin, true);
  assertEquals(result.places.length, 0);
  assertEquals(result.error, "foursquare_upstream_503");
});

Deno.test("upstream 4xx — surfaces a soft error, not a silent empty 200", async () => {
  // A 429 (Foursquare credit exhaustion) or a 401/403 must not be
  // swallowed into an unmarked empty 200 — the client and the deploy
  // diagnostic need a named error to tell "no credits" apart from
  // "genuinely no venues nearby". Regression guard for the 2026-05-16
  // empty-places incident.
  const cache = new MemoryCache();
  const stub = stubFetch(
    new Response("no API credits remaining", { status: 429 }),
  );
  const result = await handlePlacesProxy(TYPICAL_INPUT, {
    cache,
    fetch: stub.fetch,
    apiKey: "test-api-key",
    now: () => new Date("2026-05-13T12:00:00Z"),
  });
  assertEquals(result.is_thin, true);
  assertEquals(result.places.length, 0);
  assertEquals(result.error, "foursquare_upstream_429");
});

Deno.test("thin-results — Foursquare 410 fails loud (version pin slipped)", async () => {
  const cache = new MemoryCache();
  const stub = stubFetch(new Response("gone", { status: 410 }));
  await assertRejects(
    () => handlePlacesProxy(TYPICAL_INPUT, {
      cache,
      fetch: stub.fetch,
      apiKey: "test-api-key",
      now: () => new Date("2026-05-13T12:00:00Z"),
    }),
    FoursquareUpstreamError,
    "410",
  );
});

// ---------------------------------------------------------------------------
// Input validation + secret hygiene.
// ---------------------------------------------------------------------------

Deno.test("validateInput — rejects missing lat", () => {
  let err: unknown;
  try {
    validateInput({ lng: 0, radius_meters: 100 });
  } catch (e) {
    err = e;
  }
  assertExists(err);
  assert(err instanceof PlacesProxyInputError);
});

Deno.test("validateInput — rejects out-of-range lat", () => {
  let err: unknown;
  try {
    validateInput({ lat: 999, lng: 0, radius_meters: 100 });
  } catch (e) {
    err = e;
  }
  assert(err instanceof PlacesProxyInputError);
});

Deno.test("validateInput — accepts a minimal valid input", () => {
  const v = validateInput({ lat: 0, lng: 0, radius_meters: 100 });
  assertEquals(v.lat, 0);
  assertEquals(v.lng, 0);
  assertEquals(v.radius_meters, 100);
});

Deno.test("validateInput — rejects radius > 100km", () => {
  let err: unknown;
  try {
    validateInput({ lat: 0, lng: 0, radius_meters: 200_000 });
  } catch (e) {
    err = e;
  }
  assert(err instanceof PlacesProxyInputError);
});

Deno.test("secret hygiene — API key never appears in the response body", async () => {
  const { deps } = buildDeps();
  const result = await handlePlacesProxy(TYPICAL_INPUT, deps);
  const serialized = JSON.stringify(result);
  assertEquals(serialized.includes("test-api-key"), false);
});

Deno.test("secret hygiene — API key never appears in the cached payload", async () => {
  const { cache, deps } = buildDeps();
  await handlePlacesProxy(TYPICAL_INPUT, deps);
  for (const [, row] of (cache as unknown as { store: Map<string, CacheRow> }).store) {
    assertEquals(JSON.stringify(row.payload).includes("test-api-key"), false);
  }
});

// ---------------------------------------------------------------------------
// Freshness helper.
// ---------------------------------------------------------------------------

Deno.test("isCacheRowFresh — returns true for a 1-second-old row", () => {
  const now = new Date("2026-05-13T12:00:00Z");
  const row: CacheRow = {
    geo_h3: "0_0",
    query_signature: "x",
    payload: { places: [], disclaimers: [] },
    cached_at: new Date(now.getTime() - 1000).toISOString(),
  };
  assertEquals(
    isCacheRowFresh(row, {
      cache: new MemoryCache(),
      fetch: () => Promise.reject("unused"),
      apiKey: "",
      now: () => now,
    }),
    true,
  );
});

Deno.test("isCacheRowFresh — returns false for a 48-hour-old row", () => {
  const now = new Date("2026-05-13T12:00:00Z");
  const row: CacheRow = {
    geo_h3: "0_0",
    query_signature: "x",
    payload: { places: [], disclaimers: [] },
    cached_at: new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString(),
  };
  assertEquals(
    isCacheRowFresh(row, {
      cache: new MemoryCache(),
      fetch: () => Promise.reject("unused"),
      apiKey: "",
      now: () => now,
    }),
    false,
  );
});
