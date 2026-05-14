// GetToIt web — InviteWebCard render test.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { InviteWebCard } from "./InviteWebCard";

// Stub `next/link` so it renders a plain anchor with the given href.
// Vitest doesn't run inside the Next.js router, so the real component
// would crash on the missing client context.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { vi } from "vitest";

describe("InviteWebCard", () => {
  it("renders the initiator + routes the primary CTA to the session", () => {
    render(
      <InviteWebCard
        roomId="11111111-2222-3333-4444-555555555555"
        roomShortId="abc1234"
        expiresIn="27 min"
        initiatorName="Maya"
      />,
    );
    expect(screen.getByText(/Maya sent you a session/i)).toBeInTheDocument();
    expect(screen.getByText(/expires in 27 min/i)).toBeInTheDocument();
    const primary = screen.getByLabelText("Answer in browser");
    expect(primary).toHaveAttribute(
      "href",
      "/s/11111111-2222-3333-4444-555555555555",
    );
    const secondary = screen.getByLabelText("Open in app");
    expect(secondary).toHaveAttribute(
      "href",
      "https://gettoit.app/join/11111111-2222-3333-4444-555555555555",
    );
  });

  it("falls back to a generic initiator when name is missing", () => {
    render(<InviteWebCard roomId="11111111-2222-3333-4444-555555555555" />);
    expect(screen.getByText(/A friend sent you a session/i)).toBeInTheDocument();
  });
});
