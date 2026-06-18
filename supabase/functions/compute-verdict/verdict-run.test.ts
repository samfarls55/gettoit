import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type {
  MemberVoteRow,
  RoomOptionRow,
  VerdictInsert,
  VerdictRow,
} from "./handler.ts";
import { runVerdictForRoom, type VerdictRunStore } from "./verdict-run.ts";

const ROOM_ID = "11111111-1111-1111-1111-111111111111";
const PLAN_ID = "22222222-2222-2222-2222-222222222222";
const allWeekDinnerHours = Array.from({ length: 7 }, (_, day) => ({
  open: { day, hour: 18, minute: 0 },
  close: { day, hour: 22, minute: 0 },
}));

function option(id: string): RoomOptionRow {
  return {
    id,
    payload: {
      name: id,
      price_tier: 2,
      rating: 4.2,
      user_rating_count: 30,
      total_ratings: 30,
      distance_meters: 100,
      current_open_now: true,
      regular_opening_periods: allWeekDinnerHours,
      dine_in: true,
    },
    google_place_id: `google-${id}`,
    place_provider: "google",
  };
}

function vote(scores: Record<string, number>): MemberVoteRow {
  return {
    user_id: "u1",
    display_name: "u1",
    q1_vetoes: [],
    q2_budget: 4,
    hard_vetoes: [],
    scores,
  };
}

Deno.test("TB-33: Verdict Run owns execution and uses behavior-level store methods", async () => {
  const calls: string[] = [];
  const insertedVerdicts: VerdictInsert[] = [];
  const store: VerdictRunStore = {
    async loadRerollState(roomId) {
      calls.push(`loadRerollState:${roomId}`);
      return null;
    },
    async readExistingVerdict(roomId) {
      calls.push(`readExistingVerdict:${roomId}`);
      return null;
    },
    async deleteVerdictForRoom(roomId) {
      calls.push(`deleteVerdictForRoom:${roomId}`);
    },
    async loadRoom(roomId) {
      calls.push(`loadRoom:${roomId}`);
      return { id: roomId, plan_id: PLAN_ID };
    },
    async loadActiveMemberIds(roomId) {
      calls.push(`loadActiveMemberIds:${roomId}`);
      return ["u1"];
    },
    async loadVotes(roomId) {
      calls.push(`loadVotes:${roomId}`);
      return [vote({ "opt-a": 5, "opt-b": 2 })];
    },
    async loadCandidatePool(roomId, context) {
      calls.push(`loadCandidatePool:${roomId}:${context.votes.length}`);
      return [option("opt-a"), option("opt-b")];
    },
    async loadRoomRadius(roomId) {
      calls.push(`loadRoomRadius:${roomId}`);
      return null;
    },
    async loadProfileVetoes(userIds) {
      calls.push(`loadProfileVetoes:${userIds.join(",")}`);
      return {};
    },
    async loadPreviousWinnerName(roomId) {
      calls.push(`loadPreviousWinnerName:${roomId}`);
      return null;
    },
    async persistVerdictRun(input) {
      calls.push(`persistVerdictRun:${input.result.method}`);
      insertedVerdicts.push({
        room_id: input.roomId,
        option_id: input.result.winning_option_id,
        method: input.result.method,
        rule_text: input.result.rule_text,
        winner_place_provider: "google",
        winner_google_place_id: input.result.slate[0]?.google_place_id ?? null,
        final_fit_score: input.result.slate[0]?.final_fit_score ?? null,
        scoring_version: input.result.slate[0]?.scoring_version ?? null,
        receipts: input.result.receipts,
        reroll_reason: input.rerollReason,
      });
      return {
        verdict: {
          id: "verdict-1",
          room_id: input.roomId,
          option_id: input.result.winning_option_id,
          method: input.result.method,
          rule_text: input.result.rule_text,
          computed_at: "2026-06-17T00:00:00Z",
        } satisfies VerdictRow,
        cuts: input.result.cuts,
      };
    },
    async publishVerdictReady(roomId, verdictId) {
      calls.push(`publishVerdictReady:${roomId}:${verdictId}`);
    },
    async transitionPlanDecidedActive(planId) {
      calls.push(`transitionPlanDecidedActive:${planId}`);
    },
  };

  const result = await runVerdictForRoom({
    roomId: ROOM_ID,
    method: "manual",
    env: {},
    store,
  });

  assertEquals(result.kind, "computed");
  assertEquals(insertedVerdicts[0].option_id, "opt-a");
  assertEquals(
    calls,
    [
      `loadRerollState:${ROOM_ID}`,
      `readExistingVerdict:${ROOM_ID}`,
      `loadRoom:${ROOM_ID}`,
      `loadActiveMemberIds:${ROOM_ID}`,
      `loadVotes:${ROOM_ID}`,
      `loadCandidatePool:${ROOM_ID}:1`,
      `loadRoomRadius:${ROOM_ID}`,
      "loadProfileVetoes:u1",
      "persistVerdictRun:manual",
      `publishVerdictReady:${ROOM_ID}:verdict-1`,
      `transitionPlanDecidedActive:${PLAN_ID}`,
    ],
  );
});
