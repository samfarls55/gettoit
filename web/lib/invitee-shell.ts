// GetToIt web — invitee-shell data layer.
//
// tb-WF-11 — the membership read + write the web invitee shell uses to
// drive its first-landing state machine. The shell's `/join/<roomId>`
// scaffold:
//   1. ensures the anonymous Supabase session (`ensureAnonSession`),
//   2. checks for an existing `members` row (`findMembership`),
//   3. shows the name-entry surface when there is none, then writes the
//      row carrying the typed name (`createMembership`),
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

/** Insert the caller's `members` row, carrying the `display_name` the
 *  invitee typed on the name-entry surface. The Web invitee is a
 *  joiner — `role` is always `participant`.
 *
 *  The existing `members_insert_self` RLS policy admits this INSERT
 *  (it gates on `user_id = auth.uid()` and does not constrain which
 *  columns are written), so no new policy is needed for the
 *  `display_name` write. Throws on a rejected insert so the shell can
 *  surface an error on the name-entry surface. */
export async function createMembership(
  client: SupabaseClient,
  args: { roomId: string; userId: string; displayName: string },
): Promise<void> {
  const { error } = await client.from("members").insert({
    room_id: args.roomId,
    user_id: args.userId,
    role: "participant",
    display_name: args.displayName,
  });
  if (error) {
    throw new Error(
      `Failed to create membership: ${
        (error as { message?: string }).message ?? "unknown error"
      }`,
    );
  }
}
