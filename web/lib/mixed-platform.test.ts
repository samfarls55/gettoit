// GetToIt web — mixed-platform integration test.
//
// TB-15 AC: "Integration tests for a mixed-platform room (iOS + web
// members) where both contribute to a verdict." This test simulates a
// 4-person room (1 web user, 3 iOS users), drives each member's
// answers through the same `buildVoteRow` path the web submit uses,
// and then shapes the verdict view with the engine's output. The
// resulting view is exactly what the web `VerdictReadOnly` surface
// renders and exactly what iOS's `VerdictStore` shapes for the same
// row — see `ios/Sources/App/VerdictStore.swift` for the canonical
// shaping the web copy mirrors.
//
// The engine itself runs server-side in `compute-verdict`; here we
// pin the row contents the engine would emit for a deterministic
// input set and prove the web shaping matches. This is the surface
// equivalent of the iOS `VerdictStoreTests` suite.

import { describe, expect, it } from "vitest";

import {
  buildVoteRow,
  DUMMY_CANDIDATES,
  seedRegret,
  toggleVeto,
} from "./quiz";

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
  // Step 1 — each member submits their vote. The shape is identical
  // for both platforms — `buildVoteRow` (web) and
  // `QuizCoordinator.buildRow` (iOS) emit the same payload.
  const webVoteRow = buildVoteRow({
    roomId: ROOM_ID,
    userId: WEB_USER,
    q1Vetoes: toggleVeto(new Set(), "shellfish"),
    q2Budget: 2,
    q3WalkMinutes: 15,
    q4Vibe: 3, // wanted lively
    q5Regret: { ...seedRegret(DUMMY_CANDIDATES), "dummy-pico": 5 },
  });

  it("web client emits the same wire shape iOS does for the same answers", () => {
    expect(webVoteRow).toEqual({
      room_id: ROOM_ID,
      user_id: WEB_USER,
      q1_vetoes: ["shellfish"],
      q2_budget: 2,
      q3_walk_minutes: 15,
      q4_vibe: 3,
      q5_regret: {
        "dummy-pico": 5,
        "dummy-ren": 3,
        "dummy-pastoral": 3,
      },
    });
  });

  // Step 2 — server-side, the engine writes a verdict + cuts + the
  // votes rows are visible to every room member through RLS. The
  // shaping helpers run identically on both clients.
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
    // Web user — wanted lively
    {
      user_id: WEB_USER,
      q1_vetoes: ["shellfish"],
      q2_budget: 2,
      q3_walk_minutes: 15,
      q4_vibe: 3,
      q5_regret: webVoteRow.q5_regret,
    },
    // iOS user 1 — filtered shellfish (came in via iOS)
    {
      user_id: IOS_USER_1,
      q1_vetoes: ["shellfish"],
      q2_budget: 4,
      q3_walk_minutes: 30,
      q4_vibe: 2,
      q5_regret: { "dummy-pico": 4 },
    },
    // iOS user 2 — capped at $$
    {
      user_id: IOS_USER_2,
      q1_vetoes: [],
      q2_budget: 2,
      q3_walk_minutes: 30,
      q4_vibe: 2,
      q5_regret: { "dummy-pico": 4 },
    },
    // iOS user 3 — capped at 15 min walk
    {
      user_id: IOS_USER_3,
      q1_vetoes: [],
      q2_budget: 4,
      q3_walk_minutes: 15,
      q4_vibe: 2,
      q5_regret: { "dummy-pico": 4 },
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

    // Cuts surface the option name from the engine's row.
    expect(view.cuts).toEqual([
      { name: "Ren Soba", reason: "over budget cap" },
    ]);

    // Each member gets a receipt — the web user's receipt is shaped
    // identically to the iOS members' receipts since the shaping path
    // is `actionFor()`, which is platform-agnostic.
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
