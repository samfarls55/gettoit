import type { GoogleAttributionPayload } from "./places-proxy-core.ts";
import { logLocalTestEvent } from "./local-test-run-logger.ts";

export type Q5CardSetAxis = "cuisine" | "crowd_approval" | "vibe";

export type Q5MemberProbeProfile = {
  cuisines: string[];
  crowdApproval: string;
  vibe: number;
};

export type Q5CardSetCandidateProfile = {
  cuisine: string | null;
  crowdApproval: string;
  vibe: number;
};

export type Q5CardSetPoolCandidate = {
  googlePlaceId: string;
  displayName: string;
  attribution: GoogleAttributionPayload;
  profile: Q5CardSetCandidateProfile;
};

export type Q5AssignedCard = {
  googlePlaceId: string;
  displayName: string;
  position: number;
  attribution: GoogleAttributionPayload;
  axisReceipt: {
    droppedAxis: Q5CardSetAxis;
    matchedAxes: Q5CardSetAxis[];
    reasonCode: Q5CardSetReasonCode;
  };
};

export type Q5CardSetResult =
  | {
    status: "assigned";
    q5CardSetId: string;
    generatorVersion: typeof Q5_CARD_SET_GENERATOR_VERSION;
    shuffleSeed: string;
    cards: Q5AssignedCard[];
    replacementState: {
      strategy: "same_axis";
      retryAllowed: true;
      slots: Array<{
        position: number;
        droppedAxis: Q5CardSetAxis;
        googlePlaceId: string;
      }>;
    };
  }
  | {
    status: "no_results";
    reason: "thin_pool" | "strict_factorial_unavailable";
    q5CardSetId: string;
    generatorVersion: typeof Q5_CARD_SET_GENERATOR_VERSION;
    receipts: Q5NoResultsReceipt[];
  };

export type Q5NoResultsReceipt =
  | { code: "q5_pool_too_thin"; candidateCount: number }
  | {
    code: "q5_strict_factorial_unavailable";
    candidateCount: number;
    requiredAxes: Q5CardSetAxis[];
  };

export type Q5CardSetReasonCode =
  | "selected_contrast_pool"
  | "selected_cuisine_keep_feasible"
  | "selected_crowd_quality_floor"
  | "selected_vibe_band_edge";

export type Q5ProbeFetchPlanStep =
  | { scope: "selected_cuisine"; cuisine: string }
  | { scope: "contrast_pool"; excludedCuisines: string[] }
  | { scope: "no_preference_pool" };

export type AssignQ5CardSetInput = {
  roomId: string;
  memberId: string;
  q5CardSetId: string;
  member: Q5MemberProbeProfile;
  pool: Q5CardSetPoolCandidate[];
};

type Q5FactorialCard = {
  candidate: Q5CardSetPoolCandidate;
  droppedAxis: Q5CardSetAxis;
  reasonCode: Q5CardSetReasonCode;
};

type PickRules = {
  cuisine: (value: string | null) => boolean;
  crowdApproval: (value: string) => boolean;
  vibe: (value: number) => boolean;
};

export const Q5_CARD_SET_GENERATOR_VERSION = "q5_card_set_v1";
const noPreferenceCrowdApproval = "no_preference";
const legacyNoPreferenceCrowdApproval = "noPreference";
const vibeToleranceBands = [0, 1, 2, 3, 4] as const;
const canonicalAxes: Q5CardSetAxis[] = [
  "cuisine",
  "crowd_approval",
  "vibe",
];

export function buildQ5ProbeFetchPlan(
  member: Q5MemberProbeProfile,
): Q5ProbeFetchPlanStep[] {
  const selectedCuisines = [...new Set(member.cuisines)]
    .filter((cuisine) => cuisine.length > 0)
    .slice(0, 2);

  if (selectedCuisines.length === 0) {
    return [{ scope: "no_preference_pool" }];
  }

  return [
    ...selectedCuisines.map((cuisine) => ({
      scope: "selected_cuisine" as const,
      cuisine,
    })),
    { scope: "contrast_pool", excludedCuisines: selectedCuisines },
  ];
}

export function assignQ5CardSet({
  roomId,
  memberId,
  q5CardSetId,
  member,
  pool,
}: AssignQ5CardSetInput): Q5CardSetResult {
  const stablePool = stableCandidatePool(pool);
  logLocalTestEvent("q5_card_set.assign.start", {
    roomId,
    memberId,
    q5CardSetId,
    member,
    inputPoolCount: pool.length,
    inputPool: pool,
    stablePoolCount: stablePool.length,
    stablePool,
  });
  if (stablePool.length < 3) {
    const result: Q5CardSetResult = {
      status: "no_results",
      reason: "thin_pool",
      q5CardSetId,
      generatorVersion: Q5_CARD_SET_GENERATOR_VERSION,
      receipts: [{
        code: "q5_pool_too_thin",
        candidateCount: stablePool.length,
      }],
    };
    logLocalTestEvent("q5_card_set.assign.no_results", {
      roomId,
      memberId,
      q5CardSetId,
      result,
    });
    return result;
  }

  const cards = generateFactorialCards(member, stablePool);
  if (!cards) {
    const result: Q5CardSetResult = {
      status: "no_results",
      reason: "strict_factorial_unavailable",
      q5CardSetId,
      generatorVersion: Q5_CARD_SET_GENERATOR_VERSION,
      receipts: [{
        code: "q5_strict_factorial_unavailable",
        candidateCount: stablePool.length,
        requiredAxes: canonicalAxes,
      }],
    };
    logLocalTestEvent("q5_card_set.assign.no_results", {
      roomId,
      memberId,
      q5CardSetId,
      stablePool,
      result,
    });
    return result;
  }

  const shuffleSeed = `${roomId}:${memberId}:${q5CardSetId}`;
  const shuffledCards = deterministicShuffle(cards, shuffleSeed);
  const assignedCards = shuffledCards.map((card, index) =>
    assignedCard(card, index)
  );

  const result: Q5CardSetResult = {
    status: "assigned",
    q5CardSetId,
    generatorVersion: Q5_CARD_SET_GENERATOR_VERSION,
    shuffleSeed,
    cards: assignedCards,
    replacementState: {
      strategy: "same_axis",
      retryAllowed: true,
      slots: assignedCards.map((card) => ({
        position: card.position,
        droppedAxis: card.axisReceipt.droppedAxis,
        googlePlaceId: card.googlePlaceId,
      })),
    },
  };
  logLocalTestEvent("q5_card_set.assign.assigned", {
    roomId,
    memberId,
    q5CardSetId,
    member,
    stablePool,
    generatedCards: cards,
    shuffleSeed,
    shuffledCards,
    assignedCards,
    result,
  });
  return result;
}

function generateFactorialCards(
  member: Q5MemberProbeProfile,
  pool: Q5CardSetPoolCandidate[],
): Q5FactorialCard[] | null {
  const probedCuisines = selectProbedCuisines(member, pool);
  const crowdDropCuisine = probedCuisines[0] ?? null;
  const vibeDropCuisine = probedCuisines[1] ?? probedCuisines[0] ?? null;
  const acceptsAnyCrowdApproval = crowdApprovalIsNoPreference(
    member.crowdApproval,
  );

  for (const vibeTolerance of vibeToleranceBands) {
    const vibeMatches = (vibe: number) =>
      Math.abs(vibe - member.vibe) <= vibeTolerance;
    const vibeDiffers = (vibe: number) =>
      Math.abs(vibe - member.vibe) > vibeTolerance;
    const usedGooglePlaceIds = new Set<string>();

    const cuisineDrop = pickCandidate(pool, usedGooglePlaceIds, {
      cuisine: (cuisine) =>
        cuisine === null || !member.cuisines.includes(cuisine),
      crowdApproval: (crowdApproval) =>
        acceptsAnyCrowdApproval || crowdApproval === member.crowdApproval,
      vibe: vibeMatches,
    });
    if (!cuisineDrop) continue;
    usedGooglePlaceIds.add(cuisineDrop.googlePlaceId);

    const crowdApprovalDrop = pickCandidate(pool, usedGooglePlaceIds, {
      cuisine: (cuisine) =>
        crowdDropCuisine === null || cuisine === crowdDropCuisine,
      crowdApproval: (crowdApproval) =>
        acceptsAnyCrowdApproval || crowdApproval !== member.crowdApproval,
      vibe: vibeMatches,
    });
    if (!crowdApprovalDrop) continue;
    usedGooglePlaceIds.add(crowdApprovalDrop.googlePlaceId);

    const vibeDrop = pickCandidate(pool, usedGooglePlaceIds, {
      cuisine: (cuisine) =>
        vibeDropCuisine === null || cuisine === vibeDropCuisine,
      crowdApproval: (crowdApproval) =>
        acceptsAnyCrowdApproval || crowdApproval === member.crowdApproval,
      vibe: vibeDiffers,
    });
    if (!vibeDrop) continue;

    return [
      {
        candidate: cuisineDrop,
        droppedAxis: "cuisine",
        reasonCode: "selected_contrast_pool",
      },
      {
        candidate: crowdApprovalDrop,
        droppedAxis: "crowd_approval",
        reasonCode: "selected_crowd_quality_floor",
      },
      {
        candidate: vibeDrop,
        droppedAxis: "vibe",
        reasonCode: "selected_vibe_band_edge",
      },
    ];
  }

  return null;
}

function assignedCard(card: Q5FactorialCard, index: number): Q5AssignedCard {
  return {
    googlePlaceId: card.candidate.googlePlaceId,
    displayName: card.candidate.displayName,
    position: index,
    attribution: card.candidate.attribution,
    axisReceipt: {
      droppedAxis: card.droppedAxis,
      matchedAxes: canonicalAxes.filter((axis) => axis !== card.droppedAxis),
      reasonCode: card.reasonCode,
    },
  };
}

function stableCandidatePool(
  pool: Q5CardSetPoolCandidate[],
): Q5CardSetPoolCandidate[] {
  const deduped = new Map<string, Q5CardSetPoolCandidate>();
  for (const candidate of pool) {
    if (!deduped.has(candidate.googlePlaceId)) {
      deduped.set(candidate.googlePlaceId, candidate);
    }
  }

  return [...deduped.values()].sort((left, right) =>
    left.googlePlaceId.localeCompare(right.googlePlaceId)
  );
}

function selectProbedCuisines(
  member: Q5MemberProbeProfile,
  pool: Q5CardSetPoolCandidate[],
): string[] {
  const uniqueMemberCuisines = [...new Set(member.cuisines)];
  if (uniqueMemberCuisines.length === 0) {
    return [];
  }

  const support = new Map(uniqueMemberCuisines.map((cuisine) => [cuisine, 0]));
  for (const candidate of pool) {
    const cuisine = candidate.profile.cuisine;
    if (cuisine && support.has(cuisine)) {
      support.set(cuisine, (support.get(cuisine) ?? 0) + 1);
    }
  }

  return uniqueMemberCuisines
    .map((cuisine, pickOrder) => ({
      cuisine,
      pickOrder,
      support: support.get(cuisine) ?? 0,
    }))
    .filter((entry) => entry.support > 0)
    .sort((left, right) => {
      if (left.support !== right.support) {
        return right.support - left.support;
      }
      return left.pickOrder - right.pickOrder;
    })
    .slice(0, 2)
    .map((entry) => entry.cuisine);
}

function pickCandidate(
  pool: Q5CardSetPoolCandidate[],
  usedGooglePlaceIds: Set<string>,
  rules: PickRules,
): Q5CardSetPoolCandidate | null {
  return pool.find((candidate) =>
    !usedGooglePlaceIds.has(candidate.googlePlaceId) &&
    rules.cuisine(candidate.profile.cuisine) &&
    rules.crowdApproval(candidate.profile.crowdApproval) &&
    rules.vibe(candidate.profile.vibe)
  ) ?? null;
}

function crowdApprovalIsNoPreference(value: string): boolean {
  return value === noPreferenceCrowdApproval ||
    value === legacyNoPreferenceCrowdApproval;
}

function deterministicShuffle<T>(items: T[], seed: string): T[] {
  const shuffled = [...items];
  let state = hashSeed(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = nextRandomState(state);
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function nextRandomState(state: number): number {
  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}
