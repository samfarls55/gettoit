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
        q2SpendCap: "$$",
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
