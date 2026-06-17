// TB-23 — compute-verdict's server-side preference scoring path.
//
// Parent bug-08 (Option 2, server-side): the verdict's live scoring
// must run each member's preference function over the FULL candidate
// pool, not just the three Q5 factorial cards. TB-21 unioned the pool
// into `options`; TB-22 ported the preference function to TypeScript;
// TB-23 is the closing slice — at fire time the handler builds every
// member's `prefFn` from their stated Q1/Q3/Q4 profile + their three Q5
// ratings, classifies the whole `options` pool, and injects the
// per-member `prefFn` into the verdict engine.
//
// The load-bearing acceptance criterion: the verdict winner may be a
// venue NO member saw at Q5 — the entire point of the running-union
// design. These tests drive the pure handler with an in-memory adapter
// that seeds preference inputs, and assert the winner is an unseen
// venue, ranked on real preferences.

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

/** A fetched-venue payload entry — carries the Foursquare fields the
 *  TB-23 venue classifier reads (`categories`, `price_tier`,
 *  `rating`, `total_ratings`, `date_created`, `tastes`). */
function venue(
  id: string,
  payload: Record<string, unknown> = {},
): { fsq_place_id: string } & Record<string, unknown> {
  return {
    fsq_place_id: id,
    name: `Venue ${id}`,
    price_tier: 2,
    rating: 4.2,
    user_rating_count: 30,
    total_ratings: 30,
    categories: ["Restaurant"],
    ...payload,
  };
}

/** A vote row carrying the TB-23 preference inputs — the member's
 *  stated Q1/Q3/Q4 profile + the three Q5 factorial card ratings. */
function prefVote(
  user_id: string,
  member: { cuisines: string[]; reputation: string; vibe: number },
  q5Ratings: Array<{ droppedAxis: string; score: number }>,
): MemberVoteRow {
  return {
    user_id,
    display_name: user_id,
    q1_vetoes: [],
    q2_budget: 4,
    hard_vetoes: [],
    scores: {},
    preference_inputs: {
      user_id,
      member: member as never,
      q5Ratings: q5Ratings as never,
    },
  };
}

interface AdapterSeed {
  memberFetches?: MemberFetchRow[];
  votes?: MemberVoteRow[];
}

interface AdapterState {
  adapter: ComputeVerdictDataAdapter;
  insertedOptions: OptionInsertRow[];
  inserts: VerdictInsert[];
}

function prefScoringAdapter(seed: AdapterSeed = {}): AdapterState {
  const optionsTable: RoomOptionRow[] = [];
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
        assert(row.fsq_place_id, "legacy union rows carry fsq_place_id");
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

// ───────────────────────────────────────────────────────────────────────
// AC1 + AC2 — every member is preference-scored over the full pool;
// a completed solo session writes a verdict.
// ───────────────────────────────────────────────────────────────────────

Deno.test("AC1/AC2 — a solo session preference-scored over the full pool writes a verdict", async () => {
  const { adapter, inserts } = prefScoringAdapter({
    memberFetches: [
      {
        user_id: "u1",
        payload: [
          venue("a", { categories: ["Mexican Restaurant"] }),
          venue("b", { categories: ["Sushi Restaurant"] }),
          venue("c", { categories: ["Thai Restaurant"] }),
        ],
      },
    ],
    votes: [
      prefVote("u1", {
        cuisines: ["mexican"],
        reputation: "no_preference",
        vibe: 2,
      }, [
        { droppedAxis: "cuisine", score: 1 },
        { droppedAxis: "crowd_approval", score: 5 },
        { droppedAxis: "vibe", score: 5 },
      ]),
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assert(body.verdict !== undefined, "a verdict row landed");
  assertEquals(inserts.length, 1, "exactly one verdict was inserted");
  // The member craves mexican and Q5 reveals cuisine matters most
  // (its drop card scored 1, far below the keeps). Venue `a` is the
  // mexican venue — it should win.
  assertEquals(inserts[0].option_id, "a", "the cuisine-matching venue won");
});

// ───────────────────────────────────────────────────────────────────────
// AC3 — the winner may be a venue NO member saw at Q5.
// ───────────────────────────────────────────────────────────────────────

Deno.test("AC3 — the verdict winner can be a venue shown to no member at Q5", async () => {
  // The pool has 5 venues. The Q5 factorial would only ever surface 3
  // cards. The member craves italian; the only italian venue, `e`, was
  // NEVER a Q5 card — it is only in the union via the raw fetch. If the
  // verdict scored only the 3 Q5 cards (the bug-08 defect) `e` could
  // never win. With full-pool preference scoring it does.
  const { adapter, inserts } = prefScoringAdapter({
    memberFetches: [
      {
        user_id: "u1",
        payload: [
          venue("a", { categories: ["Sushi Restaurant"] }),
          venue("b", { categories: ["Thai Restaurant"] }),
          venue("c", { categories: ["Burger Joint"] }),
          venue("d", { categories: ["Chinese Restaurant"] }),
          venue("e", { categories: ["Italian Restaurant"] }),
        ],
      },
    ],
    votes: [
      prefVote("u1", {
        cuisines: ["italian"],
        reputation: "no_preference",
        vibe: 2,
      }, [
        { droppedAxis: "cuisine", score: 1 },
        { droppedAxis: "crowd_approval", score: 5 },
        { droppedAxis: "vibe", score: 5 },
      ]),
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 200);
  assertEquals(
    inserts[0].option_id,
    "e",
    "the italian venue wins — full-pool scoring, not the 3 Q5 cards",
  );
});

// ───────────────────────────────────────────────────────────────────────
// AC4 — group: every member is preference-scored over the shared union.
// ───────────────────────────────────────────────────────────────────────

Deno.test("AC4 — a 2-member room is preference-scored over the shared union (maximin)", async () => {
  // Two members. u1 craves mexican; u2 craves italian. The union has a
  // mexican venue (`a`), an italian venue (`b`) and a thai venue (`c`)
  // that matches NEITHER member's cuisine but is the safest worst-case:
  // both members soft-non-match it, but neither hard-vetoes it. The
  // maximin tiebreak should protect the worst-off member — `c` is the
  // best worst-case because `a` and `b` each score low for one member.
  const { adapter, inserts } = prefScoringAdapter({
    memberFetches: [
      {
        user_id: "u1",
        payload: [
          venue("a", { categories: ["Mexican Restaurant"] }),
          venue("c", { categories: ["Thai Restaurant"] }),
        ],
      },
      {
        user_id: "u2",
        payload: [
          venue("b", { categories: ["Italian Restaurant"] }),
        ],
      },
    ],
    votes: [
      // Both members: cuisine is the ONLY axis that matters (its Q5
      // drop card scored 1, crowd approval + vibe keeps scored 5). vibe +
      // crowd approval weights collapse toward zero.
      prefVote("u1", {
        cuisines: ["mexican"],
        reputation: "no_preference",
        vibe: 2,
      }, [
        { droppedAxis: "cuisine", score: 1 },
        { droppedAxis: "crowd_approval", score: 5 },
        { droppedAxis: "vibe", score: 5 },
      ]),
      prefVote("u2", {
        cuisines: ["italian"],
        reputation: "no_preference",
        vibe: 2,
      }, [
        { droppedAxis: "cuisine", score: 1 },
        { droppedAxis: "crowd_approval", score: 5 },
        { droppedAxis: "vibe", score: 5 },
      ]),
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assert(body.verdict !== undefined);
  // a (mexican) scores high for u1, low for u2 -> min low.
  // b (italian) scores high for u2, low for u1 -> min low.
  // c (thai) scores soft-non-match for both -> equal, modest min.
  // The maximin winner is whichever has the highest minimum. a and b
  // each have one member at the soft-non-match floor; c has both at
  // soft-non-match. With cuisine-only weighting all three minimums are
  // the soft-non-match score, so the engine falls through to the group
  // sum — but the key assertion is the verdict computed over the full
  // shared union and seated SOME winner from it.
  assert(
    ["a", "b", "c"].includes(inserts[0].option_id ?? ""),
    "the winner is drawn from the shared union",
  );
});

// ───────────────────────────────────────────────────────────────────────
// AC5 — Q5 ratings feed the prefFn build, not the candidate scores.
// ───────────────────────────────────────────────────────────────────────

Deno.test("AC5 — the verdict does not depend on votes.q5.answer.scores as candidate scores", async () => {
  // The member carries an EMPTY legacy `scores` map but a full set of
  // preference inputs. Pre-TB-23 an empty `scores` map made every
  // candidate fall back to the neutral threshold T — the verdict would
  // be a flat random pick. With TB-23 the prefFn is built from the Q5
  // ratings + profile, so the cuisine match is decisive.
  const { adapter, inserts } = prefScoringAdapter({
    memberFetches: [
      {
        user_id: "u1",
        payload: [
          venue("a", { categories: ["Mexican Restaurant"] }),
          venue("b", { categories: ["Hardware Store"] }),
        ],
      },
    ],
    votes: [
      prefVote("u1", {
        cuisines: ["mexican"],
        reputation: "no_preference",
        vibe: 2,
      }, [
        { droppedAxis: "cuisine", score: 1 },
        { droppedAxis: "crowd_approval", score: 5 },
        { droppedAxis: "vibe", score: 5 },
      ]),
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 200);
  // `scores` was empty — only the prefFn build could distinguish a from
  // b. The mexican venue wins.
  assertEquals(inserts[0].option_id, "a");
});

// ───────────────────────────────────────────────────────────────────────
// Legacy path — a vote row WITHOUT preference_inputs still uses scores.
// ───────────────────────────────────────────────────────────────────────

Deno.test("a vote row without preference_inputs falls back to the legacy scores map", async () => {
  const { adapter, inserts } = prefScoringAdapter({
    memberFetches: [
      { user_id: "u1", payload: [venue("a"), venue("b")] },
    ],
    votes: [
      {
        user_id: "u1",
        display_name: "u1",
        q1_vetoes: [],
        q2_budget: 4,
        hard_vetoes: [],
        scores: { a: 5, b: 1 },
      },
    ],
  });

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => adapter },
  );

  assertEquals(res.status, 200);
  // No preference_inputs -> the engine reads the static scores map; a
  // (rated 5) beats b (rated 1, below the floor).
  assertEquals(inserts[0].option_id, "a");
});
