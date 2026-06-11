// HTTP-layer tests for the no-survivor terminal and locked Search area
// behavior. Lives alongside `index.test.ts` and shares its in-memory
// adapter style.

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

const VALID_ROOM_ID = "11111111-1111-1111-1111-111111111111";

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
  roomMeta?: { radius_meters?: number } | null;
}

interface AdapterState {
  adapter: ComputeVerdictDataAdapter;
  inserts: VerdictInsert[];
  cuts: OptionCutInsert[][];
  deletedVerdictRoomIds: string[];
}

function memoryAdapter(seed: AdapterSeed = {}): AdapterState {
  const inserts: VerdictInsert[] = [];
  const cuts: OptionCutInsert[][] = [];
  const deletedVerdictRoomIds: string[] = [];
  let existing = seed.existing ?? null;
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
      return existing;
    },
    async insertVerdict(row) {
      inserts.push(row);
      const inserted: VerdictRow = {
        id: `verdict-${inserts.length}`,
        room_id: row.room_id,
        option_id: row.option_id,
        method: row.method,
        rule_text: row.rule_text,
        computed_at: "2026-05-13T00:00:00Z",
      };
      existing = inserted;
      return inserted;
    },
    async insertOptionCuts(rows) {
      cuts.push(rows);
    },
    async fetchRoomRadius(_id) {
      return seed.roomMeta?.radius_meters ?? null;
    },
    async deleteVerdictForRoom(roomId) {
      deletedVerdictRoomIds.push(roomId);
      existing = null;
    },
  };
  return { adapter, inserts, cuts, deletedVerdictRoomIds };
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

// ───────────────────────────────────────────────────────────────────────
// no_survivor terminal — engine cannot seat a candidate
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — no-survivor exits 200 with method=no_survivor", async () => {
  // The single candidate exceeds the member's budget cap (hard need
  // — never relaxes). The cascade can't seat a survivor; the
  // engine must surface `method=no_survivor` and the handler must
  // persist the verdict row (option_id null).
  const { adapter, inserts, cuts } = memoryAdapter({
    options: [
      { id: "opt-splurge", payload: { name: "Splurge", price_tier: 4 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 2,
        hard_vetoes: [], scores: { "opt-splurge": 5 },
      },
    ],
  });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200,
    "no_survivor must NOT be an error — the surface needs the verdict row");
  const body = await res.json();
  assertEquals(body.verdict.method, "no_survivor");
  assertEquals(body.verdict.option_id, null,
    "no_survivor verdict carries no winning option_id");
  assertEquals(body.cuts.length, 0,
    "no_survivor mode suppresses the cuts drawer — no cuts rows persisted");
  // The verdict row IS persisted so the mobile surface can read it.
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].method, "no_survivor");
  assertEquals(inserts[0].option_id, null);
  assertEquals(cuts.length, 0,
    "insertOptionCuts must not be called with empty cuts on the no-survivor path");
  // The surface needs the meta line + relax chain telemetry.
  assertExists(body.surviving_hard_needs);
  assert(Array.isArray(body.surviving_hard_needs));
  assert(body.surviving_hard_needs.length > 0,
    "no_survivor body should list surviving hard-needs for the S05 meta line");
});

Deno.test("compute-verdict — no-survivor rule_text never names a person", async () => {
  const { adapter } = memoryAdapter({
    options: [
      { id: "steakhouse", payload: { name: "Steakhouse", price_tier: 2, dietary_tags: [] } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "alex",
        q1_vetoes: ["vegan"],
        q2_budget: 4,
        hard_vetoes: [], scores: { "steakhouse": 5 },
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
  assert(!body.verdict.rule_text.toLowerCase().includes("alex"),
    `rule_text must not name alex: ${body.verdict.rule_text}`);
});

// ───────────────────────────────────────────────────────────────────────
// Locked Search area — radius mutation is rejected
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — radius override on an active Room is rejected", async () => {
  const existing: VerdictRow = {
    id: "v-old",
    room_id: VALID_ROOM_ID,
    option_id: null,
    method: "no_survivor",
    rule_text: "previous no-survivor rule",
    computed_at: "2026-05-13T00:00:00Z",
  };
  const { adapter, inserts, deletedVerdictRoomIds } = memoryAdapter({
    existing,
    options: [
      {
        id: "opt-stretch",
        payload: {
          name: "Stretch Spot",
          price_tier: 2,
          // distance is part of the payload — engine reads it for the
          // radius gate
          distance_meters: 2414, // 1.5 mi
        },
      },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-stretch": 5 },
      },
    ],
    roomMeta: { radius_meters: 805 }, // 0.5 mi — too tight for the candidate
  });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID, radius_meters_override: 4828 }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 409);
  const body = await res.json();
  assertEquals(body.error, "search_area_locked");
  assertEquals(deletedVerdictRoomIds.length, 0);
  assertEquals(inserts.length, 0);
});

Deno.test("compute-verdict — radius override does not replace a successful verdict", async () => {
  const existing: VerdictRow = {
    id: "v-old",
    room_id: VALID_ROOM_ID,
    option_id: "opt-pico",
    method: "manual",
    rule_text: "Pico's had the lowest regret-of-omission.",
    computed_at: "2026-05-13T00:00:00Z",
  };
  const { adapter, inserts, deletedVerdictRoomIds } = memoryAdapter({
    existing,
    options: [
      { id: "opt-pico", payload: { name: "Pico's", price_tier: 2 } },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-pico": 5 },
      },
    ],
  });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID, radius_meters_override: 4828 }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 409);
  const body = await res.json();
  assertEquals(body.error, "search_area_locked");
  assertEquals(deletedVerdictRoomIds.length, 0,
    "an existing successful verdict must not be replaced by a radius override");
  assertEquals(inserts.length, 0);
});

Deno.test("compute-verdict — active Room keeps committed radius when no override is supplied", async () => {
  const { adapter, inserts } = memoryAdapter({
    options: [
      {
        id: "opt-x",
        payload: { name: "Edge of Earth", price_tier: 2, distance_meters: 30000 }, // 18.6 mi
      },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "you",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [], scores: { "opt-x": 5 },
      },
    ],
    roomMeta: { radius_meters: 805 },
  });
  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.method, "no_survivor",
    "candidate outside the committed Search area cannot be seated");
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].method, "no_survivor");
});
