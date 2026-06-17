export type GoogleProviderFetchFn = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export const GOOGLE_NEARBY_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchNearby";
export const GOOGLE_PLACE_DETAILS_URL_PREFIX =
  "https://places.googleapis.com/v1/places/";

const GOOGLE_Q5_FIELDS = [
  "places.id",
  "places.displayName",
  "places.currentOpeningHours",
  "places.regularOpeningHours",
  "places.dineIn",
  "places.takeout",
] as const;

const GOOGLE_VERDICT_FETCH_FIELDS = [
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
] as const;

const GOOGLE_VERDICT_SCORING_FIELDS = [
  ...GOOGLE_VERDICT_FETCH_FIELDS,
  "places.reviewSummary",
  "places.generativeSummary",
  "places.liveMusic",
  "places.goodForGroups",
  "places.goodForWatchingSports",
  "places.outdoorSeating",
] as const;

const GOOGLE_VERDICT_DISPLAY_FIELDS = [
  "id",
  "displayName",
  "googleMapsUri",
  "formattedAddress",
] as const;

function buildGoogleFieldMask(fields: readonly string[]): string {
  return fields.join(",");
}

export const GOOGLE_PROVIDER_FIELD_MASKS = {
  q5_fetch: {
    version: "q5_name_only_v1",
    mask: buildGoogleFieldMask(GOOGLE_Q5_FIELDS),
  },
  verdict_fetch: {
    version: "verdict_fetch_v1",
    mask: buildGoogleFieldMask(GOOGLE_VERDICT_FETCH_FIELDS),
  },
  verdict_scoring: {
    version: "verdict_scoring_vibe_fit_v1",
    mask: buildGoogleFieldMask(GOOGLE_VERDICT_SCORING_FIELDS),
  },
  verdict_display: {
    version: "verdict_display_v1",
    mask: buildGoogleFieldMask(GOOGLE_VERDICT_DISPLAY_FIELDS),
  },
} as const;

export type GoogleProviderFieldMaskName =
  keyof typeof GOOGLE_PROVIDER_FIELD_MASKS;
export type GoogleProviderNearbyFieldMaskName = Extract<
  GoogleProviderFieldMaskName,
  "q5_fetch" | "verdict_fetch" | "verdict_scoring"
>;
export type GoogleProviderPlaceDetailsFieldMaskName = Extract<
  GoogleProviderFieldMaskName,
  "verdict_display"
>;

export const GOOGLE_PROVIDER_ATTRIBUTION = {
  provider: "google",
  render: "text",
  text: "Powered by Google",
} as const;

export function buildGoogleProviderNearbySearchRequest(input: {
  apiKey: string;
  fieldMask: GoogleProviderNearbyFieldMaskName;
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
  fieldMask: GoogleProviderPlaceDetailsFieldMaskName;
  placeId: string;
}): { url: string; init: RequestInit } {
  return {
    url: `${GOOGLE_PLACE_DETAILS_URL_PREFIX}${
      encodeURIComponent(input.placeId)
    }`,
    init: {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": input.apiKey,
        "X-Goog-FieldMask": GOOGLE_PROVIDER_FIELD_MASKS[input.fieldMask].mask,
        "Accept": "application/json",
      },
    },
  };
}

export async function fetchGoogleProviderWithRetry(
  fetchFn: GoogleProviderFetchFn,
  url: string,
  init: RequestInit,
): Promise<Response> {
  let response = await fetchFn(url, init);
  if (isTransientGoogleProviderFailure(response.status)) {
    response = await fetchFn(url, init);
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
