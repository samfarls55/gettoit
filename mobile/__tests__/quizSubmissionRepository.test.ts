import {
  createSupabaseQuizSubmissionRepository,
  type QuizSubmissionSupabaseClient,
} from "../src/quiz/quizSubmissionRepository";

type RoomRow = {
  id: string;
  plan_id: string | null;
  creator_user_id?: string | null;
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

class RoomQuery implements PromiseLike<{ data: RoomRow[]; error: Error | null }> {
  private filters: Record<string, unknown> = {};

  constructor(
    private readonly rooms: RoomRow[],
    private readonly calls: QueryCall[],
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters[column] = value;
    return this;
  }

  then<TResult1 = { data: RoomRow[]; error: Error | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: RoomRow[]; error: Error | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.calls.push({ table: "rooms", filters: { ...this.filters } });
    const rows = this.rooms.filter((room) =>
      Object.entries(this.filters).every(
        ([column, value]) => room[column as keyof RoomRow] === value,
      ),
    );

    return Promise.resolve({ data: rows, error: null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

function makeSupabaseClient(rooms: RoomRow[]) {
  const calls: QueryCall[] = [];
  const insertedVotes: Record<string, unknown>[] = [];
  const upserts: UpsertCall[] = [];
  const supabase = {
    from: (table: string) => {
      if (table === "rooms") {
        return new RoomQuery(rooms, calls);
      }

      return {
        insert: (row: Record<string, unknown>) => {
          insertedVotes.push(row);
          return Promise.resolve({ data: null, error: null });
        },
        upsert: (
          row: Record<string, unknown>,
          options?: Record<string, unknown>,
        ) => {
          upserts.push({ table, row, options });
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  } as unknown as QuizSubmissionSupabaseClient;

  return { calls, insertedVotes, supabase, upserts };
}

describe("quizSubmissionRepository", () => {
  it("resolves a plan id to the joined room before inserting a vote", async () => {
    const { calls, insertedVotes, supabase } = makeSupabaseClient([
      { id: "room-1", plan_id: "plan-1" },
    ]);
    const repository = createSupabaseQuizSubmissionRepository({
      supabase,
      userId: "user-1",
    });

    await repository.submitQuiz({
      roomId: "plan-1",
      answers: {
        q1CuisineCravings: ["mexican"],
        q2SpendCap: "$$",
        q3Reputation: "popular",
        q4VibeEnergy: "social",
        q5Ratings: { "candidate-1": 5 },
      },
      q5Candidates: [
        {
          id: "candidate-1",
          name: "Candidate",
          meta: "Mexican",
          droppedAxis: "cuisine",
        },
      ],
    });

    expect(calls.map((call) => call.filters)).toEqual([
      { id: "plan-1" },
      { plan_id: "plan-1" },
    ]);
    expect(insertedVotes).toHaveLength(1);
    expect(insertedVotes[0]).toMatchObject({
      room_id: "room-1",
      user_id: "user-1",
    });
  });

  it("repairs missing owner membership before inserting a vote", async () => {
    const { insertedVotes, supabase, upserts } = makeSupabaseClient([
      {
        id: "room-orphaned-owner",
        plan_id: "plan-orphaned-owner",
        creator_user_id: "user-1",
      },
    ]);
    const repository = createSupabaseQuizSubmissionRepository({
      supabase,
      userId: "user-1",
    });

    await repository.submitQuiz({
      roomId: "plan-orphaned-owner",
      answers: {
        q1CuisineCravings: ["mexican"],
        q2SpendCap: "$$",
        q3Reputation: "popular",
        q4VibeEnergy: "social",
        q5Ratings: { "candidate-1": 4 },
      },
      q5Candidates: [
        {
          id: "candidate-1",
          name: "Candidate",
          meta: "Mexican",
          droppedAxis: "cuisine",
        },
      ],
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
    expect(insertedVotes[0]).toMatchObject({
      room_id: "room-orphaned-owner",
      user_id: "user-1",
    });
  });

  it("submits canonical Q5 axes and translates the vibe answer once", async () => {
    const { insertedVotes, supabase } = makeSupabaseClient([
      { id: "room-1", plan_id: "plan-1" },
    ]);
    const repository = createSupabaseQuizSubmissionRepository({
      supabase,
      userId: "user-1",
    });

    await repository.submitQuiz({
      roomId: "plan-1",
      answers: {
        q1CuisineCravings: ["mexican"],
        q2SpendCap: "$$",
        q3Reputation: "popular",
        q4VibeEnergy: "lively",
        q5Ratings: {
          "candidate-cuisine": 2,
          "candidate-crowd": 5,
          "candidate-vibe": 3,
        },
      },
      q5Candidates: [
        {
          id: "candidate-cuisine",
          name: "Cuisine",
          meta: "",
          droppedAxis: "cuisine",
        },
        {
          id: "candidate-crowd",
          name: "Crowd",
          meta: "",
          droppedAxis: "crowd_approval",
        },
        {
          id: "candidate-vibe",
          name: "Vibe",
          meta: "",
          droppedAxis: "vibe",
        },
      ],
    });

    expect(insertedVotes[0]).toMatchObject({
      q4: {
        answer: { level: 3 },
      },
      q5: {
        answer: {
          ratings: [
            { droppedAxis: "cuisine", score: 2 },
            { droppedAxis: "crowd_approval", score: 5 },
            { droppedAxis: "vibe", score: 3 },
          ],
        },
      },
    });
  });

  it("fails before insert when no joined room is visible", async () => {
    const { insertedVotes, supabase } = makeSupabaseClient([]);
    const repository = createSupabaseQuizSubmissionRepository({
      supabase,
      userId: "user-1",
    });

    await expect(
      repository.submitQuiz({
        roomId: "missing-plan",
        answers: {},
        q5Candidates: [],
      }),
    ).rejects.toThrow("Quiz submit failed: no joined room found");
    expect(insertedVotes).toEqual([]);
  });
});
