// GetToIt web — quiz screen smoke tests.
//
// Stress-tests the controlled-state contract — every screen is a
// "dumb" rendering of (state, callbacks). The lifted state lives in
// `SessionRoom`; these tests prove each screen renders the canonical
// surface and surfaces the right callbacks.

import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { DUMMY_CANDIDATES, seedRegret } from "../lib/quiz";

import {
  QuizQ1Vetoes,
  QuizQ2Budget,
  QuizQ3Distance,
  QuizQ4Vibe,
  QuizQ5Regret,
} from "./QuizScreens";

describe("QuizQ1Vetoes", () => {
  it("renders all six chips and toggles via the callback", () => {
    const calls: string[] = [];
    render(
      <QuizQ1Vetoes
        selected={new Set(["shellfish"])}
        onToggle={(c) => calls.push(c)}
        onAdvance={() => {}}
      />,
    );
    // All six veto labels visible.
    for (const label of [
      "Gluten",
      "Dairy",
      "Shellfish",
      "Needs vegan options",
      "Halal-only",
      "Nothing tonight",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByText("Gluten"));
    expect(calls).toEqual(["gluten"]);
  });
});

describe("QuizQ2Budget", () => {
  it("renders the four tiers and dispatches on selection", () => {
    const calls: number[] = [];
    render(
      <QuizQ2Budget
        tier={1}
        onSelect={(t) => calls.push(t)}
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByText("$")).toBeInTheDocument();
    expect(screen.getByText("$$$$")).toBeInTheDocument();
    fireEvent.click(screen.getByText("$$"));
    expect(calls).toEqual([2]);
  });
});

describe("QuizQ3Distance", () => {
  it("renders the canonical 5-stop set and the active value", () => {
    const calls: number[] = [];
    render(
      <QuizQ3Distance
        value={15}
        onSelect={(v) => calls.push(v)}
        onAdvance={() => {}}
      />,
    );
    // "15" appears as the display value and as a stop button; assert
    // both presences by counting nodes via the role lookup.
    expect(screen.getAllByText("15").length).toBeGreaterThanOrEqual(2);
    fireEvent.click(screen.getByRole("button", { name: "30" }));
    expect(calls).toEqual([30]);
  });
});

describe("QuizQ4Vibe", () => {
  it("renders the current vibe word and the 5 stops", () => {
    const calls: number[] = [];
    render(
      <QuizQ4Vibe
        value={2}
        onSelect={(i) => calls.push(i)}
        onAdvance={() => {}}
      />,
    );
    expect(screen.getByText("BUZZY")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("vibe ROWDY"));
    expect(calls).toEqual([4]);
  });
});

describe("QuizQ5Regret", () => {
  it("renders each candidate and dispatches rate events", () => {
    const calls: Array<[string, number]> = [];
    render(
      <QuizQ5Regret
        candidates={DUMMY_CANDIDATES}
        ratings={seedRegret(DUMMY_CANDIDATES)}
        onRate={(id, score) => calls.push([id, score])}
        onSubmit={() => {}}
      />,
    );
    for (const c of DUMMY_CANDIDATES) {
      expect(screen.getByText(c.name)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByLabelText("Pico's Taqueria regret 5"));
    expect(calls).toEqual([["dummy-pico", 5]]);
  });

  it("disables the CTA while submitting", () => {
    render(
      <QuizQ5Regret
        candidates={DUMMY_CANDIDATES}
        ratings={seedRegret(DUMMY_CANDIDATES)}
        onRate={() => {}}
        onSubmit={() => {}}
        submitting
      />,
    );
    const cta = screen.getByRole("button", { name: /submitting/i });
    expect(cta).toBeDisabled();
  });
});
