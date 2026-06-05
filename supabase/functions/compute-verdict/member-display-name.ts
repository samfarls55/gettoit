// Legacy mobile note: references to iOS/Swift/TestFlight here refer to the retired Swift app unless they describe Apple platform/APNs behavior; active mobile app is React Native / Expo in mobile/.
// tb-WF-11 â€” member display-name resolution.
//
// The web invitee shell (sg-WF-5 surface Â§A) introduces the system's
// first real display-name source: `members.display_name`, written when
// a Web invitee enters a name on the name-entry surface. iOS members
// have no name-entry surface, so their `display_name` stays NULL.
//
// `compute-verdict.fetchVotes` joins the column and resolves each
// member's name through `resolveMemberDisplayName`: the real name when
// the column carries one, the `m<uuid>` placeholder otherwise. Keeping
// this rule in one pure function makes the join's fallback behavior
// testable without a live Postgres.

/** The synthesized placeholder name for a member with no real
 *  `display_name`. Format: `"m" + first 4 chars of the user_id`. This
 *  is the legacy name `compute-verdict` has always surfaced for
 *  anonymous members; iOS members keep it because they have no
 *  name-entry surface. */
export function memberPlaceholderName(userId: string): string {
  return `m${userId.slice(0, 4)}`;
}

/** Resolve a member's display name. Returns the joined
 *  `members.display_name` when it is a non-blank string; otherwise
 *  falls back to the `m<uuid>` placeholder.
 *
 *  A blank / whitespace-only joined value is treated as "no name" â€”
 *  the name-entry surface trims input and rejects a whitespace-only
 *  name, so a blank value in the column is a data anomaly, not a real
 *  name. A real name is returned trimmed. */
export function resolveMemberDisplayName(
  userId: string,
  joinedName: string | null | undefined,
): string {
  if (typeof joinedName === "string") {
    const trimmed = joinedName.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return memberPlaceholderName(userId);
}
