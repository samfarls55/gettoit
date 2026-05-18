// GetToIt — PostQuizHost unit tests (TB-19).
//
// PostQuizHost owns the post-Q5 session lifecycle as a phase machine:
//
//     resolving → verdict          (verdict row landed)
//     resolving → failed           (poll error)
//
// A solo session (lone initiator, no invite shared) skips S04 Waiting
// entirely — the host drops straight from `resolving` into the verdict
// poll. A group session also holds on `resolving` for tb-19 (the full
// S04 Waiting surface is tb-20) but still reaches the verdict.
//
// Pure-seam tests: the verdict fetch + the inter-poll sleep are
// injected, so the machine is exercised deterministically with no
// live Supabase client and no wall-clock waits.

import XCTest
@testable import GetToIt

@MainActor
final class PostQuizHostTests: XCTestCase {

    private static func verdictView() -> VerdictStore.VerdictView {
        VerdictStore.VerdictView(
            verdict: VerdictScreen.Verdict.soloFixture(),
            mode: .solo
        )
    }

    private func soloContext() -> PostQuizSessionContext {
        PostQuizSessionContext(
            roomID: UUID(),
            userID: UUID(),
            isInitiator: true,
            invitedShared: false
        )
    }

    private func groupContext() -> PostQuizSessionContext {
        PostQuizSessionContext(
            roomID: UUID(),
            userID: UUID(),
            isInitiator: true,
            invitedShared: true
        )
    }

    // MARK: - solo-skip routing decision

    func testSoloContextIsDetectedAsSolo() {
        XCTAssertTrue(soloContext().isSolo,
            "lone initiator who never shared an invite is a solo session")
    }

    func testSharedContextIsNotSolo() {
        XCTAssertFalse(groupContext().isSolo,
            "an initiator who opened the share sheet intends a group session")
    }

    // MARK: - phase machine: resolving → verdict

    func testHostStartsInResolving() {
        let view = Self.verdictView()
        let host = PostQuizHost(
            context: soloContext(),
            fetchVerdict: { _ in view },
            sleep: { _ in }
        )
        guard case .resolving = host.phase else {
            return XCTFail("a freshly-built host must start in .resolving, got \(host.phase)")
        }
    }

    func testSoloSessionReachesTheVerdictInSoloMode() async throws {
        let attempts = Counter()
        let view = Self.verdictView()
        let host = PostQuizHost(
            context: soloContext(),
            fetchVerdict: { _ in
                let n = await attempts.increment()
                return n >= 2 ? view : nil
            },
            sleep: { _ in }
        )

        await host.start()

        guard case .verdict(let resolved) = host.phase else {
            return XCTFail("solo session must land on .verdict, got \(host.phase)")
        }
        XCTAssertEqual(resolved.mode, .solo,
            "a solo session renders the verdict in .solo mode — never S00 Landing")
    }

    func testGroupSessionAlsoReachesTheVerdict() async throws {
        // tb-19: a group session with no snapshot fetch falls back to
        // the verdict poll directly but still reaches S05 — it must not
        // dead-end on S00 Landing.
        let view = Self.verdictView()
        let host = PostQuizHost(
            context: groupContext(),
            fetchVerdict: { _ in view },
            sleep: { _ in }
        )

        await host.start()

        guard case .verdict = host.phase else {
            return XCTFail("group session must still reach .verdict, got \(host.phase)")
        }
    }

    // MARK: - tb-20: group routing into S04 Waiting

    func testGroupSessionEntersTheWaitingPhase() {
        // A group session opens on the S04 Waiting surface — NOT
        // resolving, NOT straight to verdict, NOT S00 Landing.
        let host = PostQuizHost(
            context: groupContext(),
            fetchVerdict: { _ in nil },
            fetchSnapshot: { _ in nil },
            sleep: { _ in }
        )
        guard case .waiting = host.phase else {
            return XCTFail("a group session must open on .waiting, got \(host.phase)")
        }
        XCTAssertNotNil(host.waitingStore,
            "the group host owns a WaitingStore for the S04 surface")
    }

    func testSoloSessionDoesNotEnterTheWaitingPhase() {
        let host = PostQuizHost(
            context: soloContext(),
            fetchVerdict: { _ in nil },
            fetchSnapshot: { _ in nil },
            sleep: { _ in }
        )
        guard case .resolving = host.phase else {
            return XCTFail("a solo session must open on .resolving, got \(host.phase)")
        }
        XCTAssertNil(host.waitingStore,
            "a solo session has no S04 surface and no WaitingStore")
    }

    // MARK: - tb-20: snapshot poll re-bootstraps the WaitingStore

    func testWaitingPhaseReflectsPeersJoiningAndAnsweringWithinAPollCycle() async throws {
        let owner = UUID()
        let joiner = UUID()
        let attempts = Counter()

        // Poll 1: just the owner, nobody answered. Poll 2: a joiner has
        // landed and both have answered. Then the verdict fires.
        let host = PostQuizHost(
            context: PostQuizSessionContext(
                roomID: UUID(),
                userID: owner,
                isInitiator: true,
                invitedShared: true
            ),
            fetchVerdict: { _ in
                // No verdict until the third cycle so the snapshot has
                // two cycles to evolve the avatar row first.
                let n = await attempts.value
                return n >= 3 ? Self.verdictView() : nil
            },
            fetchSnapshot: { _ in
                let n = await attempts.increment()
                if n == 1 {
                    return SessionSnapshot(
                        members: [WaitingMember(id: owner, role: "owner")],
                        answered: [],
                        status: .open
                    )
                }
                return SessionSnapshot(
                    members: [
                        WaitingMember(id: owner, role: "owner"),
                        WaitingMember(id: joiner, role: "participant"),
                    ],
                    answered: [owner, joiner],
                    status: .open
                )
            },
            sleep: { _ in }
        )

        guard case .waiting(let store) = host.phase else {
            return XCTFail("group session must open on .waiting")
        }
        // Before any poll the store is un-bootstrapped.
        XCTAssertEqual(store.memberCount, 0)

        await host.start()

        // The store reflects the peer who joined + answered between
        // poll cycles — the avatar row is live.
        XCTAssertEqual(store.memberCount, 2,
            "the avatar row reflects a peer joining within a poll cycle")
        XCTAssertEqual(store.answeredCount, 2,
            "the avatar row reflects peers answering within a poll cycle")
    }

    func testWaitingPhaseAdvancesToTheVerdict() async throws {
        let owner = UUID()
        let host = PostQuizHost(
            context: PostQuizSessionContext(
                roomID: UUID(),
                userID: owner,
                isInitiator: true,
                invitedShared: true
            ),
            fetchVerdict: { _ in Self.verdictView() },
            fetchSnapshot: { _ in
                SessionSnapshot(
                    members: [WaitingMember(id: owner, role: "owner")],
                    answered: [owner],
                    status: .open
                )
            },
            sleep: { _ in }
        )

        await host.start()

        guard case .verdict = host.phase else {
            return XCTFail("the waiting surface must advance to .verdict when the engine fires, got \(host.phase)")
        }
    }

    func testWaitingPhaseSnapshotErrorMovesTheHostToFailed() async throws {
        struct Boom: Error {}
        let host = PostQuizHost(
            context: groupContext(),
            fetchVerdict: { _ in nil },
            fetchSnapshot: { _ in throw Boom() },
            sleep: { _ in }
        )

        await host.start()

        guard case .failed = host.phase else {
            return XCTFail("a snapshot poll error must move the host to .failed, got \(host.phase)")
        }
    }

    func testRetryFromGroupFailureReEntersWaiting() async throws {
        struct Boom: Error {}
        let calls = Counter()
        let host = PostQuizHost(
            context: groupContext(),
            fetchVerdict: { _ in nil },
            fetchSnapshot: { _ in
                let n = await calls.increment()
                if n == 1 { throw Boom() }
                return nil
            },
            sleep: { _ in
                try Task.checkCancellation()
                await Task.yield()
            }
        )

        await host.start()
        guard case .failed = host.phase else {
            return XCTFail("first poll must fail")
        }

        host.retry()
        guard case .waiting = host.phase else {
            return XCTFail("a group retry must re-enter .waiting, got \(host.phase)")
        }
        host.teardown()
    }

    // MARK: - phase machine: resolving → failed

    func testFetchErrorMovesTheHostToFailed() async throws {
        struct Boom: Error {}
        let host = PostQuizHost(
            context: soloContext(),
            fetchVerdict: { _ in throw Boom() },
            sleep: { _ in }
        )

        await host.start()

        guard case .failed = host.phase else {
            return XCTFail("a poll error must move the host to .failed, got \(host.phase)")
        }
    }

    // MARK: - teardown stops the poll loop (no leaked task)

    func testTeardownStopsThePollLoop() async throws {
        let attempts = Counter()
        let host = PostQuizHost(
            context: soloContext(),
            fetchVerdict: { _ in
                _ = await attempts.increment()
                return nil  // never resolves — only teardown can end it
            },
            sleep: { _ in
                try Task.checkCancellation()
                await Task.yield()
            }
        )

        host.beginPolling()
        try await Task.sleep(nanoseconds: 5_000_000)
        host.teardown()

        let countAtTeardown = await attempts.value
        XCTAssertGreaterThan(countAtTeardown, 0, "the host should have polled before teardown")

        // After teardown the loop is dead — no further polls land.
        try await Task.sleep(nanoseconds: 10_000_000)
        let countAfter = await attempts.value
        XCTAssertEqual(countAtTeardown, countAfter,
            "teardown must stop the poll loop — no leaked task continuing to poll")

        // Teardown left the host on the neutral resolving phase — it
        // never found a verdict and never errored.
        guard case .resolving = host.phase else {
            return XCTFail("a torn-down host that never found a verdict stays .resolving, got \(host.phase)")
        }
    }
}

/// Minimal actor counter for race-free attempt tallies inside the
/// injected `fetchVerdict` closure.
private actor Counter {
    private(set) var value = 0
    @discardableResult
    func increment() -> Int {
        value += 1
        return value
    }
}
