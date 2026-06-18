import {
  type GoogleOpeningPeriod,
  type GoogleTargetOpenTime,
  isOpenAtGoogleTargetTime,
} from "./google-opening-hours.ts";

export interface HardEligibilityCandidate {
  id: string;
  google_place_id?: string;
  price_tier: number | null;
  dietary_tags: string[];
  categories: string[];
  distance_meters?: number | null;
  rating?: number | null;
  total_ratings?: number | null;
  user_rating_count?: number | null;
  current_open_now?: boolean | null;
  regular_opening_periods?: GoogleOpeningPeriod[];
  dine_in?: boolean | null;
  takeout?: boolean | null;
}

export interface HardVeto {
  kind: "dietary" | "cuisine_never" | "tag";
  token: string;
}

export interface HardEligibilityVote {
  q1_vetoes: string[];
  q2_budget: number;
  hard_vetoes: HardVeto[];
}

export interface HardEligibilityRoom {
  meal_timing?: { target_open_time?: GoogleTargetOpenTime | null };
  service_shape?: "dineIn" | "takeout" | null;
  radius_meters?: number | null;
}

export type HardEligibilityCutReason =
  | "metadata"
  | "budget"
  | "availability"
  | "dietary"
  | "veto"
  | "radius"
  | "crowd_floor";

export interface HardEligibilityCut {
  option_id: string;
  cut_reason: HardEligibilityCutReason;
  cut_text: string;
}

export type HardEligibilityResult =
  | { eligible: true }
  | { eligible: false; cut: HardEligibilityCut };

export interface DietaryRequirement {
  chip: string;
  requiredTag: string;
  label: string;
}

interface MemberHardConstraints {
  dietaryRequirements: DietaryRequirement[];
  requiredRawTags: Set<string>;
  cuisineNevers: Set<string>;
}

const GOOGLE_CROWD_FLOOR = Object.freeze({
  minRating: 3.7,
  minUserRatingCount: 15,
});

const DIETARY_REQUIREMENTS: readonly DietaryRequirement[] = Object.freeze([
  { chip: "vegan", requiredTag: "vegan_friendly", label: "vegan options" },
  {
    chip: "vegetarian",
    requiredTag: "vegetarian_friendly",
    label: "vegetarian options",
  },
  { chip: "halal", requiredTag: "halal", label: "halal options" },
  { chip: "kosher", requiredTag: "kosher", label: "kosher options" },
  {
    chip: "gluten",
    requiredTag: "gluten_free_options",
    label: "gluten-free options",
  },
  {
    chip: "dairy",
    requiredTag: "no_dairy_unverified",
    label: "dairy-safe options",
  },
  {
    chip: "shellfish",
    requiredTag: "no_shellfish_unverified",
    label: "shellfish-safe options",
  },
  {
    chip: "nuts",
    requiredTag: "no_nuts_unverified",
    label: "nut-safe options",
  },
]);

const NO_OP_CHIPS: ReadonlySet<string> = new Set([
  "nothing_tonight",
  "nothing tonight",
  "nothing",
  "none",
  "no_preference",
]);

export function lookupDietaryRequirement(
  chip: string,
): DietaryRequirement | undefined {
  const normalized = chip.trim().toLowerCase();
  if (NO_OP_CHIPS.has(normalized)) return undefined;
  return DIETARY_REQUIREMENTS.find((r) => r.chip === normalized);
}

export function evaluateHardEligibility(input: {
  candidate: HardEligibilityCandidate;
  votes: readonly HardEligibilityVote[];
  room?: HardEligibilityRoom;
}): HardEligibilityResult {
  const { candidate, votes } = input;
  const room = input.room ?? {};
  const isGoogleCandidate = typeof candidate.google_place_id === "string" &&
    candidate.google_place_id.trim().length > 0;

  if (
    room.radius_meters !== null &&
    room.radius_meters !== undefined &&
    typeof candidate.distance_meters === "number" &&
    candidate.distance_meters > room.radius_meters
  ) {
    return cut(candidate.id, "radius", "outside the Search area");
  }

  if (isGoogleCandidate && typeof candidate.price_tier !== "number") {
    return cut(candidate.id, "metadata", "missing required provider metadata");
  }

  if (isGoogleCandidate) {
    if (
      typeof candidate.rating !== "number" ||
      typeof candidate.user_rating_count !== "number"
    ) {
      return cut(
        candidate.id,
        "metadata",
        "missing required provider metadata",
      );
    }
    if (
      candidate.rating < GOOGLE_CROWD_FLOOR.minRating ||
      candidate.user_rating_count < GOOGLE_CROWD_FLOOR.minUserRatingCount
    ) {
      return cut(candidate.id, "crowd_floor", "below the crowd approval floor");
    }
  }

  if (!passesAvailability(candidate, room, isGoogleCandidate)) {
    return cut(candidate.id, "availability", "unavailable for this Plan");
  }

  const lowestBudgetCap = votes.reduce(
    (acc, vote) => Math.min(acc, vote.q2_budget),
    Number.POSITIVE_INFINITY,
  );
  if (
    Number.isFinite(lowestBudgetCap) &&
    typeof candidate.price_tier === "number" &&
    candidate.price_tier > lowestBudgetCap
  ) {
    return cut(candidate.id, "budget", "over the budget cap");
  }

  const constraints = buildMemberHardConstraints(votes);
  const missingDietaryRequirement = constraints.dietaryRequirements.find(
    (requirement) => !candidate.dietary_tags.includes(requirement.requiredTag),
  );
  if (missingDietaryRequirement) {
    return cut(
      candidate.id,
      "dietary",
      `${missingDietaryRequirement.chip} veto`,
    );
  }

  for (const tag of constraints.requiredRawTags) {
    if (!candidate.dietary_tags.includes(tag)) {
      return cut(candidate.id, "veto", "fails an allergy veto");
    }
  }

  const lowerCategories = candidate.categories.map((category) =>
    category.toLowerCase()
  );
  for (const token of constraints.cuisineNevers) {
    if (lowerCategories.some((category) => category.includes(token))) {
      return cut(candidate.id, "veto", "cuisine vetoed");
    }
  }

  return { eligible: true };
}

function cut(
  optionId: string,
  cutReason: HardEligibilityCutReason,
  cutText: string,
): HardEligibilityResult {
  return {
    eligible: false,
    cut: {
      option_id: optionId,
      cut_reason: cutReason,
      cut_text: cutText,
    },
  };
}

function buildMemberHardConstraints(
  votes: readonly HardEligibilityVote[],
): MemberHardConstraints {
  const dietaryRequirements: DietaryRequirement[] = [];
  const addDietaryRequirement = (chip: string) => {
    const requirement = lookupDietaryRequirement(chip);
    if (
      requirement &&
      !dietaryRequirements.find((existing) =>
        existing.chip === requirement.chip
      )
    ) {
      dietaryRequirements.push(requirement);
    }
  };
  const requiredRawTags = new Set<string>();
  const cuisineNevers = new Set<string>();

  for (const vote of votes) {
    for (const chip of vote.q1_vetoes) addDietaryRequirement(chip);
    for (const veto of vote.hard_vetoes) {
      switch (veto.kind) {
        case "dietary":
          addDietaryRequirement(veto.token);
          break;
        case "tag": {
          const token = veto.token.trim();
          if (token.length > 0) requiredRawTags.add(token);
          break;
        }
        case "cuisine_never": {
          const token = veto.token.trim().toLowerCase();
          if (token.length > 0) cuisineNevers.add(token);
          break;
        }
      }
    }
  }

  return { dietaryRequirements, requiredRawTags, cuisineNevers };
}

function passesAvailability(
  candidate: HardEligibilityCandidate,
  room: HardEligibilityRoom,
  googleCandidate: boolean,
): boolean {
  const targetOpenTime = room.meal_timing?.target_open_time ?? null;
  if (targetOpenTime) {
    return isOpenAtGoogleTargetTime(
      candidate.regular_opening_periods,
      targetOpenTime,
    ) &&
      passesServiceMode(candidate, room.service_shape);
  }

  const shouldCheckCurrentHours = googleCandidate ||
    room.service_shape === "dineIn" ||
    room.service_shape === "takeout" ||
    !!room.meal_timing;
  if (shouldCheckCurrentHours) {
    return false;
  }

  return passesServiceMode(candidate, room.service_shape);
}

function passesServiceMode(
  candidate: HardEligibilityCandidate,
  serviceShape: HardEligibilityRoom["service_shape"],
): boolean {
  if (serviceShape === "dineIn" && candidate.dine_in !== true) {
    return false;
  }
  if (serviceShape === "takeout" && candidate.takeout === false) {
    return false;
  }
  return true;
}
