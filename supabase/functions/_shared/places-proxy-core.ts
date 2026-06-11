// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// PlacesProxy core orchestrator.
//
// This module is independent of Supabase and Deno's HTTP server so it
// can be exercised by the Deno test suite without any network roundtrip.
// `places-proxy/index.ts` injects the real Supabase cache adapter + a
// real `fetch` wrapper at runtime.

import {
  applyPostFilters,
  buildFoursquareQuery,
  buildQuerySignature,
  computeGeoBucket,
  FOURSQUARE_API_VERSION,
  FOURSQUARE_BASE_URL,
  type FoursquareSearchResponse,
  OPEN_AT_PATTERN,
  type PlacesProxyInput,
  shapeFoursquareResult,
  type ShapedPlace,
  THIN_RESULTS_THRESHOLD,
} from "./foursquare.ts";

/** Cache record persisted under `(geo_h3, query_signature)`. */
export interface CacheRow {
  geo_h3: string;
  query_signature: string;
  payload: CachePayload;
  cached_at: string; // ISO-8601 timestamp
}

export interface CachePayload {
  places: ShapedPlace[];
  /** Disclaimers carried over from the original query â€” preserved so
   *  the client can render the rule chip even on a cache hit. */
  disclaimers: string[];
}

/** Storage adapter â€” abstracted so unit tests can plug an in-memory
 *  Map and the production Edge Function can plug supabase-js. */
export interface CacheAdapter {
  get(geo_h3: string, query_signature: string): Promise<CacheRow | null>;
  put(row: CacheRow): Promise<void>;
}

/** Fetch wrapper â€” same `fetch` signature so tests can stub a
 *  recorded Foursquare response. */
export type FetchFn = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface ProxyDeps {
  cache: CacheAdapter;
  fetch: FetchFn;
  apiKey: string;
  /** Time-source override for deterministic tests. */
  now?: () => Date;
  /** Hot-zone TTL â€” applied when the cached row has the
   *  `hot_zone: true` flag. Currently marks every zone hot until the
   *  zone-detection heuristic lands; see follow-up note in TB-05. */
  hotZoneTtlMs?: number;
  /** Cold-zone TTL â€” applied when `hot_zone: false`. */
  coldZoneTtlMs?: number;
}

export const DEFAULT_HOT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_COLD_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Output emitted to the iOS / web client. */
export interface ProxyResponse {
  places: ShapedPlace[];
  /** Disclaimers â€” chip ids that had no Foursquare signal. The verdict
   *  rule chip surfaces these per the dietary-tag research Â§spec-change-proposal. */
  disclaimers: string[];
  /** True when fewer than THIN_RESULTS_THRESHOLD usable rows came back.
   *  iOS uses this signal to trigger its MapKit fallback per ADR 0002.
   *  Web uses it to render the "couldn't load options nearby" empty state. */
  is_thin: boolean;
  /** Whether this response was served from cache. Informational for
   *  observability â€” clients should not branch behavior on it. */
  served_from_cache: boolean;
  /** Set when Foursquare was reached but answered a non-2xx the proxy
   *  degrades over (a 4xx/5xx other than the hard-failing 410). The
   *  value is `foursquare_upstream_<status>` â€” e.g. `foursquare_upstream_429`
   *  on credit exhaustion. Absent on a healthy response. Lets the client
   *  and the deploy diagnostic tell an upstream fault apart from a
   *  genuine empty result set. */
  error?: string;
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

interface GoogleQ5ProxyDeps {
  fetch: FetchFn;
  googleApiKey: string;
}

export type PlacesProxyResponse =
  | ProxyResponse
  | GoogleQ5Response
  | GoogleVerdictDisplayResponse;

/** Returned when validation rejects the input. */
export class PlacesProxyInputError extends Error {
  status = 400;
}

export class GooglePlacesGuardrailError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Returned when Foursquare returns a non-2xx the proxy doesn't handle. */
export class FoursquareUpstreamError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function isGoogleServiceShape(value: unknown): value is "dineIn" | "takeout" {
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
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new PlacesProxyInputError("lat must be a finite number in [-90, 90]");
  }
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new PlacesProxyInputError("lng must be a finite number in [-180, 180]");
  }
  if (
    typeof radius !== "number" ||
    !Number.isFinite(radius) ||
    radius <= 0 ||
    radius > 100_000
  ) {
    throw new PlacesProxyInputError(
      "radius_meters must be a finite positive number â‰¤ 100000",
    );
  }
  const filters = (obj.filters ?? {}) as Record<string, unknown>;
  const dietary = Array.isArray(filters.dietary)
    ? (filters.dietary.filter((x) => typeof x === "string") as string[])
    : undefined;
  const price_tier = typeof filters.price_tier === "number"
    ? filters.price_tier
    : undefined;
  // `open_at` is Foursquare's `[1-7]THHMM` weekday + local-time token.
  // A present-but-malformed value is a client bug â€” reject it loudly
  // (400) rather than swallowing it, the same failure mode that hid the
  // epoch-format outage. An absent value is fine: the filter is optional.
  let open_at: string | undefined;
  if (typeof filters.open_at === "string") {
    if (!OPEN_AT_PATTERN.test(filters.open_at)) {
      throw new PlacesProxyInputError(
        "filters.open_at must be a Foursquare [1-7]THHMM token " +
          `(weekday 1-7 + local wall-clock HHMM), got: ${filters.open_at}`,
      );
    }
    open_at = filters.open_at;
  }
  // Cuisine advisory tag (tb-17) â€” a `QuizCuisine` id on a per-cuisine
  // call, absent on the general call. A non-string / missing value
  // drops to undefined: decode stays tolerant, the call degrades to
  // the general query rather than erroring.
  const cuisine = typeof filters.cuisine === "string"
    ? filters.cuisine
    : undefined;
  const service_shape = isGoogleServiceShape(filters.service_shape)
    ? filters.service_shape
    : undefined;
  return {
    lat, lng, radius_meters: radius,
    filters: { dietary, price_tier, open_at, cuisine, service_shape },
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

function ttlForRow(_row: CacheRow, deps: ProxyDeps): number {
  // The original release ships with a single TTL band. Hot/cold detection is a follow-up
  // (see Adjacencies on the TB-05 ticket). When the heuristic lands,
  // store the band on the row and switch here.
  return deps.hotZoneTtlMs ?? DEFAULT_HOT_TTL_MS;
}

export function isCacheRowFresh(row: CacheRow, deps: ProxyDeps): boolean {
  const now = (deps.now ?? (() => new Date()))().getTime();
  const cachedAt = Date.parse(row.cached_at);
  if (!Number.isFinite(cachedAt)) return false;
  return now - cachedAt < ttlForRow(row, deps);
}

/** Core entry point. Composes cache lookup â†’ Foursquare fetch â†’ cache
 *  write â†’ response shaping. Pure with respect to its `deps` argument. */
export async function handlePlacesProxy(
  input: PlacesProxyInput,
  deps: ProxyDeps,
): Promise<ProxyResponse> {
  const geo_h3 = computeGeoBucket(input.lat, input.lng);
  const query_signature = buildQuerySignature(input);

  // 1. Cache check.
  const cached = await deps.cache.get(geo_h3, query_signature);
  if (cached && isCacheRowFresh(cached, deps)) {
    const places = cached.payload.places;
    return {
      places,
      disclaimers: cached.payload.disclaimers,
      is_thin: places.length < THIN_RESULTS_THRESHOLD,
      served_from_cache: true,
    };
  }

  // 2. Cache miss â€” call Foursquare.
  const plan = buildFoursquareQuery(input);
  const url = `${FOURSQUARE_BASE_URL}/places/search?${plan.query.toString()}`;
  const response = await deps.fetch(url, {
    headers: {
      "Authorization": `Bearer ${deps.apiKey}`,
      "X-Places-Api-Version": FOURSQUARE_API_VERSION,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    // Surface upstream errors as a thin response â€” the client decides
    // whether to MapKit-fallback (iOS) or empty-state (web). We log
    // the upstream status for observability without 500ing.
    const body = await response.text().catch(() => "");
    if (response.status === 410) {
      // Hard signal that the API version pin slipped â€” fail loud so a
      // human notices in CI / logs. Per ADR 0002, the legacy host
      // returns 410 and the new host can return 410 if the version
      // header is unset.
      throw new FoursquareUpstreamError(
        410,
        `Foursquare returned 410 (likely missing/invalid X-Places-Api-Version header): ${body.slice(0, 200)}`,
      );
    }
    // Non-410 upstream failure. Degrade to a thin response, but surface
    // the upstream status as a named error + a loud log â€” a swallowed
    // 4xx is what hid the 2026-05-16 credit-exhaustion outage (the proxy
    // answered an unmarked empty 200 and looked like "no venues here").
    console.error(
      `Foursquare upstream ${response.status}: ${body.slice(0, 200)}`,
    );
    return {
      places: [],
      disclaimers: plan.post_filters.disclaimers,
      is_thin: true,
      served_from_cache: false,
      error: `foursquare_upstream_${response.status}`,
    };
  }

  const body = (await response.json()) as FoursquareSearchResponse;
  const rawResults = body.results ?? [];
  const postFiltered = applyPostFilters(
    rawResults,
    plan.post_filters.require_taste_tokens,
  );
  const places: ShapedPlace[] = [];
  for (const r of postFiltered) {
    const shaped = shapeFoursquareResult(r, plan.emitted_tags);
    if (shaped) places.push(shaped);
  }

  const payload: CachePayload = {
    places,
    disclaimers: plan.post_filters.disclaimers,
  };

  // 3. Write through to cache. Failures here are not fatal â€” a cache
  // write error must not break the user's session; we'll re-query
  // Foursquare on the next request.
  try {
    await deps.cache.put({
      geo_h3,
      query_signature,
      payload,
      cached_at: (deps.now ?? (() => new Date()))().toISOString(),
    });
  } catch (_err) {
    // Swallow â€” observability is the Edge Function's runtime concern.
  }

  return {
    places,
    disclaimers: plan.post_filters.disclaimers,
    is_thin: places.length < THIN_RESULTS_THRESHOLD,
    served_from_cache: false,
  };
}

const GOOGLE_NEARBY_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchNearby";
export const GOOGLE_Q5_FIELD_MASK_VERSION = "q5_name_only_v1";
export const GOOGLE_Q5_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.currentOpeningHours",
  "places.regularOpeningHours",
  "places.dineIn",
  "places.takeout",
].join(",");
export const GOOGLE_Q5_MAX_RESULTS = 20;
export const GOOGLE_VERDICT_DISPLAY_FIELD_MASK_VERSION =
  "verdict_display_v1";
export const GOOGLE_VERDICT_DISPLAY_FIELD_MASK = [
  "id",
  "displayName",
  "googleMapsUri",
  "formattedAddress",
].join(",");

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

interface GoogleOpeningPeriod {
  open?: GoogleOpeningPoint;
  close?: GoogleOpeningPoint;
}

interface GoogleOpeningPoint {
  day?: unknown;
  hour?: unknown;
  minute?: unknown;
}

export async function handleGoogleQ5PlacesProxy(
  input: PlacesProxyInput,
  deps: GoogleQ5ProxyDeps,
): Promise<GoogleQ5Response> {
  const googleApiKey = deps.googleApiKey;
  if (!googleApiKey) {
    throw new GooglePlacesGuardrailError(
      "google_places_misconfigured",
      "GOOGLE_PLACES_API_KEY is not set",
    );
  }

  const response = await fetchGoogleNearbyWithRetry(
    input,
    deps.fetch,
    googleApiKey,
  );
  if (!response.ok) {
    throw new GooglePlacesGuardrailError(
      `google_places_upstream_${response.status}`,
      `Google Places returned ${response.status}`,
    );
  }

  const body = (await response.json()) as GoogleNearbySearchResponse;
  return {
    places: shapeGoogleQ5Places(input, body),
    attribution: {
      provider: "google",
      render: "text",
      text: "Powered by Google",
    },
  };
}

export async function handleGoogleVerdictDisplayProxy(
  raw: unknown,
  deps: GoogleQ5ProxyDeps,
): Promise<GoogleVerdictDisplayResponse> {
  const googleApiKey = deps.googleApiKey;
  if (!googleApiKey) {
    throw new GooglePlacesGuardrailError(
      "google_places_misconfigured",
      "GOOGLE_PLACES_API_KEY is not set",
    );
  }

  const placeId = validateGoogleVerdictDisplayInput(raw);
  const response = await fetchGooglePlaceDetailsWithRetry(
    placeId,
    deps.fetch,
    googleApiKey,
  );
  if (!response.ok) {
    throw new GooglePlacesGuardrailError(
      `google_places_refetch_${response.status}`,
      `Google Places refetch returned ${response.status}`,
    );
  }

  return {
    place: shapeGoogleVerdictDisplayPlace(
      placeId,
      (await response.json()) as GooglePlaceDetailsResponse,
    ),
    attribution: {
      provider: "google",
      render: "text",
      text: "Powered by Google",
    },
  };
}

function validateGoogleVerdictDisplayInput(raw: unknown): string {
  if (!raw || typeof raw !== "object") {
    throw new PlacesProxyInputError("body must be a JSON object");
  }
  const placeId = (raw as Record<string, unknown>).google_place_id;
  if (typeof placeId !== "string" || placeId.trim().length === 0) {
    throw new PlacesProxyInputError("google_place_id must be a non-empty string");
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

async function fetchGooglePlaceDetailsWithRetry(
  placeId: string,
  fetch: FetchFn,
  googleApiKey: string,
): Promise<Response> {
  const init = buildGoogleVerdictDisplayRequest(googleApiKey);
  const url = `https://places.googleapis.com/v1/places/${
    encodeURIComponent(placeId)
  }`;
  let response = await fetch(url, init);
  if (response.status === 429 || response.status >= 500) {
    response = await fetch(url, init);
  }
  return response;
}

function buildGoogleVerdictDisplayRequest(googleApiKey: string): RequestInit {
  return {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": googleApiKey,
      "X-Goog-FieldMask": GOOGLE_VERDICT_DISPLAY_FIELD_MASK,
      "Accept": "application/json",
    },
  };
}

async function fetchGoogleNearbyWithRetry(
  input: PlacesProxyInput,
  fetch: FetchFn,
  googleApiKey: string,
): Promise<Response> {
  const init = buildGoogleQ5Request(input, googleApiKey);
  let response = await fetch(GOOGLE_NEARBY_SEARCH_URL, init);
  if (response.status === 429 || response.status >= 500) {
    response = await fetch(GOOGLE_NEARBY_SEARCH_URL, init);
  }
  return response;
}

function shapeGoogleQ5Places(
  input: PlacesProxyInput,
  body: GoogleNearbySearchResponse,
): GoogleQ5Place[] {
  const places: GoogleQ5Place[] = [];
  for (const place of body.places ?? []) {
    if (
      typeof place.id !== "string" ||
      typeof place.displayName?.text !== "string"
    ) {
      continue;
    }
    if (!isGooglePlaceEligibleForTimingAndService(place, input)) {
      continue;
    }

    places.push({
      place_id: place.id,
      display_name: place.displayName.text,
    });
  }
  return places;
}

function isGooglePlaceEligibleForTimingAndService(
  place: NonNullable<GoogleNearbySearchResponse["places"]>[number],
  input: PlacesProxyInput,
): boolean {
  const openAt = input.filters?.open_at;
  const serviceShape = input.filters?.service_shape;

  if (openAt) {
    if (!isOpenAtGoogleRegularTime(place.regularOpeningHours, openAt)) {
      return false;
    }
  } else if (
    place.currentOpeningHours?.openNow !== true &&
    place.regularOpeningHours?.openNow !== true
  ) {
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

function isOpenAtGoogleRegularTime(
  hours: GoogleOpeningHours | undefined,
  openAt: string,
): boolean {
  const target = parseOpenAtToken(openAt);
  if (!target || !Array.isArray(hours?.periods)) return false;
  return hours.periods.some((period) => periodContainsGoogleMinute(period, target));
}

function parseOpenAtToken(
  openAt: string,
): { googleDay: number; minuteOfDay: number } | null {
  const match = /^([1-7])T([0-2][0-9])([0-5][0-9])$/.exec(openAt);
  if (!match) return null;
  const foursquareDay = Number(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (hour > 23) return null;
  return {
    googleDay: foursquareDay === 7 ? 0 : foursquareDay,
    minuteOfDay: hour * 60 + minute,
  };
}

function periodContainsGoogleMinute(
  period: GoogleOpeningPeriod,
  target: { googleDay: number; minuteOfDay: number },
): boolean {
  const open = googlePointMinuteOfWeek(period.open);
  const close = googlePointMinuteOfWeek(period.close);
  if (open === null || close === null) return false;
  const targetMinute = target.googleDay * 24 * 60 + target.minuteOfDay;
  if (close > open) {
    return targetMinute >= open && targetMinute < close;
  }
  return targetMinute >= open || targetMinute < close;
}

function googlePointMinuteOfWeek(point: GoogleOpeningPoint | undefined): number | null {
  if (!point) return null;
  if (
    typeof point.day !== "number" ||
    typeof point.hour !== "number" ||
    typeof point.minute !== "number" ||
    point.day < 0 ||
    point.day > 6 ||
    point.hour < 0 ||
    point.hour > 23 ||
    point.minute < 0 ||
    point.minute > 59
  ) {
    return null;
  }
  return point.day * 24 * 60 + point.hour * 60 + point.minute;
}

function buildGoogleQ5Request(
  input: PlacesProxyInput,
  apiKey: string,
): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_Q5_FIELD_MASK,
    },
    body: JSON.stringify({
      includedPrimaryTypes: ["restaurant"],
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
    }),
  };
}
