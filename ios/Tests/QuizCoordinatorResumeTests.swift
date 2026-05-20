// GetToIt — QuizCoordinator resume-from-progress tests (tb-WF-7).
//
// The S00 Plan list (workflow-overhaul) routes a Joined-card tap on
// a Pending+mid-quiz Plan back into the QuizScreen at the joiner's
// last-answered question with prior answers intact (§Q8 in
// surfaces/00-plan-list.md). The QuizCoordinator persists a small
// resume payload to `members.quiz_progress` as the joiner advances;
// the resume path hydrates a fresh coordinator from that payload so
// the user does not lose work on app re-launch.
//
// This file covers:
//   * `QuizProgress` round-trip (decode the jsonb shape).
//   * `QuizCoordinator(initialProgress:)` hydrates step + answers.
//   * `advance()` invokes the injected `MemberProgressWriter` with
//     the post-advance progress (best-effort; never blocks the step).

import XCTest
@testable import GetToIt

@MainActor
final class QuizCoordinatorResumeTests: XCTestCase {

    // MARK: - QuizProgress value type

    /// `QuizProgress` is the serialized shape the iOS port packs into
    /// `members.quiz_progress`. The wire shape mirrors the `{ meta,
    /// answer }` envelope per question — that mirroring lets the
    /// `votes` write at Q5 submit pack the same payload without a
    /// schema translation step. `lastIndex` is the 1-based index of
    /// the last-answered question (0 when never touched).
    func testQuizProgressDecodesACanonicalPayload() throws {
        let json = """
        {
            "last_index": 3,
            "answers": {
                "q1": { "cuisines": ["mexican", "japanese"], "noPreference": false },
                "q2": { "tier": 2 },
                "q3": { "reputation": "popular" }
            }
        }
        """.data(using: .utf8)!

        let progress = try JSONDecoder().decode(QuizProgress.self, from: json)
        XCTAssertEqual(progress.lastIndex, 3)
        XCTAssertEqual(progress.q1?.cuisines, ["mexican", "japanese"])
        XCTAssertEqual(progress.q1?.noPreference, false)
        XCTAssertEqual(progress.q2?.tier, 2)
        XCTAssertEqual(progress.q3?.reputation, "popular")
        XCTAssertNil(progress.q4)
    }

    /// An empty payload (`{}`) decodes with `lastIndex = 0` and every
    /// per-question slot nil. That is the "never touched" default the
    /// server's `default '{}'::jsonb` column hands back to a joiner
    /// who hasn't started the quiz yet.
    func testQuizProgressDecodesEmptyAsUntouched() throws {
        let json = "{}".data(using: .utf8)!
        let progress = try JSONDecoder().decode(QuizProgress.self, from: json)
        XCTAssertEqual(progress.lastIndex, 0)
        XCTAssertNil(progress.q1)
        XCTAssertNil(progress.q2)
        XCTAssertNil(progress.q3)
        XCTAssertNil(progress.q4)
    }

    // MARK: - QuizCoordinator(initialProgress:) hydration

    /// A coordinator built with `initialProgress.lastIndex = 3` lands
    /// on Q3 (the joiner's last-answered question — per surfaces/00-
    /// plan-list.md §Q8 "resumes the quiz at Q3 (their last-answered
    /// question, NOT Q1)"). Q1-Q2 answers (and a pre-existing Q3
    /// answer) are pre-loaded into the coordinator's @Observable
    /// state so the surfaces re-render pre-selected — same contract
    /// as the `back()` semantics shipped in tb-WF-2.
    func testCoordinatorInitWithProgressLandsOnLastAnsweredStep() {
        let progress = QuizProgress(
            lastIndex: 3,
            q1: .init(cuisines: ["mexican", "japanese"], noPreference: false),
            q2: .init(tier: 2),
            q3: .init(reputation: "popular"),
            q4: nil
        )
        let coord = QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            writer: { _ in },
            initialProgress: progress
        )
        XCTAssertEqual(coord.step, .q3, "lastIndex=3 lands the user on Q3 (last-answered)")
        XCTAssertEqual(coord.q1Cuisines, ["mexican", "japanese"])
        XCTAssertFalse(coord.q1NoPreference)
        XCTAssertEqual(coord.q2Budget, 2)
        XCTAssertEqual(coord.q3Reputation, "popular")
    }

    /// A `lastIndex = 0` payload (joiner hasn't started) lands the
    /// coordinator on Q1 with no answers pre-loaded — same as a
    /// fresh-construction coordinator.
    func testCoordinatorInitWithUntouchedProgressLandsOnQ1() {
        let progress = QuizProgress(lastIndex: 0)
        let coord = QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            writer: { _ in },
            initialProgress: progress
        )
        XCTAssertEqual(coord.step, .q1)
        XCTAssertEqual(coord.q1Cuisines, [])
        XCTAssertFalse(coord.q1NoPreference)
    }

    /// A `lastIndex = 5` payload (joiner reached Q5 but did not
    /// submit) lands the coordinator on Q5. Live behavior on the next
    /// advance fires the per-member Foursquare fetch, but this test
    /// only covers step + answer hydration; the fetch hookup is the
    /// assembler tests' concern.
    func testCoordinatorInitWithLastIndexFiveLandsOnQ5() {
        let progress = QuizProgress(
            lastIndex: 5,
            q1: .init(cuisines: ["mexican"], noPreference: false),
            q2: .init(tier: 1),
            q3: .init(reputation: "hidden_gem"),
            q4: .init(level: 3)
        )
        let coord = QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            writer: { _ in },
            initialProgress: progress
        )
        XCTAssertEqual(coord.step, .q5)
        XCTAssertEqual(coord.q4Vibe, 3)
    }

    /// The Q1 `noPreference` flag round-trips. A joiner who picked
    /// "No preference" on Q1 (and is still on Q1) should resume with
    /// the toggle on, not with an empty cuisine set that looks like
    /// "didn't answer." `lastIndex = 1` lands on Q1.
    func testCoordinatorInitHydratesQ1NoPreference() {
        let progress = QuizProgress(
            lastIndex: 1,
            q1: .init(cuisines: [], noPreference: true),
            q2: nil,
            q3: nil,
            q4: nil
        )
        let coord = QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            writer: { _ in },
            initialProgress: progress
        )
        XCTAssertEqual(coord.step, .q1)
        XCTAssertTrue(coord.q1NoPreference)
        XCTAssertEqual(coord.q1Cuisines, [])
    }

    // MARK: - MemberProgressWriter — fire on advance

    /// `advance()` fires the injected `MemberProgressWriter` with the
    /// post-advance progress payload. Best-effort: the call does NOT
    /// block the step change, so the writer is invoked asynchronously
    /// from inside a Task — the test waits with a deliberate yield.
    func testAdvanceFiresProgressWriter() async {
        let recorder = ProgressRecorder()
        let coord = QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            writer: { _ in },
            progressWriter: recorder.writer()
        )
        // Pre-pick Q1 so the persisted answers carry real content.
        coord.toggleCuisine(QuizCuisine.mexican)
        coord.advance()  // Q1 -> Q2
        // Yield so the fire-and-forget Task completes.
        for _ in 0..<20 { await Task.yield() }
        XCTAssertEqual(recorder.calls.count, 1,
                       "advance() fires the progress writer exactly once")
        XCTAssertEqual(recorder.calls.first?.lastIndex, 2,
                       "Q1 -> Q2 advance stamps last_index = 2 (current-step number)")
        XCTAssertEqual(recorder.calls.first?.q1?.cuisines, ["mexican"])
    }

    /// A no-op `advance()` past Q5 does NOT fire the writer. The
    /// `submitting` / `submitted` / `failed` states are terminal and
    /// the `votes` write is the canonical "done" signal for those.
    func testAdvancePastSubmittingDoesNotFireProgressWriter() async {
        let recorder = ProgressRecorder()
        let progress = QuizProgress(
            lastIndex: 5,
            q1: .init(cuisines: ["mexican"], noPreference: false),
            q2: .init(tier: 1),
            q3: .init(reputation: "hidden_gem"),
            q4: .init(level: 3)
        )
        let coord = QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            writer: { _ in },
            initialProgress: progress,
            progressWriter: recorder.writer()
        )
        // lastIndex = 5 lands on .q5; explicit submit then transitions
        // through .submitting -> .submitted. A defensive advance() from
        // .q5 (no-op per QuizCoordinator) must not stamp progress.
        XCTAssertEqual(coord.step, .q5)
        coord.advance()  // no-op from Q5 — submit is a separate call
        for _ in 0..<20 { await Task.yield() }
        XCTAssertTrue(recorder.calls.isEmpty,
                      "Q5 -> next is owned by submit(), not advance() + progressWriter")
    }

    /// A failed progress write does NOT throw out of `advance()` —
    /// the step still moves. Best-effort write semantics protect the
    /// quiz against a backend hiccup.
    func testAdvanceSwallowsProgressWriterFailure() async {
        let recorder = ProgressRecorder(shouldThrow: true)
        let coord = QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            writer: { _ in },
            progressWriter: recorder.writer()
        )
        coord.advance()  // Q1 -> Q2, writer throws inside the Task
        for _ in 0..<20 { await Task.yield() }
        XCTAssertEqual(coord.step, .q2,
                       "advance() landed despite the progress write failing")
    }

    // MARK: - test helpers

    final class ProgressRecorder: @unchecked Sendable {
        var calls: [QuizProgress] = []
        let shouldThrow: Bool

        init(shouldThrow: Bool = false) {
            self.shouldThrow = shouldThrow
        }

        func writer() -> MemberProgressWriter {
            return { [weak self] progress in
                guard let self else { return }
                if self.shouldThrow {
                    struct Boom: Error {}
                    throw Boom()
                }
                self.calls.append(progress)
            }
        }
    }
}
