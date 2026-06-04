import {
  createSupabasePlanRepository,
  emptyPlanListSnapshot,
  type PlanSupabaseClient,
  type SupabaseQueryResult,
} from "../src/plans/planRepository";

type QueryCall = {
  table: string;
  filters: Array<[string, string, unknown]>;
  mutation:
    | { type: "delete"; row: null }
    | { type: "insert" | "update"; row: Record<string, unknown> }
    | null;
  orderBy: string | null;
  selectColumns: string | null;
  single: boolean;
};

class TestMutation<T> implements PromiseLike<SupabaseQueryResult<T>> {
  private readonly call: QueryCall;
  private readonly result: SupabaseQueryResult<T>;

  constructor(call: QueryCall, result: SupabaseQueryResult<T>) {
    this.call = call;
    this.result = result;
  }

  eq(column: string, value: unknown) {
    this.call.filters.push(["eq", column, value]);
    return this;
  }

  select(columns: string) {
    this.call.selectColumns = columns;
    return this;
  }

  single() {
    this.call.single = true;
    return this;
  }

  then<TResult1 = SupabaseQueryResult<T>, TResult2 = never>(
    onfulfilled?:
      | ((value: SupabaseQueryResult<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected);
  }
}

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

  delete() {
    this.call.mutation = { type: "delete", row: null };
    return new TestMutation<T>(this.call, {
      data: this.result.data?.[0] ?? null,
      error: this.result.error,
    });
  }

  insert(row: Record<string, unknown>) {
    this.call.mutation = { type: "insert", row };
    return new TestMutation<T>(this.call, {
      data: this.result.data?.[0] ?? null,
      error: this.result.error,
    });
  }

  update(row: Record<string, unknown>) {
    this.call.mutation = { type: "update", row };
    return new TestMutation<T>(this.call, {
      data: this.result.data?.[0] ?? null,
      error: this.result.error,
    });
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
        mutation: null,
        orderBy: null,
        selectColumns: null,
        single: false,
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
                scope: "group",
                location: {
                  lat: 40.7128,
                  lng: -74.006,
                  name: "Lower Manhattan",
                },
                session_params: {
                  meal_time: "dinner",
                  service_shape: "dineIn",
                },
                distance_meters: 3219,
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
          setup: {
            id: "created-plan",
            name: "Friday dinner",
            participantScope: "group",
            searchArea: {
              center: {
                latitude: 40.7128,
                longitude: -74.006,
                label: "Lower Manhattan",
              },
              radiusMiles: 2,
            },
            mealTime: "dinner",
            serviceShape: "dineIn",
          },
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

  it("writes create and edit Setup payloads through Supabase plans", async () => {
    const calls: QueryCall[] = [];
    const repository = createSupabasePlanRepository({
      supabase: makeSupabaseClient(
        {
          plans: {
            data: [
              {
                id: "saved-plan",
                creator_id: "user-1",
                name: "Solo ramen",
                scope: "solo",
                location: {
                  lat: 37.7749,
                  lng: -122.4194,
                  name: "San Francisco",
                },
                session_params: {
                  meal_time: "dinner",
                  service_shape: "dineIn",
                },
                distance_meters: 3219,
                status: "pending",
                created_at: "2026-06-04T10:00:00Z",
                verdict_fired_at: null,
                expired_at: null,
              },
            ],
            error: null,
          },
        },
        calls,
      ),
      userId: "user-1",
    });

    await expect(
      repository.savePlan({
        name: " Solo ramen ",
        participantScope: "solo",
        searchArea: {
          center: {
            latitude: 37.7749,
            longitude: -122.4194,
            label: "San Francisco",
          },
          radiusMiles: 2,
        },
        mealTime: "dinner",
        serviceShape: "dineIn",
      }),
    ).resolves.toEqual({
      id: "saved-plan",
      name: "Solo ramen",
      participantScope: "solo",
      searchArea: {
        center: {
          latitude: 37.7749,
          longitude: -122.4194,
          label: "San Francisco",
        },
        radiusMiles: 2,
      },
      mealTime: "dinner",
      serviceShape: "dineIn",
    });

    expect(calls[0].table).toBe("plans");
    expect(calls[0].mutation).toEqual({
      type: "insert",
      row: {
        creator_id: "user-1",
        name: "Solo ramen",
        scope: "solo",
        location: {
          lat: 37.7749,
          lng: -122.4194,
          name: "San Francisco",
          source: "manual",
        },
        session_params: {
          meal_time: "dinner",
          group_context: "solo",
          service_shape: "dineIn",
        },
        distance_meters: 3219,
        status: "pending",
      },
    });

    await repository.savePlan({
      id: "saved-plan",
      name: "Solo ramen again",
      participantScope: "solo",
      searchArea: null,
      mealTime: "lunch",
      serviceShape: "takeout",
    });

    expect(calls[1].mutation?.type).toBe("update");
    expect(calls[1].filters).toEqual([["eq", "id", "saved-plan"]]);
  });

  it("deletes a created Plan through Supabase plans", async () => {
    const calls: QueryCall[] = [];
    const repository = createSupabasePlanRepository({
      supabase: makeSupabaseClient(
        {
          plans: {
            data: [],
            error: null,
          },
        },
        calls,
      ),
      userId: "user-1",
    });

    await expect(
      repository.deletePlan({ planId: "created-plan" }),
    ).resolves.toBeUndefined();

    expect(calls[0].table).toBe("plans");
    expect(calls[0].mutation).toEqual({ type: "delete", row: null });
    expect(calls[0].filters).toEqual([["eq", "id", "created-plan"]]);
  });
});
