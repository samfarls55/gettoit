// GetToIt web — Surface web-01 §A "First-landing name entry" test.
//
// tb-WF-11 — the name-entry-alone surface a cold Web invitee reaches on
// `surfaces/web-01-invitee-shell.md` §A.

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { NameEntry } from "./NameEntry";

describe("NameEntry (web-01 §A)", () => {
  it("renders the locked eyebrow, headline, and CTA copy", () => {
    render(<NameEntry onSubmit={vi.fn()} />);
    expect(screen.getByText(/you're invited/i)).toBeInTheDocument();
    expect(
      screen.getByText(/what should we call you\?/i),
    ).toBeInTheDocument();
    // The CTA renders sentence-case in source; the `cta` token rule
    // uppercases at render time. Match case-insensitively.
    expect(
      screen.getByRole("button", { name: /join the plan/i }),
    ).toBeInTheDocument();
  });

  it("uses the literal 'Your name' placeholder on the input", () => {
    render(<NameEntry onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText("Your name")).toBeInTheDocument();
  });

  it("disables the CTA until the trimmed input is non-empty", () => {
    render(<NameEntry onSubmit={vi.fn()} />);
    const cta = screen.getByRole("button", { name: /join the plan/i });
    const input = screen.getByPlaceholderText("Your name");

    // Empty → disabled.
    expect(cta).toBeDisabled();

    // Whitespace-only → still disabled (trimming rule).
    fireEvent.change(input, { target: { value: "   " } });
    expect(cta).toBeDisabled();

    // Real name → enabled.
    fireEvent.change(input, { target: { value: "Maya" } });
    expect(cta).toBeEnabled();
  });

  it("hard-caps the input at 30 characters via maxLength", () => {
    render(<NameEntry onSubmit={vi.fn()} />);
    const input = screen.getByPlaceholderText("Your name") as HTMLInputElement;
    expect(input.maxLength).toBe(30);
  });

  it("calls onSubmit with the trimmed name when the CTA is tapped", () => {
    const onSubmit = vi.fn();
    render(<NameEntry onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText("Your name");
    fireEvent.change(input, { target: { value: "  Sam  " } });
    fireEvent.click(screen.getByRole("button", { name: /join the plan/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Sam");
  });

  it("does not call onSubmit for a whitespace-only value", () => {
    const onSubmit = vi.fn();
    render(<NameEntry onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText("Your name");
    fireEvent.change(input, { target: { value: "   " } });
    // Submitting the form (Enter) must be a no-op for an invalid value.
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits on Enter when the form is valid", () => {
    const onSubmit = vi.fn();
    render(<NameEntry onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText("Your name");
    fireEvent.change(input, { target: { value: "Alex" } });
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("Alex");
  });

  it("disables the CTA and input while submitting", () => {
    render(<NameEntry onSubmit={vi.fn()} submitting />);
    const cta = screen.getByRole("button", { name: /join the plan/i });
    const input = screen.getByPlaceholderText("Your name");
    expect(cta).toBeDisabled();
    expect(input).toBeDisabled();
  });

  it("surfaces an error message when one is given", () => {
    render(
      <NameEntry onSubmit={vi.fn()} errorMessage="Couldn't join the plan." />,
    );
    expect(
      screen.getByText(/couldn't join the plan/i),
    ).toBeInTheDocument();
  });
});
