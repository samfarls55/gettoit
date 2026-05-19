// GetToIt - QuizSessionAssembler boundary tests (bug-03 v1.1,
// rewired TB-15 v1.1).
//
// TB-15 moved the per-member Foursquare fetch off the pre-quiz
// assembler seam and onto the QuizCoordinator's step machine: the
// fetch fires when the member completes Q4, with the member's REAL
// Q1-Q4 answers — never on the pre-quiz assembler seam, never with an
// empty `PlacesFilters()`.
//
// These boundary assertions, driven by a recording `PlacesProxyClient`
// (the `FoursquareFetchExecutorTests` / original `QuizSessionAssembler-
// Tests` pattern), guarantee:
//   * zero proxy calls fire before the member reaches Q5;
//   * completing Q4 fires the N+1 answer-tailored calls;
//   * the member's Q1 cuisines + Q2 spend cap forward intact onto the
//     wire (the bug-03 silent-no-call + empty-filter failure modes);
//   * genuine pool starvation still leaves Q5 with three rateable rows.

import XCTest
import CoreLocation
@testable import GetToIt

@MainActor
final class QuizSessionAssemblerTests: XCTestCase {

    // MARK: - Recording proxy

    /// Records every `PlacesProxyRequest` the per-member fetch fires.
    ///
    /// TB-16: the default response returns a *factorial-feasible* venue
    /// set per call — a venue carrying the call's cuisine tag at the
    /// member-matching vibe (a keep-card candidate), the same cuisine at
    /// a deviating vibe (the vibe-drop candidate), and a non-craved
    /// cuisine at the matching vibe (the cuisine-drop candidate). The
    /// unioned pool therefore has the cuisine + vibe spread the v1.1
    /// `Q5FactorialCardGenerator` needs to select three one-axis-
    /// deviation cards. Reputation rides on the default `no_preference`
    /// Q3 answer, whose factorial rule is always-satisfied.
    final class RecordingProxyClient: PlacesProxyClient {
        var observed: [PlacesProxyRequest] = []
        /// Optional per-request response override (price-cap test).
        var responseFor: (@Sendable (PlacesProxyRequest) -> PlacesProxyResponse)?

        /// A Foursquare category name for each `QuizCuisine` id, so the
        /// classifier's `categories[]` cuisine match resolves.
        static let categoryForCuisine: [String: String] = [
            QuizCuisine.mexican: "Mexican Restaurant",
            QuizCuisine.italian: "Italian Restaurant",
            QuizCuisine.japanese: "Sushi Restaurant",
            QuizCuisine.thai: "Thai Restaurant",
            QuizCuisine.chinese: "Chinese Restaurant",
            QuizCuisine.indian: "Indian Restaurant",
            QuizCuisine.american: "American Restaurant",
            QuizCuisine.mediterranean: "Mediterranean Restaurant",
        ]

        func search(_ request: PlacesProxyRequest) async throws -> PlacesProxyResponse {
            Self.lock.lock()
            observed.append(request)
            Self.lock.unlock()
            if let responseFor { return responseFor(request) }
            let cuisineTag = request.filters?.cuisine
            let tag = cuisineTag ?? "general"
            let cap = request.filters?.priceTier
            // The call's cuisine category (a plain restaurant on the
            // general call — the classifier reads that as no cuisine).
            let cuisineCategory = cuisineTag.flatMap { Self.categoryForCuisine[$0] }
                ?? "Restaurant"
            func place(_ suffix: String, categories: [String]) -> ShapedPlace {
                ShapedPlace(
                    fsqPlaceId: "fsq-\(tag)-\(suffix)",
                    name: "Spot \(tag) \(suffix)",
                    lat: 0, lng: 0,
                    priceTier: cap,
                    walkMinutesEstimate: 7,
                    dietaryTags: [],
                    hours: nil,
                    photos: [],
                    address: nil,
                    categories: categories
                )
            }
            return PlacesProxyResponse(
                places: [
                    // Social (vibe 2 — a plain restaurant) of the call's
                    // cuisine — a keep-card / cuisine-drop candidate.
                    place("social", categories: [cuisineCategory]),
                    // A higher-energy (vibe 3 — a bar) venue that still
                    // carries the call's cuisine — the vibe-drop
                    // candidate. Two categories: the bar archetype wins
                    // the vibe scan, the cuisine fragment still resolves.
                    place("lively", categories: [cuisineCategory, "Cocktail Bar"]),
                    // A non-craved cuisine at Social vibe — the
                    // cuisine-drop candidate when the member craves
                    // something else.
                    place("thai-social", categories: ["Thai Restaurant"]),
                ],
                disclaimers: [],
                isThin: false,
                servedFromCache: false
            )
        }

        static let lock = NSLock()
    }

    final class NoopMapKitFallback: PlacesMapKitFallback {
        func search(near coordinate: CLLocationCoordinate2D, radiusMeters: Double) async -> [ShapedPlace] {
            []
        }
    }

    private let coordinate = CLLocationCoordinate2D(latitude: 37.7849, longitude: -122.4094)

    private func makeService(_ proxy: RecordingProxyClient) -> PlacesService {
        PlacesService(proxy: proxy, mapKitFallback: NoopMapKitFallback())
    }

    // MARK: - boundary: no fetch before Q4

    /// The canonical bug-03 regression guard, sharpened for TB-15: NO
    /// PlacesProxy / Foursquare call may fire before the member has
    /// answered Q1-Q4. Assembling the coordinator and walking Q1-Q3
    /// must leave the proxy untouched.
    func testNoProxyCallFiresBeforeTheMemberCompletesQ4() async {
        let proxy = RecordingProxyClient()
        let assembled = QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: coordinate,
            radiusMeters: 3219,
            places: makeService(proxy),
            writer: { _ in }
        )

        XCTAssertEqual(proxy.observed.count, 0,
            "assembling the coordinator must not fetch — the bug-03 pre-quiz empty-filter fetch is removed")

        let coord = assembled.coordinator
        coord.advance() // q1 -> q2
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        XCTAssertEqual(proxy.observed.count, 0,
            "no proxy call may fire before the member completes Q4")
        XCTAssertEqual(coord.q5CandidatesState, .idle,
            "the fetch must not have started before Q4 -> Q5")
    }

    // MARK: - boundary: completing Q4 fires the N+1 calls

    /// Completing Q4 triggers the per-member fetch. With three craved
    /// cuisines the executor fires N+1 = 4 calls (3 cuisine-tagged +
    /// 1 general).
    func testCompletingQ4FiresTheNPlusOnePerMemberFetch() async {
        let proxy = RecordingProxyClient()
        let assembled = QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: coordinate,
            radiusMeters: 3219,
            places: makeService(proxy),
            writer: { _ in }
        )
        let coord = assembled.coordinator

        coord.advance() // q1 -> q2
        coord.toggleCuisine(QuizCuisine.mexican)
        coord.toggleCuisine(QuizCuisine.italian)
        coord.toggleCuisine(QuizCuisine.thai)
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5 — fires the fetch
        await coord.awaitCandidateFetch()

        XCTAssertEqual(proxy.observed.count, 4,
            "3 craved cuisines → 3 cuisine calls + 1 general = 4 proxy hits, fired on Q4 -> Q5")
        XCTAssertEqual(coord.q5CandidatesState, .ready)
    }

    /// No craved cuisines (the "No preference" answer) still fires the
    /// lone mandatory general call — never zero calls.
    func testNoPreferenceStillFiresTheLoneGeneralCallAfterQ4() async {
        let proxy = RecordingProxyClient()
        let assembled = QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: coordinate,
            radiusMeters: 3219,
            places: makeService(proxy),
            writer: { _ in }
        )
        let coord = assembled.coordinator

        coord.toggleCuisineNoPreference()
        coord.advance() // q1 -> q2
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5
        await coord.awaitCandidateFetch()

        XCTAssertEqual(proxy.observed.count, 1,
            "a No-preference Q1 still fires the mandatory general call")
        let req = proxy.observed[0]
        XCTAssertNil(req.filters?.cuisine, "the lone call is the general (untagged) call")
    }

    // MARK: - boundary: the member's answers forward intact

    /// The recorded proxy requests carry the member's REAL Q1 cuisines
    /// (as advisory tags), the Q2 spend cap (as `price_tier`), the
    /// session geo + radius — never an empty `PlacesFilters()`.
    func testTheMembersQ1AndQ2AnswersForwardIntactToTheProxy() async {
        let proxy = RecordingProxyClient()
        let assembled = QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: CLLocationCoordinate2D(latitude: 12.34, longitude: 56.78),
            radiusMeters: 4321,
            places: makeService(proxy),
            writer: { _ in }
        )
        let coord = assembled.coordinator

        coord.toggleCuisine(QuizCuisine.mexican)
        coord.toggleCuisine(QuizCuisine.japanese)
        coord.advance() // q1 -> q2
        coord.setBudget(3)
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5
        await coord.awaitCandidateFetch()

        // 2 cuisines → 2 cuisine calls + 1 general.
        XCTAssertEqual(proxy.observed.count, 3)
        for req in proxy.observed {
            // The Q2 spend cap forwards to every call as a hard filter.
            XCTAssertEqual(req.filters?.priceTier, 3,
                "the Q2 spend cap must forward to every call — never an empty PlacesFilters()")
            XCTAssertNotNil(req.filters?.openAt,
                "the session meal-time open_at filter must be set")
            XCTAssertEqual(req.lat, 12.34, accuracy: 1e-9)
            XCTAssertEqual(req.lng, 56.78, accuracy: 1e-9)
            XCTAssertEqual(req.radiusMeters, 4321, accuracy: 1e-9)
        }
        // The member's real Q1 cuisines forward as advisory tags.
        let tags = proxy.observed.compactMap { $0.filters?.cuisine }.sorted()
        XCTAssertEqual(tags, [QuizCuisine.japanese, QuizCuisine.mexican])
        XCTAssertEqual(proxy.observed.filter { $0.filters?.cuisine == nil }.count, 1,
            "exactly one general (untagged) call")
    }

    // MARK: - Q5 renders the factorial cards; spend cap respected

    /// Q5's candidate list is the three `Q5FactorialCardGenerator` cards
    /// selected from the executor's unioned pool — not the dummy fixture
    /// — and the rendered set respects the Q2 spend cap (the proxy
    /// honoring `price_tier` shows through). The default recording proxy
    /// already returns a factorial-feasible (cuisine + vibe varied)
    /// pool priced at the cap.
    func testQ5RendersTheFactorialCardsAndRespectsTheQ2SpendCap() async {
        let proxy = RecordingProxyClient()
        let assembled = QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: coordinate,
            radiusMeters: 3219,
            places: makeService(proxy),
            writer: { _ in }
        )
        let coord = assembled.coordinator

        coord.toggleCuisine(QuizCuisine.mexican)
        coord.advance() // q1 -> q2
        coord.setBudget(2)
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5
        await coord.awaitCandidateFetch()

        XCTAssertEqual(coord.q5CandidatesState, .ready)
        XCTAssertEqual(coord.allCandidates.count, 3,
            "Q5 renders exactly the three factorial cards")
        for candidate in coord.allCandidates {
            XCTAssertFalse(candidate.id.hasPrefix("dummy-"),
                "Q5 candidates must be factorial cards from the fetched pool, not a fixture")
            // Every fetched venue was priced at the cap (tier 2) — the
            // meta string therefore shows "$$".
            XCTAssertTrue(candidate.meta.contains("$$"),
                "the Q2 spend cap (tier 2 → $$) must show through the rendered set")
        }
        // The three rated venues key on real fsq ids.
        XCTAssertEqual(Set(coord.allCandidates.map(\.id)).count, 3,
            "the three factorial cards are distinct real venues")
    }

    // MARK: - pool starvation: no-results screen, no stranded flow

    /// Genuine pool starvation — proxy thin AND MapKit empty across
    /// every call — resolves Q5 to the no-results screen (TB-26).
    func testPoolStarvationResolvesToNoResults() async {
        let proxy = RecordingProxyClient()
        proxy.responseFor = { _ in
            PlacesProxyResponse(places: [], disclaimers: [], isThin: true, servedFromCache: false)
        }
        let assembled = QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: coordinate,
            radiusMeters: 3219,
            places: makeService(proxy),
            writer: { _ in }
        )
        let coord = assembled.coordinator

        coord.advance() // q1 -> q2
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5
        await coord.awaitCandidateFetch()

        XCTAssertEqual(coord.q5CandidatesState, .noResults)
        XCTAssertTrue(coord.allCandidates.isEmpty,
            "an empty fetch leaves Q5 with no candidates — the no-results screen renders")
        // The fetch still fired — starvation is observed, not skipped.
        XCTAssertGreaterThanOrEqual(proxy.observed.count, 1)
    }

    // MARK: - no coordinate: dummy fetch, never hits the proxy

    /// No coordinate (a stale routing where the room row vanished). The
    /// coordinator carries a `NoResultsQuizCandidateFetch`; even
    /// completing Q4 never hits the proxy, and Q5 renders the
    /// no-results screen (TB-26).
    func testNoCoordinateUsesNoResultsFetchAndNeverHitsTheProxy() async {
        let proxy = RecordingProxyClient()
        let assembled = QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: nil,
            radiusMeters: 3219,
            places: makeService(proxy),
            writer: { _ in }
        )
        XCTAssertEqual(assembled.candidateSource, .noResults)
        let coord = assembled.coordinator

        coord.advance() // q1 -> q2
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5
        await coord.awaitCandidateFetch()

        XCTAssertEqual(proxy.observed.count, 0,
            "no coordinate → no proxy hit; the no-results screen is the safe degradation")
        XCTAssertEqual(coord.q5CandidatesState, .noResults)
        XCTAssertTrue(coord.allCandidates.isEmpty,
            "no coordinate → no candidates; Q5 renders the no-results screen")
    }
}
