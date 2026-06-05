// GetToIt web — PlacesEmptyState App Store link test.
//
// wfr-31. The places-fallback empty state mentions opening the GetToIt
// mobile app but did not link out to the App Store. The fallback is the
// terminal surface on web (no MapKit escape hatch — ADR 0002), so the
// only path forward for the user is the mobile app. The body copy now
// links the app phrase to the App Store URL so the route is reachable.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PlacesEmptyState } from "./PlacesEmptyState";
import { APP_STORE_URL } from "../lib/app-store";

describe("PlacesEmptyState — App Store link (wfr-31)", () => {
  it("links the mobile app phrase in the body copy to the App Store URL", () => {
    render(<PlacesEmptyState />);

    const link = screen.getByRole("link", { name: /gettoit mobile app/i });
    expect(link).toHaveAttribute("href", APP_STORE_URL);
  });

  it("opens the App Store link in a new tab with safe rel attributes", () => {
    render(<PlacesEmptyState />);

    const link = screen.getByRole("link", { name: /gettoit mobile app/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
  });
});
