// GetToIt — PlanDeleteCoordinator tests (tb-WF-9).
//
// Pins the Plan delete journey: the coordinator looks up any linked
// room, flips its status to 'expired' (which the joiners' realtime
// channel observes as the session-ended signal), then deletes the
// Plan row. The actual SQL is exercised by the live-DB integration
// tests; these unit tests pin the orchestration order + the
// status-dependent branching:
//
//   * Pending Plan (no linked room) → just delete the Plan; no
//     room-status write happens.
//   * Decided-active Plan (linked room status=firing/open/etc.) → flip
//     room status to 'expired' first, then delete the Plan. The
//     'expired' write is what joiners see as the session-ended
//     broadcast via the existing realtime subscription (already
//     wired by WaitingStore / VerdictPoller paths). Order matters —
//     if we deleted the Plan first, the `rooms.plan_id` FK would go
//     to NULL via `on delete set null` and a stale joiner who
//     hasn't received the realtime status flip yet would still see
//     the room as live.
//   * Decided-expired Plan (linked room already expired) → still
//     attempt the room flip (idempotent — the WHERE clause ignores
//     non-existent rows), then delete the Plan. Defensive: a server-
//     state regression that left an expired Plan with a still-firing
//     room shouldn't strand the joiners.
//
// Authorization is server-enforced via the existing
// `plans_delete_creator` + `rooms_update_creator` RLS policies — no
// client-side gate.

import XCTest
@testable import GetToIt

@MainActor
final class PlanDeleteCoordinatorTests: XCTestCase {

    // MARK: - test recorder

    /// In-memory recorder that captures the order + arguments of every
    /// call the coordinator makes. Used to assert orchestration order
    /// without spinning up a real Supabase client.
    private final class Recorder: @unchecked Sendable {
        enum Event: Equatable {
            case lookupRoom(planID: UUID)
            case expireRoom(roomID: UUID)
            case deletePlan(planID: UUID)
        }

        var events: [Event] = []
        var roomIDByPlan: [UUID: UUID] = [:]
        var expireRoomShouldThrow: Bool = false
        var deletePlanShouldThrow: Bool = false

        var lookupRoom: PlanDeleteCoordinator.LookupRoom {
            { [unowned self] planID in
                events.append(.lookupRoom(planID: planID))
                return roomIDByPlan[planID]
            }
        }

        var expireRoom: PlanDeleteCoordinator.ExpireRoom {
            { [unowned self] roomID in
                events.append(.expireRoom(roomID: roomID))
                if expireRoomShouldThrow {
                    throw NSError(domain: "test.expireRoom", code: 1)
                }
            }
        }

        var deletePlan: PlanDeleteCoordinator.DeletePlan {
            { [unowned self] planID in
                events.append(.deletePlan(planID: planID))
                if deletePlanShouldThrow {
                    throw NSError(domain: "test.deletePlan", code: 1)
                }
            }
        }
    }

    private func makeCoordinator(recorder: Recorder) -> PlanDeleteCoordinator {
        PlanDeleteCoordinator(
            lookupRoom: recorder.lookupRoom,
            expireRoom: recorder.expireRoom,
            deletePlan: recorder.deletePlan
        )
    }

    // MARK: - pending plan (no linked room)

    /// A Pending Plan has no decided room yet, but a room may still
    /// exist if a join link was dropped (the room is created when the
    /// initiator hits Start the quiz). The coordinator looks up the
    /// linked room id either way; if it returns nil the room flip is
    /// skipped, and the Plan delete fires straight.
    func testPendingPlanWithoutRoomDeletesDirectly() async throws {
        let recorder = Recorder()
        let coordinator = makeCoordinator(recorder: recorder)
        let planID = UUID()

        recorder.roomIDByPlan = [:]  // no room linked

        try await coordinator.deletePlan(
            planID: planID,
            status: .pending
        )

        XCTAssertEqual(recorder.events, [
            .lookupRoom(planID: planID),
            .deletePlan(planID: planID),
        ])
    }

    /// A Pending Plan that already minted a room (the user tapped
    /// Start but never completed) — the coordinator still flips the
    /// room to expired so any joiner sitting on the Quiz / Waiting
    /// surface gets the session-ended broadcast.
    func testPendingPlanWithLinkedRoomExpiresThenDeletes() async throws {
        let recorder = Recorder()
        let coordinator = makeCoordinator(recorder: recorder)
        let planID = UUID()
        let roomID = UUID()
        recorder.roomIDByPlan = [planID: roomID]

        try await coordinator.deletePlan(
            planID: planID,
            status: .pending
        )

        XCTAssertEqual(recorder.events, [
            .lookupRoom(planID: planID),
            .expireRoom(roomID: roomID),
            .deletePlan(planID: planID),
        ])
    }

    // MARK: - decided-active plan (canonical broadcast path)

    /// The canonical broadcast path: a Decided-active Plan always has
    /// a linked room. The coordinator flips the room first, then
    /// deletes the Plan. Order matters — the room status flip is the
    /// session-ended signal joiners observe; if we deleted first, the
    /// `rooms.plan_id` FK goes to NULL via `on delete set null` and a
    /// joiner who hasn't yet received the realtime status flip would
    /// see a live room.
    func testDecidedActivePlanExpiresRoomBeforeDeleting() async throws {
        let recorder = Recorder()
        let coordinator = makeCoordinator(recorder: recorder)
        let planID = UUID()
        let roomID = UUID()
        recorder.roomIDByPlan = [planID: roomID]

        try await coordinator.deletePlan(
            planID: planID,
            status: .decidedActive
        )

        XCTAssertEqual(recorder.events, [
            .lookupRoom(planID: planID),
            .expireRoom(roomID: roomID),
            .deletePlan(planID: planID),
        ])
    }

    // MARK: - decided-expired plan (history)

    /// A Decided-expired Plan's room is presumably already expired,
    /// but the coordinator still issues the flip. The flip is
    /// idempotent at the SQL level (the row's status is already
    /// 'expired'); the cost is one extra round-trip and the benefit is
    /// defense in depth against a server-state regression.
    func testDecidedExpiredPlanStillFlipsRoomBeforeDeleting() async throws {
        let recorder = Recorder()
        let coordinator = makeCoordinator(recorder: recorder)
        let planID = UUID()
        let roomID = UUID()
        recorder.roomIDByPlan = [planID: roomID]

        try await coordinator.deletePlan(
            planID: planID,
            status: .decidedExpired
        )

        XCTAssertEqual(recorder.events, [
            .lookupRoom(planID: planID),
            .expireRoom(roomID: roomID),
            .deletePlan(planID: planID),
        ])
    }

    // MARK: - error handling

    /// A failed room-expire write does NOT stop the Plan delete. The
    /// Plan is the user's intent; a transient room-flip failure
    /// shouldn't leave the Plan visible on their list. The cost is a
    /// stale room — already handled by the verdict cron's no-signal
    /// sweeper that expires stale firing rooms.
    func testExpireRoomFailureDoesNotBlockDeletePlan() async {
        let recorder = Recorder()
        let coordinator = makeCoordinator(recorder: recorder)
        let planID = UUID()
        let roomID = UUID()
        recorder.roomIDByPlan = [planID: roomID]
        recorder.expireRoomShouldThrow = true

        do {
            try await coordinator.deletePlan(
                planID: planID,
                status: .decidedActive
            )
        } catch {
            XCTFail("expireRoom failure must not bubble: \(error)")
        }

        XCTAssertEqual(recorder.events, [
            .lookupRoom(planID: planID),
            .expireRoom(roomID: roomID),
            .deletePlan(planID: planID),
        ])
    }

    /// A failed Plan delete throws — the caller can refresh the list
    /// + show a transient error. (The Plan list refresh on next
    /// foreground will reconcile anyway.)
    func testDeletePlanFailureBubbles() async {
        let recorder = Recorder()
        let coordinator = makeCoordinator(recorder: recorder)
        let planID = UUID()
        recorder.deletePlanShouldThrow = true

        do {
            try await coordinator.deletePlan(planID: planID, status: .pending)
            XCTFail("expected deletePlan to throw")
        } catch {
            // expected
        }
    }
}
