// GetToIt web — InviteShell re-click routing test (tb-WF-12).
//
// tb-WF-11 shipped the first-landing path; tb-WF-12 lands the re-click
// behaviors the shell routes on when a Web invitee re-opens a
// `/join/<roomId>` link they have already landed on once:
//
//   §B resume   — a member of a still-open Plan is handed into the
//                 quiz with their `quiz_progress` (resume routing).
//   §C decided  — a member of a decided Plan sees the read-only
//                 verdict card.
//   §D closed   — a membership that no longer resolves sees the
//                 "this plan is closed" terminal.
//   §E leave    — the quiz-chrome Leave drops the `members` row and
//                 routes to the "you left this plan" terminal; a
//                 subsequent re-click is a fresh first-landing.
//

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// `SessionRoom` is the quiz the shell hands an open Plan to. Stub it so
// the routing test does not boot the whole quiz orchestrator. The stub
// echoes the `initialProgress` it was handed so the resume hand-off can
// be asserted, and exposes the `onLeave` callback as a button.
vi.mock("./SessionRoom", () => ({
  SessionRoom: ({
    roomId,
    initialProgress,
    onLeave,
  }: {
    roomId: string;
    initialProgress?: { lastIndex: number };
    onLeave?: () => void;
  }) => (
    <div data-testid="session-room">
      <span data-testid="session-room-room">{roomId}</span>
      <span data-testid="session-room-resume-step">
        {initialProgress?.lastIndex ?? "none"}
      </span>
      {onLeave ? (
        <button type="button" data-testid="session-room-leave" onClick={onLeave}>
          Leave
        </button>
      ) : null}
    </div>
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
const readRoomPlanState = vi.fn();
const readQuizProgress = vi.fn();
const leaveMembership = vi.fn();
vi.mock("../lib/invitee-shell", () => ({
  findMembership: (...a: unknown[]) => findMembership(...a),
  createMembership: (...a: unknown[]) => createMembership(...a),
  readRoomPlanState: (...a: unknown[]) => readRoomPlanState(...a),
  readQuizProgress: (...a: unknown[]) => readQuizProgress(...a),
  leaveMembership: (...a: unknown[]) => leaveMembership(...a),
}));

import { InviteShell } from "./InviteShell";

const ROOM_ID = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  ensureAnonSession.mockReset().mockResolvedValue("anon-user-1");
  getSupabaseClient.mockReset().mockReturnValue({});
  findMembership.mockReset();
  createMembership.mockReset().mockResolvedValue(undefined);
  readRoomPlanState.mockReset();
  readQuizProgress.mockReset().mockResolvedValue({ lastIndex: 1 });
  leaveMembership.mockReset().mockResolvedValue(undefined);
});

// ── §B resume routing ───────────────────────────────────────────────

describe("InviteShell — §B resume routing", () => {
  it("hands a member of an open Plan into the quiz with their quiz_progress", async () => {
    findMembership.mockResolvedValue({ user_id: "anon-user-1", display_name: "Maya" });
    readRoomPlanState.mockResolvedValue({ kind: "open" });
    readQuizProgress.mockResolvedValue({ lastIndex: 3 });

    render(<InviteShell roomId={ROOM_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId("session-room")).toBeInTheDocument(),
    );
    // The shell read the in-flight progress and handed it to the quiz —
    // the resume lands on the last-answered question.
    expect(screen.getByTestId("session-room-resume-step")).toHaveTextContent(
      "3",
    );
  });
});

// ── §C decided re-click ─────────────────────────────────────────────

describe("InviteShell — §C decided re-click", () => {
  it("shows the read-only verdict card when the Plan is decided", async () => {
    findMembership.mockResolvedValue({ user_id: "anon-user-1", display_name: "Maya" });
    readRoomPlanState.mockResolvedValue({
      kind: "decided",
      planName: "Friday dinner",
      verdictPlaceName: "Ren Soba",
    });

    render(<InviteShell roomId={ROOM_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId("web-verdict-card")).toBeInTheDocument(),
    );
    expect(screen.getByText("Friday dinner")).toBeInTheDocument();
    expect(screen.getByText("Ren Soba")).toBeInTheDocument();
    // The decided card is terminal — no quiz hand-off.
    expect(screen.queryByTestId("session-room")).toBeNull();
  });

  it("live-updates the verdict venue on a Realtime rebroadcast", async () => {
    // A reroll during decided-active changes the verdict; the card
    // cross-fades to the new venue without the invitee acting (§C).
    findMembership.mockResolvedValue({ user_id: "anon-user-1", display_name: "Maya" });
    readRoomPlanState.mockResolvedValue({
      kind: "decided",
      planName: "Friday dinner",
      verdictPlaceName: "Ren Soba",
    });

    // A fake Realtime channel that captures the broadcast listener so
    // the test can fire a rebroadcast.
    let broadcastHandler: (() => void) | undefined;
    const channel = {
      on: vi.fn((kind: string, _filter: unknown, handler: () => void) => {
        if (kind === "broadcast") broadcastHandler = handler;
        return channel;
      }),
      subscribe: vi.fn(() => channel),
      unsubscribe: vi.fn(() => Promise.resolve()),
    };
    getSupabaseClient.mockReturnValue({ channel: vi.fn(() => channel) });

    render(<InviteShell roomId={ROOM_ID} />);
    await waitFor(() =>
      expect(screen.getByText("Ren Soba")).toBeInTheDocument(),
    );
    await waitFor(() => expect(broadcastHandler).toBeDefined());

    // The initiator rerolls — the next decided read returns a new venue.
    readRoomPlanState.mockResolvedValue({
      kind: "decided",
      planName: "Friday dinner",
      verdictPlaceName: "Pico's Taqueria",
    });
    broadcastHandler?.();

    await waitFor(() =>
      expect(screen.getByText("Pico's Taqueria")).toBeInTheDocument(),
    );
  });
});

// ── §D closed terminal ──────────────────────────────────────────────

describe("InviteShell — §D closed terminal", () => {
  it("shows the 'this plan is closed' terminal when membership no longer resolves", async () => {
    // The member row resolved at boot but the room read came back
    // empty — the membership aged out mid-session (anon-TTL purge).
    findMembership.mockResolvedValue({ user_id: "anon-user-1", display_name: "Maya" });
    readRoomPlanState.mockResolvedValue({ kind: "unresolved" });

    render(<InviteShell roomId={ROOM_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId("plan-closed-terminal")).toBeInTheDocument(),
    );
    expect(screen.getByText(/this plan is closed/i)).toBeInTheDocument();
    expect(screen.queryByTestId("session-room")).toBeNull();
  });
});

// ── §A first landing still works ────────────────────────────────────

describe("InviteShell — first landing (unchanged)", () => {
  it("routes a no-membership click to name entry without probing plan state", async () => {
    findMembership.mockResolvedValue(null);

    render(<InviteShell roomId={ROOM_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId("name-entry")).toBeInTheDocument(),
    );
    // A first-landing never probes the decided RPCs — it is name entry.
    expect(readRoomPlanState).not.toHaveBeenCalled();
  });
});

// ── §E leave ────────────────────────────────────────────────────────

describe("InviteShell — §E leave", () => {
  it("drops the members row and shows the 'you left this plan' terminal on confirm", async () => {
    findMembership.mockResolvedValue({ user_id: "anon-user-1", display_name: "Maya" });
    readRoomPlanState.mockResolvedValue({ kind: "open" });

    render(<InviteShell roomId={ROOM_ID} />);
    await waitFor(() =>
      expect(screen.getByTestId("session-room")).toBeInTheDocument(),
    );

    // The quiz chrome Leave fires the shell's onLeave callback.
    screen.getByTestId("session-room-leave").click();

    await waitFor(() =>
      expect(screen.getByTestId("plan-left-terminal")).toBeInTheDocument(),
    );
    expect(leaveMembership).toHaveBeenCalledTimes(1);
    expect(leaveMembership).toHaveBeenCalledWith(
      expect.anything(),
      ROOM_ID,
      "anon-user-1",
    );
    expect(screen.getByText(/you left this plan/i)).toBeInTheDocument();
  });
});
