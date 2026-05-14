// GetToIt web — quiz helper unit tests.

import { describe, expect, it } from "vitest";

import {
  BUDGET_TIERS,
  DUMMY_CANDIDATES,
  VETO_NOTHING,
  VETO_OPTIONS,
  VIBE_LABELS,
  WALK_STOPS,
  buildVoteRow,
  seedRegret,
  toggleVeto,
} from "./quiz";

describe("toggleVeto", () => {
  it("adds a chip that isn't selected", () => {
    expect(Array.from(toggleVeto(new Set(), "gluten")).sort()).toEqual([
      "gluten",
    ]);
  });

  it("removes a chip that's already selected", () => {
    expect(toggleVeto(new Set(["gluten"]), "gluten")).toEqual(new Set());
  });

  it("clears other chips when 'nothing_tonight' is selected", () => {
    expect(
      toggleVeto(new Set(["gluten", "dairy"]), VETO_NOTHING),
    ).toEqual(new Set([VETO_NOTHING]));
  });

  it("clears 'nothing_tonight' when another chip is selected", () => {
    expect(toggleVeto(new Set([VETO_NOTHING]), "gluten")).toEqual(
      new Set(["gluten"]),
    );
  });

  it("toggling 'nothing_tonight' off empties the set", () => {
    expect(toggleVeto(new Set([VETO_NOTHING]), VETO_NOTHING)).toEqual(
      new Set(),
    );
  });
});

describe("seedRegret", () => {
  it("seeds every candidate at the spec midpoint (3)", () => {
    expect(seedRegret(DUMMY_CANDIDATES)).toEqual({
      "dummy-pico": 3,
      "dummy-ren": 3,
      "dummy-pastoral": 3,
    });
  });
});

describe("buildVoteRow", () => {
  it("emits the wire shape the votes table expects", () => {
    const row = buildVoteRow({
      roomId: "00000000-0000-0000-0000-000000000aaa",
      userId: "00000000-0000-0000-0000-000000000bbb",
      q1Vetoes: new Set(["dairy", "gluten"]),
      q2Budget: 2,
      q3WalkMinutes: 15,
      q4Vibe: 3,
      q5Regret: { "dummy-pico": 5 },
    });
    expect(row).toEqual({
      room_id: "00000000-0000-0000-0000-000000000aaa",
      user_id: "00000000-0000-0000-0000-000000000bbb",
      q1_vetoes: ["dairy", "gluten"],
      q2_budget: 2,
      q3_walk_minutes: 15,
      q4_vibe: 3,
      q5_regret: { "dummy-pico": 5 },
    });
  });

  it("sorts vetoes deterministically", () => {
    const row = buildVoteRow({
      roomId: "00000000-0000-0000-0000-000000000aaa",
      userId: "00000000-0000-0000-0000-000000000bbb",
      q1Vetoes: new Set(["shellfish", "dairy", "gluten"]),
      q2Budget: 1,
      q3WalkMinutes: 10,
      q4Vibe: 2,
      q5Regret: {},
    });
    expect(row.q1_vetoes).toEqual(["dairy", "gluten", "shellfish"]);
  });
});

describe("schema invariants", () => {
  it("has the canonical 5 vibe labels", () => {
    expect(VIBE_LABELS).toEqual([
      "HUSHED",
      "MELLOW",
      "BUZZY",
      "LOUD",
      "ROWDY",
    ]);
  });

  it("has the canonical 6 veto options", () => {
    expect(VETO_OPTIONS).toHaveLength(6);
    expect(VETO_OPTIONS.map((v) => v.id)).toContain(VETO_NOTHING);
  });

  it("has the canonical 4 budget tiers", () => {
    expect(BUDGET_TIERS.map((t) => t.tier)).toEqual([1, 2, 3, 4]);
  });

  it("has the canonical 5 walk stops matching the migration check constraint", () => {
    expect(WALK_STOPS).toEqual([5, 10, 15, 20, 30]);
  });
});
