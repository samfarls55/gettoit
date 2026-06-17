import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  evaluateHardEligibility,
  type HardEligibilityCandidate,
  type HardEligibilityVote,
} from "./hard-eligibility.ts";

const baseCandidate: HardEligibilityCandidate = {
  id: "eligible",
  google_place_id: "google-eligible",
  price_tier: 2,
  dietary_tags: ["vegan_friendly", "no_peanut_unverified"],
  categories: ["Restaurant"],
  distance_meters: 100,
  rating: 4.2,
  user_rating_count: 30,
  current_open_now: true,
  dine_in: true,
};

const baseVotes: HardEligibilityVote[] = [{
  q1_vetoes: ["vegan"],
  q2_budget: 2,
  hard_vetoes: [{ kind: "tag", token: "no_peanut_unverified" }],
}];

Deno.test("TB-32: shared hard eligibility emits stable cut reasons", () => {
  const cases: Array<{
    name: string;
    candidate: HardEligibilityCandidate;
    votes?: HardEligibilityVote[];
    radiusMeters?: number | null;
    reason: string;
  }> = [
    {
      name: "missing provider metadata",
      candidate: { ...baseCandidate, price_tier: null },
      reason: "metadata",
    },
    {
      name: "price cap",
      candidate: { ...baseCandidate, price_tier: 3 },
      reason: "budget",
    },
    {
      name: "hours",
      candidate: { ...baseCandidate, current_open_now: false },
      reason: "availability",
    },
    {
      name: "service mode",
      candidate: { ...baseCandidate, dine_in: false },
      reason: "availability",
    },
    {
      name: "dietary",
      candidate: { ...baseCandidate, dietary_tags: [] },
      reason: "dietary",
    },
    {
      name: "cuisine never",
      candidate: { ...baseCandidate, categories: ["Sushi Restaurant"] },
      votes: [{
        q1_vetoes: [],
        q2_budget: 2,
        hard_vetoes: [{ kind: "cuisine_never", token: "sushi" }],
      }],
      reason: "veto",
    },
    {
      name: "search area",
      candidate: { ...baseCandidate, distance_meters: 500 },
      radiusMeters: 200,
      reason: "radius",
    },
    {
      name: "crowd floor",
      candidate: { ...baseCandidate, rating: 3.6 },
      reason: "crowd_floor",
    },
  ];

  for (const testCase of cases) {
    const result = evaluateHardEligibility({
      candidate: testCase.candidate,
      votes: testCase.votes ?? baseVotes,
      room: {
        radius_meters: testCase.radiusMeters ?? null,
        service_shape: "dineIn",
      },
    });

    assertEquals(result.eligible, false, testCase.name);
    if (!result.eligible) {
      assertEquals(result.cut.cut_reason, testCase.reason, testCase.name);
    }
  }
});

Deno.test("TB-32: Vibe and Verdict callers can share one hard eligibility decision", () => {
  const result = evaluateHardEligibility({
    candidate: { ...baseCandidate, id: "shared" },
    votes: baseVotes,
    room: { radius_meters: 200, service_shape: "dineIn" },
  });

  assertEquals(result, { eligible: true });
});
