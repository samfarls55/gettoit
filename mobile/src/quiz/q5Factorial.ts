export type Q5Axis = "cuisine" | "crowd_approval" | "vibe";

export type Q5VenueProfile = {
  cuisine: string | null;
  reputation: string;
  vibe: number;
  vibeConfidence?: number;
};

export type Q5PoolVenue = {
  id: string;
  name: string;
  categories: string[];
  attributionText?: string;
  priceTier?: number;
  walkMinutesEstimate?: number;
  profile: Q5VenueProfile;
};

export type Q5MemberProfile = {
  cuisines: string[];
  reputation: string;
  vibe: number;
};

export type Q5FactorialCard = {
  venue: Q5PoolVenue;
  droppedAxis: Q5Axis;
};

export type Q5Candidate = {
  id: string;
  name: string;
  meta: string;
  attributionText?: string;
  droppedAxis: Q5Axis;
};

type GenerateInput = {
  member: Q5MemberProfile;
  memberId?: string;
  pool: Q5PoolVenue[];
  q5CardSetId?: string;
};

type ReplacementInput = GenerateInput & {
  currentCards: Q5FactorialCard[];
  failedVenueId: string;
  retryPool?: Q5PoolVenue[];
  retryCardSetId?: string;
};

type Q5PickRules = {
  cuisine: (cuisine: string | null) => boolean;
  reputation: (reputation: string) => boolean;
  vibe: (vibe: number) => boolean;
};

export type Q5ReplacementResult =
  | { kind: "replaced"; cards: Q5FactorialCard[] }
  | { kind: "retry"; cards: Q5FactorialCard[] }
  | { kind: "no-results" };

const noPreferenceReputation = "noPreference";
const vibeToleranceBands = [0, 1, 2, 3, 4] as const;

export function generateQ5FactorialCards({
  member,
  memberId,
  pool,
  q5CardSetId,
}: GenerateInput): Q5FactorialCard[] | null {
  const probedCuisines = selectProbedCuisines(member, pool);
  const crowdApprovalDropCuisine = probedCuisines[0] ?? null;
  const vibeDropCuisine = probedCuisines[1] ?? probedCuisines[0] ?? null;

  for (const vibeTolerance of vibeToleranceBands) {
    const vibeMatches = (vibe: number) =>
      isWithinVibeTolerance(vibe, member.vibe, vibeTolerance);
    const vibeDiffers = (vibe: number) =>
      isOutsideVibeTolerance(vibe, member.vibe, vibeTolerance);
    const usedVenueIds = new Set<string>();
    const cuisineDrop = pickVenue(pool, usedVenueIds, {
      cuisine: (cuisine) => !cuisine || !member.cuisines.includes(cuisine),
      reputation: (reputation) =>
        member.reputation === noPreferenceReputation ||
        reputation === member.reputation,
      vibe: vibeMatches,
    });

    if (!cuisineDrop) {
      continue;
    }

    usedVenueIds.add(cuisineDrop.id);

    const crowdApprovalDrop = pickVenue(pool, usedVenueIds, {
      cuisine: (cuisine) =>
        crowdApprovalDropCuisine === null ||
        cuisine === crowdApprovalDropCuisine,
      reputation: (reputation) =>
        member.reputation === noPreferenceReputation ||
        reputation !== member.reputation,
      vibe: vibeMatches,
    });

    if (!crowdApprovalDrop) {
      continue;
    }

    usedVenueIds.add(crowdApprovalDrop.id);

    const vibeDrop = pickVenue(pool, usedVenueIds, {
      cuisine: (cuisine) =>
        vibeDropCuisine === null || cuisine === vibeDropCuisine,
      reputation: (reputation) =>
        member.reputation === noPreferenceReputation ||
        reputation === member.reputation,
      vibe: vibeDiffers,
    });

    if (!vibeDrop) {
      continue;
    }

    const cards = [
      { venue: cuisineDrop, droppedAxis: "cuisine" as const },
      { venue: crowdApprovalDrop, droppedAxis: "crowd_approval" as const },
      { venue: vibeDrop, droppedAxis: "vibe" as const },
    ];

    return memberId && q5CardSetId
      ? deterministicShuffle(cards, `${memberId}:${q5CardSetId}`)
      : cards;
  }

  return null;
}

export function q5CardsToCandidates(cards: Q5FactorialCard[]): Q5Candidate[] {
  return cards.map(({ droppedAxis, venue }) => {
    const attributionText = venue.attributionText;
    const candidate: Q5Candidate = {
      id: venue.id,
      name: venue.name,
      meta: attributionText ? "" : metaString(venue),
      droppedAxis,
    };

    if (attributionText) {
      candidate.attributionText = attributionText;
    }

    return candidate;
  });
}

export function replaceQ5FactorialCard({
  currentCards,
  failedVenueId,
  member,
  memberId,
  pool,
  retryPool,
  retryCardSetId,
}: ReplacementInput): Q5ReplacementResult {
  const failedIndex = currentCards.findIndex(
    (card) => card.venue.id === failedVenueId,
  );
  if (failedIndex === -1) {
    return { kind: "replaced", cards: currentCards };
  }

  const failedCard = currentCards[failedIndex];
  const usedVenueIds = new Set([
    failedVenueId,
    ...currentCards
      .filter((card) => card.venue.id !== failedVenueId)
      .map((card) => card.venue.id),
  ]);
  const replacement = pickReplacementForAxis(
    failedCard.droppedAxis,
    member,
    pool,
    usedVenueIds,
  );

  if (replacement) {
    const cards = [...currentCards];
    cards[failedIndex] = {
      venue: replacement,
      droppedAxis: failedCard.droppedAxis,
    };
    return { kind: "replaced", cards };
  }

  const retryCards = retryCardSetId
    ? generateQ5FactorialCards({
        member,
        memberId,
        pool: (retryPool ?? pool).filter((venue) => venue.id !== failedVenueId),
        q5CardSetId: retryCardSetId,
      })
    : null;

  if (retryCards) {
    return { kind: "retry", cards: retryCards };
  }

  return { kind: "no-results" };
}

export function selectProbedCuisines(
  member: Q5MemberProfile,
  pool: Q5PoolVenue[],
): string[] {
  if (member.cuisines.length === 0) {
    return [];
  }

  const support = new Map(member.cuisines.map((cuisine) => [cuisine, 0]));

  for (const venue of pool) {
    const cuisine = venue.profile.cuisine;

    if (cuisine && support.has(cuisine)) {
      support.set(cuisine, (support.get(cuisine) ?? 0) + 1);
    }
  }

  return member.cuisines
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

function pickVenue(
  pool: Q5PoolVenue[],
  usedVenueIds: Set<string>,
  rules: Q5PickRules,
): Q5PoolVenue | null {
  return (
    pool.find(
      (venue) =>
        !usedVenueIds.has(venue.id) &&
        rules.cuisine(venue.profile.cuisine) &&
        rules.reputation(venue.profile.reputation) &&
        rules.vibe(venue.profile.vibe),
    ) ?? null
  );
}

function pickReplacementForAxis(
  axis: Q5Axis,
  member: Q5MemberProfile,
  pool: Q5PoolVenue[],
  usedVenueIds: Set<string>,
): Q5PoolVenue | null {
  for (const vibeTolerance of vibeToleranceBands) {
    const rules = replacementRulesForAxis(axis, member, vibeTolerance);
    const replacement = pickVenue(pool, usedVenueIds, rules);
    if (replacement) {
      return replacement;
    }
  }

  return null;
}

function replacementRulesForAxis(
  axis: Q5Axis,
  member: Q5MemberProfile,
  vibeTolerance: number,
): Q5PickRules {
  const selectedCuisine = (cuisine: string | null) =>
    member.cuisines.length === 0 ||
    (cuisine !== null && member.cuisines.includes(cuisine));
  const vibeMatches = (vibe: number) =>
    isWithinVibeTolerance(vibe, member.vibe, vibeTolerance);
  const vibeDiffers = (vibe: number) =>
    isOutsideVibeTolerance(vibe, member.vibe, vibeTolerance);

  switch (axis) {
    case "cuisine":
      return {
        cuisine: (cuisine) => !cuisine || !member.cuisines.includes(cuisine),
        reputation: (reputation) =>
          member.reputation === noPreferenceReputation ||
          reputation === member.reputation,
        vibe: vibeMatches,
      };
    case "crowd_approval":
      return {
        cuisine: selectedCuisine,
        reputation: (reputation) =>
          member.reputation === noPreferenceReputation ||
          reputation !== member.reputation,
        vibe: vibeMatches,
      };
    case "vibe":
      return {
        cuisine: selectedCuisine,
        reputation: (reputation) =>
          member.reputation === noPreferenceReputation ||
          reputation === member.reputation,
        vibe: vibeDiffers,
      };
  }
}

function isWithinVibeTolerance(
  vibe: number,
  targetVibe: number,
  tolerance: number,
): boolean {
  return Math.abs(vibe - targetVibe) <= tolerance;
}

function isOutsideVibeTolerance(
  vibe: number,
  targetVibe: number,
  tolerance: number,
): boolean {
  return Math.abs(vibe - targetVibe) > tolerance;
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

function metaString(venue: Q5PoolVenue): string {
  const segments: string[] = [];
  const category = venue.categories[0];

  if (category) {
    segments.push(category);
  }

  if (venue.priceTier && venue.priceTier >= 1 && venue.priceTier <= 4) {
    segments.push("$".repeat(venue.priceTier));
  }

  if (venue.walkMinutesEstimate) {
    segments.push(`${venue.walkMinutesEstimate} min`);
  }

  return segments.join(" - ");
}
