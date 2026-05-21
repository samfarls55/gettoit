// votes-wire — leaf-module wire-contract tests (tb-WF-10, ADR 0014).
//
// `votes-wire.ts` is the ONE definition of the vote wire shape, imported
// by both the edge functions and the web fallback. These tests pin the
// builder's output shape so a drift in the shared contract is caught
// here rather than at a verdict-fire-time read.

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildVotesSlotsFromLegacyAnswers,
  QUESTION_KINDS,
  type Q5Rating,
} from "./votes-wire.ts";

Deno.test("buildVotesSlotsFromLegacyAnswers wraps the five typed answers in slots", () => {
  const slots = buildVotesSlotsFromLegacyAnswers({
    q1_vetoes: [],
    q2_budget: 3,
    cuisines: ["thai", "italian"],
    reputation: "popular",
    q4_vibe: 1,
    q5_ratings: [
      { droppedAxis: "cuisine", score: 4 },
      { droppedAxis: "reputation", score: 2 },
      { droppedAxis: "vibe", score: 5 },
    ],
  });

  assertEquals(slots.q1.meta.question_kind, "cuisine_craving");
  assertEquals(slots.q1.answer.cuisines, ["thai", "italian"]);
  assertEquals(slots.q2.meta.question_kind, "budget_cap");
  assertEquals(slots.q2.answer.tier, 3);
  assertEquals(slots.q3.meta.question_kind, "reputation");
  assertEquals(slots.q3.answer.reputation, "popular");
  assertEquals(slots.q4.meta.question_kind, "vibe");
  assertEquals(slots.q4.answer.level, 1);
  assertEquals(slots.q5.meta.question_kind, "regret");
});

Deno.test("the Q5 regret slot emits answer.ratings, never a per-venue scores map", () => {
  const ratings: Q5Rating[] = [
    { droppedAxis: "cuisine", score: 5 },
    { droppedAxis: "reputation", score: 1 },
    { droppedAxis: "vibe", score: 4 },
  ];
  const slots = buildVotesSlotsFromLegacyAnswers({
    q1_vetoes: [],
    q2_budget: 2,
    q5_ratings: ratings,
  });
  assertEquals(slots.q5.answer.ratings, ratings);
  assertEquals(slots.q5.answer.scores, undefined);
});

Deno.test("absent soft-preference answers fall back to neutral defaults", () => {
  const slots = buildVotesSlotsFromLegacyAnswers({
    q1_vetoes: [],
    q2_budget: 4,
    q5_ratings: [],
  });
  // No cuisines / reputation / vibe supplied — the neutral answers.
  assertEquals(slots.q1.answer.cuisines, []);
  assertEquals(slots.q3.answer.reputation, "no_preference");
  assertEquals(slots.q4.answer.level, 2);
});

Deno.test("the question-kind taxonomy carries the v1.1 kinds", () => {
  for (const kind of ["cuisine_craving", "budget_cap", "reputation", "vibe", "regret"]) {
    assertExists(QUESTION_KINDS.find((k) => k === kind));
  }
});
