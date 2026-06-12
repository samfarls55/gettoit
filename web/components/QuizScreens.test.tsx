// GetToIt web — redesigned quiz screen smoke tests (tb-WF-10).
//
// Stress-tests the controlled-state contract — every screen is a "dumb"
// rendering of (state, callbacks). The lifted state lives in
// `SessionRoom`; these tests prove each screen renders the canonical
// redesigned surface and surfaces the right callbacks.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { QuizCandidate } from "../lib/candidate-fetch";

import {
  QuizQ1Cuisine,
  QuizQ2Budget,
  QuizQ3Reputation,
  QuizQ4Vibe,
  QuizQ5,
} from "./QuizScreens";

const FACTORIAL_CARDS: QuizCandidate[] = [
  { id: "v-cuisine", name: "Pico's Taqueria", meta: "Mexican · $$ · 8 min", droppedAxis: "cuisine" },
  { id: "v-reputation", name: "Ren Soba House", meta: "Japanese · $$ · 12 min", droppedAxis: "crowd_approval" },
  { id: "v-vibe", name: "Bar Pastoral", meta: "Italian · $$ · 5 min", droppedAxis: "vibe" },
];

describe("QuizQ1Cuisine", () => {
  it("renders the approved cuisine chips plus No preference and toggles", () => {
    const calls: string[] = [];
    render(
      <QuizQ1Cuisine
        selection={{ cuisines: new Set(["mexican"]), noPreference: false }}
        onToggleCuisine={(c) => calls.push(c)}
        onToggleNoPreference={() => {}}
        onAdvance={() => {}}
      />,
    );
    for (const label of [
      "American",
      "Mexican",
      "Italian",
      "Japanese",
      "Chinese",
      "Thai",
      "Indian",
      "Mediterranean",
      "Middle Eastern",
      "Korean",
      "Vietnamese",
      "Seafood",
      "Comfort Food",
      "No preference",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText("Vegan")).toBeNull();
    expect(screen.queryByText("Breakfast")).toBeNull();
    fireEvent.click(screen.getByText("Italian"));
    expect(calls).toEqual(["italian"]);
  });

  it("disables unselected chips once the 3-cap is reached", () => {
    render(
      <QuizQ1Cuisine
        selection={{
          cuisines: new Set(["mexican", "thai", "italian"]),
          noPreference: false,
        }}
        onToggleCuisine={() => {}}
        onToggleNoPreference={() => {}}
        onAdvance={() => {}}
      />,
    );
    // An unselected chip at the cap is disabled.
    expect(screen.getByRole("button", { name: "Japanese" })).toBeDisabled();
    // A selected chip stays tappable (so it can be deselected).
    expect(screen.getByRole("button", { name: "Mexican" })).not.toBeDisabled();
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
    expect(screen.getByText("$$$$")).toBeInTheDocument();
    fireEvent.click(screen.getByText("$$"));
    expect(calls).toEqual([2]);
  });
});

describe("QuizQ3Reputation", () => {
  it("renders the five reputation chips and dispatches", () => {
    const calls: string[] = [];
    render(
      <QuizQ3Reputation
        value="no_preference"
        onSelect={(id) => calls.push(id)}
        onAdvance={() => {}}
      />,
    );
    for (const label of ["Popular", "Hidden gem", "Classic", "New", "No preference"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByText("Hidden gem"));
    expect(calls).toEqual(["hidden_gem"]);
  });
});

describe("QuizQ4Vibe", () => {
  it("renders the redesigned vibe vocabulary and the 5 stops", () => {
    const calls: number[] = [];
    render(
      <QuizQ4Vibe value={2} onSelect={(i) => calls.push(i)} onAdvance={() => {}} />,
    );
    // Redesigned vocabulary — SOCIAL is the mid-scale word, not the retired BUZZY.
    expect(screen.getByText("SOCIAL")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("vibe ROWDY"));
    expect(calls).toEqual([4]);
  });
});

// tb-WF-12 (web-01 §E) — the `Leave` affordance the web invitee shell
// wires onto the Q1–Q5 quiz chrome. It renders on the chrome's trailing
// slot only when an `onLeave` handler is passed; off the chrome, the
// existing quiz screens are unchanged.
describe("quiz-chrome Leave affordance (web-01 §E)", () => {
  it("renders a Leave control on Q1 when onLeave is provided", () => {
    const onLeave = vi.fn();
    render(
      <QuizQ1Cuisine
        selection={{ cuisines: new Set(), noPreference: false }}
        onToggleCuisine={() => {}}
        onToggleNoPreference={() => {}}
        onAdvance={() => {}}
        onLeave={onLeave}
      />,
    );
    const leave = screen.getByRole("button", { name: /^leave$/i });
    fireEvent.click(leave);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("omits the Leave control when onLeave is not provided", () => {
    render(
      <QuizQ1Cuisine
        selection={{ cuisines: new Set(), noPreference: false }}
        onToggleCuisine={() => {}}
        onToggleNoPreference={() => {}}
        onAdvance={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /^leave$/i })).toBeNull();
  });

  it("renders the Leave control on Q5 too", () => {
    const onLeave = vi.fn();
    render(
      <QuizQ5
        state="loading"
        candidates={[]}
        ratings={{}}
        onRate={() => {}}
        onSubmit={() => {}}
        onLeave={onLeave}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^leave$/i }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});

describe("QuizQ5", () => {
  it("renders the loading state while the candidate fetch is in flight", () => {
    render(
      <QuizQ5
        state="loading"
        candidates={[]}
        ratings={{}}
        onRate={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByTestId("quiz-q5-loading")).toBeInTheDocument();
  });

  it("renders the three factorial cards and dispatches rate events", () => {
    const calls: Array<[string, number]> = [];
    render(
      <QuizQ5
        state="default"
        candidates={FACTORIAL_CARDS}
        ratings={{ "v-cuisine": 3, "v-reputation": 3, "v-vibe": 3 }}
        onRate={(id, score) => calls.push([id, score])}
        onSubmit={() => {}}
      />,
    );
    for (const c of FACTORIAL_CARDS) {
      expect(screen.getByText(c.name)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByLabelText("Pico's Taqueria excitement 5"));
    expect(calls).toEqual([["v-cuisine", 5]]);
  });

  // wfr-23 — the Q5 default-state primary CTA reads "Drop the verdict",
  // a finish-shaped label that differs from the generic "Next" CTA used
  // on Q1..Q4. Locked-copy test defending against paraphrase drift —
  it("renders the finish-shaped 'Drop the verdict' CTA on the default state", () => {
    render(
      <QuizQ5
        state="default"
        candidates={FACTORIAL_CARDS}
        ratings={{}}
        onRate={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Drop the verdict" }),
    ).toBeInTheDocument();
    // The Q1..Q4 generic "Next" CTA must not appear on the final step.
    expect(screen.queryByRole("button", { name: /^Next$/i })).toBeNull();
  });

  it("renders the no-results honest-degradation mode without fictitious venues", () => {
    render(
      <QuizQ5
        state="no-results"
        candidates={[]}
        ratings={{}}
        onRate={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(screen.getByTestId("quiz-q5-no-results")).toBeInTheDocument();
    expect(screen.getByText("No spots to rate near you.")).toBeInTheDocument();
    // The no-results CTA, not the default "Drop the verdict".
    expect(
      screen.getByRole("button", { name: /head to the verdict/i }),
    ).toBeInTheDocument();
  });

  it("disables the CTA while submitting", () => {
    render(
      <QuizQ5
        state="default"
        candidates={FACTORIAL_CARDS}
        ratings={{}}
        onRate={() => {}}
        onSubmit={() => {}}
        submitting
      />,
    );
    expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
  });
});
