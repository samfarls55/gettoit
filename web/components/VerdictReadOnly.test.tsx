// GetToIt web — VerdictReadOnly render test (web-01 §C).
//
// Proves the web invitee verdict surface conforms to the locked
// verdict card": eyebrow, plan name, the verdict venue card, and the
// "Getting the app?" mint line — and nothing else (bug-17). No
// receipts, no cuts drawer, no rule text, no time badge, no primary
// CTA.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { VerdictView } from "../lib/verdict";

import { VerdictReadOnly } from "./VerdictReadOnly";

const defaultView: VerdictView = {
  mode: "default",
  planName: "Friday dinner",
  verdictPlaceName: "Pico's Taqueria",
};

const noSurvivorView: VerdictView = {
  mode: "no-survivor",
  planName: "Friday dinner",
};

describe("VerdictReadOnly — default (web-01 §C)", () => {
  it("renders the eyebrow, plan name and verdict venue card", () => {
    render(<VerdictReadOnly view={defaultView} />);
    expect(screen.getByText(/tonight's verdict/i)).toBeInTheDocument();
    expect(screen.getByText("Friday dinner")).toBeInTheDocument();
    expect(screen.getByTestId("web-verdict-venue")).toHaveTextContent(
      "Pico's Taqueria",
    );
  });

  it("renders on the verdict gradient stop", () => {
    render(<VerdictReadOnly view={defaultView} />);
    expect(
      screen.getByTestId("gradient-surface-verdict"),
    ).toBeInTheDocument();
  });

  it("renders no receipts, no cuts drawer, no rule text and no time badge", () => {
    render(<VerdictReadOnly view={defaultView} />);
    // §C — plan name + venue only. All of the TB-15-era machinery is
    // gone.
    expect(screen.queryByTestId("verdict-receipts")).toBeNull();
    expect(screen.queryByTestId("verdict-cuts-open")).toBeNull();
    expect(screen.queryByTestId("verdict-cuts-list")).toBeNull();
    expect(screen.queryByTestId("verdict-rule")).toBeNull();
    expect(screen.queryByText("7:00 PM")).toBeNull();
  });

  it("has no primary CTA — the card is terminal-by-completion", () => {
    render(<VerdictReadOnly view={defaultView} />);
    // No "Start a new decision" / ratify / reroll affordance.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/start a new decision/i)).toBeNull();
  });
});

describe("VerdictReadOnly — no-survivor (web-01 §C, bug-17 minimal variant)", () => {
  it("renders the plan name + a 'No spot fits' venue card", () => {
    render(<VerdictReadOnly view={noSurvivorView} />);
    expect(screen.getByText("Friday dinner")).toBeInTheDocument();
    expect(screen.getByTestId("web-verdict-venue")).toHaveTextContent(
      "No spot fits",
    );
  });

  it("renders no votes-derived meta line and no primary CTA", () => {
    render(<VerdictReadOnly view={noSurvivorView} />);
    expect(screen.queryByTestId("verdict-meta")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("VerdictReadOnly — 'Getting the app?' mint line", () => {
  it("omits the mint affordance when onMintClaimCode is absent", () => {
    render(<VerdictReadOnly view={defaultView} />);
    expect(
      screen.queryByTestId("web-verdict-getting-the-app"),
    ).toBeNull();
  });

  it("renders the mint affordance on both variants when wired", () => {
    const { rerender } = render(
      <VerdictReadOnly view={defaultView} onMintClaimCode={vi.fn()} />,
    );
    expect(
      screen.getByTestId("web-verdict-getting-the-app"),
    ).toBeInTheDocument();

    rerender(
      <VerdictReadOnly view={noSurvivorView} onMintClaimCode={vi.fn()} />,
    );
    expect(
      screen.getByTestId("web-verdict-getting-the-app"),
    ).toBeInTheDocument();
  });

  it("mints a claim code from the verdict surface on tap", async () => {
    const onMintClaimCode = vi.fn().mockResolvedValue("MINT2345");
    render(
      <VerdictReadOnly
        view={defaultView}
        onMintClaimCode={onMintClaimCode}
      />,
    );
    // Lazy — not minted until the affordance is tapped.
    expect(onMintClaimCode).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: /getting the app\?/i }),
    );
    expect(onMintClaimCode).toHaveBeenCalledTimes(1);
    const code = await screen.findByTestId("getting-the-app-code");
    expect(code).toHaveTextContent("MINT2345");
  });
});
