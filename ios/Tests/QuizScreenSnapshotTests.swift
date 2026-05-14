// GetToIt — Quiz screen snapshot-style tests (TB-04).
//
// SwiftUI doesn't ship a built-in pixel-snapshot helper, and pulling in
// `pointfreeco/swift-snapshot-testing` for a single ticket is overkill.
// Instead, the per-surface tests exercise the surfaces' view body
// through SwiftUI's `_PreviewHost`-style introspection: we materialise
// each view, sanity-check that the identifier hooks expected by the
// design-system port are present, and verify state-driven branches
// (selected vs. unselected, default value rendering) flow through.
//
// Pixel-level visual regression is verified manually against the
// JSX prototype per `motion.md` §"Verification before 'done'". The
// drift gate in `design-system/scripts/verify.mjs` keeps tokens
// honest at the token layer.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class QuizScreenSnapshotTests: XCTestCase {

    private func makeCoordinator() -> QuizCoordinator {
        QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
    }

    /// Render a SwiftUI view into a host UIWindow so its `body` is
    /// actually invoked. Inspecting the rendered output for accessibility
    /// identifiers gives a stand-in for a pixel snapshot — the JSX has
    /// no inspector either, so this is the parity test.
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.layoutIfNeeded()
        return host.view
    }

    private func identifiers(in view: UIView) -> Set<String> {
        var ids: Set<String> = []
        if let id = view.accessibilityIdentifier { ids.insert(id) }
        for sub in view.subviews { ids.formUnion(identifiers(in: sub)) }
        return ids
    }

    // MARK: - per-surface defaults

    func testQ1RendersExpectedChipIdentifiers() {
        let coord = makeCoordinator()
        let view = QuizQ1Vetoes(coordinator: coord)
        let ids = identifiers(in: render(view))

        for entry in QuizVeto.displayOrder {
            XCTAssertTrue(ids.contains("quiz.q1.chip.\(entry.id)"),
                "expected Q1 to render chip \(entry.id), got identifiers: \(ids)")
        }
        XCTAssertTrue(ids.contains("quiz.header.title.q1"))
        XCTAssertTrue(ids.contains("quiz.cta.paper"),
            "expected Q1 to render the paper-fill primary CTA")
    }

    func testQ2RendersAllFourTierRows() {
        let coord = makeCoordinator()
        let view = QuizQ2Budget(coordinator: coord)
        let ids = identifiers(in: render(view))

        for i in 1...4 {
            XCTAssertTrue(ids.contains("quiz.q2.tier.\(i)"),
                "expected Q2 to render tier \(i), got identifiers: \(ids)")
        }
        XCTAssertTrue(ids.contains("quiz.header.title.q2"))
    }

    func testQ3RendersDefaultWalkValueAndAllStopButtons() {
        let coord = makeCoordinator()
        let view = QuizQ3Distance(coordinator: coord)
        let ids = identifiers(in: render(view))

        for stop in QuizConstants.walkStops {
            XCTAssertTrue(ids.contains("quiz.q3.stop.\(stop)"),
                "expected Q3 to render stop \(stop)")
        }
        XCTAssertTrue(ids.contains("quiz.q3.value"))
        XCTAssertEqual(coord.q3WalkMinutes, 15, "expected default to remain 15")
    }

    func testQ4RendersAllFiveStopsAndDefaultsToBuzzy() {
        let coord = makeCoordinator()
        let view = QuizQ4Vibe(coordinator: coord)
        let ids = identifiers(in: render(view))

        for i in 0..<GTIVibeLabels.all.count {
            XCTAssertTrue(ids.contains("quiz.q4.stop.\(i)"),
                "expected Q4 to render stop \(i)")
        }
        XCTAssertTrue(ids.contains("quiz.q4.word"))
        XCTAssertEqual(GTIVibeLabels.all[coord.q4Vibe], "BUZZY",
            "expected Q4 to default to BUZZY (index 2)")
    }

    func testQ5RendersAllThreeCandidateCardsAndSunCTA() {
        let coord = makeCoordinator()
        let view = QuizQ5Regret(coordinator: coord, onSubmit: {})
        let ids = identifiers(in: render(view))

        for candidate in QuizDummyCandidates.all {
            XCTAssertTrue(ids.contains("quiz.q5.card.\(candidate.id)"),
                "expected Q5 to render card for \(candidate.id)")
            for score in 1...5 {
                XCTAssertTrue(ids.contains("quiz.q5.score.\(candidate.id).\(score)"),
                    "expected Q5 to render score button \(score) for \(candidate.id)")
            }
        }
        XCTAssertTrue(ids.contains("quiz.cta.sun"),
            "expected Q5 to render the sun-fill primary CTA")
    }

    // MARK: - parent container

    func testQuizScreenRendersTopBarChromeOnQ1() {
        let coord = makeCoordinator()
        let view = QuizScreen(coordinator: coord, onClose: {})
        let ids = identifiers(in: render(view))

        XCTAssertTrue(ids.contains("quiz.gradient"),
            "expected the gradient surface identifier")
        XCTAssertTrue(ids.contains("quiz.close"),
            "expected the × close button identifier (no back arrow per S03)")
        XCTAssertTrue(ids.contains("quiz.progress"),
            "expected the 5-segment progress identifier")
    }
}
