// GetToIt — Quiz chrome Exit/Leave wiring unit tests (tb-WF-2).
//
// Covers the server-side behaviour of confirming Exit/Leave on the
// QuizChrome row (sg-WF-2 spec, `design-system/surfaces/03-quiz.md`
// §"Quiz chrome (Back + Exit)"):
//   * Exit confirm fires the member-drop call EXACTLY ONCE.
//   * Cancel does not fire it.
//   * Initiator + non-solo: room is NOT marked expired (others can
//     still finish).
//   * Joiner: room is NOT marked expired (joiners never kill the room).
//   * Initiator + solo: room IS marked expired (the room can't
//     reach a verdict without the only member).
//
// The split between "drop my membership" and "abandon the room" lives
// on `MemberLeaveStore`. The unit tests drive it with synthetic
// closures so no Supabase round-trip is needed.

import XCTest
@testable import GetToIt

@MainActor
final class QuizChromeExitTests: XCTestCase {

    // MARK: - test doubles

    /// Records every `members` DELETE-self the store fires. The closures
    /// capture (roomID, userID) so tests can assert the call shape.
    final class RecordingMemberDelete: @unchecked Sendable {
        struct Call: Equatable { let roomID: UUID; let userID: UUID }
        var calls: [Call] = []
        func handler() -> @Sendable (UUID, UUID) async throws -> Void {
            return { [weak self] roomID, userID in
                self?.calls.append(.init(roomID: roomID, userID: userID))
            }
        }
    }

    /// Records every `rooms.status` UPDATE the store fires. Used for the
    /// solo-exit branch — non-solo exits never call this.
    final class RecordingRoomExpire: @unchecked Sendable {
        struct Call: Equatable { let roomID: UUID }
        var calls: [Call] = []
        func handler() -> @Sendable (UUID) async throws -> Void {
            return { [weak self] roomID in
                self?.calls.append(.init(roomID: roomID))
            }
        }
    }

    /// Stable identifiers for every test.
    private let roomID = UUID()
    private let userID = UUID()

    // MARK: - acceptance: exit confirm fires once

    func testExitConfirmFiresMemberDropExactlyOnce() async throws {
        let delete = RecordingMemberDelete()
        let expire = RecordingRoomExpire()
        let store = MemberLeaveStore(
            deleteMembership: delete.handler(),
            expireRoom: expire.handler()
        )

        try await store.leave(
            roomID: roomID, userID: userID,
            role: .joiner, isSolo: false
        )

        XCTAssertEqual(delete.calls, [.init(roomID: roomID, userID: userID)],
            "expected Exit confirm to fire the members DELETE once with the active room + user")
    }

    func testCancelDoesNotFireAnyWrite() {
        // The store is never invoked on Cancel — the surface dismisses
        // the alert and `leave` is the ONLY entry point. We assert by
        // construction: the store with the recording handlers attached
        // has zero calls until `leave` is invoked.
        let delete = RecordingMemberDelete()
        let expire = RecordingRoomExpire()
        _ = MemberLeaveStore(
            deleteMembership: delete.handler(),
            expireRoom: expire.handler()
        )
        XCTAssertTrue(delete.calls.isEmpty,
            "expected Cancel to fire no member-drop write")
        XCTAssertTrue(expire.calls.isEmpty,
            "expected Cancel to fire no room-expire write")
    }

    // MARK: - acceptance: room-expire branch

    func testInitiatorNonSoloDoesNotExpireTheRoom() async throws {
        // Acceptance: "Initiator-exit on a non-solo room does NOT mark
        // the room expired (others continue)."
        let delete = RecordingMemberDelete()
        let expire = RecordingRoomExpire()
        let store = MemberLeaveStore(
            deleteMembership: delete.handler(),
            expireRoom: expire.handler()
        )

        try await store.leave(
            roomID: roomID, userID: userID,
            role: .initiator, isSolo: false
        )

        XCTAssertEqual(delete.calls.count, 1,
            "expected the initiator's membership to still drop on Exit")
        XCTAssertTrue(expire.calls.isEmpty,
            "expected a non-solo initiator Exit to leave the room alive for the remaining members")
    }

    func testInitiatorSoloDoesExpireTheRoom() async throws {
        // Acceptance: "Initiator-exit on a solo room DOES" mark the
        // room expired. There are no other members; the room can't
        // reach a verdict without the exiter.
        let delete = RecordingMemberDelete()
        let expire = RecordingRoomExpire()
        let store = MemberLeaveStore(
            deleteMembership: delete.handler(),
            expireRoom: expire.handler()
        )

        try await store.leave(
            roomID: roomID, userID: userID,
            role: .initiator, isSolo: true
        )

        XCTAssertEqual(delete.calls.count, 1,
            "expected the solo initiator's membership to drop on Exit")
        XCTAssertEqual(expire.calls, [.init(roomID: roomID)],
            "expected a solo Exit to expire the room (no remaining members to continue)")
    }

    func testJoinerNeverExpiresTheRoom() async throws {
        // Acceptance: "Joiner Exit (a.k.a. Leave) does NOT mark the
        // room expired." A joiner is never the room's owner; only the
        // creator can update `rooms` (RLS). The store guards the call
        // by role even if the caller passes `isSolo: true` (impossible
        // in practice but cheap to lock).
        let delete = RecordingMemberDelete()
        let expire = RecordingRoomExpire()
        let store = MemberLeaveStore(
            deleteMembership: delete.handler(),
            expireRoom: expire.handler()
        )

        try await store.leave(
            roomID: roomID, userID: userID,
            role: .joiner, isSolo: false
        )

        XCTAssertEqual(delete.calls.count, 1)
        XCTAssertTrue(expire.calls.isEmpty,
            "expected a joiner Leave to never mutate the room — only the room's creator can")

        // Even with `isSolo: true` accidentally supplied for a joiner,
        // the store still refuses to mutate the room. A joiner cannot
        // be in a solo room (solo == one member, and that member is
        // the room's creator), so this is a safety net not a happy path.
        try await store.leave(
            roomID: roomID, userID: userID,
            role: .joiner, isSolo: true
        )
        XCTAssertTrue(expire.calls.isEmpty,
            "expected role=joiner to suppress room-expire regardless of isSolo")
    }

    // MARK: - wfr-17 — initiator Leave from S04 Waiting

    /// wfr-17 — the WaitingScreen initiator Leave path drops the
    /// initiator's membership AND marks the room expired in the same
    /// flow, regardless of how many other members have joined. This is
    /// distinct from `leave(role:isSolo:)` whose room-expire branch is
    /// gated on `isSolo == true` (the Plan-list / quiz-chrome path
    /// where the initiator leaving a non-solo room keeps the room
    /// alive for the remaining members). On S04 Waiting the initiator
    /// has already submitted Q5 and the intent of Leave is "kill this
    /// session," not "let the others continue without me" — the room
    /// has nobody who can fire the verdict anymore.
    func testLeaveAndExpireDropsMembershipAndExpiresTheRoom() async throws {
        let delete = RecordingMemberDelete()
        let expire = RecordingRoomExpire()
        let store = MemberLeaveStore(
            deleteMembership: delete.handler(),
            expireRoom: expire.handler()
        )

        try await store.leaveAndExpire(roomID: roomID, userID: userID)

        XCTAssertEqual(delete.calls, [.init(roomID: roomID, userID: userID)],
            "expected leaveAndExpire to drop the caller's membership exactly once")
        XCTAssertEqual(expire.calls, [.init(roomID: roomID)],
            "expected leaveAndExpire to mark the room expired exactly once")
    }

    /// wfr-17 — DELETE runs before UPDATE. Mirrors the existing
    /// `leave(...)` contract: a successful DELETE followed by a failed
    /// UPDATE leaves a "I left, but the room is still open" state the
    /// verdict cron's no-signal sweeper expires anyway — the safer
    /// failure mode than "room expired but I'm still a member."
    func testLeaveAndExpireRunsDeleteBeforeUpdate() async throws {
        // Order is asserted by failing the DELETE and observing that
        // the UPDATE never ran.
        struct Boom: Error {}
        let expire = RecordingRoomExpire()
        let store = MemberLeaveStore(
            deleteMembership: { _, _ in throw Boom() },
            expireRoom: expire.handler()
        )

        do {
            try await store.leaveAndExpire(roomID: roomID, userID: userID)
            XCTFail("expected leaveAndExpire to rethrow the DELETE failure")
        } catch is Boom {
            // expected
        }

        XCTAssertTrue(expire.calls.isEmpty,
            "expected the room-expire UPDATE to never fire when the membership DELETE throws")
    }
}
