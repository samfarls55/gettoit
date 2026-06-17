import {
  assert,
  assertAlmostEquals,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildEligibleVibeFitCandidatesForVerdict,
  type ComputeVerdictDataAdapter,
  type GoogleVerdictCandidateRow,
  type GoogleVerdictFetchContext,
  handleRequest,
  type MemberVoteRow,
  type OptionCutInsert,
  type OptionInsertRow,
  type RoomOptionRow,
  scoreVibeFitSignalForMember,
  type VerdictInsert,
  type VerdictSlateEntryInsert,
} from "./handler.ts";
import {
  buildVibeFitCandidate,
  type VibeFitSignal,
} from "../_shared/vibe-fit.ts";
import { GOOGLE_PROVIDER_FIELD_MASKS } from "../_shared/google-provider-runtime.ts";
import {
  type CandidateOption,
  computeVerdict,
} from "../_shared/verdict-engine.ts";

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

function preferenceVote(userId: string, vibe: number): MemberVoteRow {
  return {
    user_id: userId,
    display_name: userId,
    q1_vetoes: [],
    q2_budget: 4,
    hard_vetoes: [],
    scores: {},
    preference_inputs: {
      user_id: userId,
      member: {
        cuisines: [],
        reputation: "no_preference",
        vibe,
      },
      q5Ratings: [],
    },
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
  votes: MemberVoteRow[] = [
    vote({
      option_b: 5,
      option_a: 4,
      option_c: 3,
      option_d: 2,
      option_e: 1,
    }),
  ],
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
      return votes.map((row) => row.user_id);
    },
    async fetchVotes(_id) {
      return votes;
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
  assertEquals(
    state.fetchContexts.length,
    1,
    "verdict uses one final Google fetch cycle",
  );
  assertEquals(
    state.memberFetchReadCount,
    0,
    "Q5 member fetches are not reused",
  );
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
  assertStringIncludes(
    state.insertedVerdicts[0].scoring_version ?? "",
    "verdict-fit-v2|google_mask=verdict_scoring_vibe_fit_v1",
  );
  assertStringIncludes(
    state.insertedVerdicts[0].scoring_version ?? "",
    "embedding=voyage:voyage-4-lite",
  );
  assertEquals(state.insertedVerdicts[0].final_fit_score, 5.5);
  assertEquals(
    state.insertedSlate.map((row) => ({
      rank: row.slate_rank,
      google_place_id: row.google_place_id,
      score: row.final_fit_score,
    })),
    [
      { rank: 1, google_place_id: "google-b", score: 5.5 },
      { rank: 2, google_place_id: "google-a", score: 4.4 },
      { rank: 3, google_place_id: "google-c", score: 3.3 },
    ],
  );
  assert(
    state.insertedSlate.every((row) =>
      row.scoring_version.includes("vibe_anchor=vibe-anchors-v1") &&
      row.scoring_version.includes("formula=verdict-vibe-member-blend-v1")
    ),
    "slate scoring version identifies Vibe Fit and verdict formula versions",
  );
  assertEquals(
    state.insertedSlate.every((row) =>
      !("display_name" in row) && !("rating" in row) &&
      !("distance_meters" in row)
    ),
    true,
    "slate rows keep app-owned metadata only",
  );
});

Deno.test("TB-07: Vibe Fit member scoring degrades missing and low-confidence evidence toward neutral", () => {
  const exactQuietLowConfidence: VibeFitSignal = {
    candidateId: "google-quiet",
    anchorVersion: "vibe-anchors-v1",
    spanAssemblerVersion: "vibe-span-assembler-v1",
    projectionVersion: "vibe-projection-fake-v1",
    vibePosition: 1,
    confidence: 0.25,
    receiptCodes: ["vibe_low_confidence"],
  };
  const exactQuietHighConfidence: VibeFitSignal = {
    ...exactQuietLowConfidence,
    confidence: 1,
    receiptCodes: [],
  };
  const socialHighConfidence: VibeFitSignal = {
    ...exactQuietHighConfidence,
    candidateId: "google-social",
    vibePosition: 3,
  };

  assertEquals(scoreVibeFitSignalForMember(undefined, 0), 3);
  assertEquals(
    scoreVibeFitSignalForMember({
      ...exactQuietLowConfidence,
      vibePosition: null,
    }, 0),
    3,
  );
  assertAlmostEquals(
    scoreVibeFitSignalForMember(exactQuietLowConfidence, 0),
    3.5,
  );
  assertEquals(scoreVibeFitSignalForMember(exactQuietHighConfidence, 0), 5);
  assertEquals(scoreVibeFitSignalForMember(socialHighConfidence, 0), 3);
  assertEquals(scoreVibeFitSignalForMember(socialHighConfidence, 4), 3);
});

Deno.test("TB-07: Google verdict scoring keeps no-vibe-evidence candidates eligible", async () => {
  const state = adapterForGoogleVerdictFetch([
    {
      ...googleCandidate("google-rowdy"),
      vibe_fit_candidate: buildVibeFitCandidate({
        candidateId: "google-rowdy",
        googlePlaceId: "google-rowdy",
        reviewSummary: "Packed loud rowdy party energy.",
        generativeSummary: "A high-energy room with live music.",
        embeddingMode: "fake",
      }),
    },
    googleCandidate("google-no-evidence"),
  ], [preferenceVote("u1", 0)]);

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => state.adapter },
  );

  assertEquals(res.status, 200);
  assertEquals(
    state.insertedVerdicts[0].winner_google_place_id,
    "google-no-evidence",
    "neutral missing vibe evidence can beat a strong opposite vibe",
  );
  const durable = JSON.stringify({
    verdicts: state.insertedVerdicts,
    slate: state.insertedSlate,
  });
  for (const forbidden of ["vibePosition", "confidence", "Packed loud"]) {
    assertEquals(durable.includes(forbidden), false, forbidden);
  }
});

Deno.test("TB-04: Google verdict masks keep summaries internal to enabled scoring", () => {
  const indexSource = Deno.readTextFileSync(
    new URL("./index.ts", import.meta.url),
  );
  const summaryFields = [
    "places.reviewSummary",
    "places.generativeSummary",
  ];

  for (const summaryField of summaryFields) {
    assertEquals(
      GOOGLE_PROVIDER_FIELD_MASKS.verdict_fetch.mask.includes(summaryField),
      false,
      `${summaryField} must not be in the base verdict fetch mask`,
    );
    assertEquals(
      GOOGLE_PROVIDER_FIELD_MASKS.verdict_display.mask.includes(summaryField),
      false,
      `${summaryField} must not be in the verdict display mask`,
    );
    assertStringIncludes(
      GOOGLE_PROVIDER_FIELD_MASKS.verdict_scoring.mask,
      summaryField,
    );
  }
  assertStringIncludes(indexSource, "GOOGLE_VERDICT_FETCH_FIELD_MASK");
  assertStringIncludes(indexSource, "GOOGLE_VERDICT_SCORING_FIELD_MASK");
  assertStringIncludes(indexSource, '"places.reviewSummary"');
  assertStringIncludes(indexSource, '"places.generativeSummary"');
  assertStringIncludes(indexSource, "isVibeFitEnabled(env)");
  assertStringIncludes(indexSource, "googleVerdictFieldMaskName(env)");
  assert(
    indexSource.indexOf('"places.reviewSummary"') >
      indexSource.indexOf("GOOGLE_VERDICT_SCORING_FIELD_MASK"),
    "summary fields must belong to the internal scoring mask, not the base fetch/display masks",
  );
});

Deno.test("TB-09: production Vibe Fit uses canonical embeddings flag and no fake embeddings", () => {
  const source = Deno.readTextFileSync(new URL("./index.ts", import.meta.url));

  assertStringIncludes(
    source,
    'VIBE_EMBEDDINGS_ENABLED: Deno.env.get("VIBE_EMBEDDINGS_ENABLED")',
  );
  assertStringIncludes(
    source,
    'VOYAGE_API_KEY: Deno.env.get("VOYAGE_API_KEY")',
  );
  assertEquals(source.includes('embeddingMode: "fake"'), false);
});

Deno.test("TB-08: production Google verdict storage omits summaries and provider facts", () => {
  const source = Deno.readTextFileSync(new URL("./index.ts", import.meta.url));
  const insertOptionsStart = source.indexOf("async insertOptions");
  assert(insertOptionsStart >= 0, "insertOptions implementation must exist");
  const insertOptionsEnd = source.indexOf(
    "async fetchVotes",
    insertOptionsStart,
  );
  assert(
    insertOptionsEnd > insertOptionsStart,
    "fetchVotes implementation must follow insertOptions",
  );
  const insertOptionsSource = source.slice(
    insertOptionsStart,
    insertOptionsEnd,
  );

  assertStringIncludes(insertOptionsSource, "google_place_id");
  assertStringIncludes(insertOptionsSource, "place_provider");
  for (
    const forbidden of [
      "payload:",
      "reviewSummary",
      "generativeSummary",
      "displayName",
      "price_tier",
      "rating",
      "distance_meters",
      "vibePosition",
      "confidence",
    ]
  ) {
    assertEquals(insertOptionsSource.includes(forbidden), false, forbidden);
  }
});

Deno.test("TB-04: Vibe Fit summaries stay transient and are not inserted or returned", async () => {
  const state = adapterForGoogleVerdictFetch([
    {
      ...googleCandidate("google-vibe", {
        distance_meters: 100,
        current_open_now: true,
      }),
      vibe_fit_candidate: buildVibeFitCandidate({
        candidateId: "google-vibe",
        googlePlaceId: "google-vibe",
        reviewSummary: "Quiet booths and mellow dinner energy.",
        generativeSummary: "A cozy room for easy conversation.",
        embeddingMode: "fake",
      }),
    },
  ]);

  const res = await handleRequest(
    authedPost({ room_id: VALID_ROOM_ID }),
    { env: envOk(), buildDataAdapter: () => state.adapter },
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  const durable = JSON.stringify({
    insertedOptions: state.insertedOptions,
    insertedVerdicts: state.insertedVerdicts,
    insertedSlate: state.insertedSlate,
    response: body,
  });
  for (
    const forbidden of [
      "reviewSummary",
      "generativeSummary",
      "Quiet booths",
      "cozy room",
      "vibePosition",
      "confidence",
    ]
  ) {
    assertEquals(durable.includes(forbidden), false, forbidden);
  }
});

Deno.test("TB-04: Vibe Fit candidates are built only after hard eligibility cuts", () => {
  const eligible = {
    id: "eligible",
    google_place_id: "google-eligible",
    place_provider: "google" as const,
    payload: {
      price_tier: 2,
      rating: 4.2,
      user_rating_count: 30,
      categories: ["restaurant"],
      dietary_tags: ["vegan_friendly"],
      distance_meters: 100,
      current_open_now: true,
    },
    vibe_fit_candidate: buildVibeFitCandidate({
      candidateId: "google-eligible",
      reviewSummary: "Quiet mellow room.",
      embeddingMode: "fake",
    }),
  } satisfies RoomOptionRow;
  const overBudget = {
    ...eligible,
    id: "over-budget",
    google_place_id: "google-over-budget",
    payload: { ...eligible.payload, price_tier: 4 },
    vibe_fit_candidate: buildVibeFitCandidate({
      candidateId: "google-over-budget",
      reviewSummary: "Quiet mellow room.",
      embeddingMode: "fake",
    }),
  } satisfies RoomOptionRow;
  const lowCrowdFloor = {
    ...eligible,
    id: "low-crowd",
    google_place_id: "google-low-crowd",
    payload: { ...eligible.payload, rating: 3.6 },
    vibe_fit_candidate: buildVibeFitCandidate({
      candidateId: "google-low-crowd",
      reviewSummary: "Quiet mellow room.",
      embeddingMode: "fake",
    }),
  } satisfies RoomOptionRow;
  const cuisineNever = {
    ...eligible,
    id: "cuisine-never",
    google_place_id: "google-cuisine-never",
    payload: { ...eligible.payload, categories: ["sushi restaurant"] },
    vibe_fit_candidate: buildVibeFitCandidate({
      candidateId: "google-cuisine-never",
      reviewSummary: "Quiet mellow room.",
      embeddingMode: "fake",
    }),
  } satisfies RoomOptionRow;

  const candidates = buildEligibleVibeFitCandidatesForVerdict({
    optionRows: [eligible, overBudget, lowCrowdFloor, cuisineNever],
    radiusMeters: 200,
    votes: [{
      q1_vetoes: ["vegan"],
      q2_budget: 2,
      hard_vetoes: [{ kind: "cuisine_never", token: "sushi" }],
    }],
  });

  assertEquals(candidates.map((candidate) => candidate.candidateId), [
    "google-eligible",
  ]);

  const verdict = computeVerdict({
    candidates: [eligible, overBudget, lowCrowdFloor, cuisineNever].map(
      optionRowToCandidate,
    ),
    radius_meters: 200,
    votes: [{
      user_id: "u1",
      display_name: "u1",
      q1_vetoes: ["vegan"],
      q2_budget: 2,
      hard_vetoes: [{ kind: "cuisine_never", token: "sushi" }],
      scores: { __fallback: 5 },
    }],
  });

  assertEquals(verdict.winning_option_id, "eligible");
  assertEquals(
    verdict.cuts.map((cut) => [cut.option_id, cut.cut_reason]),
    [
      ["over-budget", "budget"],
      ["low-crowd", "crowd_floor"],
      ["cuisine-never", "veto"],
    ],
  );
});

function optionRowToCandidate(row: RoomOptionRow): CandidateOption {
  return {
    id: row.id,
    google_place_id: row.google_place_id,
    name: row.payload?.name ?? row.id,
    price_tier: row.payload?.price_tier ?? null,
    dietary_tags: row.payload?.dietary_tags ?? [],
    categories: row.payload?.categories ?? [],
    distance_meters: row.payload?.distance_meters ?? null,
    rating: row.payload?.rating ?? null,
    total_ratings: row.payload?.total_ratings ?? null,
    user_rating_count: row.payload?.user_rating_count ?? null,
    current_open_now: row.payload?.current_open_now ?? null,
    regular_opening_periods: row.payload?.regular_opening_periods,
    dine_in: row.payload?.dine_in ?? null,
    takeout: row.payload?.takeout ?? null,
  };
}
