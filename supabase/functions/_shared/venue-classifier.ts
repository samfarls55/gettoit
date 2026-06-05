// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// VenueClassifier â€” the `CandidateOption -> Q5VenueProfile` axis
// classification (TB-23 quiz redesign, PRD module E live wiring, server side).
//
// A faithful TypeScript port of the legacy Swift `Q5VenueClassifier`
// (`legacy Swift ios/Sources/App/Q5VenueClassifier.swift`, TB-16). The legacy Swift app
// classifies a fetched venue pool on device; bug-08 locked the
// server-side fork (Option 2) â€” the candidate-pool union and the
// preference scoring run server-side at verdict fire time. The verdict
// path is TypeScript, so the venue classification has to live here too,
// alongside the ported preference function (`preference-function.ts`,
// TB-22).
//
// The classifier turns a real fetched venue (`CandidateOption`, carrying
// the slice of `options.payload` the engine + classifier read) into its
// position on the three Q5 preference axes:
//
//   * Cuisine    â€” set membership over `categories[]` matched against
//                  the QuizCuisine keyword vocabulary; `null` when no
//                  category matches.
//   * Vibe       â€” a category-archetype baseline (0..4 Quiet..Rowdy),
//                  a curated `tastes`-token nudge (Â±1), and `price_tier`
//                  as a last-resort tie-break.
//   * Reputation â€” a pool-relative bucketing over `total_ratings`
//                  (volume), `rating` (quality), and `date_created`
//                  (age).
//
// Reputation is pool-relative â€” the volume terciles are derived from
// the fetched pool, not a global constant â€” so classification is a
// pool-level call (`classifyVenuePool`), not a per-venue one.
//
// Pure: no I/O, no clock, no randomness. The `date_created` age check
// needs a reference "now"; it is an injected parameter (defaulting to
// `new Date()`) so tests stay deterministic.
//
// Cohort-zero thresholds (rating floors, tercile split, age cutoffs)
// are tunable post-cohort, kept byte-identical with the Swift module so
// the ported behaviour reproduces the Swift classification.

import type { CandidateOption } from "./verdict-engine.ts";
import type { Q5VenueProfile } from "./preference-function.ts";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Cohort-zero thresholds (tunable post-cohort â€” research Â§4)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** A venue is "well-rated enough to be Popular" at or above this
 *  `rating` (Foursquare's 0..10 scale). */
const POPULAR_RATING_FLOOR = 7.0;
/** A venue is "excellent enough to be a Hidden gem" at or above this
 *  `rating` â€” a higher bar than Popular. */
const HIDDEN_GEM_RATING_FLOOR = 8.0;
/** A venue whose Foursquare record is younger than this many days
 *  classifies as `new`. */
const NEW_RECORD_MAX_AGE_DAYS = 365;
/** A high-volume venue whose record is older than this many days
 *  classifies as `classic` rather than `popular`. */
const CLASSIC_RECORD_MIN_AGE_DAYS = 365 * 3;

/** The number of stops on the vibe energy scale (Quiet..Rowdy). Mirrors
 *  `GTIVibeLabels.all.count`. */
const VIBE_SCALE_STOPS = 5;

// QuizReputation ids â€” mirror the legacy Swift `QuizReputation` constants.
const REP_POPULAR = "popular";
const REP_HIDDEN_GEM = "hidden_gem";
const REP_CLASSIC = "classic";
const REP_NEW = "new";

// QuizCuisine ids â€” mirror the legacy Swift `QuizCuisine` constants.
const CUISINE_MEXICAN = "mexican";
const CUISINE_ITALIAN = "italian";
const CUISINE_JAPANESE = "japanese";
const CUISINE_CHINESE = "chinese";
const CUISINE_THAI = "thai";
const CUISINE_INDIAN = "indian";
const CUISINE_AMERICAN = "american";
const CUISINE_MEDITERRANEAN = "mediterranean";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Cuisine axis â€” keyword set membership over categories
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Keyword fragments that identify each `QuizCuisine` inside a
 *  Foursquare category name. Matching is case-insensitive substring;
 *  the first cuisine with any matching fragment wins. Mirrors the Swift
 *  `cuisineKeywords` table verbatim. */
const CUISINE_KEYWORDS: ReadonlyArray<{ cuisine: string; fragments: string[] }> = [
  { cuisine: CUISINE_MEXICAN, fragments: ["mexican", "taqueria", "taco", "burrito"] },
  { cuisine: CUISINE_ITALIAN, fragments: ["italian", "pizza", "pizzeria", "trattoria", "pasta"] },
  { cuisine: CUISINE_JAPANESE, fragments: ["japanese", "sushi", "ramen", "izakaya", "soba", "udon"] },
  { cuisine: CUISINE_CHINESE, fragments: ["chinese", "dim sum", "szechuan", "sichuan", "cantonese", "noodle"] },
  { cuisine: CUISINE_THAI, fragments: ["thai"] },
  { cuisine: CUISINE_INDIAN, fragments: ["indian", "curry", "tandoor"] },
  { cuisine: CUISINE_AMERICAN, fragments: ["american", "burger", "diner", "steakhouse", "bbq", "barbecue"] },
  { cuisine: CUISINE_MEDITERRANEAN, fragments: ["mediterranean", "greek", "falafel", "kebab", "shawarma", "lebanese"] },
];

/** The venue's cuisine â€” a `QuizCuisine` id derived from its
 *  `categories[]`, or `null` when no category matches a known cuisine. */
function cuisineOf(categories: string[]): string | null {
  const haystack = categories.map((c) => c.toLowerCase());
  for (const entry of CUISINE_KEYWORDS) {
    for (const fragment of entry.fragments) {
      if (haystack.some((cat) => cat.includes(fragment))) {
        return entry.cuisine;
      }
    }
  }
  return null;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Vibe axis â€” category archetype baseline + tastes nudge + price
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Category-archetype keyword â†’ baseline vibe (0..4 Quiet..Rowdy).
 *  Scanned in order; the first matching archetype wins. Mirrors the
 *  legacy Swift `vibeArchetypes` table verbatim. */
const VIBE_ARCHETYPES: ReadonlyArray<{ fragments: string[]; baseline: number }> = [
  // Rowdy (4) â€” nightlife-forward.
  { fragments: ["nightclub", "night club", "sports bar", "dance"], baseline: 4 },
  // Lively (3) â€” bar-forward, social-drinking energy.
  { fragments: ["bar", "pub", "gastropub", "brewery", "taproom", "wine bar", "cocktail"], baseline: 3 },
  // Quiet (0) â€” calm, low-energy.
  { fragments: ["tea", "tea house", "tearoom", "library cafe"], baseline: 0 },
  // Chill (1) â€” relaxed daytime.
  { fragments: ["cafe", "cafÃ©", "coffee", "bakery", "bistro", "creperie"], baseline: 1 },
  // Social (2) â€” the default sit-down restaurant energy.
  { fragments: ["restaurant", "diner", "eatery", "grill", "kitchen"], baseline: 2 },
];

/** The baseline vibe with no category match â€” the mid-scale Social
 *  level. */
const DEFAULT_VIBE_BASELINE = 2;

/** Curated Foursquare `tastes` vibe-token allowlist â€” transcribed from
 *  the research-02 deliverable. Each token is direction-only: `+1`
 *  loud-leaning, `-1` quiet-leaning. Mirrors the Swift
 *  `vibeTokenAllowlist` table verbatim. */
const VIBE_TOKEN_ALLOWLIST: Readonly<Record<string, number>> = {
  // Loud-leaning (+1).
  "crowded": 1,
  "trendy": 1,
  "good for groups": 1,
  "happy hour": 1,
  "good for singles": 1,
  "hipster": 1,
  "people watching": 1,
  "dancing": 1,
  "live music": 1,
  "lively": 1,
  "loud": 1,
  "fun atmosphere": 1,
  "nightclubs": 1,
  "night clubs": 1,
  "festive atmosphere": 1,
  "noisy": 1,
  // Quiet-leaning (-1).
  "spacious": -1,
  "good for dates": -1,
  "comfortable": -1,
  "quiet": -1,
  "good for working": -1,
  "good for business meetings": -1,
  "comfortable seats": -1,
  "cozy": -1,
  "cosy atmosphere": -1,
  "study area": -1,
  "romantic": -1,
  "business meetings": -1,
  "quaint atmosphere": -1,
  "pleasant atmosphere": -1,
};

/** The `tastes` nudge for a venue â€” `-1`, `0`, or `+1`. Sums the
 *  direction tags of the venue's `tastes` tokens that appear in the
 *  allowlist, then returns the sign of that sum. Direction-only. */
function tastesNudge(tastes: string[]): number {
  let sum = 0;
  for (const token of tastes) {
    sum += VIBE_TOKEN_ALLOWLIST[token.toLowerCase()] ?? 0;
  }
  if (sum > 0) return 1;
  if (sum < 0) return -1;
  return 0;
}

/** Clamp a vibe value into the valid 0..4 range. */
function clampVibe(value: number): number {
  return Math.min(Math.max(value, 0), VIBE_SCALE_STOPS - 1);
}

/** The venue's vibe level, 0..4. The category archetype is the
 *  baseline; a curated `tastes`-token nudge is the secondary signal;
 *  `price_tier` is the last-resort tie-break (unmatched archetype
 *  only). Mirrors the legacy Swift `vibe(of:)` precedence verbatim. */
function vibeOf(categories: string[], tastes: string[], priceTier: number | null): number {
  const haystack = categories.map((c) => c.toLowerCase());
  let baseline = DEFAULT_VIBE_BASELINE;
  let matched = false;
  for (const archetype of VIBE_ARCHETYPES) {
    if (
      archetype.fragments.some((fragment) =>
        haystack.some((cat) => cat.includes(fragment))
      )
    ) {
      baseline = archetype.baseline;
      matched = true;
      break;
    }
  }

  // `tastes` nudge â€” applies whether or not an archetype matched.
  const nudge = tastesNudge(tastes);
  if (nudge !== 0) {
    return clampVibe(baseline + nudge);
  }

  // Price tie-break â€” last-resort, unmatched-archetype only.
  if (!matched && priceTier !== null) {
    if (priceTier <= 1) baseline += 1;
    else if (priceTier >= 4) baseline -= 1;
  }

  return clampVibe(baseline);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Reputation axis â€” pool-relative volume Ã— quality Ã— age
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** The pool-relative volume split â€” the `total_ratings` cutoffs that
 *  separate the bottom / middle / top tercile of the fetched pool. */
interface VolumeTerciles {
  lowCeiling: number;
  highFloor: number;
}

/** Compute the pool-relative volume terciles. Venues with no
 *  `total_ratings` are treated as zero-volume. Mirrors the Swift
 *  `volumeTerciles(in:)`. */
function volumeTerciles(pool: readonly CandidateOption[]): VolumeTerciles {
  const volumes = pool.map((p) => p.total_ratings ?? 0).sort((a, b) => a - b);
  if (volumes.length === 0) {
    return { lowCeiling: 0, highFloor: Number.POSITIVE_INFINITY };
  }
  const lowIndex = Math.max(0, Math.floor((volumes.length - 1) / 3));
  const highIndex = Math.min(
    volumes.length - 1,
    Math.floor(((volumes.length - 1) * 2) / 3),
  );
  return { lowCeiling: volumes[lowIndex], highFloor: volumes[highIndex] };
}

/** Parse an ISO-8601 date or date-time string into ms-since-epoch, or
 *  `null` when absent / unparseable. */
function parseISODate(raw: string | null | undefined): number | null {
  if (!raw || raw.length === 0) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

/** The age of the venue's Foursquare record in days, or `null` when
 *  `date_created` is absent or unparseable. */
function recordAgeDays(dateCreated: string | null | undefined, now: Date): number | null {
  const createdMs = parseISODate(dateCreated);
  if (createdMs === null) return null;
  const seconds = (now.getTime() - createdMs) / 1000;
  if (seconds < 0) return 0;
  return seconds / 86_400;
}

/** The venue's reputation bucket â€” a `QuizReputation` id, never
 *  `no_preference` (that is a member answer). Mirrors the Swift
 *  `reputation(of:volumeSplit:now:)` decision order. */
function reputationOf(
  venue: CandidateOption,
  volumeSplit: VolumeTerciles,
  now: Date,
): string {
  const ageDays = recordAgeDays(venue.date_created, now);
  const volume = venue.total_ratings ?? 0;
  const rating = venue.rating ?? null;

  // New â€” age dominates, regardless of volume.
  if (ageDays !== null && ageDays <= NEW_RECORD_MAX_AGE_DAYS) {
    return REP_NEW;
  }

  const isHighVolume = volume >= volumeSplit.highFloor && volumeSplit.highFloor > 0;
  const isLowVolume = volume <= volumeSplit.lowCeiling;

  // Classic â€” high volume + an old record.
  if (isHighVolume && ageDays !== null && ageDays >= CLASSIC_RECORD_MIN_AGE_DAYS) {
    return REP_CLASSIC;
  }
  // Popular â€” high volume + well-rated.
  if (isHighVolume && rating !== null && rating >= POPULAR_RATING_FLOOR) {
    return REP_POPULAR;
  }
  // Hidden gem â€” low volume + an excellent rating.
  if (isLowVolume && rating !== null && rating >= HIDDEN_GEM_RATING_FLOOR) {
    return REP_HIDDEN_GEM;
  }
  // No discriminating signal â€” the neutral, ordinary bucket.
  return REP_POPULAR;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Public surface â€” pool classification
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Classify a fetched venue pool into `Q5VenueProfile`s, keyed by
 *  `CandidateOption.id`.
 *
 *  Reputation is pool-relative, so the whole pool is classified in one
 *  call: the volume terciles are derived from this pool's
 *  `total_ratings` spread. Cuisine and vibe are per-venue.
 *
 *  @param pool the room's candidate pool (the unioned `options`).
 *  @param now  the reference instant the `date_created` age check
 *              reads. Injected so tests are deterministic; defaults to
 *              `new Date()`.
 *  @returns a `Map<option_id, Q5VenueProfile>` â€” one entry per input
 *           venue. */
export function classifyVenuePool(
  pool: readonly CandidateOption[],
  now: Date = new Date(),
): Map<string, Q5VenueProfile> {
  const volumeSplit = volumeTerciles(pool);
  const out = new Map<string, Q5VenueProfile>();
  for (const venue of pool) {
    out.set(venue.id, {
      cuisine: cuisineOf(venue.categories),
      reputation: reputationOf(venue, volumeSplit, now),
      vibe: vibeOf(venue.categories, venue.tastes ?? [], venue.price_tier),
    });
  }
  return out;
}
