export type Q5Axis = "cuisine" | "reputation" | "vibe";

export type Q5VenueProfile = {
  cuisine: string | null;
  reputation: string;
  vibe: number;
};

export type Q5PoolVenue = {
  id: string;
  name: string;
  categories: string[];
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
  droppedAxis: Q5Axis;
};

type GenerateInput = {
  member: Q5MemberProfile;
  pool: Q5PoolVenue[];
};

const noPreferenceReputation = "noPreference";

export function generateQ5FactorialCards({
  member,
  pool,
}: GenerateInput): Q5FactorialCard[] | null {
  const probedCuisines = selectProbedCuisines(member, pool);
  const reputationDropCuisine = probedCuisines[0] ?? null;
  const vibeDropCuisine = probedCuisines[1] ?? probedCuisines[0] ?? null;
  const usedVenueIds = new Set<string>();

  const cuisineDrop = pickVenue(pool, usedVenueIds, {
    cuisine: (cuisine) => !cuisine || !member.cuisines.includes(cuisine),
    reputation: (reputation) =>
      member.reputation === noPreferenceReputation ||
      reputation === member.reputation,
    vibe: (vibe) => vibe === member.vibe,
  });

  if (!cuisineDrop) {
    return null;
  }

  usedVenueIds.add(cuisineDrop.id);

  const reputationDrop = pickVenue(pool, usedVenueIds, {
    cuisine: (cuisine) =>
      reputationDropCuisine === null || cuisine === reputationDropCuisine,
    reputation: (reputation) =>
      member.reputation === noPreferenceReputation ||
      reputation !== member.reputation,
    vibe: (vibe) => vibe === member.vibe,
  });

  if (!reputationDrop) {
    return null;
  }

  usedVenueIds.add(reputationDrop.id);

  const vibeDrop = pickVenue(pool, usedVenueIds, {
    cuisine: (cuisine) => vibeDropCuisine === null || cuisine === vibeDropCuisine,
    reputation: (reputation) =>
      member.reputation === noPreferenceReputation ||
      reputation === member.reputation,
    vibe: (vibe) => vibe !== member.vibe,
  });

  if (!vibeDrop) {
    return null;
  }

  return [
    { venue: cuisineDrop, droppedAxis: "cuisine" },
    { venue: reputationDrop, droppedAxis: "reputation" },
    { venue: vibeDrop, droppedAxis: "vibe" },
  ];
}

export function q5CardsToCandidates(cards: Q5FactorialCard[]): Q5Candidate[] {
  return cards.map((card) => ({
    id: card.venue.id,
    name: card.venue.name,
    meta: metaString(card.venue),
    droppedAxis: card.droppedAxis,
  }));
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
  rules: {
    cuisine: (cuisine: string | null) => boolean;
    reputation: (reputation: string) => boolean;
    vibe: (vibe: number) => boolean;
  },
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
