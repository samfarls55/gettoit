// GetToIt — JoinScreen Cancel + Back tests (wfr-14).
//
// The `.joining` phase shows a progress spinner with no abort path
// today, and the `.error` phase shows a message with no back/retry
// link. wfr-14 adds:
//
//   * A "Cancel" affordance during `.joining` that fires `onCancel`.
//   * A "Try another link" affordance during `.error` that also fires
//     `onCancel`. The label is intentionally a re-invite framing (per
//     the Escape Hatch + Error Messages patterns — name the action,
//     name the fix), and reuses the same closure because both paths
//     have the same effect at the RootView seam: clear `deepLink` and
//     return to S00 Plan list.
//   * Public static labels + test seams (`simulateCancelTapForTesting`,
//     `simulateBackTapForTesting`) so SwiftUI Button taps can be
//     exercised in unit tests without a full hosting + hit-test rig.
//
// Same SwiftUI "smoke + spec" test pattern used by LockedScreenTests
// (wfr-12) and the other surface tests.

import XCTest
import SwiftUI
import Supabase
@testable import GetToIt

@MainActor
final class JoinScreenCancelAndBackTests: XCTestCase {

    // MARK: - render helpers

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    private func makeFixtures() -> (InviteLink.Payload, AuthCoordinator, RoomStore) {
        let payload = InviteLink.Payload(roomID: UUID(), inviteToken: "tok-wfr-14")
        let url = URL(string: "https://example.invalid")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "stub")
        let auth = AuthCoordinator(client: client)
        let roomStore = RoomStore(client: client)
        return (payload, auth, roomStore)
    }

    // MARK: - copy register (wfr-14 AC: Cancel + Try another link labels)

    func testCancelLabelMatchesEscapeHatchSpec() {
        // Escape Hatch pattern (patterns#Escape Hatch) — "Cancel" is the
        // plain, voluntary verb the pattern names explicitly for the
        // limited-nav loading screen path. Keep this label in lock-step
        // with the dialog/loader Cancel buttons elsewhere in the app.
        XCTAssertEqual(JoinScreen.cancelLabel, "Cancel")
    }

    func testBackLabelMatchesErrorMessagesSpec() {
        // Error Messages pattern (patterns#Error Messages) — name the
        // fix, not just the failure. The invite link is dead end; the
        // recovery is "try a different one." Re-invite framing keeps
        // the warm-friend register (AGENTS.md product invariant #1) —
        // never sterile "Back" or "Retry."
        XCTAssertEqual(JoinScreen.backLabel, "Try another link")
    }

    // MARK: - render smoke (defends against the new chrome panicking)

    func testRendersJoiningPhaseWithCancelWired() {
        let (payload, auth, roomStore) = makeFixtures()
        let screen = JoinScreen(
            payload: payload,
            auth: auth,
            roomStore: roomStore,
            phase: .joining,
            onCancel: { }
        )
        render(screen)
    }

    func testRendersErrorPhaseWithCancelWired() {
        let (payload, auth, roomStore) = makeFixtures()
        let screen = JoinScreen(
            payload: payload,
            auth: auth,
            roomStore: roomStore,
            phase: .error("This invite link is no longer valid."),
            onCancel: { }
        )
        render(screen)
    }

    // MARK: - Cancel during .joining (AC: Cancel clears deepLink → PlanList)

    func testCancelTapDuringJoiningInvokesOnCancel() {
        // wfr-14 AC: Cancel affordance visible during `.joining`.
        // Tap drives the closure. RootView clears `deepLink` in the
        // wired-up handler so the user lands back on S00 — the closure
        // is the seam, the navigation is the host's responsibility.
        var taps = 0
        let (payload, auth, roomStore) = makeFixtures()
        let screen = JoinScreen(
            payload: payload,
            auth: auth,
            roomStore: roomStore,
            phase: .joining,
            onCancel: { taps += 1 }
        )
        screen.simulateCancelTapForTesting()
        XCTAssertEqual(taps, 1)
    }

    // MARK: - Back during .error (AC: Back / Try another link on .error)

    func testBackTapDuringErrorInvokesOnCancel() {
        // wfr-14 AC: Back / "Try another link" visible on `.error`.
        // Same closure as Cancel — the RootView seam treats both as
        // "abandon this deep-link." Sharing the closure also means
        // there is only one navigation destination per the Escape
        // Hatch pattern ("multiple escape hatches with different
        // destinations on the same screen" = anti-pattern).
        var taps = 0
        let (payload, auth, roomStore) = makeFixtures()
        let screen = JoinScreen(
            payload: payload,
            auth: auth,
            roomStore: roomStore,
            phase: .error("Couldn't sign in."),
            onCancel: { taps += 1 }
        )
        screen.simulateBackTapForTesting()
        XCTAssertEqual(taps, 1)
    }

    // MARK: - default closure (backwards-compat for pre-wfr-14 call sites)

    func testOnCancelDefaultsToNoOp() {
        // Mirrors how LockedScreen.onHome defaulted to `{}` when wfr-12
        // landed — pre-existing call sites + design-system parity
        // previews don't have to pass the closure.
        let (payload, auth, roomStore) = makeFixtures()
        let screen = JoinScreen(
            payload: payload,
            auth: auth,
            roomStore: roomStore,
            phase: .joining
        )
        // Should not crash:
        screen.simulateCancelTapForTesting()
        screen.simulateBackTapForTesting()
    }
}
