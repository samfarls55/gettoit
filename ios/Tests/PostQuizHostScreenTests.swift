// GetToIt — PostQuizHostScreen smoke tests (TB-19).
//
// Pixel-snapshot tooling is not on the iOS dependency graph (same
// reason as the quiz / waiting screen snapshot tests). Acceptance is
// satisfied by smoke tests that materialise the view body for each
// phase the post-Q5 router can be in: resolving, verdict, failed.

import XCTest
import SwiftUI
import Supabase
@testable import GetToIt

@MainActor
final class PostQuizHostScreenTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    private func makeHost(
        invitedShared: Bool = false,
        fetchVerdict: @escaping VerdictFetch = { _ in
            VerdictStore.VerdictView(
                verdict: VerdictScreen.Verdict.soloFixture(),
                mode: .solo
            )
        }
    ) -> PostQuizHost {
        PostQuizHost(
            context: PostQuizSessionContext(
                roomID: UUID(),
                userID: UUID(),
                isInitiator: true,
                invitedShared: invitedShared
            ),
            fetchVerdict: fetchVerdict,
            sleep: { _ in }
        )
    }

    // MARK: - phase: resolving

    func testResolvingPhaseRendersWithoutCrashing() {
        // A freshly-built host is in `.resolving` before its poll
        // starts — the neutral hold surface, NOT S00 Landing.
        let host = makeHost()
        render(PostQuizHostScreen(host: host))
    }

    // MARK: - wfr-13 — resolving Escape Hatch

    /// wfr-13 — chrome label is the plain "Cancel" text verb. Matches
    /// the QuizChrome / LockedScreen text-only chrome idiom. NEVER
    /// paraphrase to "Dismiss" / "Back" / an SF Symbol — the locked
    /// constant defends against that drift.
    func testResolvingCancelLabelIsTextVerbCancel() {
        XCTAssertEqual(PostQuizHostScreen.resolvingCancelLabel, "Cancel")
    }

    /// wfr-13 — tapping the resolving Cancel chrome fires `onEndSession`.
    /// The `RootView` call site wires that closure to
    /// `host.teardown() + postQuizHost = nil`, so the user lands back
    /// on S00 Plan list via the precedence chain. This test pins the
    /// closure contract; the screen body and the host wiring are both
    /// covered separately.
    func testResolvingCancelTapInvokesOnEndSession() {
        let host = makeHost()
        var endSessionCalls = 0
        let screen = PostQuizHostScreen(
            host: host,
            onEndSession: { endSessionCalls += 1 }
        )
        // Materialise once so the SwiftUI body has run at least once
        // (mirrors `LockedScreenTests.testHomeChromeTapInvokesOnHome`).
        render(screen)
        screen.simulateResolvingCancelTapForTesting()
        XCTAssertEqual(endSessionCalls, 1)
    }

    /// wfr-13 — and critically: tapping Cancel during `.resolving` does
    /// NOT fire the verdict. The host's poll task is owned by the
    /// surface lifecycle (`.task { await host.start() }`), and
    /// `onEndSession`'s `host.teardown()` cancels it. Asserting at this
    /// level: the host phase stays `.resolving` after the cancel tap,
    /// proving no verdict transition piggybacked on the tap path.
    func testResolvingCancelDoesNotFireTheVerdict() {
        let host = makeHost()
        let screen = PostQuizHostScreen(host: host, onEndSession: { })
        render(screen)
        // Pre-condition: a freshly-built solo host is in `.resolving`.
        guard case .resolving = host.phase else {
            return XCTFail("Pre-condition: solo host must open on .resolving")
        }
        screen.simulateResolvingCancelTapForTesting()
        // Post-condition: the tap path does not transition the host to
        // `.verdict` — the verdict only lands when the poll fires, and
        // the `RootView` cancel wiring tears the poll down rather than
        // resolving it.
        if case .verdict = host.phase {
            XCTFail("Cancel tap must NOT fire the verdict; phase=.verdict")
        }
    }

    /// wfr-13 — render-smoke that the chrome row materialises on the
    /// resolving phase. Defends against the chrome subview panicking on
    /// layout. Mirrors `LockedScreenTests.testRendersWithHomeChromeWired`.
    func testResolvingPhaseRendersWithCancelChromeWired() {
        let host = makeHost()
        render(PostQuizHostScreen(host: host, onEndSession: { }))
    }

    // MARK: - phase: verdict

    func testVerdictPhaseRendersTheVerdictScreen() async throws {
        let host = makeHost()
        await host.start()
        guard case .verdict = host.phase else {
            return XCTFail("host should have resolved to .verdict")
        }
        render(PostQuizHostScreen(host: host))
    }

    // MARK: - phase: failed

    func testFailedPhaseRendersTheRetrySurface() async throws {
        struct Boom: Error {}
        let host = makeHost(fetchVerdict: { _ in throw Boom() })
        await host.start()
        guard case .failed = host.phase else {
            return XCTFail("host should have moved to .failed")
        }
        render(PostQuizHostScreen(host: host))
    }

    // MARK: - phase: waiting (tb-20, group path)

    private func makeAuth() -> AuthCoordinator {
        let url = URL(string: "https://example.supabase.co")!
        return AuthCoordinator(
            client: SupabaseClient(supabaseURL: url, supabaseKey: "anon")
        )
    }

    private func makePromptStore() -> AuthPromptStore {
        let url = URL(string: "https://example.supabase.co")!
        return AuthPromptStore(
            client: SupabaseClient(supabaseURL: url, supabaseKey: "anon")
        )
    }

    /// wfr-17 — the host screen forwards a waiting-Leave tap to the
    /// supplied `onLeaveWaiting` closure. The `RootView` call site
    /// wires that closure to a MemberLeaveStore.leaveAndExpire call
    /// followed by `postQuizHost = nil`, so the precedence chain
    /// returns the user to S00 Plan list. This test pins the
    /// closure contract; the store wiring is covered by
    /// `QuizChromeExitTests.testLeaveAndExpire*`.
    func testWaitingLeaveTapInvokesOnLeaveWaiting() {
        let host = PostQuizHost(
            context: PostQuizSessionContext(
                roomID: UUID(),
                userID: UUID(),
                isInitiator: true,
                invitedShared: true
            ),
            fetchVerdict: { _ in nil },
            fetchSnapshot: { _ in nil },
            sleep: { _ in }
        )
        var leaveCalls = 0
        let screen = PostQuizHostScreen(
            host: host,
            auth: makeAuth(),
            promptStore: makePromptStore(),
            onLeaveWaiting: { leaveCalls += 1 }
        )
        render(screen)
        screen.simulateWaitingLeaveTapForTesting()
        XCTAssertEqual(leaveCalls, 1,
            "expected the waiting-Leave chrome tap to invoke onLeaveWaiting exactly once")
    }

    /// bug-37 — the host screen forwards a WaitingScreen
    /// onSessionEnded fire to the supplied `onSessionEnded` closure.
    /// The `RootView` call site wires that closure to
    /// `host.teardown() + postQuizHost = nil`, so the precedence
    /// chain returns the user to S00 Plan list when the room's
    /// status flips to `.expired` (ADR-0019).
    func testWaitingSessionEndedInvokesOnSessionEnded() {
        let host = PostQuizHost(
            context: PostQuizSessionContext(
                roomID: UUID(),
                userID: UUID(),
                isInitiator: true,
                invitedShared: true
            ),
            fetchVerdict: { _ in nil },
            fetchSnapshot: { _ in nil },
            sleep: { _ in }
        )
        var sessionEndedCalls = 0
        let screen = PostQuizHostScreen(
            host: host,
            auth: makeAuth(),
            promptStore: makePromptStore(),
            onSessionEnded: { sessionEndedCalls += 1 }
        )
        render(screen)
        screen.simulateWaitingSessionEndedForTesting()
        XCTAssertEqual(sessionEndedCalls, 1,
            "expected a waiting-phase session-ended to invoke onSessionEnded exactly once")
    }

    /// bug-37 — when no `onSessionEnded` is supplied, the host
    /// screen falls back to `onEndSession` (same precedent as
    /// `onLeaveWaiting`). This keeps existing call sites that don't
    /// wire the new closure compiling without behaviour drift —
    /// they still tear down the session, just via the generic path.
    func testWaitingSessionEndedFallsBackToOnEndSession() {
        let host = PostQuizHost(
            context: PostQuizSessionContext(
                roomID: UUID(),
                userID: UUID(),
                isInitiator: true,
                invitedShared: true
            ),
            fetchVerdict: { _ in nil },
            fetchSnapshot: { _ in nil },
            sleep: { _ in }
        )
        var endSessionCalls = 0
        let screen = PostQuizHostScreen(
            host: host,
            auth: makeAuth(),
            promptStore: makePromptStore(),
            onEndSession: { endSessionCalls += 1 }
            // onSessionEnded NOT supplied — should default to onEndSession
        )
        render(screen)
        screen.simulateWaitingSessionEndedForTesting()
        XCTAssertEqual(endSessionCalls, 1,
            "expected the fallback path to invoke onEndSession when onSessionEnded is not supplied")
    }

    func testWaitingPhaseRendersTheWaitingScreen() {
        // A group session opens on `.waiting` — the screen materialises
        // the S04 Waiting surface, NOT the neutral resolving hold.
        let host = PostQuizHost(
            context: PostQuizSessionContext(
                roomID: UUID(),
                userID: UUID(),
                isInitiator: true,
                invitedShared: true
            ),
            fetchVerdict: { _ in nil },
            fetchSnapshot: { _ in nil },
            sleep: { _ in }
        )
        guard case .waiting = host.phase else {
            return XCTFail("a group host should open on .waiting")
        }
        render(
            PostQuizHostScreen(
                host: host,
                auth: makeAuth(),
                promptStore: makePromptStore()
            )
        )
    }
}
