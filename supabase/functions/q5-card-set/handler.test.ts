import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleRequest } from "./handler.ts";
import type { Q5CardSetPoolCandidate } from "../_shared/q5-card-set.ts";

const attribution = {
  provider: "google",
  render: "text",
  text: "Powered by Google",
} as const;

function candidate(
  googlePlaceId: string,
  cuisine: string | null,
  crowdApproval: string,
  vibe: number,
): Q5CardSetPoolCandidate {
  return {
    googlePlaceId,
    displayName: `Place ${googlePlaceId}`,
    attribution,
    profile: { cuisine, crowdApproval, vibe },
  };
}

function authedRequest(body: Record<string, unknown>) {
  return new Request("https://example/q5-card-set", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-jwt",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

Deno.test("q5-card-set handler assigns a stable server-owned card set for a locked Room member", async () => {
  const providerInputs: unknown[] = [];
  const res = await handleRequest(
    authedRequest({
      room_id: "room-1",
      q5_card_set_id: "set-1",
    }),
    {
      getUserId: () => Promise.resolve("user-1"),
      data: {
        fetchRoomMember: () =>
          Promise.resolve({
            roomId: "room-1",
            memberId: "user-1",
            parametersLocked: true,
            answers: {
              q1CuisineCravings: ["mexican"],
              q3Reputation: "popular",
              q4VibeEnergy: "social",
            },
          }),
        fetchQ5Pool: (input) => {
          providerInputs.push(input);
          return Promise.resolve([
            candidate("google-cuisine", "thai", "popular", 2),
            candidate("google-crowd", "mexican", "hidden_gem", 2),
            candidate("google-vibe", "mexican", "popular", 4),
          ]);
        },
      },
    },
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.status, "assigned");
  assertEquals(
    body.cards.map((card: { axisReceipt: { droppedAxis: string } }) =>
      card.axisReceipt.droppedAxis
    ).sort(),
    ["crowd_approval", "cuisine", "vibe"],
  );
  assertEquals(
    body.cards.every((card: { attribution: unknown }) =>
      JSON.stringify(card.attribution) === JSON.stringify(attribution)
    ),
    true,
  );
  assertEquals(providerInputs, [{
    roomId: "room-1",
    memberId: "user-1",
    profile: {
      cuisines: ["mexican"],
      crowdApproval: "popular",
      vibe: 2,
    },
    fetchPlan: [
      { scope: "selected_cuisine", cuisine: "mexican" },
      { scope: "contrast_pool", excludedCuisines: ["mexican"] },
    ],
  }]);
});

Deno.test("q5-card-set handler returns opt-in local debug trace events", async () => {
  const providerInputs: unknown[] = [];
  const res = await handleRequest(
    authedRequest({
      room_id: "room-1",
      q5_card_set_id: "set-1",
      debug_trace: "expo_dev_run",
    }),
    {
      getUserId: () => Promise.resolve("user-1"),
      data: {
        fetchRoomMember: () =>
          Promise.resolve({
            roomId: "room-1",
            memberId: "user-1",
            parametersLocked: true,
            answers: {
              q1CuisineCravings: ["mexican"],
              q3Reputation: "popular",
              q4VibeEnergy: "social",
            },
          }),
        fetchQ5Pool: (input) => {
          providerInputs.push(input);
          return Promise.resolve([
            candidate("google-cuisine", "thai", "popular", 2),
            candidate("google-crowd", "mexican", "hidden_gem", 2),
            candidate("google-vibe", "mexican", "popular", 4),
          ]);
        },
      },
    },
  );

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.status, "assigned");
  assertEquals(
    body.debugTrace.map((entry: { event: string }) => entry.event).includes(
      "q5_card_set.handler.input",
    ),
    true,
  );
  assertEquals(
    body.debugTrace.map((entry: { event: string }) => entry.event).includes(
      "q5_card_set.assign.assigned",
    ),
    true,
  );
  assertEquals((providerInputs[0] as { debugTrace?: boolean }).debugTrace, true);
});

Deno.test("q5-card-set handler rejects a visible but parameter-unlocked Room", async () => {
  const res = await handleRequest(authedRequest({ room_id: "room-1" }), {
    getUserId: () => Promise.resolve("user-1"),
    data: {
      fetchRoomMember: () =>
        Promise.resolve({
          roomId: "room-1",
          memberId: "user-1",
          parametersLocked: false,
          answers: {},
        }),
      fetchQ5Pool: () => Promise.resolve([]),
    },
  });

  assertEquals(res.status, 409);
  assertEquals(await res.json(), { error: "room_parameters_unlocked" });
});
