// GetToIt web — per-member Q5 candidate fetch (tb-WF-10).
//
// Brings the web fallback's Q5 to quiz-redesign parity. The pre-redesign web quiz
// rendered a fixed `DUMMY_CANDIDATES` fixture; this module replaces it
// with the real per-member Foursquare fetch + the strict-factorial Q5
// probe, mirroring the mobile app path. Legacy Swift source references
// below are historical; active mobile implementation lives in `mobile/`:
//
//   QuizCandidateFetch        (legacy Swift ios/Sources/App/QuizCandidateFetch.swift)
//   FoursquareFetchPlanner    (legacy Swift ios/Sources/App/FoursquareFetchPlanner.swift)
//   Q5VenueClassifier         (legacy Swift ios/Sources/App/Q5VenueClassifier.swift)
//   Q5FactorialCardGenerator  (legacy Swift ios/Sources/App/Q5FactorialCardGenerator.swift)
//
// Web differs from the mobile app in one place (ADR 0002): the web client has no
// MapKit escape hatch, so a thin / failed Foursquare response degrades
// straight to the no-results path — there is no second data source.
//
// rather than importing it; only the vote WIRE shape is a sanctioned
// cross-sibling import (ADR 0014, `votes-wire.ts`). The factorial /
// product logic ported here so the web quiz produces the same Q5 probe
// shape the mobile app does.
//
// HONEST DEGRADATION (ADR 0013): when the fetch produces no
// factorial-usable pool the result is an EMPTY candidate list with the
// `no-results` source. The web quiz never renders a fictitious venue.

import type { Q5Rating } from "../../supabase/functions/_shared/votes-wire";

// -----------------------------------------------------------------------
// Wire types — the slice of `places-proxy`'s `ShapedPlace` this path
// reads. Kept minimal and defensively typed so a malformed venue is
// skipped rather than crashing the fetch.
// -----------------------------------------------------------------------

/** A venue as returned by the `places-proxy` Edge Function — the
 *  fields the classifier + Q5 surface read. */
export interface FetchedVenue {
  fsq_place_id: string;
  name: string;
  price_tier: number | null;
  walk_minutes_estimate: number | null;
  categories: string[];
  rating: number | null;
  total_ratings: number | null;
  date_created: string | null;
  tastes: string[];
}

/** The `places-proxy` POST response envelope. */
export interface PlacesProxyResponse {
  places: FetchedVenue[];
  is_thin: boolean;
  error?: string;
}

/** The session parameters slice the fetch planner reads — mirrors the
 *  legacy Swift `SessionParameters` meal-time field (the only one that drives a
 *  fetch filter). Defaults to `dinner` when `rooms.session_params` is
 *  absent (a room created before the parameters surface). */
export type MealTime = "breakfast" | "lunch" | "dinner" | "late_night";

/** A planned `places-proxy` call. N+1 of these run in parallel. */
export interface PlacesProxyRequest {
  lat: number;
  lng: number;
  radius_meters: number;
  filters: {
    price_tier: number;
    open_at: string;
    /** The advisory per-cuisine tag — absent on the general call. */
    cuisine?: string;
  };
}

// -----------------------------------------------------------------------
// Q5 factorial axis types — mirror legacy Swift `Q5FactorialCard.Axis` etc.
// -----------------------------------------------------------------------

export type Axis = "cuisine" | "reputation" | "vibe";
const ALL_AXES: readonly Axis[] = ["cuisine", "reputation", "vibe"];

/** A venue's position on the three Q5 axes. */
export interface VenueProfile {
  /** A `CUISINE_OPTIONS` id, or `null` when no category classifies. */
  cuisine: string | null;
  /** A reputation bucket — never `no_preference` (a member answer). */
  reputation: string;
  /** Vibe energy, 0..4. */
  vibe: number;
}

/** A fetched venue paired with its classified axis profile. */
export interface PoolVenue {
  place: FetchedVenue;
  profile: VenueProfile;
}

/** The member's stated Q1/Q3/Q4 profile — the axes the factorial
 *  deviates against. */
export interface MemberProfile {
  cuisines: string[];
  reputation: string;
  vibe: number;
}

/** One Q5 card the surface renders — a real venue, tagged with the
 *  factorial axis it deviates on. `meta` is the dot-delimited
 *  cuisine/$/walk line. */
export interface QuizCandidate {
  id: string;
  name: string;
  meta: string;
  droppedAxis: Axis;
}

/** The outcome of a per-member candidate fetch. */
export interface CandidateFetchResult {
  /** The three factorial Q5 cards — empty on the `no-results` source. */
  candidates: QuizCandidate[];
  /** Where the candidate list came from. `fetched` = three real cards;
   *  `no-results` = no factorial-usable pool (honest degradation). */
  source: "fetched" | "no-results";
  /** The member's full raw fetched venue union — every venue the N+1
   *  calls returned, deduped. Persisted into `member_fetches` so the
   *  server can union it into the verdict's `options` pool. Non-empty
   *  even on `no-results` when the union was real venues merely too
   *  thin / uniform for the factorial. */
  rawFetch: FetchedVenue[];
}

// -----------------------------------------------------------------------
// Fetch planner — N+1 `places-proxy` call specs (mirrors the mobile app
// FoursquareFetchPlanner). One per craved cuisine + one mandatory
// general call.
// -----------------------------------------------------------------------

/** The planner cap on craved-cuisine calls — re-asserts Q1's 3-cap. */
export const MAX_CUISINE_CALLS = 3;

/** The local hour each meal resolves to — chosen to sit inside the
 *  meal's service window. Mirrors `FoursquareFetchPlanner.representativeHour`. */
const REPRESENTATIVE_HOUR: Record<MealTime, { hour: number; minute: number }> = {
  breakfast: { hour: 9, minute: 0 },
  lunch: { hour: 12, minute: 30 },
  dinner: { hour: 19, minute: 0 },
  late_night: { hour: 22, minute: 30 },
};

/** Resolve a meal time to a Foursquare `open_at` token — `[1-7]THHMM`,
 *  a recurring weekday + venue-local wall-clock time. The weekday + hour
 *  are computed in `timeZone` (the search area's zone), because
 *  Foursquare interprets `open_at` in the venue's local time. Mirrors
 *  `FoursquareFetchPlanner.openAtToken`.
 *
 *  Foursquare's weekday is `1=Mon … 7=Sun`; JS `getDay()` is
 *  `0=Sun … 6=Sat`. The conversion maps Sun(0) ? 7, Mon(1) ? 1, …. */
export function openAtToken(
  mealTime: MealTime,
  now: Date,
  timeZone: string,
): string {
  const slot = REPRESENTATIVE_HOUR[mealTime];
  // Resolve the weekday in the search-area timezone.
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone,
  }).format(now);
  const jsDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    weekdayName,
  );
  const foursquareDay = jsDay === 0 ? 7 : jsDay;
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${foursquareDay}T${pad(slot.hour)}${pad(slot.minute)}`;
}

/** Plan the N+1 `places-proxy` call specs for one member.
 *  - N category-tagged calls — one per craved cuisine (deduped, capped).
 *  - 1 mandatory general call — no cuisine tag (the bug-03 guard).
 *  Mirrors `FoursquareFetchPlanner.plan`. */
export function planCalls(args: {
  cuisines: string[];
  budgetTier: number;
  mealTime: MealTime;
  lat: number;
  lng: number;
  radiusMeters: number;
  timeZone: string;
  now?: Date;
}): PlacesProxyRequest[] {
  const priceCap = Math.max(1, Math.min(4, Math.round(args.budgetTier)));
  const openAt = openAtToken(args.mealTime, args.now ?? new Date(), args.timeZone);

  // De-duplicate the craved cuisines, order-preserving, capped.
  const seen = new Set<string>();
  const craved: string[] = [];
  for (const c of args.cuisines) {
    if (!c || seen.has(c)) continue;
    seen.add(c);
    craved.push(c);
    if (craved.length === MAX_CUISINE_CALLS) break;
  }

  const base = {
    lat: args.lat,
    lng: args.lng,
    radius_meters: args.radiusMeters,
  };
  const specs: PlacesProxyRequest[] = craved.map((cuisine) => ({
    ...base,
    filters: { price_tier: priceCap, open_at: openAt, cuisine },
  }));
  // The mandatory general call — always appended, no cuisine tag.
  specs.push({ ...base, filters: { price_tier: priceCap, open_at: openAt } });
  return specs;
}

// -----------------------------------------------------------------------
// Venue classifier — `FetchedVenue -> VenueProfile` (mirrors legacy Swift
// Q5VenueClassifier; thresholds kept byte-identical with the legacy Swift /
// server-side `venue-classifier.ts`).
// -----------------------------------------------------------------------

const POPULAR_RATING_FLOOR = 7.0;
const HIDDEN_GEM_RATING_FLOOR = 8.0;
const NEW_RECORD_MAX_AGE_DAYS = 365;
const CLASSIC_RECORD_MIN_AGE_DAYS = 365 * 3;
const VIBE_STOP_COUNT = 5;
const DEFAULT_VIBE_BASELINE = 2;

const CUISINE_KEYWORDS: Array<{ cuisine: string; fragments: string[] }> = [
  { cuisine: "mexican", fragments: ["mexican", "taqueria", "taco", "burrito"] },
  { cuisine: "italian", fragments: ["italian", "pizza", "pizzeria", "trattoria", "pasta"] },
  { cuisine: "japanese", fragments: ["japanese", "sushi", "ramen", "izakaya", "soba", "udon"] },
  { cuisine: "chinese", fragments: ["chinese", "dim sum", "szechuan", "sichuan", "cantonese", "noodle"] },
  { cuisine: "thai", fragments: ["thai"] },
  { cuisine: "indian", fragments: ["indian", "curry", "tandoor"] },
  { cuisine: "american", fragments: ["american", "burger", "diner", "steakhouse", "bbq", "barbecue"] },
  { cuisine: "mediterranean", fragments: ["mediterranean", "greek", "falafel", "kebab", "shawarma", "lebanese"] },
];

const VIBE_ARCHETYPES: Array<{ fragments: string[]; baseline: number }> = [
  { fragments: ["nightclub", "night club", "sports bar", "dance"], baseline: 4 },
  { fragments: ["bar", "pub", "gastropub", "brewery", "taproom", "wine bar", "cocktail"], baseline: 3 },
  { fragments: ["tea", "tea house", "tearoom", "library cafe"], baseline: 0 },
  { fragments: ["cafe", "café", "coffee", "bakery", "bistro", "creperie"], baseline: 1 },
  { fragments: ["restaurant", "diner", "eatery", "grill", "kitchen"], baseline: 2 },
];

const VIBE_TOKEN_ALLOWLIST: Record<string, number> = {
  crowded: 1, trendy: 1, "good for groups": 1, "happy hour": 1,
  "good for singles": 1, hipster: 1, "people watching": 1, dancing: 1,
  "live music": 1, lively: 1, loud: 1, "fun atmosphere": 1, nightclubs: 1,
  "night clubs": 1, "festive atmosphere": 1, noisy: 1,
  spacious: -1, "good for dates": -1, comfortable: -1, quiet: -1,
  "good for working": -1, "good for business meetings": -1,
  "comfortable seats": -1, cozy: -1, "cosy atmosphere": -1, "study area": -1,
  romantic: -1, "business meetings": -1, "quaint atmosphere": -1,
  "pleasant atmosphere": -1,
};

function cuisineOf(place: FetchedVenue): string | null {
  const haystack = place.categories.map((c) => c.toLowerCase());
  for (const entry of CUISINE_KEYWORDS) {
    for (const fragment of entry.fragments) {
      if (haystack.some((h) => h.includes(fragment))) return entry.cuisine;
    }
  }
  return null;
}

function tastesNudge(place: FetchedVenue): number {
  let sum = 0;
  for (const token of place.tastes) {
    sum += VIBE_TOKEN_ALLOWLIST[token.toLowerCase()] ?? 0;
  }
  if (sum > 0) return 1;
  if (sum < 0) return -1;
  return 0;
}

function clampVibe(value: number): number {
  return Math.min(Math.max(value, 0), VIBE_STOP_COUNT - 1);
}

function vibeOf(place: FetchedVenue): number {
  const haystack = place.categories.map((c) => c.toLowerCase());
  let baseline = DEFAULT_VIBE_BASELINE;
  let matched = false;
  for (const archetype of VIBE_ARCHETYPES) {
    if (
      archetype.fragments.some((f) => haystack.some((h) => h.includes(f)))
    ) {
      baseline = archetype.baseline;
      matched = true;
      break;
    }
  }
  const nudge = tastesNudge(place);
  if (nudge !== 0) return clampVibe(baseline + nudge);
  // Price tie-break — last-resort, unmatched archetype only.
  if (!matched && place.price_tier != null) {
    if (place.price_tier <= 1) baseline += 1;
    else if (place.price_tier >= 4) baseline -= 1;
  }
  return clampVibe(baseline);
}

function recordAgeDays(place: FetchedVenue, now: Date): number | null {
  if (!place.date_created) return null;
  const created = Date.parse(place.date_created);
  if (!Number.isFinite(created)) return null;
  const seconds = (now.getTime() - created) / 1000;
  if (seconds < 0) return 0;
  return seconds / 86_400;
}

interface VolumeTerciles {
  lowCeiling: number;
  highFloor: number;
}

function volumeTerciles(pool: FetchedVenue[]): VolumeTerciles {
  const volumes = pool.map((p) => p.total_ratings ?? 0).sort((a, b) => a - b);
  if (volumes.length === 0) {
    return { lowCeiling: 0, highFloor: Number.MAX_SAFE_INTEGER };
  }
  const lowIndex = Math.max(0, Math.floor((volumes.length - 1) / 3));
  const highIndex = Math.min(
    volumes.length - 1,
    Math.floor(((volumes.length - 1) * 2) / 3),
  );
  return { lowCeiling: volumes[lowIndex], highFloor: volumes[highIndex] };
}

function reputationOf(
  place: FetchedVenue,
  split: VolumeTerciles,
  now: Date,
): string {
  const ageDays = recordAgeDays(place, now);
  const volume = place.total_ratings ?? 0;
  const rating = place.rating;
  if (ageDays != null && ageDays <= NEW_RECORD_MAX_AGE_DAYS) return "new";
  const isHighVolume = volume >= split.highFloor && split.highFloor > 0;
  const isLowVolume = volume <= split.lowCeiling;
  if (isHighVolume && ageDays != null && ageDays >= CLASSIC_RECORD_MIN_AGE_DAYS) {
    return "classic";
  }
  if (isHighVolume && rating != null && rating >= POPULAR_RATING_FLOOR) {
    return "popular";
  }
  if (isLowVolume && rating != null && rating >= HIDDEN_GEM_RATING_FLOOR) {
    return "hidden_gem";
  }
  return "popular";
}

/** Classify a fetched venue pool into `PoolVenue`s — each venue paired
 *  with its three-axis profile. Reputation is pool-relative, so the
 *  whole pool is classified in one call. Mirrors
 *  `Q5VenueClassifier.classify`. */
export function classifyPool(
  pool: FetchedVenue[],
  now: Date = new Date(),
): PoolVenue[] {
  const split = volumeTerciles(pool);
  return pool.map((place) => ({
    place,
    profile: {
      cuisine: cuisineOf(place),
      reputation: reputationOf(place, split, now),
      vibe: vibeOf(place),
    },
  }));
}

// -----------------------------------------------------------------------
// Factorial card generator — mirrors legacy Swift Q5FactorialCardGenerator.
// Three cards, one per axis; each drops exactly one axis and matches the
// other two. `null` when the pool can't furnish a valid triple.
// -----------------------------------------------------------------------

/** The dot-delimited Q5 card meta line — mirrors
 *  `Q5CandidatesLoader.metaString`. */
function metaString(place: FetchedVenue): string {
  const segments: string[] = [];
  const cat = place.categories[0];
  if (cat) segments.push(cat);
  if (place.price_tier != null && place.price_tier >= 1 && place.price_tier <= 4) {
    segments.push("$".repeat(place.price_tier));
  }
  if (place.walk_minutes_estimate != null) {
    segments.push(`${place.walk_minutes_estimate} min`);
  }
  return segments.join(" · ");
}

/** Pick the (up to two) craved cuisines Q5 probes, by member-local pool
 *  feasibility. Mirrors `Q5FactorialCardGenerator.selectProbedCuisines`. */
function selectProbedCuisines(member: MemberProfile, pool: PoolVenue[]): string[] {
  if (member.cuisines.length === 0) return [];
  const support = new Map<string, number>();
  for (const c of member.cuisines) support.set(c, 0);
  for (const v of pool) {
    if (v.profile.cuisine != null && support.has(v.profile.cuisine)) {
      support.set(v.profile.cuisine, (support.get(v.profile.cuisine) ?? 0) + 1);
    }
  }
  // Rank by feasibility desc, ties broken by Q1 pick order (stable).
  const ranked = member.cuisines
    .map((cuisine, offset) => ({ cuisine, offset }))
    .sort((a, b) => {
      const sa = support.get(a.cuisine) ?? 0;
      const sb = support.get(b.cuisine) ?? 0;
      if (sa !== sb) return sb - sa;
      return a.offset - b.offset;
    });
  return ranked.slice(0, 2).map((r) => r.cuisine);
}

type CuisineRule =
  | { kind: "match"; target: string | null }
  | { kind: "deviate-from-all"; craved: string[] };
type ReputationRule =
  | { kind: "match"; target: string }
  | { kind: "deviate-from"; target: string };
type ValueRule = { kind: "match"; target: number } | { kind: "deviate-from"; target: number };

function cuisineSatisfies(rule: CuisineRule, cuisine: string | null): boolean {
  if (rule.kind === "match") {
    if (rule.target == null) return true;
    return cuisine === rule.target;
  }
  // deviate-from-all
  if (cuisine == null) return true;
  return !rule.craved.includes(cuisine);
}

function reputationSatisfies(rule: ReputationRule, reputation: string): boolean {
  if (rule.kind === "match") {
    if (rule.target === "no_preference") return true;
    return reputation === rule.target;
  }
  // deviate-from
  if (rule.target === "no_preference") return true;
  return reputation !== rule.target;
}

function vibeSatisfies(rule: ValueRule, vibe: number): boolean {
  return rule.kind === "match" ? vibe === rule.target : vibe !== rule.target;
}

function pickVenue(
  pool: PoolVenue[],
  used: Set<string>,
  cuisineRule: CuisineRule,
  reputationRule: ReputationRule,
  vibeRule: ValueRule,
): PoolVenue | null {
  for (const v of pool) {
    if (used.has(v.place.fsq_place_id)) continue;
    if (!cuisineSatisfies(cuisineRule, v.profile.cuisine)) continue;
    if (!reputationSatisfies(reputationRule, v.profile.reputation)) continue;
    if (!vibeSatisfies(vibeRule, v.profile.vibe)) continue;
    return v;
  }
  return null;
}

/** Generate the three strict-factorial Q5 cards — one cuisine-drop, one
 *  reputation-drop, one vibe-drop — or `null` when the pool can't
 *  furnish a valid triple. Mirrors `Q5FactorialCardGenerator.generate`. */
export function generateFactorialCards(
  member: MemberProfile,
  pool: PoolVenue[],
): QuizCandidate[] | null {
  const probed = selectProbedCuisines(member, pool);
  const cuisineForReputationDrop = probed[0] ?? null;
  const cuisineForVibeDrop = probed.length > 1 ? probed[1] : probed[0] ?? null;
  const used = new Set<string>();

  // Card 1 — cuisine-drop.
  const cuisineDrop = pickVenue(
    pool,
    used,
    { kind: "deviate-from-all", craved: member.cuisines },
    { kind: "match", target: member.reputation },
    { kind: "match", target: member.vibe },
  );
  if (!cuisineDrop) return null;
  used.add(cuisineDrop.place.fsq_place_id);

  // Card 2 — reputation-drop.
  const reputationDrop = pickVenue(
    pool,
    used,
    { kind: "match", target: cuisineForReputationDrop },
    { kind: "deviate-from", target: member.reputation },
    { kind: "match", target: member.vibe },
  );
  if (!reputationDrop) return null;
  used.add(reputationDrop.place.fsq_place_id);

  // Card 3 — vibe-drop.
  const vibeDrop = pickVenue(
    pool,
    used,
    { kind: "match", target: cuisineForVibeDrop },
    { kind: "match", target: member.reputation },
    { kind: "deviate-from", target: member.vibe },
  );
  if (!vibeDrop) return null;
  used.add(vibeDrop.place.fsq_place_id);

  return [
    toCandidate(cuisineDrop, "cuisine"),
    toCandidate(reputationDrop, "reputation"),
    toCandidate(vibeDrop, "vibe"),
  ];
}

function toCandidate(venue: PoolVenue, droppedAxis: Axis): QuizCandidate {
  return {
    id: venue.place.fsq_place_id,
    name: venue.place.name,
    meta: metaString(venue.place),
    droppedAxis,
  };
}

// -----------------------------------------------------------------------
// Union + selection — classify the union, run the factorial.
// -----------------------------------------------------------------------

/** Union the N+1 call results, deduped first-seen by `fsq_place_id`,
 *  then classify + run the factorial. Mirrors
 *  `FoursquareQuizCandidateFetch.selectFactorialCards`. */
export function selectCandidates(
  union: FetchedVenue[],
  member: MemberProfile,
  now: Date = new Date(),
): CandidateFetchResult {
  const profiled = classifyPool(union, now);
  const cards = generateFactorialCards(member, profiled);
  if (cards == null) {
    // Pool starvation — honest degradation. The raw union still rides
    // through so the verdict pool gets the real (if thin) venues.
    return { candidates: [], source: "no-results", rawFetch: union };
  }
  return { candidates: cards, source: "fetched", rawFetch: union };
}

/** Union a list of `places-proxy` responses, deduped first-seen by
 *  `fsq_place_id`. A malformed venue (no id) is skipped. */
export function unionResponses(responses: PlacesProxyResponse[]): FetchedVenue[] {
  const seen = new Set<string>();
  const union: FetchedVenue[] = [];
  for (const response of responses) {
    for (const venue of response.places ?? []) {
      const id = venue?.fsq_place_id;
      if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
      seen.add(id);
      union.push(venue);
    }
  }
  return union;
}

// -----------------------------------------------------------------------
// The per-member fetch — fires the N+1 `places-proxy` calls.
// -----------------------------------------------------------------------

/** A function that POSTs one `places-proxy` request and resolves the
 *  response. Injected so tests can drive the fetch without the network. */
export type PlacesProxyCaller = (
  req: PlacesProxyRequest,
) => Promise<PlacesProxyResponse>;

/** The room-level fetch inputs the web `SessionRoom` reads off the
 *  `rooms` row. `coordinate` is null when the room carries no location
 *  (a stale routing) — the fetch then resolves straight to no-results. */
export interface SessionFetchContext {
  lat: number | null;
  lng: number | null;
  radiusMeters: number;
  timeZone: string;
  mealTime: MealTime;
}

/** Run a member's per-member candidate fetch end to end: plan the N+1
 *  calls, fire them in parallel, union, classify, run the factorial.
 *
 *  Never throws — a failed / empty / too-thin fetch resolves to the
 *  `no-results` source with an empty candidate list, so Q5 renders the
 *  no-results screen and the member is never stranded (ADR 0013). */
export async function fetchMemberCandidates(args: {
  member: MemberProfile;
  budgetTier: number;
  context: SessionFetchContext;
  caller: PlacesProxyCaller;
  now?: Date;
}): Promise<CandidateFetchResult> {
  const { context } = args;
  // No coordinate — there is nothing to fetch against.
  if (context.lat == null || context.lng == null) {
    return { candidates: [], source: "no-results", rawFetch: [] };
  }
  const specs = planCalls({
    cuisines: args.member.cuisines,
    budgetTier: args.budgetTier,
    mealTime: context.mealTime,
    lat: context.lat,
    lng: context.lng,
    radiusMeters: context.radiusMeters,
    timeZone: context.timeZone,
    now: args.now,
  });
  let responses: PlacesProxyResponse[];
  try {
    responses = await Promise.all(specs.map((spec) => args.caller(spec)));
  } catch {
    // The whole fetch threw — degrade to no-results. The web client has
    // no MapKit fallback (ADR 0002), so a thrown fetch is terminal.
    return { candidates: [], source: "no-results", rawFetch: [] };
  }
  const union = unionResponses(responses);
  return selectCandidates(union, args.member, args.now ?? new Date());
}

// -----------------------------------------------------------------------
// Q5 ratings assembly — venue-keyed ratings ? factorial probe.
// -----------------------------------------------------------------------

/** Seed Q5 ratings at the spec'd midpoint (3) so each card renders with
 *  a chosen state. Mirrors `QuizCoordinator.seededRatings`. */
export function seedRatings(
  candidates: ReadonlyArray<QuizCandidate>,
): Record<string, number> {
  const seed: Record<string, number> = {};
  for (const c of candidates) seed[c.id] = 3;
  return seed;
}

/** Assemble the Q5 factorial probe — one `{ droppedAxis, score }` entry
 *  per candidate — from the venue-keyed ratings map and each
 *  candidate's `droppedAxis`. Mirrors `QuizCoordinator.buildQ5Ratings`.
 *
 *  A candidate with no `droppedAxis` (a non-factorial fixture) is
 *  assigned an axis positionally so the probe stays well-formed. On the
 *  no-results path the candidate list is empty, so this returns `[]` —
 *  `compute-verdict` tolerates the empty probe (equal-weight prior). */
export function buildQ5Ratings(
  candidates: ReadonlyArray<QuizCandidate>,
  ratings: Record<string, number>,
): Q5Rating[] {
  return candidates.map((candidate, index) => ({
    droppedAxis: candidate.droppedAxis ?? ALL_AXES[index % ALL_AXES.length],
    score: ratings[candidate.id] ?? 3,
  }));
}
