// GetToIt — PlanListScreen Joined-card pure-logic tests (tb-WF-7).
//
// Joiner-side of the S00 Plan list. The base slice (tb-WF-5) shipped
// the Created Pending path; this slice adds the Joined cards + the
// resume-from-state router that decides where a Joined card tap
// lands per the §Q8 table in `surfaces/00-plan-list.md`.
//
// These tests target the pure router helper + the JOINED chip render
// gate. The render-smoke coverage for the chip lives in
// `PlanListScreenRenderTests`; the live PostgREST round-trip is the
// integration lane's job.

import XCTest
@testable import GetToIt

@MainActor
final class PlanListScreenJoinedTests: XCTestCase {

    // MARK: - JOINED chip copy (locked)

    /// The JOINED eyebrow chip label. UPPERCASE in source so the iOS
    /// render does NOT need to `.uppercased()` it — the chip is the
    /// label, not a heading; the eyebrow token's `letterSpacing` does
    /// the visual lift. NEVER `"Invited"`, `"From <name>"`, or
    /// `"You joined"` (surface §"Copy register", parent Q3).
    func testJoinedChipLabelIsLocked() {
        XCTAssertEqual(PlanListScreen.joinedChipLabel, "JOINED")
    }

    // MARK: - routeFor — resume-from-state §Q8

    /// Pending Plan + the joiner has not advanced past Q1 → Quiz at Q1.
    /// `lastAnsweredQuestionIndex = 0` is the canonical "never touched"
    /// signal — `members.quiz_progress.last_index` defaults to 0 server-
    /// side; the iOS write only ever increments it.
    func testRouteForPendingUntouchedQuiz() {
        let row = Self.makeJoinedRow(
            status: .pending,
            lastAnsweredQuestionIndex: 0,
            hasVoted: false
        )
        XCTAssertEqual(PlanListScreen.routeFor(joinedRow: row), .quizAtStart)
    }

    /// Pending Plan + joiner advanced to Q3 → Quiz at Q3. The router
    /// passes the index through unchanged; the host decides how to map
    /// "Q3" onto the QuizCoordinator's `.q3` step.
    func testRouteForPendingMidQuiz() {
        let row = Self.makeJoinedRow(
            status: .pending,
            lastAnsweredQuestionIndex: 3,
            hasVoted: false
        )
        XCTAssertEqual(
            PlanListScreen.routeFor(joinedRow: row),
            .quizAtQuestion(index: 3)
        )
    }

    /// Pending Plan + joiner finished the quiz (`hasVoted = true`) →
    /// WaitingScreen. The router prefers the `hasVoted` signal over a
    /// stale `lastAnsweredQuestionIndex` because the votes row is the
    /// canonical "done" signal.
    func testRouteForPendingFinishedQuizRoutesToWaiting() {
        let row = Self.makeJoinedRow(
            status: .pending,
            lastAnsweredQuestionIndex: 5,
            hasVoted: true
        )
        XCTAssertEqual(PlanListScreen.routeFor(joinedRow: row), .waiting)
    }

    /// A defensive guard: `hasVoted = true` always routes to Waiting,
    /// even if a server-side progress index is somehow stale at 2.
    /// The votes row is the ground truth — once it lands, the user is
    /// past the quiz.
    func testRouteForFinishedQuizPrefersHasVotedOverProgressIndex() {
        let row = Self.makeJoinedRow(
            status: .pending,
            lastAnsweredQuestionIndex: 2,
            hasVoted: true
        )
        XCTAssertEqual(PlanListScreen.routeFor(joinedRow: row), .waiting)
    }

    /// Decided-active Plan → read-only Verdict (reroll affordance is
    /// suppressed in the host, but the router itself only signals the
    /// "active" vs "history" variant of read-only). Joiner can't
    /// reroll — that's initiator-only per parent Q9.
    func testRouteForDecidedActive() {
        let row = Self.makeJoinedRow(
            status: .decidedActive,
            lastAnsweredQuestionIndex: 5,
            hasVoted: true
        )
        XCTAssertEqual(
            PlanListScreen.routeFor(joinedRow: row),
            .verdictReadOnlyActive
        )
    }

    /// Decided-expired Plan → read-only Verdict in history variant.
    func testRouteForDecidedExpired() {
        let row = Self.makeJoinedRow(
            status: .decidedExpired,
            lastAnsweredQuestionIndex: 5,
            hasVoted: true
        )
        XCTAssertEqual(
            PlanListScreen.routeFor(joinedRow: row),
            .verdictReadOnlyHistory
        )
    }

    /// Decided-active route survives even when the joiner never voted
    /// — per the issue body's "Decided-active Plan where joiner never
    /// voted" edge case, the verdict still fired (initiator manually
    /// closed voting) and the tap goes to read-only Verdict.
    func testRouteForDecidedActiveWhenJoinerNeverVoted() {
        let row = Self.makeJoinedRow(
            status: .decidedActive,
            lastAnsweredQuestionIndex: 0,
            hasVoted: false
        )
        XCTAssertEqual(
            PlanListScreen.routeFor(joinedRow: row),
            .verdictReadOnlyActive
        )
    }

    // MARK: - bounds clamping on progress index

    /// A defensive clamp: a server row carrying an index ≥ 5 with
    /// `hasVoted = false` is treated as if the joiner is on Q5 (the
    /// last question), not past it. The Waiting route requires the
    /// votes row to exist; an index alone is not sufficient.
    func testRouteForProgressIndexFiveWithoutVoteRoutesToQ5() {
        let row = Self.makeJoinedRow(
            status: .pending,
            lastAnsweredQuestionIndex: 5,
            hasVoted: false
        )
        XCTAssertEqual(
            PlanListScreen.routeFor(joinedRow: row),
            .quizAtQuestion(index: 5)
        )
    }

    /// Negative index (shouldn't happen — the column is `int` with a
    /// `default 0`) clamps to 0. Defensive against a stale wire shape.
    func testRouteForNegativeProgressIndexClampsToZero() {
        let row = Self.makeJoinedRow(
            status: .pending,
            lastAnsweredQuestionIndex: -1,
            hasVoted: false
        )
        XCTAssertEqual(PlanListScreen.routeFor(joinedRow: row), .quizAtStart)
    }

    // MARK: - helpers

    static func makeJoinedRow(
        status: PlansStore.LifecycleState,
        lastAnsweredQuestionIndex: Int,
        hasVoted: Bool,
        name: String = "Sam's dinner"
    ) -> PlansStore.JoinedPlanRow {
        let plan = PlansStore.Plan(
            id: UUID(),
            creatorID: UUID(),
            name: name,
            category: "food",
            scope: .group,
            location: nil,
            sessionParameters: SessionParameters.default,
            distanceMeters: 1609,
            status: status,
            rerollWindowClosesAt: nil,
            createdAt: "2026-05-20T12:00:00Z",
            updatedAt: "2026-05-20T12:00:00Z"
        )
        return PlansStore.JoinedPlanRow(
            plan: plan,
            lastAnsweredQuestionIndex: lastAnsweredQuestionIndex,
            hasVoted: hasVoted
        )
    }
}
