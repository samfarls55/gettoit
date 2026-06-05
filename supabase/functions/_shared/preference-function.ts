// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// PreferenceFunction â€” the per-member preference engine (TB-22 quiz redesign).
//
// A faithful TypeScript port of the legacy Swift `PreferenceFunction` module
// (`legacy Swift ios/Sources/App/PreferenceFunction.swift`, TB-09 â€” PRD modules A + E).
// The legacy Swift app builds a member's `prefFn` on-device; bug-08 locked the
// server-side fork (Option 2): the union + preference scoring runs
// server-side at verdict fire time. The verdict path is TypeScript, so
// the preference-function math has to live here too.
//
// This module is the pure-logic port only â€” no live integration. Wiring
// it into the `compute-verdict` edge function's `prefFn` injection seam
// is TB-23.
//
// `buildPreferenceFunction` takes a member's stated Q1â€“Q4 profile and
// their three Q5 factorial ratings and returns a `prefFn(venue) -> number`
// that scores any axis-profiled venue on the 1â€¦5 scale the verdict
// engine's satisficing floor reads.
//
// Pure: no I/O, no clock, no randomness, no group state. The returned
// closure is itself pure â€” a deterministic function of `member` and the
// Q5 ratings it was built from.
//
// Design source â€” gti-vault/50_product/0.1.0-quiz-amendments Â§3
// ("Q5 â€” the preference probe"):
//
//   * Stated-weight initialization. The three axis weights seed at an
//     equal 1/3. Q1â€“Q4 give the member's *position* on each axis, not
//     how much they care; the weight hierarchy is Q5's job, so the prior
//     is deliberately neutral. An explicit "No preference" (the Q3 chip,
//     or Q1 left empty) is a genuine zero-weight signal â€” that axis is
//     zeroed and its weight redistributed equally to the survivors.
//   * Soft re-weight. For each axis,
//     `marginal_value = avg(two keep-card ratings) - drop-card rating`,
//     floored at 0, normalized across axes to give `w_revealed`. Final
//     weights are a *partial* blend toward the revealed signal:
//     `w_final = (1 - alpha) * w_prior + alpha * w_revealed`. Blending
//     toward a non-zero prior means an axis the member positively
//     selected is never discounted all the way to zero by a thin 3-card
//     probe â€” only an explicit "No preference" zeroes an axis.
//   * Hard-contradiction override. A strict, two-condition trigger:
//     fires for an axis only when BOTH that axis's keep-cards score
//     strictly below its drop-card AND the drop-card is rated 4 or 5.
//     Action is demote to no-preference (weight zeroed, axis stops
//     scoring) â€” never invert toward the drop-card's value.
//   * Score normalization. Each axis produces a 1â€¦5 match score; the
//     venue score is the weighted average over nonzero-weight axes. A
//     match scores 5; a soft non-match scores ~2 â€” below threshold T â€”
//     so the satisficing floor has teeth.
//
// Cohort-zero constants â€” `matchScore=5`, `softNonMatchScore~2`,
// `thresholdT=3`, `alpha=0.5` â€” are tunable post-cohort (amendments Â§3).
// They are kept byte-identical with the Swift module so the ported test
// vectors reproduce the Swift scores exactly.

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Cohort-zero constants (tunable post-cohort â€” amendments Â§3)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** A full axis match scores 5. */
export const MATCH_SCORE = 5.0;
/** A soft non-match scores ~2 â€” deliberately below `THRESHOLD_T` so the
 *  satisficing floor can eliminate a venue in aggregate. */
export const SOFT_NON_MATCH_SCORE = 2.0;
/** The satisficing threshold T the verdict engine's floor keeps venues
 *  at or above. Carried here so tests and callers read one canonical
 *  value. */
export const THRESHOLD_T = 3.0;
/** The soft re-weight blend constant: `w_final` is `alpha` of the way
 *  from the prior toward the Q5-revealed weights. */
export const ALPHA = 0.5;

/** The number of stops on the Q4 / vibe energy scale (Quietâ€¦Rowdy).
 *  Mirrors `GTIVibeLabels.all.count` in the Swift module â€” the vibe
 *  scorer grades by distance over `VIBE_SCALE_STOPS - 1` steps. */
export const VIBE_SCALE_STOPS = 5;

/** The sentinel reputation id meaning the member stated no reputation
 *  preference. Mirrors `QuizReputation.noPreference`. A no-preference
 *  reputation zeroes the whole reputation axis. */
export const REPUTATION_NO_PREFERENCE = "no_preference";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Public types
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// `Axis` and `Q5Rating` are the tiny wire-contract types. ADR 0014
// makes `votes-wire.ts` the single, leaf-module home for them so the
// web app can import the same definitions; this module re-exports them
// so existing engine-side consumers keep importing from here unchanged.
export type { Axis, Q5Rating } from "./votes-wire.ts";
import type { Axis, Q5Rating } from "./votes-wire.ts";

const ALL_AXES: readonly Axis[] = ["cuisine", "reputation", "vibe"];

/** A member's stated Q1â€“Q4 profile. Mirrors the Swift
 *  `Q5MemberProfile` struct. */
export interface Q5MemberProfile {
  /** Q1 craved cuisines (`QuizCuisine` ids). Empty when the member
   *  answered "No preference". */
  cuisines: string[];
  /** Q3 reputation answer (`QuizReputation` id). May be
   *  `no_preference`. */
  reputation: string;
  /** Q4 vibe level, 0â€¦4. */
  vibe: number;
}

/** An axis-profiled venue. Mirrors the legacy Swift `Q5VenueProfile` struct â€”
 *  the already-classified shape the preference function consumes. */
export interface Q5VenueProfile {
  /** The venue's cuisine â€” a `QuizCuisine` id, or `null` when the venue
   *  has no classifiable cuisine. A `null` cuisine can never match. */
  cuisine: string | null;
  /** The venue's reputation bucket â€” a `QuizReputation` id. Never
   *  `no_preference`: that is a member answer, not a venue property. */
  reputation: string;
  /** The venue's vibe energy level, 0â€¦4. */
  vibe: number;
}

/** A pure venue-scoring function â€” the result of `buildPreferenceFunction`. */
export type PreferenceFn = (venue: Q5VenueProfile) => number;

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Axis scorers (PRD module E)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Cuisine axis â€” a clean set-membership match. The venue's cuisine is
 *  either one the member craved (a match) or it is not (a soft
 *  non-match). An unclassified (`null`) venue cuisine can never match. */
export function scoreCuisineAxis(
  venueCuisine: string | null,
  cravedCuisines: string[],
): number {
  if (venueCuisine !== null && cravedCuisines.includes(venueCuisine)) {
    return MATCH_SCORE;
  }
  return SOFT_NON_MATCH_SCORE;
}

/** Reputation axis â€” a categorical match. The member states one
 *  reputation bucket (Popular / Hidden gem / Classic / New); a venue in
 *  that bucket matches, any other bucket is a soft non-match.
 *
 *  `statedReputation` is never `no_preference` here â€” a no-preference
 *  reputation zeroes the whole axis upstream, so the scorer is never
 *  consulted for it. */
export function scoreReputationAxis(
  venueReputation: string,
  statedReputation: string,
): number {
  return venueReputation === statedReputation
    ? MATCH_SCORE
    : SOFT_NON_MATCH_SCORE;
}

/** Vibe axis â€” the one *graded* axis. Vibe is a cardinal 0â€¦4 energy
 *  scale (Quietâ€¦Rowdy); the score is graded by distance: 5 at an exact
 *  match, descending linearly toward the bottom of the 1â€¦5 scale at the
 *  maximum distance (4 steps apart). */
export function scoreVibeAxis(venueVibe: number, statedVibe: number): number {
  const maxDistance = VIBE_SCALE_STOPS - 1; // 4
  const distance = Math.abs(venueVibe - statedVibe);
  const fraction = maxDistance > 0 ? distance / maxDistance : 0;
  // distance 0 -> MATCH_SCORE (5); distance maxDistance -> 1.
  return MATCH_SCORE - fraction * (MATCH_SCORE - 1.0);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Weight resolution
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** The resolved per-axis weights, post-init, post-reweight,
 *  post-override. A zeroed axis drops out of the weighted average. */
interface AxisWeights {
  cuisine: number;
  reputation: number;
  vibe: number;
}

/** The rating of the card that drops `axis` (the one factorial card
 *  whose `droppedAxis` is this axis), or `null` when absent. */
function dropCardScore(axis: Axis, q5Ratings: Q5Rating[]): number | null {
  const card = q5Ratings.find((r) => r.droppedAxis === axis);
  return card ? card.score : null;
}

/** The ratings of the cards that keep `axis` (the factorial cards whose
 *  `droppedAxis` is some *other* axis â€” each of them keeps this axis). */
function keepCardScores(axis: Axis, q5Ratings: Q5Rating[]): number[] {
  return q5Ratings
    .filter((r) => r.droppedAxis !== axis)
    .map((r) => r.score);
}

/** An axis's marginal value: the average of its two keep-card ratings
 *  minus its drop-card rating. A large positive value means dropping
 *  that axis hurt the member's excitement â€” the axis matters. */
function marginalValue(axis: Axis, q5Ratings: Q5Rating[]): number {
  const drop = dropCardScore(axis, q5Ratings);
  if (drop === null) return 0;
  const keeps = keepCardScores(axis, q5Ratings);
  if (keeps.length === 0) return 0;
  const avgKeep = keeps.reduce((a, b) => a + b, 0) / keeps.length;
  return avgKeep - drop;
}

/** The strict two-condition override trigger for an axis: fires only
 *  when BOTH the axis's keep-cards score strictly below its drop-card
 *  AND the drop-card is rated 4 or 5.
 *
 *  "Both keep-cards below" â€” not the averaged margin â€” rules out a
 *  confound from the keep-cards' differing other-axis deviations; a
 *  single odd rating cannot fire it. */
function overrideFires(axis: Axis, q5Ratings: Q5Rating[]): boolean {
  const drop = dropCardScore(axis, q5Ratings);
  if (drop === null) return false;
  if (drop < 4) return false;
  const keeps = keepCardScores(axis, q5Ratings);
  // Need both keep-cards present and both strictly below the drop.
  if (keeps.length !== 2) return false;
  return keeps.every((k) => k < drop);
}

/** The Q5-revealed weights for the surviving axes, normalized to sum to
 *  1. If every marginal value is 0 (all cards rated equal â€” the
 *  degenerate case), the revealed distribution falls back to the equal
 *  prior so the blend leaves the weights untouched. */
function revealedWeights(
  active: Set<Axis>,
  q5Ratings: Q5Rating[],
): Map<Axis, number> {
  const marginal = new Map<Axis, number>();
  for (const axis of active) {
    marginal.set(axis, Math.max(0, marginalValue(axis, q5Ratings)));
  }
  let total = 0;
  for (const v of marginal.values()) total += v;

  // Degenerate: no axis reveals any weight -> fall back to the equal
  // prior so `w_final` == `w_prior`.
  if (total <= 0) {
    const each = 1.0 / active.size;
    const fallback = new Map<Axis, number>();
    for (const axis of active) fallback.set(axis, each);
    return fallback;
  }
  const out = new Map<Axis, number>();
  for (const [axis, v] of marginal) out.set(axis, v / total);
  return out;
}

/** Resolve the final axis weights: equal-weight init with no-preference
 *  zeroing, then the hard-contradiction override (which zeroes more
 *  axes), then the soft re-weight blend over the axes that survive. */
function resolveWeights(
  member: Q5MemberProfile,
  q5Ratings: Q5Rating[],
): AxisWeights {
  // Which axes carry a stated preference at all. An explicit
  // "No preference" is a genuine zero-weight signal.
  const active = new Set<Axis>();
  if (member.cuisines.length > 0) active.add("cuisine");
  if (member.reputation !== REPUTATION_NO_PREFERENCE) active.add("reputation");
  // Vibe is always a stated answer (the Q4 scale has no "no preference"
  // stop) â€” it is always active at init.
  active.add("vibe");

  // Hard-contradiction override â€” demote any axis whose strict
  // two-condition trigger fires. A demoted axis joins the no-preference
  // set: weight zeroed.
  for (const axis of ALL_AXES) {
    if (active.has(axis) && overrideFires(axis, q5Ratings)) {
      active.delete(axis);
    }
  }

  // Equal-weight prior over the surviving (active) axes.
  if (active.size === 0) {
    return { cuisine: 0, reputation: 0, vibe: 0 };
  }
  const priorEach = 1.0 / active.size;
  const prior = new Map<Axis, number>();
  for (const axis of active) prior.set(axis, priorEach);

  // Soft re-weight â€” blend the prior toward the Q5-revealed weights.
  const revealed = revealedWeights(active, q5Ratings);

  const final = new Map<Axis, number>();
  for (const axis of active) {
    const p = prior.get(axis) ?? 0;
    const r = revealed.get(axis) ?? 0;
    final.set(axis, (1 - ALPHA) * p + ALPHA * r);
  }

  return {
    cuisine: final.get("cuisine") ?? 0,
    reputation: final.get("reputation") ?? 0,
    vibe: final.get("vibe") ?? 0,
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Preference function (PRD module A)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Build a member's preference function from their stated Q1â€“Q4 profile
 *  and their three Q5 factorial ratings.
 *
 *  @param member   the member's stated Q1â€“Q4 profile.
 *  @param q5Ratings the three Q5 card ratings, one per axis. Order is
 *                   irrelevant â€” each rating carries its own
 *                   `droppedAxis`.
 *  @returns a pure `prefFn(venue) -> number` scoring any axis-profiled
 *           venue 1â€¦5. */
export function buildPreferenceFunction(
  member: Q5MemberProfile,
  q5Ratings: Q5Rating[],
): PreferenceFn {
  const weights = resolveWeights(member, q5Ratings);
  const craved = member.cuisines;
  const statedReputation = member.reputation;
  const statedVibe = member.vibe;

  return (venue: Q5VenueProfile): number => {
    // Per-axis 1â€¦5 match scores.
    const contributions: { weight: number; score: number }[] = [];

    if (weights.cuisine > 0) {
      contributions.push({
        weight: weights.cuisine,
        score: scoreCuisineAxis(venue.cuisine, craved),
      });
    }
    if (weights.reputation > 0) {
      contributions.push({
        weight: weights.reputation,
        score: scoreReputationAxis(venue.reputation, statedReputation),
      });
    }
    if (weights.vibe > 0) {
      contributions.push({
        weight: weights.vibe,
        score: scoreVibeAxis(venue.vibe, statedVibe),
      });
    }

    // Every axis zeroed (the member no-prefed all three, or every axis
    // was demoted) â€” no preference signal at all, so every venue is
    // equally acceptable. Score at the match ceiling.
    const totalWeight = contributions.reduce((a, c) => a + c.weight, 0);
    if (totalWeight <= 0) return MATCH_SCORE;

    // Weighted average over the nonzero-weight axes; the weights
    // renormalize to sum to 1 implicitly via the divisor.
    const weighted = contributions.reduce(
      (a, c) => a + c.weight * c.score,
      0,
    );
    return weighted / totalWeight;
  };
}
