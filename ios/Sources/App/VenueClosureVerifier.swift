// GetToIt — VenueClosureVerifier.
//
// Foursquare's post-2025 Places API surface carries no reliable
// out-of-business signal: the probabilistic `closed_bucket` field is
// gone and `date_closed` is effectively never populated (investigated
// 2026-05-18 — see gti-vault/60_engineering/foursquare-venue-closure-signal.md).
// So a venue that shut down years ago can still surface as a live
// candidate — the bug that recommended "Pastime", a long-closed
// Nashville sports bar.
//
// This module cross-checks each Foursquare candidate against Apple
// MapKit. Apple aggressively prunes dead businesses out of Maps, so a
// venue MapKit no longer knows about — in a block MapKit demonstrably
// DOES cover — is very likely closed.
//
// IMPORTANT — this is a heuristic, not an oracle. The MapKit SDK
// exposes no programmatic "permanently closed" flag (Apple Maps the
// app shows it; the SDK does not hand you that bit). The signal here
// is *absence*: a Foursquare venue missing from a MapKit
// point-of-interest sweep of its own immediate block. The classifier
// is deliberately conservative — it drops a venue only when MapKit
// returned a healthy set of other POIs for that block but not this
// one. A failed sweep, or a block with too few POIs to prove
// coverage, classifies as "unknown" — and unknown always keeps the
// venue. A false drop shrinks the Q5 candidate pool, which is worse
// than leaving one stale venue in for the VerdictEngine to rank low.
//
// References:
//   * gti-vault/60_engineering/foursquare-venue-closure-signal.md
//   * ADR 0002 — Foursquare primary / MapKit fallback (this reuses the
//     same on-device, free MapKit surface for a second purpose).

import Foundation
import CoreLocation
import MapKit

// MARK: - Protocols

/// Cross-checks Foursquare-sourced candidate venues and removes the
/// ones that are very likely out of business.
public protocol VenueClosureVerifier: Sendable {
    /// Return `places` with likely-closed venues removed, original
    /// order preserved. Implementations MUST keep any venue they
    /// cannot confidently classify — never drop on uncertainty.
    func filterOutClosed(_ places: [ShapedPlace]) async -> [ShapedPlace]
}

/// One Apple-MapKit point-of-interest sweep of a small region.
/// Injected so unit tests can classify against canned POI sets without
/// invoking MapKit — `MKLocalSearch` can hang the simulator on a CI
/// runner, the same reason `PlacesMapKitFallback` is abstracted.
public protocol MapKitPOISweep: Sendable {
    /// Every POI MapKit knows within `radiusMeters` of the coordinate.
    /// Returns `nil` when the sweep itself failed (MapKit/network
    /// error) — deliberately distinct from an empty array, which means
    /// the sweep succeeded and MapKit simply knows nothing there.
    func poisNear(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double
    ) async -> [MapKitPOI]?
}

/// A minimal POI record — only the fields the closure cross-check
/// needs. Decoupled from `MKMapItem` so the classifier is pure and
/// testable.
public struct MapKitPOI: Equatable, Sendable {
    public let name: String
    public let latitude: Double
    public let longitude: Double

    public init(name: String, latitude: Double, longitude: Double) {
        self.name = name
        self.latitude = latitude
        self.longitude = longitude
    }
}

// MARK: - Passthrough (default / no-op)

/// A verifier that drops nothing. The default `PlacesService`
/// dependency: a build that does not wire a real verifier keeps the
/// pre-cross-check behaviour exactly. Also the natural test double for
/// suites that are not exercising closure.
public struct PassthroughClosureVerifier: VenueClosureVerifier {
    public init() {}
    public func filterOutClosed(_ places: [ShapedPlace]) async -> [ShapedPlace] {
        places
    }
}

// MARK: - MapKit-backed verifier

public actor MapKitClosureVerifier: VenueClosureVerifier {

    private let sweep: MapKitPOISweep
    /// Radius of the per-venue MapKit POI sweep. Small enough that
    /// MapKit returns the whole block without truncating, large enough
    /// to absorb the tens-of-metres coordinate drift between
    /// Foursquare's and Apple's record for the same venue.
    private let sweepRadiusMeters: Double
    /// A MapKit POI counts as the same venue as a Foursquare candidate
    /// only when their coordinates are within this distance (and their
    /// normalised names match).
    private let nameMatchRadiusMeters: Double
    /// A "closed" verdict requires the sweep to have returned at least
    /// this many POIs — proof that MapKit actually covers the block.
    /// Below it, coverage is unproven and the venue is kept.
    private let closedVerdictMinPOIs: Int

    /// Per-instance memo of `fsqPlaceId -> isOpen`. The verifier is
    /// built once in the composition root and shared across the N+1
    /// per-member fetch fan-out, so a venue appearing in several union
    /// calls is swept against MapKit exactly once.
    private var verdictCache: [String: Bool] = [:]

    public init(
        sweep: MapKitPOISweep = LiveMapKitPOISweep(),
        sweepRadiusMeters: Double = 150,
        nameMatchRadiusMeters: Double = 120,
        closedVerdictMinPOIs: Int = 3
    ) {
        self.sweep = sweep
        self.sweepRadiusMeters = sweepRadiusMeters
        self.nameMatchRadiusMeters = nameMatchRadiusMeters
        self.closedVerdictMinPOIs = closedVerdictMinPOIs
    }

    public func filterOutClosed(_ places: [ShapedPlace]) async -> [ShapedPlace] {
        let unresolved = places.filter { verdictCache[$0.fsqPlaceId] == nil }
        if !unresolved.isEmpty {
            // Snapshot the immutable config so the child tasks capture
            // values, not the actor.
            let sweep = self.sweep
            let sweepRadius = sweepRadiusMeters
            let matchRadius = nameMatchRadiusMeters
            let minPOIs = closedVerdictMinPOIs

            let resolved = await withTaskGroup(
                of: (String, Bool).self,
                returning: [(String, Bool)].self
            ) { group in
                for place in unresolved {
                    group.addTask {
                        let pois = await sweep.poisNear(
                            latitude: place.lat,
                            longitude: place.lng,
                            radiusMeters: sweepRadius
                        )
                        let isOpen = MapKitClosureVerifier.classify(
                            place: place,
                            pois: pois,
                            nameMatchRadiusMeters: matchRadius,
                            closedVerdictMinPOIs: minPOIs
                        )
                        return (place.fsqPlaceId, isOpen)
                    }
                }
                var collected: [(String, Bool)] = []
                for await pair in group { collected.append(pair) }
                return collected
            }
            for (id, isOpen) in resolved { verdictCache[id] = isOpen }
        }
        // Keep a venue when its verdict is open OR still unknown.
        return places.filter { verdictCache[$0.fsqPlaceId] ?? true }
    }

    // MARK: - Pure classification (internal — exercised directly by tests)

    /// Decide whether one venue is likely still open. Returns `true`
    /// to KEEP the venue (open, or not confidently classifiable),
    /// `false` to drop it (very likely closed).
    static func classify(
        place: ShapedPlace,
        pois: [MapKitPOI]?,
        nameMatchRadiusMeters: Double,
        closedVerdictMinPOIs: Int
    ) -> Bool {
        // Sweep failed — unknown — keep.
        guard let pois else { return true }
        // Too few POIs to prove MapKit covers this block — keep.
        guard pois.count >= closedVerdictMinPOIs else { return true }

        let target = normalizedName(place.name)
        // No usable name to match on — keep.
        guard !target.isEmpty else { return true }

        for poi in pois {
            let gap = metersBetween(
                place.lat, place.lng, poi.latitude, poi.longitude
            )
            guard gap <= nameMatchRadiusMeters else { continue }
            if namesMatch(target, normalizedName(poi.name)) {
                return true // MapKit still lists it — open.
            }
        }
        // MapKit covers the block but does not list this venue — closed.
        return false
    }

    /// Lower-case, strip diacritics and punctuation, collapse runs of
    /// whitespace. "Café Roma!" and "cafe   roma" both normalise to
    /// "cafe roma".
    static func normalizedName(_ raw: String) -> String {
        let folded = raw
            .folding(
                options: [.diacriticInsensitive, .caseInsensitive],
                locale: nil
            )
            .lowercased()
        // Split on every run of non-alphanumeric characters; empty
        // pieces are dropped, so punctuation and repeated spaces both
        // collapse away.
        let tokens = folded.split { !($0.isLetter || $0.isNumber) }
        return tokens.joined(separator: " ")
    }

    /// Two normalised names match when they are equal, or one fully
    /// contains the other ("Pastime" vs "Pastime Sports Bar"). The
    /// containment branch requires the shorter name to be at least 5
    /// characters so generic words ("bar", "cafe", "grill") cannot
    /// bridge two unrelated venues.
    static func namesMatch(_ a: String, _ b: String) -> Bool {
        if a.isEmpty || b.isEmpty { return false }
        if a == b { return true }
        let shorter = a.count <= b.count ? a : b
        let longer = a.count <= b.count ? b : a
        guard shorter.count >= 5 else { return false }
        return longer.contains(shorter)
    }

    private static func metersBetween(
        _ aLat: Double, _ aLng: Double,
        _ bLat: Double, _ bLng: Double
    ) -> Double {
        CLLocation(latitude: aLat, longitude: aLng)
            .distance(from: CLLocation(latitude: bLat, longitude: bLng))
    }
}

// MARK: - Live MapKit sweep

/// `MapKitPOISweep` backed by a real `MKLocalPointsOfInterestRequest`.
/// Runs entirely on-device and is free with an Apple Developer account
/// — the same MapKit surface ADR 0002 already uses for the thin-result
/// fallback.
public struct LiveMapKitPOISweep: MapKitPOISweep {

    public init() {}

    public func poisNear(
        latitude: Double,
        longitude: Double,
        radiusMeters: Double
    ) async -> [MapKitPOI]? {
        let center = CLLocationCoordinate2D(
            latitude: latitude, longitude: longitude
        )
        guard CLLocationCoordinate2DIsValid(center) else { return nil }

        // A points-of-interest request (region + POI filter, no text
        // query) rather than a natural-language search: a closed venue
        // must be detected by ABSENCE from the block, and a name query
        // for a dead venue just returns nothing — indistinguishable
        // from "no coverage". `includingAll` (the default filter) is
        // used deliberately — a venue must be found regardless of how
        // Apple would categorise it (Pastime is a "Sports Bar" —
        // nightlife, not `.restaurant`).
        let request = MKLocalPointsOfInterestRequest(
            center: center, radius: radiusMeters
        )
        let search = MKLocalSearch(request: request)
        do {
            let response = try await search.start()
            return response.mapItems.compactMap { item -> MapKitPOI? in
                guard let name = item.name else { return nil }
                let coordinate = item.placemark.coordinate
                guard coordinate.latitude.isFinite,
                      coordinate.longitude.isFinite else { return nil }
                return MapKitPOI(
                    name: name,
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude
                )
            }
        } catch {
            // MapKit/network error — unknown, not "empty". The
            // classifier keeps every venue on a `nil` sweep.
            return nil
        }
    }
}
