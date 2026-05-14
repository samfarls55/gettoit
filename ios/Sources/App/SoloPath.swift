// GetToIt — Solo path detection (TB-13).
//
// Single source of truth for "is this room running in solo mode?" Pure
// helper — no Supabase, no SwiftUI. The host (RootView, post-Q5 router)
// calls into this with the snapshot of the room's membership count plus
// the local flag tracking whether the initiator opened the share sheet.
//
// Why a separate file:
//   * The detection logic gets exercised from RootView, the post-Q5
//     transition handler, and the test suite. Co-locating with
//     VerdictScreen.swift would couple the routing logic to the view
//     surface — they're separate concerns.
//   * The pure shape makes the AC ("solo-path detection skips S04 when
//     members.length === 1 AND no invite was shared") trivially
//     testable without instantiating a SwiftUI host.
//
// Detection rule (canonical, per `surfaces/05-verdict.md` §"solo"):
//
//   memberCount == 1  AND  invitedShared == false
//     → skip S04 Waiting, jump directly to verdict computation + S05 solo
//
//   memberCount  >= 2                                      → group flow
//   memberCount  == 1  AND  invitedShared == true          → group flow
//                                                           (waiting on
//                                                            invitees)
//
// The router never relies on count alone — a "1 member, invite shared"
// room is still a group session waiting for invitees to land. The
// `invitedShared` flag is the load-bearing input.

import Foundation

/// Pure detection helpers for the solo-mode routing branch.
public enum SoloPath {

    /// True when the post-Q5 router should skip S04 Waiting and jump
    /// directly to verdict computation followed by S05 in the solo
    /// variant. False everywhere else — including the edge cases where
    /// the room is currently single-member but the initiator already
    /// shared an invite (group session waiting for invitees to land).
    ///
    /// - Parameters:
    ///   - memberCount: The count of `members` rows for the room at the
    ///     moment the lone member submits Q5. Sourced from a quick
    ///     `select count(*) from members where room_id = ?` round-trip,
    ///     or — for the immediate solo case where the lone member is
    ///     the initiator — the local invariant that the room has just
    ///     been created with a single owner row.
    ///   - invitedShared: Whether the iOS share sheet was ever opened
    ///     for this room from this device. Tracked locally — the share
    ///     sheet itself doesn't produce a side-effect we can observe
    ///     server-side (the user could open it and close it without
    ///     sharing), so the flag is "share sheet was presented" rather
    ///     than "an invitee actually received a link."
    public static func shouldSkipWaiting(memberCount: Int, invitedShared: Bool) -> Bool {
        return memberCount == 1 && invitedShared == false
    }
}
