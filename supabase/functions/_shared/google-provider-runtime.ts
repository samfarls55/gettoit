export type GoogleProviderFetchFn = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export const GOOGLE_NEARBY_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchNearby";
export const GOOGLE_PLACE_DETAILS_URL_PREFIX =
  "https://places.googleapis.com/v1/places/";

export const GOOGLE_PROVIDER_FIELD_MASKS = {
  q5_fetch: {
    version: "q5_name_only_v1",
    mask: [
      "places.id",
      "places.displayName",
      "places.currentOpeningHours",
      "places.regularOpeningHours",
      "places.dineIn",
      "places.takeout",
    ].join(","),
  },
  verdict_fetch: {
    version: "verdict_fetch_v1",
    mask: [
      "places.id",
      "places.displayName",
      "places.types",
      "places.primaryType",
      "places.priceLevel",
      "places.rating",
      "places.userRatingCount",
      "places.currentOpeningHours.openNow",
      "places.regularOpeningHours.periods",
      "places.dineIn",
      "places.takeout",
    ].join(","),
  },
  verdict_scoring: {
    version: "verdict_scoring_vibe_fit_v1",
    mask: [
      "places.id",
      "places.displayName",
      "places.types",
      "places.primaryType",
      "places.priceLevel",
      "places.rating",
      "places.userRatingCount",
      "places.currentOpeningHours.openNow",
      "places.regularOpeningHours.periods",
      "places.dineIn",
      "places.takeout",
      "places.reviewSummary",
      "places.generativeSummary",
      "places.liveMusic",
      "places.goodForGroups",
      "places.goodForWatchingSports",
      "places.outdoorSeating",
    ].join(","),
  },
  verdict_display: {
    version: "verdict_display_v1",
    mask: [
      "id",
      "displayName",
      "googleMapsUri",
      "formattedAddress",
    ].join(","),
  },
} as const;

export type GoogleProviderFieldMaskName =
  keyof typeof GOOGLE_PROVIDER_FIELD_MASKS;

export const GOOGLE_PROVIDER_ATTRIBUTION = {
  provider: "google",
  render: "text",
  text: "Powered by Google",
} as const;

export function buildGoogleProviderNearbySearchRequest(input: {
  apiKey: string;
  fieldMask: Extract<
    GoogleProviderFieldMaskName,
    "q5_fetch" | "verdict_fetch" | "verdict_scoring"
  >;
  body: Record<string, unknown>;
}): { url: string; init: RequestInit } {
  return {
    url: GOOGLE_NEARBY_SEARCH_URL,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": input.apiKey,
        "X-Goog-FieldMask": GOOGLE_PROVIDER_FIELD_MASKS[input.fieldMask].mask,
      },
      body: JSON.stringify(input.body),
    },
  };
}

export function buildGoogleProviderPlaceDetailsRequest(input: {
  apiKey: string;
  fieldMask: Extract<GoogleProviderFieldMaskName, "verdict_display">;
}): RequestInit {
  return {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": input.apiKey,
      "X-Goog-FieldMask": GOOGLE_PROVIDER_FIELD_MASKS[input.fieldMask].mask,
      "Accept": "application/json",
    },
  };
}

export async function fetchGoogleProviderWithRetry(
  fetch: GoogleProviderFetchFn,
  url: string,
  init: RequestInit,
): Promise<Response> {
  let response = await fetch(url, init);
  if (isTransientGoogleProviderFailure(response.status)) {
    response = await fetch(url, init);
  }
  return response;
}

function isTransientGoogleProviderFailure(status: number): boolean {
  return status === 429 || status >= 500;
}

export type GoogleObservabilityRedactionOptions = {
  allowGooglePlaceIds?: boolean;
};

export const GOOGLE_DISPLAY_CONTENT_REDACTION =
  "[redacted_google_display_content]";
export const GOOGLE_PLACE_ID_REDACTION = "[redacted_google_place_id]";

const GOOGLE_OBSERVABILITY_FORBIDDEN_KEYS = new Set([
  "display_name",
  "displayName",
  "name",
  "formatted_address",
  "formattedAddress",
  "address",
  "google_maps_uri",
  "googleMapsUri",
  "maps_uri",
  "rating",
  "hours",
  "currentOpeningHours",
  "regularOpeningHours",
  "price",
  "atmosphere",
  "types",
  "photos",
  "raw_payload",
  "rawPayload",
  "generativeSummary",
  "reviewSummary",
  "summary",
]);

const GOOGLE_PLACE_ID_KEYS = new Set([
  "place_id",
  "placeId",
  "google_place_id",
  "googlePlaceId",
]);

export function redactGoogleObservabilityValue(
  value: unknown,
  options: GoogleObservabilityRedactionOptions = {},
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactGoogleObservabilityValue(item, options));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (GOOGLE_OBSERVABILITY_FORBIDDEN_KEYS.has(key)) {
      redacted[key] = GOOGLE_DISPLAY_CONTENT_REDACTION;
      continue;
    }
    if (GOOGLE_PLACE_ID_KEYS.has(key) && !options.allowGooglePlaceIds) {
      redacted[key] = GOOGLE_PLACE_ID_REDACTION;
      continue;
    }
    redacted[key] = redactGoogleObservabilityValue(entryValue, options);
  }

  return redacted;
}
