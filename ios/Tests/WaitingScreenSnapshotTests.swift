// GetToIt — WaitingScreen snapshot-style smoke tests (TB-07).
//
// Pixel-snapshot tooling is not on the iOS dependency graph (same
// reason as the quiz screen snapshot tests). Acceptance is satisfied
// by smoke tests that materialise the view body for each mode the
// surface can be in: initiator-with-quorum, invitee-pre-quorum, and
// the expired-no-quorum terminal.
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
    ) -> (WaitingStore, TimerCoordinator) {
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

        let coord = TimerCoordinator(
            roomID: store.roomID,
            deadlineAt: Date().addingTimeInterval(462),
            isInitiator: isInitiator,
            clock: { Date() },
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
            timerCoordinator: coord,
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
            timerCoordinator: coord,
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
            timerCoordinator: coord,
            appleProvider: StubAppleProvider()
        )
        render(view)
    }

    func testExpiredTerminalRendersWithoutCrashing() {
        let (store, coord) = makeStore(memberCount: 3, answeredCount: 1, status: .expired, isInitiator: true)
        let view = WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            timerCoordinator: coord,
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
            timerCoordinator: coord,
            appleProvider: StubAppleProvider()
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
