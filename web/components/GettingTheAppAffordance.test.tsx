// GetToIt web — "Getting the app?" claim-code mint affordance test.
//
// tb-WF-13 — the web side of the account-claim bridge (ADR 0015).
// Coverage:
//   * collapsed state — renders the low-key "Getting the app?" line.
//   * lazy mint — the code is minted on tap, not eagerly.
//   * revealed state — the minted code + instructions render in place.
//   * re-mint — tapping again yields a fresh code.
//   * failure — a mint failure surfaces a quiet retry, no crash.

import { describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { GettingTheAppAffordance } from "./GettingTheAppAffordance";

describe("GettingTheAppAffordance", () => {
  it("renders the collapsed 'Getting the app?' line and does not mint eagerly", () => {
    const onMint = vi.fn();
    render(<GettingTheAppAffordance onMint={onMint} />);

    // The collapsed affordance is present...
    expect(
      screen.getByTestId("getting-the-app-affordance"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /getting the app\?/i }),
    ).toBeInTheDocument();

    // ...and lazy: nothing is minted until the user taps.
    expect(onMint).not.toHaveBeenCalled();
    expect(screen.queryByTestId("getting-the-app-code")).toBeNull();
  });

  it("lazily mints a code on tap and renders it with instructions", async () => {
    const onMint = vi.fn().mockResolvedValue("ABCD2345");
    render(<GettingTheAppAffordance onMint={onMint} />);

    fireEvent.click(
      screen.getByRole("button", { name: /getting the app\?/i }),
    );

    // The mint call fires exactly once on the tap.
    expect(onMint).toHaveBeenCalledTimes(1);

    // The revealed state shows the minted code...
    const code = await screen.findByTestId("getting-the-app-code");
    expect(code).toHaveTextContent("ABCD2345");

    // ...and the instruction line points the user at the S00a entry.
    expect(
      screen.getByTestId("getting-the-app-instructions"),
    ).toHaveTextContent(/voted on the web\?/i);

    // The collapsed line is consumed by the reveal — it does not persist.
    expect(
      screen.queryByRole("button", { name: /getting the app\?/i }),
    ).toBeNull();
  });

  it("re-mints a fresh code when tapped again", async () => {
    const onMint = vi
      .fn()
      .mockResolvedValueOnce("AAAA2345")
      .mockResolvedValueOnce("BBBB6789");
    render(<GettingTheAppAffordance onMint={onMint} />);

    fireEvent.click(
      screen.getByRole("button", { name: /getting the app\?/i }),
    );
    const firstCode = await screen.findByTestId("getting-the-app-code");
    expect(firstCode).toHaveTextContent("AAAA2345");

    // The revealed state offers a re-mint affordance.
    fireEvent.click(
      screen.getByRole("button", { name: /new code/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("getting-the-app-code")).toHaveTextContent(
        "BBBB6789",
      );
    });
    expect(onMint).toHaveBeenCalledTimes(2);
  });

  it("shows a quiet retry line when the mint fails — no crash", async () => {
    const onMint = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce("CCCC2345");
    render(<GettingTheAppAffordance onMint={onMint} />);

    fireEvent.click(
      screen.getByRole("button", { name: /getting the app\?/i }),
    );

    // The failure surfaces a non-blocking error line, not a crash.
    const errorLine = await screen.findByTestId("getting-the-app-error");
    expect(errorLine).toBeInTheDocument();

    // Retry succeeds and reveals the code.
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    const code = await screen.findByTestId("getting-the-app-code");
    expect(code).toHaveTextContent("CCCC2345");
  });

  it("disables the mint affordance while a mint is in flight", async () => {
    let resolveMint: (code: string) => void = () => {};
    const onMint = vi.fn(
      () => new Promise<string>((res) => (resolveMint = res)),
    );
    render(<GettingTheAppAffordance onMint={onMint} />);

    const trigger = screen.getByRole("button", {
      name: /getting the app\?/i,
    });
    fireEvent.click(trigger);
    // A second tap mid-flight must not fire a second mint.
    fireEvent.click(trigger);
    expect(onMint).toHaveBeenCalledTimes(1);

    resolveMint("DDDD2345");
    const code = await screen.findByTestId("getting-the-app-code");
    expect(code).toHaveTextContent("DDDD2345");
  });
});
