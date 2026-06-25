// GetToIt web — PlacesEmptyState render test.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PlacesEmptyState } from "./PlacesEmptyState";

describe("PlacesEmptyState", () => {
  it("does not render an App Store link when no URL is configured", () => {
    render(<PlacesEmptyState />);

    expect(screen.queryByTestId("places-empty-app-link")).toBeNull();
    expect(screen.queryByRole("link", { name: /gettoit mobile app/i })).toBeNull();
  });

  it("renders the retry target", () => {
    render(<PlacesEmptyState />);

    expect(screen.getByTestId("places-empty-retry")).toHaveTextContent(
      /start over/i,
    );
  });

  it("keeps the fallback headline inside narrow mobile viewports", () => {
    render(<PlacesEmptyState />);

    const headline = screen.getByRole("heading", {
      name: /couldn't load options nearby/i,
    });

    expect(headline).toHaveStyle({
      overflowWrap: "break-word",
      textWrap: "balance",
    });
    expect(screen.getByTestId("places-empty-state")).toHaveStyle({
      width: "100%",
      maxWidth: "32rem",
    });
  });
});
