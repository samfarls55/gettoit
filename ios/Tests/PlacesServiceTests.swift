// GetToIt — PlacesService unit tests.
//
// Exercise the proxy-call → thin-results detection → MapKit fallback
// path through PlacesService without hitting real network. Uses a
// stub PlacesProxyClient + a stub MapKitFallback so the test runs
// offline on the iOS simulator.
//
// References:
//   * ADR 0002 (Foursquare primary, MapKit fallback).
//   * TB-05 ticket — iOS-side MapKit fallback path.

import XCTest
import CoreLocation
@testable import GetToIt

final class PlacesServiceTests: XCTestCase {

    // MARK: - Stubs

    final class StubProxyClient: PlacesProxyClient {
        var response: PlacesProxyResponse = .empty
        var error: Error?
        var observed: [PlacesProxyRequest] = []
        func search(_ request: PlacesProxyRequest) async throws -> PlacesProxyResponse {
            observed.append(request)
            if let error = error { throw error }
            return response
        }
    }

    final class StubMapKitFallback: PlacesMapKitFallback {
        var places: [ShapedPlace] = []
        var invocations = 0
        func search(near coordinate: CLLocationCoordinate2D, radiusMeters: Double) async -> [ShapedPlace] {
            invocations += 1
            return places
        }
    }

    // MARK: - Tests

    func testReturnsFoursquareResultsWhenNotThin() async throws {
        let proxy = StubProxyClient()
        proxy.response = PlacesProxyResponse(
            places: PlacesServiceTests.makeShapedPlaces(count: 5),
            disclaimers: [],
            isThin: false,
            servedFromCache: false
        )
        let mapKit = StubMapKitFallback()
        let service = PlacesService(proxy: proxy, mapKitFallback: mapKit)

        let result = try await service.fetchPlaces(
            near: .init(latitude: 40.7128, longitude: -74.0060),
            radiusMeters: 1600,
            filters: .init()
        )

        XCTAssertEqual(result.places.count, 5)
        XCTAssertEqual(result.source, .foursquare)
        XCTAssertEqual(mapKit.invocations, 0,
                       "MapKit fallback must not run when Foursquare returned a non-thin response")
    }

    func testFallsBackToMapKitWhenResponseIsThin() async throws {
        let proxy = StubProxyClient()
        proxy.response = PlacesProxyResponse(
            places: PlacesServiceTests.makeShapedPlaces(count: 0),
            disclaimers: [],
            isThin: true,
            servedFromCache: false
        )
        let mapKit = StubMapKitFallback()
        mapKit.places = PlacesServiceTests.makeShapedPlaces(count: 4)
        let service = PlacesService(proxy: proxy, mapKitFallback: mapKit)

        let result = try await service.fetchPlaces(
            near: .init(latitude: 40.7128, longitude: -74.0060),
            radiusMeters: 1600,
            filters: .init()
        )

        XCTAssertEqual(result.places.count, 4)
        XCTAssertEqual(result.source, .mapKitFallback)
        XCTAssertEqual(mapKit.invocations, 1)
    }

    func testFallsBackToMapKitWhenProxyThrows() async throws {
        let proxy = StubProxyClient()
        proxy.error = NSError(domain: "test", code: -1)
        let mapKit = StubMapKitFallback()
        mapKit.places = PlacesServiceTests.makeShapedPlaces(count: 3)
        let service = PlacesService(proxy: proxy, mapKitFallback: mapKit)

        let result = try await service.fetchPlaces(
            near: .init(latitude: 40.7128, longitude: -74.0060),
            radiusMeters: 1600,
            filters: .init()
        )

        XCTAssertEqual(result.source, .mapKitFallback)
        XCTAssertEqual(result.places.count, 3)
        XCTAssertEqual(mapKit.invocations, 1)
    }

    func testProxyCallNeverSeesFoursquareKey() async throws {
        // The Foursquare key is server-side only; the iOS client must
        // never have a chance to attach it to a request. We assert
        // PlacesProxyRequest doesn't carry an `apiKey`-shaped field.
        let proxy = StubProxyClient()
        proxy.response = PlacesProxyResponse(places: [], disclaimers: [], isThin: false, servedFromCache: false)
        let service = PlacesService(proxy: proxy, mapKitFallback: StubMapKitFallback())

        _ = try? await service.fetchPlaces(
            near: .init(latitude: 0, longitude: 0),
            radiusMeters: 100,
            filters: .init()
        )

        XCTAssertEqual(proxy.observed.count, 1)
        let req = proxy.observed.first!
        // Mirror what the request carries to the wire.
        let json = try JSONEncoder().encode(req)
        let str = String(data: json, encoding: .utf8) ?? ""
        XCTAssertFalse(str.lowercased().contains("foursquare"))
        XCTAssertFalse(str.lowercased().contains("api_key"))
        XCTAssertFalse(str.lowercased().contains("apikey"))
    }

    func testDietaryFiltersAreForwardedToTheProxy() async throws {
        let proxy = StubProxyClient()
        proxy.response = PlacesProxyResponse(
            places: PlacesServiceTests.makeShapedPlaces(count: 5),
            disclaimers: [],
            isThin: false,
            servedFromCache: false
        )
        let service = PlacesService(proxy: proxy, mapKitFallback: StubMapKitFallback())

        _ = try await service.fetchPlaces(
            near: .init(latitude: 0, longitude: 0),
            radiusMeters: 100,
            filters: PlacesFilters(dietary: ["halal", "kosher"], priceTier: 2)
        )

        XCTAssertEqual(proxy.observed.count, 1)
        XCTAssertEqual(proxy.observed.first?.filters?.dietary?.sorted(), ["halal", "kosher"])
        XCTAssertEqual(proxy.observed.first?.filters?.priceTier, 2)
    }

    func testEmptyMapKitFallbackSurfaceProducesNoSurvivorSignal() async throws {
        let proxy = StubProxyClient()
        proxy.response = PlacesProxyResponse(places: [], disclaimers: [], isThin: true, servedFromCache: false)
        let mapKit = StubMapKitFallback()
        mapKit.places = []
        let service = PlacesService(proxy: proxy, mapKitFallback: mapKit)

        let result = try await service.fetchPlaces(
            near: .init(latitude: 0, longitude: 0),
            radiusMeters: 100,
            filters: .init()
        )

        // Both layers produced nothing — caller surfaces the
        // "couldn't load options nearby" empty state.
        XCTAssertEqual(result.places.count, 0)
        XCTAssertEqual(result.source, .mapKitFallback)
    }

    // MARK: - Helpers

    private static func makeShapedPlaces(count: Int) -> [ShapedPlace] {
        (0..<count).map { i in
            ShapedPlace(
                fsqPlaceId: "place-\(i)",
                name: "Place \(i)",
                lat: 40.7128 + Double(i) * 0.001,
                lng: -74.0060,
                priceTier: 2,
                walkMinutesEstimate: 5,
                dietaryTags: [],
                hours: nil,
                photos: [],
                address: nil,
                categories: []
            )
        }
    }
}
