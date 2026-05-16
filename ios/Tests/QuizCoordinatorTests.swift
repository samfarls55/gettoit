// GetToIt — QuizCoordinator unit tests (TB-06 — Q1–Q4 rework).
//
// Pure-logic tests (no Supabase round-trip). Drives the coordinator
// through the v1.1 question semantics and asserts the wire row shape +
// the idempotency / rapid-tap semantics.
//
// v1.1 question rework (PRD module J, part 1):
//   * Q1 — cuisine craving. Multi-select, capped at 3, with a
//     mutually-exclusive "No preference" toggle.
//   * Q2 — spend cap. A hard ceiling, unchanged 4-tier semantics.
//   * Q3 — reputation / discovery. A single-select chip picker.
//   * Q4 — vibe energy. A 5-point cardinal scale (Quiet…Rowdy).

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

    // MARK: - Q1 cuisine craving — the 3-cap

    func testQ1CapsCuisineSelectionAtThree() {
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })

        coord.toggleCuisine(QuizCuisine.mexican)
        coord.toggleCuisine(QuizCuisine.japanese)
        coord.toggleCuisine(QuizCuisine.italian)
        XCTAssertEqual(coord.q1Cuisines, [QuizCuisine.mexican, QuizCuisine.japanese, QuizCuisine.italian])

        // The 4th selection is prevented — the set stays at 3.
        coord.toggleCuisine(QuizCuisine.thai)
        XCTAssertEqual(coord.q1Cuisines.count, 3,
            "expected the 4th cuisine selection to be prevented by the cap")
        XCTAssertFalse(coord.q1Cuisines.contains(QuizCuisine.thai),
            "expected the rejected 4th cuisine to not enter the set")
    }

    func testQ1CanDeselectAtCapToFreeASlot() {
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        coord.toggleCuisine(QuizCuisine.mexican)
        coord.toggleCuisine(QuizCuisine.japanese)
        coord.toggleCuisine(QuizCuisine.italian)
        // Deselecting a cuisine at the cap always works — it frees a slot.
        coord.toggleCuisine(QuizCuisine.japanese)
        XCTAssertEqual(coord.q1Cuisines, [QuizCuisine.mexican, QuizCuisine.italian])
        // …and now a new pick lands.
        coord.toggleCuisine(QuizCuisine.thai)
        XCTAssertEqual(coord.q1Cuisines, [QuizCuisine.mexican, QuizCuisine.italian, QuizCuisine.thai])
    }

    func testQ1AtCapReportsNoFreeSlots() {
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        XCTAssertTrue(coord.q1HasFreeCuisineSlot, "an empty set has free slots")
        coord.toggleCuisine(QuizCuisine.mexican)
        coord.toggleCuisine(QuizCuisine.japanese)
        XCTAssertTrue(coord.q1HasFreeCuisineSlot, "2 of 3 still has a free slot")
        coord.toggleCuisine(QuizCuisine.italian)
        XCTAssertFalse(coord.q1HasFreeCuisineSlot, "3 of 3 is full")
    }

    // MARK: - Q1 cuisine craving — "No preference" exclusivity

    func testQ1NoPreferenceIsMutuallyExclusiveBothWays() {
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })

        coord.toggleCuisine(QuizCuisine.mexican)
        coord.toggleCuisine(QuizCuisine.japanese)
        XCTAssertEqual(coord.q1Cuisines.count, 2)
        XCTAssertFalse(coord.q1NoPreference)

        // Selecting "No preference" clears every cuisine.
        coord.toggleCuisineNoPreference()
        XCTAssertTrue(coord.q1NoPreference)
        XCTAssertTrue(coord.q1Cuisines.isEmpty,
            "expected No preference to clear all selected cuisines")

        // Selecting a cuisine clears "No preference".
        coord.toggleCuisine(QuizCuisine.italian)
        XCTAssertFalse(coord.q1NoPreference,
            "expected selecting a cuisine to clear No preference")
        XCTAssertEqual(coord.q1Cuisines, [QuizCuisine.italian])
    }

    func testQ1NoPreferenceTogglesItselfOff() {
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        coord.toggleCuisineNoPreference()
        XCTAssertTrue(coord.q1NoPreference)
        coord.toggleCuisineNoPreference()
        XCTAssertFalse(coord.q1NoPreference, "expected re-tapping No preference to clear it")
    }

    func testQ1NoPreferenceDoesNotConsumeACuisineSlot() {
        // "No preference" is its own flag — it must never count toward
        // the 3-cap (otherwise a No-preference pick would block cuisines
        // if the user changed their mind).
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        coord.toggleCuisineNoPreference()
        coord.toggleCuisine(QuizCuisine.mexican)   // clears No preference
        coord.toggleCuisine(QuizCuisine.japanese)
        coord.toggleCuisine(QuizCuisine.italian)
        XCTAssertEqual(coord.q1Cuisines.count, 3, "3 cuisines fit after a No-preference detour")
    }

    // MARK: - Q3 reputation chip

    func testQ3CapturesTheReputationChip() {
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        // Default is "No preference" — the neutral, non-pruning answer.
        XCTAssertEqual(coord.q3Reputation, QuizReputation.noPreference)
        coord.setReputation(QuizReputation.hiddenGem)
        XCTAssertEqual(coord.q3Reputation, QuizReputation.hiddenGem)
        coord.setReputation(QuizReputation.classic)
        XCTAssertEqual(coord.q3Reputation, QuizReputation.classic,
            "expected the reputation chip to be single-select — last pick wins")
    }

    // MARK: - Q4 vibe energy

    func testQ4CapturesTheFivePointEnergyValue() {
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        for level in 0..<GTIVibeLabels.all.count {
            coord.setVibe(level)
            XCTAssertEqual(coord.q4Vibe, level)
        }
        XCTAssertEqual(GTIVibeLabels.all.count, 5, "vibe energy is a 5-point scale")
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

    func testAdvancingQ1ThroughQ4NeverStalls() {
        // Acceptance criterion: advancing through Q1-Q4 never stalls.
        // Every Qn step has a defined successor and `advance()` always
        // moves forward — regardless of which answers are picked.
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        coord.toggleCuisine(QuizCuisine.mexican)
        XCTAssertEqual(coord.step, .q1)
        coord.advance(); XCTAssertEqual(coord.step, .q2)
        coord.setBudget(2)
        coord.advance(); XCTAssertEqual(coord.step, .q3)
        coord.setReputation(QuizReputation.popular)
        coord.advance(); XCTAssertEqual(coord.step, .q4)
        coord.setVibe(4)
        coord.advance(); XCTAssertEqual(coord.step, .q5,
            "expected the flow to reach Q5 without stalling on any Q1-Q4 step")
    }

    func testAdvancingQ1WithNoAnswerStillMovesForward() {
        // No answer is required to advance — the flow never stalls even
        // if a member taps Next without selecting anything.
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: { _ in })
        coord.advance(); XCTAssertEqual(coord.step, .q2)
        coord.advance(); XCTAssertEqual(coord.step, .q3)
        coord.advance(); XCTAssertEqual(coord.step, .q4)
        coord.advance(); XCTAssertEqual(coord.step, .q5)
    }

    // MARK: - submit happy path + persistence

    func testSubmitWritesASingleRowOnQ5() async {
        let writer = RecordingWriter()
        let roomID = UUID()
        let userID = UUID()
        let coord = QuizCoordinator(
            roomID: roomID, userID: userID, writer: writer.writer()
        )

        // Walk a full quiz with non-default picks so we can verify the
        // wire row carries the captured answers.
        coord.toggleCuisine(QuizCuisine.mexican)
        coord.toggleCuisine(QuizCuisine.thai)
        coord.advance()
        coord.setBudget(3)
        coord.advance()
        coord.setReputation(QuizReputation.hiddenGem)
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
        XCTAssertEqual(Set(row.q1Cuisines), [QuizCuisine.mexican, QuizCuisine.thai])
        XCTAssertFalse(row.q1NoPreference)
        XCTAssertEqual(row.q2Budget, 3)
        XCTAssertEqual(row.q3Reputation, QuizReputation.hiddenGem)
        XCTAssertEqual(row.q4Vibe, 1)
        XCTAssertEqual(row.q5Regret[QuizDummyCandidates.all[0].id], 5)
        XCTAssertEqual(row.q5Regret[QuizDummyCandidates.all[1].id], 2)
        XCTAssertEqual(row.q5Regret[QuizDummyCandidates.all[2].id], 4)
    }

    func testSubmitCarriesNoPreferenceCuisineAnswer() async {
        let writer = RecordingWriter()
        let coord = QuizCoordinator(roomID: UUID(), userID: UUID(), writer: writer.writer())
        coord.toggleCuisineNoPreference()
        _ = await coord.submit()
        let row = try? XCTUnwrap(writer.rows.first)
        XCTAssertEqual(row?.q1NoPreference, true)
        XCTAssertEqual(row?.q1Cuisines, [])
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
        coord.toggleCuisine(QuizCuisine.japanese)
        coord.advance()
        coord.setBudget(2)
        coord.advance()
        coord.setReputation(QuizReputation.popular)
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

    // MARK: - wire shape

    /// TB-06 (v1.1) — the reworked quiz writes generic `{ meta, answer }`
    /// jsonb slots. Q1 carries the cuisine craving, Q3 the reputation
    /// chip; Q2 and Q4 keep their existing kinds (spend cap / vibe).
    /// `meta.question_kind` is the discriminator the verdict-engine
    /// mapping layer dispatches on.
    func testVoteRowEncodesGenericQuestionSlotEnvelopes() throws {
        let row = QuizCoordinator.VoteRow(
            roomID: UUID(),
            userID: UUID(),
            q1Cuisines: [QuizCuisine.mexican, QuizCuisine.japanese].sorted(),
            q1NoPreference: false,
            q2Budget: 2,
            q3Reputation: QuizReputation.hiddenGem,
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
        XCTAssertEqual(try kindOf("q1"), "cuisine_craving")
        XCTAssertEqual(try kindOf("q2"), "budget_cap")
        XCTAssertEqual(try kindOf("q3"), "reputation")
        XCTAssertEqual(try kindOf("q4"), "vibe")
        XCTAssertEqual(try kindOf("q5"), "regret")

        // The answer payloads carry the actual responses.
        let q1Answer = try XCTUnwrap((json["q1"] as? [String: Any])?["answer"] as? [String: Any])
        let cuisines = try XCTUnwrap(q1Answer["cuisines"] as? [String])
        XCTAssertEqual(Set(cuisines), Set([QuizCuisine.mexican, QuizCuisine.japanese]))
        XCTAssertEqual(q1Answer["no_preference"] as? Bool, false)

        let q2Answer = try XCTUnwrap((json["q2"] as? [String: Any])?["answer"] as? [String: Any])
        XCTAssertEqual(q2Answer["tier"] as? Int, 2)
        let q3Answer = try XCTUnwrap((json["q3"] as? [String: Any])?["answer"] as? [String: Any])
        XCTAssertEqual(q3Answer["reputation"] as? String, QuizReputation.hiddenGem)
        let q4Answer = try XCTUnwrap((json["q4"] as? [String: Any])?["answer"] as? [String: Any])
        XCTAssertEqual(q4Answer["level"] as? Int, 3)
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

    /// A "No preference" cuisine answer encodes with an empty cuisine
    /// list and the flag set — the engine reads `no_preference` to zero
    /// the cuisine axis weight.
    func testVoteRowEncodesNoPreferenceCuisine() throws {
        let row = QuizCoordinator.VoteRow(
            roomID: UUID(),
            userID: UUID(),
            q1Cuisines: [],
            q1NoPreference: true,
            q2Budget: 4,
            q3Reputation: QuizReputation.noPreference,
            q4Vibe: 2,
            q5Regret: [:]
        )
        let data = try JSONEncoder().encode(row)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let q1Answer = try XCTUnwrap((json["q1"] as? [String: Any])?["answer"] as? [String: Any])
        XCTAssertEqual(q1Answer["no_preference"] as? Bool, true)
        XCTAssertEqual(q1Answer["cuisines"] as? [String], [])
    }
}
