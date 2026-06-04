import {
  createSupabaseVerdictRepository,
  type SupabaseQueryResult,
  type VerdictSupabaseClient,
} from "../src/verdict/verdictRepository";

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
): VerdictSupabaseClient {
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

describe("verdictRepository", () => {
  it("maps a successful Supabase verdict response into a group live verdict view model", async () => {
    const calls: QueryCall[] = [];
    const repository = createSupabaseVerdictRepository({
      supabase: makeSupabaseClient(
        {
          verdicts: {
            data: [
              {
                id: "verdict-1",
                room_id: "room-1",
                option_id: "option-1",
                computed_at: "2026-06-04T19:00:00Z",
                method: "quorum",
                rule_text: "Best fit for the table.",
              },
            ],
            error: null,
          },
          options: {
            data: [
              {
                id: "option-1",
                payload: {
                  name: "Pico's Taqueria",
                  categories: ["Mexican"],
                  price_tier: 2,
                  walk_minutes_estimate: 8,
                },
              },
            ],
            error: null,
          },
          members: {
            data: [
              { user_id: "user-1", display_name: "Ava" },
              { user_id: "user-2", display_name: "Morgan" },
            ],
            error: null,
          },
          votes: {
            data: [
              {
                user_id: "user-1",
                q2: { answer: { tier: "$$" } },
                q4: { answer: { vibe: "social" } },
              },
              {
                user_id: "user-2",
                q2: { answer: { tier: "$$$" } },
                q4: { answer: { vibe: "calm" } },
              },
            ],
            error: null,
          },
          rerolls: {
            data: [
              { id: "reroll-1", room_id: "room-1" },
              { id: "reroll-2", room_id: "room-1" },
            ],
            error: null,
          },
        },
        calls,
      ),
    });

    await expect(
      repository.loadVerdict({ roomId: "room-1", flavor: "group" }),
    ).resolves.toEqual({
      kind: "live",
      roomId: "room-1",
      flavor: "group",
      placeName: "Pico's Taqueria",
      metaLine: "Mexican - $$ - 8 min walk",
      ruleText: "Best fit for the table.",
      timeBadge: {
        time: "7:00 PM",
        audience: "All 2 of you",
      },
      receipts: [
        { id: "user-1", name: "Ava", action: "wanted social" },
        { id: "user-2", name: "Morgan", action: "wanted calm" },
      ],
      primaryActionLabel: "I'm in",
      reroll: {
        burnsRemaining: 1,
        ineligibleReason: null,
        isEligible: true,
        windowClosesAt: null,
      },
    });

    expect(calls.map((call) => call.table)).toEqual([
      "verdicts",
      "options",
      "members",
      "votes",
      "rerolls",
    ]);
  });

  it("maps solo verdicts without group-only receipts or audience copy", async () => {
    const repository = createSupabaseVerdictRepository({
      supabase: makeSupabaseClient({
        verdicts: {
          data: [
            {
              id: "verdict-1",
              room_id: "room-1",
              option_id: "option-1",
              computed_at: "2026-06-04T19:00:00Z",
              method: "manual",
              rule_text: "Your best solo fit.",
            },
          ],
          error: null,
        },
        options: {
          data: [{ id: "option-1", payload: { name: "Solo Ramen" } }],
          error: null,
        },
        members: {
          data: [{ user_id: "user-1", display_name: "You" }],
          error: null,
        },
        votes: {
          data: [{ user_id: "user-1", q4: { answer: { vibe: "cozy" } } }],
          error: null,
        },
        rerolls: {
          data: [],
          error: null,
        },
      }),
    });

    await expect(
      repository.loadVerdict({ roomId: "room-1", flavor: "solo" }),
    ).resolves.toMatchObject({
      kind: "live",
      flavor: "solo",
      placeName: "Solo Ramen",
      receipts: [],
      timeBadge: { time: "7:00 PM", audience: "" },
      primaryActionLabel: "Save taste profile",
    });
  });

  it("maps no-survivor verdicts to the no-survivor screen model", async () => {
    const repository = createSupabaseVerdictRepository({
      supabase: makeSupabaseClient({
        verdicts: {
          data: [
            {
              id: "verdict-1",
              room_id: "room-1",
              option_id: null,
              computed_at: "2026-06-04T19:00:00Z",
              method: "no_survivor",
              rule_text: "No candidate survived the hard constraints.",
            },
          ],
          error: null,
        },
      }),
    });

    await expect(
      repository.loadVerdict({ roomId: "room-1", flavor: "group" }),
    ).resolves.toEqual({
      kind: "noSurvivor",
      roomId: "room-1",
      currentRadiusMiles: 2,
      maxRadiusMiles: 5,
      minRadiusMiles: 1,
      stepMiles: 0.5,
    });
  });
});
