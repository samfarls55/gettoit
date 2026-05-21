// GetToIt web — invitee-shell re-click data-layer tests.
//
// tb-WF-12 — the reads + writes the web invitee shell uses for the
// re-click behaviors (web-01 §B resume, §C/§D decided card + closed
// terminal, §E leave):
//   * `readQuizProgress`  — plain select of `members.quiz_progress`
//     (decision doc §Q5 — read on boot).
//   * `writeQuizProgress` — the `members_progress_upsert` RPC (the
//     write path; the column has no client UPDATE policy).
//   * `readRoomPlanState` — resolves the Plan state behind a room:
//     decided (→ §C card), open (→ resume into the quiz), or
//     unresolved (the membership-gated `rooms` read returns nothing →
//     §D "this plan is closed" terminal).
//   * `leaveMembership`   — drops the caller's `members` row through
//     the `members_delete_self` RLS policy (decision doc §Q7).
//
// All four wrap supabase-js calls; the tests exercise them against a
// hand-rolled fake client so the wire shape (table, RPC name, args,
// filters) is pinned without a live Postgres. This slice adds NO new
// schema and NO new server code — every server piece already exists.

import { describe, expect, it, vi } from "vitest";

import {
  leaveMembership,
  readQuizProgress,
  readRoomPlanState,
  writeQuizProgress,
} from "./invitee-shell";

// ── Fake supabase client ───────────────────────────────────────────
//
// Records the table / rpc / select / eq / delete / order calls so each
// test can assert the exact wire shape. Each `from(table)` and `rpc()`
// call resolves from a per-table / per-rpc scripted result.

type QueryResult = { data: unknown; error: unknown };

function fakeClient(opts: {
  /** Per-table scripted result for a terminating `select`. */
  tables?: Record<string, QueryResult>;
  /** Per-rpc scripted result. */
  rpcs?: Record<string, QueryResult>;
  /** Result a terminating `delete()` chain resolves to. */
  deleteResult?: QueryResult;
}) {
  const calls: {
    table?: string;
    rpc?: string;
    rpcArgs?: unknown;
    select?: string;
    eqs: Array<[string, unknown]>;
    deleted?: boolean;
  }[] = [];

  const from = vi.fn((table: string) => {
    const record: (typeof calls)[number] = { table, eqs: [] };
    calls.push(record);
    const tableResult: QueryResult = opts.tables?.[table] ?? {
      data: null,
      error: null,
    };
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn((cols: string) => {
      record.select = cols;
      return builder;
    });
    builder.eq = vi.fn((col: string, val: unknown) => {
      record.eqs.push([col, val]);
      return builder;
    });
    builder.limit = vi.fn(() => Promise.resolve(tableResult));
    builder.maybeSingle = vi.fn(() => Promise.resolve(tableResult));
    builder.delete = vi.fn(() => {
      record.deleted = true;
      // delete() is followed by .eq() chains, then awaited.
      const deleteBuilder: Record<string, unknown> = {
        eq: vi.fn((col: string, val: unknown) => {
          record.eqs.push([col, val]);
          return deleteBuilder;
        }),
        then: (resolve: (v: QueryResult) => unknown) =>
          resolve(opts.deleteResult ?? { data: null, error: null }),
      };
      return deleteBuilder;
    });
    return builder;
  });

  const rpc = vi.fn((name: string, args: unknown) => {
    calls.push({ rpc: name, rpcArgs: args, eqs: [] });
    return Promise.resolve(
      opts.rpcs?.[name] ?? { data: null, error: null },
    );
  });

  return { client: { from, rpc }, calls };
}

// ── readQuizProgress ────────────────────────────────────────────────

describe("readQuizProgress", () => {
  it("selects members.quiz_progress by (room_id, user_id)", async () => {
    const { client, calls } = fakeClient({
      tables: {
        members: {
          data: { quiz_progress: { last_index: 3, answers: {} } },
          error: null,
        },
      },
    });
    const progress = await readQuizProgress(client as never, "room-1", "u1");
    expect(progress.lastIndex).toBe(3);
    expect(calls[0].table).toBe("members");
    expect(calls[0].select).toContain("quiz_progress");
    expect(calls[0].eqs).toContainEqual(["room_id", "room-1"]);
    expect(calls[0].eqs).toContainEqual(["user_id", "u1"]);
  });

  it("decodes a missing row to a fresh start at Q1", async () => {
    const { client } = fakeClient({
      tables: { members: { data: null, error: null } },
    });
    const progress = await readQuizProgress(client as never, "room-1", "u1");
    expect(progress.lastIndex).toBe(1);
  });

  it("degrades to a fresh start when the read errors", async () => {
    const { client } = fakeClient({
      tables: { members: { data: null, error: { message: "rls denied" } } },
    });
    const progress = await readQuizProgress(client as never, "room-1", "u1");
    expect(progress.lastIndex).toBe(1);
  });
});

// ── writeQuizProgress ───────────────────────────────────────────────

describe("writeQuizProgress", () => {
  it("calls the members_progress_upsert RPC with the room and packed payload", async () => {
    const { client, calls } = fakeClient({
      rpcs: { members_progress_upsert: { data: null, error: null } },
    });
    await writeQuizProgress(client as never, "room-1", {
      lastIndex: 2,
      cuisines: ["thai"],
      noPreference: false,
      budget: 3,
      reputation: "popular",
      vibe: 1,
    });
    const rpcCall = calls.find((c) => c.rpc === "members_progress_upsert");
    expect(rpcCall).toBeDefined();
    expect(rpcCall?.rpcArgs).toMatchObject({
      p_room_id: "room-1",
      p_progress: {
        last_index: 2,
        answers: { cuisines: ["thai"], budget: 3 },
      },
    });
  });

  it("swallows an RPC error — progress is a best-effort convenience", async () => {
    const { client } = fakeClient({
      rpcs: {
        members_progress_upsert: { data: null, error: { message: "boom" } },
      },
    });
    await expect(
      writeQuizProgress(client as never, "room-1", {
        lastIndex: 1,
        cuisines: [],
        noPreference: false,
        budget: 1,
        reputation: "no_preference",
        vibe: 2,
      }),
    ).resolves.toBeUndefined();
  });
});

// ── readRoomPlanState ───────────────────────────────────────────────

describe("readRoomPlanState", () => {
  it("returns 'unresolved' when the membership-gated rooms read is empty", async () => {
    // A TTL-purged / stranger anon user cannot read the room — the
    // `rooms_select_members` RLS policy denies it. That is the §D
    // "this plan is closed" signal.
    const { client } = fakeClient({
      tables: { rooms: { data: [], error: null } },
    });
    const state = await readRoomPlanState(client as never, "room-1", "u1");
    expect(state.kind).toBe("unresolved");
  });

  it("returns 'decided' with plan name + venue when the plan is decided-active", async () => {
    const { client } = fakeClient({
      tables: {
        rooms: { data: [{ plan_id: "plan-9" }], error: null },
      },
      rpcs: {
        plans_decided_for_user: {
          data: [
            { id: "plan-9", name: "Friday dinner", verdict_place_name: "Ren Soba" },
          ],
          error: null,
        },
        plans_history_for_user: { data: [], error: null },
      },
    });
    const state = await readRoomPlanState(client as never, "room-1", "u1");
    expect(state).toEqual({
      kind: "decided",
      planName: "Friday dinner",
      verdictPlaceName: "Ren Soba",
    });
  });

  it("returns 'decided' from the history RPC for an expired plan", async () => {
    const { client } = fakeClient({
      tables: { rooms: { data: [{ plan_id: "plan-9" }], error: null } },
      rpcs: {
        plans_decided_for_user: { data: [], error: null },
        plans_history_for_user: {
          data: [
            { id: "plan-9", name: "Last week", verdict_place_name: "Pizza Co" },
          ],
          error: null,
        },
      },
    });
    const state = await readRoomPlanState(client as never, "room-1", "u1");
    expect(state).toEqual({
      kind: "decided",
      planName: "Last week",
      verdictPlaceName: "Pizza Co",
    });
  });

  it("returns 'open' when the room resolves but the plan is not decided", async () => {
    const { client } = fakeClient({
      tables: { rooms: { data: [{ plan_id: "plan-9" }], error: null } },
      rpcs: {
        plans_decided_for_user: { data: [], error: null },
        plans_history_for_user: { data: [], error: null },
      },
    });
    const state = await readRoomPlanState(client as never, "room-1", "u1");
    expect(state.kind).toBe("open");
  });

  it("returns 'open' when the room has no linked plan", async () => {
    // A room with a NULL plan_id (legacy / un-linked) is still a live
    // room the invitee can resume into — never a closed terminal.
    const { client } = fakeClient({
      tables: { rooms: { data: [{ plan_id: null }], error: null } },
    });
    const state = await readRoomPlanState(client as never, "room-1", "u1");
    expect(state.kind).toBe("open");
  });

  it("returns 'unresolved' when the rooms read errors", async () => {
    const { client } = fakeClient({
      tables: { rooms: { data: null, error: { message: "rls denied" } } },
    });
    const state = await readRoomPlanState(client as never, "room-1", "u1");
    expect(state.kind).toBe("unresolved");
  });
});

// ── leaveMembership ─────────────────────────────────────────────────

describe("leaveMembership", () => {
  it("deletes the caller's members row by (room_id, user_id)", async () => {
    const { client, calls } = fakeClient({
      deleteResult: { data: null, error: null },
    });
    await leaveMembership(client as never, "room-1", "u1");
    const del = calls.find((c) => c.deleted);
    expect(del?.table).toBe("members");
    expect(del?.eqs).toContainEqual(["room_id", "room-1"]);
    expect(del?.eqs).toContainEqual(["user_id", "u1"]);
  });

  it("throws when the delete is rejected", async () => {
    const { client } = fakeClient({
      deleteResult: { data: null, error: { message: "delete denied" } },
    });
    await expect(
      leaveMembership(client as never, "room-1", "u1"),
    ).rejects.toThrow();
  });
});
