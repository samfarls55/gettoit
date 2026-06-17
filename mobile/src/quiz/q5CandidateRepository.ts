import type { QuizAnswers } from "./quizProgressRepository";
import type { Q5Candidate } from "./q5Factorial";

export type LoadQ5CandidatesInput = {
  roomId: string;
  answers: QuizAnswers;
};

export type Q5CandidateRepository = {
  loadCandidates: (input: LoadQ5CandidatesInput) => Promise<Q5Candidate[]>;
};

export type Q5SupabaseClient = {
  functions: {
    invoke: <TData>(
      functionName: string,
      options: { body: Record<string, unknown> },
    ) => Promise<{ data: TData | null; error: Error | null }>;
  };
};

type SupabaseQ5CandidateRepositoryDependencies = {
  supabase: Q5SupabaseClient;
};

type Q5AssignedCard = {
  googlePlaceId?: unknown;
  displayName?: unknown;
  attribution?: { text?: unknown };
  axisReceipt?: {
    droppedAxis?: unknown;
  };
};

type Q5AssignedCardSetResponse =
  | {
      status: "assigned";
      cards: Q5AssignedCard[];
    }
  | {
      status: "no_results";
    }
  | {
      error?: string;
    };

function droppedAxisFromReceipt(
  axis: unknown,
): Q5Candidate["droppedAxis"] | null {
  switch (axis) {
    case "cuisine":
    case "crowd_approval":
    case "vibe":
      return axis;
    case "reputation":
      return "crowd_approval";
    default:
      return null;
  }
}

function candidateFromAssignedCard(card: Q5AssignedCard): Q5Candidate | null {
  const droppedAxis = droppedAxisFromReceipt(card.axisReceipt?.droppedAxis);
  if (
    typeof card.googlePlaceId !== "string" ||
    typeof card.displayName !== "string" ||
    !droppedAxis
  ) {
    return null;
  }

  return {
    id: card.googlePlaceId,
    name: card.displayName,
    meta: "",
    ...(typeof card.attribution?.text === "string"
      ? { attributionText: card.attribution.text }
      : {}),
    droppedAxis,
  };
}

function q5CandidatesFromAssignedCardSet(
  response: Q5AssignedCardSetResponse,
): Q5Candidate[] {
  if (!("status" in response) || response.status !== "assigned") {
    return [];
  }

  return response.cards.flatMap((card): Q5Candidate[] => {
    const candidate = candidateFromAssignedCard(card);
    return candidate ? [candidate] : [];
  });
}

export function createSupabaseQ5CandidateRepository({
  supabase,
}: SupabaseQ5CandidateRepositoryDependencies): Q5CandidateRepository {
  return {
    loadCandidates: async ({ roomId }) => {
      const result = await supabase.functions.invoke<Q5AssignedCardSetResponse>(
        "q5-card-set",
        {
          body: {
            room_id: roomId,
            q5_card_set_id: "initial",
          },
        },
      );

      if (result.error) {
        throw new Error(`Q5 card set read failed: ${result.error.message}`);
      }

      if (!result.data) {
        return [];
      }

      if (!("status" in result.data)) {
        const message = result.data.error ?? "unknown_error";
        throw new Error(`Q5 card set read failed: ${message}`);
      }

      return q5CandidatesFromAssignedCardSet(result.data);
    },
  };
}
