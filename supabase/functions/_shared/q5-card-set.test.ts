import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assignQ5CardSet,
  buildQ5ProbeFetchPlan,
  type Q5CardSetPoolCandidate,
  type Q5MemberProbeProfile,
} from "./q5-card-set.ts";

const attribution = {
  provider: "google",
  render: "text",
  text: "Powered by Google",
} as const;

const member: Q5MemberProbeProfile = {
  cuisines: ["mexican"],
  crowdApproval: "popular",
  vibe: 2,
};

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

Deno.test("assignQ5CardSet returns canonical axis receipts and name-only Google cards", () => {
  const result = assignQ5CardSet({
    roomId: "room-1",
    memberId: "member-1",
    q5CardSetId: "set-1",
    member,
    pool: [
      candidate("google-vibe", "mexican", "popular", 4),
      candidate("google-cuisine", "thai", "popular", 2),
      candidate("google-crowd", "mexican", "hidden_gem", 2),
      candidate("google-perfect", "mexican", "popular", 2),
    ],
  });

  assertEquals(result.status, "assigned");
  if (result.status !== "assigned") return;

  assertEquals(
    result.cards.map((card) => card.axisReceipt.droppedAxis).sort(),
    [
      "crowd_approval",
      "cuisine",
      "vibe",
    ],
  );
  assertEquals(new Set(result.cards.map((card) => card.googlePlaceId)).size, 3);
  assertEquals(
    result.cards.some((card) => card.googlePlaceId === "google-perfect"),
    false,
  );
  assertEquals(result.replacementState.strategy, "same_axis");
  assertEquals(result.replacementState.slots.length, 3);

  for (const card of result.cards) {
    assertEquals(card.attribution, attribution);
    assertEquals(typeof card.displayName, "string");
  }

  const serialized = JSON.stringify(result);
  for (
    const forbidden of ["rating", "formattedAddress", "summary", "rawPayload"]
  ) {
    assertEquals(serialized.includes(forbidden), false, forbidden);
  }
});

Deno.test("assignQ5CardSet shuffles deterministically from app-owned card-set inputs", () => {
  const pool = [
    candidate("provider-third", "thai", "popular", 2),
    candidate("provider-first", "mexican", "hidden_gem", 2),
    candidate("provider-second", "mexican", "popular", 4),
  ];

  const first = assignQ5CardSet({
    roomId: "room-1",
    memberId: "member-1",
    q5CardSetId: "set-1",
    member,
    pool,
  });
  const second = assignQ5CardSet({
    roomId: "room-1",
    memberId: "member-1",
    q5CardSetId: "set-1",
    member,
    pool: [...pool].reverse(),
  });
  const differentSet = assignQ5CardSet({
    roomId: "room-1",
    memberId: "member-1",
    q5CardSetId: "set-2",
    member,
    pool,
  });

  assertEquals(first.status, "assigned");
  assertEquals(second.status, "assigned");
  assertEquals(differentSet.status, "assigned");
  if (
    first.status !== "assigned" ||
    second.status !== "assigned" ||
    differentSet.status !== "assigned"
  ) return;

  assertEquals(
    first.cards.map((card) => card.googlePlaceId),
    second.cards.map((card) => card.googlePlaceId),
  );
  assert(
    first.cards.map((card) => card.googlePlaceId).join(",") !==
      differentSet.cards.map((card) => card.googlePlaceId).join(","),
  );
});

Deno.test("assignQ5CardSet returns no-results for thin or non-factorial pools", () => {
  assertEquals(
    assignQ5CardSet({
      roomId: "room-1",
      memberId: "member-1",
      q5CardSetId: "set-1",
      member,
      pool: [
        candidate("only-one", "thai", "popular", 2),
        candidate("only-two", "mexican", "popular", 2),
      ],
    }),
    {
      status: "no_results",
      reason: "thin_pool",
      q5CardSetId: "set-1",
      generatorVersion: "q5_card_set_v1",
      receipts: [{ code: "q5_pool_too_thin", candidateCount: 2 }],
    },
  );

  const nonFactorial = assignQ5CardSet({
    roomId: "room-1",
    memberId: "member-1",
    q5CardSetId: "set-1",
    member,
    pool: [
      candidate("same-1", "mexican", "popular", 2),
      candidate("same-2", "mexican", "popular", 2),
      candidate("same-3", "mexican", "popular", 2),
    ],
  });

  assertEquals(nonFactorial.status, "no_results");
  if (nonFactorial.status !== "no_results") return;
  assertEquals(nonFactorial.reason, "strict_factorial_unavailable");
});

Deno.test("buildQ5ProbeFetchPlan keeps cuisine and contrast fetches server-owned", () => {
  assertEquals(buildQ5ProbeFetchPlan(member), [
    { scope: "selected_cuisine", cuisine: "mexican" },
    { scope: "contrast_pool", excludedCuisines: ["mexican"] },
  ]);
});
