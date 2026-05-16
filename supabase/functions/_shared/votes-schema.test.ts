// votes-schema mapping-layer tests (TB-04, widened by TB-11).
//
// The `votes` table stores answers in five generic jsonb slots
// (`q1`..`q5`). Each slot is a `{ meta, answer }` envelope: `meta`
// carries the per-session question metadata (a `question_kind`
// discriminator plus any prompt/options the session used), `answer`
// carries the member's response payload.
//
// `mapVotesRowToMemberVote` is the schema-driven mapping layer the
// verdict engine consumes its input through. It dispatches each slot
// on `meta.question_kind` — NOT on the slot's column name — so the
// quiz can move a question between slots, or change its prompt /
// option copy, without a migration or an engine change.
//
// TB-11 widened the kind taxonomy with `cuisine_craving`, `reputation`
// and `profile_veto`, and moved the engine `MemberVote` shape onto the
// worst-off-protecting pipeline's inputs (`hard_vetoes` + `scores`).
// These tests pin that contract.

import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildVotesSlotsFromLegacyAnswers,
  mapVotesRowToMemberVote,
  QUESTION_KINDS,
  type QuestionSlot,
  type VotesRow,
} from "./votes-schema.ts";

// ───────────────────────────────────────────────────────────────────────
// Slot fixture helpers — build a `{ meta, answer }` envelope per kind.
// ───────────────────────────────────────────────────────────────────────

function dietarySlot(vetoes: string[]): QuestionSlot {
  return {
    meta: { question_kind: "dietary_veto", prompt: "Anything off the menu?" },
    answer: { vetoes },
  };
}

function budgetSlot(tier: number): QuestionSlot {
  return {
    meta: { question_kind: "budget_cap", prompt: "Where's the ceiling?" },
    answer: { tier },
  };
}

function cuisineSlot(cuisines: string[]): QuestionSlot {
  return {
    meta: { question_kind: "cuisine_craving", prompt: "What are you craving?" },
    answer: { cuisines },
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

function regretSlot(scores: Record<string, number>): QuestionSlot {
  return {
    meta: { question_kind: "regret", prompt: "How excited are you?" },
    answer: { scores },
  };
}

/** A canonical v1.1 row — cuisine / budget / reputation / vibe / probe. */
function canonicalRow(overrides: Partial<VotesRow> = {}): VotesRow {
  return {
    user_id: overrides.user_id ?? "user-1",
    display_name: overrides.display_name ?? "alex",
    q1: overrides.q1 ?? cuisineSlot([]),
    q2: overrides.q2 ?? budgetSlot(4),
    q3: overrides.q3 ?? reputationSlot("no_preference"),
    q4: overrides.q4 ?? vibeSlot(2),
    q5: overrides.q5 ?? regretSlot({}),
  };
}

// ───────────────────────────────────────────────────────────────────────
// Happy path — canonical v1.1 row maps to the engine MemberVote.
// ───────────────────────────────────────────────────────────────────────

Deno.test("maps a canonical v1.1 row to the engine MemberVote shape", () => {
  const row = canonicalRow({
    user_id: "u7",
    display_name: "maya",
    q1: cuisineSlot(["mexican", "thai"]),
    q2: budgetSlot(2),
    q3: reputationSlot("hidden_gem"),
    q4: vibeSlot(3),
    q5: regretSlot({ pico: 5, ren: 2 }),
  });

  const vote = mapVotesRowToMemberVote(row);

  assertEquals(vote.user_id, "u7");
  assertEquals(vote.display_name, "maya");
  // Cuisine / reputation / vibe are soft preferences — they contribute
  // nothing to the engine's hard inputs.
  assertEquals(vote.q1_vetoes, []);
  assertEquals(vote.q2_budget, 2);
  assertEquals(vote.hard_vetoes, []);
  // The Q5 probe's per-candidate ratings are the engine score map.
  assertEquals(vote.scores, { pico: 5, ren: 2 });
});

// ───────────────────────────────────────────────────────────────────────
// TB-06 adjacency — the cuisine_craving + reputation kinds map cleanly.
// ───────────────────────────────────────────────────────────────────────

Deno.test("the v1.1 cuisine_craving + reputation kinds map without a throw", () => {
  // TB-06 reworded Q1 → cuisine_craving and Q3 → reputation and flagged
  // that the engine's QUESTION_KINDS set must learn them before a
  // verdict can fire over a v1.1 vote. This is that regression guard.
  const row = canonicalRow({
    q1: cuisineSlot(["italian"]),
    q3: reputationSlot("popular"),
  });
  const vote = mapVotesRowToMemberVote(row);
  // Both are soft — they neither veto nor throw.
  assertEquals(vote.hard_vetoes, []);
  assertEquals(vote.q1_vetoes, []);
});

// ───────────────────────────────────────────────────────────────────────
// Hard vetoes — dietary_veto + profile_veto feed the EBA prune.
// ───────────────────────────────────────────────────────────────────────

Deno.test("dietary_veto chips flow to q1_vetoes (hard veto)", () => {
  const row = canonicalRow({ q1: dietarySlot(["vegan", "shellfish"]) });
  const vote = mapVotesRowToMemberVote(row);
  assertEquals(vote.q1_vetoes, ["vegan", "shellfish"]);
});

Deno.test("profile_veto entries flow to the engine's generic hard_vetoes channel", () => {
  // TB-12 profile allergies / dietary / cuisine NEVERS land in a
  // profile_veto slot as `{ kind, token }` entries.
  const row = canonicalRow({
    q1: {
      meta: { question_kind: "profile_veto" },
      answer: {
        vetoes: [
          { kind: "tag", token: "no_peanut_unverified" },
          { kind: "cuisine_never", token: "sushi" },
          { kind: "garbage", token: "x" }, // unknown kind dropped
        ],
      },
    },
  });
  const vote = mapVotesRowToMemberVote(row);
  assertEquals(vote.hard_vetoes, [
    { kind: "tag", token: "no_peanut_unverified" },
    { kind: "cuisine_never", token: "sushi" },
  ]);
});

// ───────────────────────────────────────────────────────────────────────
// Schema-driven — dispatch is on question_kind, not on column position.
// ───────────────────────────────────────────────────────────────────────

Deno.test("dispatches on question_kind, not slot column — questions can move slots", () => {
  // Same answers, but the session put the probe in q1 and budget in q5.
  const scrambled: VotesRow = {
    user_id: "u9",
    display_name: "sam",
    q1: regretSlot({ a: 4 }),
    q2: cuisineSlot(["halal-spot"]),
    q3: vibeSlot(1),
    q4: reputationSlot("classic"),
    q5: budgetSlot(3),
  };
  const vote = mapVotesRowToMemberVote(scrambled);
  assertEquals(vote.scores, { a: 4 }, "probe answer was in slot q1 but still mapped");
  assertEquals(vote.q2_budget, 3, "budget answer was in slot q5 but still mapped");
});

Deno.test("the same answers in two different slot orders map identically", () => {
  const answers = {
    dietary: dietarySlot(["gluten"]),
    budget: budgetSlot(2),
    cuisine: cuisineSlot(["thai"]),
    vibe: vibeSlot(4),
    regret: regretSlot({ x: 3, y: 5 }),
  };
  const orderA: VotesRow = {
    user_id: "u1",
    display_name: "a",
    q1: answers.dietary,
    q2: answers.budget,
    q3: answers.cuisine,
    q4: answers.vibe,
    q5: answers.regret,
  };
  const orderB: VotesRow = {
    user_id: "u1",
    display_name: "a",
    q1: answers.regret,
    q2: answers.vibe,
    q3: answers.dietary,
    q4: answers.cuisine,
    q5: answers.budget,
  };
  assertEquals(
    mapVotesRowToMemberVote(orderA),
    mapVotesRowToMemberVote(orderB),
    "slot order is invisible to the mapping layer",
  );
});

// ───────────────────────────────────────────────────────────────────────
// Per-session metadata lives in jsonb — prompt copy churn is a no-op.
// ───────────────────────────────────────────────────────────────────────

Deno.test("question prompt / option copy changes do not affect the mapped answer", () => {
  const base = canonicalRow({ q2: budgetSlot(2) });
  const reworded: VotesRow = {
    ...base,
    q2: {
      meta: {
        question_kind: "budget_cap",
        prompt: "A completely different prompt string for this session",
        options: ["$", "$$", "$$$", "$$$$"],
      },
      answer: { tier: 2 },
    },
  };
  assertEquals(
    mapVotesRowToMemberVote(base).q2_budget,
    mapVotesRowToMemberVote(reworded).q2_budget,
    "prompt / options metadata is carried but never read by the mapper",
  );
});

// ───────────────────────────────────────────────────────────────────────
// Defensive handling.
// ───────────────────────────────────────────────────────────────────────

Deno.test("missing optional slots default to a no-constraint MemberVote", () => {
  const sparse: VotesRow = {
    user_id: "u1",
    display_name: "you",
    q1: null,
    q2: null,
    q3: null,
    q4: null,
    q5: regretSlot({ pico: 5 }),
  };
  const vote = mapVotesRowToMemberVote(sparse);
  assertEquals(vote.q1_vetoes, []);
  assertEquals(vote.q2_budget, 4, "absent budget cap defaults to the open tier");
  assertEquals(vote.hard_vetoes, []);
  assertEquals(vote.scores, { pico: 5 });
});

Deno.test("an unknown question_kind throws rather than silently dropping the answer", () => {
  const bad: VotesRow = canonicalRow({
    q3: {
      meta: { question_kind: "telepathy" },
      answer: {},
    } as unknown as QuestionSlot,
  });
  assertThrows(() => mapVotesRowToMemberVote(bad), Error, "telepathy");
});

Deno.test("QUESTION_KINDS enumerates exactly the engine-consumed kinds", () => {
  assertEquals(
    [...QUESTION_KINDS].sort(),
    [
      "budget_cap",
      "cuisine_craving",
      "dietary_veto",
      "profile_veto",
      "regret",
      "reputation",
      "vibe",
      "walk_minutes",
    ],
  );
});

// ───────────────────────────────────────────────────────────────────────
// Reroll diet-chip additions — `vetoes_extra` unions into q1_vetoes.
// ───────────────────────────────────────────────────────────────────────

Deno.test("dietary slot vetoes_extra (diet-reason reroll additions) union into q1_vetoes", () => {
  const row = canonicalRow({
    q1: {
      meta: { question_kind: "dietary_veto" },
      answer: { vetoes: ["vegan"], vetoes_extra: ["shellfish", "vegan"] },
    },
  });
  const vote = mapVotesRowToMemberVote(row);
  // Order-preserving, deduped case-insensitively — base chips first.
  assertEquals(vote.q1_vetoes, ["vegan", "shellfish"]);
});

// ───────────────────────────────────────────────────────────────────────
// Round-trip — typed answers wrap into slots and map back.
// ───────────────────────────────────────────────────────────────────────

Deno.test("buildVotesSlotsFromLegacyAnswers round-trips through the mapper", () => {
  const legacy = {
    q1_vetoes: [],
    q2_budget: 3,
    cuisines: ["thai"],
    reputation: "popular",
    q4_vibe: 1,
    q5_scores: { a: 4, b: 2 },
  };
  const slots = buildVotesSlotsFromLegacyAnswers(legacy);
  const row: VotesRow = {
    user_id: "u1",
    display_name: "you",
    q1: slots.q1,
    q2: slots.q2,
    q3: slots.q3,
    q4: slots.q4,
    q5: slots.q5,
  };
  const vote = mapVotesRowToMemberVote(row);
  assertEquals(vote.q2_budget, legacy.q2_budget);
  assertEquals(vote.scores, legacy.q5_scores);
  // Q1 wraps as cuisine_craving (soft) — it produces no hard veto.
  assertEquals(vote.q1_vetoes, []);
  assert(slots.q1.meta.question_kind === "cuisine_craving");
  assert(slots.q3.meta.question_kind === "reputation");
});
