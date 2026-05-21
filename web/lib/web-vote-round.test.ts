// GetToIt web — web-invitee vote-round integration test (tb-WF-10).
//
// Acceptance criterion: "a web-invitee vote round is readable by
// `compute-verdict` end-to-end." `compute-verdict` reads `votes` rows
// through the schema-driven mapping layer, which dispatches each slot on
// `meta.question_kind` and reads a kind-specific `answer` shape. This
// test drives a full web quiz round through `buildVoteRow` and asserts
// the resulting `q1`..`q5` slots carry exactly the kinds + `answer`
// shapes that mapping layer expects — so a verdict computed over a
// web-submitted row is correct.
//
// The wire CONTRACT itself is the shared leaf module `votes-wire.ts`
// (ADR 0014), imported by both this web path and the edge functions, so
// there is one definition. The edge-side read is pinned by
// `supabase/functions/_shared/votes-preference-inputs.test.ts`; this
// test pins the web-side build against the same contract.

import { describe, expect, it } from "vitest";

import { buildVoteRow } from "./quiz";
import { buildQ5Ratings, type QuizCandidate } from "./candidate-fetch";
import { QUESTION_KINDS } from "../../supabase/functions/_shared/votes-wire";

describe("web-invitee vote round → compute-verdict-readable row", () => {
  it("writes the five generic slots with the kinds the engine dispatches on", () => {
    const row = buildVoteRow({
      roomId: "11111111-1111-1111-1111-111111111111",
      userId: "22222222-2222-2222-2222-222222222222",
      cuisines: new Set(["mexican", "thai"]),
      noPreference: false,
      budget: 2,
      reputation: "hidden_gem",
      vibe: 3,
      q5Ratings: [
        { droppedAxis: "cuisine", score: 5 },
        { droppedAxis: "reputation", score: 2 },
        { droppedAxis: "vibe", score: 4 },
      ],
    });

    // Every slot's kind is in the canonical taxonomy the verdict-engine
    // mapping layer accepts — an unknown kind makes the mapper throw.
    for (const slot of [row.q1, row.q2, row.q3, row.q4, row.q5]) {
      expect(QUESTION_KINDS).toContain(slot.meta.question_kind);
    }

    // Q1 cuisine_craving — `mapVotesRowToPreferenceInputs` reads
    // `answer.cuisines` as the member's craved set.
    expect(row.q1.meta.question_kind).toBe("cuisine_craving");
    expect(row.q1.answer.cuisines).toEqual(["mexican", "thai"]);

    // Q2 budget_cap — `mapVotesRowToMemberVote` reads `answer.tier` as
    // the hard spend cap.
    expect(row.q2.meta.question_kind).toBe("budget_cap");
    expect(row.q2.answer.tier).toBe(2);

    // Q3 reputation — read as `answer.reputation`.
    expect(row.q3.meta.question_kind).toBe("reputation");
    expect(row.q3.answer.reputation).toBe("hidden_gem");

    // Q4 vibe — read as `answer.level`.
    expect(row.q4.meta.question_kind).toBe("vibe");
    expect(row.q4.answer.level).toBe(3);

    // Q5 regret — read as `answer.ratings`, the factorial probe.
    expect(row.q5.meta.question_kind).toBe("regret");
    expect(row.q5.answer.ratings).toEqual([
      { droppedAxis: "cuisine", score: 5 },
      { droppedAxis: "reputation", score: 2 },
      { droppedAxis: "vibe", score: 4 },
    ]);
  });

  it("the Q5 factorial probe round-trips from rated cards to the votes slot", () => {
    // The three strict-factorial cards the per-member fetch produced.
    const cards: QuizCandidate[] = [
      { id: "fsq-a", name: "A", meta: "", droppedAxis: "cuisine" },
      { id: "fsq-b", name: "B", meta: "", droppedAxis: "reputation" },
      { id: "fsq-c", name: "C", meta: "", droppedAxis: "vibe" },
    ];
    // The member rated each card (venue-keyed in the UI).
    const venueRatings = { "fsq-a": 4, "fsq-b": 1, "fsq-c": 5 };
    const q5Ratings = buildQ5Ratings(cards, venueRatings);

    const row = buildVoteRow({
      roomId: "r",
      userId: "u",
      cuisines: new Set(["mexican"]),
      noPreference: false,
      budget: 3,
      reputation: "popular",
      vibe: 2,
      q5Ratings,
    });

    // The slot carries one `{ droppedAxis, score }` entry per card —
    // the shape `readQ5Ratings` consumes to build the prefFn re-weight.
    expect(row.q5.answer.ratings).toEqual([
      { droppedAxis: "cuisine", score: 4 },
      { droppedAxis: "reputation", score: 1 },
      { droppedAxis: "vibe", score: 5 },
    ]);
  });

  it("a no-results Q5 round (no cards) writes an empty probe, not a fictitious one", () => {
    // The honest-degradation path (ADR 0013): no factorial-usable pool,
    // so no cards were shown. The probe is an empty array — the engine
    // tolerates it and degrades to the equal-weight prior.
    const q5Ratings = buildQ5Ratings([], {});
    const row = buildVoteRow({
      roomId: "r",
      userId: "u",
      cuisines: new Set(),
      noPreference: true,
      budget: 4,
      reputation: "no_preference",
      vibe: 2,
      q5Ratings,
    });
    expect(row.q5.answer.ratings).toEqual([]);
    // No-preference Q1 writes an empty craved set, never a faked one.
    expect(row.q1.answer.cuisines).toEqual([]);
  });
});
