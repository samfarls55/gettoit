import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type ComputeVerdictDataAdapter,
  type GoogleVerdictCandidateRow,
  type GoogleVerdictFetchContext,
  handleRequest,
  type MemberVoteRow,
  type OptionCutInsert,
  type OptionInsertRow,
  type RoomOptionRow,
  type VerdictInsert,
  type VerdictSlateEntryInsert,
} from "./handler.ts";

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

function envOk() {
  return {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
  };
}

function googleCandidate(
  googlePlaceId: string,
  payload: Record<string, unknown> = {},
): GoogleVerdictCandidateRow {
  return {
    google_place_id: googlePlaceId,
    payload: {
      name: `Venue ${googlePlaceId}`,
      price_tier: 2,
      rating: 4.4,
      user_rating_count: 40,
      total_ratings: 40,
      categories: ["Restaurant"],
      distance_meters: 500,
      current_open_now: true,
      dine_in: true,
      ...payload,
    },
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

interface AdapterState {
  adapter: ComputeVerdictDataAdapter;
  insertedOptions: OptionInsertRow[];
  insertedVerdicts: VerdictInsert[];
  insertedSlate: VerdictSlateEntryInsert[];
  fetchContexts: GoogleVerdictFetchContext[];
  memberFetchReadCount: number;
}

function adapterForGoogleVerdictFetch(
  googleCandidates: GoogleVerdictCandidateRow[],
): AdapterState {
  const optionsTable: RoomOptionRow[] = [];
  const insertedOptions: OptionInsertRow[] = [];
  const insertedVerdicts: VerdictInsert[] = [];
  const insertedSlate: VerdictSlateEntryInsert[] = [];
  const fetchContexts: GoogleVerdictFetchContext[] = [];
  let memberFetchReadCount = 0;

  const adapter: ComputeVerdictDataAdapter = {
    async fetchRoom(_id) {
      return { id: VALID_ROOM_ID };
    },
    async fetchActiveMemberIds(_id) {
      return ["u1"];
    },
    async fetchVotes(_id) {
      return [vote({
        option_b: 5,
        option_a: 4,
        option_c: 3,
        option_d: 2,
        option_e: 1,
      })];
    },
    async fetchGoogleVerdictCandidates(_roomId, context) {
      fetchContexts.push(context);
      return googleCandidates;
    },
    async fetchMemberFetches(_id) {
      memberFetchReadCount += 1;
      return [];
    },
    async insertOptions(rows) {
      for (const row of rows) {
        insertedOptions.push(row);
        const googlePlaceId = row.google_place_id ?? row.fsq_place_id;
        optionsTable.push({
          id: `option_${googlePlaceId.slice(-1)}`,
          google_place_id: googlePlaceId,
          place_provider: "google",
        });
      }
    },
    async fetchOptions(_id) {
      return optionsTable;
    },
    async existingVerdict(_id) {
      return null;
    },
    async insertVerdict(row) {
      insertedVerdicts.push(row);
      return {
        id: "verdict-1",
        room_id: row.room_id,
        option_id: row.option_id,
        method: row.method,
        rule_text: row.rule_text,
        computed_at: "2026-06-11T00:00:00Z",
      };
    },
    async insertOptionCuts(_rows: OptionCutInsert[]) {},
    async insertVerdictSlateEntries(rows) {
      insertedSlate.push(...rows);
    },
    async fetchRoomRadius(_id) {
      return null;
    },
    async deleteVerdictForRoom(_id) {},
  };

  return {
    adapter,
    insertedOptions,
    insertedVerdicts,
    insertedSlate,
    fetchContexts,
    get memberFetchReadCount() {
      return memberFetchReadCount;
    },
  };
}

Deno.test("TB-10: Google final verdict fetch dedupes, scores, and persists deterministic slate", async () => {
  const state = adapterForGoogleVerdictFetch([
    googleCandidate("google-c"),
    googleCandidate("google-a", { distance_meters: 100 }),
    googleCandidate("google-b", { distance_meters: 900 }),
    googleCandidate("google-b", { distance_meters: 50 }),
    googleCandidate("google-d"),
    googleCandidate("google-e"),
  ]);

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => state.adapter },
  );

  assertEquals(res.status, 200);
  assertEquals(state.fetchContexts.length, 1, "verdict uses one final Google fetch cycle");
  assertEquals(state.memberFetchReadCount, 0, "Q5 member fetches are not reused");
  assertEquals(
    state.insertedOptions.map((row) => row.google_place_id),
    ["google-c", "google-a", "google-b", "google-d", "google-e"],
    "Google identity is persisted without display payloads",
  );
  assert(
    state.insertedOptions.every((row) => row.payload !== undefined),
    "payload is passed only through the adapter boundary for transient scoring",
  );
  assertEquals(state.insertedVerdicts[0].option_id, "option_b");
  assertEquals(state.insertedVerdicts[0].winner_google_place_id, "google-b");
  assertEquals(state.insertedVerdicts[0].scoring_version, "verdict-fit-v1");
  assertEquals(state.insertedVerdicts[0].final_fit_score, 5.5);
  assertEquals(
    state.insertedSlate.map((row) => ({
      rank: row.slate_rank,
      google_place_id: row.google_place_id,
      score: row.final_fit_score,
      scoring_version: row.scoring_version,
    })),
    [
      { rank: 1, google_place_id: "google-b", score: 5.5, scoring_version: "verdict-fit-v1" },
      { rank: 2, google_place_id: "google-a", score: 4.4, scoring_version: "verdict-fit-v1" },
      { rank: 3, google_place_id: "google-c", score: 3.3, scoring_version: "verdict-fit-v1" },
    ],
  );
  assertEquals(
    state.insertedSlate.every((row) =>
      !("display_name" in row) && !("rating" in row) && !("distance_meters" in row)
    ),
    true,
    "slate rows keep app-owned metadata only",
  );
});
