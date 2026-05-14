// GetToIt web — Waiting screen render test.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { WaitingScreen, type WaitingMemberView } from "./WaitingScreen";

const members: WaitingMemberView[] = [
  { id: "u1", initial: "1", answered: true, isSelf: true },
  { id: "u2", initial: "2", answered: true, isSelf: false },
  { id: "u3", initial: "3", answered: false, isSelf: false },
  { id: "u4", initial: "4", answered: false, isSelf: false },
];

describe("WaitingScreen", () => {
  it("renders the N of M headline + the countdown when seconds present", () => {
    render(
      <WaitingScreen members={members} secondsRemaining={462} />,
    );
    expect(screen.getByTestId("waiting-count")).toHaveTextContent("2 of 4");
    expect(screen.getByTestId("waiting-countdown")).toHaveTextContent(
      /auto-fires in 7:42/i,
    );
  });

  it("omits the countdown when secondsRemaining is null", () => {
    render(<WaitingScreen members={members} secondsRemaining={null} />);
    expect(screen.queryByTestId("waiting-countdown")).toBeNull();
  });

  it("renders the outstanding-name copy when given", () => {
    render(
      <WaitingScreen
        members={members}
        secondsRemaining={120}
        outstandingName="Sam"
      />,
    );
    expect(screen.getByText("Sam")).toBeInTheDocument();
  });

  it("renders the sg-03 Download CTA when isAnonymous + onDownloadApp are set", () => {
    const onDownloadApp = vi.fn();
    render(
      <WaitingScreen
        members={members}
        secondsRemaining={462}
        isAnonymous={true}
        onDownloadApp={onDownloadApp}
      />,
    );
    const dock = screen.getByTestId("waiting-download-dock");
    expect(dock).toBeInTheDocument();
    // The CTA label renders sentence-case in source; the `cta` token
    // rule uppercases at render time via CSS. Match case-insensitively
    // so the test doesn't lock the rendered casing.
    const button = screen.getByRole("button", { name: /download the app/i });
    fireEvent.click(button);
    expect(onDownloadApp).toHaveBeenCalledTimes(1);
    // The subscript line is part of the locked copy register.
    expect(screen.getByTestId("waiting-download-subscript")).toHaveTextContent(
      /then your votes save with you/i,
    );
  });

  it("suppresses the Download CTA when isAnonymous is false", () => {
    const onDownloadApp = vi.fn();
    render(
      <WaitingScreen
        members={members}
        secondsRemaining={462}
        isAnonymous={false}
        onDownloadApp={onDownloadApp}
      />,
    );
    expect(screen.queryByTestId("waiting-download-dock")).toBeNull();
    expect(onDownloadApp).not.toHaveBeenCalled();
  });

  it("suppresses the Download CTA when onDownloadApp is omitted", () => {
    render(
      <WaitingScreen
        members={members}
        secondsRemaining={462}
        isAnonymous={true}
      />,
    );
    expect(screen.queryByTestId("waiting-download-dock")).toBeNull();
  });
});
