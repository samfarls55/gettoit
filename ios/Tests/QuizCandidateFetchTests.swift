// GetToIt - QuizCandidateFetch + coordinator step-machine wiring tests
// (TB-15 v1.1).
//
// TB-15 wires the per-member Foursquare fetch onto the QuizCoordinator's
// step machine: the fetch fires once, on the Q4 -> Q5 transition, with
// the member's REAL Q1 cuisines + Q2 spend cap + session parameters.
//
// These tests use a recording `QuizCandidateFetch` double so the
// coordinator-side wiring (when the fetch fires, what answers it
// forwards, the lifecycle state) is verified without standing up
// `PlacesService`. The proxy-level boundary (the N+1 calls actually
// reaching the wire) is covered by `QuizSessionAssemblerTests`.

import XCTest
import CoreLocation
@testable import GetToIt

@MainActor
final class QuizCandidateFetchTests: XCTestCase {

    // MARK: - recording fetch double

    /// Records every `fetchCandidates` call's forwarded answers and
    /// returns a configurable result.
    final class RecordingCandidateFetch: QuizCandidateFetch, @unchecked Sendable {
        struct Call: Equatable {
            let cuisines: [String]
            let budgetTier: Int
            let parameters: SessionParameters
        }
        var calls: [Call] = []
        var result: QuizCandidateFetchResult = QuizCandidateFetchResult(
            candidates: [
                QuizCandidate(id: "fsq-a", name: "Spot A", meta: "Diner - $$ - 6 min"),
                QuizCandidate(id: "fsq-b", name: "Spot B", meta: "Pizza - $ - 9 min"),
                QuizCandidate(id: "fsq-c", name: "Spot C", meta: "Sushi - $$ - 4 min"),
            ],
            source: .fetched
        )

        func fetchCandidates(
            cuisines: [String],
            budgetTier: Int,
            parameters: SessionParameters
        ) async -> QuizCandidateFetchResult {
            calls.append(Call(cuisines: cuisines, budgetTier: budgetTier, parameters: parameters))
            return result
        }
    }

    // MARK: - the fetch fires on Q4 -> Q5, not before

    func testFetchDoesNotFireUntilTheMemberCompletesQ4() async {
        let fetch = RecordingCandidateFetch()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch, writer: { _ in }
        )

        XCTAssertEqual(coord.q5CandidatesState, .idle)
        XCTAssertTrue(fetch.calls.isEmpty, "no fetch on construction")

        coord.advance() // q1 -> q2
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        XCTAssertTrue(fetch.calls.isEmpty,
            "no fetch fires walking Q1-Q3 — the trigger is completing Q4")
        XCTAssertEqual(coord.q5CandidatesState, .idle)
    }

    func testCompletingQ4FiresExactlyOneFetch() async {
        let fetch = RecordingCandidateFetch()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch, writer: { _ in }
        )

        coord.advance() // q1 -> q2
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5 — fires the fetch
        XCTAssertEqual(coord.q5CandidatesState, .loading,
            "the fetch is in flight immediately after Q4 -> Q5")
        await coord.awaitCandidateFetch()

        XCTAssertEqual(fetch.calls.count, 1, "completing Q4 fires exactly one fetch")
        XCTAssertEqual(coord.q5CandidatesState, .ready)
    }

    // MARK: - the member's real answers forward to the fetch

    func testFetchReceivesTheMembersRealQ1CuisinesAndQ2SpendCap() async {
        let fetch = RecordingCandidateFetch()
        let params = SessionParameters(
            mealTime: .lunch, groupContext: .duo,
            serviceShape: .takeoutPickup, transportMode: .drive
        )
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch, sessionParameters: params, writer: { _ in }
        )

        coord.toggleCuisine(QuizCuisine.mexican)
        coord.toggleCuisine(QuizCuisine.thai)
        coord.advance() // q1 -> q2
        coord.setBudget(3)
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5
        await coord.awaitCandidateFetch()

        let call = try? XCTUnwrap(fetch.calls.first)
        XCTAssertEqual(call?.cuisines.sorted(), [QuizCuisine.mexican, QuizCuisine.thai].sorted(),
            "the member's real Q1 cuisines forward to the fetch")
        XCTAssertEqual(call?.budgetTier, 3, "the member's real Q2 spend cap forwards to the fetch")
        XCTAssertEqual(call?.parameters, params, "the session parameters forward to the fetch")
    }

    func testNoPreferenceQ1ForwardsAnEmptyCuisineList() async {
        let fetch = RecordingCandidateFetch()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch, writer: { _ in }
        )

        coord.toggleCuisineNoPreference()
        coord.advance() // q1 -> q2
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5
        await coord.awaitCandidateFetch()

        XCTAssertEqual(fetch.calls.first?.cuisines, [],
            "a No-preference Q1 forwards an empty cuisine list, not a stale set")
    }

    // MARK: - the fetched pool becomes the Q5 candidate source

    func testFetchedPoolBecomesTheQ5CandidateList() async {
        let fetch = RecordingCandidateFetch()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch, writer: { _ in }
        )

        // Before the fetch resolves the candidate list is empty —
        // there is no pre-quiz fixture on the live path.
        XCTAssertTrue(coord.allCandidates.isEmpty)

        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        XCTAssertEqual(coord.allCandidates.map(\.id), ["fsq-a", "fsq-b", "fsq-c"],
            "the fetched pool becomes Q5's candidate source")
        // Q5 ratings are seeded for the fetched venues so the member
        // can submit without touching every card.
        XCTAssertEqual(coord.q5Ratings["fsq-a"], 3)
        XCTAssertEqual(coord.q5Ratings["fsq-b"], 3)
        XCTAssertEqual(coord.q5Ratings["fsq-c"], 3)
    }

    // MARK: - a Q5 rating round-trips onto the fetched venues

    func testRatingAFetchedVenueIsCapturedOnTheVoteRow() async {
        let fetch = RecordingCandidateFetch()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch, writer: { _ in }
        )
        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        coord.setRegret(candidateID: "fsq-a", score: 5)
        coord.setRegret(candidateID: "fsq-b", score: 2)
        let row = coord.buildRow()
        XCTAssertEqual(row.q5Regret["fsq-a"], 5)
        XCTAssertEqual(row.q5Regret["fsq-b"], 2)
        XCTAssertEqual(row.q5Regret["fsq-c"], 3, "untouched fetched venue keeps the seeded default")
    }

    // MARK: - pool-starvation result flips the state

    func testFallbackDummyResultFlipsTheStateToFallback() async {
        let fetch = RecordingCandidateFetch()
        fetch.result = QuizCandidateFetchResult(
            candidates: QuizDummyCandidates.all, source: .fallbackDummy
        )
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch, writer: { _ in }
        )
        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        await coord.awaitCandidateFetch()

        XCTAssertEqual(coord.q5CandidatesState, .fallbackDummy)
        XCTAssertEqual(coord.allCandidates, QuizDummyCandidates.all,
            "a starved fetch still leaves Q5 with three rateable rows")
    }
}
