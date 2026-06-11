import {
  advanceVerdictSlate,
  createSupabaseVerdictRepository,
  type GoogleVerdictDisplay,
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
  invoke = jest.fn(),
  rpc = jest.fn(),
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
    functions: {
      invoke,
    },
    rpc,
  };
}

function googleDisplay({
  formattedAddress,
  mapsUri,
  name,
  placeId,
}: {
  formattedAddress?: string;
  mapsUri: string;
  name: string;
  placeId: string;
}): GoogleVerdictDisplay {
  return {
    place: {
      place_id: placeId,
      display_name: name,
      google_maps_uri: mapsUri,
      ...(formattedAddress ? { formatted_address: formattedAddress } : {}),
    },
    attribution: {
      provider: "google",
      render: "text",
      text: "Powered by Google",
    },
  };
}

describe("verdictRepository", () => {
  it("maps a successful Supabase verdict response into a group live verdict view model", async () => {
    const calls: QueryCall[] = [];
    const invoke = jest.fn().mockResolvedValue({
      data: googleDisplay({
        placeId: "google-pico",
        name: "Pico's Taqueria",
        mapsUri: "https://maps.google.example/picos",
        formattedAddress: "1 Main St",
      }),
      error: null,
    });
    const repository = createSupabaseVerdictRepository({
      supabase: makeSupabaseClient(
        {
          verdicts: {
            data: [
              {
                id: "verdict-1",
                room_id: "room-1",
                option_id: "option-1",
                winner_google_place_id: "google-pico",
                computed_at: "2026-06-04T19:00:00Z",
                method: "quorum",
                rule_text: "Best fit for the table.",
              },
            ],
            error: null,
          },
          verdict_slate_entries: {
            data: [
              {
                verdict_id: "verdict-1",
                slate_rank: 1,
                google_place_id: "google-pico",
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
        invoke,
      ),
    });

    await expect(
      repository.loadVerdict({ roomId: "room-1", flavor: "group" }),
    ).resolves.toEqual({
      kind: "live",
      roomId: "room-1",
      flavor: "group",
      placeName: "Pico's Taqueria",
      formattedAddress: "1 Main St",
      googleMapsUri: "https://maps.google.example/picos",
      attributionText: "Powered by Google",
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
      "verdict_slate_entries",
      "members",
      "votes",
      "rerolls",
    ]);
    expect(invoke).toHaveBeenCalledWith("places-proxy", {
      body: {
        surface: "verdict_display",
        google_place_id: "google-pico",
      },
    });
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
              winner_google_place_id: null,
              computed_at: "2026-06-04T19:00:00Z",
              method: "manual",
              rule_text: "Your best solo fit.",
            },
          ],
          error: null,
        },
        verdict_slate_entries: {
          data: [
            {
              verdict_id: "verdict-1",
              slate_rank: 1,
              google_place_id: "google-solo",
            },
          ],
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
      }, [], jest.fn().mockResolvedValue({
        data: googleDisplay({
          placeId: "google-solo",
          name: "Solo Ramen",
          mapsUri: "https://maps.google.example/solo",
        }),
        error: null,
      }), jest.fn()),
    });

    await expect(
      repository.loadVerdict({ roomId: "room-1", flavor: "solo" }),
    ).resolves.toMatchObject({
      kind: "live",
      flavor: "solo",
      placeName: "Solo Ramen",
      formattedAddress: null,
      googleMapsUri: "https://maps.google.example/solo",
      attributionText: "Powered by Google",
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

  it("fails live verdict load when current Google display refetch fails", async () => {
    const repository = createSupabaseVerdictRepository({
      supabase: makeSupabaseClient({
        verdicts: {
          data: [
            {
              id: "verdict-1",
              room_id: "room-1",
              option_id: "option-1",
              winner_google_place_id: "google-gone",
              computed_at: "2026-06-04T19:00:00Z",
              method: "manual",
              rule_text: "Best fit.",
            },
          ],
          error: null,
        },
        verdict_slate_entries: {
          data: [],
          error: null,
        },
      }, [], jest.fn().mockResolvedValue({
        data: null,
        error: new Error("google_place_unavailable"),
      }), jest.fn()),
    });

    await expect(
      repository.loadVerdict({ roomId: "room-1", flavor: "group" }),
    ).rejects.toThrow("Verdict display refetch failed");
  });

  it("advances through the stored slate, skips unavailable entries, and burns only on presented replacement", async () => {
    const refetch = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(googleDisplay({
        placeId: "google-3",
        name: "Third Place",
        mapsUri: "https://maps.google.example/third",
      }));

    await expect(
      advanceVerdictSlate({
        slate: [
          { rank: 1, googlePlaceId: "google-1" },
          { rank: 2, googlePlaceId: "google-2" },
          { rank: 3, googlePlaceId: "google-3" },
        ],
        currentGooglePlaceId: "google-1",
        burnsUsed: 1,
        refetch,
      }),
    ).resolves.toMatchObject({
      status: "presented",
      entry: { rank: 3, googlePlaceId: "google-3" },
      burnsUsed: 2,
      skippedPlaceIds: ["google-2"],
    });
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("repository reroll skips unavailable slate entries and calls the burn RPC only for a viable replacement", async () => {
    const invoke = jest
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: new Error("google_place_unavailable"),
      })
      .mockResolvedValueOnce({
        data: googleDisplay({
          placeId: "google-3",
          name: "Third Place",
          mapsUri: "https://maps.google.example/third",
        }),
        error: null,
      });
    const rpc = jest.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const repository = createSupabaseVerdictRepository({
      supabase: makeSupabaseClient({
        verdicts: {
          data: [
            {
              id: "verdict-1",
              room_id: "room-1",
              option_id: "option-1",
              winner_google_place_id: "google-1",
              computed_at: "2026-06-04T19:00:00Z",
              method: "manual",
              rule_text: "Best fit.",
            },
          ],
          error: null,
        },
        verdict_slate_entries: {
          data: [
            {
              verdict_id: "verdict-1",
              slate_rank: 1,
              google_place_id: "google-1",
            },
            {
              verdict_id: "verdict-1",
              slate_rank: 2,
              google_place_id: "google-2",
            },
            {
              verdict_id: "verdict-1",
              slate_rank: 3,
              google_place_id: "google-3",
            },
          ],
          error: null,
        },
        rerolls: {
          data: [{ id: "reroll-1", room_id: "room-1" }],
          error: null,
        },
      }, [], invoke, rpc),
    });

    await repository.reroll({ roomId: "room-1", reason: "mood" });

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("apply_verdict_slate_reroll", {
      p_room_id: "room-1",
      p_google_place_id: "google-3",
      p_reason: "mood",
    });
  });

  it("reports slate exhaustion without consuming a reroll burn or fetching a new slate", async () => {
    const refetch = jest.fn().mockResolvedValue(null);

    await expect(
      advanceVerdictSlate({
        slate: [
          { rank: 1, googlePlaceId: "google-1" },
          { rank: 2, googlePlaceId: "google-2" },
        ],
        currentGooglePlaceId: "google-1",
        burnsUsed: 2,
        refetch,
      }),
    ).resolves.toEqual({
      status: "exhausted",
      burnsUsed: 2,
      skippedPlaceIds: ["google-2"],
    });
    expect(refetch).toHaveBeenCalledWith("google-2");
  });
});
