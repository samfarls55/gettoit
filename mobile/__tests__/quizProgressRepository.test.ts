import {
  createSupabaseQuizProgressRepository,
  type QuizProgressSupabaseClient,
} from "../src/quiz/quizProgressRepository";

type RoomRow = {
  id: string;
  plan_id: string | null;
  creator_user_id?: string | null;
};

type MemberRow = {
  room_id: string;
  user_id: string;
  quiz_progress: Record<string, unknown> | null;
};

type QueryCall = {
  table: string;
  filters: Record<string, unknown>;
};

type UpsertCall = {
  table: string;
  row: Record<string, unknown>;
  options?: Record<string, unknown>;
};

class Query<TRow extends Record<string, unknown>>
  implements PromiseLike<{ data: TRow[]; error: Error | null }>
{
  private filters: Record<string, unknown> = {};

  constructor(
    private readonly table: string,
    private readonly rows: TRow[],
    private readonly calls: QueryCall[],
    private readonly upserts: UpsertCall[],
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters[column] = value;
    return this;
  }

  delete() {
    return this;
  }

  upsert(row: Record<string, unknown>, options?: Record<string, unknown>) {
    this.upserts.push({ table: this.table, row, options });
    return Promise.resolve({ data: null, error: null });
  }

  then<TResult1 = { data: TRow[]; error: Error | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: TRow[]; error: Error | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.calls.push({ table: this.table, filters: { ...this.filters } });
    const rows = this.rows.filter((row) =>
      Object.entries(this.filters).every(([column, value]) => row[column] === value),
    );

    return Promise.resolve({ data: rows, error: null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

function makeSupabaseClient(input: {
  rooms: RoomRow[];
  members?: MemberRow[];
}) {
  const calls: QueryCall[] = [];
  const upserts: UpsertCall[] = [];
  const rpcCalls: Array<{ functionName: string; args: Record<string, unknown> }> =
    [];
  const supabase = {
    from: (table: string) => {
      if (table === "rooms") {
        return new Query(table, input.rooms, calls, upserts);
      }

      return new Query(table, input.members ?? [], calls, upserts);
    },
    rpc: (functionName: string, args: Record<string, unknown>) => {
      rpcCalls.push({ functionName, args });
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as QuizProgressSupabaseClient;

  return { calls, rpcCalls, supabase, upserts };
}

describe("quizProgressRepository", () => {
  it("loads progress through a plan id by resolving the joined room", async () => {
    const { calls, supabase } = makeSupabaseClient({
      rooms: [{ id: "room-1", plan_id: "plan-1" }],
      members: [
        {
          room_id: "room-1",
          user_id: "user-1",
          quiz_progress: {
            current_question: "q4",
            answers: { q2SpendCap: "$$" },
          },
        },
      ],
    });
    const repository = createSupabaseQuizProgressRepository({
      supabase,
      userId: "user-1",
    });

    await expect(repository.loadProgress("plan-1")).resolves.toEqual({
      roomId: "room-1",
      currentQuestion: "q4",
      answers: { q2SpendCap: 2 },
    });
    expect(calls.map((call) => call.filters)).toEqual([
      { id: "plan-1" },
      { plan_id: "plan-1" },
      { room_id: "room-1", user_id: "user-1" },
    ]);
  });

  it("saves progress to the resolved room id", async () => {
    const { rpcCalls, supabase } = makeSupabaseClient({
      rooms: [{ id: "room-1", plan_id: "plan-1" }],
    });
    const repository = createSupabaseQuizProgressRepository({
      supabase,
      userId: "user-1",
    });

    await repository.saveProgress({
      roomId: "plan-1",
      currentQuestion: "q5",
      answers: { q4VibeEnergy: "social" },
    });

    expect(rpcCalls).toEqual([
      {
        functionName: "members_progress_upsert",
        args: {
          p_room_id: "room-1",
          p_progress: {
            current_question: "q5",
            last_index: 5,
            answers: { q4VibeEnergy: "social" },
          },
        },
      },
    ]);
  });

  it("repairs missing owner membership before saving progress", async () => {
    const { rpcCalls, supabase, upserts } = makeSupabaseClient({
      rooms: [
        {
          id: "room-orphaned-owner",
          plan_id: "plan-orphaned-owner",
          creator_user_id: "user-1",
        },
      ],
    });
    const repository = createSupabaseQuizProgressRepository({
      supabase,
      userId: "user-1",
    });

    await repository.saveProgress({
      roomId: "plan-orphaned-owner",
      currentQuestion: "q5",
      answers: { q4VibeEnergy: "social" },
    });

    expect(upserts).toEqual([
      {
        table: "members",
        row: {
          room_id: "room-orphaned-owner",
          user_id: "user-1",
          role: "owner",
        },
        options: {
          onConflict: "room_id,user_id",
          ignoreDuplicates: true,
        },
      },
    ]);
    expect(rpcCalls[0].args).toMatchObject({
      p_room_id: "room-orphaned-owner",
    });
  });
});
