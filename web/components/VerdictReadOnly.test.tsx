// GetToIt web — VerdictReadOnly render test.
//
// Proves the read-only verdict surface matches the iOS shape for the
// same backing data (TB-15 AC: "the web verdict renders the same
// content as the iOS verdict"). The shaping is unit-tested in
// `lib/verdict.test.ts`; this test is the surface-level smoke.

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { VerdictView } from "../lib/verdict";

import { VerdictReadOnly } from "./VerdictReadOnly";

const defaultView: VerdictView = {
  mode: "default",
  placeName: "Pico's Taqueria",
  metaLine: "Mexican · $$ · 8 min walk",
  timeBadge: { time: "7:00 PM", audience: "All four of you" },
  ruleText: "Budget cap cut Ren Soba.",
  receipts: [
    { name: "mu1", action: "wanted lively" },
    { name: "mu2", action: "filtered shellfish" },
  ],
  cuts: [{ name: "Ren Soba", reason: "over budget cap" }],
};

const noSurvivorView: VerdictView = {
  mode: "no-survivor",
  placeName: "No spot fits",
  metaLine: "vegan options · 10 min walk",
  ruleText:
    "Vegan options left no candidates within walking distance tonight.",
};

describe("VerdictReadOnly — default", () => {
  it("renders hero, meta, rule, receipts and the cuts drawer", () => {
    render(<VerdictReadOnly view={defaultView} />);
    expect(screen.getByTestId("verdict-hero")).toHaveTextContent(
      /pico's\s*taqueria/i,
    );
    expect(screen.getByTestId("verdict-meta")).toHaveTextContent(
      "Mexican · $$ · 8 min walk",
    );
    expect(screen.getByTestId("verdict-rule")).toHaveTextContent(
      "Budget cap cut Ren Soba.",
    );
    expect(screen.getByTestId("verdict-receipts")).toBeInTheDocument();
    // Receipt chips render their names.
    expect(screen.getByText("mu1")).toBeInTheDocument();
    expect(screen.getByText("mu2")).toBeInTheDocument();
    // Cuts drawer is closed by default; opens on click.
    expect(screen.queryByTestId("verdict-cuts-list")).toBeNull();
    fireEvent.click(screen.getByTestId("verdict-cuts-open"));
    expect(screen.getByTestId("verdict-cuts-list")).toBeInTheDocument();
    expect(screen.getByText("Ren Soba")).toBeInTheDocument();
  });

  it("has no ratification / reroll / check-in affordance per TB-15 read-only rule", () => {
    render(<VerdictReadOnly view={defaultView} />);
    // The iOS surface offers "I'm in" (committed) — we never render that copy.
    expect(screen.queryByText(/I'm in/i)).toBeNull();
    expect(screen.queryByText(/widen radius/i)).toBeNull();
    expect(screen.queryByText(/start over/i)).toBeNull();
  });
});

describe("VerdictReadOnly — no-survivor", () => {
  it("renders the no-survivor hero + rule without the time badge", () => {
    render(<VerdictReadOnly view={noSurvivorView} />);
    expect(screen.getByTestId("verdict-hero")).toHaveTextContent(/no spot/i);
    expect(screen.getByTestId("verdict-rule")).toHaveTextContent(
      /no candidates within walking distance/i,
    );
    expect(screen.queryByText("7:00 PM")).toBeNull();
    expect(screen.queryByTestId("verdict-receipts")).toBeNull();
    expect(screen.queryByTestId("verdict-cuts-open")).toBeNull();
  });
});
