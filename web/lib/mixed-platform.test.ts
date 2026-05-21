// GetToIt web — mixed-platform integration test (v1.1, tb-WF-10).
//
// Originally TB-15: "Integration tests for a mixed-platform room
// (iOS + web members) where both contribute to a verdict." This test
// proves two seams:
//
//   1. The web `buildVoteRow` emits the SAME generic `q1`..`q5` jsonb
//      wire shape iOS does — both platforms build the slot envelope via
//      the shared `votes-wire.ts` contract (ADR 0014), so the row
//      `compute-verdict` reads is platform-agnostic.
//   2. `shapeVerdictView` shapes the read-only verdict surface
//      identically to the iOS `VerdictStore`.
//
// tb-WF-10 brought the web quiz to v1.1: `buildVoteRow` now writes the
// generic-slot envelope, not the retired v1 typed columns. The verdict
// engine runs server-side in `compute-verdict`; here we pin the row
// contents for a deterministic input set.

import { describe, expect, it } from "vitest";

import { buildVoteRow } from "./quiz";

import {
  actionFor,
  shapeVerdictView,
  type CutRow,
  type OptionRow,
  type VerdictRow,
  type VoteSummaryRow,
} from "./verdict";

const ROOM_ID = "11111111-2222-3333-4444-555555555555";

const WEB_USER = "aaaaaaaa-0000-0000-0000-000000000001";
const IOS_USER_1 = "bbbbbbbb-0000-0000-0000-000000000002";
const IOS_USER_2 = "cccccccc-0000-0000-0000-000000000003";
const IOS_USER_3 = "dddddddd-0000-0000-0000-000000000004";

describe("mixed-platform room — web + iOS members", () => {
  // Step 1 — a web member submits their v1.1 vote. `buildVoteRow` wraps
  // the typed answers in the generic `{ meta, answer }` slot envelopes
  // — the SAME shape the iOS `QuizCoordinator.VoteRow` encoder emits.
  const webVoteRow = buildVoteRow({
    roomId: ROOM_ID,
    userId: WEB_USER,
    cuisines: new Set(["mexican", "thai"]),
    noPreference: false,
    budget: 2,
    reputation: "popular",
    vibe: 3, // wanted lively
    q5Ratings: [
      { droppedAxis: "cuisine", score: 5 },
      { droppedAxis: "reputation", score: 3 },
      { droppedAxis: "vibe", score: 3 },
    ],
  });

  it("web client emits the generic q1..q5 jsonb slots compute-verdict reads", () => {
    expect(webVoteRow.room_id).toBe(ROOM_ID);
    expect(webVoteRow.user_id).toBe(WEB_USER);
    // Generic envelope — dispatched on meta.question_kind, not column.
    expect(webVoteRow.q1.meta.question_kind).toBe("cuisine_craving");
    expect(webVoteRow.q1.answer.cuisines).toEqual(["mexican", "thai"]);
    expect(webVoteRow.q2.meta.question_kind).toBe("budget_cap");
    expect(webVoteRow.q2.answer.tier).toBe(2);
    expect(webVoteRow.q3.meta.question_kind).toBe("reputation");
    expect(webVoteRow.q3.answer.reputation).toBe("popular");
    expect(webVoteRow.q4.meta.question_kind).toBe("vibe");
    expect(webVoteRow.q4.answer.level).toBe(3);
    expect(webVoteRow.q5.meta.question_kind).toBe("regret");
    expect(webVoteRow.q5.answer.ratings).toEqual([
      { droppedAxis: "cuisine", score: 5 },
      { droppedAxis: "reputation", score: 3 },
      { droppedAxis: "vibe", score: 3 },
    ]);
  });

  // Step 2 — server-side, the engine writes a verdict + cuts. The
  // shaping helpers run identically on both clients. `VoteSummaryRow`
  // is the verdict-engine-projected receipt shape (the `verdict_for_room`
  // RPC projects the generic slots back to it server-side); the verdict
  // READ path is unchanged by tb-WF-10.
  const verdictRow: VerdictRow = {
    id: "v-1",
    room_id: ROOM_ID,
    option_id: "o-pico",
    computed_at: "2026-05-14T19:30:00Z",
    method: "quorum",
    rule_text: "Budget cap cut Ren Soba. Pico's had the lowest regret-of-omission.",
  };

  const winningOption: OptionRow = {
    id: "o-pico",
    payload: {
      name: "Pico's Taqueria",
      categories: ["Mexican"],
      price_tier: 2,
      walk_minutes_estimate: 8,
    },
  };

  const cuts: CutRow[] = [
    {
      verdict_id: "v-1",
      option_id: "o-ren",
      cut_reason: "budget",
      cut_text: "over budget cap",
    },
  ];

  const cutOptions: Record<string, OptionRow> = {
    "o-ren": {
      id: "o-ren",
      payload: { name: "Ren Soba", price_tier: 4 },
    },
  };

  const allVotes: VoteSummaryRow[] = [
    {
      user_id: WEB_USER,
      q1_vetoes: ["shellfish"],
      q2_budget: 2,
      q3_walk_minutes: 15,
      q4_vibe: 3,
      q5_regret: { "o-pico": 5 },
    },
    {
      user_id: IOS_USER_1,
      q1_vetoes: ["shellfish"],
      q2_budget: 4,
      q3_walk_minutes: 30,
      q4_vibe: 2,
      q5_regret: { "o-pico": 4 },
    },
    {
      user_id: IOS_USER_2,
      q1_vetoes: [],
      q2_budget: 2,
      q3_walk_minutes: 30,
      q4_vibe: 2,
      q5_regret: { "o-pico": 4 },
    },
    {
      user_id: IOS_USER_3,
      q1_vetoes: [],
      q2_budget: 4,
      q3_walk_minutes: 15,
      q4_vibe: 2,
      q5_regret: { "o-pico": 4 },
    },
  ];

  it("shapes the same verdict view on the web client as iOS would", () => {
    const view = shapeVerdictView({
      verdict: verdictRow,
      winningOption,
      cuts,
      cutOptions,
      votes: allVotes,
      memberCount: allVotes.length,
    });
    expect(view).not.toBeNull();
    if (view?.mode !== "default") throw new Error("expected default mode");

    expect(view.placeName).toBe("Pico's Taqueria");
    expect(view.metaLine).toBe("Mexican · $$ · 8 min walk");
    expect(view.timeBadge.audience).toBe("All four of you");
    expect(view.ruleText).toBe(verdictRow.rule_text);

    expect(view.cuts).toEqual([
      { name: "Ren Soba", reason: "over budget cap" },
    ]);

    expect(view.receipts).toHaveLength(allVotes.length);
    const byUser = Object.fromEntries(
      view.receipts.map((r, i) => [allVotes[i].user_id, r.action]),
    );
    expect(byUser[WEB_USER]).toBe(actionFor(allVotes[0]));
    expect(byUser[IOS_USER_1]).toBe("filtered shellfish");
    expect(byUser[IOS_USER_2]).toBe("capped at $$");
    expect(byUser[IOS_USER_3]).toBe("capped at 15 min walk");
  });
});
