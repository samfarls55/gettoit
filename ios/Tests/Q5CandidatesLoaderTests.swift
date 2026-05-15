// GetToIt - Q5CandidatesLoader unit tests (bug-03 v1.1).
//
// Drives the loader through canned PlacesService output and asserts:
//   * The rendered `QuizCandidate` list (which the Q5 view-model
//     pipes directly into `QuizQ5Regret`) matches the canned data -
//     no `QuizDummyCandidates.all` placeholder strings leak through.
//   * The proxy is invoked at least once on the happy path. This
//     mirrors the "PlacesService.fetch() is invoked at least once"
//     boundary assertion for the loader half of the wire-up - the
//     RootView half is covered by `QuizSessionAssemblerTests`.

import XCTest
import CoreLocation
@testable import GetToIt

final class Q5CandidatesLoaderTests: XCTestCase {

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

    // MARK: - happy path: Foursquare results render as the Q5 list

    func testCannedFoursquarePlacesRenderAsQuizCandidates() async {
        let proxy = StubProxyClient()
        proxy.response = PlacesProxyResponse(
            places: [
                ShapedPlace(
                    fsqPlaceId: "fsq-1",
                    name: "Pico's Taqueria",
                    lat: 40.7128, lng: -74.0060,
                    priceTier: 2,
                    walkMinutesEstimate: 8,
                    dietaryTags: [],
                    hours: nil,
                    photos: [],
                    address: nil,
                    categories: ["Mexican"]
                ),
                ShapedPlace(
                    fsqPlaceId: "fsq-2",
                    name: "Ren Soba House",
                    lat: 40.7129, lng: -74.0061,
                    priceTier: 2,
                    walkMinutesEstimate: 12,
                    dietaryTags: [],
                    hours: nil,
                    photos: [],
                    address: nil,
                    categories: ["Japanese"]
                ),
                ShapedPlace(
                    fsqPlaceId: "fsq-3",
                    name: "Bar Pastoral",
                    lat: 40.7130, lng: -74.0062,
                    priceTier: 2,
                    walkMinutesEstimate: 5,
                    dietaryTags: [],
                    hours: nil,
                    photos: [],
                    address: nil,
                    categories: ["Italian"]
                ),
            ],
            disclaimers: [],
            isThin: false,
            servedFromCache: false
        )
        let mapKit = StubMapKitFallback()
        let service = PlacesService(proxy: proxy, mapKitFallback: mapKit)
        let loader = Q5CandidatesLoader(places: service)

        let loaded = await loader.load(
            near: .init(latitude: 40.7128, longitude: -74.0060),
            radiusMeters: 3219
        )

        XCTAssertEqual(loaded.source, .places(.foursquare))
        XCTAssertEqual(loaded.candidates.count, 3)
        XCTAssertEqual(loaded.candidates[0].id, "fsq-1")
        XCTAssertEqual(loaded.candidates[0].name, "Pico's Taqueria")
        XCTAssertEqual(loaded.candidates[0].meta, "Mexican - $$ - 8 min")
        XCTAssertEqual(loaded.candidates[1].id, "fsq-2")
        XCTAssertEqual(loaded.candidates[1].name, "Ren Soba House")
        XCTAssertEqual(loaded.candidates[2].id, "fsq-3")
        XCTAssertEqual(loaded.candidates[2].name, "Bar Pastoral")

        // Boundary assertion: the proxy was hit. If a regression
        // removed the loader's `fetchPlaces` call, `observed` would
        // be empty and this assertion would fail.
        XCTAssertGreaterThanOrEqual(proxy.observed.count, 1,
            "expected PlacesService.fetchPlaces to invoke the proxy at least once on the happy path")
    }

    // MARK: - placeholder strings never leak from canned output

    func testCannedPlacesNeverProduceDummyFixtureNames() async {
        let proxy = StubProxyClient()
        proxy.response = PlacesProxyResponse(
            places: [
                ShapedPlace(
                    fsqPlaceId: "fsq-real-1",
                    name: "Real Spot 1",
                    lat: 0, lng: 0,
                    priceTier: 1,
                    walkMinutesEstimate: 3,
                    dietaryTags: [],
                    hours: nil,
                    photos: [],
                    address: nil,
                    categories: ["Cafe"]
                ),
            ],
            disclaimers: [],
            isThin: false,
            servedFromCache: false
        )
        let service = PlacesService(proxy: proxy, mapKitFallback: StubMapKitFallback())
        let loader = Q5CandidatesLoader(places: service)

        let loaded = await loader.load(
            near: .init(latitude: 0, longitude: 0),
            radiusMeters: 1000
        )

        let dummyNames = Set(QuizDummyCandidates.all.map { $0.name })
        for candidate in loaded.candidates {
            XCTAssertFalse(dummyNames.contains(candidate.name),
                "expected canned Foursquare output to render its own names, not the placeholder fixture")
        }
    }

    // MARK: - MapKit fallback path

    func testThinFoursquareResponseFallsBackToMapKitAndStillProducesCandidates() async {
        let proxy = StubProxyClient()
        proxy.response = PlacesProxyResponse(
            places: [],
            disclaimers: ["Foursquare returned thin"],
            isThin: true,
            servedFromCache: false
        )
        let mapKit = StubMapKitFallback()
        mapKit.places = [
            ShapedPlace(
                fsqPlaceId: "mapkit:cafe-1",
                name: "Cafe Reverb",
                lat: 0, lng: 0,
                priceTier: nil,
                walkMinutesEstimate: 4,
                dietaryTags: [],
                hours: nil,
                photos: [],
                address: nil,
                categories: ["MKPOICategoryCafe"]
            ),
        ]
        let service = PlacesService(proxy: proxy, mapKitFallback: mapKit)
        let loader = Q5CandidatesLoader(places: service)

        let loaded = await loader.load(
            near: .init(latitude: 0, longitude: 0),
            radiusMeters: 1000
        )

        XCTAssertEqual(loaded.source, .places(.mapKitFallback))
        XCTAssertEqual(loaded.candidates.count, 1)
        XCTAssertEqual(loaded.candidates[0].name, "Cafe Reverb")
        XCTAssertEqual(mapKit.invocations, 1)
        // The proxy must still have been hit - the fallback only fires
        // after the proxy returns thin.
        XCTAssertGreaterThanOrEqual(proxy.observed.count, 1)
    }

    // MARK: - empty path: dummy fallback so Q5 still has 3 rows

    func testWhenBothProxyAndMapKitReturnEmptyTheLoaderFallsBackToDummyFixture() async {
        let proxy = StubProxyClient()
        proxy.response = PlacesProxyResponse(
            places: [], disclaimers: [], isThin: true, servedFromCache: false
        )
        let mapKit = StubMapKitFallback()
        mapKit.places = []
        let service = PlacesService(proxy: proxy, mapKitFallback: mapKit)
        let loader = Q5CandidatesLoader(places: service)

        let loaded = await loader.load(
            near: .init(latitude: 0, longitude: 0),
            radiusMeters: 1000
        )

        XCTAssertEqual(loaded.source, .fallbackDummy)
        XCTAssertEqual(loaded.candidates, QuizDummyCandidates.all)
    }

    // MARK: - shape correctness

    func testShapingTruncatesToCardCountThree() {
        let many = (0..<6).map { i in
            ShapedPlace(
                fsqPlaceId: "fsq-\(i)",
                name: "Place \(i)",
                lat: 0, lng: 0,
                priceTier: nil,
                walkMinutesEstimate: nil,
                dietaryTags: [],
                hours: nil,
                photos: [],
                address: nil,
                categories: []
            )
        }
        let shaped = Q5CandidatesLoader.shapeCandidates(from: many)
        XCTAssertEqual(shaped.count, Q5CandidatesLoader.cardCount)
        XCTAssertEqual(shaped.map { $0.id }, ["fsq-0", "fsq-1", "fsq-2"])
    }

    func testMetaFormatsCategoryPriceAndWalkMinutes() {
        let place = ShapedPlace(
            fsqPlaceId: "x",
            name: "X",
            lat: 0, lng: 0,
            priceTier: 3,
            walkMinutesEstimate: 14,
            dietaryTags: [],
            hours: nil,
            photos: [],
            address: nil,
            categories: ["Thai"]
        )
        XCTAssertEqual(Q5CandidatesLoader.metaString(for: place), "Thai - $$$ - 14 min")
    }

    func testMetaSkipsMissingSegments() {
        let place = ShapedPlace(
            fsqPlaceId: "x",
            name: "X",
            lat: 0, lng: 0,
            priceTier: nil,
            walkMinutesEstimate: 7,
            dietaryTags: [],
            hours: nil,
            photos: [],
            address: nil,
            categories: []
        )
        XCTAssertEqual(Q5CandidatesLoader.metaString(for: place), "7 min")
    }
}
