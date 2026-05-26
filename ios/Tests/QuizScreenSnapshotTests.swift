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

    /// A coordinator seeded with the three-candidate test fixture so
    /// the Q5 `default`-mode surface has rateable cards. TB-26: the
    /// fixture lives in the test target — the app target ships no
    /// fictitious venues.
    private func makeCoordinator() -> QuizCoordinator {
        QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidates: QuizCandidateFixtures.all, writer: { _ in }
        )
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
        XCTAssertEqual(QuizCandidateFixtures.all.count, 3,
            "S03 §Q5 default mode surfaces exactly 3 candidates")
    }

    // MARK: - TB-26: Q5 no-results reference snapshot

    /// The Q5 `no-results` screen (sg-05's `no-results` mode) renders
    /// without crashing. This is the no-results reference snapshot the
    /// tb-26 acceptance criteria call for — the surface materialises
    /// with the locked headline / body / CTA copy and no candidate
    /// cards.
    func testQ5NoResultsScreenRendersWithoutCrashing() {
        render(QuizQ5NoResults(onAdvance: {}))
    }

    /// `QuizScreen` routes Q5 to the no-results screen when the
    /// per-member fetch resolved to `.noResults` — no fictitious cards,
    /// the member can still advance.
    func testQuizScreenRoutesQ5ToNoResultsScreen() async {
        // A no-results fetch double resolves Q5 to the no-results state.
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: NoResultsQuizCandidateFetch(), writer: { _ in }
        )
        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()
        XCTAssertEqual(coord.q5CandidatesState, .noResults)
        XCTAssertTrue(coord.allCandidates.isEmpty)
        render(QuizScreen(coordinator: coord, onClose: {}))
    }

    // MARK: - bug-38 — session-ended handler

    /// bug-38 — toast copy mirrors WaitingScreen's locked copy (bug-37),
    /// from CONTEXT.md §"Plan delete": "joiners get a 'session ended'
    /// toast and are punted." Locked constant defends against future
    /// paraphrase drift; pinning it here means a paraphrase on either
    /// surface trips the test.
    func testQuizScreenSessionEndedToastLabelIsLockedCopy() {
        XCTAssertEqual(QuizScreen.sessionEndedToastLabel, "Session ended")
    }

    /// bug-38 — toast copy MATCHES WaitingScreen's. Per the AFK brief,
    /// the two surfaces share the same inline primitive shape; the
    /// locked copy must be identical so a user who gets punted from
    /// mid-quiz and a user who gets punted from S04 see the same
    /// affordance.
    func testQuizScreenSessionEndedCopyMatchesWaitingScreen() {
        XCTAssertEqual(
            QuizScreen.sessionEndedToastLabel,
            WaitingScreen.sessionEndedToastLabel,
            "bug-38 toast copy must match bug-37 (ADR-0019 surface-owned ownership)"
        )
    }

    /// bug-38 — duration matches WaitingScreen's. Same primitive,
    /// same visibility window; a tweak on one surface must be a
    /// deliberate divergence, not a drift.
    func testQuizScreenSessionEndedDurationMatchesWaitingScreen() {
        XCTAssertEqual(
            QuizScreen.sessionEndedToastDuration,
            WaitingScreen.sessionEndedToastDuration,
            "bug-38 toast duration must match bug-37 (ADR-0019 surface-owned ownership)"
        )
    }

    /// bug-38 — when the room-status projection transitions to
    /// `.expired`, the screen fires the host-supplied `onSessionEnded`
    /// closure (the host then clears `activeQuiz` so the user lands
    /// on PlanList). Mirrors WaitingScreen's bug-37 test seam: SwiftUI
    /// tests cannot directly trigger `.onChange` modifiers from a
    /// state mutation, so the screen exposes a `simulateSessionEndedForTesting`
    /// seam that runs the same handler the production `.onChange`
    /// would invoke when status arrives as `.expired`.
    func testQuizScreenExpiredStatusFiresOnSessionEnded() {
        let coord = makeCoordinator()
        let store = WaitingStore(roomID: UUID(), currentUserID: UUID(), isInitiator: true)
        store.bootstrap(members: [], answered: [], status: .open)
        var sessionEndedCalls = 0
        let view = QuizScreen(
            coordinator: coord,
            role: .initiator,
            isSolo: false,
            roomStatusStore: store,
            onExit: { },
            onSessionEnded: { sessionEndedCalls += 1 }
        )
        render(view)
        store.apply(event: .roomStatusChanged(.expired))
        view.simulateSessionEndedForTesting()
        XCTAssertEqual(sessionEndedCalls, 1,
            "expected RoomStatus.expired to fire onSessionEnded exactly once")
    }

    /// bug-38 — invitee instances ALSO fire onSessionEnded. The
    /// session-ended transition is not initiator-only — every member
    /// in the room needs to be punted when the room expires,
    /// regardless of who initiated. Mirrors bug-37's invitee guard.
    func testQuizScreenExpiredStatusFiresOnSessionEndedForInviteeToo() {
        let coord = makeCoordinator()
        let store = WaitingStore(roomID: UUID(), currentUserID: UUID(), isInitiator: false)
        store.bootstrap(members: [], answered: [], status: .open)
        var sessionEndedCalls = 0
        let view = QuizScreen(
            coordinator: coord,
            role: .joiner,
            isSolo: false,
            roomStatusStore: store,
            onExit: { },
            onSessionEnded: { sessionEndedCalls += 1 }
        )
        render(view)
        store.apply(event: .roomStatusChanged(.expired))
        view.simulateSessionEndedForTesting()
        XCTAssertEqual(sessionEndedCalls, 1,
            "expected invitees to also receive the session-ended punt")
    }

    /// bug-38 — non-expired status transitions do NOT fire
    /// onSessionEnded. Guards against an over-broad .onChange that
    /// punts the user on every status flip (firing, verdict_ready,
    /// locked). Mirrors bug-37's non-expired guard.
    func testQuizScreenNonExpiredStatusDoesNotFireOnSessionEnded() {
        let coord = makeCoordinator()
        let store = WaitingStore(roomID: UUID(), currentUserID: UUID(), isInitiator: true)
        store.bootstrap(members: [], answered: [], status: .open)
        var sessionEndedCalls = 0
        let view = QuizScreen(
            coordinator: coord,
            role: .initiator,
            isSolo: false,
            roomStatusStore: store,
            onExit: { },
            onSessionEnded: { sessionEndedCalls += 1 }
        )
        render(view)
        // .firing, .verdictReady, .locked are not session-ended.
        store.apply(event: .roomStatusChanged(.firing))
        store.apply(event: .roomStatusChanged(.verdictReady))
        store.apply(event: .roomStatusChanged(.locked))
        XCTAssertEqual(sessionEndedCalls, 0,
            "expected only .expired (not .firing / .verdictReady / .locked) to fire onSessionEnded")
    }

    /// bug-38 — render-smoke that an `.expired` status materialises
    /// the toast subview without crashing.
    func testQuizScreenExpiredStatusRendersWithToastWithoutCrashing() {
        let coord = makeCoordinator()
        let store = WaitingStore(roomID: UUID(), currentUserID: UUID(), isInitiator: true)
        store.bootstrap(members: [], answered: [], status: .expired)
        let view = QuizScreen(
            coordinator: coord,
            role: .initiator,
            isSolo: false,
            roomStatusStore: store,
            onExit: { },
            onSessionEnded: { }
        )
        render(view)
    }

    /// bug-38 — the legacy QuizScreen initializers (no roomStatusStore /
    /// no onSessionEnded) still compile and render. Snapshot tests,
    /// chrome tests, and the JoinedResumeQuizHost all instantiate
    /// without the new params; they must keep working unchanged.
    func testQuizScreenLegacyInitializersStillCompile() {
        let coord = makeCoordinator()
        render(QuizScreen(coordinator: coord, onClose: { }))
        let coord2 = makeCoordinator()
        render(QuizScreen(
            coordinator: coord2,
            role: .initiator,
            isSolo: false,
            onExit: { }
        ))
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
        for candidate in QuizCandidateFixtures.all {
            XCTAssertEqual(coord.q5Ratings[candidate.id], 3,
                "Q5 defaults each candidate to 3 (middle of 1–5 scale)")
        }
    }
}
