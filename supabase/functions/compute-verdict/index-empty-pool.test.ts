// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// bug-13 â€” an empty candidate pool is a terminal no-survivor verdict,
// not a 404.
//
// Before bug-13, `compute-verdict` returned `{"error":"no_candidates"}`
// as HTTP 404 when a room had no `options` rows. No `verdicts` row was
// written, so the room stayed in `status='firing'` forever and iOS
// polled a verdict that never landed â€” wedging ~29% of sessions on
// 2026-05-19.
//
// The fix: an empty pool now flows through the engine (which already
// short-circuits an empty candidate pool to a `no_survivor` output) and
// the handler persists the terminal verdict row + advances the room out
// of `firing`, exactly as a normal verdict does.
//
// These tests drive the pure handler with an in-memory adapter â€” no
// supabase-js client, no network.

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

interface EmptyPoolSeed {
  options?: RoomOptionRow[];
  votes?: MemberVoteRow[];
}

interface EmptyPoolState {
  adapter: ComputeVerdictDataAdapter;
  inserts: VerdictInsert[];
  cuts: OptionCutInsert[][];
  /** room_ids passed to markRoomVerdictReady, in call order. */
  verdictReadyRoomIds: string[];
}

/** In-memory adapter that records verdict inserts and the room-status
 *  advance. `markRoomVerdictReady` is wired so the test can assert the
 *  room leaves `status='firing'` on an empty-pool resolution. */
function emptyPoolAdapter(seed: EmptyPoolSeed = {}): EmptyPoolState {
  const inserts: VerdictInsert[] = [];
  const cuts: OptionCutInsert[][] = [];
  const verdictReadyRoomIds: string[] = [];
  let existing: VerdictRow | null = null;
  const adapter: ComputeVerdictDataAdapter = {
    async fetchRoom(_id) {
      return { id: VALID_ROOM_ID };
    },
    async fetchOptions(_id) {
      return (seed.options ?? []).map(withEligibleGoogleMetadata);
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
        computed_at: "2026-05-19T00:00:00Z",
      };
      existing = inserted;
      return inserted;
    },
    async insertOptionCuts(rows) {
      cuts.push(rows);
    },
    async fetchRoomRadius(_id) {
      return null;
    },
    async deleteVerdictForRoom(_id) {
      existing = null;
    },
    async markRoomVerdictReady(room_id) {
      verdictReadyRoomIds.push(room_id);
    },
  };
  return { adapter, inserts, cuts, verdictReadyRoomIds };
}

function withEligibleGoogleMetadata(row: RoomOptionRow): RoomOptionRow {
  return {
    ...row,
    payload: {
      rating: 4.2,
      user_rating_count: 30,
      ...row.payload,
    },
  };
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AC1 â€” empty pool writes a terminal no-survivor verdict, not a 404
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("compute-verdict â€” empty candidate pool writes a no_survivor verdict (not no_candidates 404)", async () => {
  const { adapter, inserts, cuts } = emptyPoolAdapter({
    options: [], // no candidates at all â€” the wedge condition
    votes: votesFor("u1"),
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(
    res.status,
    200,
    "an empty pool must NOT 404 â€” it is a terminal outcome the surface renders",
  );
  const body = await res.json();
  assertEquals(body.error, undefined, "no error payload on an empty pool");
  assertEquals(body.verdict.method, "no_survivor");
  assertEquals(
    body.verdict.option_id,
    null,
    "a no_survivor verdict carries no winning option_id",
  );
  assertEquals(body.cuts.length, 0, "no cuts on an empty-pool resolution");
  // The verdict row IS persisted so iOS can read the terminal verdict.
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].method, "no_survivor");
  assertEquals(inserts[0].option_id, null);
  assertEquals(
    cuts.length,
    0,
    "insertOptionCuts must not be called with empty cuts on the empty-pool path",
  );
  assertExists(body.surviving_hard_needs);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AC2 â€” the room advances out of status='firing' on an empty pool
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("compute-verdict â€” empty pool advances the room out of firing", async () => {
  const { adapter, verdictReadyRoomIds } = emptyPoolAdapter({
    options: [],
    votes: votesFor("u1"),
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 200);
  assertEquals(
    verdictReadyRoomIds,
    [VALID_ROOM_ID],
    "an empty-pool resolution must run the same room-status advance as a normal verdict",
  );
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// AC3 â€” a non-empty pool still resolves to a ranked verdict (no regression)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("compute-verdict â€” non-empty pool still resolves to a ranked verdict", async () => {
  const { adapter, inserts } = emptyPoolAdapter({
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
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.verdict.method, "manual");
  assertEquals(body.verdict.option_id, "opt-pico");
  assertEquals(inserts.length, 1);
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Degenerate â€” a room with no votes at all still 404s (no members to
// render a verdict for; that is a distinct failure from an empty pool).
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

Deno.test("compute-verdict â€” empty pool AND no votes still returns no_votes 404", async () => {
  const { adapter, inserts } = emptyPoolAdapter({
    options: [],
    votes: [],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(
    body.error,
    "no_votes",
    "no members means no verdict â€” distinct from an empty candidate pool",
  );
  assertEquals(inserts.length, 0);
});
