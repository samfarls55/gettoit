export type QuizQuestionId = "q1" | "q2" | "q3" | "q4" | "q5";

export type QuizAnswers = {
  q1CuisineCravings?: string[];
  q2SpendCap?: string;
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

export type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
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

export type SupabaseQuizProgressRepositoryDependencies = {
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

  return {
    ...(stringArray(stored.q1CuisineCravings)
      ? { q1CuisineCravings: stringArray(stored.q1CuisineCravings) }
      : {}),
    ...(stringValue(stored.q2SpendCap)
      ? { q2SpendCap: stringValue(stored.q2SpendCap) }
      : {}),
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

export function createSupabaseQuizProgressRepository({
  supabase,
  userId,
}: SupabaseQuizProgressRepositoryDependencies): QuizProgressRepository {
  return {
    loadProgress: async (roomId) => {
      const rows = assertSupabaseRows(
        await supabase
          .from<SupabaseMemberProgressRow>("members")
          .select("room_id, user_id, quiz_progress")
          .eq("room_id", roomId)
          .eq("user_id", userId),
        "Quiz progress read",
      );
      const row = rows[0];

      if (!row) {
        return null;
      }

      const storedProgress = row.quiz_progress ?? null;
      return {
        roomId,
        currentQuestion: currentQuestionFromStored(storedProgress),
        answers: quizAnswersFromStored(storedProgress?.answers),
      };
    },
    saveProgress: async (progress) => {
      const result = await supabase.rpc("members_progress_upsert", {
        p_room_id: progress.roomId,
        p_progress: progressWritePayload(progress),
      });

      if (result.error) {
        throw new Error(`Quiz progress save failed: ${result.error.message}`);
      }
    },
    exitPlan: async ({ roomId }) => {
      const result = await supabase
        .from<SupabaseMemberProgressRow>("members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", userId);

      if (result.error) {
        throw new Error(`Quiz exit failed: ${result.error.message}`);
      }
    },
  };
}
