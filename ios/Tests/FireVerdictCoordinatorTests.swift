// GetToIt — FireVerdictCoordinator tests (tb-WF-3).
//
// Pure-logic tests with an injected invoker stub. No Supabase, no
// timer (none exists in the quiz redesign). Covers:
//   * `tapDecideNow()` short-circuits for invitees (no RPC fired).
//   * `tapDecideNow()` folds in-flight rapid taps into one call.
//   * Outcomes from the RPC seam surface on `lastOutcome` for the
//     view layer to render.

import XCTest
@testable import GetToIt

@MainActor
final class FireVerdictCoordinatorTests: XCTestCase {

    // MARK: - tapDecideNow

    func testInviteeTapShortCircuitsWithoutFiringTheRPC() async {
        var rpcCalls = 0
        let coord = FireVerdictCoordinator(
            roomID: UUID(),
            isInitiator: false,
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
        let coord = FireVerdictCoordinator(
            roomID: roomID,
            isInitiator: true,
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
        let coord = FireVerdictCoordinator(
            roomID: UUID(),
            isInitiator: true,
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
        let coord = FireVerdictCoordinator(
            roomID: UUID(),
            isInitiator: true,
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
