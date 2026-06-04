import {
  generateQ5FactorialCards,
  q5CardsToCandidates,
  type Q5MemberProfile,
  type Q5PoolVenue,
} from "../src/quiz/q5Factorial";

function venue(
  id: string,
  cuisine: string | null,
  reputation: string,
  vibe: number,
): Q5PoolVenue {
  return {
    id,
    name: id,
    categories: cuisine ? [cuisine] : [],
    priceTier: 2,
    walkMinutesEstimate: 8,
    profile: { cuisine, reputation, vibe },
  };
}

const mexicanSocialPopular: Q5MemberProfile = {
  cuisines: ["mexican"],
  reputation: "popular",
  vibe: 2,
};

describe("generateQ5FactorialCards", () => {
  it("generates three real cards that each drop exactly one axis", () => {
    const cards = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      pool: [
        venue("cuisine-drop", "thai", "popular", 2),
        venue("reputation-drop", "mexican", "hiddenGem", 2),
        venue("vibe-drop", "mexican", "popular", 4),
        venue("perfect-match", "mexican", "popular", 2),
      ],
    });

    expect(cards).not.toBeNull();
    expect(cards?.map((card) => card.droppedAxis).sort()).toEqual([
      "cuisine",
      "reputation",
      "vibe",
    ]);
    expect(cards?.map((card) => card.venue.id)).not.toContain(
      "perfect-match",
    );
    expect(new Set(cards?.map((card) => card.venue.id))).toHaveProperty(
      "size",
      3,
    );
  });

  it("returns null for empty or invalid pools instead of placeholder venues", () => {
    expect(
      generateQ5FactorialCards({
        member: mexicanSocialPopular,
        pool: [],
      }),
    ).toBeNull();

    expect(
      generateQ5FactorialCards({
        member: mexicanSocialPopular,
        pool: [
          venue("only-one", "thai", "popular", 2),
          venue("dummy-placeholder", "mexican", "hiddenGem", 2),
          venue("all-same-vibe", "mexican", "popular", 2),
        ],
      }),
    ).toBeNull();
  });

  it("shapes cards into candidate rows with real ids and venue meta", () => {
    const cards = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      pool: [
        venue("fsq-cuisine", "thai", "popular", 2),
        venue("fsq-reputation", "mexican", "hiddenGem", 2),
        venue("fsq-vibe", "mexican", "popular", 4),
      ],
    });

    expect(cards).not.toBeNull();

    const candidates = q5CardsToCandidates(cards ?? []);

    expect(candidates).toEqual([
      expect.objectContaining({
        id: "fsq-cuisine",
        name: "fsq-cuisine",
        meta: "thai - $$ - 8 min",
        droppedAxis: "cuisine",
      }),
      expect.objectContaining({
        id: "fsq-reputation",
        droppedAxis: "reputation",
      }),
      expect.objectContaining({
        id: "fsq-vibe",
        droppedAxis: "vibe",
      }),
    ]);
    expect(candidates.some((candidate) => candidate.id.startsWith("dummy-"))).toBe(
      false,
    );
  });
});
