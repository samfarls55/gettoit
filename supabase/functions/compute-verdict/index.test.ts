// HTTP-layer tests for the `compute-verdict` Edge Function entry point.
// Exercises auth gating, idempotency, and the happy path through the
// engine without touching the supabase-js client.

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
  type VerdictInsert,
  type VerdictRow,
} from "./handler.ts";

function envOk() {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  };
}

interface AdapterSeed {
  room?: { id: string } | null;
  options?: RoomOptionRow[];
  votes?: MemberVoteRow[];
  existing?: VerdictRow | null;
}

interface AdapterState {
  adapter: ComputeVerdictDataAdapter;
  inserts: VerdictInsert[];
  cuts: OptionCutInsert[][];
  marked: string[];
  broadcasts: Array<{ room_id: string; verdict_id: string }>;
}

function memoryAdapter(seed: AdapterSeed = {}): AdapterState {
  const inserts: VerdictInsert[] = [];
  const cuts: OptionCutInsert[][] = [];
  const marked: string[] = [];
  const broadcasts: Array<{ room_id: string; verdict_id: string }> = [];
  const adapter: ComputeVerdictDataAdapter = {
    async fetchRoom(_id) {
      return seed.room === undefined
        ? { id: "00000000-0000-0000-0000-000000000001" }
        : seed.room;
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
        computed_at: "2026-05-13T00:00:00Z",
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
  };
  return { adapter, inserts, cuts, marked, broadcasts };
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
// Auth / method / config gating
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — OPTIONS returns 204 with CORS headers", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    new Request("https://example/compute-verdict", { method: "OPTIONS" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 204);
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods")?.includes("POST"),
    true,
  );
});

Deno.test("compute-verdict — GET returns 405", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    new Request("https://example/compute-verdict", { method: "GET" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 405);
});

Deno.test("compute-verdict — missing Authorization returns 401", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    new Request("https://example/compute-verdict", { method: "POST" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 401);
});

Deno.test("compute-verdict — missing service-role returns 500", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: {}, buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 500);
});

Deno.test("compute-verdict — invalid JSON body returns 400", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    new Request("https://example/compute-verdict", {
      method: "POST",
      headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
      body: "not-json",
    }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 400);
});

Deno.test("compute-verdict — non-uuid room_id returns 400", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    authedPost({ room_id: "not-a-uuid" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid_input");
});

// ───────────────────────────────────────────────────────────────────────
// Idempotency
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — existing verdict returns 200 without re-computing", async () => {
  const existing: VerdictRow = {
    id: "v-1",
    room_id: VALID_ROOM_ID,
    option_id: "opt-1",
    method: "manual",
    rule_text: "Existing rule.",
    computed_at: "2026-05-13T00:00:00Z",
  };
  const { adapter, inserts } = memoryAdapter({ existing });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.already_computed, true);
  assertEquals(body.verdict.id, "v-1");
  assertEquals(inserts.length, 0, "must not re-insert a verdict that exists");
});

// ───────────────────────────────────────────────────────────────────────
// Lookup failure modes
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — missing room returns 404", async () => {
  const { adapter } = memoryAdapter({ room: null });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 404);
});

Deno.test("compute-verdict — no candidates returns 404", async () => {
  const { adapter } = memoryAdapter({ options: [] });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.error, "no_candidates");
});

Deno.test("compute-verdict — no votes returns 404", async () => {
  const { adapter } = memoryAdapter({
    options: [
      { id: "opt-1", payload: { name: "Pico's" } },
    ],
    votes: [],
  });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.error, "no_votes");
});

// ───────────────────────────────────────────────────────────────────────
// Happy path — engine + writes
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — happy path writes verdict + cuts and returns 200", async () => {
  const { adapter, inserts, cuts } = memoryAdapter({
    options: [
      { id: "opt-pico", payload: { name: "Pico's Taqueria", price_tier: 2, walk_minutes_estimate: 8 } },
      { id: "opt-ren",  payload: { name: "Ren Soba",        price_tier: 3, walk_minutes_estimate: 12 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        q3_walk_minutes: 30,
        q4_vibe: 2,
        q5_regret: { "opt-pico": 5, "opt-ren": 2 },
      },
      {
        user_id: "u2",
        display_name: "alex",
        q1_vetoes: [],
        q2_budget: 4,
        q3_walk_minutes: 30,
        q4_vibe: 2,
        q5_regret: { "opt-pico": 5, "opt-ren": 2 },
      },
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.option_id, "opt-pico");
  assertEquals(body.cuts.length, 1);
  assertEquals(body.cuts[0].option_id, "opt-ren");

  // Side-effects on the adapter.
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].option_id, "opt-pico");
  assertEquals(inserts[0].method, "manual");
  assert(inserts[0].rule_text.length > 0);
  assertEquals(cuts.length, 1);
  assertEquals(cuts[0].length, 1);
  assertEquals(cuts[0][0].verdict_id, "verdict-1");
  assertEquals(cuts[0][0].option_id, "opt-ren");
});

Deno.test("compute-verdict — single-survivor path writes one verdict and the cuts", async () => {
  const { adapter, inserts, cuts } = memoryAdapter({
    options: [
      { id: "opt-pico",   payload: { name: "Pico's",  price_tier: 2, walk_minutes_estimate: 8 } },
      { id: "opt-splurge", payload: { name: "Splurge", price_tier: 4, walk_minutes_estimate: 8 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 2,
        q3_walk_minutes: 30,
        q4_vibe: 2,
        q5_regret: { "opt-pico": 5, "opt-splurge": 5 },
      },
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.option_id, "opt-pico");
  assertEquals(body.cuts.length, 1);
  assertEquals(body.cuts[0].cut_reason, "budget");
  assertEquals(inserts.length, 1);
  assertEquals(cuts[0].length, 1);
});

// ───────────────────────────────────────────────────────────────────────
// TB-07 — auto-fire method passthrough
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — quorum method passes through to the verdict row", async () => {
  const { adapter, inserts } = memoryAdapter({
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2, walk_minutes_estimate: 8 } },
      { id: "opt-ren",  payload: { name: "Ren",    price_tier: 3, walk_minutes_estimate: 12 } },
    ],
    votes: [
      { user_id: "u1", display_name: "you", q1_vetoes: [], q2_budget: 4, q3_walk_minutes: 30, q4_vibe: 2, q5_regret: { "opt-pico": 5, "opt-ren": 2 } },
      { user_id: "u2", display_name: "alex", q1_vetoes: [], q2_budget: 4, q3_walk_minutes: 30, q4_vibe: 2, q5_regret: { "opt-pico": 5, "opt-ren": 2 } },
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID, method: "quorum" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.method, "quorum");
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].method, "quorum");
});

Deno.test("compute-verdict — deadline method passes through to the verdict row", async () => {
  const { adapter, inserts } = memoryAdapter({
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2, walk_minutes_estimate: 8 } },
      { id: "opt-ren",  payload: { name: "Ren",    price_tier: 3, walk_minutes_estimate: 12 } },
    ],
    votes: [
      { user_id: "u1", display_name: "you", q1_vetoes: [], q2_budget: 4, q3_walk_minutes: 30, q4_vibe: 2, q5_regret: { "opt-pico": 5, "opt-ren": 2 } },
      { user_id: "u2", display_name: "alex", q1_vetoes: [], q2_budget: 4, q3_walk_minutes: 30, q4_vibe: 2, q5_regret: { "opt-pico": 5, "opt-ren": 2 } },
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID, method: "deadline" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.method, "deadline");
  assertEquals(inserts[0].method, "deadline");
});

Deno.test("compute-verdict — unknown method falls back to manual", async () => {
  const { adapter, inserts } = memoryAdapter({
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2, walk_minutes_estimate: 8 } },
    ],
    votes: [
      { user_id: "u1", display_name: "you", q1_vetoes: [], q2_budget: 4, q3_walk_minutes: 30, q4_vibe: 2, q5_regret: { "opt-pico": 5 } },
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID, method: "garbage" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.method, "manual", "unknown methods must default to manual to avoid CHECK violations");
  assertEquals(inserts[0].method, "manual");
});

Deno.test("compute-verdict — happy path flips rooms.status to verdict_ready and emits a broadcast", async () => {
  const { adapter, marked, broadcasts } = memoryAdapter({
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2, walk_minutes_estimate: 8 } },
    ],
    votes: [
      { user_id: "u1", display_name: "you", q1_vetoes: [], q2_budget: 4, q3_walk_minutes: 30, q4_vibe: 2, q5_regret: { "opt-pico": 5 } },
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID, method: "quorum" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);

  assertEquals(marked, [VALID_ROOM_ID],
    "expected markRoomVerdictReady to be invoked exactly once with the room id");
  assertEquals(broadcasts.length, 1,
    "expected exactly one verdict_ready broadcast to be emitted");
  assertEquals(broadcasts[0].room_id, VALID_ROOM_ID);
  assertEquals(broadcasts[0].verdict_id, "verdict-1");
});

Deno.test("compute-verdict — engine no-survivor surfaces 422", async () => {
  const { adapter } = memoryAdapter({
    options: [
      { id: "opt-splurge", payload: { name: "Splurge", price_tier: 4 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 2,
        q3_walk_minutes: 30,
        q4_vibe: 2,
        q5_regret: { "opt-splurge": 5 },
      },
    ],
  });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 422);
  const body = await res.json();
  assertEquals(body.error, "no_survivor");
});
