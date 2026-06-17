// GetToIt web — verdict shaping tests.
//
// The web invitee verdict surface conforms to the locked
// `web-01-invitee-shell.md` §C "Read-only verdict card": plan name +
// verdict venue only (bug-17). These tests pin `shapeVerdictView` to
// that collapsed §C shape — no receipts, no cuts, no meta line.

import { describe, expect, it } from "vitest";

import {
  shapeVerdictView,
  NO_SURVIVOR_VENUE,
  type VerdictRow,
} from "./verdict";

describe("shapeVerdictView (web-01 §C)", () => {
  const verdict: VerdictRow = {
    id: "v-1",
    room_id: "r-1",
    option_id: "o-1",
    computed_at: "2026-05-14T00:00:00Z",
    method: "manual",
    rule_text: "Budget cap cut Ren Soba.",
  };

  it("builds a default-mode view — plan name + verdict venue only", () => {
    const view = shapeVerdictView({
      verdict,
      planName: "Friday dinner",
      verdictPlaceName: "Pico's Taqueria",
    });
    expect(view).not.toBeNull();
    if (view?.mode !== "default") throw new Error("expected default mode");
    expect(view.planName).toBe("Friday dinner");
    expect(view.verdictPlaceName).toBe("Pico's Taqueria");
  });

  it("carries no receipts, cuts, meta line, time badge or rule text", () => {
    const view = shapeVerdictView({
      verdict,
      planName: "Friday dinner",
      verdictPlaceName: "Pico's Taqueria",
    });
    // §C is plan name + venue only — the dead TB-15 shaping is gone.
    expect(view).not.toBeNull();
    expect(view).not.toHaveProperty("receipts");
    expect(view).not.toHaveProperty("cuts");
    expect(view).not.toHaveProperty("metaLine");
    expect(view).not.toHaveProperty("timeBadge");
    expect(view).not.toHaveProperty("ruleText");
  });

  it("returns null when current display refetch has no place name", () => {
    expect(
      shapeVerdictView({
        verdict,
        planName: "Friday dinner",
        verdictPlaceName: "",
      }),
    ).toBeNull();
  });

  it("returns a no-survivor view when the engine emits no_survivor", () => {
    const view = shapeVerdictView({
      verdict: { ...verdict, method: "no_survivor", option_id: null },
      planName: "Friday dinner",
      verdictPlaceName: null,
    });
    if (view?.mode !== "no-survivor") {
      throw new Error("expected no-survivor mode");
    }
    expect(view.planName).toBe("Friday dinner");
    // The no-survivor variant carries the plan name only — no
    // votes-derived hard-needs meta line.
    expect(view).not.toHaveProperty("verdictPlaceName");
    expect(view).not.toHaveProperty("metaLine");
  });

  it("returns null when a non-no-survivor verdict has no place name", () => {
    expect(
      shapeVerdictView({
        verdict,
        planName: "Friday dinner",
        verdictPlaceName: null,
      }),
    ).toBeNull();
  });

  it("exposes the 'No spot fits' venue copy constant", () => {
    expect(NO_SURVIVOR_VENUE).toBe("No spot fits");
  });
});
