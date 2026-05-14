// GetToIt web — verdict shaping tests. Mirrors iOS `VerdictStore` unit
// tests so a mixed-platform room produces identical surfaces.

import { describe, expect, it } from "vitest";

import {
  actionFor,
  audienceCopy,
  displayName,
  metaLine,
  shapeVerdictView,
  survivingHardNeeds,
  type CutRow,
  type OptionRow,
  type VerdictRow,
  type VoteSummaryRow,
} from "./verdict";

const baseVote: VoteSummaryRow = {
  user_id: "00000000-0000-0000-0000-000000000111",
  q1_vetoes: [],
  q2_budget: 4,
  q3_walk_minutes: 30,
  q4_vibe: 2,
  q5_regret: {},
};

describe("actionFor", () => {
  it("returns 'wanted lively' for high vibe", () => {
    expect(actionFor({ ...baseVote, q4_vibe: 4 })).toBe("wanted lively");
  });

  it("returns 'wanted hushed' for vibe 0", () => {
    expect(actionFor({ ...baseVote, q4_vibe: 0 })).toBe("wanted hushed");
  });

  it("returns 'filtered <chip>' for a dietary veto", () => {
    expect(
      actionFor({ ...baseVote, q1_vetoes: ["shellfish"] }),
    ).toBe("filtered shellfish");
  });

  it("skips 'nothing_tonight' when looking for a chip", () => {
    expect(
      actionFor({
        ...baseVote,
        q1_vetoes: ["nothing_tonight"],
      }),
    ).toBe("voted in");
  });

  it("returns 'capped at $$' for a $$ tier", () => {
    expect(actionFor({ ...baseVote, q2_budget: 2 })).toBe("capped at $$");
  });

  it("returns 'capped at N min walk' for a short walk cap", () => {
    expect(
      actionFor({ ...baseVote, q3_walk_minutes: 15 }),
    ).toBe("capped at 15 min walk");
  });

  it("returns 'voted in' for the boring case", () => {
    expect(actionFor(baseVote)).toBe("voted in");
  });
});

describe("metaLine", () => {
  it("renders the meta line in the iOS order", () => {
    expect(
      metaLine({
        categories: ["Mexican"],
        price_tier: 2,
        walk_minutes_estimate: 8,
      }),
    ).toBe("Mexican · $$ · 8 min walk");
  });

  it("clamps an out-of-range price tier", () => {
    expect(metaLine({ price_tier: 7 })).toBe("$$$$");
  });

  it("returns empty when payload has nothing to render", () => {
    expect(metaLine({})).toBe("");
  });
});

describe("audienceCopy", () => {
  it("spells out small numbers", () => {
    expect(audienceCopy(4)).toBe("All four of you");
  });

  it("falls back to the digit form past eight", () => {
    expect(audienceCopy(12)).toBe("All 12 of you");
  });
});

describe("displayName", () => {
  it("renders the m-prefixed short id", () => {
    expect(
      displayName("a1b2c3d4-e5f6-7890-1234-567890abcdef"),
    ).toBe("ma1b2");
  });
});

describe("survivingHardNeeds", () => {
  it("collects dietary chips before budget and walk caps", () => {
    expect(
      survivingHardNeeds([
        {
          ...baseVote,
          user_id: "u1",
          q1_vetoes: ["vegan", "nothing_tonight"],
        },
        { ...baseVote, user_id: "u2", q2_budget: 2 },
        { ...baseVote, user_id: "u3", q3_walk_minutes: 10 },
      ]),
    ).toEqual(["vegan options", "$$ cap", "10 min walk"]);
  });

  it("returns an empty array when no constraints survive", () => {
    expect(survivingHardNeeds([baseVote])).toEqual([]);
  });
});

describe("shapeVerdictView", () => {
  const verdict: VerdictRow = {
    id: "v-1",
    room_id: "r-1",
    option_id: "o-1",
    computed_at: "2026-05-14T00:00:00Z",
    method: "manual",
    rule_text: "Budget cap cut Ren Soba.",
  };

  const winningOption: OptionRow = {
    id: "o-1",
    payload: {
      name: "Pico's Taqueria",
      categories: ["Mexican"],
      price_tier: 2,
      walk_minutes_estimate: 8,
    },
  };

  const cuts: CutRow[] = [
    {
      verdict_id: "v-1",
      option_id: "o-2",
      cut_reason: "budget",
      cut_text: "over budget cap",
    },
  ];

  const cutOptions: Record<string, OptionRow> = {
    "o-2": {
      id: "o-2",
      payload: { name: "Ren Soba", price_tier: 4 },
    },
  };

  it("builds a default-mode view from real rows", () => {
    const view = shapeVerdictView({
      verdict,
      winningOption,
      cuts,
      cutOptions,
      votes: [{ ...baseVote, user_id: "u1", q4_vibe: 4 }],
      memberCount: 3,
    });
    expect(view).not.toBeNull();
    expect(view?.mode).toBe("default");
    if (view?.mode !== "default") throw new Error("expected default mode");
    expect(view.placeName).toBe("Pico's Taqueria");
    expect(view.metaLine).toBe("Mexican · $$ · 8 min walk");
    expect(view.timeBadge.audience).toBe("All three of you");
    expect(view.ruleText).toBe("Budget cap cut Ren Soba.");
    expect(view.receipts).toEqual([
      { name: "mu1", action: "wanted lively" },
    ]);
    expect(view.cuts).toEqual([
      { name: "Ren Soba", reason: "over budget cap" },
    ]);
  });

  it("returns a no-survivor view when the engine emits no_survivor", () => {
    const view = shapeVerdictView({
      verdict: { ...verdict, method: "no_survivor", option_id: null },
      winningOption: null,
      cuts: [],
      cutOptions: {},
      votes: [
        {
          ...baseVote,
          user_id: "u1",
          q1_vetoes: ["vegan"],
          q3_walk_minutes: 10,
        },
      ],
      memberCount: 1,
    });
    expect(view?.mode).toBe("no-survivor");
    if (view?.mode !== "no-survivor") throw new Error("expected no-survivor");
    expect(view.placeName).toBe("No spot fits");
    expect(view.metaLine).toBe("vegan options · 10 min walk");
  });

  it("returns null when a non-no-survivor verdict has no winning option", () => {
    expect(
      shapeVerdictView({
        verdict,
        winningOption: null,
        cuts: [],
        cutOptions: {},
        votes: [],
        memberCount: 0,
      }),
    ).toBeNull();
  });
});
