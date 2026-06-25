// GetToIt web root surface tests.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Page from "./page";

describe("Page", () => {
  it("keeps the landing headline inside narrow mobile viewports", () => {
    render(<Page />);

    const heading = screen.getByRole("heading", {
      name: /decide where to eat together/i,
    });

    expect(heading).toHaveStyle({
      overflowWrap: "break-word",
      textWrap: "balance",
    });
    expect(heading.parentElement).toHaveStyle({
      width: "100%",
      maxWidth: "34rem",
    });
  });
});
