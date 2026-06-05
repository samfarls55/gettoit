// GetToIt web — mixed-platform vote-wire test (quiz redesign, tb-WF-10).
//
// Originally TB-15: "Integration tests for a mixed-platform room
// (mobile + web members) where both contribute to a verdict." This test
// pins the one seam that still has a meaningful platform-parity
// contract:
//
//   The web `buildVoteRow` emits the SAME generic `q1`..`q5` jsonb
//   wire shape the mobile app does — both platforms build the slot envelope via
//   the shared `votes-wire.ts` contract (ADR 0014), so the row
//   `compute-verdict` reads is platform-agnostic.
//
// tb-WF-10 brought the web quiz to the redesign: `buildVoteRow` now writes the
// generic-slot envelope, not the retired pre-redesign typed columns. The verdict
// engine runs server-side in `compute-verdict`.
//
// bug-17 — the verdict READ path no longer mirrors the mobile app. The web
// invitee verdict surface conforms to the locked `web-01-invitee-shell`
// §C "Read-only verdict card" (plan name + verdict venue only); the mobile app
// keeps its full receipt surface. Web/mobile verdict-view parity is no
// longer a goal, so the former `shapeVerdictView` parity assertion is
// gone — `shapeVerdictView` is unit-tested against the §C shape in
// `verdict.test.ts`.

import { describe, expect, it } from "vitest";

import { buildVoteRow } from "./quiz";

const ROOM_ID = "11111111-2222-3333-4444-555555555555";
const WEB_USER = "aaaaaaaa-0000-0000-0000-000000000001";

describe("mixed-platform room — web + mobile vote wire", () => {
  // A web member submits their redesigned-quiz vote. `buildVoteRow` wraps the
  // typed answers in the generic `{ meta, answer }` slot envelopes —
  // the SAME shape the legacy Swift `QuizCoordinator.VoteRow` encoder emitted, so
  // `compute-verdict` reads a platform-agnostic row.
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
});
