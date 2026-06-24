// GetToIt web — invitee-shell data-layer tests.
//
// tb-WF-11 — the membership read + write the web invitee shell uses to
// drive its first-landing state machine:
//   * `findMembership` — does this anon user already have a `members`
//     row for the room? Drives name-entry vs. resume routing.
//   * `createMembership` — call the server-owned join RPC carrying the
//     `display_name` the invitee typed on the name-entry surface.
//
// These wrap supabase-js PostgREST calls; the tests exercise them
// against a hand-rolled fake client so the wire shape (table, columns,
// filters, the `display_name` RPC arg) is pinned without a live Postgres.

import { afterEach, describe, expect, it, vi } from "vitest";

import { createMembership, findMembership } from "./invitee-shell";

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Fake supabase client ───────────────────────────────────────────
//
// Records the table + the select / eq / insert calls so each test can
// assert the exact wire shape. Mirrors the chainable PostgREST builder
// surface the shell actually touches.

type SelectResult = { data: unknown; error: unknown };

function fakeClient(opts: {
  selectResult?: SelectResult;
  rpcError?: unknown;
}) {
  const calls: {
    table: string;
    select?: string;
    eqs: Array<[string, unknown]>;
    rpc?: { name: string; args: unknown };
  }[] = [];

  const from = vi.fn((table: string) => {
    const record: (typeof calls)[number] = { table, eqs: [] };
    calls.push(record);
    const builder: Record<string, unknown> = {};

    builder.select = vi.fn((cols: string) => {
      record.select = cols;
      return builder;
    });
    builder.eq = vi.fn((col: string, val: unknown) => {
      record.eqs.push([col, val]);
      return builder;
    });
    // `maybeSingle` resolves the read.
    builder.maybeSingle = vi.fn(() =>
      Promise.resolve(opts.selectResult ?? { data: null, error: null }),
    );
    return builder;
  });
  const rpc = vi.fn((name: string, args: unknown) => {
    calls.push({ table: "rpc", eqs: [], rpc: { name, args } });
    return Promise.resolve({ error: opts.rpcError ?? null });
  });

  return { client: { from, rpc }, calls };
}

describe("findMembership", () => {
  it("queries members by (room_id, user_id) and returns the row when present", async () => {
    const { client, calls } = fakeClient({
      selectResult: {
        data: { user_id: "u1", display_name: "Maya" },
        error: null,
      },
    });
    const row = await findMembership(
      client as never,
      "room-1",
      "u1",
    );
    expect(row).toEqual({ user_id: "u1", display_name: "Maya" });
    expect(calls[0].table).toBe("members");
    expect(calls[0].eqs).toContainEqual(["room_id", "room-1"]);
    expect(calls[0].eqs).toContainEqual(["user_id", "u1"]);
  });

  it("returns null when the invitee has no members row yet", async () => {
    const { client } = fakeClient({
      selectResult: { data: null, error: null },
    });
    const row = await findMembership(client as never, "room-1", "u1");
    expect(row).toBeNull();
  });

  it("returns null (degrades gracefully) when the read errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { client } = fakeClient({
      selectResult: { data: null, error: { message: "rls denied" } },
    });
    const row = await findMembership(client as never, "room-1", "u1");
    expect(row).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "invitee-shell findMembership failed:",
      "rls denied",
    );
  });
});

describe("createMembership", () => {
  it("calls members_join_self with room_id and display_name", async () => {
    const { client, calls } = fakeClient({});
    await createMembership(client as never, {
      roomId: "room-1",
      displayName: "Maya",
    });
    expect(calls[0].rpc).toEqual({
      name: "members_join_self",
      args: {
        p_room_id: "room-1",
        p_display_name: "Maya",
      },
    });
  });

  it("does not send user_id or role from the client", async () => {
    const { client, calls } = fakeClient({});
    await createMembership(client as never, {
      roomId: "room-1",
      displayName: "Maya",
    });
    expect(calls[0].rpc?.args).not.toHaveProperty("user_id");
    expect(calls[0].rpc?.args).not.toHaveProperty("role");
  });

  it("throws when the join is rejected", async () => {
    const { client } = fakeClient({
      rpcError: { message: "join denied" },
    });
    await expect(
      createMembership(client as never, {
        roomId: "room-1",
        displayName: "Maya",
      }),
    ).rejects.toThrow();
  });
});
