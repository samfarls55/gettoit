// GetToIt web — SunsetPop component tests.
//
// wfr-18. The GTIMark wordmark renders on every surface that mounts the
// invite/quiz/verdict shells (NameEntry, InviteShell, InviteShellSurfaces,
// WaitingScreen). Before this change the mark was a non-interactive
// <div> stack so users had no way to escape to the landing surface.
// Wrapping the GTIMark output in a Next.js <Link href="/"> turns the
// wordmark into a global home affordance without changing its visual
// shape — the inner tile + "GetToIt" lockup is untouched.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { GTIMark } from "./SunsetPop";

describe("GTIMark", () => {
  it("renders as a link pointing to /", () => {
    render(<GTIMark />);
    const link = screen.getByRole("link", { name: /gettoit/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("exposes an accessible label naming GetToIt as the home destination", () => {
    render(<GTIMark />);
    const link = screen.getByRole("link", { name: /gettoit/i });
    // aria-label or accessible name should communicate that activating
    // the wordmark navigates to the landing surface.
    expect(link).toHaveAccessibleName(/gettoit/i);
  });

  it("still renders the GetToIt wordmark text", () => {
    render(<GTIMark />);
    expect(screen.getByText("GetToIt")).toBeInTheDocument();
  });
});
