// tb-WF-1 — boundary test for the Plan lifecycle transition.
//
// The acceptance boundary on this side: after a successful verdict
// fire, the handler invokes `set_plan_decided_active` exactly when
// the Room carries a non-null `plan_id`. Rooms with NULL `plan_id`
// (the legacy / pre-workflow-overhaul path) trigger no Plan write
// at all — the legacy compute-verdict behavior is unchanged.
//
// Failure modes the tests pin:
//   * room.plan_id = "abc" → setPlanDecidedActive called with "abc".
//   * room.plan_id = null  → setPlanDecidedActive NEVER called.
//   * verdict.option_id null (no_survivor) → setPlanDecidedActive
//     still called when plan_id is non-null (sg-WF-6 may add a
//     no-survivor branch; for now the Plan transitions on ANY
//     terminal verdict, since the Plan owns the reroll window).
//   * setPlanDecidedActive throws → handler logs and still returns
//     200 (best-effort, same pattern as markRoomVerdictReady).
//
// References:
//   * gti-vault/15_issues/0.1.0/issues/tb-wf-1-plans-table-schema.md
//   * supabase/migrations/20260519000000000_workflow_overhaul_plans_table.sql
//     (the function this handler is calling)

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type ComputeVerdictDataAdapter,
  handleRequest,
  type MemberVoteRow,
  type OptionCutInsert,
  type RoomOptionRow,
  type VerdictInsert,
  type VerdictRow,
} from "./handler.ts";
import type { HardVeto } from "../_shared/verdict-engine.ts";
import { withMutedConsole } from "../_shared/test-console.ts";

const VALID_ROOM_ID = "11111111-1111-1111-1111-111111111111";
const PLAN_ID = "22222222-2222-2222-2222-222222222222";

function envOk() {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  };
}

function authedPost(body: unknown): Request {
  return new Request("https://example/compute-verdict", {
    method: "POST",
    headers: {
      Authorization: "Bearer test",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

interface PlanAwareSeed {
  /** The room object returned by `fetchRoom`. `plan_id` may be null. */
  room?: { id: string; plan_id?: string | null } | null;
  options?: RoomOptionRow[];
  votes?: MemberVoteRow[];
  existing?: VerdictRow | null;
  profileVetoes?: Record<string, HardVeto[]>;
  /** When true, `setPlanDecidedActive` throws so the handler's
   *  best-effort branch is exercised. */
  failPlanTransition?: boolean;
}

interface PlanAwareAdapterState {
  adapter: ComputeVerdictDataAdapter;
  inserts: VerdictInsert[];
  cuts: OptionCutInsert[][];
  marked: string[];
  broadcasts: Array<{ room_id: string; verdict_id: string }>;
  /** Plan ids the handler asked the adapter to flip. Empty when the
   *  handler skipped the call (legacy / null-plan path). */
  planTransitions: string[];
}

function planAwareAdapter(seed: PlanAwareSeed = {}): PlanAwareAdapterState {
  const inserts: VerdictInsert[] = [];
  const cuts: OptionCutInsert[][] = [];
  const marked: string[] = [];
  const broadcasts: Array<{ room_id: string; verdict_id: string }> = [];
  const planTransitions: string[] = [];

  // The handler's fetchRoom expects `{ id }`. We extend the shape
  // here so the test can seed a `plan_id` — the handler's typed
  // signature reads only `id`, but the runtime object can carry
  // extra fields; the handler now passes `plan_id` through to
  // setPlanDecidedActive.
  const room = seed.room === undefined
    ? { id: VALID_ROOM_ID, plan_id: null }
    : seed.room;

  const adapter: ComputeVerdictDataAdapter = {
    async fetchRoom(_id) {
      return room as unknown as { id: string } | null;
    },
    async fetchOptions(_id) {
      return seed.options ?? [];
    },
    async fetchVotes(_id) {
      return seed.votes ?? [];
    },
    async existingVerdict(_id) {
      return seed.existing ?? null;
    },
    async insertVerdict(row) {
      inserts.push(row);
      return {
        id: "verdict-1",
        room_id: row.room_id,
        option_id: row.option_id,
        method: row.method,
        rule_text: row.rule_text,
        computed_at: "2026-05-19T00:00:00Z",
      };
    },
    async insertOptionCuts(rows) {
      cuts.push(rows);
    },
    async markRoomVerdictReady(room_id) {
      marked.push(room_id);
    },
    async emitVerdictReadyBroadcast(room_id, verdict_id) {
      broadcasts.push({ room_id, verdict_id });
    },
    async fetchRoomRadius(_id) {
      return null;
    },
    async deleteVerdictForRoom(_id) {
      // no-op
    },
    async fetchProfileVetoes(user_ids) {
      const out: Record<string, HardVeto[]> = {};
      const map = seed.profileVetoes ?? {};
      for (const id of user_ids) {
        if (map[id]) out[id] = map[id];
      }
      return out;
    },
    async setPlanDecidedActive(plan_id) {
      if (seed.failPlanTransition) {
        throw new Error("simulated transition failure");
      }
      planTransitions.push(plan_id);
    },
  };

  return { adapter, inserts, cuts, marked, broadcasts, planTransitions };
}

// ── happy paths ─────────────────────────────────────────────────────

Deno.test(
  "tb-WF-1 — verdict on a plan-linked room flips the Plan to decided-active",
  async () => {
    const state = planAwareAdapter({
      room: { id: VALID_ROOM_ID, plan_id: PLAN_ID },
      options: [
        { id: "opt-pico", payload: { name: "Pico's", price_tier: 2 } },
        { id: "opt-ren",  payload: { name: "Ren",    price_tier: 3 } },
      ],
      votes: [
        {
          user_id: "u1", display_name: "you",
          q1_vetoes: [], q2_budget: 4, hard_vetoes: [],
          scores: { "opt-pico": 5, "opt-ren": 2 },
        },
        {
          user_id: "u2", display_name: "alex",
          q1_vetoes: [], q2_budget: 4, hard_vetoes: [],
          scores: { "opt-pico": 5, "opt-ren": 2 },
        },
      ],
    });

    const res = await handleRequest(
      authedPost({ room_id: VALID_ROOM_ID }),
      { env: envOk(), buildDataAdapter: () => state.adapter },
    );

    assertEquals(res.status, 200);
    assertEquals(state.inserts.length, 1, "verdict must still be inserted");
    assertEquals(
      state.planTransitions,
      [PLAN_ID],
      "expected setPlanDecidedActive(plan_id) to fire exactly once for the linked Plan",
    );
  },
);

Deno.test(
  "tb-WF-1 — legacy room without plan_id skips the Plan transition entirely",
  async () => {
    const state = planAwareAdapter({
      room: { id: VALID_ROOM_ID, plan_id: null },
      options: [
        { id: "opt-pico", payload: { name: "Pico's", price_tier: 2 } },
      ],
      votes: [
        {
          user_id: "u1", display_name: "you",
          q1_vetoes: [], q2_budget: 4, hard_vetoes: [],
          scores: { "opt-pico": 5 },
        },
      ],
    });

    const res = await handleRequest(
      authedPost({ room_id: VALID_ROOM_ID }),
      { env: envOk(), buildDataAdapter: () => state.adapter },
    );

    assertEquals(res.status, 200);
    assertEquals(state.inserts.length, 1, "verdict still writes");
    assertEquals(
      state.planTransitions,
      [],
      "the legacy path (no plan_id) must NEVER call setPlanDecidedActive",
    );
  },
);

Deno.test(
  "tb-WF-1 — no_survivor verdict on a plan-linked room still transitions the Plan",
  async () => {
    // bug-13 — an empty pool is a terminal no_survivor outcome that
    // still lands a verdict row + advances the room out of `firing`.
    // For workflow-overhaul, the Plan transitions on ANY terminal
    // verdict — the Plan list surface will render a `no_survivor`
    // Plan as `decided-active` until sg-WF-6 closes the window.
    const state = planAwareAdapter({
      room: { id: VALID_ROOM_ID, plan_id: PLAN_ID },
      options: [],
      votes: [
        {
          user_id: "u1", display_name: "you",
          q1_vetoes: [], q2_budget: 4, hard_vetoes: [], scores: {},
        },
      ],
    });

    const res = await handleRequest(
      authedPost({ room_id: VALID_ROOM_ID }),
      { env: envOk(), buildDataAdapter: () => state.adapter },
    );

    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.verdict.method, "no_survivor");
    assertEquals(body.verdict.option_id, null);
    assertEquals(
      state.planTransitions,
      [PLAN_ID],
      "the Plan transitions on ANY terminal verdict, including no_survivor",
    );
  },
);

Deno.test(
  "tb-WF-1 — setPlanDecidedActive failure does NOT fail the verdict response",
  async () => {
    await withMutedConsole(["warn"], async () => {
      // The transition is best-effort, same pattern as
      // markRoomVerdictReady and emitVerdictReadyBroadcast. A failure
      // is logged but the user-facing 200 still resolves — the verdict
      // surface is already navigable from the broadcast, and a retry
      // path will reconcile the Plan on the next verdict-state read.
      const state = planAwareAdapter({
        room: { id: VALID_ROOM_ID, plan_id: PLAN_ID },
        options: [
          { id: "opt-pico", payload: { name: "Pico's", price_tier: 2 } },
        ],
        votes: [
          {
            user_id: "u1",
            display_name: "you",
            q1_vetoes: [],
            q2_budget: 4,
            hard_vetoes: [],
            scores: { "opt-pico": 5 },
          },
        ],
        failPlanTransition: true,
      });

      const res = await handleRequest(
        authedPost({ room_id: VALID_ROOM_ID }),
        { env: envOk(), buildDataAdapter: () => state.adapter },
      );

      assertEquals(
        res.status,
        200,
        "a failing plan transition must not propagate; verdict still resolves 200",
      );
      assertEquals(
        state.inserts.length,
        1,
        "verdict still writes through the failure",
      );
      assert(
        state.broadcasts.length === 1,
        "broadcast still emits — independent of the plan transition",
      );
    });
  },
);
