import {
  type CandidateOption,
  computeVerdict,
  type HardVeto,
  type MemberVote,
  type VerdictEngineOutput,
  type VerdictMethod,
} from "../_shared/verdict-engine.ts";
import { unionMemberFetches } from "../_shared/member-fetch-union.ts";
import {
  buildPreferenceFunction,
  type PreferenceFunctionOptions,
  type Q5VenueProfile,
  scoreVibeAxis,
  THRESHOLD_T,
  VIBE_SCALE_STOPS,
} from "../_shared/preference-function.ts";
import { classifyVenuePool } from "../_shared/venue-classifier.ts";
import {
  evaluateHardEligibility,
  type HardEligibilityVote,
} from "../_shared/hard-eligibility.ts";
import {
  isLocalTestRunLoggingEnabled,
  logLocalTestEvent,
} from "../_shared/local-test-run-logger.ts";
import {
  scoreVibeFitCandidate,
  scoreVibeFitCandidateFlow,
  VIBE_FIT_CONFIG,
  type VibeEmbeddingFetch,
  type VibeFitCandidate,
  type VibeFitSignal,
} from "../_shared/vibe-fit.ts";
import {
  type GoogleTargetOpenTime,
  googleTargetOpenTimeForMealTime,
} from "../_shared/google-opening-hours.ts";
import type {
  ComputeVerdictDataAdapter,
  ComputeVerdictEnv,
  GoogleVerdictCandidateRow,
  GoogleVerdictFetchContext,
  MemberVoteRow,
  RoomOptionRow,
  RoomRerollState,
  VerdictRow,
} from "./handler.ts";

export interface VerdictRunCandidatePoolContext {
  activeMemberIds: string[] | null;
  votes: MemberVoteRow[];
}

export interface PersistVerdictRunInput {
  roomId: string;
  result: VerdictEngineOutput;
  rerollReason: RoomRerollState["last_reroll_reason"];
}

export interface PersistVerdictRunOutput {
  verdict: VerdictRow;
  cuts: VerdictEngineOutput["cuts"];
}

type RoomEligibilityInput = {
  mealTiming: { target_open_time: GoogleTargetOpenTime };
  serviceShape: "dineIn" | "takeout";
};

export interface VerdictRunStore {
  loadRerollState(roomId: string): Promise<RoomRerollState | null>;
  readExistingVerdict(roomId: string): Promise<VerdictRow | null>;
  deleteVerdictForRoom(roomId: string): Promise<void>;
  loadRoom(
    roomId: string,
  ): Promise<
    {
      id: string;
      plan_id?: string | null;
      session_params?: Record<string, unknown> | null;
      location_tz?: string | null;
    } | null
  >;
  loadActiveMemberIds(roomId: string): Promise<string[] | null>;
  loadVotes(roomId: string): Promise<MemberVoteRow[]>;
  loadCandidatePool(
    roomId: string,
    context: VerdictRunCandidatePoolContext,
  ): Promise<RoomOptionRow[]>;
  loadRoomRadius(roomId: string): Promise<number | null>;
  loadProfileVetoes(
    userIds: string[],
  ): Promise<Record<string, HardVeto[]>>;
  loadPreviousWinnerName(roomId: string): Promise<string | null>;
  persistVerdictRun(
    input: PersistVerdictRunInput,
  ): Promise<PersistVerdictRunOutput>;
  publishVerdictReady(roomId: string, verdictId: string): Promise<void>;
  transitionPlanDecidedActive(planId: string): Promise<void>;
}

export type VerdictRunResult =
  | { kind: "already_computed"; verdict: VerdictRow }
  | { kind: "room_not_found" }
  | { kind: "no_votes" }
  | { kind: "engine_error"; detail: string }
  | {
    kind: "computed";
    verdict: VerdictRow;
    cuts: VerdictEngineOutput["cuts"];
    receipts: VerdictEngineOutput["receipts"];
    surviving_hard_needs: VerdictEngineOutput["surviving_hard_needs"];
    radius_meters_used: VerdictEngineOutput["radius_meters_used"];
    relax_chain_applied: VerdictEngineOutput["relax_chain_applied"];
  };

function roomEligibilityFromRoom(room: {
  session_params?: Record<string, unknown> | null;
  location_tz?: string | null;
}): RoomEligibilityInput {
  const sessionParams = room.session_params ?? {};
  const mealTime = typeof sessionParams.meal_time === "string"
    ? sessionParams.meal_time
    : "dinner";
  const rawServiceShape = typeof sessionParams.service_shape === "string"
    ? sessionParams.service_shape
    : "dineIn";

  return {
    mealTiming: {
      target_open_time: googleTargetOpenTimeForMealTime(mealTime, {
        timeZone: room.location_tz ?? null,
      }),
    },
    serviceShape: rawServiceShape === "takeout" ||
        rawServiceShape === "delivery"
      ? "takeout"
      : "dineIn",
  };
}

export function createVerdictRunStore(
  data: ComputeVerdictDataAdapter,
): VerdictRunStore {
  return {
    async loadRerollState(roomId) {
      return data.fetchRoomRerollState
        ? await data.fetchRoomRerollState(roomId)
        : null;
    },
    async readExistingVerdict(roomId) {
      return await data.existingVerdict(roomId);
    },
    async deleteVerdictForRoom(roomId) {
      await data.deleteVerdictForRoom(roomId);
    },
    async loadRoom(roomId) {
      return await data.fetchRoom(roomId);
    },
    async loadActiveMemberIds(roomId) {
      return data.fetchActiveMemberIds
        ? await data.fetchActiveMemberIds(roomId)
        : null;
    },
    async loadVotes(roomId) {
      return await data.fetchVotes(roomId);
    },
    async loadCandidatePool(roomId, context) {
      let optionRows = await data.fetchOptions(roomId);
      const googleOptionRows = await fetchGoogleVerdictOptionRows(
        data,
        roomId,
        context.activeMemberIds,
        context.votes,
      );
      if (googleOptionRows !== null) {
        return googleOptionRows;
      }
      if (
        optionRows.length === 0 &&
        data.fetchMemberFetches &&
        data.insertOptions
      ) {
        const activeMemberIdSet = context.activeMemberIds
          ? new Set(context.activeMemberIds)
          : null;
        const memberFetches = filterRowsToActiveMembers(
          await data.fetchMemberFetches(roomId),
          activeMemberIdSet,
        );
        const unionRows = unionMemberFetches(roomId, memberFetches);
        if (unionRows.length > 0) {
          await data.insertOptions(unionRows);
          optionRows = await data.fetchOptions(roomId);
        }
      }
      return optionRows;
    },
    async loadRoomRadius(roomId) {
      return await data.fetchRoomRadius(roomId);
    },
    async loadProfileVetoes(userIds) {
      return data.fetchProfileVetoes
        ? await data.fetchProfileVetoes(userIds)
        : {};
    },
    async loadPreviousWinnerName(roomId) {
      return data.fetchPreviousWinnerName
        ? await data.fetchPreviousWinnerName(roomId)
        : null;
    },
    async persistVerdictRun(input) {
      const result = input.result;
      const winningSlateEntry = result.slate[0];
      const verdict = await data.insertVerdict({
        room_id: input.roomId,
        option_id: result.winning_option_id,
        method: result.method,
        rule_text: result.rule_text,
        winner_place_provider: winningSlateEntry?.google_place_id
          ? "google"
          : null,
        winner_google_place_id: winningSlateEntry?.google_place_id ?? null,
        final_fit_score: winningSlateEntry?.final_fit_score ?? null,
        scoring_version: winningSlateEntry?.scoring_version ?? null,
        receipts: result.receipts,
        reroll_reason: input.rerollReason,
      });

      if (result.cuts.length > 0) {
        await data.insertOptionCuts(result.cuts.map((c) => ({
          verdict_id: verdict.id,
          option_id: c.option_id,
          cut_reason: c.cut_reason,
          cut_text: c.cut_text,
        })));
      }
      if (data.insertVerdictSlateEntries && result.slate.length > 0) {
        await data.insertVerdictSlateEntries(result.slate.map((entry) => ({
          verdict_id: verdict.id,
          room_id: input.roomId,
          slate_rank: entry.slate_rank,
          place_provider: "google",
          google_place_id: entry.google_place_id,
          final_fit_score: entry.final_fit_score,
          scoring_version: entry.scoring_version,
          receipts: result.receipts,
        })));
      }
      return { verdict, cuts: result.cuts };
    },
    async publishVerdictReady(roomId, verdictId) {
      if (data.markRoomVerdictReady) {
        try {
          await data.markRoomVerdictReady(roomId);
        } catch (e) {
          console.warn("compute-verdict markRoomVerdictReady failed:", e);
        }
      }
      if (data.emitVerdictReadyBroadcast) {
        try {
          await data.emitVerdictReadyBroadcast(roomId, verdictId);
        } catch (e) {
          console.warn("compute-verdict emitVerdictReadyBroadcast failed:", e);
        }
      }
    },
    async transitionPlanDecidedActive(planId) {
      if (!data.setPlanDecidedActive) return;
      try {
        await data.setPlanDecidedActive(planId);
      } catch (e) {
        console.warn("compute-verdict setPlanDecidedActive failed:", e);
      }
    },
  };
}

export async function runVerdictForRoom(input: {
  roomId: string;
  method: VerdictMethod;
  env: ComputeVerdictEnv;
  store: VerdictRunStore;
  vibeEmbeddingFetch?: VibeEmbeddingFetch;
}): Promise<VerdictRunResult> {
  const { roomId, method, store } = input;
  logLocalTestEvent("verdict.run.start", { roomId, method });
  const rerollState = await store.loadRerollState(roomId);
  const isRerollRun = (rerollState?.last_reroll_reason ?? null) !== null;
  logLocalTestEvent("verdict.run.reroll_state", {
    roomId,
    rerollState,
    isRerollRun,
  });

  const existing = await store.readExistingVerdict(roomId);
  if (existing) {
    if (!isRerollRun) {
      logLocalTestEvent("verdict.run.already_computed", {
        roomId,
        existing,
      });
      return { kind: "already_computed", verdict: existing };
    }
    logLocalTestEvent("verdict.run.delete_existing_for_reroll", {
      roomId,
      existing,
    });
    await store.deleteVerdictForRoom(roomId);
  }

  const room = await store.loadRoom(roomId);
  if (!room) {
    logLocalTestEvent("verdict.run.room_not_found", { roomId });
    return { kind: "room_not_found" };
  }
  const roomEligibility = roomEligibilityFromRoom(room);
  logLocalTestEvent("verdict.run.room", {
    roomId,
    room,
    roomEligibility,
  });

  const activeMemberIds = await store.loadActiveMemberIds(roomId);
  const activeMemberIdSet = activeMemberIds ? new Set(activeMemberIds) : null;
  const voteRows = filterRowsToActiveMembers(
    await store.loadVotes(roomId),
    activeMemberIdSet,
  );
  logLocalTestEvent("verdict.run.votes", {
    roomId,
    activeMemberIds,
    voteRows,
  });
  if (voteRows.length === 0) {
    logLocalTestEvent("verdict.run.no_votes", { roomId, activeMemberIds });
    return { kind: "no_votes" };
  }

  const optionRows = await store.loadCandidatePool(roomId, {
    activeMemberIds,
    votes: voteRows,
  });
  const startingRadius = await store.loadRoomRadius(roomId);
  const candidates = optionRows.map(candidateOptionFromOptionRow);
  logLocalTestEvent("verdict.candidates.before_verdict", {
    roomId,
    startingRadius,
    optionRows,
    candidates,
  });
  const venueProfiles = classifyVenuePool(candidates);
  const profileVetoes = await store.loadProfileVetoes(
    voteRows.map((r) => r.user_id),
  );
  logLocalTestEvent("verdict.run.profile_vetoes", {
    roomId,
    profileVetoes,
  });

  const effectiveVoteInputs: EffectiveVoteInput[] = voteRows.map((row) => ({
    row,
    q1_vetoes: mergeQ1Vetoes(row.q1_vetoes, row.q1_vetoes_extra),
    q2_budget: rerollState?.budget_tier_override != null
      ? Math.min(row.q2_budget, rerollState.budget_tier_override)
      : row.q2_budget,
    hard_vetoes: mergeHardVetoes(
      row.hard_vetoes ?? [],
      profileVetoes[row.user_id] ?? [],
    ),
  }));
  logLocalTestEvent("verdict.run.effective_vote_inputs", {
    roomId,
    effectiveVoteInputs,
  });
  const eligibleVibeFitCandidates = buildEligibleVibeFitCandidatesForVerdict({
    optionRows,
    votes: effectiveVoteInputs,
    radiusMeters: startingRadius,
    mealTiming: roomEligibility.mealTiming,
    serviceShape: roomEligibility.serviceShape,
  });
  logLocalTestEvent("verdict.vibe_fit.eligible_candidates", {
    roomId,
    candidateCount: eligibleVibeFitCandidates.length,
    candidates: eligibleVibeFitCandidates,
  });
  const transientVibeFitSignalsByCandidateId =
    await scoreEligibleVibeFitCandidates(
      eligibleVibeFitCandidates,
      input.env,
      input.vibeEmbeddingFetch,
    );
  logLocalTestEvent("verdict.vibe_fit.signals", {
    roomId,
    signals: [...transientVibeFitSignalsByCandidateId.entries()].map(
      ([candidateId, signal]) => ({ candidateId, signal }),
    ),
  });
  const useVibeFitPreferenceScoring = optionRows.some(hasVibeFitCandidate);
  const vibeFitPreferenceOptions: PreferenceFunctionOptions =
    useVibeFitPreferenceScoring
      ? buildVibeFitPreferenceOptions(transientVibeFitSignalsByCandidateId)
      : {};

  const votes: MemberVote[] = effectiveVoteInputs.map(({
    row,
    q1_vetoes,
    q2_budget,
    hard_vetoes,
  }) => {
    let prefFn: MemberVote["prefFn"] | undefined;
    if (row.preference_inputs) {
      const built = buildPreferenceFunction(
        row.preference_inputs.member,
        row.preference_inputs.q5Ratings,
        vibeFitPreferenceOptions,
      );
      prefFn = (candidate) => {
        const profile = venueProfiles.get(candidate.id);
        if (!profile) return 5;
        const scoringProfile: VibeFitScoringVenueProfile = {
          ...profile,
          vibeFitCandidateId: candidate.google_place_id ?? candidate.id,
        };
        return built(scoringProfile);
      };
    }
    return {
      user_id: row.user_id,
      display_name: row.display_name,
      q1_vetoes,
      q2_budget,
      hard_vetoes,
      scores: row.scores ?? {},
      prefFn,
    };
  });
  logLocalTestEvent("verdict.votes.before_compute", {
    roomId,
    useVibeFitPreferenceScoring,
    votes: votes.map((vote) => ({
      user_id: vote.user_id,
      display_name: vote.display_name,
      q1_vetoes: vote.q1_vetoes,
      q2_budget: vote.q2_budget,
      hard_vetoes: vote.hard_vetoes,
      scores: vote.scores,
      hasPrefFn: typeof vote.prefFn === "function",
    })),
  });
  if (isLocalTestRunLoggingEnabled()) {
    logLocalTestEvent("verdict.scores.before_compute", {
      roomId,
      method,
      candidates,
      scoreMatrix: buildVerdictScoreMatrix(votes, candidates),
    });
  }

  let previousWinnerName: string | undefined;
  if (isRerollRun) {
    previousWinnerName = (await store.loadPreviousWinnerName(roomId)) ??
      undefined;
    logLocalTestEvent("verdict.run.previous_winner", {
      roomId,
      previousWinnerName,
    });
  }

  let result: VerdictEngineOutput;
  try {
    result = computeVerdict({
      candidates,
      votes,
      method,
      meal_timing: roomEligibility.mealTiming,
      service_shape: roomEligibility.serviceShape,
      radius_meters: startingRadius ?? undefined,
      excluded_option_ids: rerollState?.excluded_option_ids,
      reroll_reason: rerollState?.last_reroll_reason ?? undefined,
      previous_winner_name: previousWinnerName,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("compute-verdict engine error:", e);
    logLocalTestEvent("verdict.engine.error", {
      roomId,
      message,
      error: e,
    });
    return { kind: "engine_error", detail: message };
  }
  logLocalTestEvent("verdict.engine.result", { roomId, result });

  if (optionRows.some((row) => row.google_place_id)) {
    const durableScoringVersion = buildDurableVerdictScoringVersion(
      transientVibeFitSignalsByCandidateId.values(),
    );
    result = {
      ...result,
      slate: result.slate.map((entry) => ({
        ...entry,
        scoring_version: durableScoringVersion,
      })),
    };
    logLocalTestEvent("verdict.engine.result_scoring_versioned", {
      roomId,
      durableScoringVersion,
      result,
    });
  }

  const persisted = await store.persistVerdictRun({
    roomId,
    result,
    rerollReason: rerollState?.last_reroll_reason ?? null,
  });
  logLocalTestEvent("verdict.persisted", {
    roomId,
    persisted,
    result,
  });
  await store.publishVerdictReady(roomId, persisted.verdict.id);
  logLocalTestEvent("verdict.published", {
    roomId,
    verdictId: persisted.verdict.id,
  });

  const planId = room.plan_id ?? null;
  if (planId) {
    await store.transitionPlanDecidedActive(planId);
    logLocalTestEvent("verdict.plan_transitioned", {
      roomId,
      planId,
    });
  }

  return {
    kind: "computed",
    verdict: persisted.verdict,
    cuts: persisted.cuts,
    receipts: result.receipts,
    surviving_hard_needs: result.surviving_hard_needs,
    radius_meters_used: result.radius_meters_used,
    relax_chain_applied: result.relax_chain_applied,
  };
}

export function mergeQ1Vetoes(
  base: readonly string[],
  extra: readonly string[] | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const chip of base) {
    const key = chip.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
  }
  if (!extra) return out;
  for (const chip of extra) {
    const key = chip.trim().toLowerCase();
    if (key.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
  }
  return out;
}

export function mergeHardVetoes(
  session: readonly HardVeto[],
  profile: readonly HardVeto[],
): HardVeto[] {
  const out: HardVeto[] = [];
  const seen = new Set<string>();
  for (const v of [...session, ...profile]) {
    const key = `${v.kind}\u0000${v.token.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function filterRowsToActiveMembers<T extends { user_id: string }>(
  rows: T[],
  activeMemberIdSet: ReadonlySet<string> | null,
): T[] {
  return activeMemberIdSet
    ? rows.filter((row) => activeMemberIdSet.has(row.user_id))
    : rows;
}

function buildVerdictScoreMatrix(
  votes: readonly MemberVote[],
  candidates: readonly CandidateOption[],
) {
  return candidates.map((candidate) => {
    const memberScores = votes.map((vote) => {
      if (vote.prefFn) {
        try {
          return {
            user_id: vote.user_id,
            display_name: vote.display_name,
            source: "preference_function",
            score: vote.prefFn(candidate),
          };
        } catch (error) {
          return {
            user_id: vote.user_id,
            display_name: vote.display_name,
            source: "preference_function",
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      return {
        user_id: vote.user_id,
        display_name: vote.display_name,
        source: "legacy_scores",
        score: (vote.scores ?? {})[candidate.id] ?? THRESHOLD_T,
      };
    });
    const numericScores = memberScores
      .map((entry) => "score" in entry ? entry.score : null)
      .filter((score): score is number => typeof score === "number");
    return {
      candidateId: candidate.id,
      googlePlaceId: candidate.google_place_id,
      name: candidate.name,
      candidate,
      memberScores,
      minScore: numericScores.length > 0 ? Math.min(...numericScores) : null,
      totalScore: numericScores.reduce((sum, score) => sum + score, 0),
      averageScore: numericScores.length > 0
        ? numericScores.reduce((sum, score) => sum + score, 0) /
          numericScores.length
        : null,
    };
  });
}

function dedupeGoogleVerdictCandidates(
  candidates: readonly GoogleVerdictCandidateRow[],
): GoogleVerdictCandidateRow[] {
  const seen = new Set<string>();
  const out: GoogleVerdictCandidateRow[] = [];
  for (const candidate of candidates) {
    const id = candidate.google_place_id.trim();
    if (id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    out.push({ ...candidate, google_place_id: id });
  }
  return out;
}

async function fetchGoogleVerdictOptionRows(
  data: ComputeVerdictDataAdapter,
  roomId: string,
  activeMemberIds: string[] | null,
  voteRows: MemberVoteRow[],
): Promise<RoomOptionRow[] | null> {
  if (!data.fetchGoogleVerdictCandidates) return null;

  const context: GoogleVerdictFetchContext = {
    active_member_ids: activeMemberIds ?? voteRows.map((row) => row.user_id),
    votes: voteRows,
  };
  logLocalTestEvent("verdict.google_options.before_fetch", {
    roomId,
    activeMemberIds,
    voteRows,
    context,
  });
  const googleCandidates = await data.fetchGoogleVerdictCandidates(
    roomId,
    context,
  );
  logLocalTestEvent("verdict.google_options.raw_candidates", {
    roomId,
    candidateCount: googleCandidates.length,
    googleCandidates,
  });
  const dedupedGoogleCandidates = dedupeGoogleVerdictCandidates(
    googleCandidates,
  );
  logLocalTestEvent("verdict.google_options.deduped_candidates", {
    roomId,
    candidateCount: dedupedGoogleCandidates.length,
    dedupedGoogleCandidates,
  });
  if (dedupedGoogleCandidates.length === 0) {
    logLocalTestEvent("verdict.google_options.empty", { roomId });
    return [];
  }

  const googleOptionRows = dedupedGoogleCandidates.map((candidate) => ({
    id: candidate.google_place_id,
    room_id: roomId,
    google_place_id: candidate.google_place_id,
    place_provider: "google" as const,
    payload: candidate.payload,
  }));
  logLocalTestEvent("verdict.google_options.option_rows", {
    roomId,
    googleOptionRows,
  });

  if (!data.insertOptions) {
    logLocalTestEvent("verdict.google_options.return_without_insert", {
      roomId,
      googleOptionRows,
    });
    return googleOptionRows;
  }

  await data.insertOptions(googleOptionRows);

  const optionIdByGooglePlaceId = buildGoogleOptionIdMap(
    await data.fetchOptions(roomId),
  );
  const insertedRows = dedupedGoogleCandidates.map((candidate) => ({
    id: optionIdByGooglePlaceId.get(candidate.google_place_id) ??
      candidate.google_place_id,
    google_place_id: candidate.google_place_id,
    place_provider: "google" as const,
    payload: candidate.payload,
    vibe_fit_candidate: candidate.vibe_fit_candidate,
  }));
  logLocalTestEvent("verdict.google_options.inserted_rows", {
    roomId,
    optionIdByGooglePlaceId,
    insertedRows,
  });
  return insertedRows;
}

function buildGoogleOptionIdMap(
  optionRows: readonly RoomOptionRow[],
): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of optionRows) {
    if (typeof row.google_place_id === "string") {
      out.set(row.google_place_id, row.id);
    }
  }
  return out;
}

type EffectiveVoteInput = HardEligibilityVote & { row: MemberVoteRow };
type VibeFitScoringVenueProfile = Q5VenueProfile & {
  vibeFitCandidateId?: string;
};

const VERDICT_SCORING_FORMULA_VERSION = "verdict-vibe-member-blend-v1";
const Q5_GENERATION_RULES_VERSION = "q5-factorial-v1";
const GOOGLE_SCORING_MASK_VERSION = "verdict_scoring_vibe_fit_v1";
const VERDICT_VIBE_FIT_MAX_TEXTS_PER_FLOW =
  (20 * VIBE_FIT_CONFIG.maxSpansPerCandidate +
    VIBE_FIT_CONFIG.anchors.flatMap((anchor) => anchor.phrases).length) * 2;

function clampLegacyVibeIndex(value: number): number {
  return Math.max(0, Math.min(VIBE_SCALE_STOPS - 1, Math.round(value)));
}

export function buildEligibleVibeFitCandidatesForVerdict(input: {
  optionRows: readonly RoomOptionRow[];
  votes: readonly HardEligibilityVote[];
  radiusMeters: number | null;
  mealTiming?: { target_open_time?: GoogleTargetOpenTime | null };
  serviceShape?: "dineIn" | "takeout" | null;
}): VibeFitCandidate[] {
  const eligibleCandidates: VibeFitCandidate[] = [];
  for (const row of input.optionRows) {
    if (!hasVibeFitCandidate(row)) continue;
    const candidate = hardEligibilityCandidateFromOptionRow(row);
    if (!candidate) continue;

    const eligibility = evaluateHardEligibility({
      candidate,
      votes: input.votes,
      room: {
        radius_meters: input.radiusMeters,
        meal_timing: input.mealTiming,
        service_shape: input.serviceShape,
      },
    });
    if (eligibility.eligible) {
      eligibleCandidates.push(row.vibe_fit_candidate);
    }
  }
  return eligibleCandidates;
}

function hasVibeFitCandidate(
  row: RoomOptionRow,
): row is RoomOptionRow & { vibe_fit_candidate: VibeFitCandidate } {
  return row.vibe_fit_candidate !== undefined;
}

async function scoreEligibleVibeFitCandidates(
  candidates: readonly VibeFitCandidate[],
  env: ComputeVerdictEnv,
  fetch?: VibeEmbeddingFetch,
): Promise<Map<string, VibeFitSignal>> {
  const out = new Map<string, VibeFitSignal>();
  logLocalTestEvent("verdict.vibe_fit.score_start", {
    candidateCount: candidates.length,
    candidates,
    embeddingsEnabled: env.VIBE_EMBEDDINGS_ENABLED,
    mode: candidates.every((candidate) => candidate.embeddingMode === "fake")
      ? "fake"
      : "voyage",
  });
  if (candidates.length === 0) {
    logLocalTestEvent("verdict.vibe_fit.score_empty", {});
    return out;
  }
  let signals: VibeFitSignal[];
  if (candidates.every((candidate) => candidate.embeddingMode === "fake")) {
    signals = candidates.map((candidate) => scoreVibeFitCandidate(candidate));
  } else {
    signals = await scoreVibeFitCandidateFlow(candidates, {
      env: {
        VOYAGE_API_KEY: env.VOYAGE_API_KEY,
        VIBE_EMBEDDINGS_ENABLED: env.VIBE_EMBEDDINGS_ENABLED,
      },
      budget: { maxTextsPerFlow: VERDICT_VIBE_FIT_MAX_TEXTS_PER_FLOW },
      ...(fetch ? { fetch } : {}),
    });
  }
  for (const signal of signals) {
    out.set(signal.candidateId, signal);
  }
  logLocalTestEvent("verdict.vibe_fit.score_result", {
    signals,
    signalsByCandidateId: out,
  });
  return out;
}

export function scoreVibeFitSignalForMember(
  signal: VibeFitSignal | undefined,
  statedLegacyVibe: number,
): number {
  if (!signal || signal.vibePosition === null) return THRESHOLD_T;
  if (!Number.isFinite(statedLegacyVibe)) return THRESHOLD_T;
  const rawScore = scoreVibeAxis(
    signal.vibePosition - 1,
    clampLegacyVibeIndex(statedLegacyVibe),
  );
  const confidence = Math.max(0, Math.min(1, signal.confidence));
  return THRESHOLD_T + (rawScore - THRESHOLD_T) * confidence;
}

function buildVibeFitPreferenceOptions(
  signalsByCandidateId: ReadonlyMap<string, VibeFitSignal>,
): PreferenceFunctionOptions {
  return {
    scoreVibeAxis: (_venueVibe, statedVibe, venue) => {
      const candidateId = vibeFitCandidateIdForVenue(venue);
      if (!candidateId) return THRESHOLD_T;
      return scoreVibeFitSignalForMember(
        signalsByCandidateId.get(candidateId),
        statedVibe,
      );
    },
  };
}

function vibeFitCandidateIdForVenue(
  venue: Q5VenueProfile,
): string | undefined {
  if (!("vibeFitCandidateId" in venue)) return undefined;
  return typeof venue.vibeFitCandidateId === "string"
    ? venue.vibeFitCandidateId
    : undefined;
}

function buildDurableVerdictScoringVersion(
  signals: Iterable<VibeFitSignal>,
): string {
  const projectionVersions = [
    ...new Set([...signals].map((signal) => signal.projectionVersion)),
  ].sort();
  const projectionVersion = projectionVersions.length > 0
    ? projectionVersions.join("+")
    : VIBE_FIT_CONFIG.voyageProjectionVersion;
  return [
    "verdict-fit-v2",
    `google_mask=${GOOGLE_SCORING_MASK_VERSION}`,
    `vibe_anchor=${VIBE_FIT_CONFIG.anchorVersion}`,
    `vibe_span=${VIBE_FIT_CONFIG.spanAssemblerVersion}`,
    `embedding=voyage:${VIBE_FIT_CONFIG.voyageModel}`,
    `projection=${projectionVersion}`,
    `q5=${Q5_GENERATION_RULES_VERSION}`,
    `formula=${VERDICT_SCORING_FORMULA_VERSION}`,
  ].join("|");
}

function hardEligibilityCandidateFromOptionRow(
  row: RoomOptionRow,
): CandidateOption | null {
  if (!row.payload) return null;
  return candidateOptionFromOptionRow(row);
}

function candidateOptionFromOptionRow(row: RoomOptionRow): CandidateOption {
  const payload = row.payload;
  return {
    id: row.id,
    google_place_id: row.google_place_id,
    name: payload?.name ?? "Unnamed",
    price_tier: payload?.price_tier ?? null,
    dietary_tags: payload?.dietary_tags ?? [],
    categories: payload?.categories ?? [],
    distance_meters: payload?.distance_meters ?? null,
    rating: payload?.rating ?? null,
    total_ratings: payload?.total_ratings ?? null,
    user_rating_count: payload?.user_rating_count ?? null,
    date_created: payload?.date_created ?? null,
    tastes: payload?.tastes ?? [],
    current_open_now: payload?.current_open_now ?? null,
    regular_opening_periods: payload?.regular_opening_periods,
    dine_in: payload?.dine_in ?? null,
    takeout: payload?.takeout ?? null,
  };
}
