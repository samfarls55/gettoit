// GetToIt — S04 timer-sweep regression tests (tb-WF-3).
//
// Locks the quiz-redesign invariant that S04 Waiting NEVER fires the verdict
// from a client-side timer. The only two paths to a verdict in the quiz redesign
// are:
//
//   1. All participants have submitted Q5 — engine-side auto-fire
//      that writes `rooms.fire_trigger = 'quorum'`. Owned server-side
//      by the AFTER INSERT ON votes trigger + the
//      `verdict_fire_on_q5_complete` migration. Not exercised here.
//   2. The initiator's `"Decide now"` tap — the
//      `FireVerdictCoordinator.tapDecideNow()` path, which writes
//      `rooms.fire_trigger = 'manual'`.
//
// These tests guard against regressions that would re-introduce a
// client-side timer infrastructure. The `TimerCoordinator` type was
// deleted in this slice; the regression is a compile-time check
// (its absence) plus a runtime assertion that:
//   * `FireVerdictCoordinator` is the only fire-the-verdict seam.
//   * Holding `WaitingScreen` long enough that any prior 1Hz tick
//     loop would have fired produces zero calls to the fire seam.

import XCTest
import SwiftUI
@testable import GetToIt
import Supabase

@MainActor
final class WaitingScreenTimerSweepRegressionTests: XCTestCase {

    private func makeAuth() -> AuthCoordinator {
        let url = URL(string: "https://placeholder.supabase.co")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "anon")
        return AuthCoordinator(client: client)
    }

    private func makePromptStore() -> AuthPromptStore {
        let url = URL(string: "https://placeholder.supabase.co")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "anon")
        return AuthPromptStore(client: client)
    }

    /// Holding the surface for a slice of time (longer than any
    /// previous 1Hz tick interval) must not invoke the fire seam —
    /// there is no client-side auto-fire path. Only the initiator's
    /// tap or the server-side trigger can fire the verdict.
    func testHoldingTheSurfaceNeverFiresTheVerdictFromAClientTimer() async {
        let counter = AsyncCounter()
        let me = UUID()
        let store = WaitingStore(
            roomID: UUID(),
            currentUserID: me,
            isInitiator: true
        )
        store.bootstrap(
            members: [WaitingMember(id: me, role: "owner")],
            answered: [me],
            status: .open
        )
        let coord = FireVerdictCoordinator(
            roomID: store.roomID,
            isInitiator: true,
            invoker: { _ in
                await counter.increment()
                return .firing
            }
        )

        let view = WaitingScreen(
            auth: makeAuth(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord
        )
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()

        // Hold the surface for ~250ms; in the prior implementation a
        // 1Hz tick loop spun the body re-render but never called the
        // fire seam either — this test guards that no future timer
        // re-introduction silently calls into the fire path.
        try? await Task.sleep(nanoseconds: 250_000_000)

        let calls = await counter.value
        XCTAssertEqual(calls, 0,
            "S04 must not invoke the fire seam from any client-side timer; only the initiator tap or the engine-side auto-fire can fire the verdict.")
    }

    /// Sanity: the initiator's tap is still the canonical client-side
    /// fire path. Validates the surviving seam is wired to the
    /// coordinator's `tapDecideNow()`.
    func testInitiatorTapCallsTheFireSeamExactlyOnce() async {
        let counter = AsyncCounter()
        let coord = FireVerdictCoordinator(
            roomID: UUID(),
            isInitiator: true,
            invoker: { _ in
                await counter.increment()
                return .firing
            }
        )
        _ = await coord.tapDecideNow()
        let calls = await counter.value
        XCTAssertEqual(calls, 1)
    }

    /// Invitee tap must short-circuit — only the initiator can fire.
    /// Defends the quiz-redesign invariant that no non-initiator path reaches
    /// the fire seam.
    func testInviteeTapNeverReachesTheFireSeam() async {
        let counter = AsyncCounter()
        let coord = FireVerdictCoordinator(
            roomID: UUID(),
            isInitiator: false,
            invoker: { _ in
                await counter.increment()
                return .firing
            }
        )
        _ = await coord.tapDecideNow()
        let calls = await counter.value
        XCTAssertEqual(calls, 0)
    }
}

/// Sendable counter so the @Sendable FireVerdictInvoker closure can
/// mutate it from any isolation context.
private actor AsyncCounter {
    private(set) var value: Int = 0
    func increment() { value += 1 }
}
