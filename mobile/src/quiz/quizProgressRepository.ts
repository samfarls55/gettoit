export type QuizQuestionId = "q1" | "q2" | "q3" | "q4" | "q5";

export type QuizAnswers = {
  q1CuisineCravings?: string[];
  q2SpendCap?: number;
  q3Reputation?: string;
  q4VibeEnergy?: string;
  q5Ratings?: Record<string, number>;
};

export type QuizProgress = {
  roomId: string;
  currentQuestion: QuizQuestionId;
  answers: QuizAnswers;
};

export type QuizProgressRepository = {
  loadProgress: (roomId: string) => Promise<QuizProgress | null>;
  saveProgress: (progress: QuizProgress) => Promise<void>;
  exitPlan: (input: { roomId: string }) => Promise<void>;
};

export type QuizProgressRepositoryLogEvent = (
  event: string,
  payload: Record<string, unknown>,
) => void;

export type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type SupabaseUpsertOptions = {
  onConflict?: string;
  ignoreDuplicates?: boolean;
};

export type QuizProgressSupabaseQuery<TRow> = PromiseLike<
  SupabaseQueryResult<TRow[]>
> & {
  select: (columns: string) => QuizProgressSupabaseQuery<TRow>;
  eq: (column: string, value: unknown) => QuizProgressSupabaseQuery<TRow>;
};

export type QuizProgressSupabaseMutation<TRow> = PromiseLike<
  SupabaseQueryResult<TRow>
> & {
  eq: (
    column: string,
    value: unknown,
  ) => QuizProgressSupabaseMutation<TRow>;
};

export type QuizProgressSupabaseTable<TRow> =
  QuizProgressSupabaseQuery<TRow> & {
    delete: () => QuizProgressSupabaseMutation<TRow>;
    upsert: (
      row: Record<string, unknown>,
      options?: SupabaseUpsertOptions,
    ) => QuizProgressSupabaseMutation<TRow>;
  };

export type QuizProgressSupabaseClient = {
  from: <TRow>(table: string) => QuizProgressSupabaseTable<TRow>;
  rpc: <TData>(
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<SupabaseQueryResult<TData>>;
};

type SupabaseMemberProgressRow = {
  room_id: string;
  user_id: string;
  quiz_progress?: Record<string, unknown> | null;
};

type SupabaseRoomRow = {
  id: string;
  plan_id?: string | null;
  creator_user_id?: string | null;
};

export type SupabaseQuizProgressRepositoryDependencies = {
  logEvent?: QuizProgressRepositoryLogEvent;
  now?: () => number;
  supabase: QuizProgressSupabaseClient;
  userId: string;
};

const quizQuestionIds: readonly QuizQuestionId[] = [
  "q1",
  "q2",
  "q3",
  "q4",
  "q5",
];

function assertSupabaseRows<TRow>(
  result: SupabaseQueryResult<TRow[]>,
  queryName: string,
): TRow[] {
  if (result.error) {
    throw new Error(`${queryName} failed: ${result.error.message}`);
  }

  return result.data ?? [];
}

function isQuizQuestionId(value: unknown): value is QuizQuestionId {
  return (
    typeof value === "string" &&
    quizQuestionIds.includes(value as QuizQuestionId)
  );
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value.filter(
    (entry): entry is string => typeof entry === "string",
  );

  return strings.length > 0 ? strings : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function priceTier(value: unknown): number | undefined {
  const tier = typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : typeof value === "string"
      ? value.length
      : undefined;

  return tier !== undefined && tier >= 1 && tier <= 4 ? tier : undefined;
}

function q5Ratings(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const ratings = Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, number] => typeof entry[1] === "number")
      .map(([candidateId, score]) => [candidateId, score]),
  );

  return Object.keys(ratings).length > 0 ? ratings : undefined;
}

function quizAnswersFromStored(value: unknown): QuizAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const stored = value as Record<string, unknown>;
  const q2SpendCap = priceTier(stored.q2SpendCap);

  return {
    ...(stringArray(stored.q1CuisineCravings)
      ? { q1CuisineCravings: stringArray(stored.q1CuisineCravings) }
      : {}),
    ...(q2SpendCap ? { q2SpendCap } : {}),
    ...(stringValue(stored.q3Reputation)
      ? { q3Reputation: stringValue(stored.q3Reputation) }
      : {}),
    ...(stringValue(stored.q4VibeEnergy)
      ? { q4VibeEnergy: stringValue(stored.q4VibeEnergy) }
      : {}),
    ...(q5Ratings(stored.q5Ratings)
      ? { q5Ratings: q5Ratings(stored.q5Ratings) }
      : {}),
  };
}

function currentQuestionFromStored(
  progress: Record<string, unknown> | null | undefined,
): QuizQuestionId {
  if (!progress) {
    return "q1";
  }

  if (isQuizQuestionId(progress.current_question)) {
    return progress.current_question;
  }

  const lastIndex = progress.last_index;
  if (
    typeof lastIndex === "number" &&
    Number.isInteger(lastIndex) &&
    lastIndex >= 1 &&
    lastIndex <= quizQuestionIds.length
  ) {
    return quizQuestionIds[lastIndex - 1];
  }

  return "q1";
}

function progressWritePayload(progress: QuizProgress): Record<string, unknown> {
  return {
    current_question: progress.currentQuestion,
    last_index: quizQuestionIds.indexOf(progress.currentQuestion) + 1,
    answers: progress.answers,
  };
}

function durationMs(startedAt: number, now: () => number): number {
  return Math.max(0, Math.round(now() - startedAt));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logQuizProgressEvent(
  logEvent: QuizProgressRepositoryLogEvent | undefined,
  event: string,
  payload: Record<string, unknown>,
): void {
  try {
    logEvent?.(event, payload);
  } catch {
    // Logging must never change quiz progress behavior.
  }
}

function ownerMembershipWriteRow(
  roomId: string,
  userId: string,
): Record<string, unknown> {
  return {
    room_id: roomId,
    user_id: userId,
    role: "owner",
  };
}

async function ensureOwnerMembership(
  supabase: QuizProgressSupabaseClient,
  userId: string,
  room: SupabaseRoomRow,
): Promise<void> {
  if (room.creator_user_id !== userId) {
    return;
  }

  const result = await supabase
    .from<SupabaseMemberProgressRow>("members")
    .upsert(ownerMembershipWriteRow(room.id, userId), {
      onConflict: "room_id,user_id",
      ignoreDuplicates: true,
    });

  if (result.error) {
    throw new Error(`Quiz owner membership repair failed: ${result.error.message}`);
  }
}

async function resolveVisibleRoom(
  supabase: QuizProgressSupabaseClient,
  roomOrPlanId: string,
): Promise<SupabaseRoomRow | null> {
  const directRows = assertSupabaseRows(
    await supabase
      .from<SupabaseRoomRow>("rooms")
      .select("id, plan_id, creator_user_id")
      .eq("id", roomOrPlanId),
    "Quiz room read",
  );

  if (directRows[0]) {
    return directRows[0];
  }

  const planRoomRows = assertSupabaseRows(
    await supabase
      .from<SupabaseRoomRow>("rooms")
      .select("id, plan_id, creator_user_id")
      .eq("plan_id", roomOrPlanId),
    "Quiz plan room read",
  );

  return planRoomRows[0] ?? null;
}

export function createSupabaseQuizProgressRepository({
  logEvent,
  now = Date.now,
  supabase,
  userId,
}: SupabaseQuizProgressRepositoryDependencies): QuizProgressRepository {
  const log = (event: string, payload: Record<string, unknown>) =>
    logQuizProgressEvent(logEvent, event, payload);

  return {
    loadProgress: async (roomId) => {
      const startedAt = now();
      log("quiz.progress.load.start", { roomId });

      try {
        const resolvedRoom = await resolveVisibleRoom(supabase, roomId);
        log("quiz.progress.load.resolved_room", {
          requestedRoomId: roomId,
          resolvedRoom,
          durationMs: durationMs(startedAt, now),
        });
        if (!resolvedRoom) {
          log("quiz.progress.load.result", {
            requestedRoomId: roomId,
            progress: null,
            durationMs: durationMs(startedAt, now),
          });
          return null;
        }

        const rows = assertSupabaseRows(
          await supabase
            .from<SupabaseMemberProgressRow>("members")
            .select("room_id, user_id, quiz_progress")
            .eq("room_id", resolvedRoom.id)
            .eq("user_id", userId),
          "Quiz progress read",
        );
        const row = rows[0];

        if (!row) {
          await ensureOwnerMembership(supabase, userId, resolvedRoom);
          log("quiz.progress.load.missing_member", {
            requestedRoomId: roomId,
            resolvedRoomId: resolvedRoom.id,
            durationMs: durationMs(startedAt, now),
          });
          return null;
        }

        const storedProgress = row.quiz_progress ?? null;
        const progress = {
          roomId: resolvedRoom.id,
          currentQuestion: currentQuestionFromStored(storedProgress),
          answers: quizAnswersFromStored(storedProgress?.answers),
        };
        log("quiz.progress.load.result", {
          requestedRoomId: roomId,
          resolvedRoomId: resolvedRoom.id,
          storedProgress,
          mappedProgress: progress,
          durationMs: durationMs(startedAt, now),
        });

        return progress;
      } catch (error) {
        log("quiz.progress.load.error", {
          roomId,
          durationMs: durationMs(startedAt, now),
          message: errorMessage(error),
        });
        throw error;
      }
    },
    saveProgress: async (progress) => {
      const startedAt = now();
      const writePayload = progressWritePayload(progress);
      log("quiz.progress.save.start", { progress });

      try {
        const resolvedRoom = await resolveVisibleRoom(supabase, progress.roomId);
        log("quiz.progress.save.resolved_room", {
          requestedRoomId: progress.roomId,
          resolvedRoom,
          durationMs: durationMs(startedAt, now),
        });
        if (!resolvedRoom) {
          throw new Error("Quiz progress save failed: no joined room found");
        }
        await ensureOwnerMembership(supabase, userId, resolvedRoom);

        log("quiz.progress.save.request", {
          requestedRoomId: progress.roomId,
          resolvedRoomId: resolvedRoom.id,
          writePayload,
        });
        const result = await supabase.rpc("members_progress_upsert", {
          p_room_id: resolvedRoom.id,
          p_progress: writePayload,
        });

        if (result.error) {
          throw new Error(`Quiz progress save failed: ${result.error.message}`);
        }
        log("quiz.progress.save.success", {
          requestedRoomId: progress.roomId,
          resolvedRoomId: resolvedRoom.id,
          writePayload,
          durationMs: durationMs(startedAt, now),
        });
      } catch (error) {
        log("quiz.progress.save.error", {
          requestedRoomId: progress.roomId,
          progress,
          durationMs: durationMs(startedAt, now),
          message: errorMessage(error),
        });
        throw error;
      }
    },
    exitPlan: async ({ roomId }) => {
      const resolvedRoom = await resolveVisibleRoom(supabase, roomId);
      if (!resolvedRoom) {
        return;
      }

      const result = await supabase
        .from<SupabaseMemberProgressRow>("members")
        .delete()
        .eq("room_id", resolvedRoom.id)
        .eq("user_id", userId);

      if (result.error) {
        throw new Error(`Quiz exit failed: ${result.error.message}`);
      }
    },
  };
}
