// GetToIt — PostQuizHostScreen smoke tests (TB-19).
//
// Pixel-snapshot tooling is not on the iOS dependency graph (same
// reason as the quiz / waiting screen snapshot tests). Acceptance is
// satisfied by smoke tests that materialise the view body for each
// phase the post-Q5 router can be in: resolving, verdict, failed.

import XCTest
import SwiftUI
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
}
