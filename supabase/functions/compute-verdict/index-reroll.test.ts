// HTTP-layer tests for the `compute-verdict` Edge Function — TB-10
// reroll integration. Exercises:
//   * Reroll runs bypass the "already_computed" idempotency short-circuit.
//   * `last_reroll_reason` is forwarded into the engine + stamped on the
//     new `verdicts` row.
//   * `excluded_option_ids` filter the pool before pruning.
//   * `budget_tier_override` / `walk_minutes_override` tighten per-member
//     caps.
//   * `q1_vetoes_extra` are merged with `q1_vetoes` before pruning.

import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type ComputeVerdictDataAdapter,
  handleRequest,
  type MemberVoteRow,
  type OptionCutInsert,
  type RoomOptionRow,
  type RoomRerollState,
  type VerdictInsert,
  type VerdictRow,
  mergeQ1Vetoes,
} from "./handler.ts";

function envOk() {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  };
}

interface RerollAdapterSeed {
  room?: { id: string } | null;
  options?: RoomOptionRow[];
  votes?: MemberVoteRow[];
  existing?: VerdictRow | null;
  rerollState?: RoomRerollState;
  previousWinnerName?: string | null;
}

interface RerollAdapterState {
  adapter: ComputeVerdictDataAdapter;
  inserts: VerdictInsert[];
  cuts: OptionCutInsert[][];
  deletedRooms: string[];
}

function memoryAdapter(seed: RerollAdapterSeed = {}): RerollAdapterState {
  const inserts: VerdictInsert[] = [];
  const cuts: OptionCutInsert[][] = [];
  const deletedRooms: string[] = [];
  const adapter: ComputeVerdictDataAdapter = {
    async fetchRoom(_id) {
      return seed.room === undefined
        ? { id: "00000000-0000-0000-0000-000000000001" }
        : seed.room;
    },
    async fetchOptions(_id) { return seed.options ?? []; },
    async fetchVotes(_id) { return seed.votes ?? []; },
    async existingVerdict(_id) { return seed.existing ?? null; },
    async insertVerdict(row) {
      inserts.push(row);
      return {
        id: "verdict-1",
        room_id: row.room_id,
        option_id: row.option_id,
        method: row.method,
        rule_text: row.rule_text,
        computed_at: "2026-05-14T00:00:00Z",
      };
    },
    async insertOptionCuts(rows) { cuts.push(rows); },
    async markRoomVerdictReady(_id) {},
    async emitVerdictReadyBroadcast(_a, _b) {},
    async fetchRoomRadius(_id) { return null; },
    async deleteVerdictForRoom(id) { deletedRooms.push(id); },
    async fetchRoomRerollState(_id) {
      return seed.rerollState ?? {
        excluded_option_ids: [],
        budget_tier_override: null,
        walk_minutes_override: null,
        last_reroll_reason: null,
      };
    },
    async fetchPreviousWinnerName(_id) {
      return seed.previousWinnerName ?? null;
    },
  };
  return { adapter, inserts, cuts, deletedRooms };
}

const VALID_ROOM_ID = "11111111-1111-1111-1111-111111111111";

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

// ───────────────────────────────────────────────────────────────────────
// Reroll bypasses idempotency
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict reroll — bypasses already_computed when last_reroll_reason is set", async () => {
  // A verdict exists but the room is in a post-apply_reroll state.
  // The handler must re-run and write a fresh verdict rather than
  // returning the stale one.
  const existing: VerdictRow = {
    id: "v-stale",
    room_id: VALID_ROOM_ID,
    option_id: "opt-stale",
    method: "manual",
    rule_text: "Old rule.",
    computed_at: "2026-05-13T00:00:00Z",
  };

  const { adapter, inserts, deletedRooms } = memoryAdapter({
    existing,
    rerollState: {
      excluded_option_ids: [],
      budget_tier_override: null,
      walk_minutes_override: null,
      last_reroll_reason: "cost",
    },
    options: [
      { id: "opt-ren", payload: { name: "Ren Soba", price_tier: 2 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "alex",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-ren": 5 },
      },
    ],
    previousWinnerName: "Pico's",
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.already_computed, undefined);
  // The stale verdict was deleted so the fresh row could land.
  assert(
    deletedRooms.includes(VALID_ROOM_ID),
    "stale post-reroll verdict must be deleted before fresh insert",
  );
  assertEquals(inserts.length, 1, "fresh verdict must be inserted");
  assertEquals(inserts[0].reroll_reason, "cost");
});

Deno.test("compute-verdict reroll — clean run leaves reroll_reason null on verdict", async () => {
  const { adapter, inserts } = memoryAdapter({
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "alex",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-pico": 5 },
      },
      {
        user_id: "u2",
        display_name: "maya",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-pico": 5 },
      },
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].reroll_reason, null);
});

// ───────────────────────────────────────────────────────────────────────
// avail-reroll — excluded_option_ids filters the pool
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict reroll avail — excluded_option_ids removes the prior pick from the pool", async () => {
  const { adapter, inserts } = memoryAdapter({
    rerollState: {
      excluded_option_ids: ["opt-pico"],
      budget_tier_override: null,
      walk_minutes_override: null,
      last_reroll_reason: "avail",
    },
    options: [
      { id: "opt-pico", payload: { name: "Pico's",   price_tier: 2 } },
      { id: "opt-ren",  payload: { name: "Ren Soba", price_tier: 2 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "alex",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-pico": 5, "opt-ren": 4 },
      },
      {
        user_id: "u2",
        display_name: "maya",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-pico": 5, "opt-ren": 4 },
      },
    ],
    previousWinnerName: "Pico's",
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  // The excluded option must not win.
  assertEquals(body.verdict.option_id, "opt-ren");
  assertEquals(inserts[0].option_id, "opt-ren");
  assert(
    inserts[0].rule_text.startsWith("Availability reroll cut Pico's."),
    `rule_text should lead with reroll prefix: ${inserts[0].rule_text}`,
  );
});

// ───────────────────────────────────────────────────────────────────────
// cost-reroll — budget_tier_override tightens caps
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict reroll cost — budget_tier_override prunes candidates above the override", async () => {
  const { adapter, inserts } = memoryAdapter({
    rerollState: {
      excluded_option_ids: [],
      budget_tier_override: 1, // $-only — tier-2 candidates are now over cap
      walk_minutes_override: null,
      last_reroll_reason: "cost",
    },
    options: [
      { id: "opt-pico",   payload: { name: "Pico's",   price_tier: 2 } },
      { id: "opt-cheap",  payload: { name: "Diner",    price_tier: 1 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "alex",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-pico": 5, "opt-cheap": 4 },
      },
      {
        user_id: "u2",
        display_name: "maya",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-pico": 5, "opt-cheap": 4 },
      },
    ],
    previousWinnerName: "Pico's",
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  assertEquals(inserts[0].option_id, "opt-cheap");
  assert(inserts[0].rule_text.startsWith("Cost reroll cut Pico's."));
});

// ───────────────────────────────────────────────────────────────────────
// dist-reroll — re-runs the engine and stamps the aggregate-rule prefix
// ───────────────────────────────────────────────────────────────────────
//
// In the v1.1 worst-off-protecting engine (TB-11) walk-minutes is no
// longer a per-member cap — it left the quiz for the parameters bucket.
// A `dist`-reason reroll therefore no longer prunes via a
// `walk_minutes_override`; its effect is carried through the radius
// gate + the re-fetched, re-scored candidate pool. This test pins what
// the handler still owns: a `dist` reroll bypasses idempotency,
// re-runs the engine, and stamps the aggregate-rule prefix that names
// the rule, never the rerolling member.

Deno.test("compute-verdict reroll dist — re-runs the engine and stamps the Distance prefix", async () => {
  const { adapter, inserts } = memoryAdapter({
    rerollState: {
      excluded_option_ids: [],
      budget_tier_override: null,
      walk_minutes_override: null,
      last_reroll_reason: "dist",
    },
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2 } },
      { id: "opt-near", payload: { name: "Diner",  price_tier: 2 } },
    ],
    // The re-fetched pool re-scored `opt-near` as the worst-off-safe
    // pick (both members at 5) and `opt-pico` lower (a 3 floors it).
    votes: [
      {
        user_id: "u1",
        display_name: "alex",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-pico": 5, "opt-near": 5 },
      },
      {
        user_id: "u2",
        display_name: "maya",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-pico": 3, "opt-near": 5 },
      },
    ],
    previousWinnerName: "Pico's",
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  // opt-near min 5 beats opt-pico min 3 on the maximin rule.
  assertEquals(inserts[0].option_id, "opt-near");
  assert(inserts[0].rule_text.startsWith("Distance reroll cut Pico's."));
});

// ───────────────────────────────────────────────────────────────────────
// diet-reroll — q1_vetoes_extra merge + prune
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict reroll diet — q1_vetoes_extra are merged with q1_vetoes and prune", async () => {
  const { adapter, inserts } = memoryAdapter({
    rerollState: {
      excluded_option_ids: [],
      budget_tier_override: null,
      walk_minutes_override: null,
      last_reroll_reason: "diet",
    },
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2, dietary_tags: [] } },
      { id: "opt-vegan", payload: { name: "Plant",  price_tier: 2, dietary_tags: ["vegan_friendly"] } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "alex",
        q1_vetoes: [],
        q1_vetoes_extra: ["vegan"], // added by the diet reroll
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-pico": 5, "opt-vegan": 4 },
      },
    ],
    previousWinnerName: "Pico's",
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  // Pico's lacks vegan_friendly, so it's cut by the new EBA veto.
  assertEquals(inserts[0].option_id, "opt-vegan");
  assert(inserts[0].rule_text.startsWith("Diet reroll cut Pico's."));
});

// ───────────────────────────────────────────────────────────────────────
// mergeQ1Vetoes pure helper
// ───────────────────────────────────────────────────────────────────────

Deno.test("mergeQ1Vetoes — preserves order and dedupes case-insensitively", () => {
  assertEquals(
    mergeQ1Vetoes(["shellfish"], ["vegan"]),
    ["shellfish", "vegan"],
  );
  assertEquals(
    mergeQ1Vetoes(["Shellfish"], ["shellfish", "Vegan"]),
    ["Shellfish", "Vegan"],
  );
  assertEquals(
    mergeQ1Vetoes(["shellfish"], []),
    ["shellfish"],
  );
  assertEquals(
    mergeQ1Vetoes([], undefined),
    [],
  );
  assertEquals(
    mergeQ1Vetoes([""], ["", "shellfish"]),
    ["shellfish"],
  );
});
