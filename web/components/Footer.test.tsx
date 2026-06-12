// GetToIt web — global Footer test.
//
// wfr-10. Asserts the global footer renders Privacy + Terms links.

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

  it("does not render an unwired Help affordance", () => {
    render(<Footer />);
    expect(screen.queryByText(/help/i)).toBeNull();
  });

  it("uses a semantic <footer> landmark", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
