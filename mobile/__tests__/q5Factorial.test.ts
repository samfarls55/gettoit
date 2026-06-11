import {
  generateQ5FactorialCards,
  q5CardsToCandidates,
  replaceQ5FactorialCard,
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

  it("uses two selected-cuisine keep cards and one contrast card for one cuisine", () => {
    const cards = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      pool: [
        venue("contrast", "thai", "popular", 2),
        venue("keep-reputation", "mexican", "hiddenGem", 2),
        venue("keep-vibe", "mexican", "popular", 4),
        venue("unused-perfect", "mexican", "popular", 2),
      ],
    });

    expect(cards).not.toBeNull();
    expect(cards?.map((card) => card.venue.profile.cuisine)).toEqual([
      "thai",
      "mexican",
      "mexican",
    ]);
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

  it("uses deterministic app-owned shuffle keyed by member and q5 card set", () => {
    const pool = [
      venue("provider-third", "thai", "popular", 2),
      venue("provider-first", "mexican", "hiddenGem", 2),
      venue("provider-second", "mexican", "popular", 4),
    ];

    const first = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      memberId: "member-a",
      pool,
      q5CardSetId: "card-set-1",
    });
    const second = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      memberId: "member-a",
      pool: [...pool].reverse(),
      q5CardSetId: "card-set-1",
    });
    const differentCardSet = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      memberId: "member-a",
      pool,
      q5CardSetId: "card-set-2",
    });

    expect(first?.map((card) => card.venue.id)).toEqual(
      second?.map((card) => card.venue.id),
    );
    expect(first?.map((card) => card.venue.id)).not.toEqual(
      differentCardSet?.map((card) => card.venue.id),
    );
  });

  it("relaxes the vibe band for thin pools before giving up", () => {
    const cards = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      pool: [
        venue("contrast-vibe-relaxed", "thai", "popular", 1),
        venue("keep-reputation-vibe-relaxed", "mexican", "hiddenGem", 1),
        venue("keep-vibe-drop", "mexican", "popular", 4),
      ],
    });

    expect(cards).not.toBeNull();
    expect(cards?.map((card) => card.droppedAxis).sort()).toEqual([
      "cuisine",
      "reputation",
      "vibe",
    ]);
  });

  it("keeps missing vibe confidence eligible because atmosphere is a soft signal", () => {
    const cards = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      pool: [
        { ...venue("contrast", "thai", "popular", 2), profile: { cuisine: "thai", reputation: "popular", vibe: 2 } },
        { ...venue("keep-reputation", "mexican", "hiddenGem", 2), profile: { cuisine: "mexican", reputation: "hiddenGem", vibe: 2 } },
        { ...venue("keep-vibe", "mexican", "popular", 4), profile: { cuisine: "mexican", reputation: "popular", vibe: 4, vibeConfidence: 0 } },
      ],
    });

    expect(cards?.map((card) => card.venue.id)).toEqual([
      "contrast",
      "keep-reputation",
      "keep-vibe",
    ]);
  });

  it("preserves a visible slot when a same-axis replacement exists", () => {
    const cards = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      pool: [
        venue("contrast-failed", "thai", "popular", 2),
        venue("keep-reputation", "mexican", "hiddenGem", 2),
        venue("keep-vibe", "mexican", "popular", 4),
      ],
    });

    const result = replaceQ5FactorialCard({
      currentCards: cards ?? [],
      failedVenueId: "contrast-failed",
      member: mexicanSocialPopular,
      memberId: "member-a",
      pool: [
        venue("contrast-failed", "thai", "popular", 2),
        venue("contrast-replacement", "italian", "popular", 2),
        venue("keep-reputation", "mexican", "hiddenGem", 2),
        venue("keep-vibe", "mexican", "popular", 4),
      ],
      q5CardSetId: "card-set-1",
      retryCardSetId: "card-set-2",
    });

    expect(result.kind).toBe("replaced");
    if (result.kind === "replaced") {
      expect(result.cards[0].venue.id).toBe("contrast-replacement");
      expect(result.cards[0].droppedAxis).toBe("cuisine");
      expect(result.cards[1].venue.id).toBe("keep-reputation");
      expect(result.cards[2].venue.id).toBe("keep-vibe");
    }
  });

  it("returns one fresh retry before no-results when same-axis replacement is impossible", () => {
    const cards = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      pool: [
        venue("contrast-failed", "thai", "popular", 2),
        venue("keep-reputation", "mexican", "hiddenGem", 2),
        venue("keep-vibe", "mexican", "popular", 4),
      ],
    });

    const retry = replaceQ5FactorialCard({
      currentCards: cards ?? [],
      failedVenueId: "contrast-failed",
      member: mexicanSocialPopular,
      memberId: "member-a",
      pool: [
        venue("keep-reputation", "mexican", "hiddenGem", 2),
        venue("keep-vibe", "mexican", "popular", 4),
      ],
      retryPool: [
        venue("retry-contrast", "italian", "popular", 2),
        venue("retry-reputation", "mexican", "classic", 2),
        venue("retry-vibe", "mexican", "popular", 4),
      ],
      q5CardSetId: "card-set-1",
      retryCardSetId: "card-set-2",
    });
    const noResults = replaceQ5FactorialCard({
      currentCards: cards ?? [],
      failedVenueId: "contrast-failed",
      member: mexicanSocialPopular,
      pool: [venue("only-reputation", "mexican", "classic", 2)],
      q5CardSetId: "card-set-1",
      retryCardSetId: "card-set-2",
    });

    expect(retry.kind).toBe("retry");
    if (retry.kind === "retry") {
      expect(retry.cards.map((card) => card.venue.id).sort()).toEqual([
        "retry-contrast",
        "retry-reputation",
        "retry-vibe",
      ]);
    }
    expect(noResults.kind).toBe("no-results");
  });

  it("can shape Google-backed Q5 rows as name-only cards with attribution", () => {
    const cards = generateQ5FactorialCards({
      member: mexicanSocialPopular,
      pool: [
        { ...venue("google-cuisine", "thai", "popular", 2), name: "Thai Orchid", categories: [], attributionText: "Powered by Google" },
        { ...venue("google-reputation", "mexican", "hiddenGem", 2), name: "Casa Lupita", categories: [], attributionText: "Powered by Google" },
        { ...venue("google-vibe", "mexican", "popular", 4), name: "El Farol", categories: [], attributionText: "Powered by Google" },
      ],
    });

    expect(q5CardsToCandidates(cards ?? [])).toEqual([
      {
        id: "google-cuisine",
        name: "Thai Orchid",
        meta: "",
        attributionText: "Powered by Google",
        droppedAxis: "cuisine",
      },
      {
        id: "google-reputation",
        name: "Casa Lupita",
        meta: "",
        attributionText: "Powered by Google",
        droppedAxis: "reputation",
      },
      {
        id: "google-vibe",
        name: "El Farol",
        meta: "",
        attributionText: "Powered by Google",
        droppedAxis: "vibe",
      },
    ]);
  });
});
