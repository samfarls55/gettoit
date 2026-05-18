// GetToIt — VenueClosureVerifier unit tests.
//
// Exercise the MapKit closure cross-check without invoking MapKit: a
// stub `MapKitPOISweep` returns canned POI sets so the classifier and
// the actor's cache can be tested offline on the iOS simulator.
//
// References:
//   * VenueClosureVerifier.swift
//   * gti-vault/60_engineering/foursquare-venue-closure-signal.md

import XCTest
import Foundation
@testable import GetToIt

final class VenueClosureVerifierTests: XCTestCase {

    // MARK: - Stub sweep

    /// An actor so concurrent sweeps from the verifier's task group
    /// record invocations without a data race.
    actor StubSweep: MapKitPOISweep {
        private let byKey: [String: [MapKitPOI]?]
        private let fallback: [MapKitPOI]?
        private(set) var invocations: [String] = []

        init(byKey: [String: [MapKitPOI]?] = [:], fallback: [MapKitPOI]? = []) {
            self.byKey = byKey
            self.fallback = fallback
        }

        func poisNear(
            latitude: Double, longitude: Double, radiusMeters: Double
        ) async -> [MapKitPOI]? {
            let k = StubSweep.key(latitude, longitude)
            invocations.append(k)
            // `byKey[k]` is `[MapKitPOI]??` — an explicit-`nil` entry
            // (sweep failed) is distinct from a missing entry.
            if let hit = byKey[k] { return hit }
            return fallback
        }

        nonisolated static func key(_ lat: Double, _ lng: Double) -> String {
            String(format: "%.4f,%.4f", lat, lng)
        }
    }

    // MARK: - normalizedName

    func testNormalizedNameStripsDiacriticsCasePunctuation() {
        XCTAssertEqual(
            MapKitClosureVerifier.normalizedName("Café Roma!"), "cafe roma")
        XCTAssertEqual(
            MapKitClosureVerifier.normalizedName("  THE   Pastime  "),
            "the pastime")
    }

    // MARK: - namesMatch

    func testNamesMatchExactAndContainment() {
        XCTAssertTrue(
            MapKitClosureVerifier.namesMatch("pastime", "pastime"))
        XCTAssertTrue(
            MapKitClosureVerifier.namesMatch(
                "pastime", "pastime sports bar"))
    }

    func testNamesMatchRejectsShortGenericTokens() {
        // "bar" is only 3 chars — must not bridge two unrelated venues.
        XCTAssertFalse(
            MapKitClosureVerifier.namesMatch("bar", "corner bar"))
        XCTAssertFalse(
            MapKitClosureVerifier.namesMatch("pastime", "longhorn"))
    }

    // MARK: - classify

    private func place(
        _ name: String, _ lat: Double, _ lng: Double, id: String = "p"
    ) -> ShapedPlace {
        ShapedPlace(fsqPlaceId: id, name: name, lat: lat, lng: lng)
    }

    func testClassifyKeepsWhenSweepFailed() {
        let keep = MapKitClosureVerifier.classify(
            place: place("Pastime", 36.17, -86.78),
            pois: nil,
            nameMatchRadiusMeters: 120,
            closedVerdictMinPOIs: 3
        )
        XCTAssertTrue(keep, "a nil sweep is unknown — keep the venue")
    }

    func testClassifyKeepsWhenCoverageBelowFloor() {
        // Only two POIs — not enough to prove MapKit covers the block.
        let pois = [
            MapKitPOI(name: "Some Shop", latitude: 36.17, longitude: -86.78),
            MapKitPOI(name: "Other Shop", latitude: 36.17, longitude: -86.78),
        ]
        let keep = MapKitClosureVerifier.classify(
            place: place("Pastime", 36.17, -86.78),
            pois: pois,
            nameMatchRadiusMeters: 120,
            closedVerdictMinPOIs: 3
        )
        XCTAssertTrue(keep)
    }

    func testClassifyKeepsWhenMapKitStillListsVenue() {
        let pois = [
            MapKitPOI(name: "Roberts Western World", latitude: 36.1610, longitude: -86.7775),
            MapKitPOI(name: "Live Pastime", latitude: 36.1612, longitude: -86.7775),
            MapKitPOI(name: "Ryman Auditorium", latitude: 36.1611, longitude: -86.7776),
        ]
        let keep = MapKitClosureVerifier.classify(
            place: place("Pastime", 36.1612, -86.7775),
            pois: pois,
            nameMatchRadiusMeters: 120,
            closedVerdictMinPOIs: 3
        )
        XCTAssertTrue(keep, "MapKit lists the venue nearby — it is open")
    }

    func testClassifyDropsWhenBlockCoveredButVenueAbsent() {
        let pois = [
            MapKitPOI(name: "Roberts Western World", latitude: 36.1610, longitude: -86.7775),
            MapKitPOI(name: "Nudies Honky Tonk", latitude: 36.1612, longitude: -86.7775),
            MapKitPOI(name: "Ryman Auditorium", latitude: 36.1611, longitude: -86.7776),
        ]
        let keep = MapKitClosureVerifier.classify(
            place: place("Pastime", 36.1612, -86.7775),
            pois: pois,
            nameMatchRadiusMeters: 120,
            closedVerdictMinPOIs: 3
        )
        XCTAssertFalse(keep, "block is covered, venue absent — likely closed")
    }

    func testClassifyDropsWhenNameMatchesButTooFarAway() {
        // A same-named venue exists, but ~1km off — a different place.
        let pois = [
            MapKitPOI(name: "Pastime", latitude: 36.1712, longitude: -86.7775),
            MapKitPOI(name: "Nudies Honky Tonk", latitude: 36.1612, longitude: -86.7775),
            MapKitPOI(name: "Ryman Auditorium", latitude: 36.1611, longitude: -86.7776),
        ]
        let keep = MapKitClosureVerifier.classify(
            place: place("Pastime", 36.1612, -86.7775),
            pois: pois,
            nameMatchRadiusMeters: 120,
            closedVerdictMinPOIs: 3
        )
        XCTAssertFalse(keep, "the proximity gate must reject a far namesake")
    }

    // MARK: - filterOutClosed (end to end, stubbed sweep)

    func testFilterOutClosedDropsOnlyTheClosedVenue() async {
        let closed = place("Pastime", 36.1612, -86.7775, id: "closed")
        let open = place("Live Cafe", 40.0000, -70.0000, id: "open")
        let unknown = place("No Coverage", 10.0000, 10.0000, id: "unknown")

        let sweep = StubSweep(byKey: [
            // Closed: block covered, venue absent.
            StubSweep.key(36.1612, -86.7775): [
                MapKitPOI(name: "Roberts Western World", latitude: 36.1612, longitude: -86.7775),
                MapKitPOI(name: "Nudies Honky Tonk", latitude: 36.1612, longitude: -86.7775),
                MapKitPOI(name: "Ryman Auditorium", latitude: 36.1612, longitude: -86.7775),
            ],
            // Open: MapKit still lists it.
            StubSweep.key(40.0, -70.0): [
                MapKitPOI(name: "Live Cafe", latitude: 40.0, longitude: -70.0),
                MapKitPOI(name: "Next Door", latitude: 40.0, longitude: -70.0),
                MapKitPOI(name: "Down The Street", latitude: 40.0, longitude: -70.0),
            ],
            // Unknown: sweep failed (explicit nil value, not a
            // missing key — the verifier must keep this venue).
            StubSweep.key(10.0, 10.0): nil,
        ])
        let verifier = MapKitClosureVerifier(sweep: sweep)

        let result = await verifier.filterOutClosed([closed, open, unknown])

        XCTAssertEqual(result.map(\.fsqPlaceId), ["open", "unknown"],
                       "only the confidently-closed venue is dropped")
    }

    func testFilterOutClosedCachesVerdictsPerVenue() async {
        let venue = place("Pastime", 36.1612, -86.7775, id: "v1")
        let sweep = StubSweep(byKey: [
            StubSweep.key(36.1612, -86.7775): [
                MapKitPOI(name: "A", latitude: 36.1612, longitude: -86.7775),
                MapKitPOI(name: "B", latitude: 36.1612, longitude: -86.7775),
                MapKitPOI(name: "C", latitude: 36.1612, longitude: -86.7775),
            ],
        ])
        let verifier = MapKitClosureVerifier(sweep: sweep)

        _ = await verifier.filterOutClosed([venue])
        _ = await verifier.filterOutClosed([venue])

        let invocations = await sweep.invocations
        XCTAssertEqual(invocations.count, 1,
                       "a venue verified once must not be re-swept")
    }
}
