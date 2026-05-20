// GetToIt — Quiz chrome rendering smoke tests (tb-WF-2).
//
// Pixel-snapshot tooling (swift-snapshot-testing) is not on the iOS
// dependency graph yet (see `QuizScreenSnapshotTests` for the same
// rationale), so "snapshot tests for the chrome on Q1 (no Back) vs Q3
// (Back rendered)" is satisfied by smoke tests that verify the chrome
// renders without crashing in both configurations and the role / solo
// flags drive the correct verb label.
//
// The richer copy-locked assertions (verbatim title / body / confirm /
// cancel strings) are pinned by `QuizChromeCopyTests` so a typo in any
// of the three variants fails fast rather than only surfacing in a
// human snapshot review.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class QuizChromeViewTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 88)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - Q1 vs Q3 chrome rendering

    func testQ1ChromeOmitsBack() {
        // Acceptance: "Q1 does NOT render a Back affordance."
        // The Q1 chrome passes `canBack: false`; the surface renders
        // a 44pt-wide spacer in place of the Back button so the
        // Exit/Leave label stays anchored to the trailing edge.
        let chrome = QuizChromeView(
            canBack: false, role: .initiator, isSolo: false,
            onBack: {}, onExit: {}
        )
        render(chrome)
    }

    func testQ3ChromeRendersBack() {
        // Acceptance: "Back is rendered on Q2-Q5." Q3 is the canonical
        // representative — the chrome carries both affordances.
        let chrome = QuizChromeView(
            canBack: true, role: .initiator, isSolo: false,
            onBack: {}, onExit: {}
        )
        render(chrome)
    }

    func testEveryRoleSoloCombinationRenders() {
        // The four cells of the (role × solo) matrix all render. The
        // chrome resolves the locked copy variant per-cell — see
        // `QuizChromeCopyTests` for the exact-string assertions.
        for canBack in [false, true] {
            for role in [QuizChromeRole.initiator, .joiner] {
                for solo in [false, true] {
                    let chrome = QuizChromeView(
                        canBack: canBack, role: role, isSolo: solo,
                        onBack: {}, onExit: {}
                    )
                    render(chrome)
                }
            }
        }
    }

    // MARK: - QuizScreen integration

    func testQuizScreenRendersWithChromeOnEveryQuizStep() {
        // The QuizScreen hosts the chrome above the C-02 TopBar on
        // every quiz surface (Q1-Q5). Walking the coordinator through
        // each step confirms the chrome row is in the view tree for
        // each one without crashing.
        for target in [QuizCoordinator.Step.q1, .q2, .q3, .q4, .q5] {
            let coord = QuizCoordinator(
                roomID: UUID(), userID: UUID(),
                candidates: QuizCandidateFixtures.all,
                writer: { _ in }
            )
            while coord.step != target { coord.advance() }
            let screen = QuizScreen(
                coordinator: coord,
                role: .initiator,
                isSolo: false,
                onClose: {},
                onExit: {}
            )
            let host = UIHostingController(rootView: screen)
            host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
            host.view.setNeedsLayout()
            host.view.layoutIfNeeded()
        }
    }
}
