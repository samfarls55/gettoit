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

export function createSupabaseWaitingRepository({
  supabase,
  userId,
}: SupabaseWaitingRepositoryDependencies): WaitingRepository {
  const loadSnapshot = async (roomId: string): Promise<WaitingSnapshot> => {
    const roomRows = assertSupabaseRows(
      await supabase
        .from<SupabaseRoomRow>("rooms")
        .select("id, status")
        .eq("id", roomId),
      "Waiting room read",
    );
    const room = roomRows[0];

    if (!room) {
      return { roomId, status: "sessionEnded", members: [] };
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
    const votesByUserId = new Set(
      assertSupabaseRows(voteRows, "Waiting votes read").map(
        (vote) => vote.user_id,
      ),
    );

    return {
      roomId,
      status: snapshotStatusForRoomStatus(room.status),
      members: assertSupabaseRows(memberRows, "Waiting members read").map(
        (member) => ({
          id: member.user_id,
          displayName: displayNameForMember(member, userId),
          quizSubmitted: votesByUserId.has(member.user_id),
        }),
      ),
    };
  };

  return {
    loadSnapshot,
    fireVerdict: async ({ roomId }) => {
      const fireResult = await supabase.rpc<FireVerdictResult>("fire_verdict", {
        p_room_id: roomId,
      });

      if (fireResult.error) {
        throw new Error(`Verdict fire failed: ${fireResult.error.message}`);
      }

      const rpcError = fireVerdictError(fireResult.data);
      if (rpcError) {
        throw new Error(`Verdict fire failed: ${rpcError}`);
      }

      let snapshot = await loadSnapshot(roomId);
      for (
        let attempt = 0;
        attempt < verdictPollAttempts && snapshot.status === "waiting";
        attempt += 1
      ) {
        await delay(verdictPollDelayMs);
        snapshot = await loadSnapshot(roomId);
      }

      return snapshot;
    },
  };
}
