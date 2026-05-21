// GetToIt web — web-01 re-click surfaces tests (tb-WF-12).
//
// The three terminal-or-card surfaces the shell renders on a re-click,
// plus the leave-confirm sheet:
//   * §C `WebVerdictCard`     — read-only verdict card for a decided
//     Plan: plan name + verdict venue, no CTA.
//   * §D `PlanClosedTerminal` — "this plan is closed" terminal for an
//     unresolved membership.
//   * §E `PlanLeftTerminal`   — "you left this plan" terminal.
//   * §E `LeaveConfirmSheet`  — the confirm step reusing the locked
//     `joinedLeave` copy from surfaces/00-plan-list.md.
//
// Spec: design-system/surfaces/web-01-invitee-shell.md §C / §D / §E.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import {
  LeaveConfirmSheet,
  PlanClosedTerminal,
  PlanLeftTerminal,
  WebVerdictCard,
} from "./InviteShellSurfaces";

// ── §C WebVerdictCard ───────────────────────────────────────────────

describe("WebVerdictCard (web-01 §C)", () => {
  it("renders the locked eyebrow, the plan name, and the verdict venue", () => {
    render(
      <WebVerdictCard planName="Friday dinner" verdictPlaceName="Ren Soba" />,
    );
    expect(screen.getByText(/tonight's verdict/i)).toBeInTheDocument();
    expect(screen.getByText("Friday dinner")).toBeInTheDocument();
    expect(screen.getByText("Ren Soba")).toBeInTheDocument();
  });

  it("has no primary CTA — the card is terminal-by-completion", () => {
    render(<WebVerdictCard planName="Plan" verdictPlaceName="Venue" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders on the verdict gradient stop", () => {
    render(<WebVerdictCard planName="Plan" verdictPlaceName="Venue" />);
    expect(
      screen.getByTestId("gradient-surface-verdict"),
    ).toBeInTheDocument();
  });
});

// ── §D PlanClosedTerminal ───────────────────────────────────────────

describe("PlanClosedTerminal (web-01 §D)", () => {
  it("renders the locked headline and body copy", () => {
    render(<PlanClosedTerminal />);
    expect(screen.getByText(/this plan is closed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/ask whoever shared it to start a new one/i),
    ).toBeInTheDocument();
  });

  it("has no CTA — there is no path the invitee can take", () => {
    render(<PlanClosedTerminal />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders on the calm midnight gradient — never a red error register", () => {
    render(<PlanClosedTerminal />);
    expect(
      screen.getByTestId("gradient-surface-midnight"),
    ).toBeInTheDocument();
  });
});

// ── §E PlanLeftTerminal ─────────────────────────────────────────────

describe("PlanLeftTerminal (web-01 §E)", () => {
  it("renders the locked headline and body copy", () => {
    render(<PlanLeftTerminal />);
    expect(screen.getByText(/you left this plan/i)).toBeInTheDocument();
    expect(
      screen.getByText(/tap the link again any time to rejoin/i),
    ).toBeInTheDocument();
  });

  it("has no CTA — re-clicking the link is the rejoin path", () => {
    render(<PlanLeftTerminal />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders on the midnight gradient", () => {
    render(<PlanLeftTerminal />);
    expect(
      screen.getByTestId("gradient-surface-midnight"),
    ).toBeInTheDocument();
  });
});

// ── §E LeaveConfirmSheet ────────────────────────────────────────────

describe("LeaveConfirmSheet (web-01 §E)", () => {
  it("renders the verbatim locked joinedLeave confirm copy", () => {
    render(<LeaveConfirmSheet onConfirm={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText("Leave this plan?")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your answers will be removed. The room continues for everyone else.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /leave plan/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stay/i })).toBeInTheDocument();
  });

  it("calls onConfirm when 'Leave plan' is tapped", () => {
    const onConfirm = vi.fn();
    render(<LeaveConfirmSheet onConfirm={onConfirm} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /leave plan/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when 'STAY' is tapped", () => {
    const onDismiss = vi.fn();
    render(<LeaveConfirmSheet onConfirm={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /stay/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss when the backdrop is tapped", () => {
    const onDismiss = vi.fn();
    render(<LeaveConfirmSheet onConfirm={vi.fn()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId("leave-confirm-backdrop"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("disables both actions while the leave is in flight", () => {
    render(
      <LeaveConfirmSheet onConfirm={vi.fn()} onDismiss={vi.fn()} leaving />,
    );
    expect(
      screen.getByRole("button", { name: /leaving/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /stay/i })).toBeDisabled();
  });
});
