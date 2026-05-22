// GetToIt web — v1.1 quiz helper unit tests (tb-WF-10).

import { describe, expect, it } from "vitest";

import {
  BUDGET_TIERS,
  buildVoteRow,
  CUISINE_CAP,
  CUISINE_OPTIONS,
  hasFreeCuisineSlot,
  REPUTATION_NO_PREFERENCE,
  REPUTATION_OPTIONS,
  toggleCuisine,
  toggleCuisineNoPreference,
  VIBE_LABELS,
  type CuisineSelection,
} from "./quiz";

const EMPTY: CuisineSelection = { cuisines: new Set(), noPreference: false };

describe("toggleCuisine", () => {
  it("adds a cuisine that isn't selected", () => {
    const next = toggleCuisine(EMPTY, "mexican");
    expect(Array.from(next.cuisines)).toEqual(["mexican"]);
    expect(next.noPreference).toBe(false);
  });

  it("removes a cuisine that's already selected", () => {
    const next = toggleCuisine(
      { cuisines: new Set(["mexican"]), noPreference: false },
      "mexican",
    );
    expect(next.cuisines.size).toBe(0);
  });

  it("clears the No-preference flag when a cuisine is selected", () => {
    const next = toggleCuisine(
      { cuisines: new Set(), noPreference: true },
      "thai",
    );
    expect(next.noPreference).toBe(false);
    expect(Array.from(next.cuisines)).toEqual(["thai"]);
  });

  it("caps selection at 3 — a 4th pick is a no-op", () => {
    const three: CuisineSelection = {
      cuisines: new Set(["mexican", "thai", "italian"]),
      noPreference: false,
    };
    const next = toggleCuisine(three, "japanese");
    expect(next).toBe(three); // unchanged
    expect(next.cuisines.size).toBe(CUISINE_CAP);
  });

  it("deselecting always works even at the cap", () => {
    const three: CuisineSelection = {
      cuisines: new Set(["mexican", "thai", "italian"]),
      noPreference: false,
    };
    const next = toggleCuisine(three, "thai");
    expect(next.cuisines.size).toBe(2);
  });
});

describe("toggleCuisineNoPreference", () => {
  it("selecting No preference clears every cuisine", () => {
    const next = toggleCuisineNoPreference({
      cuisines: new Set(["mexican", "thai"]),
      noPreference: false,
    });
    expect(next.noPreference).toBe(true);
    expect(next.cuisines.size).toBe(0);
  });

  it("re-tapping No preference clears it", () => {
    const next = toggleCuisineNoPreference({
      cuisines: new Set(),
      noPreference: true,
    });
    expect(next.noPreference).toBe(false);
  });
});

describe("hasFreeCuisineSlot", () => {
  it("is false once the 3-cap is reached", () => {
    expect(
      hasFreeCuisineSlot({
        cuisines: new Set(["mexican", "thai", "italian"]),
        noPreference: false,
      }),
    ).toBe(false);
  });
  it("is true below the cap", () => {
    expect(hasFreeCuisineSlot(EMPTY)).toBe(true);
  });
});

describe("buildVoteRow", () => {
  it("emits the generic q1..q5 jsonb slots, not the v1 typed columns", () => {
    const row = buildVoteRow({
      roomId: "00000000-0000-0000-0000-000000000aaa",
      userId: "00000000-0000-0000-0000-000000000bbb",
      cuisines: new Set(["thai", "mexican"]),
      noPreference: false,
      budget: 2,
      reputation: "popular",
      vibe: 3,
      q5Ratings: [
        { droppedAxis: "cuisine", score: 5 },
        { droppedAxis: "reputation", score: 2 },
        { droppedAxis: "vibe", score: 4 },
      ],
    });
    expect(row.room_id).toBe("00000000-0000-0000-0000-000000000aaa");
    expect(row.user_id).toBe("00000000-0000-0000-0000-000000000bbb");
    // Generic envelope shape — no q1_vetoes / q3_walk_minutes columns.
    expect(row.q1.meta.question_kind).toBe("cuisine_craving");
    expect(row.q1.answer.cuisines).toEqual(["mexican", "thai"]); // sorted
    expect(row.q2.meta.question_kind).toBe("budget_cap");
    expect(row.q2.answer.tier).toBe(2);
    expect(row.q3.meta.question_kind).toBe("reputation");
    expect(row.q3.answer.reputation).toBe("popular");
    expect(row.q4.meta.question_kind).toBe("vibe");
    expect(row.q4.answer.level).toBe(3);
    expect(row.q5.meta.question_kind).toBe("regret");
    expect(row.q5.answer.ratings).toHaveLength(3);
    // No retired v1 columns leak onto the row. `VoteRow` has no index
    // signature, so the cast routes through `unknown` to probe for
    // off-type keys without TypeScript rejecting it as a non-overlap.
    const rowKeys = row as unknown as Record<string, unknown>;
    expect(rowKeys.q1_vetoes).toBeUndefined();
    expect(rowKeys.q3_walk_minutes).toBeUndefined();
  });

  it("writes an empty cuisine set when No preference is chosen", () => {
    const row = buildVoteRow({
      roomId: "r",
      userId: "u",
      cuisines: new Set(["thai"]),
      noPreference: true,
      budget: 4,
      reputation: REPUTATION_NO_PREFERENCE,
      vibe: 2,
      q5Ratings: [],
    });
    expect(row.q1.answer.cuisines).toEqual([]);
  });
});

describe("schema invariants", () => {
  it("uses the v1.1 vibe vocabulary, not the retired v1 labels", () => {
    expect(VIBE_LABELS).toEqual(["QUIET", "CHILL", "SOCIAL", "LIVELY", "ROWDY"]);
  });

  it("has the canonical 8 cuisine options", () => {
    expect(CUISINE_OPTIONS).toHaveLength(8);
    expect(CUISINE_OPTIONS.map((c) => c.id)).toContain("mexican");
  });

  it("has the canonical 5 reputation chips including No preference", () => {
    expect(REPUTATION_OPTIONS).toHaveLength(5);
    expect(REPUTATION_OPTIONS.map((r) => r.id)).toContain(REPUTATION_NO_PREFERENCE);
  });

  it("has the canonical 4 budget tiers", () => {
    expect(BUDGET_TIERS.map((t) => t.tier)).toEqual([1, 2, 3, 4]);
  });
});
