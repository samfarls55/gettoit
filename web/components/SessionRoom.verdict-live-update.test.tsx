// GetToIt web — SessionRoom verdict live-update test (bug-20).
//
// web-01-invitee-shell.md §C "Live update": while the §C read-only
// verdict card is open, every `verdict_ready` Realtime rebroadcast must
// re-fetch the verdict. When an initiator reroll changes the verdict in
// place, room status stays `verdict_ready`, so the rebroadcast re-sets
// `roomStatus` to its current value — React bails on the unchanged
// state and, before bug-20, the verdict-fetch effect (keyed only on
// room id / status / user id) never re-fired. The card stayed frozen on
// the stale venue.
//
// These tests boot `SessionRoom` straight into a decided room and fire
// `verdict_ready` rebroadcasts, asserting the card re-fetches and the
// venue (or the default <-> no-survivor variant) updates. The first
// load must still fire exactly once — no double-fetch on first render.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// The per-member candidate fetch is irrelevant to the verdict path —
// SessionRoom boots straight into the decided room, never the quiz.
// Stub it so the test does not pull the Foursquare proxy machinery.
vi.mock("../lib/candidate-fetch", () => ({
  fetchMemberCandidates: vi.fn(),
  buildQ5Ratings: vi.fn(() => []),
  seedRatings: vi.fn(() => ({})),
}));

const ensureAnonSession = vi.fn();
const getSupabaseClient = vi.fn();
vi.mock("../lib/supabase", () => ({
  ensureAnonSession: () => ensureAnonSession(),
  getSupabaseClient: () => getSupabaseClient(),
}));

// `readRoomPlanState` resolves the plan name + verdict venue through the
// joiner-readable RPCs. The verdict-fetch effect calls it on every run,
// so re-pointing its return value between rebroadcasts simulates a
// reroll changing the verdict.
const readRoomPlanState = vi.fn();
const writeQuizProgress = vi.fn();
vi.mock("../lib/invitee-shell", () => ({
  readRoomPlanState: (...a: unknown[]) => readRoomPlanState(...a),
  writeQuizProgress: (...a: unknown[]) => writeQuizProgress(...a),
}));

// The claim-code mint is a tap-only affordance — never fires unprompted.
vi.mock("../lib/claim-code", () => ({
  mintClaimCode: vi.fn(),
}));

import { SessionRoom } from "./SessionRoom";

const ROOM_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "anon-user-1";

// ── A configurable fake Supabase client ─────────────────────────────
//
// SessionRoom's boot + verdict-fetch effects query `members`, `votes`,
// `rooms`, `verdicts` and `options` through the PostgREST builder, and
// open a Realtime channel. The fake below answers each table with a
// canned row set and captures the `verdict_ready` broadcast listener so
// a test can fire a rebroadcast.

type FakeState = {
  /** The current `verdicts` row the next verdict fetch returns. */
  verdictRow: Record<string, unknown>;
  /** The current winning `options` row (default-mode venue fallback). */
  optionRow: Record<string, unknown> | null;
};

function makeClient(state: FakeState) {
  let broadcastHandler: (() => void) | undefined;

  const builder = (table: string) => {
    const rows = (): unknown[] => {
      switch (table) {
        case "members":
          return [{ room_id: ROOM_ID, user_id: USER_ID, role: "participant" }];
        case "votes":
          // The caller already voted — boot routes them past the quiz.
          return [{ room_id: ROOM_ID, user_id: USER_ID }];
        case "rooms":
          return [
            {
              id: ROOM_ID,
              status: "verdict_ready",
              deadline_at: null,
              location_lat: 40,
              location_lng: -74,
              location_tz: "UTC",
              radius_meters: 3219,
              session_params: { meal_time: "dinner" },
            },
          ];
        case "verdicts":
          return [state.verdictRow];
        case "options":
          return state.optionRow ? [state.optionRow] : [];
        default:
          return [];
      }
    };
    const result = Promise.resolve({ data: rows(), error: null });
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      limit: () => result,
      // boot's `members` / `votes` reads end on `.eq(...)` — make the
      // chain itself thenable so an awaited `.eq()` resolves the rows.
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        result.then(onF, onR),
      upsert: () => Promise.resolve({ error: null }),
      insert: () => Promise.resolve({ error: null }),
    };
    return chain;
  };

  const channel = {
    on: (kind: string, arg2: unknown, arg3?: () => void) => {
      // `.on("broadcast", { event }, handler)` — capture the handler.
      if (kind === "broadcast" && typeof arg3 === "function") {
        broadcastHandler = arg3;
      }
      return channel;
    },
    subscribe: () => channel,
    unsubscribe: () => Promise.resolve(),
  };

  return {
    client: {
      from: (table: string) => builder(table),
      channel: () => channel,
      functions: { invoke: vi.fn() },
    },
    fireRebroadcast: () => broadcastHandler?.(),
  };
}

beforeEach(() => {
  ensureAnonSession.mockReset().mockResolvedValue(USER_ID);
  getSupabaseClient.mockReset();
  readRoomPlanState.mockReset();
  writeQuizProgress.mockReset().mockResolvedValue(undefined);
});

describe("SessionRoom — §C verdict live-update on a reroll (bug-20)", () => {
  it("re-fetches the verdict and updates the venue when a verdict_ready rebroadcast arrives", async () => {
    const state: FakeState = {
      verdictRow: {
        id: "v1",
        room_id: ROOM_ID,
        option_id: "opt-1",
        computed_at: "2026-05-22T19:00:00Z",
        method: "deadline",
        rule_text: "",
      },
      optionRow: null,
    };
    const { client, fireRebroadcast } = makeClient(state);
    getSupabaseClient.mockReturnValue(client);

    // First decided read — the original venue.
    readRoomPlanState.mockResolvedValue({
      kind: "decided",
      planName: "Friday dinner",
      verdictPlaceName: "Ren Soba",
    });

    render(<SessionRoom roomId={ROOM_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId("web-verdict-venue")).toHaveTextContent(
        "Ren Soba",
      ),
    );

    // The initiator rerolls — the verdict re-runs in place, room status
    // stays `verdict_ready`. The next decided read returns a new venue.
    readRoomPlanState.mockResolvedValue({
      kind: "decided",
      planName: "Friday dinner",
      verdictPlaceName: "Pico's Taqueria",
    });
    fireRebroadcast();

    // The card live-updates to the rerolled venue.
    await waitFor(() =>
      expect(screen.getByTestId("web-verdict-venue")).toHaveTextContent(
        "Pico's Taqueria",
      ),
    );
  });

  it("flips a no-survivor verdict to a venue across §C variants on a rebroadcast", async () => {
    const state: FakeState = {
      verdictRow: {
        id: "v1",
        room_id: ROOM_ID,
        option_id: null,
        computed_at: "2026-05-22T19:00:00Z",
        method: "no_survivor",
        rule_text: "",
      },
      optionRow: null,
    };
    const { client, fireRebroadcast } = makeClient(state);
    getSupabaseClient.mockReturnValue(client);

    // First read — a no-survivor verdict; §C shows the "No spot fits"
    // card in the venue slot.
    readRoomPlanState.mockResolvedValue({
      kind: "decided",
      planName: "Friday dinner",
      verdictPlaceName: "",
    });

    render(<SessionRoom roomId={ROOM_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId("web-verdict-venue")).toHaveTextContent(
        "No spot fits",
      ),
    );

    // The initiator widens the radius and rerolls — the verdict now has
    // a surviving venue.
    state.verdictRow = {
      id: "v1",
      room_id: ROOM_ID,
      option_id: "opt-9",
      computed_at: "2026-05-22T19:05:00Z",
      method: "deadline",
      rule_text: "",
    };
    readRoomPlanState.mockResolvedValue({
      kind: "decided",
      planName: "Friday dinner",
      verdictPlaceName: "Pico's Taqueria",
    });
    fireRebroadcast();

    await waitFor(() =>
      expect(screen.getByTestId("web-verdict-venue")).toHaveTextContent(
        "Pico's Taqueria",
      ),
    );

    // And the reverse — a reroll that turns a venue back into a
    // no-survivor verdict updates the card to the no-survivor variant.
    state.verdictRow = {
      id: "v1",
      room_id: ROOM_ID,
      option_id: null,
      computed_at: "2026-05-22T19:10:00Z",
      method: "no_survivor",
      rule_text: "",
    };
    readRoomPlanState.mockResolvedValue({
      kind: "decided",
      planName: "Friday dinner",
      verdictPlaceName: "",
    });
    fireRebroadcast();

    await waitFor(() =>
      expect(screen.getByTestId("web-verdict-venue")).toHaveTextContent(
        "No spot fits",
      ),
    );
  });

  it("fetches the verdict exactly once on the initial verdict_ready — no double-fetch on first render", async () => {
    const state: FakeState = {
      verdictRow: {
        id: "v1",
        room_id: ROOM_ID,
        option_id: "opt-1",
        computed_at: "2026-05-22T19:00:00Z",
        method: "deadline",
        rule_text: "",
      },
      optionRow: null,
    };
    const { client } = makeClient(state);
    getSupabaseClient.mockReturnValue(client);

    readRoomPlanState.mockResolvedValue({
      kind: "decided",
      planName: "Friday dinner",
      verdictPlaceName: "Ren Soba",
    });

    render(<SessionRoom roomId={ROOM_ID} />);

    await waitFor(() =>
      expect(screen.getByTestId("web-verdict-venue")).toHaveTextContent(
        "Ren Soba",
      ),
    );

    // The verdict fetch reads through `readRoomPlanState` exactly once
    // — no rebroadcast has arrived, so the effect must not re-run.
    expect(readRoomPlanState).toHaveBeenCalledTimes(1);
  });
});
