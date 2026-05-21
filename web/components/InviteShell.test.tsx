// GetToIt web — InviteShell orchestrator test.
//
// tb-WF-11 — the web invitee shell scaffold mounted at `/join/<roomId>`.
// This slice lands the first-landing path: a cold link click renders
// the name-entry surface, submitting a name creates the `members` row
// carrying `display_name`, and the invitee is handed into the quiz.
//
// Resume / read-only verdict / "plan closed" terminal / leave are
// tb-WF-12 and out of scope here — the scaffold only needs the two
// branches this slice ships (no membership → name entry; membership
// present → quiz).

import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// `SessionRoom` is the quiz the shell hands off to. Stub it so the
// shell test doesn't boot the whole quiz orchestrator (which would
// need a live supabase). The stub just proves the shell routed here.
vi.mock("./SessionRoom", () => ({
  SessionRoom: ({ roomId }: { roomId: string }) => (
    <div data-testid="session-room">quiz for {roomId}</div>
  ),
}));

const ensureAnonSession = vi.fn();
const getSupabaseClient = vi.fn(() => ({}));
vi.mock("../lib/supabase", () => ({
  ensureAnonSession: () => ensureAnonSession(),
  getSupabaseClient: () => getSupabaseClient(),
}));

const findMembership = vi.fn();
const createMembership = vi.fn();
// tb-WF-12 — the re-click helpers the shell now calls once a membership
// resolves. The first-landing path (no `members` row) never reaches
// them; the "already a member" path routes through `readRoomPlanState`.
const readRoomPlanState = vi.fn();
const readQuizProgress = vi.fn();
const leaveMembership = vi.fn();
vi.mock("../lib/invitee-shell", () => ({
  findMembership: (...args: unknown[]) => findMembership(...args),
  createMembership: (...args: unknown[]) => createMembership(...args),
  readRoomPlanState: (...args: unknown[]) => readRoomPlanState(...args),
  readQuizProgress: (...args: unknown[]) => readQuizProgress(...args),
  leaveMembership: (...args: unknown[]) => leaveMembership(...args),
}));

import { InviteShell } from "./InviteShell";

const ROOM_ID = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  ensureAnonSession.mockReset().mockResolvedValue("anon-user-1");
  getSupabaseClient.mockReset().mockReturnValue({});
  findMembership.mockReset();
  createMembership.mockReset().mockResolvedValue(undefined);
  // Default the re-click reads to the still-open / fresh-quiz path so
  // the first-landing tests are unaffected by the new routing.
  readRoomPlanState.mockReset().mockResolvedValue({ kind: "open" });
  readQuizProgress.mockReset().mockResolvedValue({ lastIndex: 1 });
  leaveMembership.mockReset().mockResolvedValue(undefined);
});

describe("InviteShell — first landing", () => {
  it("renders the name-entry surface when the invitee has no members row", async () => {
    findMembership.mockResolvedValue(null);
    render(<InviteShell roomId={ROOM_ID} />);
    await waitFor(() =>
      expect(screen.getByTestId("name-entry")).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/what should we call you\?/i),
    ).toBeInTheDocument();
    // No quiz yet — name entry must come first.
    expect(screen.queryByTestId("session-room")).toBeNull();
  });

  it("creates the members row with display_name and hands into the quiz on submit", async () => {
    findMembership.mockResolvedValue(null);
    render(<InviteShell roomId={ROOM_ID} />);
    await waitFor(() =>
      expect(screen.getByTestId("name-entry")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Maya" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /join the plan/i }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("session-room")).toBeInTheDocument(),
    );
    expect(createMembership).toHaveBeenCalledTimes(1);
    expect(createMembership).toHaveBeenCalledWith(expect.anything(), {
      roomId: ROOM_ID,
      userId: "anon-user-1",
      displayName: "Maya",
    });
  });

  it("surfaces an error on the name-entry surface when the insert fails", async () => {
    findMembership.mockResolvedValue(null);
    createMembership.mockRejectedValue(new Error("insert denied"));
    render(<InviteShell roomId={ROOM_ID} />);
    await waitFor(() =>
      expect(screen.getByTestId("name-entry")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByPlaceholderText("Your name"), {
      target: { value: "Maya" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /join the plan/i }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("name-entry-error")).toBeInTheDocument(),
    );
    // Stayed on name entry — no quiz handoff after a failed insert.
    expect(screen.queryByTestId("session-room")).toBeNull();
  });
});

describe("InviteShell — already a member", () => {
  it("skips name entry and hands straight into the quiz", async () => {
    findMembership.mockResolvedValue({
      user_id: "anon-user-1",
      display_name: "Maya",
    });
    render(<InviteShell roomId={ROOM_ID} />);
    await waitFor(() =>
      expect(screen.getByTestId("session-room")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("name-entry")).toBeNull();
    // No row was created — the invitee already had one.
    expect(createMembership).not.toHaveBeenCalled();
  });
});

describe("InviteShell — boot failure", () => {
  it("shows an error surface when the anon session can't be minted", async () => {
    ensureAnonSession.mockRejectedValue(new Error("network down"));
    render(<InviteShell roomId={ROOM_ID} />);
    await waitFor(() =>
      expect(screen.getByTestId("invite-shell-error")).toBeInTheDocument(),
    );
  });
});
