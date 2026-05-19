// GetToIt — TB-21 member-fetch persistence tests.
//
// TB-21 wires the iOS half of the bug-08 fix: when a member's
// per-member Foursquare fetch resolves, the QuizCoordinator persists
// the FULL RAW fetched venue union (every venue, not just the three Q5
// factorial cards) into the server-readable `member_fetches` table.
// The `compute-verdict` Edge Function then unions every member's
// persisted fetch into `options` at verdict fire time.
//
// These tests use an in-memory recording `MemberFetchWriter` so the
// coordinator-side wiring (the raw union is persisted, keyed on the
// right room + user) is verified without a live Supabase client.

import XCTest
import CoreLocation
@testable import GetToIt

@MainActor
final class MemberFetchPersistenceTests: XCTestCase {

    // MARK: - recording doubles

    /// Records every `MemberFetchRow` the coordinator writes.
    final class RecordingMemberFetchWriter: @unchecked Sendable {
        var rows: [MemberFetchRow] = []
        var writer: MemberFetchWriter {
            { [weak self] row in self?.rows.append(row) }
        }
    }

    /// A `QuizCandidateFetch` double that returns a configurable
    /// result — including the full raw fetched union on `rawFetch`.
    final class StubCandidateFetch: QuizCandidateFetch, @unchecked Sendable {
        var result: QuizCandidateFetchResult
        init(result: QuizCandidateFetchResult) { self.result = result }
        func fetchCandidates(
            answers: QuizFetchAnswers,
            parameters: SessionParameters
        ) async -> QuizCandidateFetchResult {
            result
        }
    }

    private func place(_ id: String) -> ShapedPlace {
        ShapedPlace(
            fsqPlaceId: id, name: "Venue \(id)", lat: 0, lng: 0,
            priceTier: 2, categories: ["Mexican Restaurant"]
        )
    }

    // MARK: - the raw fetched union is persisted

    func testCompletingTheFetchPersistsTheRawUnion() async {
        let roomID = UUID()
        let userID = UUID()
        let raw = [place("a"), place("b"), place("c")]
        let fetch = StubCandidateFetch(result: QuizCandidateFetchResult(
            candidates: [
                QuizCandidate(id: "a", name: "Venue a", meta: ""),
                QuizCandidate(id: "b", name: "Venue b", meta: ""),
                QuizCandidate(id: "c", name: "Venue c", meta: ""),
            ],
            source: .fetched,
            rawFetch: raw
        ))
        let recorder = RecordingMemberFetchWriter()
        let coord = QuizCoordinator(
            roomID: roomID, userID: userID,
            candidateFetch: fetch,
            memberFetchWriter: recorder.writer,
            writer: { _ in }
        )

        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        XCTAssertEqual(recorder.rows.count, 1,
            "the resolved fetch persists exactly one member_fetches row")
        let row = recorder.rows.first
        XCTAssertEqual(row?.roomID, roomID, "the row is keyed on the session room")
        XCTAssertEqual(row?.userID, userID, "the row is keyed on the member")
        XCTAssertEqual(row?.payload.map(\.fsqPlaceId), ["a", "b", "c"],
            "the FULL raw fetched union is persisted — every venue")
    }

    // MARK: - the persisted union is the full pool, not the three cards

    func testPersistedUnionIsTheFullPoolNotTheThreeQ5Cards() async {
        // Five fetched venues; only three become Q5 factorial cards.
        // The persisted union must carry all five.
        let raw = [place("a"), place("b"), place("c"), place("d"), place("e")]
        let fetch = StubCandidateFetch(result: QuizCandidateFetchResult(
            candidates: [
                QuizCandidate(id: "a", name: "a", meta: ""),
                QuizCandidate(id: "b", name: "b", meta: ""),
                QuizCandidate(id: "c", name: "c", meta: ""),
            ],
            source: .fetched,
            rawFetch: raw
        ))
        let recorder = RecordingMemberFetchWriter()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch,
            memberFetchWriter: recorder.writer,
            writer: { _ in }
        )

        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        XCTAssertEqual(recorder.rows.first?.payload.count, 5,
            "the persisted union is the full fetched pool, not just the three Q5 cards")
    }

    // MARK: - a no-results fetch carrying real venues still persists them

    func testNoResultsWithRealVenuesStillPersistsThem() async {
        // A union too thin / uniform for the Q5 factorial surfaces as
        // `.noResults` (Q5 renders the no-results screen) — but the
        // venues are real and belong in the room's `options` pool.
        // TB-26: removing the dummy changes only what Q5 displays, not
        // the verdict candidate pool.
        let raw = [place("x"), place("y")]
        let fetch = StubCandidateFetch(result: QuizCandidateFetchResult(
            candidates: [],
            source: .noResults,
            rawFetch: raw
        ))
        let recorder = RecordingMemberFetchWriter()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch,
            memberFetchWriter: recorder.writer,
            writer: { _ in }
        )

        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        XCTAssertEqual(recorder.rows.first?.payload.map(\.fsqPlaceId), ["x", "y"],
            "real venues persist even when Q5 renders the no-results screen")
        XCTAssertEqual(coord.q5CandidatesState, .noResults)
    }

    // MARK: - an empty raw fetch is recorded distinguishably (bug-14)

    func testEmptyRawFetchStillPersistsAnEmptyRow() async {
        // bug-14: a genuinely empty fetch (every call came back empty /
        // the fetch threw) is now persisted as a real `member_fetches`
        // row with an empty `payload` — NOT silently skipped. The
        // server reads the row's presence to distinguish "this member
        // has no candidates" from "this member's write never ran."
        let roomID = UUID()
        let userID = UUID()
        let fetch = StubCandidateFetch(result: QuizCandidateFetchResult(
            candidates: [],
            source: .noResults,
            rawFetch: []
        ))
        let recorder = RecordingMemberFetchWriter()
        let coord = QuizCoordinator(
            roomID: roomID, userID: userID,
            candidateFetch: fetch,
            memberFetchWriter: recorder.writer,
            writer: { _ in }
        )

        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        XCTAssertEqual(recorder.rows.count, 1,
            "an empty fetch still writes one member_fetches row — recorded, not skipped")
        XCTAssertEqual(recorder.rows.first?.roomID, roomID)
        XCTAssertEqual(recorder.rows.first?.userID, userID)
        XCTAssertTrue(recorder.rows.first?.payload.isEmpty ?? false,
            "an empty fetch persists a row with an empty payload — a deliberate 'no candidates' record")
        XCTAssertEqual(coord.lastMemberFetchPersist, .written,
            "the empty-fetch row write succeeded — the persist is marked written")
    }

    // MARK: - a persistence write failure never strands the member

    func testPersistenceWriteFailureDoesNotStrandTheMember() async {
        // The member_fetches write is best-effort — a transient failure
        // must not block the member from reaching Q5 and submitting.
        struct WriteError: Error {}
        let fetch = StubCandidateFetch(result: QuizCandidateFetchResult(
            candidates: [QuizCandidate(id: "a", name: "a", meta: "")],
            source: .fetched,
            rawFetch: [place("a")]
        ))
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch,
            memberFetchWriter: { _ in throw WriteError() },
            writer: { _ in }
        )

        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        // The candidate list still lands and Q5 is reachable.
        XCTAssertEqual(coord.allCandidates.map(\.id), ["a"],
            "a failed persistence write still leaves Q5 with its candidate list")
        XCTAssertEqual(coord.q5CandidatesState, .ready)
    }

    // MARK: - bug-14: a failed persist is surfaced, never swallowed

    func testPersistWriteFailureIsSurfacedToTheFailureSink() async {
        // bug-14 root cause #3: a failed `member_fetches` write was
        // caught and dropped — no telemetry, no signal. The failure is
        // now forwarded to the injected `memberFetchFailureSink` AND
        // recorded on `lastMemberFetchPersist`.
        struct WriteError: Error, CustomStringConvertible {
            var description: String { "member_fetches insert rejected" }
        }
        let fetch = StubCandidateFetch(result: QuizCandidateFetchResult(
            candidates: [QuizCandidate(id: "a", name: "a", meta: "")],
            source: .fetched,
            rawFetch: [place("a")]
        ))
        let captured = CapturedFailures()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch,
            memberFetchWriter: { _ in throw WriteError() },
            memberFetchFailureSink: captured.sink,
            writer: { _ in }
        )

        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        XCTAssertEqual(captured.errors.count, 1,
            "a failed member_fetches write is surfaced to the failure sink exactly once")
        XCTAssertTrue(
            String(describing: captured.errors.first as Any)
                .contains("member_fetches insert rejected"),
            "the failure sink receives the thrown write error")
        guard case .failed = coord.lastMemberFetchPersist else {
            return XCTFail("expected lastMemberFetchPersist to be .failed, got \(coord.lastMemberFetchPersist)")
        }
    }

    func testSuccessfulPersistMarksLastMemberFetchPersistWritten() async {
        // The happy-path complement: a clean write records `.written`.
        let fetch = StubCandidateFetch(result: QuizCandidateFetchResult(
            candidates: [QuizCandidate(id: "a", name: "a", meta: "")],
            source: .fetched,
            rawFetch: [place("a")]
        ))
        let recorder = RecordingMemberFetchWriter()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch,
            memberFetchWriter: recorder.writer,
            writer: { _ in }
        )

        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        XCTAssertEqual(coord.lastMemberFetchPersist, .written)
    }

    func testPersistIsNotAttemptedWithoutAWriter() async {
        // The legacy / boundary path injects no writer — the persist is
        // skipped and `lastMemberFetchPersist` stays `.notAttempted`.
        let fetch = StubCandidateFetch(result: QuizCandidateFetchResult(
            candidates: [QuizCandidate(id: "a", name: "a", meta: "")],
            source: .fetched,
            rawFetch: [place("a")]
        ))
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch,
            writer: { _ in }
        )

        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        XCTAssertEqual(coord.lastMemberFetchPersist, .notAttempted)
    }

    // MARK: - bug-14: submit awaits the fetch + persist before firing

    func testSubmitAwaitsThePersistBeforeTheVerdictFiringWrite() async {
        // bug-14 root cause #1: the verdict-firing `votes` write must
        // not run until the member's candidate fetch AND its
        // `member_fetches` persist have completed. A slow persist must
        // still land before the votes write.
        let order = EventLog()
        let fetch = SlowCandidateFetch(
            result: QuizCandidateFetchResult(
                candidates: [QuizCandidate(id: "a", name: "a", meta: "")],
                source: .fetched,
                rawFetch: [place("a")]
            ),
            log: order
        )
        let memberWriter: MemberFetchWriter = { _ in
            // A slow persist — yields so a non-awaiting submit would
            // race ahead of it.
            for _ in 0..<20 { await Task.yield() }
            order.append("persist")
        }
        let votesWriter: QuizVoteWriter = { _ in
            order.append("votes")
        }
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch,
            memberFetchWriter: memberWriter,
            writer: votesWriter
        )

        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        // Submit immediately — the per-member fetch is still in flight.
        let result = await coord.submit()

        guard case .success = result else {
            return XCTFail("expected submit to succeed, got \(result)")
        }
        XCTAssertEqual(order.events, ["fetch", "persist", "votes"],
            "the verdict-firing votes write must run only after the fetch and member_fetches persist complete")
        XCTAssertEqual(coord.step, .submitted)
    }

    func testSubmitWithoutAnInFlightFetchStillWrites() async {
        // The legacy explicit-`candidates:` init fires no fetch — the
        // submit-awaits-fetch gate must be a clean no-op there.
        let recorder = RecordingWriterDouble()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidates: [QuizCandidate(id: "a", name: "a", meta: "")],
            writer: recorder.writer
        )
        let result = await coord.submit()
        guard case .success = result else {
            return XCTFail("expected submit to succeed, got \(result)")
        }
        XCTAssertEqual(recorder.rows.count, 1,
            "submit still writes when there is no in-flight fetch to await")
        XCTAssertEqual(coord.step, .submitted)
    }

    // MARK: - bug-14 test doubles

    /// Captures every error the coordinator surfaces to its failure sink.
    final class CapturedFailures: @unchecked Sendable {
        var errors: [Error] = []
        var sink: MemberFetchPersistFailureSink {
            { [weak self] error in self?.errors.append(error) }
        }
    }

    /// Ordered append-only log so a test can assert the relative order
    /// of the fetch, the persist, and the votes write.
    final class EventLog: @unchecked Sendable {
        private let lock = NSLock()
        private(set) var events: [String] = []
        func append(_ event: String) {
            lock.lock(); defer { lock.unlock() }
            events.append(event)
        }
    }

    /// A `QuizCandidateFetch` that yields a few times before resolving
    /// (so a non-awaiting `submit()` would race ahead) and logs when it
    /// completes.
    final class SlowCandidateFetch: QuizCandidateFetch, @unchecked Sendable {
        let result: QuizCandidateFetchResult
        let log: EventLog
        init(result: QuizCandidateFetchResult, log: EventLog) {
            self.result = result
            self.log = log
        }
        func fetchCandidates(
            answers: QuizFetchAnswers,
            parameters: SessionParameters
        ) async -> QuizCandidateFetchResult {
            for _ in 0..<10 { await Task.yield() }
            log.append("fetch")
            return result
        }
    }

    /// Minimal recording `QuizVoteWriter` double.
    final class RecordingWriterDouble: @unchecked Sendable {
        var rows: [QuizCoordinator.VoteRow] = []
        var writer: QuizVoteWriter {
            { [weak self] row in self?.rows.append(row) }
        }
    }
}
