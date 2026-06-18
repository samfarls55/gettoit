// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
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
import type { HardVeto } from "../_shared/verdict-engine.ts";

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
  activeMemberIds?: string[];
  existing?: VerdictRow | null;
  /** TB-12 â€” per-account sticky profile vetoes, keyed by user_id.
   *  A user_id absent from this map (or an absent map entirely) means
   *  "no profile row" â€” the handler treats it as no profile vetoes. */
  profileVetoes?: Record<string, HardVeto[]>;
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
      return (seed.options ?? []).map(withEligibleGoogleMetadata);
    },
    async fetchActiveMemberIds(_id) {
      return seed.activeMemberIds ?? (seed.votes ?? []).map((v) => v.user_id);
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
    async fetchRoomRadius(_id) {
      return null;
    },
    async deleteVerdictForRoom(_id) {
      // no-op for tests that don't exercise the widen-replace path
    },
    async fetchProfileVetoes(user_ids) {
      const out: Record<string, HardVeto[]> = {};
      const map = seed.profileVetoes ?? {};
      for (const id of user_ids) {
        if (map[id]) out[id] = map[id];
      }
      return out;
    },
  };
  return { adapter, inserts, cuts, marked, broadcasts };
}

function withEligibleGoogleMetadata(row: RoomOptionRow): RoomOptionRow {
  return {
    ...row,
    payload: {
      rating: 4.2,
      user_rating_count: 30,
      regular_opening_periods: allWeekDinnerHours,
      dine_in: true,
      ...row.payload,
    },
  };
}

const VALID_ROOM_ID = "11111111-1111-1111-1111-111111111111";

const allWeekDinnerHours = Array.from({ length: 7 }, (_, day) => ({
  open: { day, hour: 18, minute: 0 },
  close: { day, hour: 22, minute: 0 },
}));

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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Auth / method / config gating
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("compute-verdict â€” OPTIONS returns 204 with CORS headers", async () => {
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

Deno.test("compute-verdict â€” GET returns 405", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    new Request("https://example/compute-verdict", { method: "GET" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 405);
});

Deno.test("compute-verdict â€” missing Authorization returns 401", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    new Request("https://example/compute-verdict", { method: "POST" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 401);
});

Deno.test("compute-verdict â€” missing service-role returns 500", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: {}, buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 500);
});

Deno.test("compute-verdict â€” invalid JSON body returns 400", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    new Request("https://example/compute-verdict", {
      method: "POST",
      headers: {
        Authorization: "Bearer test",
        "Content-Type": "application/json",
      },
      body: "not-json",
    }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 400);
});

Deno.test("compute-verdict â€” non-uuid room_id returns 400", async () => {
  const { adapter } = memoryAdapter();
  const res = await handleRequest(
    authedPost({ room_id: "not-a-uuid" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "invalid_input");
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Idempotency
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("compute-verdict â€” existing verdict returns 200 without re-computing", async () => {
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Lookup failure modes
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("compute-verdict â€” missing room returns 404", async () => {
  const { adapter } = memoryAdapter({ room: null });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 404);
});

Deno.test("compute-verdict â€” empty candidate pool resolves to a no_survivor verdict (bug-13)", async () => {
  // bug-13 â€” an empty `options` pool is a terminal no-survivor
  // outcome, not a 404. The room must leave `firing` with a verdict
  // row written so iOS can render the no-survivor screen; the old
  // `no_candidates` 404 left the room wedged forever.
  const { adapter, inserts } = memoryAdapter({
    options: [],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: {},
      },
    ],
  });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.method, "no_survivor");
  assertEquals(body.verdict.option_id, null);
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].method, "no_survivor");
});

Deno.test("compute-verdict â€” no votes returns 404", async () => {
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Happy path â€” engine + writes
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("compute-verdict â€” happy path writes verdict + cuts and returns 200", async () => {
  const { adapter, inserts, cuts } = memoryAdapter({
    options: [
      { id: "opt-pico", payload: { name: "Pico's Taqueria", price_tier: 2 } },
      { id: "opt-ren", payload: { name: "Ren Soba", price_tier: 3 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-pico": 5, "opt-ren": 2 },
      },
      {
        user_id: "u2",
        display_name: "alex",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-pico": 5, "opt-ren": 2 },
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

Deno.test("compute-verdict â€” single-survivor path writes one verdict and the cuts", async () => {
  const { adapter, inserts, cuts } = memoryAdapter({
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2 } },
      { id: "opt-splurge", payload: { name: "Splurge", price_tier: 4 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 2,
        hard_vetoes: [],
        scores: { "opt-pico": 5, "opt-splurge": 5 },
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TB-07 â€” auto-fire method passthrough
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("compute-verdict â€” quorum method passes through to the verdict row", async () => {
  const { adapter, inserts } = memoryAdapter({
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2 } },
      { id: "opt-ren", payload: { name: "Ren", price_tier: 3 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-pico": 5, "opt-ren": 2 },
      },
      {
        user_id: "u2",
        display_name: "alex",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-pico": 5, "opt-ren": 2 },
      },
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

Deno.test("compute-verdict â€” deadline method passes through to the verdict row", async () => {
  const { adapter, inserts } = memoryAdapter({
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2 } },
      { id: "opt-ren", payload: { name: "Ren", price_tier: 3 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-pico": 5, "opt-ren": 2 },
      },
      {
        user_id: "u2",
        display_name: "alex",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-pico": 5, "opt-ren": 2 },
      },
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

Deno.test("compute-verdict â€” unknown method falls back to manual", async () => {
  const { adapter, inserts } = memoryAdapter({
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
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID, method: "garbage" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(
    body.verdict.method,
    "manual",
    "unknown methods must default to manual to avoid CHECK violations",
  );
  assertEquals(inserts[0].method, "manual");
});

Deno.test("compute-verdict â€” happy path flips rooms.status to verdict_ready and emits a broadcast", async () => {
  const { adapter, marked, broadcasts } = memoryAdapter({
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
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID, method: "quorum" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);

  assertEquals(
    marked,
    [VALID_ROOM_ID],
    "expected markRoomVerdictReady to be invoked exactly once with the room id",
  );
  assertEquals(
    broadcasts.length,
    1,
    "expected exactly one verdict_ready broadcast to be emitted",
  );
  assertEquals(broadcasts[0].room_id, VALID_ROOM_ID);
  assertEquals(broadcasts[0].verdict_id, "verdict-1");
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// TB-12 â€” profile vetoes (per-account allergy / dietary / cuisine NEVERS)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("compute-verdict â€” TB-12: a member's stored profile veto prunes the matching venue", async () => {
  // The member has a sticky cuisine-NEVER profile veto for "sushi".
  // The `votes` row carries NO hard veto (profile data is per-account,
  // not per-session) â€” the handler must fetch it from the profile
  // store and fold it into the engine's hard_vetoes channel.
  const { adapter, inserts } = memoryAdapter({
    options: [
      {
        id: "opt-taco",
        payload: {
          name: "Taco Stand",
          price_tier: 2,
          categories: ["Taco Stand"],
        },
      },
      {
        id: "opt-sushi",
        payload: {
          name: "Sushi Bar",
          price_tier: 2,
          categories: ["Sushi Restaurant"],
        },
      },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-taco": 5, "opt-sushi": 5 },
      },
    ],
    profileVetoes: {
      u1: [{ kind: "cuisine_never", token: "sushi" }],
    },
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.option_id, "opt-taco");
  assert(
    body.cuts.some((c: { option_id: string; cut_reason: string }) =>
      c.option_id === "opt-sushi" && c.cut_reason === "veto"
    ),
    "expected the sushi venue to be EBA-pruned on the stored profile cuisine-NEVER",
  );
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].option_id, "opt-taco");
});

Deno.test("compute-verdict â€” TB-12: profile vetoes are unioned with session hard_vetoes (not replaced)", async () => {
  // The votes row already carries a session hard_veto (an allergy tag);
  // the profile store adds a separate cuisine-NEVER. Both must prune.
  const { adapter } = memoryAdapter({
    options: [
      {
        id: "opt-safe",
        payload: {
          name: "Safe Spot",
          price_tier: 2,
          categories: ["Cafe"],
          dietary_tags: ["no_nuts_unverified"],
        },
      },
      {
        id: "opt-nutty",
        payload: {
          name: "Nutty Place",
          price_tier: 2,
          categories: ["Cafe"],
          dietary_tags: [],
        },
      },
      {
        id: "opt-sushi",
        payload: {
          name: "Sushi Bar",
          price_tier: 2,
          categories: ["Sushi Restaurant"],
          dietary_tags: ["no_nuts_unverified"],
        },
      },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [{ kind: "tag", token: "no_nuts_unverified" }],
        scores: { "opt-safe": 5, "opt-nutty": 5, "opt-sushi": 5 },
      },
    ],
    profileVetoes: {
      u1: [{ kind: "cuisine_never", token: "sushi" }],
    },
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.option_id, "opt-safe");
  // opt-nutty pruned by the session allergy tag, opt-sushi by the
  // stored profile cuisine NEVER.
  assert(
    body.cuts.some((c: { option_id: string }) => c.option_id === "opt-nutty"),
  );
  assert(
    body.cuts.some((c: { option_id: string }) => c.option_id === "opt-sushi"),
  );
});

Deno.test("compute-verdict â€” TB-12: a member with no profile row contributes no profile veto", async () => {
  // Absent profile store / absent member row â€” the handler treats it
  // as "no profile vetoes" and the run proceeds normally.
  const { adapter } = memoryAdapter({
    options: [
      {
        id: "opt-sushi",
        payload: {
          name: "Sushi Bar",
          price_tier: 2,
          categories: ["Sushi Restaurant"],
        },
      },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-sushi": 5 },
      },
    ],
    // no `profileVetoes` seed at all
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.option_id, "opt-sushi");
});

Deno.test("compute-verdict â€” TB-08: exited members do not contribute votes, profile vetoes, budgets, or scores", async () => {
  const { adapter } = memoryAdapter({
    activeMemberIds: ["u1"],
    options: [
      {
        id: "opt-taco",
        payload: {
          name: "Taco Stand",
          price_tier: 2,
          categories: ["Taco Stand"],
        },
      },
      {
        id: "opt-sushi",
        payload: {
          name: "Sushi Bar",
          price_tier: 3,
          categories: ["Sushi Restaurant"],
        },
      },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "active",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-taco": 3, "opt-sushi": 5 },
      },
      {
        user_id: "u2",
        display_name: "exited",
        q1_vetoes: [],
        q2_budget: 2,
        hard_vetoes: [{ kind: "cuisine_never", token: "sushi" }],
        scores: { "opt-taco": 5, "opt-sushi": 1 },
      },
    ],
    profileVetoes: {
      u2: [{ kind: "tag", token: "no_shellfish_unverified" }],
    },
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID, method: "manual" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.option_id, "opt-sushi");
  assertEquals(
    body.cuts.some((c: { option_id: string }) => c.option_id === "opt-sushi"),
    false,
    "the exited member's cuisine NEVER, budget cap, profile veto, and low score must not cut sushi",
  );
});

Deno.test("compute-verdict â€” TB-08: manual close ignores active members without submitted votes", async () => {
  const { adapter } = memoryAdapter({
    activeMemberIds: ["u1", "u2"],
    options: [
      {
        id: "opt-taco",
        payload: {
          name: "Taco Stand",
          price_tier: 2,
          categories: ["Taco Stand"],
        },
      },
      {
        id: "opt-sushi",
        payload: {
          name: "Sushi Bar",
          price_tier: 2,
          categories: ["Sushi Restaurant"],
        },
      },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "submitted",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { "opt-taco": 3, "opt-sushi": 5 },
      },
    ],
    profileVetoes: {
      u2: [{ kind: "cuisine_never", token: "sushi" }],
    },
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID, method: "manual" }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.option_id, "opt-sushi");
});

Deno.test("compute-verdict â€” TB-08: hard safety and cuisine NEVERs ignore summaries and free text", async () => {
  const { adapter } = memoryAdapter({
    options: [
      {
        id: "opt-summary-sushi",
        payload: {
          name: "Summary Sushi Cafe",
          price_tier: 2,
          categories: ["Cafe"],
          dietary_tags: ["vegan_friendly"],
          reviewSummary: "Guests mention sushi specials.",
          generativeSummary: "A neighborhood cafe with sushi pop-ups.",
        } as RoomOptionRow["payload"],
      },
      {
        id: "opt-summary-vegan",
        payload: {
          name: "Summary Vegan Cafe",
          price_tier: 2,
          categories: ["Cafe"],
          dietary_tags: [],
          reviewSummary: "Guests mention vegan options.",
          generativeSummary: "A good pick for vegan diners.",
        } as RoomOptionRow["payload"],
      },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [
          { kind: "cuisine_never", token: "sushi" },
          { kind: "dietary", token: "vegan" },
        ],
        scores: { "opt-summary-sushi": 5, "opt-summary-vegan": 4 },
      },
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.option_id, "opt-summary-sushi");
  assert(
    body.cuts.some((c: { option_id: string; cut_reason: string }) =>
      c.option_id === "opt-summary-vegan" && c.cut_reason === "dietary"
    ),
    "summary/free text must not satisfy hard dietary safety",
  );
});

Deno.test("compute-verdict â€” engine no-survivor exits 200 with method=no_survivor (TB-09)", async () => {
  // TB-06 surfaced no-survivor as a 422 error. TB-09 made it a
  // first-class terminal state â€” the handler persists a verdict
  // row with `method=no_survivor` so the iOS S05 surface can read
  // and render the terminal mode. See `index-no-survivor.test.ts`
  // for the full TB-09 contract.
  const { adapter, inserts } = memoryAdapter({
    options: [
      { id: "opt-splurge", payload: { name: "Splurge", price_tier: 4 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 2,
        hard_vetoes: [],
        scores: { "opt-splurge": 5 },
      },
    ],
  });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.method, "no_survivor");
  assertEquals(body.verdict.option_id, null);
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].method, "no_survivor");
});
