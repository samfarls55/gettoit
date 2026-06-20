// PlacesProxy core orchestrator.
//
// This module is independent of Supabase and Deno's HTTP server so it can be
// exercised by the Deno test suite without any network roundtrip.

import { googlePrimaryTypesForQ1Cuisines } from "./google-cuisine-primary-types.ts";
import {
  type GoogleOpeningPeriod,
  type GoogleTargetOpenTime,
  isOpenAtGoogleTargetTime,
  normalizeGoogleTargetOpenTime,
} from "./google-opening-hours.ts";
import {
  buildGoogleProviderNearbySearchRequest,
  buildGoogleProviderPlaceDetailsRequest,
  fetchGoogleProviderWithRetry,
  GOOGLE_PROVIDER_ATTRIBUTION,
  GOOGLE_PROVIDER_FIELD_MASKS,
} from "./google-provider-runtime.ts";
import { logLocalTestEvent } from "./local-test-run-logger.ts";

export { redactGoogleObservabilityValue } from "./google-provider-runtime.ts";

export type FetchFn = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type GoogleServiceShape = "dineIn" | "takeout";

export interface PlacesProxyInput {
  lat: number;
  lng: number;
  radius_meters: number;
  filters?: {
    dietary?: string[];
    price_tier?: number;
    target_open_time?: GoogleTargetOpenTime;
    cuisine?: string;
    cuisines?: string[];
    service_shape?: GoogleServiceShape;
  };
}

export interface GoogleQ5Place {
  place_id: string;
  display_name: string;
}

export interface GoogleAttributionPayload {
  provider: "google";
  render: "text";
  text: "Powered by Google";
}

export interface GoogleQ5Response {
  places: GoogleQ5Place[];
  attribution: GoogleAttributionPayload;
}

export interface GoogleVerdictDisplayPlace {
  place_id: string;
  display_name: string;
  google_maps_uri: string;
  formatted_address?: string;
}

export interface GoogleVerdictDisplayResponse {
  place: GoogleVerdictDisplayPlace;
  attribution: GoogleAttributionPayload;
}

interface GooglePlacesProxyDeps {
  fetch: FetchFn;
  googleApiKey: string;
  debugTrace?: boolean;
}

export type PlacesProxyResponse =
  | GoogleQ5Response
  | GoogleVerdictDisplayResponse;

export class PlacesProxyInputError extends Error {
  status = 400;
}

export class GooglePlacesGuardrailError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function isGoogleServiceShape(value: unknown): value is GoogleServiceShape {
  return value === "dineIn" || value === "takeout";
}

export function validateInput(raw: unknown): PlacesProxyInput {
  if (!raw || typeof raw !== "object") {
    throw new PlacesProxyInputError("body must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;
  const lat = obj.lat;
  const lng = obj.lng;
  const radius = obj.radius_meters;

  if (
    typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90
  ) {
    throw new PlacesProxyInputError("lat must be a finite number in [-90, 90]");
  }
  if (
    typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 ||
    lng > 180
  ) {
    throw new PlacesProxyInputError(
      "lng must be a finite number in [-180, 180]",
    );
  }
  if (
    typeof radius !== "number" ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    radius > 100_000
  ) {
    throw new PlacesProxyInputError(
      "radius_meters must be a finite positive number <= 100000",
    );
  }

  const filters = (obj.filters ?? {}) as Record<string, unknown>;
  const dietary = Array.isArray(filters.dietary)
    ? (filters.dietary.filter((x) => typeof x === "string") as string[])
    : undefined;
  const price_tier = typeof filters.price_tier === "number"
    ? filters.price_tier
    : undefined;
  const target_open_time = normalizeGoogleTargetOpenTime(
    filters.target_open_time,
  ) ?? undefined;
  const hasTargetOpenTime = Object.prototype.hasOwnProperty.call(
    filters,
    "target_open_time",
  );
  if (hasTargetOpenTime && target_open_time === undefined) {
    throw new PlacesProxyInputError(
      "filters.target_open_time must be a Google opening-hours point " +
        "{ day: 0..6, hour: 0..23, minute: 0..59 }",
    );
  }
  if (obj.surface === "q5" && target_open_time === undefined) {
    throw new PlacesProxyInputError(
      "filters.target_open_time is required for q5",
    );
  }

  const cuisine = typeof filters.cuisine === "string"
    ? filters.cuisine
    : undefined;
  const cuisines = Array.isArray(filters.cuisines)
    ? (filters.cuisines.filter((x) => typeof x === "string") as string[])
    : undefined;
  const service_shape = isGoogleServiceShape(filters.service_shape)
    ? filters.service_shape
    : undefined;

  return {
    lat,
    lng,
    radius_meters: radius,
    filters: {
      dietary,
      price_tier,
      target_open_time,
      cuisine,
      cuisines,
      service_shape,
    },
  };
}

export function isGoogleQ5Input(raw: unknown): boolean {
  return !!raw && typeof raw === "object" &&
    (raw as Record<string, unknown>).surface === "q5";
}

export function isGoogleVerdictDisplayInput(raw: unknown): boolean {
  return !!raw && typeof raw === "object" &&
    (raw as Record<string, unknown>).surface === "verdict_display";
}

export const GOOGLE_Q5_FIELD_MASK_VERSION =
  GOOGLE_PROVIDER_FIELD_MASKS.q5_fetch.version;
export const GOOGLE_Q5_FIELD_MASK = GOOGLE_PROVIDER_FIELD_MASKS.q5_fetch.mask;
export const GOOGLE_Q5_DEBUG_FIELD_MASK_VERSION =
  GOOGLE_PROVIDER_FIELD_MASKS.q5_debug_fetch.version;
export const GOOGLE_Q5_DEBUG_FIELD_MASK =
  GOOGLE_PROVIDER_FIELD_MASKS.q5_debug_fetch.mask;
export const GOOGLE_Q5_MAX_RESULTS = 20;
const GOOGLE_Q5_MIN_CARD_COUNT = 3;
export const GOOGLE_VERDICT_DISPLAY_FIELD_MASK_VERSION =
  GOOGLE_PROVIDER_FIELD_MASKS.verdict_display.version;
export const GOOGLE_VERDICT_DISPLAY_FIELD_MASK =
  GOOGLE_PROVIDER_FIELD_MASKS.verdict_display.mask;

export const GOOGLE_OUTCOME_LABELS = [
  "q5_rated",
  "q5_unrated_exit",
  "verdict_accepted",
  "verdict_rerolled",
  "verdict_skipped",
  "verdict_abandoned",
] as const;

export const GOOGLE_OPERATIONAL_RECEIPT_CODES = [
  "place_unavailable",
  "refetch_failed",
  "quota_exhausted",
  "budget_exhausted",
  "cost_guardrail_blocked",
  "overfetch_trimmed",
] as const;

export const GOOGLE_REASON_CODES = [
  "selected_cuisine_keep_feasible",
  "selected_contrast_pool",
  "selected_vibe_band_edge",
  "selected_crowd_quality_floor",
  "wrong_vibe",
  "too_expensive",
  "place_unavailable",
  "refetch_failed",
] as const;

export type GoogleOutcomeLabel = typeof GOOGLE_OUTCOME_LABELS[number];
export type GoogleOperationalReceiptCode =
  typeof GOOGLE_OPERATIONAL_RECEIPT_CODES[number];
export type GoogleReasonCode = typeof GOOGLE_REASON_CODES[number];

function isStringInList<TValue extends string>(
  value: unknown,
  values: readonly TValue[],
): value is TValue {
  return typeof value === "string" && values.includes(value as TValue);
}

export function isGoogleOutcomeLabel(
  value: unknown,
): value is GoogleOutcomeLabel {
  return isStringInList(value, GOOGLE_OUTCOME_LABELS);
}

export function isGoogleOperationalReceiptCode(
  value: unknown,
): value is GoogleOperationalReceiptCode {
  return isStringInList(value, GOOGLE_OPERATIONAL_RECEIPT_CODES);
}

export function isGoogleReasonCode(value: unknown): value is GoogleReasonCode {
  return isStringInList(value, GOOGLE_REASON_CODES);
}

export function assertGoogleReasonCode(value: unknown): GoogleReasonCode {
  if (!isGoogleReasonCode(value)) {
    throw new PlacesProxyInputError(
      "reason_code must be controlled app-authored code",
    );
  }

  return value;
}

export function buildGoogleOverfetchTelemetry(input: {
  committedRadiusMeters: number;
  providerRadiusMeters: number;
  beforeTrimCount: number;
  afterTrimCount: number;
  trimReasonCounts: Record<string, number>;
}): {
  committed_radius_meters: number;
  provider_radius_meters: number;
  overfetch_delta_meters: number;
  before_trim_count: number;
  after_trim_count: number;
  trim_reason_counts: Record<string, number>;
} {
  return {
    committed_radius_meters: input.committedRadiusMeters,
    provider_radius_meters: input.providerRadiusMeters,
    overfetch_delta_meters: Math.max(
      0,
      input.providerRadiusMeters - input.committedRadiusMeters,
    ),
    before_trim_count: input.beforeTrimCount,
    after_trim_count: input.afterTrimCount,
    trim_reason_counts: { ...input.trimReasonCounts },
  };
}

type GoogleNearbySearchResponse = {
  places?: Array<{
    id?: unknown;
    displayName?: { text?: unknown };
    currentOpeningHours?: GoogleOpeningHours;
    regularOpeningHours?: GoogleOpeningHours;
    dineIn?: unknown;
    takeout?: unknown;
  }>;
};

type GoogleQ5ShapeResult = {
  places: GoogleQ5Place[];
  strictCount: number;
};

type GooglePlaceDetailsResponse = {
  id?: unknown;
  displayName?: { text?: unknown };
  googleMapsUri?: unknown;
  formattedAddress?: unknown;
};

interface GoogleOpeningHours {
  openNow?: unknown;
  periods?: GoogleOpeningPeriod[];
}

export async function handleGoogleQ5PlacesProxy(
  input: PlacesProxyInput,
  deps: GooglePlacesProxyDeps,
): Promise<GoogleQ5Response> {
  const googleApiKey = deps.googleApiKey;
  if (!googleApiKey) {
    throw new GooglePlacesGuardrailError(
      "google_places_misconfigured",
      "GOOGLE_PLACES_API_KEY is not set",
    );
  }
  if (!input.filters?.target_open_time) {
    throw new GooglePlacesGuardrailError(
      "google_q5_target_open_time_required",
      "Q5 requires filters.target_open_time",
    );
  }

  const requestBody = buildGoogleQ5RequestBody(input);
  const fieldMaskName = deps.debugTrace ? "q5_debug_fetch" : "q5_fetch";
  const request = buildGoogleProviderNearbySearchRequest({
    apiKey: googleApiKey,
    fieldMask: fieldMaskName,
    body: requestBody,
  });
  logLocalTestEvent("places_proxy.google_q5.request", {
    input,
    url: request.url,
    method: request.init.method,
    fieldMaskName,
    fieldMaskVersion: GOOGLE_PROVIDER_FIELD_MASKS[fieldMaskName].version,
    fieldMask: GOOGLE_PROVIDER_FIELD_MASKS[fieldMaskName].mask,
    body: requestBody,
  });

  const response = await fetchGoogleProviderWithRetry(
    deps.fetch,
    request.url,
    request.init,
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logLocalTestEvent("places_proxy.google_q5.response_error", {
      input,
      status: response.status,
      body,
    });
    throw new GooglePlacesGuardrailError(
      `google_places_upstream_${response.status}`,
      `Google Places returned ${response.status}`,
    );
  }

  const body = (await response.json()) as GoogleNearbySearchResponse;
  const shaped = shapeGoogleQ5Places(input, body);
  logLocalTestEvent("places_proxy.google_q5.response", {
    input,
    status: response.status,
    rawCandidateCount: body.places?.length ?? 0,
    body,
  });
  logLocalTestEvent("places_proxy.google_q5.candidate_evaluations", {
    input,
    evaluations: evaluateGoogleQ5Candidates(input, body),
  });
  logLocalTestEvent("places_proxy.google_q5.shaped", {
    input,
    strictCount: shaped.strictCount,
    returnedCount: shaped.places.length,
    relaxedServiceUsed: shaped.places.length > shaped.strictCount,
    places: shaped.places,
  });
  console.info(
    "google_q5_shape",
    JSON.stringify({
      raw_count: body.places?.length ?? 0,
      strict_count: shaped.strictCount,
      returned_count: shaped.places.length,
      relaxed_service_used: shaped.places.length > shaped.strictCount,
      has_target_open_time: Boolean(input.filters?.target_open_time),
      service_shape: input.filters?.service_shape ?? null,
      radius_meters: input.radius_meters,
    }),
  );

  return {
    places: shaped.places,
    attribution: GOOGLE_PROVIDER_ATTRIBUTION,
  };
}

export async function handleGoogleVerdictDisplayProxy(
  raw: unknown,
  deps: GooglePlacesProxyDeps,
): Promise<GoogleVerdictDisplayResponse> {
  const googleApiKey = deps.googleApiKey;
  if (!googleApiKey) {
    throw new GooglePlacesGuardrailError(
      "google_places_misconfigured",
      "GOOGLE_PLACES_API_KEY is not set",
    );
  }

  const placeId = validateGoogleVerdictDisplayInput(raw);
  const request = buildGoogleProviderPlaceDetailsRequest({
    apiKey: googleApiKey,
    fieldMask: "verdict_display",
    placeId,
  });
  logLocalTestEvent("places_proxy.google_verdict_display.request", {
    raw,
    placeId,
    url: request.url,
    method: request.init.method,
    fieldMaskName: "verdict_display",
    fieldMaskVersion: GOOGLE_PROVIDER_FIELD_MASKS.verdict_display.version,
    fieldMask: GOOGLE_PROVIDER_FIELD_MASKS.verdict_display.mask,
  });

  const response = await fetchGoogleProviderWithRetry(
    deps.fetch,
    request.url,
    request.init,
  );
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logLocalTestEvent("places_proxy.google_verdict_display.response_error", {
      raw,
      placeId,
      status: response.status,
      body,
    });
    throw new GooglePlacesGuardrailError(
      `google_places_refetch_${response.status}`,
      `Google Places refetch returned ${response.status}`,
    );
  }

  const body = (await response.json()) as GooglePlaceDetailsResponse;
  const place = shapeGoogleVerdictDisplayPlace(placeId, body);
  logLocalTestEvent("places_proxy.google_verdict_display.response", {
    raw,
    placeId,
    status: response.status,
    body,
  });
  logLocalTestEvent("places_proxy.google_verdict_display.shaped", {
    raw,
    placeId,
    place,
  });

  return {
    place,
    attribution: GOOGLE_PROVIDER_ATTRIBUTION,
  };
}

function validateGoogleVerdictDisplayInput(raw: unknown): string {
  if (!raw || typeof raw !== "object") {
    throw new PlacesProxyInputError("body must be a JSON object");
  }

  const placeId = (raw as Record<string, unknown>).google_place_id;
  if (typeof placeId !== "string" || placeId.trim().length === 0) {
    throw new PlacesProxyInputError(
      "google_place_id must be a non-empty string",
    );
  }

  return placeId.trim();
}

function shapeGoogleVerdictDisplayPlace(
  requestedPlaceId: string,
  body: GooglePlaceDetailsResponse,
): GoogleVerdictDisplayPlace {
  if (
    typeof body.id !== "string" ||
    body.id !== requestedPlaceId ||
    typeof body.displayName?.text !== "string" ||
    typeof body.googleMapsUri !== "string"
  ) {
    throw new GooglePlacesGuardrailError(
      "google_place_unavailable",
      "Google Places refetch did not return displayable verdict data",
    );
  }

  return {
    place_id: body.id,
    display_name: body.displayName.text,
    google_maps_uri: body.googleMapsUri,
    ...(typeof body.formattedAddress === "string"
      ? { formatted_address: body.formattedAddress }
      : {}),
  };
}

function shapeGoogleQ5Places(
  input: PlacesProxyInput,
  body: GoogleNearbySearchResponse,
): GoogleQ5ShapeResult {
  const strict = collectGoogleQ5Places(
    input,
    body,
    isGooglePlaceEligibleForTimingAndService,
  );
  if (strict.length >= GOOGLE_Q5_MIN_CARD_COUNT) {
    return {
      places: strict,
      strictCount: strict.length,
    };
  }

  const relaxedService = collectGoogleQ5Places(
    input,
    body,
    isGooglePlaceEligibleForTimingAndRelaxedService,
  );

  if (relaxedService.length >= GOOGLE_Q5_MIN_CARD_COUNT) {
    return {
      places: relaxedService,
      strictCount: strict.length,
    };
  }

  return {
    places: relaxedService,
    strictCount: strict.length,
  };
}

function collectGoogleQ5Places(
  input: PlacesProxyInput,
  body: GoogleNearbySearchResponse,
  isEligible: (
    place: NonNullable<GoogleNearbySearchResponse["places"]>[number],
    input: PlacesProxyInput,
  ) => boolean,
): GoogleQ5Place[] {
  const places: GoogleQ5Place[] = [];
  for (const place of body.places ?? []) {
    if (
      typeof place.id !== "string" ||
      typeof place.displayName?.text !== "string"
    ) {
      continue;
    }
    if (!isEligible(place, input)) {
      continue;
    }

    places.push({
      place_id: place.id,
      display_name: place.displayName.text,
    });
  }
  return places;
}

function evaluateGoogleQ5Candidates(
  input: PlacesProxyInput,
  body: GoogleNearbySearchResponse,
): Array<{
  index: number;
  googlePlaceId: string | null;
  displayName: string | null;
  place: NonNullable<GoogleNearbySearchResponse["places"]>[number];
  strictEligible: boolean;
  relaxedServiceEligible: boolean;
  strictRejectionReasons: string[];
  relaxedServiceRejectionReasons: string[];
}> {
  return (body.places ?? []).map((place, index) => ({
    index,
    googlePlaceId: typeof place.id === "string" ? place.id : null,
    displayName: typeof place.displayName?.text === "string"
      ? place.displayName.text
      : null,
    place,
    strictEligible: isGooglePlaceEligibleForTimingAndService(place, input),
    relaxedServiceEligible: isGooglePlaceEligibleForTimingAndRelaxedService(
      place,
      input,
    ),
    strictRejectionReasons: googleQ5RejectionReasons(input, place, "strict"),
    relaxedServiceRejectionReasons: googleQ5RejectionReasons(
      input,
      place,
      "relaxed_service",
    ),
  }));
}

function googleQ5RejectionReasons(
  input: PlacesProxyInput,
  place: NonNullable<GoogleNearbySearchResponse["places"]>[number],
  mode: "strict" | "relaxed_service",
): string[] {
  const reasons: string[] = [];
  if (typeof place.id !== "string" || place.id.trim().length === 0) {
    reasons.push("missing_place_id");
  }
  if (typeof place.displayName?.text !== "string") {
    reasons.push("missing_display_name");
  }
  if (!isGooglePlaceEligibleForTiming(place, input)) {
    reasons.push("closed_at_target_time_or_missing_hours");
  }

  const serviceShape = input.filters?.service_shape;
  if (serviceShape === "dineIn") {
    if (mode === "strict" && place.dineIn !== true) {
      reasons.push("dine_in_not_explicitly_true");
    }
    if (mode === "relaxed_service" && place.dineIn === false) {
      reasons.push("dine_in_explicitly_false");
    }
  }
  if (serviceShape === "takeout" && place.takeout === false) {
    reasons.push("takeout_explicitly_false");
  }

  return reasons;
}

function isGooglePlaceEligibleForTimingAndService(
  place: NonNullable<GoogleNearbySearchResponse["places"]>[number],
  input: PlacesProxyInput,
): boolean {
  const serviceShape = input.filters?.service_shape;

  if (!isGooglePlaceEligibleForTiming(place, input)) {
    return false;
  }

  if (serviceShape === "dineIn" && place.dineIn !== true) {
    return false;
  }
  if (serviceShape === "takeout" && place.takeout === false) {
    return false;
  }
  return true;
}

function isGooglePlaceEligibleForTimingAndRelaxedService(
  place: NonNullable<GoogleNearbySearchResponse["places"]>[number],
  input: PlacesProxyInput,
): boolean {
  const serviceShape = input.filters?.service_shape;

  if (!isGooglePlaceEligibleForTiming(place, input)) {
    return false;
  }

  if (serviceShape === "dineIn" && place.dineIn === false) {
    return false;
  }
  if (serviceShape === "takeout" && place.takeout === false) {
    return false;
  }
  return true;
}

function isGooglePlaceEligibleForTiming(
  place: NonNullable<GoogleNearbySearchResponse["places"]>[number],
  input: PlacesProxyInput,
): boolean {
  return isOpenAtGoogleTargetTime(
    place.regularOpeningHours?.periods,
    input.filters?.target_open_time,
  );
}

function buildGoogleQ5RequestBody(
  input: PlacesProxyInput,
): Record<string, unknown> {
  const cuisines = input.filters?.cuisines ??
    (input.filters?.cuisine ? [input.filters.cuisine] : undefined);

  return {
    includedPrimaryTypes: googlePrimaryTypesForQ1Cuisines(cuisines),
    maxResultCount: GOOGLE_Q5_MAX_RESULTS,
    locationRestriction: {
      circle: {
        center: {
          latitude: input.lat,
          longitude: input.lng,
        },
        radius: input.radius_meters,
      },
    },
  };
}
