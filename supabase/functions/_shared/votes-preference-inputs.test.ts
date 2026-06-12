// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// votes-schema preference-inputs extractor tests (TB-23 quiz redesign).
//
// TB-23 moves the verdict's live scoring onto the ported preference
// function: at fire time the handler builds each member's `prefFn` from
// their stated Q1/Q3/Q4 profile + their three Q5 factorial ratings, and
// scores the FULL candidate pool with it.
//
// `mapVotesRowToPreferenceInputs` is the slice of the schema-driven
// mapping layer that produces those preference inputs â€” a
// `Q5MemberProfile` (cuisines / reputation / vibe) plus the three
// `Q5Rating` cards. It dispatches each `votes` slot on
// `meta.question_kind`, same as `mapVotesRowToMemberVote`:
//
//   * cuisine_craving â€” `answer.cuisines` â†’ the member's craved set.
//   * reputation      â€” `answer.reputation` â†’ the stated bucket.
//   * vibe            â€” `answer.level` â†’ the 0..4 energy stop.
//   * regret          â€” `answer.ratings` â†’ the three Q5 card ratings,
//                       the preference probe. After TB-23 the regret
//                       slot carries the probe ratings, NOT a
//                       per-candidate score map.
//
// Design source: gti-vault/50_product/0.1.0-quiz-amendments Â§3.

import {
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  mapVotesRowToPreferenceInputs,
  type QuestionSlot,
  type VotesRow,
} from "./votes-schema.ts";
import { buildPreferenceFunction } from "./preference-function.ts";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Slot fixture helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function cuisineSlot(cuisines: string[]): QuestionSlot {
  return {
    meta: { question_kind: "cuisine_craving", prompt: "What are you craving?" },
    answer: { cuisines },
  };
}

function budgetSlot(tier: number): QuestionSlot {
  return {
    meta: { question_kind: "budget_cap", prompt: "Where's the ceiling?" },
    answer: { tier },
  };
}

function reputationSlot(reputation: string): QuestionSlot {
  return {
    meta: { question_kind: "reputation", prompt: "What kind of place?" },
    answer: { reputation },
  };
}

function vibeSlot(level: number): QuestionSlot {
  return {
    meta: { question_kind: "vibe", prompt: "What's the energy?" },
    answer: { level },
  };
}

function regretSlot(
  ratings: Array<{ droppedAxis: string; score: number }>,
): QuestionSlot {
  return {
    meta: { question_kind: "regret", prompt: "How excited are you?" },
    answer: { ratings },
  };
}

function canonicalRow(overrides: Partial<VotesRow> = {}): VotesRow {
  // Use `"key" in overrides` so an explicit `null` override is honored
  // (a plain `??` would treat `null` as "not provided").
  return {
    user_id: "user_id" in overrides ? overrides.user_id! : "user-1",
    display_name: "display_name" in overrides ? overrides.display_name! : "alex",
    q1: "q1" in overrides ? overrides.q1! : cuisineSlot([]),
    q2: "q2" in overrides ? overrides.q2! : budgetSlot(4),
    q3: "q3" in overrides ? overrides.q3! : reputationSlot("no_preference"),
    q4: "q4" in overrides ? overrides.q4! : vibeSlot(2),
    q5: "q5" in overrides ? overrides.q5! : regretSlot([
      { droppedAxis: "cuisine", score: 3 },
      { droppedAxis: "crowd_approval", score: 3 },
      { droppedAxis: "vibe", score: 3 },
    ]),
  };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Happy path â€” a canonical quiz-redesign row maps to preference inputs.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("maps a canonical quiz-redesign row to a Q5MemberProfile + ratings", () => {
  const row = canonicalRow({
    q1: cuisineSlot(["mexican", "thai"]),
    q3: reputationSlot("hidden_gem"),
    q4: vibeSlot(3),
    q5: regretSlot([
      { droppedAxis: "cuisine", score: 5 },
      { droppedAxis: "crowd_approval", score: 2 },
      { droppedAxis: "vibe", score: 4 },
    ]),
  });

  const inputs = mapVotesRowToPreferenceInputs(row);

  assertEquals(inputs.member.cuisines, ["mexican", "thai"]);
  assertEquals(inputs.member.reputation, "hidden_gem");
  assertEquals(inputs.member.vibe, 3);
  assertEquals(inputs.q5Ratings, [
    { droppedAxis: "cuisine", score: 5 },
    { droppedAxis: "crowd_approval", score: 2 },
    { droppedAxis: "vibe", score: 4 },
  ]);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Slot dispatch is on question_kind, not column position.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("dispatch is on question_kind â€” slots can be reordered", () => {
  const row: VotesRow = {
    user_id: "u",
    display_name: "n",
    q1: vibeSlot(4),
    q2: regretSlot([
      { droppedAxis: "cuisine", score: 1 },
      { droppedAxis: "crowd_approval", score: 5 },
      { droppedAxis: "vibe", score: 5 },
    ]),
    q3: cuisineSlot(["italian"]),
    q4: reputationSlot("classic"),
    q5: budgetSlot(2),
  };
  const inputs = mapVotesRowToPreferenceInputs(row);
  assertEquals(inputs.member.cuisines, ["italian"]);
  assertEquals(inputs.member.reputation, "classic");
  assertEquals(inputs.member.vibe, 4);
  assertEquals(inputs.q5Ratings.length, 3);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Defaults â€” absent / null slots fall back to no-preference.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("an absent cuisine slot defaults to an empty craved set", () => {
  const row = canonicalRow({ q1: null });
  const inputs = mapVotesRowToPreferenceInputs(row);
  assertEquals(inputs.member.cuisines, []);
});

Deno.test("an absent reputation slot defaults to no_preference", () => {
  const row = canonicalRow({ q3: null });
  const inputs = mapVotesRowToPreferenceInputs(row);
  assertEquals(inputs.member.reputation, "no_preference");
});

Deno.test("an absent vibe slot defaults to the mid-scale stop (2)", () => {
  const row = canonicalRow({ q4: null });
  const inputs = mapVotesRowToPreferenceInputs(row);
  assertEquals(inputs.member.vibe, 2);
});

Deno.test("an absent regret slot yields no Q5 ratings", () => {
  const row = canonicalRow({ q5: null });
  const inputs = mapVotesRowToPreferenceInputs(row);
  assertEquals(inputs.q5Ratings, []);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Malformed ratings â€” non-axis / non-numeric entries are dropped.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("malformed Q5 rating entries are dropped, valid ones kept", () => {
  const row = canonicalRow({
    q5: {
      meta: { question_kind: "regret" },
      answer: {
        ratings: [
          { droppedAxis: "cuisine", score: 4 },
          { droppedAxis: "garbage", score: 3 }, // unknown axis dropped
          { droppedAxis: "vibe", score: "x" }, // non-numeric dropped
          { droppedAxis: "crowd_approval", score: 2 },
        ],
      },
    },
  });
  const inputs = mapVotesRowToPreferenceInputs(row);
  assertEquals(inputs.q5Ratings, [
    { droppedAxis: "cuisine", score: 4 },
    { droppedAxis: "crowd_approval", score: 2 },
  ]);
});

Deno.test("legacy Q5 reputation axis ratings normalize to crowd approval", () => {
  const row = canonicalRow({
    q5: {
      meta: { question_kind: "regret" },
      answer: {
        ratings: [
          { droppedAxis: "cuisine", score: 4 },
          { droppedAxis: "reputation", score: 2 },
          { droppedAxis: "vibe", score: 5 },
        ],
      },
    },
  });
  const inputs = mapVotesRowToPreferenceInputs(row);
  assertEquals(inputs.q5Ratings, [
    { droppedAxis: "cuisine", score: 4 },
    { droppedAxis: "crowd_approval", score: 2 },
    { droppedAxis: "vibe", score: 5 },
  ]);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TB-26 â€” an empty Q5 ratings array (the iOS no-results path).
//
// When the per-member venue fetch produces no factorial-usable pool the
// iOS app renders the Q5 no-results screen and submits a `votes` row
// whose `q5.answer.ratings` is an EMPTY array (no factorial cards were
// shown, so the member rated nothing). `compute-verdict` must still
// produce a correct verdict for that member: the Q5 reader tolerates
// the empty array, and the preference function degrades to the
// equal-weight prior over the member's stated axes.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("TB-26: an empty Q5 ratings array yields no Q5 ratings", () => {
  // The Q5 slot is present (the member reached Q5) but the no-results
  // screen rated nothing â€” `ratings` is an empty array.
  const row = canonicalRow({ q5: regretSlot([]) });
  const inputs = mapVotesRowToPreferenceInputs(row);
  assertEquals(inputs.q5Ratings, [],
    "an empty ratings array maps to no Q5 ratings â€” no throw, no corruption");
});

Deno.test(
  "TB-26: an empty Q5 probe degrades the prefFn to the equal-weight prior",
  () => {
    // A member who saw the no-results screen: stated Q1/Q3/Q4 answers,
    // but an empty Q5 probe. The verdict must still rank venues for
    // them â€” the prefFn falls back to an equal 1/3 weight across the
    // member's stated axes (no revealed-weight signal to blend in).
    const row = canonicalRow({
      q1: cuisineSlot(["mexican"]),
      q3: reputationSlot("popular"),
      q4: vibeSlot(2),
      q5: regretSlot([]),
    });
    const inputs = mapVotesRowToPreferenceInputs(row);
    assertEquals(inputs.q5Ratings, []);

    // The prefFn built from the empty probe must equal one built from a
    // flat probe (all cards rated the same) â€” both reveal zero weight
    // signal, so both collapse to the equal-weight prior.
    const emptyProbeFn = buildPreferenceFunction(inputs.member, inputs.q5Ratings);
    const flatProbeFn = buildPreferenceFunction(inputs.member, [
      { droppedAxis: "cuisine", score: 3 },
      { droppedAxis: "crowd_approval", score: 3 },
      { droppedAxis: "vibe", score: 3 },
    ]);

    // Score a spread of venues with both functions â€” they must agree.
    const venues = [
      { cuisine: "mexican", reputation: "popular", vibe: 2 }, // perfect
      { cuisine: "italian", reputation: "hidden_gem", vibe: 4 }, // all miss
      { cuisine: "mexican", reputation: "hidden_gem", vibe: 2 }, // one miss
    ];
    for (const v of venues) {
      assertAlmostEquals(
        emptyProbeFn(v),
        flatProbeFn(v),
        0.0001,
        "an empty Q5 probe scores identically to a flat probe â€” "
          + "both degrade to the equal-weight prior",
      );
    }

    // And the prior is genuinely active â€” a perfect venue still scores
    // the match ceiling, so the member's verdict is not degenerate.
    assertAlmostEquals(emptyProbeFn(venues[0]), 5.0, 0.0001);
  },
);
