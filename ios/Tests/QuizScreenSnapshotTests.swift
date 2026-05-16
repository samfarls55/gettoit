// GetToIt — Quiz screen snapshot-style smoke tests (TB-04 / TB-06).
//
// Pixel-snapshot tooling (e.g. `pointfreeco/swift-snapshot-testing`) is
// not yet on the iOS dependency graph — pulling it in is a tooling
// tracer-bullet decision that belongs in its own ticket rather than
// here. Until then, "snapshot tests for each quiz surface, default
// state" (ticket AC) is satisfied by smoke tests that verify the
// view body materialises without crashing and the spec-driven
// inputs feed through (chip count, reputation chips, vibe labels,
// candidate cards).
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
        render(QuizQ1Cuisine(coordinator: coord))
        render(QuizQ2Budget(coordinator: coord))
        render(QuizQ3Reputation(coordinator: coord))
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

    func testQ1RendersAtTheCuisineCap() {
        // The Q1 surface dims unselected chips once 3 cuisines are
        // picked — render that state to confirm the disabled-chip
        // branch type-checks and materialises.
        let coord = makeCoordinator()
        coord.toggleCuisine(QuizCuisine.mexican)
        coord.toggleCuisine(QuizCuisine.italian)
        coord.toggleCuisine(QuizCuisine.japanese)
        render(QuizQ1Cuisine(coordinator: coord))
    }

    // MARK: - spec-driven content shape

    func testQ1CuisineChipsAreSourcedFromTheLockedDisplayOrder() {
        // Cuisine chips render in the locked display order.
        XCTAssertFalse(QuizCuisine.displayOrder.isEmpty)
        XCTAssertEqual(QuizCuisine.displayOrder.first?.id, QuizCuisine.mexican)
    }

    func testQ1CuisineCapIsThree() {
        XCTAssertEqual(QuizCoordinator.cuisineCap, 3,
            "Q1 caps cuisine craving at 3 picks per surfaces/03-quiz.md §Q1")
    }

    func testQ2HasExactlyFourTiers() {
        XCTAssertEqual(QuizConstants.budgetTiers.count, 4,
            "EBA spend cap surfaces 4 tiers — never a slider (S03 §Q2)")
    }

    func testQ3ReputationChipsMatchTheSpec() {
        let ids = QuizReputation.all.map(\.id)
        XCTAssertEqual(ids, [
            QuizReputation.popular,
            QuizReputation.hiddenGem,
            QuizReputation.classic,
            QuizReputation.new,
            QuizReputation.noPreference,
        ], "Q3 chips are Popular / Hidden gem / Classic / New / No preference per S03 §Q3")
    }

    func testQ4VibeLabelsLockToTheV11EnergyVocabulary() {
        XCTAssertEqual(GTIVibeLabels.all, ["QUIET", "CHILL", "SOCIAL", "LIVELY", "ROWDY"])
    }

    func testQ5HasThreeCandidatesPerSpec() {
        XCTAssertEqual(QuizDummyCandidates.all.count, 3,
            "S03 §Q5 surfaces exactly 3 candidates")
    }

    // MARK: - coordinator default state

    func testDefaultsMatchTheSpecDefaults() {
        let coord = makeCoordinator()
        XCTAssertEqual(coord.step, .q1)
        XCTAssertTrue(coord.q1Cuisines.isEmpty)
        XCTAssertFalse(coord.q1NoPreference)
        XCTAssertEqual(coord.q2Budget, 1, "Q2 defaults to tier 1 ($)")
        XCTAssertEqual(coord.q3Reputation, QuizReputation.noPreference,
            "Q3 defaults to No preference — the neutral, non-pruning answer")
        XCTAssertEqual(coord.q4Vibe, 2, "Q4 defaults to the mid energy stop")
        for candidate in QuizDummyCandidates.all {
            XCTAssertEqual(coord.q5Ratings[candidate.id], 3,
                "Q5 defaults each candidate to 3 (middle of 1–5 scale)")
        }
    }
}
