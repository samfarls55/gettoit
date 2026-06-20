// HTTP-layer tests for the PlacesProxy Edge Function entry point.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  GOOGLE_Q5_DEBUG_FIELD_MASK,
  GOOGLE_Q5_FIELD_MASK,
  GOOGLE_VERDICT_DISPLAY_FIELD_MASK,
} from "../_shared/places-proxy-core.ts";
import { withMutedConsole } from "../_shared/test-console.ts";
import { handleRequest } from "./handler.ts";

function envOk() {
  return {
    GOOGLE_PLACES_API_KEY: "google-key",
  };
}

function authedPost(body: unknown): Request {
  return new Request("https://example/places-proxy", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-jwt",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.test("handleRequest - OPTIONS returns 204 with CORS headers", async () => {
  const res = await handleRequest(
    new Request("https://example/places-proxy", { method: "OPTIONS" }),
    { env: envOk() },
  );
  assertEquals(res.status, 204);
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods")?.includes("POST"),
    true,
  );
});

Deno.test("handleRequest - GET returns 405", async () => {
  const res = await handleRequest(
    new Request("https://example/places-proxy", { method: "GET" }),
    { env: envOk() },
  );
  assertEquals(res.status, 405);
});

Deno.test("handleRequest - missing Authorization returns 401", async () => {
  const res = await handleRequest(
    new Request("https://example/places-proxy", {
      method: "POST",
      body: JSON.stringify({ lat: 0, lng: 0, radius_meters: 100 }),
    }),
    { env: envOk() },
  );
  assertEquals(res.status, 401);
});

Deno.test("handleRequest - invalid JSON body returns 400", async () => {
  const res = await handleRequest(
    new Request("https://example/places-proxy", {
      method: "POST",
      headers: { Authorization: "Bearer test-jwt" },
      body: "not-json",
    }),
    { env: envOk() },
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "invalid_json");
});

Deno.test("handleRequest - invalid input returns 400 with detail", async () => {
  const res = await handleRequest(
    authedPost({ lat: 999, lng: 0, radius_meters: 100 }),
    { env: envOk() },
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid_input");
});

Deno.test("handleRequest - unsupported non-Google surface returns 400", async () => {
  const res = await handleRequest(
    authedPost({ lat: 0, lng: 0, radius_meters: 100 }),
    { env: envOk() },
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "unsupported_surface");
});

Deno.test("handleRequest - missing Google key returns guardrail body", async () => {
  await withMutedConsole(["error"], async () => {
    const res = await handleRequest(
      authedPost({
        surface: "q5",
        lat: 1,
        lng: 2,
        radius_meters: 100,
        filters: { target_open_time: { day: 3, hour: 19, minute: 0 } },
      }),
      { env: { GOOGLE_PLACES_API_KEY: "" } },
    );
    assertEquals(res.status, 200);
    assertEquals((await res.json()).error, "google_places_misconfigured");
  });
});

Deno.test("handleRequest - q5 uses Google name-only contract", async () => {
  const fetchCalls: { url: string; init?: RequestInit }[] = [];
  const stubFetch = (url: string | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return Promise.resolve(
      Response.json({
        places: [{
          id: "google-1",
          displayName: { text: "Only Name" },
          regularOpeningHours: {
            periods: [
              {
                open: { day: 3, hour: 18, minute: 0 },
                close: { day: 3, hour: 22, minute: 0 },
              },
            ],
          },
          rating: 4.7,
          formattedAddress: "Hidden address",
        }],
      }),
    );
  };

  const res = await withMutedConsole(["info"], () =>
    handleRequest(
      authedPost({
        surface: "q5",
        field_mask: "places.rating,places.formattedAddress",
        lat: 1,
        lng: 2,
        radius_meters: 100,
        filters: { target_open_time: { day: 3, hour: 19, minute: 0 } },
      }),
      {
        env: envOk(),
        fetch: stubFetch as typeof fetch,
      },
    ));

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
  });
  assertEquals(JSON.stringify(body).includes("rating"), false);
  assertEquals(JSON.stringify(body).includes("Hidden address"), false);
});

Deno.test("handleRequest - q5 debug trace returns raw Google candidate attributes", async () => {
  const fetchCalls: { url: string; init?: RequestInit }[] = [];
  const stubFetch = (url: string | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return Promise.resolve(
      Response.json({
        places: [{
          id: "google-1",
          displayName: { text: "Only Name" },
          regularOpeningHours: {
            periods: [
              {
                open: { day: 3, hour: 18, minute: 0 },
                close: { day: 3, hour: 22, minute: 0 },
              },
            ],
          },
          dineIn: true,
          rating: 4.7,
          formattedAddress: "Hidden address",
        }],
      }),
    );
  };

  const res = await withMutedConsole(["info"], () =>
    handleRequest(
      authedPost({
        surface: "q5",
        debug_trace: "expo_dev_run",
        lat: 1,
        lng: 2,
        radius_meters: 100,
        filters: {
          target_open_time: { day: 3, hour: 19, minute: 0 },
          service_shape: "dineIn",
        },
      }),
      {
        env: envOk(),
        fetch: stubFetch as typeof fetch,
      },
    ));

  assertEquals(res.status, 200);
  const headers = fetchCalls[0].init?.headers as Record<string, string>;
  assertEquals(headers["X-Goog-FieldMask"], GOOGLE_Q5_DEBUG_FIELD_MASK);
  const body = await res.json();
  const trace = body.debugTrace as Array<{
    event: string;
    payload: Record<string, unknown>;
  }>;
  const responseEvent = trace.find((entry) =>
    entry.event === "places_proxy.google_q5.response"
  );
  assertEquals(
    (responseEvent?.payload.body as { places?: Array<{ rating?: number }> })
      .places?.[0]?.rating,
    4.7,
  );
  const evaluationsEvent = trace.find((entry) =>
    entry.event === "places_proxy.google_q5.candidate_evaluations"
  );
  const evaluations = evaluationsEvent?.payload.evaluations as Array<{
    place: { formattedAddress?: string };
    strictEligible: boolean;
    strictRejectionReasons: string[];
  }>;
  assertEquals(evaluations[0].place.formattedAddress, "Hidden address");
  assertEquals(evaluations[0].strictEligible, true);
  assertEquals(evaluations[0].strictRejectionReasons, []);
});

Deno.test("handleRequest - verdict display refetches by Place ID", async () => {
  const fetchCalls: { url: string; init?: RequestInit }[] = [];
  const stubFetch = (url: string | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init });
    return Promise.resolve(
      Response.json({
        id: "google-1",
        displayName: { text: "Pico's" },
        googleMapsUri: "https://maps.google.example/picos",
        formattedAddress: "1 Main St",
        rating: 4.8,
      }),
    );
  };

  const res = await handleRequest(
    authedPost({
      surface: "verdict_display",
      google_place_id: "google-1",
      field_mask: "rating",
    }),
    {
      env: envOk(),
      fetch: stubFetch as typeof fetch,
    },
  );

  assertEquals(res.status, 200);
  assertEquals(fetchCalls.length, 1);
  assertEquals(
    fetchCalls[0].url,
    "https://places.googleapis.com/v1/places/google-1",
  );
  const headers = fetchCalls[0].init?.headers as Record<string, string>;
  assertEquals(headers["X-Goog-FieldMask"], GOOGLE_VERDICT_DISPLAY_FIELD_MASK);
  const body = await res.json();
  assertEquals(body, {
    place: {
      place_id: "google-1",
      display_name: "Pico's",
      google_maps_uri: "https://maps.google.example/picos",
      formatted_address: "1 Main St",
    },
    attribution: {
      provider: "google",
      render: "text",
      text: "Powered by Google",
    },
  });
  assertEquals(JSON.stringify(body).includes("rating"), false);
});
