// HTTP-layer tests for the PlacesProxy Edge Function entry point.
// Verifies method gating, auth gating, and config gating without
// spinning up Deno.serve.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./handler.ts";
import {
  type CacheAdapter,
  GOOGLE_Q5_FIELD_MASK,
} from "../_shared/places-proxy-core.ts";

function memoryCache(): CacheAdapter {
  const store = new Map();
  return {
    get(g, q) {
      return Promise.resolve(store.get(`${g}::${q}`) ?? null);
    },
    put(row) {
      store.set(`${row.geo_h3}::${row.query_signature}`, row);
      return Promise.resolve();
    },
  };
}

function envOk() {
  return {
    FOURSQUARE_API_KEY: "test-key",
    GOOGLE_PLACES_API_KEY: "google-key",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  };
}

Deno.test("handleRequest — OPTIONS returns 204 with CORS headers", async () => {
  const res = await handleRequest(
    new Request("https://example/places-proxy", { method: "OPTIONS" }),
    { env: envOk(), buildCacheAdapter: memoryCache },
  );
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("Access-Control-Allow-Methods")?.includes("POST"), true);
});

Deno.test("handleRequest — GET returns 405", async () => {
  const res = await handleRequest(
    new Request("https://example/places-proxy", { method: "GET" }),
    { env: envOk(), buildCacheAdapter: memoryCache },
  );
  assertEquals(res.status, 405);
});

Deno.test("handleRequest — missing Authorization returns 401", async () => {
  const res = await handleRequest(
    new Request("https://example/places-proxy", {
      method: "POST",
      body: JSON.stringify({ lat: 0, lng: 0, radius_meters: 100 }),
    }),
    { env: envOk(), buildCacheAdapter: memoryCache },
  );
  assertEquals(res.status, 401);
});

Deno.test("handleRequest — missing Foursquare key returns 500", async () => {
  const res = await handleRequest(
    new Request("https://example/places-proxy", {
      method: "POST",
      headers: { Authorization: "Bearer test-jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 0, lng: 0, radius_meters: 100 }),
    }),
    {
      env: { ...envOk(), FOURSQUARE_API_KEY: "" },
      buildCacheAdapter: memoryCache,
    },
  );
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(body.error, "places_proxy_misconfigured");
});

Deno.test("handleRequest — invalid JSON body returns 400", async () => {
  const res = await handleRequest(
    new Request("https://example/places-proxy", {
      method: "POST",
      headers: { Authorization: "Bearer test-jwt" },
      body: "not-json",
    }),
    { env: envOk(), buildCacheAdapter: memoryCache },
  );
  assertEquals(res.status, 400);
});

Deno.test("handleRequest — invalid input returns 400 with detail", async () => {
  const res = await handleRequest(
    new Request("https://example/places-proxy", {
      method: "POST",
      headers: { Authorization: "Bearer test-jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 999, lng: 0, radius_meters: 100 }),
    }),
    { env: envOk(), buildCacheAdapter: memoryCache },
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid_input");
});

Deno.test("handleRequest — happy path returns shaped places", async () => {
  // Stub fetch returns a 1-result Foursquare payload. With the
  // thin-threshold > 1, is_thin must be true; the response still
  // serialises through the proxy with the shaped row.
  const stubFetch = (_url: string | URL, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify({
      results: [{
        fsq_place_id: "fsq-1",
        name: "Solo Diner",
        latitude: 1.0,
        longitude: 2.0,
        categories: [],
        location: {},
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

  const res = await handleRequest(
    new Request("https://example/places-proxy", {
      method: "POST",
      headers: { Authorization: "Bearer test-jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ lat: 1.0, lng: 2.0, radius_meters: 100 }),
    }),
    {
      env: envOk(),
      buildCacheAdapter: memoryCache,
      fetch: stubFetch as typeof fetch,
    },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.places.length, 1);
  assertEquals(body.places[0].fsq_place_id, "fsq-1");
  assertEquals(body.is_thin, true); // 1 < THIN_RESULTS_THRESHOLD
});

Deno.test("handleRequest — q5 uses Google name-only contract and ignores client field masks", async () => {
  const fetchCalls: { url: string; init?: RequestInit }[] = [];
  const stubFetch = (url: string | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return Promise.resolve(new Response(JSON.stringify({
      places: [{
        id: "google-1",
        displayName: { text: "Only Name" },
        location: { latitude: 1.0, longitude: 2.0 },
        rating: 4.7,
        formattedAddress: "Hidden address",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
  };

  const res = await handleRequest(
    new Request("https://example/places-proxy", {
      method: "POST",
      headers: { Authorization: "Bearer test-jwt", "Content-Type": "application/json" },
      body: JSON.stringify({
        surface: "q5",
        field_mask: "places.rating,places.formattedAddress",
        lat: 1.0,
        lng: 2.0,
        radius_meters: 100,
      }),
    }),
    {
      env: { ...envOk(), FOURSQUARE_API_KEY: "" },
      buildCacheAdapter: memoryCache,
      fetch: stubFetch as typeof fetch,
    },
  );

  assertEquals(res.status, 200);
  assertEquals(fetchCalls.length, 1);
  const headers = fetchCalls[0].init?.headers as Record<string, string>;
  assertEquals(headers["X-Goog-FieldMask"], GOOGLE_Q5_FIELD_MASK);
  const body = await res.json();
  assertEquals(body, {
    places: [{ place_id: "google-1", display_name: "Only Name" }],
    attribution: {
      provider: "google",
      render: "text",
      text: "Powered by Google",
    },
    overfetch_telemetry: {
      committed_radius_meters: 100,
      provider_radius_meters: 115,
      pre_trim_count: 1,
      post_trim_count: 1,
      trimmed_count: 0,
    },
  });
  const serialized = JSON.stringify(body);
  assertEquals(serialized.includes("rating"), false);
  assertEquals(serialized.includes("Hidden address"), false);
  assertEquals(serialized.includes("location"), false);
});
