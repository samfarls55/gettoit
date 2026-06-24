// GetToIt web — invitee-shell data layer.
//
// tb-WF-11 — the membership read + write the web invitee shell uses to
// drive its first-landing state machine. The shell's `/join/<roomId>`
// scaffold:
//   1. ensures the anonymous Supabase session (`ensureAnonSession`),
//   2. checks for an existing `members` row (`findMembership`),
//   3. shows the name-entry surface when there is none, then calls the
//      server-owned join RPC carrying the typed name (`createMembership`),
//   4. hands the invitee into the quiz.
//
// Identity is the anonymous Supabase session held in `localStorage`
// (decision doc §Q3) — there is no URL token and no separate cookie.
// `members.display_name` is the system's first real display-name source
// (tb-WF-11 migration); `compute-verdict.fetchVotes` joins it.
//
// These helpers wrap the supabase-js PostgREST builder so the shell
// component stays a thin state machine and the wire shape is unit-
// testable against a fake client.

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  packQuizProgress,
  unpackQuizProgress,
  type QuizProgressState,
} from "./quiz-progress";

/** A `members` row as the shell reads it. The shell only needs the
 *  identity + the name; the verdict path reads the rest server-side. */
export type MembershipRow = {
  user_id: string;
  display_name: string | null;
};

/** Look up the caller's `members` row for a room. Returns `null` when
 *  the invitee has not joined yet (first landing) — that is the signal
 *  the shell uses to route to the name-entry surface.
 *
 *  Degrades gracefully: a read error resolves to `null` rather than
 *  throwing. The worst case is routing a returning invitee back to
 *  name entry, which the surface copy ("What should we call you?")
 *  reads correctly for both a first-timer and a returner (decision
 *  doc §Q3) — strictly better than a hard error screen. */
export async function findMembership(
  client: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<MembershipRow | null> {
  const { data, error } = await client
    .from("members")
    .select("user_id, display_name")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("invitee-shell findMembership failed:", error.message);
    return null;
  }
  return (data as MembershipRow | null) ?? null;
}

/** Create the caller's `members` row, carrying the `display_name` the
 *  invitee typed on the name-entry surface. The Web invitee is a
 *  joiner, so the RPC always creates a participant membership and pins
 *  `user_id` to `auth.uid()`. Throws on a rejected join so the shell can
 *  surface an error on the name-entry surface. */
export async function createMembership(
  client: SupabaseClient,
  args: { roomId: string; displayName: string },
): Promise<void> {
  const { error } = await client.rpc("members_join_self", {
    p_room_id: args.roomId,
    p_display_name: args.displayName,
  });
  if (error) {
    throw new Error(
      `Failed to create membership: ${
        (error as { message?: string }).message ?? "unknown error"
      }`,
    );
  }
}

// ── tb-WF-12 — re-click behaviors (web-01 §B / §C / §D / §E) ─────────
//
// Everything below this line is the re-click slice. It adds NO new
// schema and NO new server code — every server piece (the
// `quiz_progress` column + `members_progress_upsert` RPC, the
// `plans_decided_for_user` / `plans_history_for_user` RPCs, the
// `members_delete_self` RLS policy) already exists. These helpers are
// a vertical slice integrating through those layers up to the shell.

/** Read the caller's in-flight `members.quiz_progress` for a room
 *  (decision doc §Q5 — a plain select on boot). Total: a missing row,
 *  a `null` column, or a read error all decode to a fresh "start at
 *  Q1" state — `quiz_progress` is a resume convenience, never a
 *  verdict-engine input, so a corrupt working copy costs the invitee a
 *  re-walk, never an error screen. */
export async function readQuizProgress(
  client: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<QuizProgressState> {
  try {
    const { data, error } = await client
      .from("members")
      .select("quiz_progress")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("invitee-shell readQuizProgress failed:", error.message);
      return unpackQuizProgress(null);
    }
    const row = data as { quiz_progress?: unknown } | null;
    return unpackQuizProgress(row?.quiz_progress ?? null);
  } catch (err) {
    console.warn("invitee-shell readQuizProgress threw:", err);
    return unpackQuizProgress(null);
  }
}

/** Persist the caller's in-flight quiz state through the
 *  `members_progress_upsert` RPC (decision doc §Q5 — the write path).
 *  The `members` table carries no client UPDATE policy, so the RPC is
 *  the only way to patch `quiz_progress`; the RPC body pins the write
 *  to `quiz_progress` AND `user_id = auth.uid()`.
 *
 *  Best-effort: a rejected RPC is swallowed (logged, not thrown).
 *  Resume is a convenience — a failed progress write only costs the
 *  invitee a re-walk if they re-click before the next successful
 *  write, and must never block a quiz advance. */
export async function writeQuizProgress(
  client: SupabaseClient,
  roomId: string,
  state: QuizProgressState,
): Promise<void> {
  try {
    const { error } = await client.rpc("members_progress_upsert", {
      p_room_id: roomId,
      p_progress: packQuizProgress(state),
    });
    if (error) {
      console.warn("invitee-shell writeQuizProgress failed:", error.message);
    }
  } catch (err) {
    console.warn("invitee-shell writeQuizProgress threw:", err);
  }
}

/** The Plan state behind a room, as the shell resolves it on a
 *  re-click to pick the §B resume / §C decided card / §D closed
 *  terminal branch. */
export type RoomPlanState =
  /** The Plan is decided — render the §C read-only verdict card. */
  | { kind: "decided"; planName: string; verdictPlaceName: string }
  /** The room resolves and the Plan is still live — hand into the
   *  quiz (resume / Waiting / Verdict via `SessionRoom`). */
  | { kind: "open" }
  /** The membership-gated `rooms` read returned nothing — the
   *  caller's membership has aged out of the room (the §D
   *  "this plan is closed" terminal). */
  | { kind: "unresolved" };

/** A row shape the decided / history RPCs return. The shell needs only
 *  the plan id + the two display strings. */
type DecidedPlanRow = {
  id: string;
  name: string | null;
  verdict_place_name: string | null;
};

/** Resolve the Plan state behind a room for a re-clicking invitee
 *  (decision doc §Q6).
 *
 *  The `rooms` table's `rooms_select_members` RLS policy admits a row
 *  ONLY to a current member. So a `rooms` read that returns nothing is
 *  itself the "membership does not resolve" signal — a TTL-purged anon
 *  member (ADR 0006's 30-day sweep) can no longer read the room. That
 *  is the §D terminal trigger; the shell needs no separate membership
 *  probe and no new server code to detect it.
 *
 *  When the room resolves, the decided / history RPCs say whether the
 *  Plan is decided. A web invitee returns `role='joined'` from both
 *  RPCs exactly like an Account-member joiner; the RPCs inline the
 *  verdict's place name so the §C card renders without an N+1 lookup. */
export async function readRoomPlanState(
  client: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<RoomPlanState> {
  // 1. Resolve the room. A membership-denied read (empty data, or an
  //    error) means the caller is no longer a member — §D.
  let planId: string | null;
  try {
    const { data, error } = await client
      .from("rooms")
      .select("plan_id")
      .eq("id", roomId)
      .limit(1);
    if (error) {
      console.warn("invitee-shell readRoomPlanState rooms read failed:", error.message);
      return { kind: "unresolved" };
    }
    const rows = (data as Array<{ plan_id: string | null }> | null) ?? [];
    if (rows.length === 0) {
      // RLS denied the read — the caller has no resolvable membership.
      return { kind: "unresolved" };
    }
    planId = rows[0].plan_id;
  } catch (err) {
    console.warn("invitee-shell readRoomPlanState threw:", err);
    return { kind: "unresolved" };
  }

  // A room with no linked Plan is still a live room — never a closed
  // terminal. Hand the invitee into the quiz.
  if (!planId) {
    return { kind: "open" };
  }

  // 2. Is the Plan decided? Probe the decided RPC, then history. A web
  //    invitee can have no reroll affordance, so decided-active and
  //    decided-expired collapse to one §C card (decision doc §Q6).
  const decided = await findDecidedPlanRow(client, "plans_decided_for_user", userId, planId)
    ?? await findDecidedPlanRow(client, "plans_history_for_user", userId, planId);

  if (decided) {
    return {
      kind: "decided",
      planName: decided.name ?? "",
      verdictPlaceName: decided.verdict_place_name ?? "",
    };
  }

  // The room resolves but the Plan is not decided — a live quiz the
  // invitee can resume into.
  return { kind: "open" };
}

/** Call a decided / history RPC and find the row for one plan id.
 *  Returns `null` on an RPC error or when the plan is not in the
 *  result set — the caller treats either as "not decided here". */
async function findDecidedPlanRow(
  client: SupabaseClient,
  rpcName: "plans_decided_for_user" | "plans_history_for_user",
  userId: string,
  planId: string,
): Promise<DecidedPlanRow | null> {
  try {
    const { data, error } = await client.rpc(rpcName, { p_user_id: userId });
    if (error) {
      console.warn(`invitee-shell ${rpcName} failed:`, error.message);
      return null;
    }
    const rows = (data as DecidedPlanRow[] | null) ?? [];
    return rows.find((r) => r.id === planId) ?? null;
  } catch (err) {
    console.warn(`invitee-shell ${rpcName} threw:`, err);
    return null;
  }
}

/** Drop the caller's `members` row for a room — the §E leave action
 *  (decision doc §Q7). The `members_delete_self` RLS policy authorizes
 *  the self-DELETE; `quiz_progress` rides along on the row delete (it
 *  is a column of the deleted row). The caller can never drop someone
 *  else's membership — the policy gates on `user_id = auth.uid()`.
 *
 *  Throws on a rejected delete so the shell can keep the invitee on
 *  the quiz with the failure surfaced, rather than routing them to the
 *  terminal as if the leave had succeeded. */
export async function leaveMembership(
  client: SupabaseClient,
  roomId: string,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from("members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) {
    throw new Error(
      `Failed to leave the plan: ${
        (error as { message?: string }).message ?? "unknown error"
      }`,
    );
  }
}
