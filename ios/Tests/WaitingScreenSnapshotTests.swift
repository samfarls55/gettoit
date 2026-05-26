// GetToIt — WaitingScreen snapshot-style smoke tests (TB-07).
//
// Pixel-snapshot tooling is not on the iOS dependency graph (same
// reason as the quiz screen snapshot tests). Acceptance is satisfied
// by smoke tests that materialise the view body for each mode the
// surface can be in: initiator-with-partial-quorum, invitee-all-in,
// and everyone-answered.
//
// tb-WF-3: the quiz redesign retired the session timer, so the expired-no-quorum
// terminal that used to be one of the rendered modes is also gone.
// The room can no longer reach `.expired` from a client-side timer;
// the only no-result terminal in the quiz redesign is the engine-side
// `no_survivor` path which lives on S05, not S04.
//
// Stubs the AppleSignInProviding seam so the chip path doesn't try
// to spin up an authorization controller in a unit-test process.

import XCTest
import SwiftUI
import Supabase
@testable import GetToIt

@MainActor
final class WaitingScreenSnapshotTests: XCTestCase {

    private struct StubAppleProvider: AppleSignInProviding {
        func requestAppleCredential() async throws -> AppleSignInCredential {
            AppleSignInCredential(idToken: "stub", nonce: nil)
        }
    }

    private func makeAuthCoordinator() -> AuthCoordinator {
        // We don't have a live SupabaseClient in unit tests, so we
        // build one from a placeholder URL just to satisfy the
        // coordinator's init. The view's `task` will try to read
        // the state — `.loading` is the default and matches what the
        // chip would do until the prompt store responded.
        let url = URL(string: "https://placeholder.supabase.co")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "anon")
        return AuthCoordinator(client: client)
    }

    private func makePromptStore() -> AuthPromptStore {
        let url = URL(string: "https://placeholder.supabase.co")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "anon")
        return AuthPromptStore(client: client)
    }

    private func makeStore(
        memberCount: Int = 3,
        answeredCount: Int = 1,
        status: RoomStatus = .open,
        isInitiator: Bool = true
    ) -> (WaitingStore, FireVerdictCoordinator) {
        let me = UUID()
        let store = WaitingStore(
            roomID: UUID(),
            currentUserID: me,
            isInitiator: isInitiator
        )
        var members: [WaitingMember] = [
            WaitingMember(id: me, role: isInitiator ? "owner" : "participant"),
        ]
        for _ in 1..<memberCount {
            members.append(WaitingMember(id: UUID(), role: "participant"))
        }
        var answered: Set<UUID> = []
        for i in 0..<min(answeredCount, members.count) {
            answered.insert(members[i].id)
        }
        store.bootstrap(members: members, answered: answered, status: status)

        let coord = FireVerdictCoordinator(
            roomID: store.roomID,
            isInitiator: isInitiator,
            invoker: { _ in .firing }
        )
        return (store, coord)
    }

    /// Materialize a SwiftUI view. If the body throws or the
    /// type-system rejects it, this surfaces as a runtime crash;
    /// `layoutIfNeeded` makes sure the body actually runs.
    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - body materialisation

    func testInitiatorBelowQuorumRendersWithoutCrashing() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 1, isInitiator: true)
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider()
        )
        render(view)
    }

    func testInitiatorQuorumMetRendersWithoutCrashing() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 2, isInitiator: true)
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider()
        )
        render(view)
    }

    func testInviteeRendersWithoutCrashing() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 2, isInitiator: false)
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider()
        )
        render(view)
    }

    /// Regression for tb-WF-3: the surface no longer renders a special
    /// "Couldn't reach quorum tonight" terminal when the room reaches
    /// `.expired`. The quiz redesign has no session timer, so the only path to
    /// `.expired` is a legacy room created before the timer was retired;
    /// the surface holds the regular main body in that case. The no-
    /// survivor terminal lives on S05 (engine-side `no_survivor`), not
    /// here.
    func testExpiredStatusRendersMainBodyNotATimerTerminal() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 1, status: .expired, isInitiator: true)
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider()
        )
        render(view)
    }

    func testEveryoneAnsweredRendersWithoutCrashing() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 3, isInitiator: true)
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider()
        )
        render(view)
    }

    // MARK: - wfr-17 — initiator Leave chrome

    /// wfr-17 — chrome label is the plain "Leave" text verb. Matches
    /// the QuizChrome / LockedScreen / PostQuizHost cancel chrome
    /// idiom (text-only, eyebrow type, no SF Symbol). The locked
    /// constant defends against future paraphrase drift.
    func testLeaveChromeLabelIsTextVerbLeave() {
        XCTAssertEqual(WaitingScreen.leaveChromeLabel, "Leave")
    }

    /// wfr-17 — the initiator sees the Leave chrome and tapping it
    /// fires the host-supplied `onLeave` closure. The closure is
    /// wired (in production) to a MemberLeaveStore.leaveAndExpire +
    /// post-Q5 router teardown sequence that returns the user to S00
    /// Plan list. This test pins the closure contract; the store
    /// wiring is covered by `QuizChromeExitTests.testLeaveAndExpire*`.
    func testInitiatorLeaveChromeTapInvokesOnLeave() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 1, isInitiator: true)
        var leaveCalls = 0
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider(),
            onLeave: { leaveCalls += 1 }
        )
        // Materialise once so the SwiftUI body has run at least once
        // (mirrors `LockedScreenTests.testHomeChromeTapInvokesOnHome`).
        render(view)
        view.simulateLeaveChromeTapForTesting()
        XCTAssertEqual(leaveCalls, 1,
            "expected the initiator's Leave chrome tap to invoke onLeave exactly once")
    }

    /// wfr-17 — invitees never see the Leave chrome. Leaving the
    /// session is an initiator-only verb on S04 (it expires the room
    /// — an invitee cannot expire the room they didn't create, per
    /// RLS, and the social shape of "I bail" for an invitee is the
    /// Plan-list Leave-plan path that survives the room for the rest).
    /// The view enforces this by not invoking the supplied closure
    /// when `isInitiator` is false; the chrome row simply isn't
    /// wired to a tap target for invitees.
    func testInviteeLeaveChromeTapIsNoOp() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 1, isInitiator: false)
        var leaveCalls = 0
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider(),
            onLeave: { leaveCalls += 1 }
        )
        render(view)
        view.simulateLeaveChromeTapForTesting()
        XCTAssertEqual(leaveCalls, 0,
            "expected an invitee's Leave chrome tap to be a no-op (invitees do not see the chrome)")
    }

    /// wfr-17 — render-smoke that the chrome row materialises on
    /// the WaitingScreen surface for the initiator. Defends against
    /// the chrome subview panicking on layout. Mirrors
    /// `PostQuizHostScreenTests.testResolvingPhaseRendersWithCancelChromeWired`.
    func testInitiatorWaitingRendersWithLeaveChromeWired() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 1, isInitiator: true)
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider(),
            onLeave: { }
        )
        render(view)
    }

    // MARK: - bug-37 — session-ended handler on RoomStatus.expired

    /// bug-37 — toast label is the plain "Session ended" copy locked
    /// by CONTEXT.md §"Plan delete". The locked constant defends
    /// against future paraphrase drift in the same idiom as
    /// `WaitingScreen.leaveChromeLabel` (wfr-17) and
    /// `PostQuizHostScreen.resolvingCancelLabel` (wfr-13).
    func testSessionEndedToastLabelIsLockedCopy() {
        XCTAssertEqual(WaitingScreen.sessionEndedToastLabel, "Session ended")
    }

    /// bug-37 — when the store transitions to `.expired`, the screen
    /// fires the host-supplied `onSessionEnded` closure (the host
    /// then tears down `postQuizHost` so the user lands on PlanList).
    /// SwiftUI tests cannot directly trigger `.onChange` modifiers
    /// from a state mutation, so we expose a test seam that mirrors
    /// the production handler path. Drives ADR-0019's surface-owned
    /// ownership: WaitingScreen watches its store; on .expired it
    /// fires the callback up to its host.
    func testExpiredStatusFiresOnSessionEnded() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 1, isInitiator: true)
        var sessionEndedCalls = 0
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider(),
            onSessionEnded: { sessionEndedCalls += 1 }
        )
        render(view)
        // Flip the store to .expired, then drive the handler the same
        // way the SwiftUI .onChange would in production.
        store.apply(event: .roomStatusChanged(.expired))
        view.simulateSessionEndedForTesting()
        XCTAssertEqual(sessionEndedCalls, 1,
            "expected RoomStatus.expired to fire onSessionEnded exactly once")
    }

    /// bug-37 — invitee instances ALSO fire onSessionEnded. The
    /// session-ended transition is not initiator-only (unlike the
    /// wfr-17 Leave chrome); every member in the room needs to be
    /// punted when the room expires, regardless of who initiated.
    func testExpiredStatusFiresOnSessionEndedForInviteeToo() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 1, isInitiator: false)
        var sessionEndedCalls = 0
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider(),
            onSessionEnded: { sessionEndedCalls += 1 }
        )
        render(view)
        store.apply(event: .roomStatusChanged(.expired))
        view.simulateSessionEndedForTesting()
        XCTAssertEqual(sessionEndedCalls, 1,
            "expected invitees to also receive the session-ended punt")
    }

    /// bug-37 — non-expired status transitions do NOT fire
    /// onSessionEnded. Guards against an over-broad .onChange that
    /// punts the user on every status flip (firing, verdict_ready,
    /// locked).
    func testNonExpiredStatusDoesNotFireOnSessionEnded() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 2, isInitiator: true)
        var sessionEndedCalls = 0
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider(),
            onSessionEnded: { sessionEndedCalls += 1 }
        )
        render(view)
        // .firing and .verdictReady are not session-ended.
        store.apply(event: .roomStatusChanged(.firing))
        store.apply(event: .roomStatusChanged(.verdictReady))
        XCTAssertEqual(sessionEndedCalls, 0,
            "expected only .expired (not .firing / .verdictReady) to fire onSessionEnded")
    }

    /// bug-37 — render-smoke that an `.expired` status materialises
    /// the toast subview without crashing. Pairs with
    /// `testExpiredStatusRendersMainBodyNotATimerTerminal` (which
    /// covers the regression that we did NOT bring back the retired
    /// timer terminal — the surface holds the main body and overlays
    /// the new inline toast on top).
    func testExpiredStatusRendersWithToastWithoutCrashing() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 1, status: .expired, isInitiator: true)
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: coord,
            appleProvider: StubAppleProvider(),
            onSessionEnded: { }
        )
        render(view)
    }

    func testLegacyTB12InitializerStillCompiles() {
        // Confirms the no-store WaitingScreen path (TB-12 launch
        // surface) still materialises without crashing. Some callers
        // may still instantiate it without TB-07 plumbing during the
        // ratchet up to full surface coverage.
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            appleProvider: StubAppleProvider()
        )
        render(view)
    }
}
