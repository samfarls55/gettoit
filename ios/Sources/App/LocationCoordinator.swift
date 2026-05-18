// GetToIt — LocationCoordinator (TB-03 v1.1).
//
// Bridges the C-23 LocationPicker design-system primitive to the iOS
// native location stack. Owns:
//   * `CLLocationManager` — permission state + current GPS fix.
//   * `MKLocalSearchCompleter` — typeahead suggestions for the
//     LocationPickerSheet input.
//   * `CLGeocoder` — reverse-geocode the GPS coordinate into a
//     display name for the chip (`"Mission · San Francisco"` shape).
//
// State model mirrors the design-system spec (`components.md` C-23):
//   loading — initial GPS fix in flight (`auto` state inbound)
//   auto    — permission granted + GPS-resolved coordinate
//   manual  — user typed and committed (either path)
//   stale   — granted but last fix > 30 minutes ago
//   empty   — permission denied AND no manual pick yet
//
// The coordinator does not own UI. SwiftUI views observe the
// `@Observable` state and call the public mutation methods. The
// surface-state mapping (which chip variant renders) is computed
// inside the view from `(permission, place, lastFixAt)`.
//
// Permission outcomes:
//   * `.authorizedWhenInUse` / `.authorizedAlways` — request a fix,
//     drop into `loading` then `auto`. The CTA on S01 enables.
//   * `.denied` / `.restricted` — drop into `empty`. The S01 CTA
//     disables until the user commits a manual pick.
//   * `.notDetermined` — initial cold state. The S00b pre-prime is
//     responsible for firing `requestPermission()`; until then we
//     stay `empty`.
//
// Settings deep-link: the sheet's deny-state card calls
// `LocationCoordinator.openSettings()`, which routes
// `UIApplication.openSettingsURLString`. When the user returns from
// Settings with location toggled on, the manager's
// `locationManagerDidChangeAuthorization` delegate fires; the
// coordinator re-evaluates and transitions to `auto` if a fix
// resolves.

import Foundation
import CoreLocation
import MapKit
import SwiftUI
import UIKit

/// Picker state — mirrors the C-23 surface states. Computed from the
/// `(permission, place, lastFixAt)` tuple inside the coordinator.
public enum LocationPickerState: Equatable, Sendable {
    case loading
    case auto
    case manual
    case stale(minutes: Int)
    case empty
}

/// Resolved place returned by the coordinator. Carries enough shape
/// to render the chip readout (`name`, `sub`) and to write
/// `rooms.location_*` on room create (`coordinate`, `source`).
public struct ResolvedPlace: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let sub: String
    public let coordinate: CLLocationCoordinate2D
    public let source: Source
    /// Timezone of the *search area* — resolved from the placemark when
    /// the coordinate is committed. The Foursquare fetch planner reads
    /// this (NOT the device timezone) because a manually-picked area can
    /// sit in a different zone than the user's phone, and Foursquare's
    /// `open_at` filter is venue-local. Falls back to the device
    /// timezone only when no placemark timezone is available.
    public let timeZone: TimeZone

    public enum Source: String, Sendable {
        case gps
        case manual
    }

    public init(
        id: String,
        name: String,
        sub: String,
        coordinate: CLLocationCoordinate2D,
        source: Source,
        timeZone: TimeZone = .current
    ) {
        self.id = id
        self.name = name
        self.sub = sub
        self.coordinate = coordinate
        self.source = source
        self.timeZone = timeZone
    }

    public static func == (lhs: ResolvedPlace, rhs: ResolvedPlace) -> Bool {
        lhs.id == rhs.id &&
        lhs.name == rhs.name &&
        lhs.sub == rhs.sub &&
        lhs.coordinate.latitude == rhs.coordinate.latitude &&
        lhs.coordinate.longitude == rhs.coordinate.longitude &&
        lhs.source == rhs.source &&
        lhs.timeZone == rhs.timeZone
    }
}

/// Typeahead suggestion row. Sourced from `MKLocalSearchCompleter`;
/// resolution to a coordinate is deferred until the user taps a row,
/// at which point the coordinator runs `MKLocalSearch.start` and
/// produces a `ResolvedPlace`.
public struct PlaceSuggestion: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String   // e.g. "Mission District"
    public let sub: String    // e.g. "San Francisco, CA"

    public init(id: String, name: String, sub: String) {
        self.id = id
        self.name = name
        self.sub = sub
    }
}

@MainActor
@Observable
public final class LocationCoordinator: NSObject {
    // MARK: - public state

    /// Live authorization snapshot. Updated on every delegate callback.
    public private(set) var authorization: CLAuthorizationStatus
    /// Resolved place once the user has either accepted the GPS fix or
    /// committed a manual pick. Reads NIL until then.
    public private(set) var place: ResolvedPlace?
    /// Timestamp of the most recent GPS fix. Used to derive the
    /// `stale` state when > 30 min old.
    public private(set) var lastGPSFixAt: Date?
    /// Whether a GPS request is currently in flight. Drives the chip's
    /// `loading` render.
    public private(set) var isResolvingGPS: Bool = false
    /// Typeahead query the user is typing. Two-way bound to the sheet's
    /// input. Setting this fires off a `MKLocalSearchCompleter`
    /// query-string update.
    public var query: String = "" {
        didSet {
            // Only forward non-empty query updates; the completer
            // doesn't like a constant stream of empty strings.
            let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                suggestions = []
            } else {
                completer.queryFragment = trimmed
            }
        }
    }
    /// Current typeahead suggestions. Updated as
    /// `MKLocalSearchCompleter` returns results.
    public private(set) var suggestions: [PlaceSuggestion] = []
    /// Up-to-5 most recent committed picks. In-memory only for v1.1 —
    /// persistence to UserDefaults is a follow-up if it earns its place
    /// in the next dogfood pass.
    public private(set) var recents: [ResolvedPlace] = []

    // MARK: - dependencies

    private let manager: CLLocationManager
    private let completer: MKLocalSearchCompleter
    private let geocoder: CLGeocoder
    private let now: () -> Date

    /// Optional override the host can supply during unit tests so the
    /// coordinator never touches the real CoreLocation stack.
    public init(
        manager: CLLocationManager = CLLocationManager(),
        completer: MKLocalSearchCompleter = MKLocalSearchCompleter(),
        geocoder: CLGeocoder = CLGeocoder(),
        now: @escaping () -> Date = Date.init
    ) {
        self.manager = manager
        self.completer = completer
        self.geocoder = geocoder
        self.now = now
        self.authorization = manager.authorizationStatus
        super.init()
        self.manager.delegate = self
        self.manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        self.completer.delegate = self
        self.completer.resultTypes = [.address, .pointOfInterest]
    }

    // MARK: - derived state

    /// Threshold beyond which a GPS fix is considered stale. Matches
    /// the C-23 spec's "last fix > 30 min" rule.
    public static let staleAfter: TimeInterval = 30 * 60

    /// Compute the picker state from `(authorization, place, lastFixAt,
    /// isResolvingGPS)`. The host view consumes this to pick a chip
    /// variant.
    public var pickerState: LocationPickerState {
        if isResolvingGPS && place == nil {
            return .loading
        }
        guard let place else {
            // No place yet.
            switch authorization {
            case .authorizedAlways, .authorizedWhenInUse:
                // Granted but not yet resolved → loading (covered above)
                // or empty if we never started a fix. Treat as empty so
                // the user can manually pick.
                return .empty
            case .denied, .restricted, .notDetermined:
                return .empty
            @unknown default:
                return .empty
            }
        }
        // Have a place — pick auto vs manual based on source. Stale
        // overlay only applies to GPS-sourced values.
        switch place.source {
        case .manual:
            return .manual
        case .gps:
            if let lastFixAt = lastGPSFixAt {
                let age = now().timeIntervalSince(lastFixAt)
                if age > Self.staleAfter {
                    return .stale(minutes: Int(age / 60))
                }
            }
            return .auto
        }
    }

    /// Stale-minutes derived from `lastGPSFixAt`. Convenience for the
    /// `Use current location · Last fix {N} min ago` row in the sheet.
    public var staleMinutes: Int? {
        guard let lastGPSFixAt else { return nil }
        let age = now().timeIntervalSince(lastGPSFixAt)
        return Int(age / 60)
    }

    /// Whether the picker is in a state that should block the S01
    /// CTA (no committed place yet). Mirrors the JSX's
    /// `cannotAdvance = locationState === 'empty'` guard.
    public var cannotAdvance: Bool {
        if case .empty = pickerState { return true }
        return false
    }

    // MARK: - permission

    /// Fired by the S00b pre-prime CTA. Iff the system is in
    /// `notDetermined`, this surfaces the iOS dialog. Otherwise
    /// it's a no-op — the user already answered and we just re-read
    /// the current value.
    public func requestPermission() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
            // CLLocationManager will fire
            // `locationManagerDidChangeAuthorization` once the user
            // resolves the dialog; the delegate kicks off a fix.
        case .authorizedWhenInUse, .authorizedAlways:
            startResolveCurrentLocation()
        case .denied, .restricted:
            // Nothing to do — caller surfaces the manual path.
            break
        @unknown default:
            break
        }
    }

    /// Fired by the sheet's "Use current location" row. Re-requests
    /// the current fix; only meaningful in `auto` / `stale` states.
    public func useCurrentLocation() {
        guard manager.authorizationStatus == .authorizedWhenInUse ||
              manager.authorizationStatus == .authorizedAlways else { return }
        startResolveCurrentLocation()
    }

    /// Open the iOS Settings app on the GetToIt row so the user can
    /// re-grant location permission. Surfaced from the deny-state card
    /// in the LocationPickerSheet.
    public static func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    // MARK: - manual selection

    /// Commit a suggestion the user tapped in the sheet. Resolves the
    /// suggestion's coordinate via `MKLocalSearch.start` and stores
    /// the result as the active `place` with source `.manual`.
    public func select(suggestion: PlaceSuggestion, completion: ((Bool) -> Void)? = nil) {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "\(suggestion.name) \(suggestion.sub)"
        let search = MKLocalSearch(request: request)
        search.start { [weak self] response, _ in
            guard let self else { completion?(false); return }
            DispatchQueue.main.async {
                guard
                    let item = response?.mapItems.first,
                    item.placemark.coordinate.latitude.isFinite,
                    item.placemark.coordinate.longitude.isFinite
                else {
                    completion?(false)
                    return
                }
                let coordinate = item.placemark.coordinate
                let commitResolved: (TimeZone) -> Void = { timeZone in
                    self.commit(place: ResolvedPlace(
                        id: suggestion.id,
                        name: suggestion.name,
                        sub: suggestion.sub,
                        coordinate: coordinate,
                        source: .manual,
                        timeZone: timeZone
                    ))
                    completion?(true)
                }
                // The map result usually carries the area timezone
                // directly. When it doesn't, fall back to a reverse-
                // geocode of the coordinate (the same step the GPS path
                // runs) — the planner needs the picked area's timezone,
                // not the device's, since a manual pick can be in
                // another zone.
                if let timeZone = item.timeZone ?? item.placemark.timeZone {
                    commitResolved(timeZone)
                } else {
                    self.resolveTimeZone(for: coordinate, completion: commitResolved)
                }
            }
        }
    }

    /// Reverse-geocode a coordinate solely to recover its timezone.
    /// Used by the manual-pick path when the map search result carried
    /// no timezone. Always completes — falls back to the device
    /// timezone if the geocode yields none.
    private func resolveTimeZone(
        for coordinate: CLLocationCoordinate2D,
        completion: @escaping (TimeZone) -> Void
    ) {
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        geocoder.reverseGeocodeLocation(location) { placemarks, _ in
            DispatchQueue.main.async {
                completion(placemarks?.first?.timeZone ?? .current)
            }
        }
    }

    /// Test/diagnostic hook to commit a place directly without going
    /// through MKLocalSearch. Used by the unit tests that don't want
    /// to hit MapKit.
    public func commit(place: ResolvedPlace) {
        self.place = place
        self.isResolvingGPS = false
        self.recordRecent(place)
        // Clear typeahead state so the sheet returns to a calm rest.
        self.query = ""
        self.suggestions = []
    }

    /// Reset committed place (for tests / debug). Not surfaced in UI.
    public func reset() {
        self.place = nil
        self.lastGPSFixAt = nil
        self.isResolvingGPS = false
    }

    // MARK: - private helpers

    private func startResolveCurrentLocation() {
        isResolvingGPS = true
        manager.requestLocation()
    }

    private func recordRecent(_ place: ResolvedPlace) {
        recents.removeAll { $0.id == place.id }
        recents.insert(place, at: 0)
        if recents.count > 5 {
            recents = Array(recents.prefix(5))
        }
    }

    private func resolve(coordinate: CLLocationCoordinate2D) {
        let location = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        geocoder.reverseGeocodeLocation(location) { [weak self] placemarks, _ in
            guard let self else { return }
            DispatchQueue.main.async {
                let mark = placemarks?.first
                let (name, sub) = LocationCoordinator.displayName(from: mark, fallbackCoordinate: coordinate)
                let resolved = ResolvedPlace(
                    id: "gps:\(coordinate.latitude),\(coordinate.longitude)",
                    name: name,
                    sub: sub,
                    coordinate: coordinate,
                    source: .gps,
                    timeZone: mark?.timeZone ?? .current
                )
                // GPS path: never overwrite a manual pick the user
                // already committed in the same session — they may
                // have explicitly chosen something else. The
                // `useCurrentLocation()` path resets `place` first so
                // a deliberate re-fetch still lands.
                if self.place?.source != .manual {
                    self.place = resolved
                }
                self.lastGPSFixAt = self.now()
                self.isResolvingGPS = false
                self.recordRecent(resolved)
            }
        }
    }

    /// Format a CLPlacemark into a `(chip name, chip sub)` pair.
    /// Public + static so tests can exercise the formatting without
    /// constructing the full coordinator graph.
    public static func displayName(
        from mark: CLPlacemark?,
        fallbackCoordinate: CLLocationCoordinate2D
    ) -> (String, String) {
        if let mark {
            // Prefer `{neighborhood · city}` form to mirror the JSX
            // sample (`"Mission · San Francisco"`). Fall back through
            // less specific scopes until something resolves.
            let name: String
            if let neighborhood = mark.subLocality, let city = mark.locality {
                name = "\(neighborhood) · \(city)"
            } else if let city = mark.locality, let admin = mark.administrativeArea {
                name = "\(city), \(admin)"
            } else if let city = mark.locality {
                name = city
            } else if let admin = mark.administrativeArea {
                name = admin
            } else {
                name = "Near you"
            }
            let sub: String
            if let city = mark.locality, let admin = mark.administrativeArea {
                sub = "\(city), \(admin)"
            } else if let admin = mark.administrativeArea, let country = mark.country {
                sub = "\(admin), \(country)"
            } else if let country = mark.country {
                sub = country
            } else {
                sub = String(format: "%.3f, %.3f",
                             fallbackCoordinate.latitude,
                             fallbackCoordinate.longitude)
            }
            return (name, sub)
        }
        let coords = String(format: "%.3f, %.3f",
                            fallbackCoordinate.latitude,
                            fallbackCoordinate.longitude)
        return ("Near you", coords)
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationCoordinator: CLLocationManagerDelegate {
    nonisolated public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let snapshot = manager.authorizationStatus
        Task { @MainActor in
            self.authorization = snapshot
            switch snapshot {
            case .authorizedWhenInUse, .authorizedAlways:
                // The granted path: kick off a fix if we don't already
                // have one resolving.
                if !self.isResolvingGPS && self.place == nil {
                    self.startResolveCurrentLocation()
                }
            case .denied, .restricted, .notDetermined:
                self.isResolvingGPS = false
            @unknown default:
                break
            }
        }
    }

    nonisolated public func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let coord = locations.last?.coordinate else { return }
        Task { @MainActor in
            self.resolve(coordinate: coord)
        }
    }

    nonisolated public func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        Task { @MainActor in
            self.isResolvingGPS = false
        }
    }
}

// MARK: - MKLocalSearchCompleterDelegate

extension LocationCoordinator: MKLocalSearchCompleterDelegate {
    nonisolated public func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let results = completer.results
        Task { @MainActor in
            self.suggestions = results.prefix(8).map { result in
                PlaceSuggestion(
                    id: "completion:\(result.title)|\(result.subtitle)",
                    name: result.title,
                    sub: result.subtitle
                )
            }
        }
    }

    nonisolated public func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        Task { @MainActor in
            self.suggestions = []
        }
    }
}
