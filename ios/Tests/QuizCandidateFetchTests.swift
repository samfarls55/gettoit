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
            let answers: QuizFetchAnswers
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
            answers: QuizFetchAnswers,
            parameters: SessionParameters
        ) async -> QuizCandidateFetchResult {
            calls.append(Call(answers: answers, parameters: parameters))
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
        XCTAssertEqual(call?.answers.cuisines.sorted(), [QuizCuisine.mexican, QuizCuisine.thai].sorted(),
            "the member's real Q1 cuisines forward to the fetch")
        XCTAssertEqual(call?.answers.budgetTier, 3, "the member's real Q2 spend cap forwards to the fetch")
        XCTAssertEqual(call?.parameters, params, "the session parameters forward to the fetch")
    }

    // MARK: - TB-16: Q3 + Q4 forward to the fetch for the factorial

    /// TB-16 widened the forwarded answers from Q1+Q2 to the full
    /// Q1-Q4 set — the factorial probe needs the member's stated Q3
    /// reputation and Q4 vibe to build its `Q5MemberProfile`.
    func testFetchReceivesTheMembersRealQ3ReputationAndQ4Vibe() async {
        let fetch = RecordingCandidateFetch()
        let coord = QuizCoordinator(
            roomID: UUID(), userID: UUID(),
            candidateFetch: fetch, writer: { _ in }
        )

        coord.advance() // q1 -> q2
        coord.advance() // q2 -> q3
        coord.setReputation(QuizReputation.hiddenGem)
        coord.advance() // q3 -> q4
        coord.setVibe(4)
        coord.advance() // q4 -> q5
        await coord.awaitCandidateFetch()

        let call = try? XCTUnwrap(fetch.calls.first)
        XCTAssertEqual(call?.answers.reputation, QuizReputation.hiddenGem,
            "the member's real Q3 reputation forwards to the fetch")
        XCTAssertEqual(call?.answers.vibe, 4,
            "the member's real Q4 vibe forwards to the fetch")
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

        XCTAssertEqual(fetch.calls.first?.answers.cuisines, [],
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

// MARK: - TB-16: the pool -> factorial seam

/// `FoursquareQuizCandidateFetch.selectFactorialCards` is the seam
/// that classifies a unioned pool and runs the v1.1 factorial probe.
/// These tests drive it directly with a canned pool — the integration
/// through the live `QuizSessionAssembler` to the proxy is covered in
/// `QuizSessionAssemblerTests`.
final class FactorialCardSelectionTests: XCTestCase {

    /// A reference "now" so the reputation age check is deterministic.
    private let now = ISO8601DateFormatter().date(from: "2026-05-16T00:00:00Z")!

    /// Build a fetched venue. `categories` drives cuisine + vibe;
    /// rating / volume / age drive the pool-relative reputation bucket.
    private func place(
        _ id: String,
        categories: [String],
        rating: Double? = nil,
        totalRatings: Int? = nil,
        dateCreated: String? = nil
    ) -> ShapedPlace {
        ShapedPlace(
            fsqPlaceId: id, name: id, lat: 0, lng: 0,
            priceTier: 2, walkMinutesEstimate: 6,
            categories: categories,
            rating: rating, totalRatings: totalRatings, dateCreated: dateCreated
        )
    }

    /// A canned pool that comfortably furnishes a factorial triple for a
    /// member craving Mexican, no reputation preference, vibe Social (2):
    ///   * a Mexican Social venue (keep-card / reputation-drop candidate);
    ///   * a Mexican Lively venue (vibe-drop candidate);
    ///   * a Thai Social venue (cuisine-drop candidate).
    private func factorialFeasiblePool() -> [ShapedPlace] {
        [
            place("mx-social", categories: ["Mexican Restaurant"]),
            place("mx-lively",  categories: ["Mexican Restaurant", "Cocktail Bar"]),
            place("thai-social", categories: ["Thai Restaurant"]),
        ]
    }

    private let mexicanSocial = Q5MemberProfile(
        cuisines: [QuizCuisine.mexican],
        reputation: QuizReputation.noPreference,
        vibe: 2
    )

    // MARK: - AC1 + AC6: three factorial cards from a canned pool

    func testCannedPoolYieldsThreeFactorialCards() {
        let result = FoursquareQuizCandidateFetch.selectFactorialCards(
            from: factorialFeasiblePool(),
            member: mexicanSocial,
            now: now
        )
        XCTAssertEqual(result.source, .fetched)
        XCTAssertEqual(result.candidates.count, 3,
            "Q5 renders exactly three factorial cards")
        XCTAssertEqual(Set(result.candidates.map(\.id)).count, 3,
            "the three cards are distinct venues")
    }

    // AC5: the cards carry real fsq_place_ids — Q5 keys ratings on them.
    func testFactorialCardsCarryRealVenueIds() {
        let result = FoursquareQuizCandidateFetch.selectFactorialCards(
            from: factorialFeasiblePool(),
            member: mexicanSocial,
            now: now
        )
        let poolIDs = Set(factorialFeasiblePool().map(\.fsqPlaceId))
        for candidate in result.candidates {
            XCTAssertTrue(poolIDs.contains(candidate.id),
                "every factorial card keys on a real fetched fsq_place_id")
        }
        let dummyIDs = Set(QuizDummyCandidates.all.map(\.id))
        XCTAssertTrue(result.candidates.allSatisfy { !dummyIDs.contains($0.id) },
            "no placeholder venue leaks into a fetched factorial triple")
    }

    // MARK: - AC2 + AC3: one-axis-deviation cards from a classified pool

    /// Routing the canned pool through `Q5VenueClassifier` +
    /// `Q5FactorialCardGenerator` directly, the three cards each deviate
    /// from the member's profile on exactly one axis.
    func testEachCardDeviatesOnExactlyOneAxis() {
        let classified = Q5VenueClassifier.classify(pool: factorialFeasiblePool(), now: now)
        guard let cards = Q5FactorialCardGenerator.generate(
            member: mexicanSocial, pool: classified
        ) else {
            return XCTFail("the canned pool must furnish a factorial triple")
        }
        XCTAssertEqual(Set(cards.map(\.droppedAxis)), Set(Q5FactorialCard.Axis.allCases),
            "the triple drops each axis exactly once")

        for card in cards {
            let p = card.venue.profile
            let cuisineMatches = p.cuisine.map { mexicanSocial.cuisines.contains($0) } ?? false
            let vibeMatches = p.vibe == mexicanSocial.vibe
            switch card.droppedAxis {
            case .cuisine:
                XCTAssertFalse(cuisineMatches, "cuisine-drop card deviates on cuisine")
                XCTAssertTrue(vibeMatches, "cuisine-drop card matches vibe")
            case .vibe:
                XCTAssertTrue(cuisineMatches, "vibe-drop card matches cuisine")
                XCTAssertFalse(vibeMatches, "vibe-drop card deviates on vibe")
            case .reputation:
                XCTAssertTrue(cuisineMatches, "reputation-drop card matches cuisine")
                XCTAssertTrue(vibeMatches, "reputation-drop card matches vibe")
            }
        }
    }

    // MARK: - AC4: pool starvation falls back to three rateable rows

    func testEmptyPoolFallsBackToThreeRateableRows() {
        let result = FoursquareQuizCandidateFetch.selectFactorialCards(
            from: [], member: mexicanSocial, now: now
        )
        XCTAssertEqual(result.source, .fallbackDummy)
        XCTAssertEqual(result.candidates, QuizDummyCandidates.all,
            "an empty pool still leaves Q5 with three rateable rows")
    }

    func testTooUniformPoolCannotFurnishAFactorialTripleAndFallsBack() {
        // Three venues all the same cuisine + vibe — the factorial
        // cannot furnish a cuisine-drop or vibe-drop card. No
        // placeholder venue is invented; the surface-boundary fallback
        // renders three rateable rows instead.
        let uniform = [
            place("a", categories: ["Mexican Restaurant"]),
            place("b", categories: ["Mexican Restaurant"]),
            place("c", categories: ["Mexican Restaurant"]),
        ]
        let result = FoursquareQuizCandidateFetch.selectFactorialCards(
            from: uniform, member: mexicanSocial, now: now
        )
        XCTAssertEqual(result.source, .fallbackDummy)
        XCTAssertEqual(result.candidates, QuizDummyCandidates.all)
    }
}
