// Foursquare Places API — shaping + filter mapping primitives.
//
// This module is pure: no network, no Deno globals beyond standard
// library types. The PlacesProxy Edge Function composes the functions
// here with a cache adapter and a fetch wrapper; the same primitives
// are exercised by the Deno test suite without any HTTP roundtrip.
//
// References:
//   * ADR 0002 (gti-vault/60_engineering/adr/0002-places-data-foursquare-mapkit.md)
//   * TB-05 ticket (gti-vault/15_issues/v1/issues/tb-05-foursquare-placesproxy.md)
//   * Dietary-tag research (gti-vault/60_engineering/research/foursquare-dietary-tags-2026-05/)

/** Pinned per ADR 0002 §"Live API surface verified 2026-05-13".
 *  Bump this date deliberately when migrating to a new Foursquare schema. */
export const FOURSQUARE_API_VERSION = "2025-06-17";

/** Live base URL — the legacy `api.foursquare.com/v3/*` surface returns
 *  HTTP 410 since the 2025 migration. */
export const FOURSQUARE_BASE_URL = "https://places-api.foursquare.com";

/** Inputs accepted by the PlacesProxy Edge Function. The shape mirrors
 *  the public spec in v1-prd §"PlacesProxy" (interfaces section) and the
 *  TB-05 ticket. */
export interface PlacesProxyInput {
  lat: number;
  lng: number;
  radius_meters: number;
  filters?: PlacesProxyFilters;
}

export interface PlacesProxyFilters {
  /** Q1 dietary chips. Free-form strings to keep this surface tolerant
   *  of placeholder copy churn during TB-04; the canonical chip ids are
   *  enumerated in `DIETARY_CHIP_MAP` below. */
  dietary?: string[];
  /** Q2 price cap. 1..4 mapped to Foursquare's `min_price` / `max_price`
   *  scale (also 1..4). */
  price_tier?: number;
  /** Q3 open-at filter. ISO-8601 timestamp; Foursquare understands
   *  `open_at` as a unix-seconds value, so we convert before the call. */
  open_at?: string;
}

/** Shape returned to the iOS / web clients. Matches the `options.payload`
 *  jsonb shape expected by TB-06 (VerdictEngine). */
export interface ShapedPlace {
  fsq_place_id: string;
  name: string;
  lat: number;
  lng: number;
  price_tier: number | null;
  walk_minutes_estimate: number | null;
  dietary_tags: string[];
  hours: PlaceHours | null;
  photos: string[];
  address: string | null;
  categories: string[];
}

export interface PlaceHours {
  display: string | null;
  open_now: boolean | null;
}

/** Raw shape returned by `GET /places/search` post-2025 migration.
 *  Verified against a live response 2026-05-13 — see
 *  gti-vault/60_engineering/adr/0002-places-data-foursquare-mapkit.md
 *  §"Live API surface verified". */
export interface FoursquareSearchResponse {
  results: FoursquareSearchResult[];
  /** Pagination cursor — opaque token; we don't paginate in v1 because
   *  the EBA engine takes the first page as its candidate pool. */
  context?: { next_cursor?: string };
}

export interface FoursquareSearchResult {
  fsq_place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Per-result `categories[]`. Each carries an `id` plus a human name. */
  categories?: FoursquareCategory[];
  /** Address payload — only `formatted_address` is reliably populated. */
  location?: { formatted_address?: string };
  /** `price` is an integer 1..4 when present, absent otherwise. */
  price?: number;
  /** Free-tier hours payload — string `display` plus boolean `open_now`. */
  hours?: { display?: string; open_now?: boolean };
  /** Photos surface as objects with `prefix` + `suffix`; we collapse to
   *  fully-formed URLs for the client. */
  photos?: FoursquarePhoto[];
  /** Menu-callout signals — populated on a subset of US-metro venues.
   *  See research bundle 60_engineering/research/foursquare-dietary-tags-2026-05/.
   *  String tags, not booleans. */
  tastes?: string[];
  /** Distance in metres from the search centre — used to estimate walk
   *  minutes without a routing API call. */
  distance?: number;
}

export interface FoursquareCategory {
  id?: string | number;
  name: string;
  short_name?: string;
}

export interface FoursquarePhoto {
  prefix: string;
  suffix: string;
}

/** Canonical mapping from the Q1 chip set (per PRD §"Quiz copy") to the
 *  Foursquare signal that pre-filters the candidate pool. Mapping
 *  decisions are sourced from
 *  gti-vault/60_engineering/research/foursquare-dietary-tags-2026-05/report.md
 *  recommendation "Option C" — narrow to what Foursquare reliably exposes.
 *
 *  Strategy types:
 *  - `category`: pass a Foursquare category id in `fsq_category_ids` so
 *    the search is pre-filtered server-side.
 *  - `tastes`: filter post-fetch on the `tastes` field (Foursquare does
 *    not expose a server-side `tastes` filter in the free tier).
 *  - `disclaimer`: the chip carries no machine-filter — the verdict
 *    surface shows a copy disclaimer instead. We still record the chip
 *    in `applied_filters.disclaimers` so the rule chip can render it.
 */
export type DietaryFilterStrategy = "category" | "tastes" | "disclaimer";

export interface DietaryMapping {
  /** Chip id as it appears in `votes.q1_vetoes`. Lower-snake or
   *  human-readable; we lowercase + trim on input. */
  chip: string;
  strategy: DietaryFilterStrategy;
  /** Comma-joined Foursquare category ids when `strategy === "category"`. */
  fsq_category_ids?: string;
  /** Tastes-field tokens checked post-fetch when `strategy === "tastes"`. */
  taste_tokens?: string[];
  /** Tag emitted on the shaped row so the VerdictEngine can match per-
   *  member vetoes against the candidate's tag set. */
  emit_tag: string;
}

export const DIETARY_CHIP_MAP: readonly DietaryMapping[] = Object.freeze([
  {
    // Halal-only — single high-confidence category in Foursquare taxonomy.
    chip: "halal",
    strategy: "category",
    fsq_category_ids: "13352",
    emit_tag: "halal",
  },
  {
    // Kosher — category-level, geographically concentrated but reliable.
    chip: "kosher",
    strategy: "category",
    fsq_category_ids: "13351",
    emit_tag: "kosher",
  },
  {
    // Vegan options — category undercounts omnivore venues that serve
    // vegan dishes; the report (Option C) accepts the undercount and
    // surfaces a disclaimer on the verdict rule chip downstream.
    chip: "vegan",
    strategy: "category",
    fsq_category_ids: "13377",
    emit_tag: "vegan_friendly",
  },
  {
    // Vegetarian — same shape as vegan; pre-filter at category.
    chip: "vegetarian",
    strategy: "category",
    fsq_category_ids: "13378",
    emit_tag: "vegetarian_friendly",
  },
  {
    // Gluten-free — no category signal. Tag emerges in `tastes` on a
    // subset of venues. We filter post-fetch and emit the tag so the
    // engine can match against per-member Q1 vetoes.
    chip: "gluten",
    strategy: "tastes",
    taste_tokens: ["gluten-free", "gluten free", "gluten free options"],
    emit_tag: "gluten_free_options",
  },
  {
    // Dairy / shellfish / nuts — Foursquare exposes NO kitchen-protocol
    // signal. Lock 1 update pending product-owner review (see report
    // §spec-change-proposal). Until the lock changes, surface a
    // disclaimer; do NOT silently drop the chip from the input.
    chip: "dairy",
    strategy: "disclaimer",
    emit_tag: "no_dairy_unverified",
  },
  {
    chip: "shellfish",
    strategy: "disclaimer",
    emit_tag: "no_shellfish_unverified",
  },
  {
    chip: "nuts",
    strategy: "disclaimer",
    emit_tag: "no_nuts_unverified",
  },
]);

/** "Nothing tonight" is a mutually-exclusive escape per PRD user story 18 —
 *  callers send the empty array. We accept the literal as a no-op for
 *  robustness against placeholder copy. */
const NO_OP_CHIPS: ReadonlySet<string> = new Set([
  "nothing tonight",
  "nothing",
  "none",
]);

export function normalizeChip(raw: string): string {
  return raw.trim().toLowerCase();
}

export function findDietaryMapping(chip: string): DietaryMapping | undefined {
  const normalized = normalizeChip(chip);
  return DIETARY_CHIP_MAP.find((m) => m.chip === normalized);
}

/** Translate the proxy's input filters into the query parameters
 *  Foursquare's `/places/search` accepts. Returns the parameters split
 *  into `query` (sent on the wire) and `post_filters` (applied to the
 *  fetched results before shaping). */
export interface FoursquareQueryPlan {
  query: URLSearchParams;
  post_filters: {
    /** Taste-token requirement groups. Each inner array represents the
     *  synonym set for ONE dietary chip — the result must include AT
     *  LEAST ONE token from each group (groups AND'd, members OR'd).
     *  Empty outer array = no post-filter. */
    require_taste_tokens: string[][];
    /** Chips that produced no filter — surfaced to the client as
     *  disclaimers on the verdict rule chip. */
    disclaimers: string[];
  };
  /** Tags emitted on every shaped result for chips that successfully
   *  filtered server-side. Lets the VerdictEngine match per-member
   *  vetoes against the candidate's tag set without re-querying. */
  emitted_tags: string[];
}

export function buildFoursquareQuery(input: PlacesProxyInput): FoursquareQueryPlan {
  const params = new URLSearchParams();
  // ll = "lat,lng" — Foursquare's accepted geo parameter.
  params.set("ll", `${input.lat},${input.lng}`);
  // radius is metres; Foursquare caps at 100000 but our PRD radius
  // tops out at 5 mi (~8047 m) per the soft-pref relax ladder.
  params.set("radius", String(Math.max(1, Math.floor(input.radius_meters))));
  // Limit page size — VerdictEngine consumes the first page as its
  // candidate pool; the design takes the EBA-prune-first approach.
  params.set("limit", "50");

  const filters = input.filters ?? {};
  const dietary = filters.dietary ?? [];
  const categoryIds = new Set<string>();
  const requireTasteTokens: string[][] = [];
  const disclaimers: string[] = [];
  const emittedTags = new Set<string>();

  for (const chip of dietary) {
    const normalized = normalizeChip(chip);
    if (NO_OP_CHIPS.has(normalized)) continue;
    const mapping = findDietaryMapping(normalized);
    if (!mapping) {
      // Unknown chip — record as disclaimer rather than silently drop.
      disclaimers.push(normalized);
      continue;
    }
    switch (mapping.strategy) {
      case "category":
        if (mapping.fsq_category_ids) {
          for (const id of mapping.fsq_category_ids.split(",")) {
            categoryIds.add(id);
          }
        }
        emittedTags.add(mapping.emit_tag);
        break;
      case "tastes":
        if (mapping.taste_tokens && mapping.taste_tokens.length > 0) {
          // One synonym group per chip — at least one synonym must hit.
          requireTasteTokens.push([...mapping.taste_tokens]);
        }
        emittedTags.add(mapping.emit_tag);
        break;
      case "disclaimer":
        disclaimers.push(mapping.emit_tag);
        // Also emit the disclaimer tag on every shaped row so the
        // VerdictEngine and rule-chip surface can read it without a
        // separate disclaimer pipe. The chip's "soft signal" presence
        // is recorded on the candidate even though it didn't filter.
        emittedTags.add(mapping.emit_tag);
        break;
    }
  }

  if (categoryIds.size > 0) {
    // Foursquare accepts a comma-separated list. We sort so the same
    // filter set produces the same wire string (cache key stability).
    params.set("fsq_category_ids", [...categoryIds].sort().join(","));
  }

  if (filters.price_tier !== undefined) {
    const clamped = Math.max(1, Math.min(4, Math.floor(filters.price_tier)));
    // We cap, never floor — a Q2 answer of "Under $15" means
    // max_price = 1, allowing anything cheaper-or-equal.
    params.set("max_price", String(clamped));
  }

  if (filters.open_at !== undefined) {
    const epochSeconds = Math.floor(Date.parse(filters.open_at) / 1000);
    if (Number.isFinite(epochSeconds) && epochSeconds > 0) {
      params.set("open_at", String(epochSeconds));
    }
  }

  // Ask Foursquare for the fields we actually consume — keeps the
  // wire payload tight and avoids surprise on a partial-field rollout.
  params.set(
    "fields",
    [
      "fsq_place_id",
      "name",
      "latitude",
      "longitude",
      "categories",
      "location",
      "price",
      "hours",
      "photos",
      "tastes",
      "distance",
    ].join(","),
  );

  return {
    query: params,
    post_filters: {
      require_taste_tokens: requireTasteTokens,
      disclaimers,
    },
    emitted_tags: [...emittedTags],
  };
}

/** Stable, opaque cache-key fragment representing the filter+radius
 *  combination. Same filters → same signature regardless of dietary
 *  chip ordering. */
export function buildQuerySignature(input: PlacesProxyInput): string {
  const plan = buildFoursquareQuery(input);
  // The URLSearchParams.toString() output is already deterministic per
  // our explicit ordering above, but we strip `ll` because the geo
  // bucket is the cache's first key — the signature is the *non-geo*
  // half of the cache key.
  const params = new URLSearchParams(plan.query);
  params.delete("ll");
  // Carry the post-filter set in the signature so a different chip
  // set produces a different cache row even if all category ids fold
  // into the same Foursquare query.
  if (plan.post_filters.require_taste_tokens.length > 0) {
    // Stable canonicalisation — sort tokens within each group, then
    // sort groups, then join. Same chip set ↔ same signature.
    const groupKey = plan.post_filters.require_taste_tokens
      .map((group) => [...group].sort().join("|"))
      .sort()
      .join(";");
    params.set("_post_taste", groupKey);
  }
  if (plan.post_filters.disclaimers.length > 0) {
    params.set(
      "_post_disclaim",
      [...plan.post_filters.disclaimers].sort().join(","),
    );
  }
  return params.toString();
}

/** Lightweight geo bucket used as the cache's first-tier key. We use a
 *  fixed grid in degrees rather than pulling in an h3 dependency for
 *  v1 — the column is named `geo_h3` per ADR 0002 to leave room for an
 *  h3 upgrade without a schema change.
 *
 *  Bucket size: ~0.005 deg ≈ 555 m at the equator. Small enough that
 *  every cache hit returns places within the user's session radius;
 *  large enough that a city's worth of typical searches hits the same
 *  rows. */
export const GEO_BUCKET_DEGREES = 0.005;

export function computeGeoBucket(lat: number, lng: number): string {
  const bucketLat = Math.round(lat / GEO_BUCKET_DEGREES) * GEO_BUCKET_DEGREES;
  const bucketLng = Math.round(lng / GEO_BUCKET_DEGREES) * GEO_BUCKET_DEGREES;
  return `${bucketLat.toFixed(4)}_${bucketLng.toFixed(4)}`;
}

/** Walking-pace estimate — 80 m / minute, rounded up. Pace sourced
 *  from the verdict-screen spec (matches Apple's iOS Maps walking-time
 *  default within a couple of seconds at the radii we use). */
const WALK_METRES_PER_MINUTE = 80;

export function estimateWalkMinutes(distanceMetres: number | undefined): number | null {
  if (distanceMetres === undefined || !Number.isFinite(distanceMetres)) {
    return null;
  }
  return Math.max(1, Math.ceil(distanceMetres / WALK_METRES_PER_MINUTE));
}

/** Collapse a Foursquare photo entry into a usable URL. We pick a
 *  modest "original" rendition — clients can re-scale via the URL
 *  template if they need a tighter aspect later. */
export function photoToUrl(photo: FoursquarePhoto): string {
  // Foursquare's documented size token is `original` or `WxH`. We use
  // `400x400` so the client doesn't pay for a 1200-px asset in the
  // verdict carousel.
  return `${photo.prefix}400x400${photo.suffix}`;
}

/** Pull dietary tags off a Foursquare result. Category-level signals
 *  are always preserved (a category-restaurant carries the tag whether
 *  or not the user queried for that chip); taste-level signals are
 *  preserved when the post-fetch token check passes. */
export function extractDietaryTags(
  result: FoursquareSearchResult,
  emittedTags: string[],
): string[] {
  const tags = new Set<string>(emittedTags);
  const categoryIds = (result.categories ?? []).flatMap((c) =>
    c.id !== undefined ? [String(c.id)] : []
  );
  for (const mapping of DIETARY_CHIP_MAP) {
    if (mapping.strategy === "category" && mapping.fsq_category_ids) {
      const ids = mapping.fsq_category_ids.split(",");
      if (ids.some((id) => categoryIds.includes(id))) {
        tags.add(mapping.emit_tag);
      }
    } else if (mapping.strategy === "tastes" && mapping.taste_tokens) {
      const tastes = (result.tastes ?? []).map((t) => t.toLowerCase());
      if (mapping.taste_tokens.some((t) => tastes.includes(t.toLowerCase()))) {
        tags.add(mapping.emit_tag);
      }
    }
  }
  return [...tags];
}

/** Convert one Foursquare search result into the proxy's output row
 *  shape. Returns null when the result is missing fields we cannot
 *  meaningfully default — those rows are skipped rather than emitted
 *  with placeholder data. */
export function shapeFoursquareResult(
  result: FoursquareSearchResult,
  emittedTags: string[],
): ShapedPlace | null {
  if (!result.fsq_place_id || !result.name) return null;
  if (result.latitude === undefined || result.longitude === undefined) return null;

  return {
    fsq_place_id: result.fsq_place_id,
    name: result.name,
    lat: result.latitude,
    lng: result.longitude,
    price_tier: result.price ?? null,
    walk_minutes_estimate: estimateWalkMinutes(result.distance),
    dietary_tags: extractDietaryTags(result, emittedTags),
    hours: result.hours
      ? {
          display: result.hours.display ?? null,
          open_now: result.hours.open_now ?? null,
        }
      : null,
    photos: (result.photos ?? []).map(photoToUrl),
    address: result.location?.formatted_address ?? null,
    categories: (result.categories ?? []).map((c) => c.name),
  };
}

/** Apply the post-fetch filters that Foursquare's free-tier surface
 *  doesn't support server-side. Today this means `tastes` filtering
 *  for gluten-free. */
export function applyPostFilters(
  results: FoursquareSearchResult[],
  requireTasteTokens: string[][],
): FoursquareSearchResult[] {
  if (requireTasteTokens.length === 0) return results;
  // Lower-case the requirement groups once.
  const groups = requireTasteTokens.map((group) =>
    group.map((t) => t.toLowerCase())
  );
  return results.filter((r) => {
    const tastes = (r.tastes ?? []).map((t) => t.toLowerCase());
    // Every group needs at least one matching synonym.
    return groups.every((group) => group.some((t) => tastes.includes(t)));
  });
}

/** Thin-results threshold — when fewer than this number of usable rows
 *  come back, the iOS client treats the response as a MapKit-fallback
 *  trigger per ADR 0002. We expose the constant rather than baking it
 *  in so test fixtures can reference the same value. */
export const THIN_RESULTS_THRESHOLD = 3;
