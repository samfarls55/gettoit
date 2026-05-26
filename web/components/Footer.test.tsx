// GetToIt web — global Footer test.
//
// wfr-10. Asserts the global footer renders Privacy + Terms links and a
// Help affordance, and that the Help affordance does NOT yet point at
// `mailto:support@gettoit.app` (mailbox doesn't exist — soft-blocked
// inside TB-16; see issue body for the rationale).

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders a Privacy link pointing to /privacy", () => {
    render(<Footer />);
    const privacy = screen.getByRole("link", { name: /privacy/i });
    expect(privacy).toHaveAttribute("href", "/privacy");
  });

  it("renders a Terms link pointing to /terms", () => {
    render(<Footer />);
    const terms = screen.getByRole("link", { name: /terms/i });
    expect(terms).toHaveAttribute("href", "/terms");
  });

  it("renders a Help affordance", () => {
    render(<Footer />);
    // The affordance is present (link or element labelled "Help").
    // Acceptance allows either a /contact stub or "Help (coming soon)" copy;
    // either way the user should be able to find a Help label.
    const help = screen.getByText(/help/i);
    expect(help).toBeInTheDocument();
  });

  it("does NOT link Help to mailto:support@gettoit.app (mailbox does not exist yet)", () => {
    const { container } = render(<Footer />);
    // No mailto link anywhere in the footer until the mailbox ships.
    const mailtoLinks = container.querySelectorAll(
      'a[href^="mailto:support@gettoit.app"]'
    );
    expect(mailtoLinks.length).toBe(0);
  });

  it("uses a semantic <footer> landmark", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
