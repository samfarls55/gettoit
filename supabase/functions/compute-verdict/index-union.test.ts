// TB-21 — compute-verdict's member-fetch → options union path.
//
// Parent bug-08: `options` was empty across every room because nothing
// ever wrote it, so `compute-verdict` always returned `no_candidates`
// (404). TB-21 wires the server-side union: at verdict fire time the
// handler reads every member's persisted raw Foursquare fetch from
// `member_fetches`, assembles the running union (first-seen dedup by
// `fsq_place_id`), and writes the union into `options` BEFORE the
// engine reads the candidate pool.
//
// These tests drive the pure handler with an in-memory adapter that
// seeds `member_fetches` and records `options` inserts — no supabase-js
// client, no network.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type ComputeVerdictDataAdapter,
  handleRequest,
  type MemberFetchRow,
  type MemberVoteRow,
  type OptionCutInsert,
  type OptionInsertRow,
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

/** A fetched-venue payload entry — the iOS writer persists the full
 *  `ShapedPlace`; the union keys on `fsq_place_id`. */
function venue(id: string, extra: Record<string, unknown> = {}) {
  return { fsq_place_id: id, name: `Venue ${id}`, price_tier: 2, ...extra };
}

interface UnionAdapterSeed {
  /** Rows already present in `options` (empty by default — TB-21's
   *  whole point is that nothing wrote it). */
  options?: RoomOptionRow[];
  /** Per-member persisted raw fetches. */
  memberFetches?: MemberFetchRow[];
  votes?: MemberVoteRow[];
}

interface UnionAdapterState {
  adapter: ComputeVerdictDataAdapter;
  /** Every `options` row the handler inserted, in insert order. */
  insertedOptions: OptionInsertRow[];
  inserts: VerdictInsert[];
}

/** An in-memory adapter whose `fetchOptions` returns whatever has been
 *  inserted so far — so the handler's "union into options, then read
 *  options" round-trip is exercised end-to-end. */
function unionAdapter(seed: UnionAdapterSeed = {}): UnionAdapterState {
  const optionsTable: RoomOptionRow[] = [...(seed.options ?? [])];
  const insertedOptions: OptionInsertRow[] = [];
  const inserts: VerdictInsert[] = [];
  const cuts: OptionCutInsert[][] = [];
  const adapter: ComputeVerdictDataAdapter = {
    async fetchRoom(_id) {
      return { id: VALID_ROOM_ID };
    },
    async fetchMemberFetches(_id) {
      return seed.memberFetches ?? [];
    },
    async insertOptions(rows) {
      for (const row of rows) {
        insertedOptions.push(row);
        optionsTable.push({
          id: row.fsq_place_id,
          payload: row.payload as RoomOptionRow["payload"],
        });
      }
    },
    async fetchOptions(_id) {
      return optionsTable;
    },
    async fetchVotes(_id) {
      return seed.votes ?? [];
    },
    async existingVerdict(_id) {
      return null;
    },
    async insertVerdict(row) {
      inserts.push(row);
      return {
        id: "verdict-1",
        room_id: row.room_id,
        option_id: row.option_id,
        method: row.method,
        rule_text: row.rule_text,
        computed_at: "2026-05-18T00:00:00Z",
      };
    },
    async insertOptionCuts(rows) {
      cuts.push(rows);
    },
    async fetchRoomRadius(_id) {
      return null;
    },
    async deleteVerdictForRoom(_id) {},
  };
  return { adapter, insertedOptions, inserts };
}

const votesFor = (...userIds: string[]): MemberVoteRow[] =>
  userIds.map((user_id) => ({
    user_id,
    display_name: user_id,
    q1_vetoes: [],
    q2_budget: 4,
    hard_vetoes: [],
    scores: {},
  }));

// ───────────────────────────────────────────────────────────────────────
// AC1 + AC2 + AC3 — persisted fetch unions into options, verdict computes
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — a completed room with persisted fetches but no options returns a verdict, not no_candidates", async () => {
  const { adapter } = unionAdapter({
    options: [], // nothing ever wrote options — the bug-08 starting state
    memberFetches: [
      { user_id: "u1", payload: [venue("a"), venue("b"), venue("c")] },
    ],
    votes: votesFor("u1"),
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 200, "the verdict computes — options were populated from the fetch");
  const body = await res.json();
  assert(body.error === undefined, `expected a verdict, got error ${body.error}`);
  assert(body.verdict !== undefined, "a verdict row landed");
});

Deno.test("compute-verdict — the persisted fetch is written into options before the engine reads it", async () => {
  const { adapter, insertedOptions } = unionAdapter({
    memberFetches: [
      { user_id: "u1", payload: [venue("a"), venue("b")] },
    ],
    votes: votesFor("u1"),
  });

  await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(
    insertedOptions.map((o) => o.fsq_place_id).sort(),
    ["a", "b"],
    "every fetched venue was written into options",
  );
  assertEquals(
    insertedOptions.every((o) => o.room_id === VALID_ROOM_ID),
    true,
    "the options rows are stamped with the room id",
  );
});

// ───────────────────────────────────────────────────────────────────────
// AC4 — group: the pool is the union across all members
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — a group room's options pool is the union across all members' fetches", async () => {
  const { adapter, insertedOptions } = unionAdapter({
    memberFetches: [
      { user_id: "u1", payload: [venue("a"), venue("b")] },
      { user_id: "u2", payload: [venue("b"), venue("c"), venue("d")] },
    ],
    votes: votesFor("u1", "u2"),
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 200);
  // b is contributed by both members — first-seen dedup keeps it once.
  assertEquals(
    insertedOptions.map((o) => o.fsq_place_id).sort(),
    ["a", "b", "c", "d"],
    "the pool is the union across both members, deduped by fsq_place_id",
  );
});

// ───────────────────────────────────────────────────────────────────────
// AC5 — the pool is the full fetched union, not the three Q5 cards
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — the options pool is the full fetched union (more than three venues)", async () => {
  const { adapter, insertedOptions } = unionAdapter({
    memberFetches: [
      {
        user_id: "u1",
        payload: [
          venue("a"), venue("b"), venue("c"), venue("d"), venue("e"),
        ],
      },
    ],
    votes: votesFor("u1"),
  });

  await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(
    insertedOptions.length,
    5,
    "the full fetched union lands in options — not just the three Q5 factorial cards",
  );
});

// ───────────────────────────────────────────────────────────────────────
// Degenerate — no fetches at all still surfaces no_candidates
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — a room with no persisted fetches still returns no_candidates", async () => {
  const { adapter } = unionAdapter({
    memberFetches: [],
    votes: votesFor("u1"),
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.error, "no_candidates");
});

// ───────────────────────────────────────────────────────────────────────
// Idempotency — options already populated is not double-written
// ───────────────────────────────────────────────────────────────────────

Deno.test("compute-verdict — when options is already populated the union is a no-op", async () => {
  const { adapter, insertedOptions } = unionAdapter({
    options: [
      { id: "opt-pre", payload: { name: "Pre-existing", price_tier: 2 } },
    ],
    memberFetches: [
      { user_id: "u1", payload: [venue("a")] },
    ],
    votes: votesFor("u1"),
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 200);
  assertEquals(
    insertedOptions.length,
    0,
    "options was already populated — the fetch union does not re-write it",
  );
});
