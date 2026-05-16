// GetToIt — FoursquareFetchExecutor (TB-07 v1.1, PRD module F).
//
// Wraps the pure `FoursquareFetchPlanner`. Given one member's
// per-member fetch inputs it asks the planner for the N+1 call specs,
// runs them in parallel through `PlacesService`, then unions and
// dedupes the venue results by `fsq_place_id`.
//
// This is the real, at-scale closure of bug-03's silent no-call
// failure mode: before, Foursquare was called once, early, with an
// empty `PlacesFilters()` before any quiz answer existed. Now the
// fetch fires when Q1-Q4 are complete, with the member's answers
// applied, as N+1 parallel calls. The boundary regression guard lives
// in `FoursquareFetchExecutorTests.swift` — a recording proxy asserts
// the N+1 calls actually reach the wire.
//
// Each spec is run through `PlacesService.fetchPlaces`, so every call
// inherits the ADR-0002 thin-response → MapKit-fallback behaviour
// independently. A call that comes back thin contributes whatever the
// MapKit fallback found; the union still benefits.

import Foundation
import CoreLocation

public final class FoursquareFetchExecutor: Sendable {

    /// The result of an executed per-member fetch — the unioned,
    /// deduped venue pool plus the disclaimers gathered across calls.
    public struct Result: Equatable, Sendable {
        /// Venues unioned across the N+1 calls, deduped by
        /// `fsqPlaceId`. First-seen wins on a duplicate.
        public let places: [ShapedPlace]
        /// Disclaimers surfaced by any of the calls, deduped, stable
        /// order. Carried forward so the verdict rule chip can show
        /// them (e.g. a dietary chip that could only disclaim).
        public let disclaimers: [String]

        public init(places: [ShapedPlace], disclaimers: [String]) {
            self.places = places
            self.disclaimers = disclaimers
        }
    }

    private let places: PlacesService

    public init(places: PlacesService) {
        self.places = places
    }

    /// Execute a member's per-member fetch.
    ///
    /// Plans the N+1 specs, runs them in parallel, unions + dedupes.
    /// Parameters mirror `FoursquareFetchPlanner.plan` — see that type
    /// for the per-argument contract.
    public func fetch(
        cuisines: [String],
        budgetTier: Int,
        parameters: SessionParameters,
        coordinate: CLLocationCoordinate2D,
        radiusMeters: Double,
        now: Date = Date()
    ) async throws -> Result {
        let specs = FoursquareFetchPlanner.plan(
            cuisines: cuisines,
            budgetTier: budgetTier,
            parameters: parameters,
            coordinate: coordinate,
            radiusMeters: radiusMeters,
            now: now
        )
        return try await execute(specs)
    }

    /// Run a pre-planned set of specs in parallel and union the
    /// results. Exposed for callers that already hold planner output.
    public func execute(_ specs: [PlacesProxyRequest]) async throws -> Result {
        // Fire every spec concurrently. `enumerated` keeps a stable
        // index so the union below is deterministic regardless of the
        // order tasks complete in.
        let perCall: [(index: Int, result: PlacesFetchResult)] =
            try await withThrowingTaskGroup(of: (Int, PlacesFetchResult).self) { group in
                for (index, spec) in specs.enumerated() {
                    group.addTask { [places] in
                        let coordinate = CLLocationCoordinate2D(
                            latitude: spec.lat,
                            longitude: spec.lng
                        )
                        let result = try await places.fetchPlaces(
                            near: coordinate,
                            radiusMeters: spec.radiusMeters,
                            filters: spec.filters ?? PlacesFilters()
                        )
                        return (index, result)
                    }
                }
                var collected: [(Int, PlacesFetchResult)] = []
                for try await pair in group {
                    collected.append(pair)
                }
                return collected
            }

        // Deterministic union: walk the calls in spec order, keeping
        // the first occurrence of each venue id.
        let ordered = perCall.sorted { $0.index < $1.index }
        var seenVenues = Set<String>()
        var unionedPlaces: [ShapedPlace] = []
        var seenDisclaimers = Set<String>()
        var disclaimers: [String] = []
        for (_, result) in ordered {
            for place in result.places where seenVenues.insert(place.fsqPlaceId).inserted {
                unionedPlaces.append(place)
            }
            for disclaimer in result.disclaimers where seenDisclaimers.insert(disclaimer).inserted {
                disclaimers.append(disclaimer)
            }
        }
        return Result(places: unionedPlaces, disclaimers: disclaimers)
    }
}
