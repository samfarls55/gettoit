// GetToIt — TimerCoordinator tests (TB-07).
//
// Pure-logic tests with an injected clock + invoker stub. No Supabase,
// no real timer. Covers:
//   * `secondsRemaining` matches the wall-clock delta to the deadline,
//     clamps at 0 past the deadline.
//   * Countdown formatting matches the locked copy register
//     ("AUTO-FIRES IN 7:42"), including the zero-pad on seconds.
//   * Reduced-motion variant emits coarse minute granularity.
//   * `tapDecideNow()` short-circuits for invitees (no RPC fired).
//   * `tapDecideNow()` folds in-flight rapid taps into one call.
//   * Outcomes from the RPC seam surface on `lastOutcome` for the
//     view layer to render.

import XCTest
@testable import GetToIt

@MainActor
final class TimerCoordinatorTests: XCTestCase {

    // MARK: - countdown

    func testSecondsRemainingFromAFixedClockOffset() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let deadline = now.addingTimeInterval(462)  // 7m42s
        let coord = TimerCoordinator(
            roomID: UUID(),
            deadlineAt: deadline,
            isInitiator: false,
            clock: { now },
            invoker: { _ in .firing }
        )
        XCTAssertEqual(coord.secondsRemaining, 462)
        XCTAssertFalse(coord.deadlineElapsed)
    }

    func testSecondsRemainingClampsToZeroAfterDeadline() {
        let now = Date(timeIntervalSince1970: 1_700_000_000)
        let deadline = now.addingTimeInterval(-30)  // 30s past
        let coord = TimerCoordinator(
            roomID: UUID(),
            deadlineAt: deadline,
            isInitiator: false,
            clock: { now },
            invoker: { _ in .firing }
        )
        XCTAssertEqual(coord.secondsRemaining, 0,
            "expected clamp to 0 — no negative remainders")
        XCTAssertTrue(coord.deadlineElapsed)
    }

    func testSecondsRemainingAdvancesWhenClockMoves() {
        let start = Date(timeIntervalSince1970: 1_700_000_000)
        var t = start
        let deadline = start.addingTimeInterval(120)
        let coord = TimerCoordinator(
            roomID: UUID(),
            deadlineAt: deadline,
            isInitiator: false,
            clock: { t },
            invoker: { _ in .firing }
        )
        XCTAssertEqual(coord.secondsRemaining, 120)
        t = start.addingTimeInterval(60)
        XCTAssertEqual(coord.secondsRemaining, 60)
        t = start.addingTimeInterval(120)
        XCTAssertEqual(coord.secondsRemaining, 0)
    }

    // MARK: - format

    func testFormatCountdownAtSevenFortyTwo() {
        XCTAssertEqual(
            TimerCoordinator.formatCountdown(secondsRemaining: 462),
            "AUTO-FIRES IN 7:42"
        )
    }

    func testFormatCountdownPadsSecondsButNotMinutes() {
        XCTAssertEqual(
            TimerCoordinator.formatCountdown(secondsRemaining: 42),
            "AUTO-FIRES IN 0:42",
            "single-digit minutes render as 0:42 per surfaces/04-waiting.md")
    }

    func testFormatCountdownAtZero() {
        XCTAssertEqual(
            TimerCoordinator.formatCountdown(secondsRemaining: 0),
            "AUTO-FIRES IN 0:00")
    }

    func testFormatCountdownNeverProducesNegativeReading() {
        XCTAssertEqual(
            TimerCoordinator.formatCountdown(secondsRemaining: -10),
            "AUTO-FIRES IN 0:00",
            "negative input must clamp — defensive against a stale clock")
    }

    func testReducedMotionLabelGivesCoarseMinutes() {
        XCTAssertEqual(
            TimerCoordinator.formatCountdownReducedMotion(secondsRemaining: 462),
            "AUTO-FIRES IN UNDER 8 MIN",
            "7:42 rounds UP to 8 — that's what 'under N min' promises")
        XCTAssertEqual(
            TimerCoordinator.formatCountdownReducedMotion(secondsRemaining: 59),
            "AUTO-FIRES IN UNDER 1 MIN")
        XCTAssertEqual(
            TimerCoordinator.formatCountdownReducedMotion(secondsRemaining: 0),
            "AUTO-FIRES NOW")
    }

    // MARK: - tapDecideNow

    func testInviteeTapShortCircuitsWithoutFiringTheRPC() async {
        var rpcCalls = 0
        let coord = TimerCoordinator(
            roomID: UUID(),
            deadlineAt: Date().addingTimeInterval(120),
            isInitiator: false,
            clock: { Date() },
            invoker: { _ in
                rpcCalls += 1
                return .firing
            }
        )
        let outcome = await coord.tapDecideNow()
        XCTAssertEqual(outcome, .notInitiator)
        XCTAssertEqual(coord.lastOutcome, .notInitiator)
        XCTAssertEqual(rpcCalls, 0,
            "expected invitee tap to never hit the RPC")
    }

    func testInitiatorTapFiresTheRPCAndSurfacesTheOutcome() async {
        var rpcCalls = 0
        let roomID = UUID()
        var capturedRoomID: UUID?
        let coord = TimerCoordinator(
            roomID: roomID,
            deadlineAt: Date().addingTimeInterval(120),
            isInitiator: true,
            clock: { Date() },
            invoker: { rid in
                rpcCalls += 1
                capturedRoomID = rid
                return .firing
            }
        )
        let outcome = await coord.tapDecideNow()
        XCTAssertEqual(outcome, .firing)
        XCTAssertEqual(coord.lastOutcome, .firing)
        XCTAssertEqual(rpcCalls, 1)
        XCTAssertEqual(capturedRoomID, roomID)
    }

    func testBelowQuorumOutcomeBubblesThrough() async {
        let coord = TimerCoordinator(
            roomID: UUID(),
            deadlineAt: Date().addingTimeInterval(120),
            isInitiator: true,
            clock: { Date() },
            invoker: { _ in .belowQuorum(voteCount: 1) }
        )
        let outcome = await coord.tapDecideNow()
        XCTAssertEqual(outcome, .belowQuorum(voteCount: 1))
        XCTAssertEqual(coord.lastOutcome, .belowQuorum(voteCount: 1))
    }

    func testIsFiringFlagBlocksRapidDoubleTaps() async {
        // Two taps in rapid succession should fold to one RPC call.
        // We gate by suspending the invoker on a continuation so the
        // second tap arrives while the first is still in flight.
        let resumed = AsyncResume()
        var rpcCalls = 0
        let coord = TimerCoordinator(
            roomID: UUID(),
            deadlineAt: Date().addingTimeInterval(120),
            isInitiator: true,
            clock: { Date() },
            invoker: { _ in
                rpcCalls += 1
                await resumed.wait()
                return .firing
            }
        )
        async let first = coord.tapDecideNow()
        // Yield twice so the first invoker call starts and sets
        // `isFiring` before the second tap is enqueued.
        await Task.yield()
        await Task.yield()
        let second = await coord.tapDecideNow()
        // Now release the first invocation.
        resumed.resume()
        let firstResult = await first
        XCTAssertEqual(rpcCalls, 1,
            "expected the second rapid tap to short-circuit to the in-flight result")
        XCTAssertEqual(firstResult, .firing)
        // Second result is whatever the coordinator decided to surface —
        // either the cached outcome or the in-flight default.
        XCTAssertTrue(second == .firing || second == .firing)
    }
}

/// Tiny helper to hold an async invocation paused until a `resume()`
/// call. The test uses it to keep two concurrent `tapDecideNow` calls
/// observable in a deterministic order.
@MainActor
private final class AsyncResume {
    private var continuation: CheckedContinuation<Void, Never>?
    private var resumed = false

    func wait() async {
        if resumed { return }
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            self.continuation = cont
        }
    }

    func resume() {
        resumed = true
        continuation?.resume()
        continuation = nil
    }
}
