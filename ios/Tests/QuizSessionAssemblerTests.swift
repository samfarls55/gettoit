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
    /// Returns a per-request distinct venue so the union/dedupe and
    /// price-cap assertions have real rows to inspect.
    final class RecordingProxyClient: PlacesProxyClient {
        var observed: [PlacesProxyRequest] = []
        /// Optional per-request response override (price-cap test).
        var responseFor: (@Sendable (PlacesProxyRequest) -> PlacesProxyResponse)?

        func search(_ request: PlacesProxyRequest) async throws -> PlacesProxyResponse {
            Self.lock.lock()
            observed.append(request)
            Self.lock.unlock()
            if let responseFor { return responseFor(request) }
            let tag = request.filters?.cuisine ?? "general"
            return PlacesProxyResponse(
                places: [
                    ShapedPlace(
                        fsqPlaceId: "fsq-\(tag)",
                        name: "Spot \(tag)",
                        lat: 0, lng: 0,
                        priceTier: request.filters?.priceTier,
                        walkMinutesEstimate: 7,
                        dietaryTags: [],
                        hours: nil,
                        photos: [],
                        address: nil,
                        categories: ["Diner"]
                    ),
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

    // MARK: - Q5 renders the fetched pool; spend cap respected

    /// Q5's candidate list is drawn from the executor's unioned pool —
    /// not the dummy fixture — and the rendered set respects the Q2
    /// spend cap (the proxy honoring `price_tier` shows through).
    func testQ5RendersTheFetchedPoolAndRespectsTheQ2SpendCap() async {
        let proxy = RecordingProxyClient()
        // The proxy honors the spend cap: it returns a venue priced AT
        // the requested cap, and drops anything pricier. With cap = 2
        // every returned venue is tier <= 2.
        proxy.responseFor = { req in
            let cap = req.filters?.priceTier ?? 4
            let tag = req.filters?.cuisine ?? "general"
            return PlacesProxyResponse(
                places: [
                    ShapedPlace(
                        fsqPlaceId: "fsq-\(tag)",
                        name: "Spot \(tag)",
                        lat: 0, lng: 0,
                        priceTier: cap,
                        walkMinutesEstimate: 6,
                        dietaryTags: [],
                        hours: nil,
                        photos: [],
                        address: nil,
                        categories: ["Diner"]
                    ),
                ],
                disclaimers: [], isThin: false, servedFromCache: false
            )
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

        coord.toggleCuisine(QuizCuisine.mexican)
        coord.advance() // q1 -> q2
        coord.setBudget(2)
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5
        await coord.awaitCandidateFetch()

        XCTAssertEqual(coord.q5CandidatesState, .ready)
        XCTAssertFalse(coord.allCandidates.isEmpty,
            "Q5 must render the fetched pool")
        let dummyIDs = Set(QuizDummyCandidates.all.map(\.id))
        for candidate in coord.allCandidates {
            XCTAssertFalse(dummyIDs.contains(candidate.id),
                "Q5 candidates must come from the fetched pool, not the dummy fixture")
            // Every fetched venue was priced at the cap (tier 2) — the
            // meta string therefore shows "$$".
            XCTAssertTrue(candidate.meta.contains("$$"),
                "the Q2 spend cap (tier 2 → $$) must show through the rendered set")
        }
    }

    // MARK: - pool starvation: three rateable rows, no stranded flow

    /// Genuine pool starvation — proxy thin AND MapKit empty across
    /// every call — still leaves Q5 with three rateable rows.
    func testPoolStarvationFallsBackToThreeRateableRows() async {
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

        XCTAssertEqual(coord.q5CandidatesState, .fallbackDummy)
        XCTAssertEqual(coord.allCandidates, QuizDummyCandidates.all,
            "an empty fetch must leave Q5 with three rateable rows — no stranded flow")
        // The fetch still fired — starvation is observed, not skipped.
        XCTAssertGreaterThanOrEqual(proxy.observed.count, 1)
    }

    // MARK: - no coordinate: dummy fetch, never hits the proxy

    /// No coordinate (a stale routing where the room row vanished). The
    /// coordinator carries a dummy-fixture fetch; even completing Q4
    /// never hits the proxy, and Q5 renders three rows.
    func testNoCoordinateUsesDummyFetchAndNeverHitsTheProxy() async {
        let proxy = RecordingProxyClient()
        let assembled = QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: nil,
            radiusMeters: 3219,
            places: makeService(proxy),
            writer: { _ in }
        )
        XCTAssertEqual(assembled.candidateSource, .fallbackDummy)
        let coord = assembled.coordinator

        coord.advance() // q1 -> q2
        coord.advance() // q2 -> q3
        coord.advance() // q3 -> q4
        coord.advance() // q4 -> q5
        await coord.awaitCandidateFetch()

        XCTAssertEqual(proxy.observed.count, 0,
            "no coordinate → no proxy hit; the dummy fallback is the safe degradation")
        XCTAssertEqual(coord.q5CandidatesState, .fallbackDummy)
        XCTAssertEqual(coord.allCandidates, QuizDummyCandidates.all)
    }
}
