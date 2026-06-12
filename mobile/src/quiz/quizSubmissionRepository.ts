import type { Q5Candidate, Q5Axis } from "./q5Factorial";
import type { QuizAnswers } from "./quizProgressRepository";

export type QuizSubmissionPayload = {
  roomId: string;
  answers: QuizAnswers;
  q5Candidates: Q5Candidate[];
};

export type QuizSubmissionRepository = {
  submitQuiz: (payload: QuizSubmissionPayload) => Promise<void>;
};

export type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type QuizSubmissionSupabaseMutation<TRow> = PromiseLike<
  SupabaseQueryResult<TRow>
>;

export type QuizSubmissionSupabaseTable<TRow> = {
  insert: (row: Record<string, unknown>) => QuizSubmissionSupabaseMutation<TRow>;
};

export type QuizSubmissionSupabaseClient = {
  from: <TRow>(table: string) => QuizSubmissionSupabaseTable<TRow>;
};

type SupabaseVoteRow = {
  room_id: string;
  user_id: string;
};

type QuestionKind =
  | "budget_cap"
  | "cuisine_craving"
  | "reputation"
  | "vibe"
  | "regret";

type QuestionSlot = {
  meta: {
    question_kind: QuestionKind;
    prompt: string;
  };
  answer: Record<string, unknown>;
};

type VoteAxis = "cuisine" | "crowd_approval" | "vibe";

type Q5Rating = {
  droppedAxis: VoteAxis;
  score: number;
};

export type SupabaseQuizSubmissionRepositoryDependencies = {
  supabase: QuizSubmissionSupabaseClient;
  userId: string;
};

const noPreferenceValue = "noPreference";
const voteNoPreferenceValue = "no_preference";
const fallbackQ5Axes: readonly VoteAxis[] = [
  "cuisine",
  "crowd_approval",
  "vibe",
];

const vibeLevelByAnswer: Record<string, number> = {
  quiet: 0,
  chill: 1,
  social: 2,
  lively: 3,
  rowdy: 4,
};

function selectedCuisines(answers: QuizAnswers): string[] {
  return (answers.q1CuisineCravings ?? [])
    .filter((cuisine) => cuisine !== noPreferenceValue)
    .sort();
}

function budgetTier(answers: QuizAnswers): number {
  const tier = answers.q2SpendCap?.length;
  return tier && tier >= 1 && tier <= 4 ? tier : 2;
}

function reputation(answers: QuizAnswers): string {
  switch (answers.q3Reputation) {
    case "hiddenGem":
      return "hidden_gem";
    case "noPreference":
    case undefined:
      return voteNoPreferenceValue;
    default:
      return answers.q3Reputation;
  }
}

function vibeLevel(answers: QuizAnswers): number {
  return vibeLevelByAnswer[answers.q4VibeEnergy ?? "social"] ?? 2;
}

function normalizeQ5Axis(axis: Q5Axis | undefined, index: number): VoteAxis {
  switch (axis) {
    case "cuisine":
      return "cuisine";
    case "reputation":
      return "crowd_approval";
    case "vibe":
      return "vibe";
    default:
      return fallbackQ5Axes[index % fallbackQ5Axes.length];
  }
}

function boundedScore(score: number | undefined): number {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return 3;
  }

  return Math.max(1, Math.min(5, Math.round(score)));
}

function q5Ratings(
  candidates: readonly Q5Candidate[],
  ratings: Record<string, number> | undefined,
): Q5Rating[] {
  return candidates.map((candidate, index) => ({
    droppedAxis: normalizeQ5Axis(candidate.droppedAxis, index),
    score: boundedScore(ratings?.[candidate.id]),
  }));
}

function slot(
  questionKind: QuestionKind,
  prompt: string,
  answer: Record<string, unknown>,
): QuestionSlot {
  return {
    meta: { question_kind: questionKind, prompt },
    answer,
  };
}

function voteRow({
  answers,
  q5Candidates,
  roomId,
  userId,
}: QuizSubmissionPayload & { userId: string }): Record<string, unknown> {
  const q5 = q5Ratings(q5Candidates, answers.q5Ratings);

  return {
    room_id: roomId,
    user_id: userId,
    q1: slot("cuisine_craving", "What sounds good tonight?", {
      cuisines: selectedCuisines(answers),
    }),
    q2: slot("budget_cap", "What is the spend cap?", {
      tier: budgetTier(answers),
    }),
    q3: slot("reputation", "What kind of reputation fits?", {
      reputation: reputation(answers),
    }),
    q4: slot("vibe", "Choose the energy.", {
      level: vibeLevel(answers),
    }),
    q5: slot("regret", "How excited does each of these make you?", {
      ratings: q5,
    }),
  };
}

function isDuplicateVote(error: Error): boolean {
  const errorCode = (error as Error & { code?: string }).code;
  return (
    errorCode === "23505" ||
    error.message.includes("duplicate key") ||
    error.message.includes("votes_pkey")
  );
}

export function createSupabaseQuizSubmissionRepository({
  supabase,
  userId,
}: SupabaseQuizSubmissionRepositoryDependencies): QuizSubmissionRepository {
  return {
    submitQuiz: async (payload) => {
      const result = await supabase
        .from<SupabaseVoteRow>("votes")
        .insert(voteRow({ ...payload, userId }));

      if (result.error && !isDuplicateVote(result.error)) {
        throw new Error(`Quiz submit failed: ${result.error.message}`);
      }
    },
  };
}
