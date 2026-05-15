// GetToIt — LocationCoordinator pure-logic tests (TB-03 v1.1).
//
// These cover the C-23 LocationPicker state machine that does NOT
// require driving the real CoreLocation stack:
//   * `pickerState` mapping from `(place, lastFixAt, isResolvingGPS,
//     authorization)` to the five C-23 states.
//   * `cannotAdvance` — the S01 CTA gate.
//   * `commit(place:)` — drops the resolved place into the
//     observable so the chip + sheet downstream re-render.
//   * `displayName(from:fallbackCoordinate:)` — the formatter
//     that maps a CLPlacemark into the `(chip name, chip sub)`
//     pair, including all fallback cases.
//   * `recents` — bounded to 5 entries, MRU-ordered.
//
// The CLLocationManager + MKLocalSearchCompleter delegate paths
// (authorization-change, fix-arrived, completion-arrived) are
// integration concerns covered manually on TestFlight; the unit
// surface is the state-machine boundary.

import XCTest
import CoreLocation
@testable import GetToIt

@MainActor
final class LocationCoordinatorTests: XCTestCase {

    // MARK: - pickerState mapping

    /// Cold state — no place, no fix in flight. The five permission
    /// outcomes all map to `.empty`. The picker chip surfaces the
    /// `"Set your location"` placeholder; the S01 CTA is disabled
    /// until the user commits a manual pick or grants permission.
    func testPickerStateMapsToEmptyWhenNoPlaceAndNotResolving() {
        let coord = LocationCoordinator()
        // Authorization is read off the manager in `init`; on a fresh
        // test target it'll be `.notDetermined`. Don't assert the
        // exact value — assert the derived state.
        XCTAssertEqual(coord.pickerState, .empty)
        XCTAssertTrue(coord.cannotAdvance,
            "empty → S01 CTA must disable per C-23 spec")
    }

    /// A committed manual pick lights up the `manual` state. The S01
    /// CTA enables (cannot-advance flips off) and the chip surfaces
    /// the user-typed value with no paper-plane glyph.
    func testPickerStateMapsToManualOnceUserCommitsPlace() {
        let coord = LocationCoordinator()
        coord.commit(place: ResolvedPlace(
            id: "mock-1",
            name: "Mission · San Francisco",
            sub: "San Francisco, CA",
            coordinate: CLLocationCoordinate2D(latitude: 37.76, longitude: -122.41),
            source: .manual
        ))
        XCTAssertEqual(coord.pickerState, .manual)
        XCTAssertFalse(coord.cannotAdvance,
            "manual → CTA must enable; the session can fire")
        XCTAssertEqual(coord.place?.source, .manual)
    }

    /// commit-then-reset cycles the coordinator back to `.empty` —
    /// used by the unit tests and by the `useCurrentLocation()` re-
    /// fetch path which calls into `manager.requestLocation()` after
    /// clearing the prior fix.
    func testResetClearsCommittedPlace() {
        let coord = LocationCoordinator()
        coord.commit(place: ResolvedPlace(
            id: "mock-2",
            name: "Soho",
            sub: "New York, NY",
            coordinate: CLLocationCoordinate2D(latitude: 40.72, longitude: -74.00),
            source: .manual
        ))
        XCTAssertNotNil(coord.place)
        coord.reset()
        XCTAssertNil(coord.place)
        XCTAssertEqual(coord.pickerState, .empty)
    }

    // MARK: - recents

    /// MRU semantics — committing a place de-dupes by id then inserts
    /// at the head. Used by the LocationPickerSheet to render the
    /// `"RECENT"` section when no query is active.
    func testRecentsAreMRUOrderedAndDedupedById() {
        let coord = LocationCoordinator()
        let a = ResolvedPlace(id: "A", name: "A", sub: "sub", coordinate: .init(latitude: 0, longitude: 0), source: .manual)
        let b = ResolvedPlace(id: "B", name: "B", sub: "sub", coordinate: .init(latitude: 1, longitude: 1), source: .manual)
        let aAgain = ResolvedPlace(id: "A", name: "A renamed", sub: "sub2", coordinate: .init(latitude: 2, longitude: 2), source: .manual)

        coord.commit(place: a)
        coord.commit(place: b)
        coord.commit(place: aAgain)

        XCTAssertEqual(coord.recents.count, 2)
        XCTAssertEqual(coord.recents.first?.id, "A")
        XCTAssertEqual(coord.recents.first?.name, "A renamed",
            "the new commit replaces the old entry rather than appending a duplicate")
    }

    /// The recents list caps at 5 — anything older falls off. v1.1
    /// keeps the cap in-memory only; a follow-up may persist to
    /// `UserDefaults`.
    func testRecentsCapAtFive() {
        let coord = LocationCoordinator()
        for i in 0..<7 {
            coord.commit(place: ResolvedPlace(
                id: "id-\(i)",
                name: "n-\(i)",
                sub: "s",
                coordinate: .init(latitude: Double(i), longitude: Double(i)),
                source: .manual
            ))
        }
        XCTAssertEqual(coord.recents.count, 5)
        XCTAssertEqual(coord.recents.first?.id, "id-6",
            "newest commit sits at the head")
        XCTAssertEqual(coord.recents.last?.id, "id-2",
            "the two oldest entries (id-0, id-1) fell off the tail")
    }

    // MARK: - displayName formatting

    /// The placemark formatter is static + pure so the test target
    /// can exercise it without constructing a CLLocationManager.
    /// CLPlacemark has no public initializer in a unit-test target,
    /// so we exercise only the nil-placemark fallback — the typical
    /// shape when reverse-geocoding is throttled by the OS or when
    /// the simulator's location is the Apple HQ default.
    func testDisplayNameNilPlacemarkFallsBackToCoordinatesAndNearYou() {
        let (name, sub) = LocationCoordinator.displayName(
            from: nil,
            fallbackCoordinate: CLLocationCoordinate2D(latitude: 37.123, longitude: -122.456)
        )
        XCTAssertEqual(name, "Near you")
        XCTAssertEqual(sub, "37.123, -122.456",
            "fallback sub-label uses 3-decimal lat/lng")
    }

    // MARK: - stale threshold

    /// The C-23 spec calls out a 30-min stale window. We expose the
    /// constant so both the coordinator and any future surface that
    /// re-uses the picker agree.
    func testStaleAfterIs30Minutes() {
        XCTAssertEqual(LocationCoordinator.staleAfter, 30 * 60,
            "C-23 spec § Visual spec/States — stale at > 30 min")
    }
}
