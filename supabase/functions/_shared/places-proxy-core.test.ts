import {
  assert,
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { googlePrimaryTypesForQ1Cuisines } from "./google-cuisine-primary-types.ts";
import {
  assertGoogleReasonCode,
  buildGoogleOverfetchTelemetry,
  type FetchFn,
  GOOGLE_Q5_DEBUG_FIELD_MASK,
  GOOGLE_Q5_FIELD_MASK,
  GOOGLE_Q5_MAX_RESULTS,
  GOOGLE_VERDICT_DISPLAY_FIELD_MASK,
  GooglePlacesGuardrailError,
  handleGoogleQ5PlacesProxy,
  handleGoogleVerdictDisplayProxy,
  isGoogleOperationalReceiptCode,
  isGoogleOutcomeLabel,
  isGoogleReasonCode,
  type PlacesProxyInput,
  PlacesProxyInputError,
  redactGoogleObservabilityValue,
  validateInput,
} from "./places-proxy-core.ts";
import { withMutedConsole } from "./test-console.ts";

const WEDNESDAY_DINNER = { day: 3, hour: 19, minute: 0 };

function q5Input(
  filters: NonNullable<PlacesProxyInput["filters"]> = {},
): PlacesProxyInput {
  return {
    lat: 40.758,
    lng: -73.9855,
    radius_meters: 1000,
    filters: {
      target_open_time: WEDNESDAY_DINNER,
      ...filters,
    },
  };
}

function openForDinner() {
  return {
    periods: [
      {
        open: { day: 3, hour: 18, minute: 0 },
        close: { day: 3, hour: 22, minute: 0 },
      },
    ],
  };
}

function closedAtDinner() {
  return {
    periods: [
      {
        open: { day: 3, hour: 9, minute: 0 },
        close: { day: 3, hour: 11, minute: 0 },
      },
    ],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("google q5 - owns field mask and returns name-only places", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetch: FetchFn = (url, init) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(
      jsonResponse({
        places: [
          {
            id: "google-1",
            displayName: { text: "Only Name" },
            regularOpeningHours: openForDinner(),
            currentOpeningHours: { openNow: true },
            dineIn: true,
            rating: 4.9,
            formattedAddress: "Hidden address",
          },
        ],
      }),
    );
  };

  const result = await withMutedConsole(
    ["info"],
    () =>
      handleGoogleQ5PlacesProxy(q5Input({ service_shape: "dineIn" }), {
        fetch,
        googleApiKey: "google-key",
      }),
  );

  assertEquals(calls.length, 1);
  assertEquals(
    calls[0].url,
    "https://places.googleapis.com/v1/places:searchNearby",
  );
  const headers = calls[0].init?.headers as Record<string, string>;
  assertEquals(headers["X-Goog-Api-Key"], "google-key");
  assertEquals(headers["X-Goog-FieldMask"], GOOGLE_Q5_FIELD_MASK);
  assertEquals(headers["X-Goog-FieldMask"].includes("places.rating"), false);
  assertEquals(
    headers["X-Goog-FieldMask"].includes("places.formattedAddress"),
    false,
  );
  assertEquals(result, {
    places: [{ place_id: "google-1", display_name: "Only Name" }],
    attribution: {
      provider: "google",
      render: "text",
      text: "Powered by Google",
    },
  });
  assertEquals(JSON.stringify(result).includes("Hidden address"), false);
});

Deno.test("google q5 - narrows Nearby Search to selected Q1 cuisines", async () => {
  const requestBodies: Record<string, unknown>[] = [];
  const fetch: FetchFn = (_url, init) => {
    requestBodies.push(
      JSON.parse(String(init?.body)) as Record<string, unknown>,
    );
    return Promise.resolve(jsonResponse({ places: [] }));
  };

  await withMutedConsole(
    ["info"],
    () =>
      handleGoogleQ5PlacesProxy(q5Input({ cuisines: ["italian"] }), {
        fetch,
        googleApiKey: "google-key",
      }),
  );

  const capturedRequestBody = requestBodies[0];
  assert(capturedRequestBody);
  assertEquals(
    capturedRequestBody.includedPrimaryTypes,
    googlePrimaryTypesForQ1Cuisines(["italian"]),
  );
  assertEquals(capturedRequestBody.maxResultCount, GOOGLE_Q5_MAX_RESULTS);
});

Deno.test("google q5 - applies target meal timing and strict service eligibility", async () => {
  const fetch: FetchFn = () =>
    Promise.resolve(
      jsonResponse({
        places: [
          {
            id: "open-1",
            displayName: { text: "Open One" },
            regularOpeningHours: openForDinner(),
            dineIn: true,
          },
          {
            id: "open-2",
            displayName: { text: "Open Two" },
            regularOpeningHours: openForDinner(),
            dineIn: true,
          },
          {
            id: "open-3",
            displayName: { text: "Open Three" },
            regularOpeningHours: openForDinner(),
            dineIn: true,
          },
          {
            id: "closed",
            displayName: { text: "Closed" },
            regularOpeningHours: closedAtDinner(),
            dineIn: true,
          },
          {
            id: "takeout-only",
            displayName: { text: "Takeout Only" },
            regularOpeningHours: openForDinner(),
            dineIn: false,
          },
        ],
      }),
    );

  const result = await withMutedConsole(
    ["info"],
    () =>
      handleGoogleQ5PlacesProxy(q5Input({ service_shape: "dineIn" }), {
        fetch,
        googleApiKey: "google-key",
      }),
  );

  assertEquals(result.places.map((place) => place.place_id), [
    "open-1",
    "open-2",
    "open-3",
  ]);
});

Deno.test("google q5 - relaxes missing dine-in evidence when strict pool is thin", async () => {
  const fetch: FetchFn = () =>
    Promise.resolve(
      jsonResponse({
        places: [
          {
            id: "strict-1",
            displayName: { text: "Strict One" },
            regularOpeningHours: openForDinner(),
            dineIn: true,
          },
          {
            id: "strict-2",
            displayName: { text: "Strict Two" },
            regularOpeningHours: openForDinner(),
            dineIn: true,
          },
          {
            id: "unknown-service",
            displayName: { text: "Unknown Service" },
            regularOpeningHours: openForDinner(),
          },
          {
            id: "takeout-only",
            displayName: { text: "Takeout Only" },
            regularOpeningHours: openForDinner(),
            dineIn: false,
          },
        ],
      }),
    );

  const result = await withMutedConsole(
    ["info"],
    () =>
      handleGoogleQ5PlacesProxy(q5Input({ service_shape: "dineIn" }), {
        fetch,
        googleApiKey: "google-key",
      }),
  );

  assertEquals(result.places.map((place) => place.place_id), [
    "strict-1",
    "strict-2",
    "unknown-service",
  ]);
});

Deno.test("google verdict display - refetches by Place ID with display mask", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetch: FetchFn = (url, init) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(
      jsonResponse({
        id: "google-1",
        displayName: { text: "Pico's" },
        googleMapsUri: "https://maps.google.example/picos",
        formattedAddress: "1 Main St",
        rating: 4.8,
      }),
    );
  };

  const result = await handleGoogleVerdictDisplayProxy({
    surface: "verdict_display",
    google_place_id: "google-1",
  }, {
    fetch,
    googleApiKey: "google-key",
  });

  assertEquals(calls.length, 1);
  assertEquals(
    calls[0].url,
    "https://places.googleapis.com/v1/places/google-1",
  );
  const headers = calls[0].init?.headers as Record<string, string>;
  assertEquals(headers["X-Goog-FieldMask"], GOOGLE_VERDICT_DISPLAY_FIELD_MASK);
  assertEquals(result, {
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
  assertEquals(JSON.stringify(result).includes("rating"), false);
});

Deno.test("google verdict display - failed refetch does not return stale content", async () => {
  const fetch: FetchFn = () =>
    Promise.resolve(jsonResponse({ error: "nope" }, 404));

  const error = await assertRejects(
    () =>
      handleGoogleVerdictDisplayProxy({
        surface: "verdict_display",
        google_place_id: "google-1",
      }, {
        fetch,
        googleApiKey: "google-key",
      }),
    GooglePlacesGuardrailError,
  );
  assertEquals(error.code, "google_places_refetch_404");
});

Deno.test("google q5 - debug field mask is opt-in", async () => {
  const calls: Array<{ init?: RequestInit }> = [];
  const fetch: FetchFn = (_url, init) => {
    calls.push({ init });
    return Promise.resolve(jsonResponse({ places: [] }));
  };

  await withMutedConsole(["info"], () =>
    handleGoogleQ5PlacesProxy(q5Input(), {
      fetch,
      googleApiKey: "google-key",
      debugTrace: true,
    }));

  const headers = calls[0].init?.headers as Record<string, string>;
  assertEquals(headers["X-Goog-FieldMask"], GOOGLE_Q5_DEBUG_FIELD_MASK);
});

Deno.test("validateInput - keeps valid Google Q5 target_open_time", () => {
  const input = validateInput({
    surface: "q5",
    lat: 1,
    lng: 2,
    radius_meters: 500,
    filters: {
      target_open_time: WEDNESDAY_DINNER,
      cuisine: "italian",
      service_shape: "dineIn",
      open_at: "not-a-foursquare-token-anymore",
    },
  });

  assertEquals(input.filters?.target_open_time, WEDNESDAY_DINNER);
  assertEquals(input.filters?.cuisine, "italian");
  assertEquals(input.filters?.service_shape, "dineIn");
  assertEquals("open_at" in (input.filters ?? {}), false);
});

Deno.test("validateInput - rejects malformed core fields", () => {
  assertThrows(
    () => validateInput({ lat: 999, lng: 0, radius_meters: 100 }),
    PlacesProxyInputError,
  );
  assertThrows(
    () => validateInput({ lat: 0, lng: 0, radius_meters: 0 }),
    PlacesProxyInputError,
  );
  assertThrows(
    () =>
      validateInput({
        surface: "q5",
        lat: 0,
        lng: 0,
        radius_meters: 100,
      }),
    PlacesProxyInputError,
    "filters.target_open_time is required for q5",
  );
  assertThrows(
    () =>
      validateInput({
        surface: "q5",
        lat: 0,
        lng: 0,
        radius_meters: 100,
        filters: { target_open_time: { day: 9, hour: 19, minute: 0 } },
      }),
    PlacesProxyInputError,
  );
});

Deno.test("google controlled codes stay app-authored", () => {
  assert(isGoogleOutcomeLabel("q5_rated"));
  assert(!isGoogleOutcomeLabel("provider_named_this"));
  assert(isGoogleOperationalReceiptCode("overfetch_trimmed"));
  assert(!isGoogleOperationalReceiptCode("google_http_429"));
  assert(isGoogleReasonCode("refetch_failed"));
  assertEquals(assertGoogleReasonCode("wrong_vibe"), "wrong_vibe");
  assertThrows(
    () => assertGoogleReasonCode("the user said it was weird"),
    PlacesProxyInputError,
  );
});

Deno.test("google observability redacts display content", () => {
  assertEquals(
    redactGoogleObservabilityValue({
      place_id: "google-1",
      display_name: "Pico's",
      nested: {
        google_maps_uri: "https://maps.google.example/picos",
        reason_code: "wrong_vibe",
      },
    }),
    {
      place_id: "[redacted_google_place_id]",
      display_name: "[redacted_google_display_content]",
      nested: {
        google_maps_uri: "[redacted_google_display_content]",
        reason_code: "wrong_vibe",
      },
    },
  );
});

Deno.test("google overfetch telemetry computes committed/provider delta", () => {
  assertEquals(
    buildGoogleOverfetchTelemetry({
      committedRadiusMeters: 800,
      providerRadiusMeters: 1200,
      beforeTrimCount: 20,
      afterTrimCount: 12,
      trimReasonCounts: { outside_radius: 8 },
    }),
    {
      committed_radius_meters: 800,
      provider_radius_meters: 1200,
      overfetch_delta_meters: 400,
      before_trim_count: 20,
      after_trim_count: 12,
      trim_reason_counts: { outside_radius: 8 },
    },
  );
});
