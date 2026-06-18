export type WaitingMemberProgress = {
  id: string;
  displayName: string;
  quizSubmitted: boolean;
};

export type WaitingSnapshotStatus =
  | "waiting"
  | "verdictReady"
  | "sessionEnded";

export type WaitingSnapshot = {
  roomId: string;
  status: WaitingSnapshotStatus;
  members: WaitingMemberProgress[];
};

export type WaitingRepository = {
  loadSnapshot: (roomId: string) => Promise<WaitingSnapshot>;
  fireVerdict: (input: { roomId: string }) => Promise<WaitingSnapshot>;
};

export type WaitingRepositoryLogEvent = (
  event: string,
  payload: Record<string, unknown>,
) => void;

export type SupabaseQueryResult<TData> = {
  data: TData | null;
  error: Error | null;
};

export type WaitingSupabaseQuery<TRow> = PromiseLike<
  SupabaseQueryResult<TRow[]>
> & {
  select: (columns: string) => WaitingSupabaseQuery<TRow>;
  eq: (column: string, value: unknown) => WaitingSupabaseQuery<TRow>;
  order: (
    column: string,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ) => WaitingSupabaseQuery<TRow>;
};

export type WaitingSupabaseClient = {
  from: <TRow>(table: string) => WaitingSupabaseQuery<TRow>;
  rpc: <TData>(
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<SupabaseQueryResult<TData>>;
};

type SupabaseRoomRow = {
  id: string;
  status: string;
};

type SupabaseMemberRow = {
  user_id: string;
  display_name?: string | null;
};

type SupabaseVoteRow = {
  user_id: string;
};

type FireVerdictResult = {
  status?: string;
  room_status?: string;
  error?: string;
};

export type SupabaseWaitingRepositoryDependencies = {
  logEvent?: WaitingRepositoryLogEvent;
  now?: () => number;
  supabase: WaitingSupabaseClient;
  userId: string;
};

const verdictPollAttempts = 10;
const verdictPollDelayMs = 750;

function assertSupabaseRows<TRow>(
  result: SupabaseQueryResult<TRow[]>,
  queryName: string,
): TRow[] {
  if (result.error) {
    throw new Error(`${queryName} failed: ${result.error.message}`);
  }

  return result.data ?? [];
}

function snapshotStatusForRoomStatus(status: string): WaitingSnapshotStatus {
  switch (status) {
    case "verdict_ready":
    case "locked":
      return "verdictReady";
    case "expired":
      return "sessionEnded";
    case "open":
    case "firing":
    default:
      return "waiting";
  }
}

function displayNameForMember(member: SupabaseMemberRow, userId: string): string {
  if (member.user_id === userId) {
    return "You";
  }

  return member.display_name?.trim() || "Someone";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fireVerdictError(data: FireVerdictResult | null): string | null {
  if (!data?.error) {
    return null;
  }

  return data.error;
}

function durationMs(startedAt: number, now: () => number): number {
  return Math.max(0, Math.round(now() - startedAt));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logWaitingEvent(
  logEvent: WaitingRepositoryLogEvent | undefined,
  event: string,
  payload: Record<string, unknown>,
): void {
  try {
    logEvent?.(event, payload);
  } catch {
    // Logging must never change waiting-room behavior.
  }
}

export function createSupabaseWaitingRepository({
  logEvent,
  now = Date.now,
  supabase,
  userId,
}: SupabaseWaitingRepositoryDependencies): WaitingRepository {
  const log = (event: string, payload: Record<string, unknown>) =>
    logWaitingEvent(logEvent, event, payload);

  const loadSnapshot = async (roomId: string): Promise<WaitingSnapshot> => {
    const startedAt = now();
    log("waiting.snapshot.load.start", { roomId });

    try {
      const roomRows = assertSupabaseRows(
        await supabase
          .from<SupabaseRoomRow>("rooms")
          .select("id, status")
          .eq("id", roomId),
        "Waiting room read",
      );
      const room = roomRows[0];

      if (!room) {
        const snapshot = { roomId, status: "sessionEnded" as const, members: [] };
        log("waiting.snapshot.load.result", {
          roomId,
          roomRows,
          memberRows: [],
          voteRows: [],
          snapshot,
          durationMs: durationMs(startedAt, now),
        });
        return snapshot;
      }

      const [memberRows, voteRows] = await Promise.all([
        supabase
          .from<SupabaseMemberRow>("members")
          .select("user_id, display_name")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true }),
        supabase
          .from<SupabaseVoteRow>("votes")
          .select("user_id")
          .eq("room_id", roomId),
      ]);
      const memberRowValues = assertSupabaseRows(
        memberRows,
        "Waiting members read",
      );
      const voteRowValues = assertSupabaseRows(voteRows, "Waiting votes read");
      const votesByUserId = new Set(voteRowValues.map((vote) => vote.user_id));

      const snapshot = {
        roomId,
        status: snapshotStatusForRoomStatus(room.status),
        members: memberRowValues.map((member) => ({
          id: member.user_id,
          displayName: displayNameForMember(member, userId),
          quizSubmitted: votesByUserId.has(member.user_id),
        })),
      };
      log("waiting.snapshot.load.result", {
        roomId,
        roomRows,
        memberRows: memberRowValues,
        voteRows: voteRowValues,
        snapshot,
        durationMs: durationMs(startedAt, now),
      });

      return snapshot;
    } catch (error) {
      log("waiting.snapshot.load.error", {
        roomId,
        durationMs: durationMs(startedAt, now),
        message: errorMessage(error),
      });
      throw error;
    }
  };

  return {
    loadSnapshot,
    fireVerdict: async ({ roomId }) => {
      const startedAt = now();
      log("verdict.fire.rpc.start", {
        roomId,
        rpc: "fire_verdict",
        args: { p_room_id: roomId },
      });

      try {
        const fireResult = await supabase.rpc<FireVerdictResult>("fire_verdict", {
          p_room_id: roomId,
        });
        log("verdict.fire.rpc.response", {
          roomId,
          data: fireResult.data,
          error: fireResult.error
            ? { name: fireResult.error.name, message: fireResult.error.message }
            : null,
          durationMs: durationMs(startedAt, now),
        });

        if (fireResult.error) {
          throw new Error(`Verdict fire failed: ${fireResult.error.message}`);
        }

        const rpcError = fireVerdictError(fireResult.data);
        if (rpcError) {
          throw new Error(`Verdict fire failed: ${rpcError}`);
        }

        let snapshot = await loadSnapshot(roomId);
        log("verdict.fire.poll", {
          roomId,
          attempt: 0,
          snapshot,
          durationMs: durationMs(startedAt, now),
        });
        for (
          let attempt = 0;
          attempt < verdictPollAttempts && snapshot.status === "waiting";
          attempt += 1
        ) {
          await delay(verdictPollDelayMs);
          snapshot = await loadSnapshot(roomId);
          log("verdict.fire.poll", {
            roomId,
            attempt: attempt + 1,
            snapshot,
            durationMs: durationMs(startedAt, now),
          });
        }

        log("verdict.fire.result", {
          roomId,
          snapshot,
          durationMs: durationMs(startedAt, now),
        });
        return snapshot;
      } catch (error) {
        log("verdict.fire.error", {
          roomId,
          durationMs: durationMs(startedAt, now),
          message: errorMessage(error),
        });
        throw error;
      }
    },
  };
}
