// GetToIt — FoursquareFetchExecutor boundary tests (TB-07 v1.1).
//
// The executor (PRD module F) wraps the pure FoursquareFetchPlanner: it
// takes the same per-member inputs, asks the planner for the N+1 call
// specs, runs them in parallel through PlacesService, then unions and
// dedupes the venue results by `fsq_place_id`.
//
// This file is the explicit bug-03 regression guard. A RecordingProxy
// — the same pattern as `QuizSessionAssemblerTests.swift`'s
// `RecordingProxyClient` — records every PlacesProxyRequest the
// executor fires. The boundary assertions: (1) the N+1 calls actually
// reach the proxy with the correct count for the happy path, and (2)
// the planner's specs forward intact (geo, radius, price, cuisine tag).
// Before bug-03 this count was zero — the silent no-call failure mode.

import XCTest
import CoreLocation
@testable import GetToIt

@MainActor
final class FoursquareFetchExecutorTests: XCTestCase {

    // MARK: - Recording proxy (QuizSessionAssemblerTests pattern)

    /// Records every request and returns a per-request, distinct venue
    /// set so the union/dedupe assertions have something to chew on.
    final class RecordingProxyClient: PlacesProxyClient {
        var observed: [PlacesProxyRequest] = []
        /// Keyed by the cuisine tag (nil → the general call) so each
        /// call can return a distinct + a deliberately-overlapping
        /// venue, exercising the dedupe path.
        var responseFor: (@Sendable (PlacesProxyRequest) -> PlacesProxyResponse)?

        func search(_ request: PlacesProxyRequest) async throws -> PlacesProxyResponse {
            // Append is not Sendable-safe across the parallel calls in a
            // strict sense, but the test target runs the actor-isolated
            // executor; the proxy itself is hopped onto the test's
            // context. Guard with a lock to be correct under -strict.
            Self.lock.lock()
            observed.append(request)
            Self.lock.unlock()
            if let responseFor { return responseFor(request) }
            return PlacesProxyResponse(
                places: [
                    ShapedPlace(fsqPlaceId: "fsq-shared", name: "Shared", lat: 0, lng: 0, categories: ["Diner"]),
                ],
                disclaimers: [], isThin: false, servedFromCache: false
            )
        }

        static let lock = NSLock()
    }

    final class NoopMapKitFallback: PlacesMapKitFallback {
        func search(near coordinate: CLLocationCoordinate2D, radiusMeters: Double) async -> [ShapedPlace] {
            []
        }
    }

    private let coordinate = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)
    private let fixedNow = Date(timeIntervalSince1970: 1_778_000_000)

    // MARK: - boundary: the N+1 calls actually fire

    func testHappyPathFiresNPlusOneProxyCalls() async throws {
        let proxy = RecordingProxyClient()
        let service = PlacesService(proxy: proxy, mapKitFallback: NoopMapKitFallback())
        let executor = FoursquareFetchExecutor(places: service)

        _ = try await executor.fetch(
            cuisines: [QuizCuisine.mexican, QuizCuisine.italian, QuizCuisine.thai],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )

        // N=3 cuisines → 3 cuisine calls + 1 general = 4 proxy hits.
        XCTAssertEqual(proxy.observed.count, 4,
            "expected the N+1 calls to actually reach the proxy — this is the bug-03 silent-no-call regression guard")
    }

    func testNoCuisinesStillFiresTheLoneGeneralCall() async throws {
        let proxy = RecordingProxyClient()
        let service = PlacesService(proxy: proxy, mapKitFallback: NoopMapKitFallback())
        let executor = FoursquareFetchExecutor(places: service)

        _ = try await executor.fetch(
            cuisines: [],
            budgetTier: 1,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )

        XCTAssertEqual(proxy.observed.count, 1,
            "no craved cuisines still fires the mandatory general call — never zero calls")
    }

    // MARK: - boundary: planner specs forward intact

    func testPlannerSpecsForwardIntactToTheProxy() async throws {
        let proxy = RecordingProxyClient()
        let service = PlacesService(proxy: proxy, mapKitFallback: NoopMapKitFallback())
        let executor = FoursquareFetchExecutor(places: service)

        _ = try await executor.fetch(
            cuisines: [QuizCuisine.mexican, QuizCuisine.japanese],
            budgetTier: 3,
            parameters: .default,
            coordinate: CLLocationCoordinate2D(latitude: 12.34, longitude: 56.78),
            radiusMeters: 3217,
            now: fixedNow
        )

        XCTAssertEqual(proxy.observed.count, 3)
        for req in proxy.observed {
            // Geo + radius + price forward to every call.
            XCTAssertEqual(req.lat, 12.34, accuracy: 1e-9)
            XCTAssertEqual(req.lng, 56.78, accuracy: 1e-9)
            XCTAssertEqual(req.radiusMeters, 3217, accuracy: 1e-9)
            XCTAssertEqual(req.filters?.priceTier, 3)
            XCTAssertNotNil(req.filters?.openAt)
        }
        // Two cuisine-tagged calls + one general.
        let tags = proxy.observed.compactMap { $0.filters?.cuisine }.sorted()
        XCTAssertEqual(tags, [QuizCuisine.japanese, QuizCuisine.mexican])
        XCTAssertEqual(proxy.observed.filter { $0.filters?.cuisine == nil }.count, 1)
    }

    // MARK: - union + dedupe

    func testResultsUnionAcrossAllCalls() async throws {
        let proxy = RecordingProxyClient()
        // Each call returns a unique venue id derived from its cuisine
        // tag, plus one shared venue every call returns.
        proxy.responseFor = { req in
            let tag = req.filters?.cuisine ?? "general"
            return PlacesProxyResponse(
                places: [
                    ShapedPlace(fsqPlaceId: "fsq-\(tag)", name: tag, lat: 0, lng: 0),
                    ShapedPlace(fsqPlaceId: "fsq-shared", name: "Shared", lat: 0, lng: 0),
                ],
                disclaimers: [], isThin: false, servedFromCache: false
            )
        }
        let service = PlacesService(proxy: proxy, mapKitFallback: NoopMapKitFallback())
        let executor = FoursquareFetchExecutor(places: service)

        let result = try await executor.fetch(
            cuisines: [QuizCuisine.mexican, QuizCuisine.italian],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )

        // 3 calls (mexican, italian, general). Unique venues:
        // fsq-mexican, fsq-italian, fsq-general, fsq-shared = 4.
        let ids = Set(result.places.map(\.fsqPlaceId))
        XCTAssertEqual(ids, ["fsq-mexican", "fsq-italian", "fsq-general", "fsq-shared"])
    }

    func testDuplicateVenuesAreDedupedByVenueId() async throws {
        let proxy = RecordingProxyClient()
        // Every call returns the SAME two venues.
        proxy.responseFor = { _ in
            PlacesProxyResponse(
                places: [
                    ShapedPlace(fsqPlaceId: "fsq-a", name: "A", lat: 0, lng: 0),
                    ShapedPlace(fsqPlaceId: "fsq-b", name: "B", lat: 0, lng: 0),
                ],
                disclaimers: [], isThin: false, servedFromCache: false
            )
        }
        let service = PlacesService(proxy: proxy, mapKitFallback: NoopMapKitFallback())
        let executor = FoursquareFetchExecutor(places: service)

        let result = try await executor.fetch(
            cuisines: [QuizCuisine.mexican, QuizCuisine.italian, QuizCuisine.thai],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )

        // 4 calls each returning {fsq-a, fsq-b} → deduped to 2 venues.
        XCTAssertEqual(result.places.count, 2)
        XCTAssertEqual(Set(result.places.map(\.fsqPlaceId)), ["fsq-a", "fsq-b"])
    }

    func testEmptyResultsAcrossAllCallsYieldAnEmptyUnion() async throws {
        let proxy = RecordingProxyClient()
        proxy.responseFor = { _ in
            PlacesProxyResponse(places: [], disclaimers: [], isThin: true, servedFromCache: false)
        }
        let service = PlacesService(proxy: proxy, mapKitFallback: NoopMapKitFallback())
        let executor = FoursquareFetchExecutor(places: service)

        let result = try await executor.fetch(
            cuisines: [QuizCuisine.mexican],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )

        XCTAssertTrue(result.places.isEmpty)
        // Both calls still fired even though the pool came back empty.
        XCTAssertEqual(proxy.observed.count, 2)
    }
}
