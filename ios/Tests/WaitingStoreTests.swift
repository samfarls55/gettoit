// GetToIt — WaitingStore unit tests (TB-07).
//
// Pure state-machine tests. No Supabase, no Realtime — the store
// reacts to `apply(event:)` calls and exposes the observable state
// the S04 surface renders.

import XCTest
@testable import GetToIt

@MainActor
final class WaitingStoreTests: XCTestCase {

    private func makeStore(
        userID: UUID = UUID(),
        isInitiator: Bool = true,
        clock: @escaping WaitingClock = { Date() }
    ) -> WaitingStore {
        WaitingStore(
            roomID: UUID(),
            currentUserID: userID,
            isInitiator: isInitiator,
            clock: clock
        )
    }

    // MARK: - bootstrap

    func testBootstrapSeedsTheObservableState() {
        let store = makeStore()
        let m1 = WaitingMember(id: UUID(), role: "owner")
        let m2 = WaitingMember(id: UUID(), role: "participant")
        store.bootstrap(
            members: [m1, m2],
            answered: [m1.id],
            status: .open
        )
        XCTAssertEqual(store.members.count, 2)
        XCTAssertEqual(store.answeredCount, 1)
        XCTAssertEqual(store.status, .open)
        XCTAssertFalse(store.verdictReady)
        XCTAssertFalse(store.quorumMet, "1 answered is below quorum (2)")
    }

    func testBootstrapWithVerdictReadyStatusFlipsTheFlag() {
        let store = makeStore()
        store.bootstrap(members: [], answered: [], status: .verdictReady)
        XCTAssertTrue(store.verdictReady,
            "expected a bootstrap into verdict_ready to set the ready flag")
    }

    // MARK: - voteCast

    func testVoteCastEventAdvancesAnsweredSetAndCanFlipQuorum() {
        let store = makeStore()
        let me = store.currentUserID
        let alex = UUID()
        store.bootstrap(
            members: [
                WaitingMember(id: me, role: "owner"),
                WaitingMember(id: alex, role: "participant"),
            ],
            answered: [me],
            status: .open
        )
        XCTAssertFalse(store.quorumMet)
        store.apply(event: .voteCast(userID: alex))
        XCTAssertEqual(store.answeredCount, 2)
        XCTAssertTrue(store.quorumMet, "second vote must flip quorum")
    }

    func testVoteCastEventIsIdempotent() {
        let store = makeStore()
        let alex = UUID()
        store.bootstrap(
            members: [
                WaitingMember(id: store.currentUserID, role: "owner"),
                WaitingMember(id: alex, role: "participant"),
            ],
            answered: [],
            status: .open
        )
        store.apply(event: .voteCast(userID: alex))
        store.apply(event: .voteCast(userID: alex))
        XCTAssertEqual(store.answeredCount, 1,
            "a duplicate vote echo must not double-count")
    }

    // MARK: - memberJoined

    func testMemberJoinedAppendsTheMember() {
        let store = makeStore()
        store.bootstrap(members: [], answered: [], status: .open)
        let member = WaitingMember(id: UUID(), role: "participant")
        store.apply(event: .memberJoined(member))
        XCTAssertEqual(store.memberCount, 1)
        XCTAssertEqual(store.members.first?.id, member.id)
    }

    func testMemberJoinedIsIdempotent() {
        let store = makeStore()
        store.bootstrap(members: [], answered: [], status: .open)
        let member = WaitingMember(id: UUID(), role: "participant")
        store.apply(event: .memberJoined(member))
        store.apply(event: .memberJoined(member))
        XCTAssertEqual(store.memberCount, 1,
            "a duplicate member echo (Realtime delivery quirk) must not double-add")
    }

    // MARK: - status / verdict

    func testRoomStatusChangedEventUpdatesStatusAndFlipsVerdictReady() {
        let store = makeStore()
        store.bootstrap(members: [], answered: [], status: .open)
        store.apply(event: .roomStatusChanged(.firing))
        XCTAssertEqual(store.status, .firing)
        XCTAssertFalse(store.verdictReady)
        store.apply(event: .roomStatusChanged(.verdictReady))
        XCTAssertEqual(store.status, .verdictReady)
        XCTAssertTrue(store.verdictReady)
    }

    func testVerdictReadyEventAloneFlipsTheFlag() {
        let store = makeStore()
        store.bootstrap(members: [], answered: [], status: .firing)
        store.apply(event: .verdictReady)
        XCTAssertTrue(store.verdictReady)
        XCTAssertEqual(store.status, .verdictReady,
            "verdictReady event also normalises status to verdict_ready")
    }

    func testStatusFlipsToExpiredOnTheNoQuorumPath() {
        let store = makeStore()
        store.bootstrap(members: [], answered: [], status: .open)
        store.apply(event: .roomStatusChanged(.expired))
        XCTAssertEqual(store.status, .expired)
        XCTAssertFalse(store.verdictReady,
            "expired is the no-quorum terminal — there's no verdict to surface")
    }

    // MARK: - nudge

    func testNudgeIsAdmittedWhenPendingMembersExistAndCooldownHasNotStarted() {
        let store = makeStore()
        let alex = UUID()
        let sam = UUID()
        store.bootstrap(
            members: [
                WaitingMember(id: store.currentUserID, role: "owner"),
                WaitingMember(id: alex, role: "participant"),
                WaitingMember(id: sam, role: "participant"),
            ],
            answered: [store.currentUserID, alex],
            status: .open
        )
        XCTAssertTrue(store.canNudge,
            "Sam hasn't answered — should be admissible to nudge")
        XCTAssertEqual(store.nudge(), .sent)
    }

    func testNudgeIsRateLimitedWithinTwoMinutes() {
        var t = Date(timeIntervalSince1970: 1_700_000_000)
        let store = makeStore(clock: { t })
        let sam = UUID()
        store.bootstrap(
            members: [
                WaitingMember(id: store.currentUserID, role: "owner"),
                WaitingMember(id: sam, role: "participant"),
            ],
            answered: [store.currentUserID],
            status: .open
        )
        XCTAssertEqual(store.nudge(), .sent)

        // 30s later → still rate-limited.
        t = t.addingTimeInterval(30)
        let outcome = store.nudge()
        guard case .rateLimited(let remaining) = outcome else {
            return XCTFail("expected rate-limited, got \(outcome)")
        }
        XCTAssertEqual(remaining, 90,
            "30s elapsed against a 120s window leaves 90s remaining")

        // 120s later → admissible again.
        t = t.addingTimeInterval(91)
        XCTAssertEqual(store.nudge(), .sent)
    }

    func testNudgeReturnsNoOneToNudgeWhenEveryMemberHasAnswered() {
        let store = makeStore()
        let alex = UUID()
        store.bootstrap(
            members: [
                WaitingMember(id: store.currentUserID, role: "owner"),
                WaitingMember(id: alex, role: "participant"),
            ],
            answered: [store.currentUserID, alex],
            status: .open
        )
        XCTAssertEqual(store.nudge(), .noOneToNudge,
            "with everyone in, there's no one to nudge")
        XCTAssertFalse(store.canNudge)
    }

    // MARK: - pendingTargets

    func testPendingTargetsExcludesTheCurrentUserAndAnsweredMembers() {
        let store = makeStore()
        let alex = UUID()
        let sam = UUID()
        store.bootstrap(
            members: [
                WaitingMember(id: store.currentUserID, role: "owner"),
                WaitingMember(id: alex, role: "participant"),
                WaitingMember(id: sam, role: "participant"),
            ],
            answered: [alex],
            status: .open
        )
        XCTAssertEqual(store.pendingTargets(), [sam])
    }
}
