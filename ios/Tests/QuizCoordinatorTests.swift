// GetToIt — QuizCoordinator unit tests (TB-04).
//
// Pure-logic tests (no Supabase round-trip). Drives the coordinator
// through realistic flows and asserts the wire row shape + the
// idempotency / rapid-tap semantics.

import XCTest
@testable import GetToIt

@MainActor
final class QuizCoordinatorTests: XCTestCase {

    // MARK: - test helpers

    /// In-memory writer that records each call. Configurable to throw
    /// (transient error, unique-violation, …) for retry tests.
    final class RecordingWriter: @unchecked Sendable {
        var rows: [QuizCoordinator.VoteRow] = []
        var nextErrors: [Error] = []

        func writer() -> QuizVoteWriter {
            return { [weak self] row in
                guard let self else { return }
                if !self.nextErrors.isEmpty {
                    let err = self.nextErrors.removeFirst()
                    throw err
                }
                self.rows.append(row)
            }
        }
    }

    /// Synthetic error whose `description` carries the Postgres
    /// SQLSTATE 23505. `QuizCoordinator.isUniqueViolation` sniffs the
    /// string so we don't have to construct a real `PostgrestError`.
    struct UniqueViolation: Error, CustomStringConvertible {
        var description: String { "PostgrestError(code: 23505, duplicate key value violates unique constraint)" }
    }

    struct TransientError: Error, CustomStringConvertible {
        var description: String { "network timeout" }
    }

    // MARK: - Q1 toggling

    func testNothingTonightChipIsMutuallyExclusiveWithOtherVetoes() async {
        let writer = RecordingWriter()
        let coord = QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            writer: writer.writer()
        )

        coord.toggleVeto(QuizVeto.shellfish)
        coord.toggleVeto(QuizVeto.dairy)
        XCTAssertEqual(coord.q1Vetoes, [QuizVeto.shellfish, QuizVeto.dairy])

        coord.toggleVeto(QuizVeto.nothingTonight)
        XCTAssertEqual(coord.q1Vetoes, [QuizVeto.nothingTonight],
                       "expected nothing_tonight to clear the other selections")

        coord.toggleVeto(QuizVeto.gluten)
        XCTAssertEqual(coord.q1Vetoes, [QuizVeto.gluten],
                       "expected selecting another chip to clear nothing_tonight")
    }

    func testNothingTonightChipDeselectsItself() {
        let writer = RecordingWriter()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(), writer: writer.writer()
        )
        coord.toggleVeto(QuizVeto.nothingTonight)
        XCTAssertEqual(coord.q1Vetoes, [QuizVeto.nothingTonight])
        coord.toggleVeto(QuizVeto.nothingTonight)
        XCTAssertTrue(coord.q1Vetoes.isEmpty, "expected re-tapping nothing_tonight to clear the set")
    }

    // MARK: - step advancement

    func testAdvanceWalksForwardThroughTheQuiz() {
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        XCTAssertEqual(coord.step, .q1)
        coord.advance(); XCTAssertEqual(coord.step, .q2)
        coord.advance(); XCTAssertEqual(coord.step, .q3)
        coord.advance(); XCTAssertEqual(coord.step, .q4)
        coord.advance(); XCTAssertEqual(coord.step, .q5)
        coord.advance(); XCTAssertEqual(coord.step, .q5,
            "advance past q5 must be a no-op — submit is the only forward path")
    }

    // MARK: - submit happy path

    func testSubmitWritesASingleRowOnQ5() async {
        let writer = RecordingWriter()
        let roomID = UUID()
        let userID = UUID()
        let coord = QuizCoordinator(
            roomID: roomID, userID: userID, writer: writer.writer()
        )

        // Walk a full quiz with non-default picks so we can verify the
        // wire row carries the captured answers.
        coord.toggleVeto(QuizVeto.shellfish)
        coord.advance()
        coord.setBudget(3)
        coord.advance()
        coord.setWalkMinutes(10)
        coord.advance()
        coord.setVibe(1)
        coord.advance()
        coord.setRegret(candidateID: QuizDummyCandidates.all[0].id, score: 5)
        coord.setRegret(candidateID: QuizDummyCandidates.all[1].id, score: 2)
        coord.setRegret(candidateID: QuizDummyCandidates.all[2].id, score: 4)

        let result = await coord.submit()

        guard case .success(let outcome) = result else {
            return XCTFail("expected submit to succeed, got \(result)")
        }
        XCTAssertEqual(outcome, .written)
        XCTAssertEqual(coord.step, .submitted)

        XCTAssertEqual(writer.rows.count, 1, "expected exactly one votes write")
        let row = writer.rows[0]
        XCTAssertEqual(row.roomID, roomID)
        XCTAssertEqual(row.userID, userID)
        XCTAssertEqual(row.q1Vetoes, [QuizVeto.shellfish])
        XCTAssertEqual(row.q2Budget, 3)
        XCTAssertEqual(row.q3WalkMinutes, 10)
        XCTAssertEqual(row.q4Vibe, 1)
        XCTAssertEqual(row.q5Regret[QuizDummyCandidates.all[0].id], 5)
        XCTAssertEqual(row.q5Regret[QuizDummyCandidates.all[1].id], 2)
        XCTAssertEqual(row.q5Regret[QuizDummyCandidates.all[2].id], 4)
    }

    // MARK: - partial exits don't write

    func testPartialQuizExitDoesNotWriteAnyRows() {
        // The coordinator's contract is "submit() is the only write
        // path." Walking through Q1..Q4 without calling submit produces
        // zero writes.
        let writer = RecordingWriter()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(), writer: writer.writer()
        )
        coord.toggleVeto(QuizVeto.dairy)
        coord.advance()
        coord.setBudget(2)
        coord.advance()
        coord.setWalkMinutes(15)
        coord.advance()
        coord.setVibe(0)
        // user closes the session here without tapping "Drop the verdict"
        XCTAssertTrue(writer.rows.isEmpty,
            "expected zero writes when the user exits before submitting Q5")
    }

    // MARK: - idempotency

    func testSubmitRetrySwallowsUniqueViolation() async {
        let writer = RecordingWriter()
        writer.nextErrors = [UniqueViolation()]
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(), writer: writer.writer()
        )

        let result = await coord.submit()
        guard case .success(let outcome) = result else {
            return XCTFail("expected submit to surface idempotent success")
        }
        XCTAssertEqual(outcome, .idempotent,
            "expected unique-constraint violation to resolve as idempotent")
        XCTAssertEqual(coord.step, .submitted)
    }

    func testSubmitTransientFailureLeavesUserOnFailedStateForRetry() async {
        let writer = RecordingWriter()
        writer.nextErrors = [TransientError()]
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(), writer: writer.writer()
        )

        let result = await coord.submit()
        guard case .failure = result else {
            return XCTFail("expected submit to fail on transient error")
        }
        switch coord.step {
        case .failed: break
        default: XCTFail("expected step to be .failed, got \(coord.step)")
        }
    }

    // MARK: - rapid-tap

    func testRapidTapSubmitOnlyFiresOneWrite() async {
        // The gradient surface tween + the user's finger being faster
        // than the tween produce repeated taps on "Drop the verdict."
        // The coordinator folds them into a single in-flight task.
        let writer = RecordingWriter()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(), writer: writer.writer()
        )

        async let a = coord.submit()
        async let b = coord.submit()
        async let c = coord.submit()
        let results = await [a, b, c]

        for r in results {
            guard case .success = r else {
                return XCTFail("expected all rapid-tap submits to succeed, got \(r)")
            }
        }
        XCTAssertEqual(writer.rows.count, 1,
            "expected rapid-tap submits to fold into a single write, got \(writer.rows.count)")
    }

    // MARK: - sanity

    /// TB-04 (v1.1) — the `votes` table now stores answers in five
    /// generic jsonb slots (`q1`..`q5`), each a `{ meta, answer }`
    /// envelope. `meta.question_kind` is the discriminator the
    /// verdict-engine mapping layer dispatches on. The wire row must
    /// emit that envelope shape, not the old typed columns.
    func testVoteRowEncodesGenericQuestionSlotEnvelopes() throws {
        let row = QuizCoordinator.VoteRow(
            roomID: UUID(),
            userID: UUID(),
            q1Vetoes: [QuizVeto.shellfish, QuizVeto.dairy].sorted(),
            q2Budget: 2,
            q3WalkMinutes: 10,
            q4Vibe: 3,
            q5Regret: ["dummy-pico": 5]
        )
        let data = try JSONEncoder().encode(row)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertNotNil(json["room_id"], "expected snake_case room_id")
        XCTAssertNotNil(json["user_id"], "expected snake_case user_id")

        // Five generic slots, each a { meta, answer } envelope.
        for slot in ["q1", "q2", "q3", "q4", "q5"] {
            let envelope = try XCTUnwrap(json[slot] as? [String: Any], "expected slot \(slot)")
            let meta = try XCTUnwrap(envelope["meta"] as? [String: Any], "\(slot) needs meta")
            XCTAssertNotNil(meta["question_kind"], "\(slot).meta needs a question_kind")
            XCTAssertNotNil(envelope["answer"], "\(slot) needs an answer")
        }

        // Each slot carries the kind discriminator the engine maps on.
        let kindOf: (String) throws -> String = { slot in
            let env = try XCTUnwrap(json[slot] as? [String: Any])
            let meta = try XCTUnwrap(env["meta"] as? [String: Any])
            return try XCTUnwrap(meta["question_kind"] as? String)
        }
        XCTAssertEqual(try kindOf("q1"), "dietary_veto")
        XCTAssertEqual(try kindOf("q2"), "budget_cap")
        XCTAssertEqual(try kindOf("q3"), "walk_minutes")
        XCTAssertEqual(try kindOf("q4"), "vibe")
        XCTAssertEqual(try kindOf("q5"), "regret")

        // The answer payloads carry the actual responses.
        let q2Answer = try XCTUnwrap((json["q2"] as? [String: Any])?["answer"] as? [String: Any])
        XCTAssertEqual(q2Answer["tier"] as? Int, 2)
        let q3Answer = try XCTUnwrap((json["q3"] as? [String: Any])?["answer"] as? [String: Any])
        XCTAssertEqual(q3Answer["minutes"] as? Int, 10)
        let q4Answer = try XCTUnwrap((json["q4"] as? [String: Any])?["answer"] as? [String: Any])
        XCTAssertEqual(q4Answer["level"] as? Int, 3)
        let q1Answer = try XCTUnwrap((json["q1"] as? [String: Any])?["answer"] as? [String: Any])
        let vetoes = try XCTUnwrap(q1Answer["vetoes"] as? [String])
        XCTAssertEqual(Set(vetoes), Set([QuizVeto.shellfish, QuizVeto.dairy]))
        let q5Answer = try XCTUnwrap((json["q5"] as? [String: Any])?["answer"] as? [String: Any])
        let scores = try XCTUnwrap(q5Answer["scores"] as? [String: Any])
        XCTAssertEqual(scores["dummy-pico"] as? Int, 5)

        // The old typed columns must NOT appear on the wire.
        XCTAssertNil(json["q1_vetoes"], "typed columns are gone in the v1.1 jsonb schema")
        XCTAssertNil(json["q2_budget"])
        XCTAssertNil(json["q3_walk_minutes"])
        XCTAssertNil(json["q4_vibe"])
        XCTAssertNil(json["q5_regret"])
    }
}
