// GetToIt web — PrivacyPage home-link integration test.
//
// wfr-19. /privacy is a standalone legal page outside the invite/quiz
// shells, so the global GTIMark wordmark home affordance (wfr-18) is
// not present here unless the page mounts it explicitly. This test
// guards the in-page Escape Hatch: the GetToIt wordmark must render
// at the top of the page and link to /.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import PrivacyPage from "./page";

describe("PrivacyPage", () => {
  it("renders a GetToIt wordmark home link at the top of the page", () => {
    render(<PrivacyPage />);
    // The GTIMark wordmark exposes itself as a link to the landing
    // surface. Match by accessible name "GetToIt — home" rather than a
    // loose /gettoit/i regex so the support@gettoit.app mailto links
    // further down the page do not collide with this query.
    const link = screen.getByRole("link", { name: /gettoit.*home/i });
    expect(link).toHaveAttribute("href", "/");
  });
});
