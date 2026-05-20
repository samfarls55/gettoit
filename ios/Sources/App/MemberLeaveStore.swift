// GetToIt — MemberLeaveStore (tb-WF-2).
//
// Wires the Quiz chrome's `Exit` / `Leave` confirm to the two server
// writes that drop the exiting member from the active room:
//   1. DELETE FROM members WHERE room_id = $1 AND user_id = auth.uid()
//   2. (solo + initiator only) UPDATE rooms SET status = 'expired'
//      WHERE id = $1
//
// RLS shape (see migrations):
//   * `members_delete_self` (added by
//     20260520000000000_members_self_delete.sql alongside this tracer
//     bullet) admits the caller-owned membership row only.
//   * `rooms_update_creator` (shipped with TB-05) admits an UPDATE on
//     the room's `status` column when `creator_user_id = auth.uid()`.
//
// Solo + non-solo branch:
//   * Initiator + non-solo: drop membership, leave the room alive for
//     the remaining members (per CONTEXT.md → "Plan exit").
//   * Initiator + solo: drop membership AND expire the room — the room
//     has no remaining members and can't reach a verdict otherwise.
//     The Plan itself returns to `pending` on the user's list (once
//     Plans are user-visible post tb-WF-4).
//   * Joiner: drop membership only. A joiner cannot UPDATE the room
//     (RLS), so the store hard-suppresses the rooms write on the
//     joiner branch regardless of `isSolo` — a defensive belt-and-
//     braces guard against an upstream wiring mistake.
//
// The two writes are NOT in a transaction. They're cheap and
// independently safe to retry: a successful DELETE followed by a
// failed UPDATE leaves a "I left, but the room is still open" state
// the verdict cron's no-signal sweeper expires anyway. The DELETE
// always runs first so a partial failure favours the room-survives
// outcome (the safer of the two, since the inverse — "room expired
// but I'm still a member" — would surface confusing realtime events
// to the remaining members).
//
// The closure indirection mirrors `QuizVoteWriter` / `MemberFetchWriter`
// — unit tests drive the store with in-memory recording handlers and
// the test target stays Supabase-free.

import Foundation
import Supabase

/// The two role-conditional verbs the chrome distinguishes. Re-uses
/// the same enum the chrome view consumes so callers don't translate.
public typealias MemberLeaveRole = QuizChromeRole

@MainActor
public final class MemberLeaveStore {
    /// Drop the caller's `members` row for the given room. RLS gates the
    /// row to `user_id = auth.uid()`; the call is idempotent on retry
    /// (a re-run with the row already gone affects 0 rows, no error).
    public typealias DeleteMembership = @Sendable (UUID, UUID) async throws -> Void

    /// Set `rooms.status = 'expired'` on the given room. Only the
    /// room's creator can call this (RLS); the store guards the
    /// invocation by role.
    public typealias ExpireRoom = @Sendable (UUID) async throws -> Void

    private let deleteMembership: DeleteMembership
    private let expireRoom: ExpireRoom

    public init(
        deleteMembership: @escaping DeleteMembership,
        expireRoom: @escaping ExpireRoom
    ) {
        self.deleteMembership = deleteMembership
        self.expireRoom = expireRoom
    }

    /// Production binding. Builds a `MemberLeaveStore` whose writes go
    /// through the supplied Supabase client. The closures upgrade the
    /// REST call shape from "anonymous query" to the concrete (room_id,
    /// user_id) match the iOS app already uses elsewhere
    /// (`PlansStore.delete`, `RoomStore.updateSessionParameters`).
    public static func live(client: SupabaseClient) -> MemberLeaveStore {
        return MemberLeaveStore(
            deleteMembership: { roomID, userID in
                try await client
                    .from("members")
                    .delete()
                    .eq("room_id", value: roomID.uuidString.lowercased())
                    .eq("user_id", value: userID.uuidString.lowercased())
                    .execute()
            },
            expireRoom: { roomID in
                try await client
                    .from("rooms")
                    .update(RoomStatusUpdate(status: "expired"))
                    .eq("id", value: roomID.uuidString.lowercased())
                    .execute()
            }
        )
    }

    /// Drop the caller's membership for `roomID`, and — when the
    /// caller is the room's initiator AND the room is solo — also
    /// expire the room.
    ///
    /// The DELETE always runs first; the UPDATE follows only on the
    /// solo-initiator branch. A thrown error from either write surfaces
    /// to the caller (the QuizScreen wiring catches it and lands on the
    /// post-exit destination either way — the user has left from their
    /// POV; a stuck membership row is recoverable on next launch).
    public func leave(
        roomID: UUID,
        userID: UUID,
        role: MemberLeaveRole,
        isSolo: Bool
    ) async throws {
        try await deleteMembership(roomID, userID)
        // A joiner cannot UPDATE the room (RLS), and a joiner can
        // never be in a solo room (solo == one member, and that member
        // owns the room). Guard the write by role so a wiring mistake
        // upstream can't trigger a guaranteed-403 round-trip.
        guard role == .initiator, isSolo else { return }
        try await expireRoom(roomID)
    }

    /// Encoded payload for the `rooms` UPDATE. Touches only the
    /// `status` column so the room's other fields stay untouched.
    private struct RoomStatusUpdate: Encodable {
        let status: String
    }
}
