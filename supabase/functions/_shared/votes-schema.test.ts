// votes-schema mapping-layer tests (TB-04).
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
// These tests pin the contract: the same five answers produce the
// same `MemberVote` regardless of which q-slot each lands in.

import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
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
    meta: { question_kind: "dietary_veto", prompt: "Anything off the menu tonight?" },
    answer: { vetoes },
  };
}

function budgetSlot(tier: number): QuestionSlot {
  return {
    meta: { question_kind: "budget_cap", prompt: "Where's the ceiling?" },
    answer: { tier },
  };
}

function walkSlot(minutes: number): QuestionSlot {
  return {
    meta: { question_kind: "walk_minutes", prompt: "How far will you walk?" },
    answer: { minutes },
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
    meta: { question_kind: "regret", prompt: "Rate the candidates." },
    answer: { scores },
  };
}

/** A canonical row — slots in the historical q1..q5 order. */
function canonicalRow(overrides: Partial<VotesRow> = {}): VotesRow {
  return {
    user_id: overrides.user_id ?? "user-1",
    display_name: overrides.display_name ?? "alex",
    q1: overrides.q1 ?? dietarySlot([]),
    q2: overrides.q2 ?? budgetSlot(4),
    q3: overrides.q3 ?? walkSlot(30),
    q4: overrides.q4 ?? vibeSlot(2),
    q5: overrides.q5 ?? regretSlot({}),
  };
}

// ───────────────────────────────────────────────────────────────────────
// Happy path — canonical q1..q5 order maps to the engine MemberVote.
// ───────────────────────────────────────────────────────────────────────

Deno.test("maps a canonical row to the engine MemberVote shape", () => {
  const row = canonicalRow({
    user_id: "u7",
    display_name: "maya",
    q1: dietarySlot(["vegan", "shellfish"]),
    q2: budgetSlot(2),
    q3: walkSlot(15),
    q4: vibeSlot(3),
    q5: regretSlot({ pico: 5, ren: 2 }),
  });

  const vote = mapVotesRowToMemberVote(row);

  assertEquals(vote.user_id, "u7");
  assertEquals(vote.display_name, "maya");
  assertEquals(vote.q1_vetoes, ["vegan", "shellfish"]);
  assertEquals(vote.q2_budget, 2);
  assertEquals(vote.q3_walk_minutes, 15);
  assertEquals(vote.q4_vibe, 3);
  assertEquals(vote.q5_regret, { pico: 5, ren: 2 });
});

// ───────────────────────────────────────────────────────────────────────
// Schema-driven — dispatch is on question_kind, not on column position.
// ───────────────────────────────────────────────────────────────────────

Deno.test("dispatches on question_kind, not slot column — questions can move slots", () => {
  // Same five answers, but the session put vibe in q3 and walk in q4.
  const scrambled: VotesRow = {
    user_id: "u9",
    display_name: "sam",
    q1: dietarySlot(["halal"]),
    q2: budgetSlot(3),
    q3: vibeSlot(1),
    q4: walkSlot(10),
    q5: regretSlot({ a: 4 }),
  };

  const vote = mapVotesRowToMemberVote(scrambled);

  // The mapper read the metadata, not the column name.
  assertEquals(vote.q4_vibe, 1, "vibe answer was in slot q3 but still mapped");
  assertEquals(vote.q3_walk_minutes, 10, "walk answer was in slot q4 but still mapped");
  assertEquals(vote.q1_vetoes, ["halal"]);
  assertEquals(vote.q2_budget, 3);
  assertEquals(vote.q5_regret, { a: 4 });
});

Deno.test("a row with the SAME answers in two different slot orders maps identically", () => {
  const answers = {
    dietary: dietarySlot(["gluten"]),
    budget: budgetSlot(2),
    walk: walkSlot(20),
    vibe: vibeSlot(4),
    regret: regretSlot({ x: 3, y: 5 }),
  };

  const orderA: VotesRow = {
    user_id: "u1", display_name: "a",
    q1: answers.dietary, q2: answers.budget, q3: answers.walk,
    q4: answers.vibe, q5: answers.regret,
  };
  const orderB: VotesRow = {
    user_id: "u1", display_name: "a",
    q1: answers.regret, q2: answers.vibe, q3: answers.dietary,
    q4: answers.walk, q5: answers.budget,
  };

  const voteA = mapVotesRowToMemberVote(orderA);
  const voteB = mapVotesRowToMemberVote(orderB);
  assertEquals(voteA, voteB, "slot order is invisible to the mapping layer");
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
  // Only the regret slot present — the rest absent (null jsonb).
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
  assertEquals(vote.q3_walk_minutes, 30, "absent walk threshold defaults to the open ceiling");
  assertEquals(vote.q4_vibe, 2, "absent vibe defaults to the neutral mid level");
  assertEquals(vote.q5_regret, { pico: 5 });
});

Deno.test("an unknown question_kind throws rather than silently dropping the answer", () => {
  const bad: VotesRow = canonicalRow({
    q3: { meta: { question_kind: "telepathy" }, answer: {} } as unknown as QuestionSlot,
  });
  assertThrows(
    () => mapVotesRowToMemberVote(bad),
    Error,
    "telepathy",
  );
});

Deno.test("QUESTION_KINDS enumerates exactly the five engine-consumed kinds", () => {
  assertEquals(
    [...QUESTION_KINDS].sort(),
    ["budget_cap", "dietary_veto", "regret", "vibe", "walk_minutes"],
  );
});

Deno.test("soft_cuisine_vetoes carried on the dietary slot answer flow through", () => {
  const row = canonicalRow({
    q1: {
      meta: { question_kind: "dietary_veto" },
      answer: { vetoes: ["shellfish"], soft_cuisine_vetoes: ["japanese"] },
    },
  });
  const vote = mapVotesRowToMemberVote(row);
  assertEquals(vote.q1_vetoes, ["shellfish"]);
  assert(vote.soft_cuisine_vetoes?.includes("japanese"));
});

// ───────────────────────────────────────────────────────────────────────
// Reroll diet-chip additions — `vetoes_extra` unions into q1_vetoes.
// ───────────────────────────────────────────────────────────────────────

Deno.test("dietary slot vetoes_extra (diet-reason reroll additions) union into q1_vetoes", () => {
  // A diet-reason reroll appends chips to the dietary slot's
  // `answer.vetoes_extra` rather than mutating the immutable `vetoes`.
  // The mapping layer is the single place that unions the two.
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
// Round-trip — legacy typed answers wrap into slots and map back.
// ───────────────────────────────────────────────────────────────────────

Deno.test("buildVotesSlotsFromLegacyAnswers round-trips through the mapper", async () => {
  const { buildVotesSlotsFromLegacyAnswers } = await import("./votes-schema.ts");
  const legacy = {
    q1_vetoes: ["halal"],
    q2_budget: 3,
    q3_walk_minutes: 10,
    q4_vibe: 1,
    q5_regret: { a: 4, b: 2 },
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
  assertEquals(vote.q1_vetoes, legacy.q1_vetoes);
  assertEquals(vote.q2_budget, legacy.q2_budget);
  assertEquals(vote.q3_walk_minutes, legacy.q3_walk_minutes);
  assertEquals(vote.q4_vibe, legacy.q4_vibe);
  assertEquals(vote.q5_regret, legacy.q5_regret);
});
