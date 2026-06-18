import type { QuizAnswers } from "./quizProgressRepository";
import type { Q5Candidate } from "./q5Factorial";

export type LoadQ5CandidatesInput = {
  roomId: string;
  answers: QuizAnswers;
};

export type Q5CandidateRepository = {
  loadCandidates: (input: LoadQ5CandidatesInput) => Promise<Q5Candidate[]>;
};

export type Q5CandidateRepositoryLogEvent = (
  event: string,
  payload: Record<string, unknown>,
) => void;

export type Q5SupabaseClient = {
  functions: {
    invoke: <TData>(
      functionName: string,
      options: { body: Record<string, unknown> },
    ) => Promise<{ data: TData | null; error: Error | null }>;
  };
};

type SupabaseQ5CandidateRepositoryDependencies = {
  logEvent?: Q5CandidateRepositoryLogEvent;
  now?: () => number;
  shouldRequestDebugTrace?: () => boolean;
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

type Q5AssignedCardSetResponse = {
  debugTrace?: unknown;
} & (
  | {
      status: "assigned";
      cards: Q5AssignedCard[];
    }
  | {
      status: "no_results";
    }
  | {
      error?: string;
    }
);

function durationMs(startedAt: number, now: () => number): number {
  return Math.max(0, Math.round(now() - startedAt));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logQ5CandidateEvent(
  logEvent: Q5CandidateRepositoryLogEvent | undefined,
  event: string,
  payload: Record<string, unknown>,
): void {
  try {
    logEvent?.(event, payload);
  } catch {
    // Logging must never change Q5 behavior.
  }
}

function shouldRequestTrace(
  shouldRequestDebugTrace: (() => boolean) | undefined,
): boolean {
  try {
    return Boolean(shouldRequestDebugTrace?.());
  } catch {
    return false;
  }
}

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
  logEvent,
  now = Date.now,
  shouldRequestDebugTrace,
  supabase,
}: SupabaseQ5CandidateRepositoryDependencies): Q5CandidateRepository {
  const log = (event: string, payload: Record<string, unknown>) =>
    logQ5CandidateEvent(logEvent, event, payload);

  return {
    loadCandidates: async ({ answers, roomId }) => {
      const startedAt = now();
      const debugTraceRequested = shouldRequestTrace(shouldRequestDebugTrace);
      const requestBody: Record<string, unknown> = {
        room_id: roomId,
        q5_card_set_id: "initial",
      };
      if (debugTraceRequested) {
        requestBody.debug_trace = "expo_dev_run";
      }

      log("quiz.q5.load.start", {
        roomId,
        answers,
        requestBody,
        debugTraceRequested,
      });

      try {
        const result = await supabase.functions.invoke<Q5AssignedCardSetResponse>(
          "q5-card-set",
          {
            body: requestBody,
          },
        );

        if (result.error) {
          throw new Error(`Q5 card set read failed: ${result.error.message}`);
        }

        if (!result.data) {
          log("quiz.q5.load.response", {
            roomId,
            response: null,
            durationMs: durationMs(startedAt, now),
          });
          log("quiz.q5.load.mapped", {
            roomId,
            candidates: [],
            durationMs: durationMs(startedAt, now),
          });
          return [];
        }

        if (result.data.debugTrace) {
          log("quiz.q5.backend_trace", {
            roomId,
            trace: result.data.debugTrace,
          });
        } else if (debugTraceRequested) {
          log("quiz.q5.backend_trace.missing", {
            roomId,
            requestBody,
            response: result.data,
          });
        }
        log("quiz.q5.load.response", {
          roomId,
          response: result.data,
          durationMs: durationMs(startedAt, now),
        });

        if (!("status" in result.data)) {
          const message = result.data.error ?? "unknown_error";
          throw new Error(`Q5 card set read failed: ${message}`);
        }

        const candidates = q5CandidatesFromAssignedCardSet(result.data);
        log("quiz.q5.load.mapped", {
          roomId,
          answers,
          candidates,
          durationMs: durationMs(startedAt, now),
        });

        return candidates;
      } catch (error) {
        log("quiz.q5.load.error", {
          roomId,
          answers,
          durationMs: durationMs(startedAt, now),
          message: errorMessage(error),
        });
        throw error;
      }
    },
  };
}
