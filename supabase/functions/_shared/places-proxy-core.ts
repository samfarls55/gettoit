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

interface GoogleQ5ProxyDeps {
  fetch: FetchFn;
  googleApiKey: string;
}

export type PlacesProxyResponse = ProxyResponse | GoogleQ5Response;

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
  return {
    lat, lng, radius_meters: radius,
    filters: { dietary, price_tier, open_at, cuisine },
  };
}

export function isGoogleQ5Input(raw: unknown): boolean {
  return !!raw && typeof raw === "object" &&
    (raw as Record<string, unknown>).surface === "q5";
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
export const GOOGLE_Q5_FIELD_MASK = "places.id,places.displayName";
export const GOOGLE_Q5_MAX_RESULTS = 20;
export const GOOGLE_INCLUDED_PRIMARY_TYPES_LIMIT = 50;

export const GOOGLE_Q1_CUISINE_PRIMARY_TYPES: Record<string, readonly string[]> = {
  american: [
    "american_restaurant",
    "hamburger_restaurant",
    "barbecue_restaurant",
    "steak_house",
    "diner",
    "chicken_restaurant",
    "chicken_wings_restaurant",
    "hot_dog_restaurant",
    "hot_dog_stand",
    "soul_food_restaurant",
    "southwestern_us_restaurant",
  ],
  mexican: [
    "mexican_restaurant",
    "taco_restaurant",
    "tex_mex_restaurant",
    "burrito_restaurant",
  ],
  italian: ["italian_restaurant", "pizza_restaurant"],
  japanese: [
    "japanese_restaurant",
    "sushi_restaurant",
    "ramen_restaurant",
    "japanese_curry_restaurant",
    "japanese_izakaya_restaurant",
    "tonkatsu_restaurant",
    "yakiniku_restaurant",
    "yakitori_restaurant",
  ],
  chinese: [
    "chinese_restaurant",
    "chinese_noodle_restaurant",
    "dim_sum_restaurant",
    "cantonese_restaurant",
  ],
  thai: ["thai_restaurant"],
  indian: [
    "indian_restaurant",
    "north_indian_restaurant",
    "south_indian_restaurant",
  ],
  mediterranean: [
    "mediterranean_restaurant",
    "greek_restaurant",
    "tapas_restaurant",
  ],
  middle_eastern: [
    "middle_eastern_restaurant",
    "lebanese_restaurant",
    "falafel_restaurant",
    "kebab_shop",
    "shawarma_restaurant",
    "persian_restaurant",
    "israeli_restaurant",
    "turkish_restaurant",
    "afghani_restaurant",
    "moroccan_restaurant",
  ],
  korean: ["korean_restaurant", "korean_barbecue_restaurant"],
  vietnamese: ["vietnamese_restaurant"],
  seafood: [
    "seafood_restaurant",
    "fish_and_chips_restaurant",
    "oyster_bar_restaurant",
  ],
  comfort_food: [
    "family_restaurant",
    "fast_food_restaurant",
    "buffet_restaurant",
    "sandwich_shop",
    "deli",
    "food_court",
    "cafeteria",
    "bar_and_grill",
    "gastropub",
  ],
};

export function googlePrimaryTypesForCuisineSelection(
  cuisines: readonly string[],
): string[] {
  const selected = cuisines.length === 0
    ? Object.keys(GOOGLE_Q1_CUISINE_PRIMARY_TYPES)
    : cuisines;
  const types: string[] = [];
  const seen = new Set<string>();

  for (const cuisine of selected) {
    for (const type of GOOGLE_Q1_CUISINE_PRIMARY_TYPES[cuisine] ?? []) {
      if (seen.has(type)) continue;
      seen.add(type);
      types.push(type);
    }
  }

  return types;
}

type GoogleNearbySearchResponse = {
  places?: Array<{
    id?: unknown;
    displayName?: { text?: unknown };
  }>;
};

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

  const responses = await fetchGoogleNearbyWithRetry(
    input,
    deps.fetch,
    googleApiKey,
  );

  const places: GoogleQ5Place[] = [];
  const seenPlaceIds = new Set<string>();
  for (const response of responses) {
    if (!response.ok) {
      throw new GooglePlacesGuardrailError(
        `google_places_upstream_${response.status}`,
        `Google Places returned ${response.status}`,
      );
    }

    for (const place of shapeGoogleQ5Places(
      (await response.json()) as GoogleNearbySearchResponse,
    )) {
      if (seenPlaceIds.has(place.place_id)) continue;
      seenPlaceIds.add(place.place_id);
      places.push(place);
    }
  }

  return {
    places,
    attribution: {
      provider: "google",
      render: "text",
      text: "Powered by Google",
    },
  };
}

async function fetchGoogleNearbyWithRetry(
  input: PlacesProxyInput,
  fetch: FetchFn,
  googleApiKey: string,
): Promise<Response[]> {
  const responses: Response[] = [];
  for (const init of buildGoogleQ5Requests(input, googleApiKey)) {
    let response = await fetch(GOOGLE_NEARBY_SEARCH_URL, init);
    if (response.status === 429 || response.status >= 500) {
      response = await fetch(GOOGLE_NEARBY_SEARCH_URL, init);
    }
    responses.push(response);
  }
  return responses;
}

function shapeGoogleQ5Places(
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

    places.push({
      place_id: place.id,
      display_name: place.displayName.text,
    });
  }
  return places;
}

function buildGoogleQ5Requests(
  input: PlacesProxyInput,
  apiKey: string,
): RequestInit[] {
  const primaryTypes = googlePrimaryTypesForInput(input);
  return chunkGoogleIncludedPrimaryTypes(primaryTypes).map((
    includedPrimaryTypes,
  ) => ({
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_Q5_FIELD_MASK,
    },
    body: JSON.stringify({
      includedPrimaryTypes,
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
  }));
}

function googlePrimaryTypesForInput(input: PlacesProxyInput): string[] {
  const cuisine = input.filters?.cuisine;
  return googlePrimaryTypesForCuisineSelection(cuisine ? [cuisine] : []);
}

function chunkGoogleIncludedPrimaryTypes(types: string[]): string[][] {
  const chunks: string[][] = [];
  for (
    let index = 0;
    index < types.length;
    index += GOOGLE_INCLUDED_PRIMARY_TYPES_LIMIT
  ) {
    chunks.push(types.slice(index, index + GOOGLE_INCLUDED_PRIMARY_TYPES_LIMIT));
  }
  return chunks;
}
