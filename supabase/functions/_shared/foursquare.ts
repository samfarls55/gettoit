// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// Foursquare Places API â€” shaping + filter mapping primitives.
//
// This module is pure: no network, no Deno globals beyond standard
// library types. The PlacesProxy Edge Function composes the functions
// here with a cache adapter and a fetch wrapper; the same primitives
// are exercised by the Deno test suite without any HTTP roundtrip.
//
// References:
//   * ADR 0002 (gti-vault/60_engineering/adr/0002-places-data-foursquare-mapkit.md)
//   * TB-05 ticket (gti-vault/15_issues/0.1.0/issues/tb-05-foursquare-placesproxy.md)
//   * Dietary-tag research (gti-vault/60_engineering/research/foursquare-dietary-tags-2026-05/)

/** Pinned per ADR 0002 Â§"Live API surface verified 2026-05-13".
 *  Bump this date deliberately when migrating to a new Foursquare schema. */
export const FOURSQUARE_API_VERSION = "2025-06-17";

/** Live base URL â€” the legacy `api.foursquare.com/v3/*` surface returns
 *  HTTP 410 since the 2025 migration. */
export const FOURSQUARE_BASE_URL = "https://places-api.foursquare.com";

/** Inputs accepted by the PlacesProxy Edge Function. The shape mirrors
 *  the public spec in 0.1.0-prd Â§"PlacesProxy" (interfaces section) and the
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
  /** Open-at filter. Foursquare's `open_at` is a recurring weekday +
   *  wall-clock token â€” `[1-7]THHMM`, day 1=Mon..7=Sun, e.g. `3T1900`
   *  for Wed 19:00. It is NOT a timestamp: Foursquare interprets it in
   *  the *venue's local time* (it filters against the venue's posted
   *  `hours.regular`, which are local). The iOS planner therefore
   *  resolves the meal instant in the search area's timezone and emits
   *  the token directly; the proxy passes it straight through. */
  open_at?: string;
  /** TB-07/TB-17 (quiz redesign) â€” the craved cuisine this per-member fetch call
   *  is tagged for: a `QuizCuisine` id (e.g. `"mexican"`), enumerated in
   *  `CUISINE_CATEGORY_MAP` below.
   *
   *  Set on each of the N per-cuisine calls of the N+1 fan-out; ABSENT
   *  on the mandatory general call. When present, the proxy scopes that
   *  individual call to the mapped Foursquare category. The general call
   *  stays un-category-scoped so it supplies the non-craved breadth the
   *  Q5 factorial needs (research-01 Â§3.2 â€” cuisine never strict-filters
   *  the fetch *as a whole*; only the individual per-cuisine call is
   *  category-scoped). An unknown / absent value degrades gracefully to
   *  the general query â€” no error. */
  cuisine?: string;
  /** Shared Room service-mode parameter. Google candidate eligibility
   *  treats dine-in as hard explicit true, while takeout only cuts an
   *  explicit false. */
  service_shape?: "dineIn" | "takeout";
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
  /** TB-16 (quiz redesign) â€” reputation-axis metadata. The Foursquare quality
   *  score (0..10), the volume signal (`stats.total_ratings`), and the
   *  record-age signal (`date_created`). The mobile `Q5VenueClassifier`
   *  buckets these pool-relatively into the Q5 factorial's reputation
   *  axis (Popular / Hidden gem / Classic / New) â€” see
   *  gti-vault/60_engineering/research/foursquare-filter-surface-2026-05
   *  Â§4. All three are nullable: an older client that does not read them
   *  simply ignores the extra keys; a venue Foursquare returns no
   *  reputation data for shapes them as `null`. */
  rating: number | null;
  total_ratings: number | null;
  date_created: string | null;
  /** TB-18 (quiz redesign) â€” vibe-axis signal. Foursquare's crowd-sourced
   *  `tastes` tag cloud, passed through verbatim. The iOS
   *  `Q5VenueClassifier` matches these tokens against the research-02
   *  curated allowlist to apply a bounded Â±1 nudge to the category-
   *  archetype vibe baseline â€” see
   *  gti-vault/60_engineering/research/foursquare-tastes-vibe-2026-05.
   *  `tastes` is already in the proxy's `fields` list (paid for by the
   *  TB-09 dietary `tastes`-strategy filter) so projecting it adds no
   *  API cost. Shapes as `[]` when Foursquare returns no tags â€” an
   *  older client simply ignores the key. */
  tastes: string[];
}

export interface PlaceHours {
  display: string | null;
  open_now: boolean | null;
}

/** Raw shape returned by `GET /places/search` post-2025 migration.
 *  Verified against a live response 2026-05-13 â€” see
 *  gti-vault/60_engineering/adr/0002-places-data-foursquare-mapkit.md
 *  Â§"Live API surface verified". */
export interface FoursquareSearchResponse {
  results: FoursquareSearchResult[];
  /** Pagination cursor â€” opaque token; we don't paginate currently because
   *  the EBA engine takes the first page as its candidate pool. */
  context?: { next_cursor?: string };
}

export interface FoursquareSearchResult {
  fsq_place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Per-result `categories[]`. Each carries an `fsq_category_id` plus a
   *  human name. */
  categories?: FoursquareCategory[];
  /** Address payload â€” only `formatted_address` is reliably populated. */
  location?: { formatted_address?: string };
  /** `price` is an integer 1..4 when present, absent otherwise. */
  price?: number;
  /** Free-tier hours payload â€” string `display` plus boolean `open_now`. */
  hours?: { display?: string; open_now?: boolean };
  /** Photos surface as objects with `prefix` + `suffix`; we collapse to
   *  fully-formed URLs for the client. */
  photos?: FoursquarePhoto[];
  /** Menu-callout signals â€” populated on a subset of US-metro venues.
   *  See research bundle 60_engineering/research/foursquare-dietary-tags-2026-05/.
   *  String tags, not booleans. */
  tastes?: string[];
  /** Distance in metres from the search centre â€” used to estimate walk
   *  minutes without a routing API call. */
  distance?: number;
  /** TB-16 (quiz redesign) â€” reputation-axis metadata. `rating` is Foursquare's
   *  0..10 quality score; `stats.total_ratings` is the volume signal;
   *  `date_created` is the ISO-8601 record-creation date. All optional â€”
   *  coverage is uneven across venues, per the foursquare-filter-surface
   *  research Â§4. The shaper passes whatever is present straight through
   *  for the mobile `Q5VenueClassifier` to bucket pool-relatively. */
  rating?: number;
  stats?: { total_ratings?: number; total_tips?: number };
  date_created?: string;
}

export interface FoursquareCategory {
  /** Foursquare taxonomy category id. The post-2025 surface returns
   *  this as `fsq_category_id` (a 24-char hex string, e.g.
   *  `4bf58dd8d48988d1c1941735`) â€” it was `id` on the legacy v3 API. */
  fsq_category_id?: string;
  name: string;
  short_name?: string;
}

export interface FoursquarePhoto {
  prefix: string;
  suffix: string;
}

/** Canonical mapping from the Q1 chip set (per PRD Â§"Quiz copy") to the
 *  Foursquare signal that pre-filters the candidate pool. Mapping
 *  decisions are sourced from
 *  gti-vault/60_engineering/research/foursquare-dietary-tags-2026-05/report.md
 *  recommendation "Option C" â€” narrow to what Foursquare reliably exposes.
 *
 *  Strategy types:
 *  - `category`: pass a Foursquare category id in `fsq_category_ids` so
 *    the search is pre-filtered server-side.
 *  - `tastes`: filter post-fetch on the `tastes` field (Foursquare does
 *    not expose a server-side `tastes` filter in the free tier).
 *  - `disclaimer`: the chip carries no machine-filter â€” the verdict
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
    // Halal-only â€” single high-confidence category in Foursquare taxonomy.
    // Live-probed hex taxonomy id (2026-05-17).
    chip: "halal",
    strategy: "category",
    fsq_category_ids: "52e81612bcbc57f1066b79ff",
    emit_tag: "halal",
  },
  {
    // Kosher â€” category-level, geographically concentrated but reliable.
    // Live-probed hex taxonomy id (2026-05-17).
    chip: "kosher",
    strategy: "category",
    fsq_category_ids: "52e81612bcbc57f1066b79fc",
    emit_tag: "kosher",
  },
  {
    // Vegan options â€” category undercounts omnivore venues that serve
    // vegan dishes; the report (Option C) accepts the undercount and
    // surfaces a disclaimer on the verdict rule chip downstream.
    // Foursquare merged vegan + vegetarian into ONE taxonomy category
    // ("Vegan and Vegetarian Restaurant"), so vegan and vegetarian
    // share the same `fsq_category_ids` â€” a venue in it emits BOTH tags.
    chip: "vegan",
    strategy: "category",
    fsq_category_ids: "4bf58dd8d48988d1d3941735",
    emit_tag: "vegan_friendly",
  },
  {
    // Vegetarian â€” shares Foursquare's merged Vegan/Vegetarian category
    // (see the vegan entry above).
    chip: "vegetarian",
    strategy: "category",
    fsq_category_ids: "4bf58dd8d48988d1d3941735",
    emit_tag: "vegetarian_friendly",
  },
  {
    // Gluten-free â€” no category signal. Tag emerges in `tastes` on a
    // subset of venues. We filter post-fetch and emit the tag so the
    // engine can match against per-member Q1 vetoes.
    chip: "gluten",
    strategy: "tastes",
    taste_tokens: ["gluten-free", "gluten free", "gluten free options"],
    emit_tag: "gluten_free_options",
  },
  {
    // Dairy / shellfish / nuts â€” Foursquare exposes NO kitchen-protocol
    // signal. Lock 1 update pending product-owner review (see report
    // Â§spec-change-proposal). Until the lock changes, surface a
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

/** "Nothing tonight" is a mutually-exclusive escape per PRD user story 18 â€”
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

/** Mapping from a Q1 `QuizCuisine` id to the Foursquare taxonomy
 *  category id used to scope a per-cuisine fetch call (tb-17).
 *
 *  Unlike `DIETARY_CHIP_MAP` (a hard NEED â€” a vegan cannot eat at a
 *  steakhouse), cuisine is a soft WANT. It is therefore applied only to
 *  the *individual* per-cuisine call, never to the mandatory general
 *  call, so the fetch as a whole is never cuisine-strict-filtered
 *  (research-01 Â§3.2 + tb-07/tb-17 tickets).
 *
 *  Category-id sourcing: every id below is a 24-char hex Foursquare
 *  taxonomy id, live-probed against `/places/search` on 2026-05-17 â€”
 *  each confirmed to return HTTP 200 with results when passed as
 *  `fsq_category_ids`. The legacy short numeric ids (e.g. `13303`) were
 *  a free-tier-era guess; the post-2025 surface rejects them with
 *  HTTP 400, which the proxy was silently swallowing into an empty
 *  result set. They were replaced wholesale in the 2026-05-17 fix.
 */
export interface CuisineCategoryMapping {
  /** `QuizCuisine` id as emitted by the iOS Q1 surface. Lowercased +
   *  trimmed on input. */
  cuisine: string;
  /** Foursquare taxonomy category id for the cuisine's restaurant
   *  category. Passed verbatim in `fsq_category_ids`. */
  fsq_category_id: string;
}

export const CUISINE_CATEGORY_MAP: readonly CuisineCategoryMapping[] = Object
  .freeze([
    { cuisine: "mexican", fsq_category_id: "4bf58dd8d48988d1c1941735" },
    { cuisine: "italian", fsq_category_id: "4bf58dd8d48988d110941735" },
    { cuisine: "japanese", fsq_category_id: "4bf58dd8d48988d111941735" },
    { cuisine: "chinese", fsq_category_id: "4bf58dd8d48988d145941735" },
    { cuisine: "thai", fsq_category_id: "4bf58dd8d48988d149941735" },
    { cuisine: "indian", fsq_category_id: "4bf58dd8d48988d10f941735" },
    { cuisine: "american", fsq_category_id: "4bf58dd8d48988d14e941735" },
    { cuisine: "mediterranean", fsq_category_id: "4bf58dd8d48988d1c0941735" },
  ]);

/** The candidate-pool floor (ADR 0012) â€” the venue-type allowlist seeded
 *  onto any Foursquare call whose `fsq_category_ids` set is otherwise
 *  empty. This is the single, named, exported source of truth for "which
 *  venue types are eligible candidates"; the bug it closes existed
 *  because two code paths each decided that independently.
 *
 *  The eight members are `Dining and Drinking` subcategories whose
 *  primary purpose is eating a meal. `Sports Bar` is the single
 *  deliberate carve-out from the `Bar` branch (people eat full meals at
 *  sports bars). Food Court / Truck / Stand / Cafeteria / Breakfast Spot
 *  / Bagel Shop sit *outside* the `Restaurant` category as siblings
 *  under `Dining and Drinking`, so each is listed explicitly â€” a
 *  `Restaurant` parent filter does not reach them.
 *
 *  Category-id sourcing: every id is a 24-char hex Foursquare taxonomy
 *  id, live-probed against `/places/search` on 2026-05-19 â€” each
 *  returned HTTP 200. `Food Stand` returned zero rows at the probe
 *  geos (a genuinely sparse category, not an invalid id). The
 *  `Restaurant` id below is the *parent* category id and was confirmed
 *  descendant-inclusive on the post-2025 surface: a parent-only search
 *  returned venues tagged with cuisine-child category ids (Japanese,
 *  Italian, Chinese, American â€” all in `CUISINE_CATEGORY_MAP`), so the
 *  cuisine children need not be enumerated. See ADR 0012 Open items.
 *
 *  Seeded as a *fallback, never an addition*: `fsq_category_ids` is OR
 *  semantics, so appending the floor to a per-cuisine call would
 *  OR-broaden it straight back to all restaurants. `buildFoursquareQuery`
 *  seeds the floor only when the assembled set is empty. */
export const CANDIDATE_POOL_FLOOR_CATEGORY_IDS: readonly string[] = Object
  .freeze([
    "4d4b7105d754a06374d81259", // Restaurant (parent â€” descendant-inclusive)
    "4bf58dd8d48988d11d941735", // Sports Bar
    "4bf58dd8d48988d120951735", // Food Court
    "4bf58dd8d48988d1cb941735", // Food Truck
    "5283c7b4e4b094cb91ad6b1b", // Food Stand
    "4bf58dd8d48988d128941735", // Cafeteria
    "4bf58dd8d48988d143941735", // Breakfast Spot
    "4bf58dd8d48988d179941735", // Bagel Shop
  ]);

/** Shape-time primary-class gate â€” companion to the query-time
 *  `CANDIDATE_POOL_FLOOR_CATEGORY_IDS` (ADR 0012). The floor is an
 *  OR allowlist on `fsq_category_ids`; it cannot exclude a multi-category
 *  venue whose primary tag is `Bar` but which also carries a meal
 *  category (Robert's Western World, `["Bar","Burger Joint","Rock Club"]`
 *  matched the floor's Restaurant parent via Burger Joint and rode into
 *  the pool with `Bar` as `categories[0]`, which the iOS verdict surface
 *  renders verbatim). bug-15 adds a shape-time gate enforced in
 *  `shapeFoursquareResult` on the human category names. ADR 0012 amended.
 *
 *  `NIGHTLIFE_CATEGORY_NAMES` â€” Foursquare's "Bar"-branch and beverage-
 *  primary venue names, lower-cased for case-insensitive matching.
 *  `Sports Bar` and `Gastropub` are the two explicit carve-outs (people
 *  eat full meals there) â€” ADR 0012 carved Sports Bar out of the floor
 *  on the query side; the 2026-05-19 amendment carves Gastropub out
 *  symmetrically here.
 *
 *  `ENTERTAINMENT_VENUE_CATEGORY_NAMES` â€” the entertainment-venue
 *  backstop set. A meal-primary venue can still be a functional
 *  entertainment complex (Pinewood Social, Ole Red, Commodore Grille);
 *  if its category set contains both a nightlife tag AND an
 *  entertainment-venue tag, the venue drops. */
export const NIGHTLIFE_CATEGORY_NAMES: readonly string[] = Object.freeze([
  "bar",
  "beer bar",
  "beer garden",
  "brewery",
  "champagne bar",
  "cocktail bar",
  "dive bar",
  "hookah bar",
  "hotel bar",
  "karaoke bar",
  "lounge",
  "pub",
  "sake bar",
  "speakeasy",
  "tiki bar",
  "whisky bar",
  "wine bar",
  // Sports Bar + Gastropub are deliberately NOT here â€” meal-class
  // carve-outs (ADR 0012 amendment 2026-05-19).
]);

export const ENTERTAINMENT_VENUE_CATEGORY_NAMES: readonly string[] = Object
  .freeze([
    "music venue",
    "rock club",
    "night club",
    "bowling alley",
    "stadium",
  ]);

/** Apply the bug-15 primary-class gate + entertainment-venue backstop to a
 *  Foursquare category-name list. Returns `true` when the venue is
 *  eligible (keep), `false` when it should drop.
 *
 *  Rules (both must hold to keep):
 *    1. Primary-class gate â€” `categories[0]` is not a nightlife name and
 *       not an entertainment-venue name.
 *    2. Entertainment-venue backstop â€” the category set does not contain
 *       BOTH a nightlife name AND an entertainment-venue name.
 *
 *  Empty / missing category list is kept (taxonomy-drift guard â€” the
 *  query-time floor already constrained it). An unrecognised primary
 *  string is kept for the same reason. */
export function shouldKeepByVenueClass(categoryNames: readonly string[]): boolean {
  if (categoryNames.length === 0) return true;
  const nightlife = new Set(NIGHTLIFE_CATEGORY_NAMES);
  const entertainment = new Set(ENTERTAINMENT_VENUE_CATEGORY_NAMES);
  const lc = categoryNames.map((n) => n.toLowerCase());

  // Rule 1 â€” primary class gate.
  const primary = lc[0];
  if (nightlife.has(primary) || entertainment.has(primary)) return false;

  // Rule 2 â€” entertainment-venue backstop.
  const hasNightlife = lc.some((n) => nightlife.has(n));
  const hasEntertainmentVenue = lc.some((n) => entertainment.has(n));
  if (hasNightlife && hasEntertainmentVenue) return false;

  return true;
}

/** Resolve a `QuizCuisine` id to its Foursquare category mapping.
 *  Case- and whitespace-tolerant; returns `undefined` for an unknown or
 *  empty id so the caller can degrade gracefully to the general query. */
export function findCuisineCategory(
  cuisine: string,
): CuisineCategoryMapping | undefined {
  const normalized = normalizeChip(cuisine);
  if (normalized.length === 0) return undefined;
  return CUISINE_CATEGORY_MAP.find((m) => m.cuisine === normalized);
}

/** Foursquare's accepted `open_at` shape: `[1-7]THHMM` â€” a weekday
 *  (1=Mon..7=Sun), a literal `T`, then a 24-hour wall-clock time. The
 *  hour band is `00`â€“`24` and the minute band `00`â€“`59`, matching the
 *  upstream 400 message (`expected [1-7]T[00-24][00-59]`). */
export const OPEN_AT_PATTERN = /^[1-7]T(2[0-4]|[01]\d)[0-5]\d$/;

/** Translate the proxy's input filters into the query parameters
 *  Foursquare's `/places/search` accepts. Returns the parameters split
 *  into `query` (sent on the wire) and `post_filters` (applied to the
 *  fetched results before shaping). */
export interface FoursquareQueryPlan {
  query: URLSearchParams;
  post_filters: {
    /** Taste-token requirement groups. Each inner array represents the
     *  synonym set for ONE dietary chip â€” the result must include AT
     *  LEAST ONE token from each group (groups AND'd, members OR'd).
     *  Empty outer array = no post-filter. */
    require_taste_tokens: string[][];
    /** Chips that produced no filter â€” surfaced to the client as
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
  // ll = "lat,lng" â€” Foursquare's accepted geo parameter.
  params.set("ll", `${input.lat},${input.lng}`);
  // radius is metres; Foursquare caps at 100000 but our PRD radius
  // tops out at 5 mi (~8047 m) per the soft-pref relax ladder.
  params.set("radius", String(Math.max(1, Math.floor(input.radius_meters))));
  // Limit page size â€” VerdictEngine consumes the first page as its
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
      // Unknown chip â€” record as disclaimer rather than silently drop.
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
          // One synonym group per chip â€” at least one synonym must hit.
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

  // Cuisine advisory tag (tb-17). Present only on a per-cuisine call of
  // the N+1 fan-out; the mandatory general call omits it and therefore
  // stays un-category-scoped. An unknown / absent value resolves to
  // `undefined` and is a no-op â€” the call degrades to the general query.
  if (filters.cuisine !== undefined) {
    const cuisineMapping = findCuisineCategory(filters.cuisine);
    if (cuisineMapping) {
      categoryIds.add(cuisineMapping.fsq_category_id);
    }
  }

  // Candidate-pool floor (tb-25 / ADR 0012). After assembling the
  // category-id set, seed the floor IF AND ONLY IF the set is empty:
  //   - per-cuisine call â†’ already carries the cuisine id â†’ floor NOT
  //     added (it is already inside the floor; appending would
  //     OR-broaden it back to all restaurants â€” `fsq_category_ids` is
  //     OR semantics).
  //   - general call â†’ set empty â†’ floor seeded.
  //   - dietary category chip â†’ already carries the dietary id â†’ floor
  //     NOT added (dietary is a hard veto, correctly narrower).
  // `fsq_category_ids` is therefore never emitted empty.
  if (categoryIds.size === 0) {
    for (const id of CANDIDATE_POOL_FLOOR_CATEGORY_IDS) {
      categoryIds.add(id);
    }
  }

  // Foursquare accepts a comma-separated list. We sort so the same
  // filter set produces the same wire string (cache key stability). The
  // set is always non-empty here â€” the floor guarantees it.
  params.set("fsq_category_ids", [...categoryIds].sort().join(","));

  if (filters.price_tier !== undefined) {
    const clamped = Math.max(1, Math.min(4, Math.floor(filters.price_tier)));
    // We cap, never floor â€” a Q2 answer of "Under $15" means
    // max_price = 1, allowing anything cheaper-or-equal.
    params.set("max_price", String(clamped));
  }

  // `open_at` is Foursquare's recurring weekday + local-time token
  // (`[1-7]THHMM`) â€” passed straight through, never a timestamp. A
  // malformed value is rejected upstream by `validateInput`; the
  // pattern guard here keeps the pure builder self-defending when it is
  // called directly (tests, `buildQuerySignature`).
  if (filters.open_at !== undefined && OPEN_AT_PATTERN.test(filters.open_at)) {
    params.set("open_at", filters.open_at);
  }

  // Ask Foursquare for the fields we actually consume â€” keeps the
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
      // TB-16 (quiz redesign) â€” reputation-axis metadata for the Q5 factorial.
      "rating",
      "stats",
      "date_created",
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
 *  combination. Same filters â†’ same signature regardless of dietary
 *  chip ordering. */
export function buildQuerySignature(input: PlacesProxyInput): string {
  const plan = buildFoursquareQuery(input);
  // The URLSearchParams.toString() output is already deterministic per
  // our explicit ordering above, but we strip `ll` because the geo
  // bucket is the cache's first key â€” the signature is the *non-geo*
  // half of the cache key.
  const params = new URLSearchParams(plan.query);
  params.delete("ll");
  // Carry the post-filter set in the signature so a different chip
  // set produces a different cache row even if all category ids fold
  // into the same Foursquare query.
  if (plan.post_filters.require_taste_tokens.length > 0) {
    // Stable canonicalisation â€” sort tokens within each group, then
    // sort groups, then join. Same chip set â†” same signature.
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
 *  for now â€” the column is named `geo_h3` per ADR 0002 to leave room for an
 *  h3 upgrade without a schema change.
 *
 *  Bucket size: ~0.005 deg â‰ˆ 555 m at the equator. Small enough that
 *  every cache hit returns places within the user's session radius;
 *  large enough that a city's worth of typical searches hits the same
 *  rows. */
export const GEO_BUCKET_DEGREES = 0.005;

export function computeGeoBucket(lat: number, lng: number): string {
  const bucketLat = Math.round(lat / GEO_BUCKET_DEGREES) * GEO_BUCKET_DEGREES;
  const bucketLng = Math.round(lng / GEO_BUCKET_DEGREES) * GEO_BUCKET_DEGREES;
  return `${bucketLat.toFixed(4)}_${bucketLng.toFixed(4)}`;
}

/** Walking-pace estimate â€” 80 m / minute, rounded up. Pace sourced
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
 *  modest "original" rendition â€” clients can re-scale via the URL
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
    c.fsq_category_id !== undefined ? [c.fsq_category_id] : []
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
 *  meaningfully default â€” those rows are skipped rather than emitted
 *  with placeholder data. */
export function shapeFoursquareResult(
  result: FoursquareSearchResult,
  emittedTags: string[],
): ShapedPlace | null {
  if (!result.fsq_place_id || !result.name) return null;
  if (result.latitude === undefined || result.longitude === undefined) return null;

  // bug-15 â€” shape-time primary-class gate + entertainment-venue
  // backstop. Drops bars whose primary tag is `Bar` (Robert's Western
  // World, etc.) and food-primary entertainment complexes (Pinewood
  // Social, Ole Red) that the query-time floor cannot exclude. ADR 0012
  // amendment 2026-05-19.
  const categoryNames = (result.categories ?? []).map((c) => c.name);
  if (!shouldKeepByVenueClass(categoryNames)) return null;

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
    // TB-16 (quiz redesign) â€” reputation-axis metadata. Pass whatever Foursquare
    // returned straight through; a venue with no reputation data shapes
    // as `null` on every field. The mobile `Q5VenueClassifier` buckets
    // these pool-relatively for the Q5 factorial's reputation axis.
    rating: typeof result.rating === "number" ? result.rating : null,
    total_ratings: typeof result.stats?.total_ratings === "number"
      ? result.stats.total_ratings
      : null,
    date_created: result.date_created ?? null,
    // TB-18 (quiz redesign) â€” vibe-axis signal. Pass the raw `tastes` tag cloud
    // through verbatim (lower-casing and allowlist matching happen
    // client-side in the iOS Q5VenueClassifier). Absent `tastes`
    // shapes as `[]`.
    tastes: result.tastes ?? [],
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

/** Thin-results threshold â€” when fewer than this number of usable rows
 *  come back, the mobile client treats the response as a MapKit-fallback
 *  trigger per ADR 0002. We expose the constant rather than baking it
 *  in so test fixtures can reference the same value. */
export const THIN_RESULTS_THRESHOLD = 3;
