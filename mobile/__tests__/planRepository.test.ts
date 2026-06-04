import {
  createSupabasePlanRepository,
  emptyPlanListSnapshot,
  type PlanSupabaseClient,
  type SupabaseQueryResult,
} from "../src/plans/planRepository";

type QueryCall = {
  table: string;
  filters: Array<[string, string, unknown]>;
  orderBy: string | null;
  selectColumns: string | null;
};

class TestQuery<T> implements PromiseLike<SupabaseQueryResult<T[]>> {
  private readonly call: QueryCall;
  private readonly result: SupabaseQueryResult<T[]>;

  constructor(call: QueryCall, result: SupabaseQueryResult<T[]>) {
    this.call = call;
    this.result = result;
  }

  select(columns: string) {
    this.call.selectColumns = columns;
    return this;
  }

  eq(column: string, value: unknown) {
    this.call.filters.push(["eq", column, value]);
    return this;
  }

  neq(column: string, value: unknown) {
    this.call.filters.push(["neq", column, value]);
    return this;
  }

  order(column: string) {
    this.call.orderBy = column;
    return this;
  }

  then<TResult1 = SupabaseQueryResult<T[]>, TResult2 = never>(
    onfulfilled?:
      | ((value: SupabaseQueryResult<T[]>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

function makeSupabaseClient(
  results: Record<string, SupabaseQueryResult<unknown[]>>,
  calls: QueryCall[] = [],
): PlanSupabaseClient {
  return {
    from: <T,>(table: string) => {
      const call: QueryCall = {
        table,
        filters: [],
        orderBy: null,
        selectColumns: null,
      };
      calls.push(call);

      return new TestQuery<T>(
        call,
        results[table] as SupabaseQueryResult<T[]>,
      );
    },
  };
}

describe("planRepository", () => {
  it("maps Supabase plan, room, and membership rows into Plan list buckets", async () => {
    const calls: QueryCall[] = [];
    const repository = createSupabasePlanRepository({
      supabase: makeSupabaseClient(
        {
          members: {
            data: [
              {
                room_id: "room-joined",
                role: "participant",
                quiz_progress: { last_index: 3 },
              },
              {
                room_id: "room-joined-decided",
                role: "participant",
                quiz_progress: {},
              },
            ],
            error: null,
          },
          rooms: {
            data: [
              { id: "room-joined", plan_id: "joined-plan" },
              { id: "room-joined-decided", plan_id: "joined-decided-plan" },
            ],
            error: null,
          },
          plans: {
            data: [
              {
                id: "created-plan",
                creator_id: "user-1",
                name: "Friday dinner",
                status: "pending",
                created_at: "2026-06-04T10:00:00Z",
                verdict_fired_at: null,
                expired_at: null,
              },
              {
                id: "joined-plan",
                creator_id: "user-2",
                name: "Morgan's birthday",
                status: "pending",
                created_at: "2026-06-04T09:00:00Z",
                verdict_fired_at: null,
                expired_at: null,
              },
              {
                id: "created-decided-plan",
                creator_id: "user-1",
                name: "Date night",
                status: "decided-active",
                created_at: "2026-06-04T08:00:00Z",
                verdict_fired_at: "2026-06-04T11:00:00Z",
                expired_at: null,
              },
              {
                id: "joined-decided-plan",
                creator_id: "user-2",
                name: "Team lunch",
                status: "decided-active",
                created_at: "2026-06-04T07:00:00Z",
                verdict_fired_at: "2026-06-04T10:30:00Z",
                expired_at: null,
              },
              {
                id: "history-plan",
                creator_id: "user-1",
                name: "Taco crawl",
                status: "decided-expired",
                created_at: "2026-06-04T06:00:00Z",
                verdict_fired_at: "2026-06-04T07:00:00Z",
                expired_at: "2026-06-04T12:00:00Z",
              },
            ],
            error: null,
          },
        },
        calls,
      ),
      userId: "user-1",
    });

    await expect(repository.listPlans()).resolves.toEqual({
      created: [
        {
          id: "created-plan",
          title: "Friday dinner",
          subtitle: "Pending setup",
          badge: "Created",
          routeTarget: "pending",
        },
      ],
      joined: [
        {
          id: "joined-plan",
          title: "Morgan's birthday",
          subtitle: "Quiz in progress",
          badge: "Joined",
          routeTarget: "joined",
        },
      ],
      decided: [
        {
          id: "created-decided-plan",
          title: "Date night",
          subtitle: "Live verdict",
          badge: "Decided",
          routeTarget: "decided",
        },
        {
          id: "joined-decided-plan",
          title: "Team lunch",
          subtitle: "Live verdict",
          badge: "Joined",
          routeTarget: "decided",
        },
      ],
      history: [
        {
          id: "history-plan",
          title: "Taco crawl",
          subtitle: "Closed verdict",
          badge: "History",
          routeTarget: "history",
        },
      ],
    });

    expect(calls.map((call) => call.table)).toEqual([
      "members",
      "rooms",
      "plans",
    ]);
  });

  it("returns an empty snapshot when Supabase returns no rows", async () => {
    const repository = createSupabasePlanRepository({
      supabase: makeSupabaseClient({
        members: { data: [], error: null },
        rooms: { data: [], error: null },
        plans: { data: [], error: null },
      }),
      userId: "user-1",
    });

    await expect(repository.listPlans()).resolves.toEqual(
      emptyPlanListSnapshot,
    );
  });

  it("surfaces representative Supabase read errors", async () => {
    const repository = createSupabasePlanRepository({
      supabase: makeSupabaseClient({
        members: { data: null, error: new Error("database unavailable") },
        rooms: { data: [], error: null },
        plans: { data: [], error: null },
      }),
      userId: "user-1",
    });

    await expect(repository.listPlans()).rejects.toThrow(
      "Plan memberships read failed: database unavailable",
    );
  });
});
