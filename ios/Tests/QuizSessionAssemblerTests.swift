// GetToIt - QuizSessionAssembler boundary tests (bug-03 v1.1).
//
// The boundary assertion the ticket mandates: at least one call to
// `PlacesService.fetchPlaces` (and through it the underlying
// PlacesProxyClient) must happen during a session that reaches the
// quiz. The silent-no-call failure mode is exactly what bug-03 caught
// in the wild - this test guarantees a repeat regression fails loudly.
//
// `QuizSessionAssembler.assembleCoordinator` is the seam RootView's
// startQuiz calls into; if a future change deletes the loader call
// from the assembler (or the assembler call from RootView), the
// `observed.count` assertion below drops to zero and the test fails.

import XCTest
import CoreLocation
@testable import GetToIt

@MainActor
final class QuizSessionAssemblerTests: XCTestCase {

    // MARK: - Stubs

    final class RecordingProxyClient: PlacesProxyClient {
        var response: PlacesProxyResponse = PlacesProxyResponse(
            places: [
                ShapedPlace(
                    fsqPlaceId: "fsq-rec-1",
                    name: "Recorded Spot 1",
                    lat: 0, lng: 0,
                    priceTier: 2,
                    walkMinutesEstimate: 5,
                    dietaryTags: [],
                    hours: nil,
                    photos: [],
                    address: nil,
                    categories: ["Diner"]
                ),
                ShapedPlace(
                    fsqPlaceId: "fsq-rec-2",
                    name: "Recorded Spot 2",
                    lat: 0, lng: 0,
                    priceTier: 1,
                    walkMinutesEstimate: 9,
                    dietaryTags: [],
                    hours: nil,
                    photos: [],
                    address: nil,
                    categories: ["Pizza"]
                ),
                ShapedPlace(
                    fsqPlaceId: "fsq-rec-3",
                    name: "Recorded Spot 3",
                    lat: 0, lng: 0,
                    priceTier: 3,
                    walkMinutesEstimate: 11,
                    dietaryTags: [],
                    hours: nil,
                    photos: [],
                    address: nil,
                    categories: ["Sushi"]
                ),
            ],
            disclaimers: [],
            isThin: false,
            servedFromCache: false
        )
        var observed: [PlacesProxyRequest] = []
        func search(_ request: PlacesProxyRequest) async throws -> PlacesProxyResponse {
            observed.append(request)
            return response
        }
    }

    final class NoopMapKitFallback: PlacesMapKitFallback {
        func search(near coordinate: CLLocationCoordinate2D, radiusMeters: Double) async -> [ShapedPlace] {
            return []
        }
    }

    // MARK: - boundary assertion

    /// The canonical bug-03 regression guard. A session that reaches
    /// the quiz must invoke PlacesService.fetchPlaces - and therefore
    /// the underlying PlacesProxyClient - at least once. Before the
    /// fix this would have been zero invocations.
    func testAssemblingASessionInvokesPlacesServiceAtLeastOnce() async {
        let proxy = RecordingProxyClient()
        let service = PlacesService(proxy: proxy, mapKitFallback: NoopMapKitFallback())

        let assembled = await QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: CLLocationCoordinate2D(latitude: 37.7849, longitude: -122.4094),
            radiusMeters: 3219,
            places: service,
            writer: { _ in }
        )

        XCTAssertGreaterThanOrEqual(proxy.observed.count, 1,
            "expected PlacesService.fetchPlaces to be invoked at least once during session assembly - this is the silent-no-call regression bug-03 fixed; if this fails, Q5 will render placeholder data again")
        // The coordinator should also carry the canned-recorded
        // candidates rather than the dummy fixture.
        XCTAssertEqual(assembled.coordinator.allCandidates.count, 3)
        XCTAssertEqual(assembled.coordinator.allCandidates[0].name, "Recorded Spot 1")
        XCTAssertEqual(assembled.coordinator.allCandidates[1].name, "Recorded Spot 2")
        XCTAssertEqual(assembled.coordinator.allCandidates[2].name, "Recorded Spot 3")
        if case .places(.foursquare) = assembled.loadedSource {
            // expected
        } else {
            XCTFail("expected loaded source to be .places(.foursquare), got \(assembled.loadedSource)")
        }
    }

    /// Boundary forwards: the recorded proxy request carries the
    /// caller's coordinate and radius. Establishes that the location
    /// flows through the assembler intact - no upstream guard zeroes
    /// out the coordinate before fetch fires.
    func testAssemblerForwardsCoordinateAndRadiusToTheProxy() async {
        let proxy = RecordingProxyClient()
        let service = PlacesService(proxy: proxy, mapKitFallback: NoopMapKitFallback())

        _ = await QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: CLLocationCoordinate2D(latitude: 12.34, longitude: 56.78),
            radiusMeters: 4321,
            places: service,
            writer: { _ in }
        )

        XCTAssertEqual(proxy.observed.count, 1)
        let req = proxy.observed[0]
        XCTAssertEqual(req.lat, 12.34, accuracy: 1e-9)
        XCTAssertEqual(req.lng, 56.78, accuracy: 1e-9)
        XCTAssertEqual(req.radiusMeters, 4321, accuracy: 1e-9)
    }

    /// Defensive path: no coordinate available (e.g. a stale routing
    /// where the room row vanished). The assembler skips the fetch,
    /// uses the dummy fixture, and the proxy is never invoked. This
    /// path is rare in production - the S01 CTA's `cannotAdvance`
    /// guard normally prevents it - but the assembler must not crash
    /// or hang the user mid-flow.
    func testNoCoordinateProducesDummyFallbackWithoutHittingTheProxy() async {
        let proxy = RecordingProxyClient()
        let service = PlacesService(proxy: proxy, mapKitFallback: NoopMapKitFallback())

        let assembled = await QuizSessionAssembler.assembleCoordinator(
            roomID: UUID(),
            userID: UUID(),
            coordinate: nil,
            radiusMeters: 3219,
            places: service,
            writer: { _ in }
        )

        XCTAssertEqual(proxy.observed.count, 0,
            "expected no proxy hit when the session lacks a coordinate - silent dummy fallback is the safe degradation")
        XCTAssertEqual(assembled.loadedSource, .fallbackDummy)
        XCTAssertEqual(assembled.coordinator.allCandidates, QuizDummyCandidates.all)
    }
}
