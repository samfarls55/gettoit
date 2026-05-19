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

    // MARK: - an empty raw fetch persists nothing

    func testEmptyRawFetchPersistsNoRow() async {
        // A genuinely empty fetch (every call came back empty / the
        // fetch threw) has no real venues — nothing to persist.
        let fetch = StubCandidateFetch(result: QuizCandidateFetchResult(
            candidates: [],
            source: .noResults,
            rawFetch: []
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

        XCTAssertTrue(recorder.rows.isEmpty,
            "an empty raw fetch contributes no venues — nothing is persisted")
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
}
