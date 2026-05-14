// GetToIt web — Waiting screen render test.

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

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
});
