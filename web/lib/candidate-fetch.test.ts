// GetToIt web — per-member candidate fetch tests (tb-WF-10).
//
// Pins the redesigned Q5 candidate path: the N+1 fetch planner, the venue
// classifier, the strict-factorial card generator, and the end-to-end
// fetch. The factorial / classifier are faithful ports of the legacy
// Swift modules — active mobile implementation now lives in `mobile/`.
// These tests mirror `Q5FactorialCardGeneratorTests` /
// `Q5VenueClassifierTests`.

import { describe, expect, it } from "vitest";

import {
  buildQ5Ratings,
  classifyPool,
  fetchMemberCandidates,
  generateFactorialCards,
  openAtToken,
  planCalls,
  seedRatings,
  selectCandidates,
  unionResponses,
  type FetchedVenue,
  type MemberProfile,
  type PlacesProxyRequest,
  type PlacesProxyResponse,
  type PoolVenue,
} from "./candidate-fetch";

// -- venue fixtures --------------------------------------------------

function venue(over: Partial<FetchedVenue> & { fsq_place_id: string }): FetchedVenue {
  return {
    name: over.name ?? over.fsq_place_id,
    price_tier: over.price_tier ?? 2,
    walk_minutes_estimate: over.walk_minutes_estimate ?? 8,
    categories: over.categories ?? ["Restaurant"],
    rating: over.rating ?? 7.5,
    total_ratings: over.total_ratings ?? 100,
    date_created: over.date_created ?? "2020-01-01",
    tastes: over.tastes ?? [],
    fsq_place_id: over.fsq_place_id,
  };
}

/** A profiled pool venue, built directly (bypassing the classifier) so
 *  factorial tests control the axis profile exactly. */
function poolVenue(
  id: string,
  cuisine: string | null,
  reputation: string,
  vibe: number,
): PoolVenue {
  return {
    place: venue({ fsq_place_id: id, name: id }),
    profile: { cuisine, reputation, vibe },
  };
}

// -- planner ---------------------------------------------------------

describe("planCalls", () => {
  it("emits N cuisine calls plus one mandatory general call", () => {
    const specs = planCalls({
      cuisines: ["mexican", "thai"],
      budgetTier: 2,
      mealTime: "dinner",
      lat: 40.7,
      lng: -74,
      radiusMeters: 3219,
      timeZone: "America/New_York",
    });
    expect(specs).toHaveLength(3); // 2 cuisine + 1 general
    expect(specs[0].filters.cuisine).toBe("mexican");
    expect(specs[1].filters.cuisine).toBe("thai");
    expect(specs[2].filters.cuisine).toBeUndefined(); // general call
  });

  it("always emits the general call even with zero cuisines (bug-03 guard)", () => {
    const specs = planCalls({
      cuisines: [],
      budgetTier: 4,
      mealTime: "lunch",
      lat: 0,
      lng: 0,
      radiusMeters: 1000,
      timeZone: "UTC",
    });
    expect(specs).toHaveLength(1);
    expect(specs[0].filters.cuisine).toBeUndefined();
  });

  it("dedupes and caps cuisine calls at 3", () => {
    const specs = planCalls({
      cuisines: ["mexican", "mexican", "thai", "italian", "japanese"],
      budgetTier: 2,
      mealTime: "dinner",
      lat: 0,
      lng: 0,
      radiusMeters: 1000,
      timeZone: "UTC",
    });
    // 3 deduped/capped cuisine calls + 1 general.
    expect(specs).toHaveLength(4);
    expect(specs.slice(0, 3).map((s) => s.filters.cuisine)).toEqual([
      "mexican",
      "thai",
      "italian",
    ]);
  });

  it("clamps the budget tier into 1..4 on every spec", () => {
    const specs = planCalls({
      cuisines: ["thai"],
      budgetTier: 9,
      mealTime: "dinner",
      lat: 0,
      lng: 0,
      radiusMeters: 1000,
      timeZone: "UTC",
    });
    for (const s of specs) expect(s.filters.price_tier).toBe(4);
  });
});

describe("openAtToken", () => {
  it("resolves a meal time to a [1-7]THHMM token", () => {
    // 2026-05-21 is a Thursday ? Foursquare weekday 4. Dinner ? 19:00.
    const token = openAtToken("dinner", new Date("2026-05-21T12:00:00Z"), "UTC");
    expect(token).toBe("4T1900");
  });

  it("uses the meal's representative hour", () => {
    const breakfast = openAtToken("breakfast", new Date("2026-05-21T12:00:00Z"), "UTC");
    expect(breakfast).toBe("4T0900");
    const lateNight = openAtToken("late_night", new Date("2026-05-21T12:00:00Z"), "UTC");
    expect(lateNight).toBe("4T2230");
  });
});

// -- classifier ------------------------------------------------------

describe("classifyPool", () => {
  it("classifies cuisine by category keyword", () => {
    const pool = classifyPool([
      venue({ fsq_place_id: "a", categories: ["Taco Stand"] }),
      venue({ fsq_place_id: "b", categories: ["Sushi Restaurant"] }),
      venue({ fsq_place_id: "c", categories: ["Office"] }),
    ]);
    expect(pool[0].profile.cuisine).toBe("mexican");
    expect(pool[1].profile.cuisine).toBe("japanese");
    expect(pool[2].profile.cuisine).toBeNull();
  });

  it("classifies vibe from the category archetype", () => {
    const pool = classifyPool([
      venue({ fsq_place_id: "bar", categories: ["Cocktail Bar"] }),
      venue({ fsq_place_id: "cafe", categories: ["Coffee Shop"] }),
    ]);
    expect(pool[0].profile.vibe).toBe(3); // bar ? Lively
    expect(pool[1].profile.vibe).toBe(1); // cafe ? Chill
  });

  it("classifies a young record as new reputation", () => {
    const now = new Date("2026-05-21T00:00:00Z");
    const pool = classifyPool(
      [venue({ fsq_place_id: "fresh", date_created: "2026-03-01" })],
      now,
    );
    expect(pool[0].profile.reputation).toBe("new");
  });
});

// -- factorial generator ---------------------------------------------

/** A well-stocked pool: enough venues to furnish a valid triple for a
 *  mexican / popular / vibe-2 member. */
function wellStockedPool(): PoolVenue[] {
  return [
    // cuisine-drop candidate: non-mexican, popular, vibe 2.
    poolVenue("italian-pop-2", "italian", "popular", 2),
    // reputation-drop candidate: mexican, NOT popular, vibe 2.
    poolVenue("mex-classic-2", "mexican", "classic", 2),
    // vibe-drop candidate: mexican, popular, NOT vibe 2.
    poolVenue("mex-pop-4", "mexican", "popular", 4),
  ];
}

describe("generateFactorialCards", () => {
  const member: MemberProfile = {
    cuisines: ["mexican"],
    reputation: "popular",
    vibe: 2,
  };

  it("generates three cards, one per axis", () => {
    const cards = generateFactorialCards(member, wellStockedPool());
    expect(cards).not.toBeNull();
    expect(cards!.map((c) => c.droppedAxis).sort()).toEqual([
      "crowd_approval",
      "cuisine",
      "vibe",
    ]);
  });

  it("each card deviates only on its dropped axis", () => {
    const cards = generateFactorialCards(member, wellStockedPool())!;
    expect(cards[0].id).toBe("italian-pop-2"); // cuisine-drop
    expect(cards[1].id).toBe("mex-classic-2"); // reputation-drop
    expect(cards[2].id).toBe("mex-pop-4"); // vibe-drop
  });

  it("returns null when the pool cannot furnish a valid triple", () => {
    // Pool has only one venue — no factorial possible.
    const cards = generateFactorialCards(member, [
      poolVenue("solo", "italian", "popular", 2),
    ]);
    expect(cards).toBeNull();
  });
});

// -- union + selection -----------------------------------------------

describe("unionResponses", () => {
  it("dedupes venues first-seen by fsq_place_id", () => {
    const r1: PlacesProxyResponse = {
      places: [venue({ fsq_place_id: "a" }), venue({ fsq_place_id: "b" })],
      is_thin: false,
    };
    const r2: PlacesProxyResponse = {
      places: [venue({ fsq_place_id: "b" }), venue({ fsq_place_id: "c" })],
      is_thin: false,
    };
    const union = unionResponses([r1, r2]);
    expect(union.map((v) => v.fsq_place_id)).toEqual(["a", "b", "c"]);
  });
});

describe("selectCandidates", () => {
  it("degrades to no-results when the pool is too thin (ADR 0013)", () => {
    const result = selectCandidates(
      [venue({ fsq_place_id: "solo", categories: ["Restaurant"] })],
      { cuisines: ["mexican"], reputation: "popular", vibe: 2 },
    );
    expect(result.source).toBe("no-results");
    expect(result.candidates).toEqual([]);
    // The raw union still rides through for the verdict pool.
    expect(result.rawFetch).toHaveLength(1);
  });
});

// -- end-to-end fetch ------------------------------------------------

describe("fetchMemberCandidates", () => {
  const member: MemberProfile = {
    cuisines: ["mexican"],
    reputation: "popular",
    vibe: 2,
  };
  const context = {
    lat: 40.7,
    lng: -74,
    radiusMeters: 3219,
    timeZone: "UTC",
    mealTime: "dinner" as const,
  };

  it("resolves to no-results when the room has no coordinate", async () => {
    const result = await fetchMemberCandidates({
      member,
      budgetTier: 2,
      context: { ...context, lat: null, lng: null },
      caller: async () => ({ places: [], is_thin: true }),
    });
    expect(result.source).toBe("no-results");
    expect(result.candidates).toEqual([]);
  });

  it("never throws — a thrown call resolves to no-results", async () => {
    const result = await fetchMemberCandidates({
      member,
      budgetTier: 2,
      context,
      caller: async () => {
        throw new Error("network down");
      },
    });
    expect(result.source).toBe("no-results");
    expect(result.candidates).toEqual([]);
  });

  it("fires the N+1 calls and produces three factorial cards", async () => {
    const calls: PlacesProxyRequest[] = [];
    // A general call returns a varied pool that furnishes the factorial.
    // `date_created` 2024-06-01 keeps the high-volume venues "popular"
    // (older than 1yr so not "new", younger than 3yr so not "classic").
    const pool: FetchedVenue[] = [
      venue({ fsq_place_id: "italian-pop", categories: ["Italian Restaurant"], rating: 7.5, total_ratings: 300, date_created: "2024-06-01" }),
      venue({ fsq_place_id: "mex-gem", categories: ["Taco Stand"], rating: 8.5, total_ratings: 5, date_created: "2024-06-01" }),
      venue({ fsq_place_id: "mex-rowdy", categories: ["Mexican Restaurant", "Sports Bar"], rating: 7.5, total_ratings: 300, date_created: "2024-06-01" }),
    ];
    const result = await fetchMemberCandidates({
      member,
      budgetTier: 2,
      context,
      now: new Date("2026-05-21T00:00:00Z"),
      caller: async (req) => {
        calls.push(req);
        return { places: pool, is_thin: false };
      },
    });
    // mexican craved ? 1 cuisine call + 1 general call.
    expect(calls).toHaveLength(2);
    expect(result.source).toBe("fetched");
    expect(result.candidates).toHaveLength(3);
    expect(result.rawFetch).toHaveLength(3);
  });
});

// -- Q5 ratings assembly ---------------------------------------------

describe("buildQ5Ratings", () => {
  it("joins venue-keyed ratings to each card's droppedAxis", () => {
    const cards = [
      { id: "a", name: "A", meta: "", droppedAxis: "cuisine" as const },
      {
        id: "b",
        name: "B",
        meta: "",
        droppedAxis: "crowd_approval" as const,
      },
      { id: "c", name: "C", meta: "", droppedAxis: "vibe" as const },
    ];
    const ratings = buildQ5Ratings(cards, { a: 5, b: 2, c: 4 });
    expect(ratings).toEqual([
      { droppedAxis: "cuisine", score: 5 },
      { droppedAxis: "crowd_approval", score: 2 },
      { droppedAxis: "vibe", score: 4 },
    ]);
  });

  it("returns an empty probe when there are no candidates (no-results path)", () => {
    expect(buildQ5Ratings([], {})).toEqual([]);
  });

  it("seedRatings seeds every candidate at the midpoint 3", () => {
    const cards = [
      { id: "a", name: "A", meta: "", droppedAxis: "cuisine" as const },
    ];
    expect(seedRatings(cards)).toEqual({ a: 3 });
  });
});
