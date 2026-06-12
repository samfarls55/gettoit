import {
  createSupabaseQ5CandidateRepository,
  type Q5SupabaseClient,
  type SupabaseQueryResult,
} from "../src/quiz/q5CandidateRepository";
import { generateQ5FactorialCards } from "../src/quiz/q5Factorial";

type QueryCall = {
  table: string;
  filters: Array<[string, string, unknown]>;
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
  invoke = jest.fn(),
): Q5SupabaseClient {
  return {
    from: <T,>(table: string) => {
      const call: QueryCall = {
        table,
        filters: [],
        selectColumns: null,
      };
      calls.push(call);

      return new TestQuery<T>(
        call,
        results[table] as SupabaseQueryResult<T[]>,
      );
    },
    functions: {
      invoke,
    },
  };
}

describe("q5CandidateRepository", () => {
  it("loads real Google Q5 places from a saved Plan context", async () => {
    const calls: QueryCall[] = [];
    const invoke = jest.fn().mockResolvedValue({
      data: {
        places: [
          {
            place_id: "google-katzs-delicatessen",
            display_name: "Katz's Delicatessen",
          },
          {
            place_id: "google-los-tacos-no-1",
            display_name: "Los Tacos No. 1",
          },
          { place_id: "google-cosme", display_name: "Cosme" },
        ],
        attribution: {
          provider: "google",
          render: "text",
          text: "Powered by Google",
        },
      },
      error: null,
    });
    const repository = createSupabaseQ5CandidateRepository({
      supabase: makeSupabaseClient(
        {
          plans: {
            data: [
              {
                id: "plan-1",
                location: {
                  lat: 40.7128,
                  lng: -74.006,
                  name: "Lower Manhattan",
                },
                distance_meters: 3219,
                session_params: {
                  meal_time: "dinner",
                  service_shape: "outdoor",
                },
              },
            ],
            error: null,
          },
          rooms: { data: [], error: null },
        },
        calls,
        invoke,
      ),
    });

    const pool = await repository.loadCandidates({
      roomId: "plan-1",
      answers: {
        q1CuisineCravings: ["mexican"],
        q2SpendCap: "$$",
        q3Reputation: "popular",
        q4VibeEnergy: "social",
      },
    });

    expect(calls[0]).toEqual({
      table: "plans",
      filters: [["eq", "id", "plan-1"]],
      selectColumns: "id, location, distance_meters, session_params",
    });
    expect(invoke).toHaveBeenCalledWith("places-proxy", {
      body: expect.objectContaining({
        surface: "q5",
        lat: 40.7128,
        lng: -74.006,
        radius_meters: 3219,
        filters: expect.objectContaining({
          cuisine: "mexican",
          price_tier: 2,
          service_shape: "dineIn",
        }),
      }),
    });
    expect(pool.map((venue) => venue.name)).toEqual([
      "Katz's Delicatessen",
      "Los Tacos No. 1",
      "Cosme",
    ]);
    expect(pool.every((venue) => venue.attributionText === "Powered by Google"))
      .toBe(true);

    const cards = generateQ5FactorialCards({
      member: {
        cuisines: ["mexican"],
        reputation: "popular",
        vibe: 2,
      },
      pool,
    });
    expect(cards?.map((card) => card.venue.name)).toEqual([
      "Katz's Delicatessen",
      "Los Tacos No. 1",
      "Cosme",
    ]);
  });

  it("returns no Q5 pool when Google has fewer than three real places", async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        places: [
          {
            place_id: "google-katzs-delicatessen",
            display_name: "Katz's Delicatessen",
          },
          {
            place_id: "google-katzs-delicatessen",
            display_name: "Katz's Delicatessen",
          },
        ],
        attribution: {
          provider: "google",
          render: "text",
          text: "Powered by Google",
        },
      },
      error: null,
    });
    const repository = createSupabaseQ5CandidateRepository({
      supabase: makeSupabaseClient(
        {
          plans: {
            data: [
              {
                id: "plan-1",
                location: { lat: 40.7128, lng: -74.006 },
                distance_meters: 3219,
                session_params: {},
              },
            ],
            error: null,
          },
          rooms: { data: [], error: null },
        },
        [],
        invoke,
      ),
    });

    await expect(
      repository.loadCandidates({
        roomId: "plan-1",
        answers: {
          q1CuisineCravings: ["mexican"],
          q2SpendCap: "$$",
          q3Reputation: "popular",
          q4VibeEnergy: "social",
        },
      }),
    ).resolves.toEqual([]);
  });

  it("returns no Q5 pool when the Plan has no search location", async () => {
    const invoke = jest.fn();
    const repository = createSupabaseQ5CandidateRepository({
      supabase: makeSupabaseClient(
        {
          plans: {
            data: [
              {
                id: "plan-1",
                location: null,
                distance_meters: 3219,
                session_params: {},
              },
            ],
            error: null,
          },
          rooms: { data: [], error: null },
        },
        [],
        invoke,
      ),
    });

    await expect(
      repository.loadCandidates({
        roomId: "plan-1",
        answers: {},
      }),
    ).resolves.toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });
});
