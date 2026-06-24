import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const ensureAnonSession = vi.fn();
const getSupabaseClient = vi.fn();
vi.mock("../lib/supabase", () => ({
  ensureAnonSession: () => ensureAnonSession(),
  getSupabaseClient: () => getSupabaseClient(),
}));

const readRoomPlanState = vi.fn();
const writeQuizProgress = vi.fn();
vi.mock("../lib/invitee-shell", () => ({
  readRoomPlanState: (...a: unknown[]) => readRoomPlanState(...a),
  writeQuizProgress: (...a: unknown[]) => writeQuizProgress(...a),
}));

vi.mock("../lib/claim-code", () => ({
  mintClaimCode: vi.fn(),
}));

import { SessionRoom } from "./SessionRoom";

const ROOM_ID = "11111111-2222-3333-4444-555555555555";
const USER_ID = "anon-user-1";

function makeClient() {
  const tableWrites: string[] = [];
  const functionInvokes: string[] = [];
  const rpcInvokes: string[] = [];

  const builder = (table: string) => {
    const rows = (): unknown[] => {
      switch (table) {
        case "members":
          return [{ room_id: ROOM_ID, user_id: USER_ID, role: "participant" }];
        case "votes":
          return [];
        case "rooms":
          return [
            {
              id: ROOM_ID,
              status: "open",
              deadline_at: null,
              location_lat: 40,
              location_lng: -74,
              location_tz: "UTC",
              radius_meters: 3219,
              session_params: { meal_time: "dinner" },
            },
          ];
        default:
          return [];
      }
    };
    const result = Promise.resolve({ data: rows(), error: null });
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      limit: () => result,
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        result.then(onF, onR),
      upsert: () => {
        tableWrites.push(table);
        return Promise.resolve({ error: null });
      },
      insert: () => {
        tableWrites.push(table);
        return Promise.resolve({ error: null });
      },
    };
    return chain;
  };

  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: () => Promise.resolve(),
  };

  return {
    tableWrites,
    functionInvokes,
    rpcInvokes,
    client: {
      from: (table: string) => builder(table),
      rpc: (functionName: string) => {
        rpcInvokes.push(functionName);
        return Promise.resolve({ error: null });
      },
      channel: () => channel,
      functions: {
        invoke: vi.fn((functionName: string) => {
          functionInvokes.push(functionName);
          return Promise.resolve({
            data: {
              status: "assigned",
              cards: [
                {
                  googlePlaceId: "google-cuisine",
                  displayName: "Pico's Taqueria",
                  axisReceipt: { droppedAxis: "cuisine" },
                },
                {
                  googlePlaceId: "google-crowd",
                  displayName: "Ren Soba",
                  axisReceipt: { droppedAxis: "crowd_approval" },
                },
                {
                  googlePlaceId: "google-vibe",
                  displayName: "Bar Pastoral",
                  axisReceipt: { droppedAxis: "vibe" },
                },
              ],
            },
            error: null,
          });
        }),
      },
    },
  };
}

beforeEach(() => {
  ensureAnonSession.mockReset().mockResolvedValue(USER_ID);
  getSupabaseClient.mockReset();
  readRoomPlanState.mockReset();
  writeQuizProgress.mockReset().mockResolvedValue(undefined);
});

describe("SessionRoom Q5 card set", () => {
  it("loads assigned Google Q5 cards without writing member_fetches", async () => {
    const { client, functionInvokes, rpcInvokes, tableWrites } = makeClient();
    getSupabaseClient.mockReturnValue(client);

    render(
      <SessionRoom
        roomId={ROOM_ID}
        initialProgress={{
          lastIndex: 5,
          cuisines: ["mexican"],
          noPreference: false,
          budget: 2,
          reputation: "popular",
          vibe: 2,
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText("Pico's Taqueria")).toBeInTheDocument()
    );
    expect(functionInvokes).toEqual(["q5-card-set"]);

    fireEvent.click(screen.getByRole("button", { name: "Drop the verdict" }));

    await waitFor(() => expect(rpcInvokes).toContain("votes_submit_self"));
    expect(tableWrites).not.toContain("member_fetches");
  });
});
