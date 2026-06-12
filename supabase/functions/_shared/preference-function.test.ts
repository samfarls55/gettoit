// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// PreferenceFunction pure unit tests (TB-22 quiz redesign â€” Swiftâ†’TS port).
//
// The preference engine (PRD modules A `buildPreferenceFunction` + E
// axis scorers) is pure: it takes a member's stated Q1â€“Q4 profile and
// their three Q5 factorial ratings, and returns a `prefFn` that scores
// any axis-profiled venue 1â€¦5. No I/O, no clock, no group state.
//
// This file is a faithful port of the Swift test suite
// (`legacy Swift ios/Tests/PreferenceFunctionTests.swift`, TB-09). Every Swift test
// case is reproduced here, AND â€” beyond the behavioral assertions the
// Swift suite makes â€” an explicit exact-score vector table asserts the
// TS module reproduces the Swift scores byte-identically (the TB-22
// acceptance criterion: "the TS module reproduces the Swift scores
// exactly on every vector"). The exact expected numbers were computed
// from the Swift module's arithmetic by hand and pinned here.
//
// Design source: gti-vault/50_product/0.1.0-quiz-amendments Â§3.

import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ALPHA,
  buildPreferenceFunction,
  MATCH_SCORE,
  type Q5MemberProfile,
  type Q5Rating,
  type Q5VenueProfile,
  scoreCuisineAxis,
  scoreReputationAxis,
  scoreVibeAxis,
  SOFT_NON_MATCH_SCORE,
  THRESHOLD_T,
} from "./preference-function.ts";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Fixture helpers (mirror the Swift suite's fixtures)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Quiz id constants â€” mirror `QuizCuisine` / `QuizReputation` (Swift
// `legacy Swift ios/Sources/App/QuizCoordinator.swift`).
const CUISINE_MEXICAN = "mexican";
const CUISINE_ITALIAN = "italian";
const CUISINE_THAI = "thai";
const CUISINE_CHINESE = "chinese";

const REP_POPULAR = "popular";
const REP_HIDDEN_GEM = "hidden_gem";
const REP_CLASSIC = "classic";
const REP_NEW = "new";
const REP_NO_PREFERENCE = "no_preference";

/** An axis-profiled venue. */
function venue(
  cuisine: string | null,
  reputation: string,
  vibe: number,
): Q5VenueProfile {
  return { cuisine, reputation, vibe };
}

/** A member craving Mexican, wanting Popular, vibe 2 (Social). */
const mexicanSocialPopular: Q5MemberProfile = {
  cuisines: [CUISINE_MEXICAN],
  reputation: REP_POPULAR,
  vibe: 2,
};

/** Three Q5 ratings where every card scores the same â€” no axis reveals
 *  any weight signal (marginal value 0 everywhere). */
function flatRatings(score: number): Q5Rating[] {
  return [
    { droppedAxis: "cuisine", score },
    { droppedAxis: "crowd_approval", score },
    { droppedAxis: "vibe", score },
  ];
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// buildPreferenceFunction â€” basic contract
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("prefFn scores within 1â€¦5", () => {
  const prefFn = buildPreferenceFunction(mexicanSocialPopular, flatRatings(3));
  const perfect = venue(CUISINE_MEXICAN, REP_POPULAR, 2);
  const miss = venue(CUISINE_THAI, REP_HIDDEN_GEM, 4);
  for (const v of [perfect, miss]) {
    const s = prefFn(v);
    assert(s >= 1.0, `score ${s} below 1`);
    assert(s <= 5.0, `score ${s} above 5`);
  }
});

Deno.test("perfect match scores five", () => {
  const prefFn = buildPreferenceFunction(mexicanSocialPopular, flatRatings(3));
  const perfect = venue(CUISINE_MEXICAN, REP_POPULAR, 2);
  assertAlmostEquals(prefFn(perfect), 5.0, 0.001);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Soft non-match has teeth (scores below T)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("soft non-match scores below threshold T", () => {
  const prefFn = buildPreferenceFunction(mexicanSocialPopular, flatRatings(3));
  const miss = venue(CUISINE_THAI, REP_HIDDEN_GEM, 4);
  assert(prefFn(miss) < THRESHOLD_T, `score ${prefFn(miss)} not below T`);
});

Deno.test("non-match on low-weight axis barely dents score", () => {
  const prefFn = buildPreferenceFunction(mexicanSocialPopular, flatRatings(3));
  const twoOfThree = venue(CUISINE_MEXICAN, REP_POPULAR, 3);
  const allMiss = venue(CUISINE_THAI, REP_HIDDEN_GEM, 4);
  assert(prefFn(twoOfThree) > prefFn(allMiss));
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// "No preference" zeroes an axis
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("reputation no-preference zeroes that axis", () => {
  const member: Q5MemberProfile = {
    cuisines: [CUISINE_MEXICAN],
    reputation: REP_NO_PREFERENCE,
    vibe: 2,
  };
  const prefFn = buildPreferenceFunction(member, flatRatings(3));
  const a = venue(CUISINE_MEXICAN, REP_POPULAR, 2);
  const b = venue(CUISINE_MEXICAN, REP_HIDDEN_GEM, 2);
  assertAlmostEquals(prefFn(a), prefFn(b), 0.001);
});

Deno.test("cuisine no-preference (empty Q1) zeroes that axis", () => {
  const member: Q5MemberProfile = {
    cuisines: [],
    reputation: REP_POPULAR,
    vibe: 2,
  };
  const prefFn = buildPreferenceFunction(member, flatRatings(3));
  const a = venue(CUISINE_MEXICAN, REP_POPULAR, 2);
  const b = venue(CUISINE_THAI, REP_POPULAR, 2);
  assertAlmostEquals(prefFn(a), prefFn(b), 0.001);
});

Deno.test("no-preference axis weight redistributes to survivors", () => {
  const member: Q5MemberProfile = {
    cuisines: [CUISINE_MEXICAN],
    reputation: REP_NO_PREFERENCE,
    vibe: 2,
  };
  const prefFn = buildPreferenceFunction(member, flatRatings(3));
  const v = venue(CUISINE_MEXICAN, REP_HIDDEN_GEM, 2);
  assertAlmostEquals(prefFn(v), 5.0, 0.001);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Soft re-weight blends toward the Q5-revealed weights
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("soft re-weight lifts a high-marginal axis", () => {
  const highCuisineWeight = buildPreferenceFunction(mexicanSocialPopular, [
    { droppedAxis: "cuisine", score: 1 },
    { droppedAxis: "crowd_approval", score: 3 },
    { droppedAxis: "vibe", score: 3 },
  ]);
  const flatWeight = buildPreferenceFunction(
    mexicanSocialPopular,
    flatRatings(3),
  );
  const cuisineOnly = venue(CUISINE_MEXICAN, REP_HIDDEN_GEM, 4);
  assert(highCuisineWeight(cuisineOnly) > flatWeight(cuisineOnly));
});

Deno.test("soft re-weight is partial, not full replacement", () => {
  const prefFn = buildPreferenceFunction(mexicanSocialPopular, [
    { droppedAxis: "cuisine", score: 1 },
    { droppedAxis: "crowd_approval", score: 3 },
    { droppedAxis: "vibe", score: 3 },
  ]);
  const missCuisineOnly = venue(CUISINE_THAI, REP_POPULAR, 2);
  assert(prefFn(missCuisineOnly) > 2.0);
});

Deno.test("flat ratings leave weights at prior", () => {
  const prefFn = buildPreferenceFunction(mexicanSocialPopular, flatRatings(4));
  const cuisineOnly = venue(CUISINE_MEXICAN, REP_HIDDEN_GEM, 4);
  const reputationOnly = venue(CUISINE_THAI, REP_POPULAR, 4);
  assertAlmostEquals(prefFn(cuisineOnly), prefFn(reputationOnly), 0.001);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Hard-contradiction override
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("hard-contradiction override fires on strict trigger", () => {
  const prefFn = buildPreferenceFunction(mexicanSocialPopular, [
    { droppedAxis: "cuisine", score: 2 },
    { droppedAxis: "crowd_approval", score: 5 },
    { droppedAxis: "vibe", score: 2 },
  ]);
  // Override demotes crowd approval to no-preference: a venue that misses
  // that bucket but matches cuisine + vibe now scores a perfect 5.
  const v = venue(CUISINE_MEXICAN, REP_HIDDEN_GEM, 2);
  assertAlmostEquals(prefFn(v), 5.0, 0.001);
});

Deno.test("hard-contradiction override demotes, never inverts", () => {
  const prefFn = buildPreferenceFunction(mexicanSocialPopular, [
    { droppedAxis: "cuisine", score: 2 },
    { droppedAxis: "crowd_approval", score: 5 },
    { droppedAxis: "vibe", score: 2 },
  ]);
  const statedRep = venue(CUISINE_MEXICAN, REP_POPULAR, 2);
  const otherRep = venue(CUISINE_MEXICAN, REP_CLASSIC, 2);
  assertAlmostEquals(prefFn(statedRep), prefFn(otherRep), 0.001);
});

Deno.test("single odd rating does not fire override", () => {
  const prefFn = buildPreferenceFunction(mexicanSocialPopular, [
    { droppedAxis: "cuisine", score: 2 }, // a crowd-approval keep card, below drop
    { droppedAxis: "crowd_approval", score: 5 }, // the crowd-approval drop card
    { droppedAxis: "vibe", score: 5 }, // a crowd-approval keep card, NOT below drop
  ]);
  const missRep = venue(CUISINE_MEXICAN, REP_HIDDEN_GEM, 2);
  const perfect = venue(CUISINE_MEXICAN, REP_POPULAR, 2);
  assert(prefFn(missRep) < prefFn(perfect));
});

Deno.test("override does not fire when drop card rated below four", () => {
  const prefFn = buildPreferenceFunction(mexicanSocialPopular, [
    { droppedAxis: "cuisine", score: 1 },
    { droppedAxis: "crowd_approval", score: 3 },
    { droppedAxis: "vibe", score: 2 },
  ]);
  const missRep = venue(CUISINE_MEXICAN, REP_HIDDEN_GEM, 2);
  const perfect = venue(CUISINE_MEXICAN, REP_POPULAR, 2);
  assert(prefFn(missRep) < prefFn(perfect));
});

Deno.test("override on multi-pick cuisine demotes the whole set", () => {
  const member: Q5MemberProfile = {
    cuisines: [CUISINE_MEXICAN, CUISINE_ITALIAN, CUISINE_THAI],
    reputation: REP_POPULAR,
    vibe: 2,
  };
  const prefFn = buildPreferenceFunction(member, [
    { droppedAxis: "cuisine", score: 5 }, // cuisine-drop, excited
    { droppedAxis: "crowd_approval", score: 2 }, // cuisine-keep
    { droppedAxis: "vibe", score: 2 }, // cuisine-keep
  ]);
  const v = venue(CUISINE_CHINESE, REP_POPULAR, 2);
  assertAlmostEquals(prefFn(v), 5.0, 0.001);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Axis scorers â€” fixed venue -> 1â€¦5 interface
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("cuisine scorer is set membership", () => {
  const craved = ["mexican", "italian"];
  assertEquals(scoreCuisineAxis("mexican", craved), MATCH_SCORE);
  assertEquals(scoreCuisineAxis("thai", craved), SOFT_NON_MATCH_SCORE);
  // An unclassified venue cannot match -> soft non-match.
  assertEquals(scoreCuisineAxis(null, craved), SOFT_NON_MATCH_SCORE);
});

Deno.test("reputation scorer is exact match vs miss", () => {
  assertEquals(scoreReputationAxis(REP_POPULAR, REP_POPULAR), MATCH_SCORE);
  assertEquals(
    scoreReputationAxis(REP_HIDDEN_GEM, REP_POPULAR),
    SOFT_NON_MATCH_SCORE,
  );
});

Deno.test("vibe scorer is graded by distance", () => {
  const exact = scoreVibeAxis(2, 2);
  const near = scoreVibeAxis(3, 2);
  const far = scoreVibeAxis(4, 0);
  assertAlmostEquals(exact, 5.0, 0.001);
  assert(exact > near);
  assert(near > far);
  assert(far >= 1.0);
});

Deno.test("all axis scorers return 1â€¦5 across their domain", () => {
  for (const craved of [[], ["mexican"], ["mexican", "thai"]]) {
    for (const vc of ["mexican", "thai", null]) {
      const s = scoreCuisineAxis(vc, craved);
      assert(s >= 1.0 && s <= 5.0);
    }
  }
  const reps = [REP_POPULAR, REP_HIDDEN_GEM, REP_CLASSIC, REP_NEW];
  for (const vr of reps) {
    for (const sr of reps) {
      const s = scoreReputationAxis(vr, sr);
      assert(s >= 1.0 && s <= 5.0);
    }
  }
  for (let vv = 0; vv <= 4; vv++) {
    for (let sv = 0; sv <= 4; sv++) {
      const s = scoreVibeAxis(vv, sv);
      assert(s >= 1.0 && s <= 5.0);
    }
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Determinism
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("prefFn is deterministic", () => {
  const v = venue(CUISINE_MEXICAN, REP_CLASSIC, 1);
  const a = buildPreferenceFunction(mexicanSocialPopular, flatRatings(3))(v);
  const b = buildPreferenceFunction(mexicanSocialPopular, flatRatings(3))(v);
  assertEquals(a, b);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Cohort-zero constants match the Swift module exactly
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("cohort-zero constants match the Swift module exactly", () => {
  assertEquals(MATCH_SCORE, 5.0);
  assertEquals(SOFT_NON_MATCH_SCORE, 2.0);
  assertEquals(THRESHOLD_T, 3.0);
  assertEquals(ALPHA, 0.5);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Exact-score vector table â€” the TB-22 port-fidelity proof.
//
// Each row is a fully-specified (member, q5Ratings, venue) input with
// the score the Swift module's arithmetic produces, computed by hand
// from the Swift source. The TS module must reproduce every number
// exactly. This is the criterion: "the TS module reproduces the Swift
// scores exactly on every vector."
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ScoreVector {
  name: string;
  member: Q5MemberProfile;
  q5Ratings: Q5Rating[];
  venue: Q5VenueProfile;
  expected: number;
}

const SCORE_VECTORS: ScoreVector[] = [
  // Flat ratings -> equal 1/3 weights on all three axes.
  // Perfect match: cuisine 5, reputation 5, vibe (dist 0) 5 -> avg 5.
  {
    name: "flat weights, perfect match -> 5",
    member: mexicanSocialPopular,
    q5Ratings: flatRatings(3),
    venue: venue(CUISINE_MEXICAN, REP_POPULAR, 2),
    expected: 5.0,
  },
  // Flat weights, full miss: cuisine 2, reputation 2,
  // vibe dist |4-2|=2 -> 5 - (2/4)*4 = 3 -> avg (2+2+3)/3 = 7/3.
  {
    name: "flat weights, full miss -> 7/3",
    member: mexicanSocialPopular,
    q5Ratings: flatRatings(3),
    venue: venue(CUISINE_THAI, REP_HIDDEN_GEM, 4),
    expected: 7 / 3,
  },
  // Flat weights, matches cuisine + reputation, vibe dist 1 ->
  // 5 - (1/4)*4 = 4 -> avg (5+5+4)/3 = 14/3.
  {
    name: "flat weights, two-of-three (vibe off by 1) -> 14/3",
    member: mexicanSocialPopular,
    q5Ratings: flatRatings(3),
    venue: venue(CUISINE_MEXICAN, REP_POPULAR, 3),
    expected: 14 / 3,
  },
  // Vibe-only check via a member who no-prefs cuisine + reputation:
  // only vibe is active, weight 1. venue vibe dist |0-2|=2 -> score 3.
  {
    name: "vibe-only active, distance 2 -> 3",
    member: { cuisines: [], reputation: REP_NO_PREFERENCE, vibe: 2 },
    q5Ratings: flatRatings(3),
    venue: venue(CUISINE_THAI, REP_CLASSIC, 0),
    expected: 3.0,
  },
  // No-preference reputation: cuisine + vibe active at 1/2 each.
  // venue matches cuisine (5), vibe dist |3-2|=1 -> 4.
  // avg (0.5*5 + 0.5*4) = 4.5.
  {
    name: "reputation no-pref, cuisine match + vibe off by 1 -> 4.5",
    member: {
      cuisines: [CUISINE_MEXICAN],
      reputation: REP_NO_PREFERENCE,
      vibe: 2,
    },
    q5Ratings: flatRatings(3),
    venue: venue(CUISINE_MEXICAN, REP_HIDDEN_GEM, 3),
    expected: 4.5,
  },
  // Soft re-weight: cuisine-drop rated 1, keeps rated 3 each ->
  //   cuisine marginal = avg(3,3) - 1 = 2.
  //   crowd approval marginal = avg(cuisine=1, vibe=3) - crowd approval-drop(3)
  //                       = 2 - 3 = -1 -> floored 0.
  //   vibe marginal = avg(cuisine=1, crowd approval=3) - vibe-drop(3)
  //                 = 2 - 3 = -1 -> floored 0.
  //   total marginal = 2 -> revealed cuisine=1, crowd approval=0, vibe=0.
  //   prior each = 1/3. final (alpha 0.5):
  //     cuisine    = 0.5*(1/3) + 0.5*1   = 1/6 + 1/2 = 2/3
  //     crowd approval = 0.5*(1/3) + 0.5*0 = 1/6
  //     vibe       = 0.5*(1/3) + 0.5*0   = 1/6
  //   venue: cuisine match (5), crowd approval miss (2),
  //          vibe dist |4-2|=2 -> 3.
  //   weighted = (2/3)*5 + (1/6)*2 + (1/6)*3
  //            = 10/3 + 2/6 + 3/6 = 10/3 + 5/6 = 25/6.
  //   totalWeight = 1 -> score = 25/6.
  {
    name: "soft re-weight, cuisine lifted, cuisine-only match -> 25/6",
    member: mexicanSocialPopular,
    q5Ratings: [
      { droppedAxis: "cuisine", score: 1 },
      { droppedAxis: "crowd_approval", score: 3 },
      { droppedAxis: "vibe", score: 3 },
    ],
    venue: venue(CUISINE_MEXICAN, REP_HIDDEN_GEM, 4),
    expected: 25 / 6,
  },
  // Same re-weighted member, venue misses cuisine but matches the
  // other two: cuisine miss (2), crowd approval match (5), vibe dist 0 (5).
  //   weighted = (2/3)*2 + (1/6)*5 + (1/6)*5
  //            = 4/3 + 5/6 + 5/6 = 4/3 + 10/6 = 4/3 + 5/3 = 3.
  {
    name: "soft re-weight, cuisine miss + other two match -> 3",
    member: mexicanSocialPopular,
    q5Ratings: [
      { droppedAxis: "cuisine", score: 1 },
      { droppedAxis: "crowd_approval", score: 3 },
      { droppedAxis: "vibe", score: 3 },
    ],
    venue: venue(CUISINE_THAI, REP_POPULAR, 2),
    expected: 3.0,
  },
  // Hard-contradiction override on crowd approval (cuisine-keep 2,
  // vibe-keep 2, crowd approval-drop 5 -> both keeps < 5, drop >= 4 ->
  // fires). Crowd approval demoted. Cuisine + vibe active.
  //   Surviving marginals computed over {cuisine, vibe}:
  //     cuisine marginal  = avg(crowd approval=5, vibe=2) - cuisine-drop(2)
  //                       = 3.5 - 2 = 1.5
  //     vibe marginal     = avg(cuisine=2, crowd approval=5) - vibe-drop(2)
  //                       = 3.5 - 2 = 1.5
  //     total = 3 -> revealed cuisine=0.5, vibe=0.5.
  //   prior each = 1/2. final = 0.5*(1/2)+0.5*(0.5) = 0.5 each.
  //   venue matches cuisine (5), vibe dist 0 (5) -> score 5.
  {
    name: "reputation override fires, cuisine+vibe match -> 5",
    member: mexicanSocialPopular,
    q5Ratings: [
      { droppedAxis: "cuisine", score: 2 },
      { droppedAxis: "crowd_approval", score: 5 },
      { droppedAxis: "vibe", score: 2 },
    ],
    venue: venue(CUISINE_MEXICAN, REP_HIDDEN_GEM, 2),
    expected: 5.0,
  },
  // Member no-prefs every axis cuisine + reputation, but vibe is
  // always active â€” so this is not the all-zero case. To exercise the
  // all-zeroed -> MATCH_SCORE ceiling we need all three axes demoted.
  // Vibe can only leave via override: vibe-drop 5, both vibe-keeps 1.
  // Combine with cuisine empty + reputation no-pref so only vibe is
  // active at init, then vibe override fires -> active empty ->
  // totalWeight 0 -> MATCH_SCORE.
  {
    name: "all axes inactive (vibe override + no-pref both) -> 5 ceiling",
    member: { cuisines: [], reputation: REP_NO_PREFERENCE, vibe: 2 },
    q5Ratings: [
      { droppedAxis: "cuisine", score: 1 },
      { droppedAxis: "crowd_approval", score: 1 },
      { droppedAxis: "vibe", score: 5 },
    ],
    venue: venue(CUISINE_THAI, REP_HIDDEN_GEM, 4),
    expected: 5.0,
  },
];

Deno.test("exact-score vector table reproduces the Swift scores", () => {
  for (const vec of SCORE_VECTORS) {
    const prefFn = buildPreferenceFunction(vec.member, vec.q5Ratings);
    const actual = prefFn(vec.venue);
    assertAlmostEquals(
      actual,
      vec.expected,
      1e-9,
      `${vec.name}: expected ${vec.expected}, got ${actual}`,
    );
  }
});
