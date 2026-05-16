// GetToIt - Q5CandidatesLoader shaping tests (bug-03 v1.1,
// narrowed TB-15 v1.1).
//
// TB-15 removed the bug-03 tracer-bullet fetch (`load(near:)` — one
// early `PlacesService.fetchPlaces` with empty filters). What remains
// on `Q5CandidatesLoader` is pure shaping logic: `[ShapedPlace]` ->
// `[QuizCandidate]`, truncated to the 3-card Q5 layout. These tests
// cover that shaping. The per-member fetch wiring is covered by
// `QuizCandidateFetchTests` / `QuizSessionAssemblerTests`; the proxy-
// level N+1 boundary by `FoursquareFetchExecutorTests`.

import XCTest
@testable import GetToIt

final class Q5CandidatesLoaderTests: XCTestCase {

    // MARK: - shaping: places render as Q5 candidates

    func testPlacesRenderAsQuizCandidates() {
        let places = [
            ShapedPlace(
                fsqPlaceId: "fsq-1", name: "Pico's Taqueria",
                lat: 40.7128, lng: -74.0060,
                priceTier: 2, walkMinutesEstimate: 8,
                categories: ["Mexican"]
            ),
            ShapedPlace(
                fsqPlaceId: "fsq-2", name: "Ren Soba House",
                lat: 40.7129, lng: -74.0061,
                priceTier: 2, walkMinutesEstimate: 12,
                categories: ["Japanese"]
            ),
            ShapedPlace(
                fsqPlaceId: "fsq-3", name: "Bar Pastoral",
                lat: 40.7130, lng: -74.0062,
                priceTier: 2, walkMinutesEstimate: 5,
                categories: ["Italian"]
            ),
        ]
        let shaped = Q5CandidatesLoader.shapeCandidates(from: places)

        XCTAssertEqual(shaped.count, 3)
        XCTAssertEqual(shaped[0].id, "fsq-1")
        XCTAssertEqual(shaped[0].name, "Pico's Taqueria")
        XCTAssertEqual(shaped[0].meta, "Mexican - $$ - 8 min")
        XCTAssertEqual(shaped[1].id, "fsq-2")
        XCTAssertEqual(shaped[1].name, "Ren Soba House")
        XCTAssertEqual(shaped[2].id, "fsq-3")
        XCTAssertEqual(shaped[2].name, "Bar Pastoral")
    }

    // MARK: - shaped candidates carry the real venue names, not the fixture

    func testShapedCandidatesNeverProduceDummyFixtureNames() {
        let places = [
            ShapedPlace(
                fsqPlaceId: "fsq-real-1", name: "Real Spot 1",
                lat: 0, lng: 0,
                priceTier: 1, walkMinutesEstimate: 3,
                categories: ["Cafe"]
            ),
        ]
        let shaped = Q5CandidatesLoader.shapeCandidates(from: places)

        let dummyNames = Set(QuizDummyCandidates.all.map { $0.name })
        for candidate in shaped {
            XCTAssertFalse(dummyNames.contains(candidate.name),
                "expected real fetched venue names, not the placeholder fixture")
        }
    }

    // MARK: - shape correctness

    func testShapingTruncatesToCardCountThree() {
        let many = (0..<6).map { i in
            ShapedPlace(fsqPlaceId: "fsq-\(i)", name: "Place \(i)", lat: 0, lng: 0)
        }
        let shaped = Q5CandidatesLoader.shapeCandidates(from: many)
        XCTAssertEqual(shaped.count, Q5CandidatesLoader.cardCount)
        XCTAssertEqual(shaped.map { $0.id }, ["fsq-0", "fsq-1", "fsq-2"])
    }

    func testMetaFormatsCategoryPriceAndWalkMinutes() {
        let place = ShapedPlace(
            fsqPlaceId: "x", name: "X", lat: 0, lng: 0,
            priceTier: 3, walkMinutesEstimate: 14,
            categories: ["Thai"]
        )
        XCTAssertEqual(Q5CandidatesLoader.metaString(for: place), "Thai - $$$ - 14 min")
    }

    func testMetaSkipsMissingSegments() {
        let place = ShapedPlace(
            fsqPlaceId: "x", name: "X", lat: 0, lng: 0,
            priceTier: nil, walkMinutesEstimate: 7,
            categories: []
        )
        XCTAssertEqual(Q5CandidatesLoader.metaString(for: place), "7 min")
    }
}
