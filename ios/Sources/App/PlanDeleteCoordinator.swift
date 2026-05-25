// GetToIt — PlanDeleteCoordinator (tb-WF-9, workflow-overhaul).
//
// Owns the Plan delete journey from the S00 Plan list's destructive
// confirm sheet. The journey:
//
//   1. Look up the room id linked to the Plan (the existing
//      `roomIDForPlan` helper on PlansStore — RLS already gates the
//      read to members, which includes the creator).
//   2. If a room is linked, flip `rooms.status = 'expired'`. This is
//      the session-ended signal joiners' realtime channels already
//      observe (see WaitingStore.RoomStatus + VerdictPoller paths).
//      RLS on `rooms.status` already restricts the UPDATE to the
//      room's creator via the `rooms_update_creator` policy from
//      TB-05.
//   3. Delete the Plan row. The FK on `rooms.plan_id` is
//      `on delete set null`, so the row stays around for the cron
//      sweeper to clean up if the joiner hasn't seen the realtime
//      status flip yet. RLS gates the DELETE via
//      `plans_delete_creator` (from the tb-WF-1 migration).
//
// Why this order (room flip BEFORE plan delete): the room status flip
// is the load-bearing signal joiners observe. If we deleted the Plan
// first, the `rooms.plan_id` FK goes to NULL via `on delete set null`,
// but the room's status is still 'firing' / 'open' — joiners stuck
// mid-quiz would see no immediate signal that the session ended. The
// existing pre-redesign path (`MemberLeaveStore.leave`) uses the same pattern:
// DELETE the membership row first, THEN flip the room. The Plan
// delete inverts this because the Plan is the user-visible
// destruction; the room flip is the side effect that propagates the
// "session ended" toast.
//
// Authorization: server-enforced via the existing RLS policies. The
// coordinator does NOT pre-check creator ownership client-side — a
// server-side `403` is the canonical "you can't delete this" signal.
// Tests cover that via the live-DB integration suite (not the unit
// suite here).
//
// The closure indirection mirrors `MemberLeaveStore` / `QuizVoteWriter`
// — unit tests drive the coordinator with in-memory recording
// handlers and the test target stays Supabase-free.

import Foundation
import Supabase

@MainActor
public final class PlanDeleteCoordinator {

    // MARK: - closure typealiases

    /// Look up the room id linked to a Plan. Returns nil when no room
    /// is linked (a Pending Plan that was never started) or when a
    /// transient read failure suppresses the result. Backed by
    /// `PlansStore.roomIDForPlan(planID:)` in production.
    public typealias LookupRoom = @Sendable (UUID) async -> UUID?

    /// Flip `rooms.status = 'expired'` on the given room. RLS admits
    /// the call iff the caller is the room's creator. Reused from
    /// `MemberLeaveStore.ExpireRoom` — same SQL shape, different
    /// entry point.
    public typealias ExpireRoom = @Sendable (UUID) async throws -> Void

    /// Delete the Plan row. Backed by `PlansStore.delete(planID:)`.
    /// RLS gates the DELETE to the creator.
    public typealias DeletePlan = @Sendable (UUID) async throws -> Void

    // MARK: - dependencies

    private let lookupRoom: LookupRoom
    private let expireRoom: ExpireRoom
    private let deletePlanClosure: DeletePlan

    // MARK: - init

    public init(
        lookupRoom: @escaping LookupRoom,
        expireRoom: @escaping ExpireRoom,
        deletePlan: @escaping DeletePlan
    ) {
        self.lookupRoom = lookupRoom
        self.expireRoom = expireRoom
        self.deletePlanClosure = deletePlan
    }

    /// Production binding. Builds a `PlanDeleteCoordinator` whose
    /// writes go through the supplied PlansStore + Supabase client.
    public static func live(
        plansStore: PlansStore,
        client: SupabaseClient
    ) -> PlanDeleteCoordinator {
        return PlanDeleteCoordinator(
            lookupRoom: { planID in
                await plansStore.roomIDForPlan(planID: planID)
            },
            expireRoom: { roomID in
                try await client
                    .from("rooms")
                    .update(RoomStatusExpiredUpdate())
                    .eq("id", value: roomID.uuidString.lowercased())
                    .execute()
            },
            deletePlan: { planID in
                try await plansStore.delete(planID: planID)
            }
        )
    }

    // MARK: - public api

    /// Run the Plan delete journey end-to-end. Throws on a failed
    /// Plan delete (the user's intent didn't land). A failed room
    /// expire is swallowed: the Plan still gets deleted, and the
    /// verdict cron's no-signal sweeper expires the stale room on its
    /// next pass.
    ///
    /// - Parameters:
    ///   - planID: the Plan to delete.
    ///   - status: the Plan's current `LifecycleState`. The coordinator
    ///     branches on this for the lookup + the room-flip predicate.
    public func deletePlan(
        planID: UUID,
        status: PlansStore.LifecycleState
    ) async throws {
        // Look up the linked room id regardless of status. A Pending
        // Plan may have a minted room (the user dropped the invite
        // link but never returned). A Decided plan always has a
        // linked room. A History plan's room is likely already
        // expired; the flip is idempotent.
        _ = status  // explicit no-op — kept for the API shape; future
                    // status-specific branching lands here.
        let roomID = await lookupRoom(planID)

        if let roomID {
            do {
                try await expireRoom(roomID)
            } catch {
                // Swallow — a transient room-flip failure should not
                // leave the Plan visible on the user's list. The
                // verdict cron's no-signal sweeper expires stale
                // firing rooms; the next Plan-list refresh will
                // reconcile the surface.
            }
        }

        // The Plan delete is load-bearing — if this throws the caller
        // can surface a transient error and refresh the list.
        try await deletePlanClosure(planID)
    }
}

// MARK: - wire shapes

/// Encoded payload for the `rooms` UPDATE → `status='expired'`. Touches
/// only the `status` column so the room's other fields stay untouched.
/// Same shape as `MemberLeaveStore.RoomStatusUpdate` — kept local so
/// the two stores stay decoupled.
private struct RoomStatusExpiredUpdate: Encodable {
    let status: String = "expired"
}
