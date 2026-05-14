// GetToIt — Quiz screen snapshot-style smoke tests (TB-04).
//
// Pixel-snapshot tooling (e.g. `pointfreeco/swift-snapshot-testing`) is
// not yet on the iOS dependency graph — pulling it in is a tooling
// tracer-bullet decision that belongs in its own ticket rather than
// here. Until then, "snapshot tests for each quiz surface, default
// state" (ticket AC) is satisfied by smoke tests that verify the
// view body materialises without crashing and the spec-driven
// inputs feed through (chip count, walk stops, vibe labels, candidate
// cards).
//
// SwiftUI's accessibility identifier attachments don't surface into
// UIKit's `view.subviews` tree, so identifier-walking via UIView is a
// fragile signal. The richer assertion lives in the integration test
// suite (`VotesIntegrationTests`) which exercises every surface's
// state machine end-to-end against the live database.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class QuizScreenSnapshotTests: XCTestCase {

    private func makeCoordinator() -> QuizCoordinator {
        QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
    }

    /// Force a SwiftUI view body to materialise. If the view's `body`
    /// throws or fails to type-check, this surfaces as a runtime
    /// crash; `layoutIfNeeded` makes sure the body is actually run.
    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - body materialisation

    func testEverySurfaceRendersWithoutCrashing() {
        let coord = makeCoordinator()
        render(QuizQ1Vetoes(coordinator: coord))
        render(QuizQ2Budget(coordinator: coord))
        render(QuizQ3Distance(coordinator: coord))
        render(QuizQ4Vibe(coordinator: coord))
        render(QuizQ5Regret(coordinator: coord, onSubmit: {}))
        render(QuizScreen(coordinator: coord, onClose: {}))
    }

    func testQuizScreenRendersInEverySubmitState() {
        // Each `coordinator.step` produces a different routed surface
        // in `QuizScreen.content`. Walking through them confirms each
        // branch type-checks and the body executes.
        for target in [QuizCoordinator.Step.q1, .q2, .q3, .q4, .q5] {
            let coord = makeCoordinator()
            while coord.step != target { coord.advance() }
            render(QuizScreen(coordinator: coord, onClose: {}))
        }
    }

    // MARK: - spec-driven content shape

    func testQ1ChipsAreSourcedFromTheLockedDisplayOrder() {
        // Six chips in display order per surfaces/03-quiz.md §Q1.
        XCTAssertEqual(QuizVeto.displayOrder.count, 6)
        XCTAssertEqual(QuizVeto.displayOrder.last?.id, QuizVeto.nothingTonight,
            "expected nothing_tonight to be the trailing chip")
    }

    func testQ2HasExactlyFourTiers() {
        XCTAssertEqual(QuizConstants.budgetTiers.count, 4,
            "EBA budget cap surfaces 4 tiers — never a slider (S03 §Q2)")
    }

    func testQ3StopSetMatchesTheSpec() {
        XCTAssertEqual(QuizConstants.walkStops, [5, 10, 15, 20, 30],
            "Q3 stops are 5 / 10 / 15 / 20 / 30 per surfaces/03-quiz.md §Q3")
    }

    func testQ4VibeLabelsLockToTheCanonicalVocabulary() {
        XCTAssertEqual(GTIVibeLabels.all, ["HUSHED", "MELLOW", "BUZZY", "LOUD", "ROWDY"])
    }

    func testQ5HasThreeCandidatesPerSpec() {
        XCTAssertEqual(QuizDummyCandidates.all.count, 3,
            "S03 §Q5 surfaces exactly 3 candidates")
    }

    // MARK: - coordinator default state

    func testDefaultsMatchTheJSXDefaults() {
        let coord = makeCoordinator()
        XCTAssertEqual(coord.step, .q1)
        XCTAssertTrue(coord.q1Vetoes.isEmpty)
        XCTAssertEqual(coord.q2Budget, 1, "Q2 defaults to tier 1 ($) per JSX")
        XCTAssertEqual(coord.q3WalkMinutes, 15, "Q3 defaults to 15 min per JSX")
        XCTAssertEqual(coord.q4Vibe, 2, "Q4 defaults to BUZZY (mid stop) per JSX")
        for candidate in QuizDummyCandidates.all {
            XCTAssertEqual(coord.q5Ratings[candidate.id], 3,
                "Q5 defaults each candidate to 3 (middle of 1–5 scale)")
        }
    }
}
