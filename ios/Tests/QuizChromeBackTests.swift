// GetToIt — Quiz chrome Back-step unit tests (tb-WF-2).
//
// Covers the Back affordance behaviour wired by the QuizChrome row
// (sg-WF-2 spec, `design-system/surfaces/03-quiz.md` §"Quiz chrome
// (Back + Exit)"). The chrome itself lives in `QuizChromeView`; the
// step-and-answer state lives in `QuizCoordinator`. These tests pin
// the coordinator side: tapping Back decrements the active step and
// the prior answer is still on the coordinator so the input control
// re-renders pre-selected (the surface re-binds to `coordinator.q*`,
// which is the same `@Observable` state Q2-Q5 already render from).

import XCTest
@testable import GetToIt

@MainActor
final class QuizChromeBackTests: XCTestCase {

    // MARK: - back-step semantics

    func testBackFromQ3DecrementsToQ2() {
        // Acceptance: "Back tap on Q3 decrements to Q2 ..."
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        coord.advance(); coord.advance()
        XCTAssertEqual(coord.step, .q3)

        coord.back()
        XCTAssertEqual(coord.step, .q2,
            "expected Back from Q3 to decrement the active step to Q2")
    }

    func testBackPreservesThePriorAnswer() {
        // Acceptance: "Back tap on Q3 decrements to Q2 and restores the
        // prior answer." The prior answer must still be on the
        // coordinator so the chip group / slider / picker re-renders
        // pre-selected and re-editable.
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        coord.advance()          // -> Q2
        coord.setBudget(3)
        coord.advance()          // -> Q3
        XCTAssertEqual(coord.step, .q3)

        coord.back()
        XCTAssertEqual(coord.step, .q2)
        XCTAssertEqual(coord.q2Budget, 3,
            "expected the Q2 budget pick to survive a Back step so the surface re-renders pre-selected")
    }

    func testBackOnQ1IsANoOp() {
        // Acceptance: "Q1 does not render a Back affordance" / "Back on
        // Q1 is unreachable." The chrome guards the affordance via
        // `canBack`, but the coordinator's back-step must also be safe
        // to call on Q1 (no underflow, no crash, no state change).
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        XCTAssertEqual(coord.step, .q1)
        coord.back()
        XCTAssertEqual(coord.step, .q1,
            "expected Back on Q1 to be a no-op — there is no prior question")
    }

    func testBackFiresNoServerWrite() {
        // Acceptance: "Back ... no server call."
        final class RecordingWriter: @unchecked Sendable {
            var rows: [QuizCoordinator.VoteRow] = []
            func writer() -> QuizVoteWriter {
                return { [weak self] row in
                    self?.rows.append(row)
                }
            }
        }
        let writer = RecordingWriter()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            writer: writer.writer()
        )
        coord.advance(); coord.advance(); coord.advance()  // -> Q4
        coord.back()                                       // -> Q3
        coord.back()                                       // -> Q2

        XCTAssertTrue(writer.rows.isEmpty,
            "expected zero votes writes — Back is strictly per-member, never affects room state")
    }

    func testBackThroughEveryStepDoesNotUnderflow() {
        // Walk forward to Q5, then walk all the way back to Q1.
        // The terminal Back on Q1 must be a clean no-op.
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        XCTAssertEqual(coord.step, .q5)
        coord.back(); XCTAssertEqual(coord.step, .q4)
        coord.back(); XCTAssertEqual(coord.step, .q3)
        coord.back(); XCTAssertEqual(coord.step, .q2)
        coord.back(); XCTAssertEqual(coord.step, .q1)
        coord.back(); XCTAssertEqual(coord.step, .q1,
            "expected an extra Back on Q1 to be a no-op rather than underflow")
    }

    func testBackFromQ5DoesNotResetQ5Candidates() {
        // The Q5 candidate fetch fires once on the Q4 -> Q5 transition.
        // If the user steps Back to Q4 and then advances again, the
        // existing candidate list / state must NOT be wiped — re-running
        // the fetch would double-bill Foursquare and pollute the
        // member's `member_fetches` row.
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(),
                                    candidates: QuizCandidateFixtures.all,
                                    writer: { _ in })
        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        XCTAssertEqual(coord.step, .q5)
        let candidatesBefore = coord.allCandidates
        coord.back()
        XCTAssertEqual(coord.step, .q4)
        XCTAssertEqual(coord.allCandidates.map(\.id), candidatesBefore.map(\.id),
            "expected Back from Q5 to leave the already-resolved candidate list intact")
    }
}
