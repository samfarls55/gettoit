import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGoogleProviderNearbySearchRequest,
  buildGoogleProviderPlaceDetailsRequest,
  fetchGoogleProviderWithRetry,
  GOOGLE_NEARBY_SEARCH_URL,
  GOOGLE_PLACE_DETAILS_URL_PREFIX,
  GOOGLE_PROVIDER_ATTRIBUTION,
  GOOGLE_PROVIDER_FIELD_MASKS,
  redactGoogleObservabilityValue,
} from "./google-provider-runtime.ts";

Deno.test("TB-30: Google provider runtime centralizes field masks and attribution", () => {
  assertEquals(GOOGLE_PROVIDER_FIELD_MASKS.q5_fetch.version, "q5_name_only_v1");
  assertEquals(
    GOOGLE_PROVIDER_FIELD_MASKS.verdict_fetch.version,
    "verdict_fetch_v1",
  );
  assertEquals(
    GOOGLE_PROVIDER_FIELD_MASKS.verdict_scoring.version,
    "verdict_scoring_vibe_fit_v1",
  );
  assertEquals(
    GOOGLE_PROVIDER_FIELD_MASKS.verdict_display.version,
    "verdict_display_v1",
  );
  assertEquals(GOOGLE_PROVIDER_ATTRIBUTION, {
    provider: "google",
    render: "text",
    text: "Powered by Google",
  });
});

Deno.test("TB-30: Google provider runtime builds Q5 and verdict requests from one policy", () => {
  const q5 = buildGoogleProviderNearbySearchRequest({
    apiKey: "google-secret",
    fieldMask: "q5_fetch",
    body: { includedPrimaryTypes: ["restaurant"], maxResultCount: 20 },
  });
  const verdict = buildGoogleProviderNearbySearchRequest({
    apiKey: "google-secret",
    fieldMask: "verdict_scoring",
    body: { includedPrimaryTypes: ["restaurant"], maxResultCount: 20 },
  });
  const display = buildGoogleProviderPlaceDetailsRequest({
    apiKey: "google-secret",
    fieldMask: "verdict_display",
    placeId: "google-place",
  });

  assertEquals(q5.url, GOOGLE_NEARBY_SEARCH_URL);
  assertEquals(verdict.url, GOOGLE_NEARBY_SEARCH_URL);
  assertEquals(display.url, `${GOOGLE_PLACE_DETAILS_URL_PREFIX}google-place`);
  assertEquals(q5.init.headers, {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": "google-secret",
    "X-Goog-FieldMask": GOOGLE_PROVIDER_FIELD_MASKS.q5_fetch.mask,
  });
  assertEquals(verdict.init.headers, {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": "google-secret",
    "X-Goog-FieldMask": GOOGLE_PROVIDER_FIELD_MASKS.verdict_scoring.mask,
  });
  assertEquals(display.init.headers, {
    "X-Goog-Api-Key": "google-secret",
    "X-Goog-FieldMask": GOOGLE_PROVIDER_FIELD_MASKS.verdict_display.mask,
    "Accept": "application/json",
  });
});

Deno.test("TB-30: Google provider runtime owns retry and redaction policy", async () => {
  let callCount = 0;
  const response = await fetchGoogleProviderWithRetry(
    (input, init) => {
      callCount += 1;
      assertEquals(
        String(input),
        "https://places.googleapis.com/v1/places:searchNearby",
      );
      assertEquals(
        new Headers(init?.headers).get("X-Goog-Api-Key"),
        "google-secret",
      );
      return Promise.resolve(
        new Response(callCount === 1 ? "temporary" : "ok", {
          status: callCount === 1 ? 503 : 200,
        }),
      );
    },
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: { "X-Goog-Api-Key": "google-secret" },
    },
  );

  assertEquals(response.status, 200);
  assertEquals(callCount, 2);
  assertEquals(
    redactGoogleObservabilityValue({
      google_place_id: "google-place",
      displayName: "Pico's",
      nested: { rating: 4.8 },
    }),
    {
      google_place_id: "[redacted_google_place_id]",
      displayName: "[redacted_google_display_content]",
      nested: { rating: "[redacted_google_display_content]" },
    },
  );
});
