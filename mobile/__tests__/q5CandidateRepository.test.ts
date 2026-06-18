import {
  createSupabaseQ5CandidateRepository,
  type Q5SupabaseClient,
} from "../src/quiz/q5CandidateRepository";

function makeSupabaseClient(
  invoke = jest.fn(),
): Q5SupabaseClient {
  return {
    functions: {
      invoke,
    },
  };
}

describe("q5CandidateRepository", () => {
  it("loads assigned Q5 cards from the server-owned card set path", async () => {
    const invoke = jest.fn().mockResolvedValue({
      data: {
        status: "assigned",
        q5CardSetId: "initial",
        generatorVersion: "q5_card_set_v1",
        cards: [
          {
            googlePlaceId: "google-katzs-delicatessen",
            displayName: "Katz's Delicatessen",
            attribution: {
              provider: "google",
              render: "text",
              text: "Powered by Google",
            },
            axisReceipt: { droppedAxis: "cuisine" },
          },
          {
            googlePlaceId: "google-los-tacos-no-1",
            displayName: "Los Tacos No. 1",
            attribution: {
              provider: "google",
              render: "text",
              text: "Powered by Google",
            },
            axisReceipt: { droppedAxis: "crowd_approval" },
          },
          {
            googlePlaceId: "google-cosme",
            displayName: "Cosme",
            attribution: {
              provider: "google",
              render: "text",
              text: "Powered by Google",
            },
            axisReceipt: { droppedAxis: "vibe" },
          },
        ],
      },
      error: null,
    });
    const repository = createSupabaseQ5CandidateRepository({
      supabase: makeSupabaseClient(invoke),
    });

    const candidates = await repository.loadCandidates({
      roomId: "room-1",
      answers: {
        q1CuisineCravings: ["mexican"],
        q2SpendCap: 2,
        q3Reputation: "popular",
        q4VibeEnergy: "social",
      },
    });

    expect(invoke).toHaveBeenCalledWith("q5-card-set", {
      body: {
        room_id: "room-1",
        q5_card_set_id: "initial",
      },
    });
    expect(candidates).toEqual([
      {
        id: "google-katzs-delicatessen",
        name: "Katz's Delicatessen",
        meta: "",
        attributionText: "Powered by Google",
        droppedAxis: "cuisine",
      },
      {
        id: "google-los-tacos-no-1",
        name: "Los Tacos No. 1",
        meta: "",
        attributionText: "Powered by Google",
        droppedAxis: "crowd_approval",
      },
      {
        id: "google-cosme",
        name: "Cosme",
        meta: "",
        attributionText: "Powered by Google",
        droppedAxis: "vibe",
      },
    ]);
  });

  it("normalizes legacy reputation receipts when reading old assigned card sets", async () => {
    const repository = createSupabaseQ5CandidateRepository({
      supabase: makeSupabaseClient(jest.fn().mockResolvedValue({
        data: {
          status: "assigned",
          cards: [
            {
              googlePlaceId: "google-legacy",
              displayName: "Legacy Card",
              axisReceipt: { droppedAxis: "reputation" },
            },
          ],
        },
        error: null,
      })),
    });

    await expect(
      repository.loadCandidates({
        roomId: "room-1",
        answers: {},
      }),
    ).resolves.toEqual([
      {
        id: "google-legacy",
        name: "Legacy Card",
        meta: "",
        droppedAxis: "crowd_approval",
      },
    ]);
  });

  it("requests local Q5 debug traces and logs the mapped candidate set", async () => {
    const logEvent = jest.fn();
    const debugTrace = [
      {
        timestamp: "2026-06-18T00:00:00.000Z",
        event: "q5_card_set.handler.before_pool_fetch",
        payload: {
          fetchPlan: [{ scope: "selected_cuisine", cuisine: "thai" }],
        },
      },
    ];
    const invoke = jest.fn().mockResolvedValue({
      data: {
        status: "assigned",
        debugTrace,
        cards: [
          {
            googlePlaceId: "google-thai",
            displayName: "Thai Place",
            axisReceipt: { droppedAxis: "vibe" },
          },
        ],
      },
      error: null,
    });
    const repository = createSupabaseQ5CandidateRepository({
      logEvent,
      shouldRequestDebugTrace: () => true,
      supabase: makeSupabaseClient(invoke),
    });

    await expect(
      repository.loadCandidates({
        roomId: "room-1",
        answers: {
          q1CuisineCravings: ["thai"],
          q2SpendCap: 3,
          q3Reputation: "popular",
          q4VibeEnergy: "lively",
        },
      }),
    ).resolves.toEqual([
      {
        id: "google-thai",
        name: "Thai Place",
        meta: "",
        droppedAxis: "vibe",
      },
    ]);

    expect(invoke).toHaveBeenCalledWith("q5-card-set", {
      body: {
        room_id: "room-1",
        q5_card_set_id: "initial",
        debug_trace: "expo_dev_run",
      },
    });
    expect(logEvent).toHaveBeenCalledWith("quiz.q5.backend_trace", {
      roomId: "room-1",
      trace: debugTrace,
    });
    expect(logEvent).toHaveBeenCalledWith(
      "quiz.q5.load.response",
      expect.objectContaining({
        roomId: "room-1",
        response: expect.objectContaining({
          debugTrace,
          status: "assigned",
        }),
      }),
    );
    expect(logEvent).toHaveBeenCalledWith(
      "quiz.q5.load.mapped",
      expect.objectContaining({
        roomId: "room-1",
        candidates: [
          {
            id: "google-thai",
            name: "Thai Place",
            meta: "",
            droppedAxis: "vibe",
          },
        ],
      }),
    );
  });

  it("logs when Q5 debug trace was requested but missing from the response", async () => {
    const logEvent = jest.fn();
    const response = {
      status: "no_results" as const,
      reason: "thin_pool",
      q5CardSetId: "initial",
      generatorVersion: "q5_card_set_v1",
      receipts: [{ code: "q5_pool_too_thin", candidateCount: 1 }],
    };
    const repository = createSupabaseQ5CandidateRepository({
      logEvent,
      shouldRequestDebugTrace: () => true,
      supabase: makeSupabaseClient(jest.fn().mockResolvedValue({
        data: response,
        error: null,
      })),
    });

    await expect(
      repository.loadCandidates({
        roomId: "room-1",
        answers: {
          q1CuisineCravings: ["mexican"],
          q2SpendCap: 4,
          q3Reputation: "noPreference",
          q4VibeEnergy: "lively",
        },
      }),
    ).resolves.toEqual([]);

    expect(logEvent).toHaveBeenCalledWith("quiz.q5.backend_trace.missing", {
      roomId: "room-1",
      requestBody: {
        room_id: "room-1",
        q5_card_set_id: "initial",
        debug_trace: "expo_dev_run",
      },
      response,
    });
  });

  it("returns no Q5 cards when the assigned card set has no results", async () => {
    const repository = createSupabaseQ5CandidateRepository({
      supabase: makeSupabaseClient(jest.fn().mockResolvedValue({
        data: {
          status: "no_results",
          reason: "thin_pool",
          q5CardSetId: "initial",
          generatorVersion: "q5_card_set_v1",
          receipts: [{ code: "q5_pool_too_thin", candidateCount: 2 }],
        },
        error: null,
      })),
    });

    await expect(
      repository.loadCandidates({
        roomId: "room-1",
        answers: {},
      }),
    ).resolves.toEqual([]);
  });

  it("throws Q5 card-set edge errors instead of treating them as empty pools", async () => {
    const repository = createSupabaseQ5CandidateRepository({
      supabase: makeSupabaseClient(jest.fn().mockResolvedValue({
        data: { error: "q5_card_set_misconfigured" },
        error: null,
      })),
    });

    await expect(
      repository.loadCandidates({
        roomId: "room-1",
        answers: {},
      }),
    ).rejects.toThrow("Q5 card set read failed: q5_card_set_misconfigured");
  });
});
