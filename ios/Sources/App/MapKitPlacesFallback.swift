// GetToIt — MapKit POI fallback.
//
// Apple MapKit's `MKLocalSearch` runs entirely on-device and is free
// with an Apple Developer account. When the Foursquare proxy returns
// a thin response or errors, this fallback fills the candidate set
// with MapKit POIs shaped into the same `ShapedPlace` rows the
// VerdictEngine consumes.
//
// References:
//   * ADR 0002 §"Decision" — MapKit fallback rationale.
//   * TB-05 — iOS MapKit fallback path acceptance criterion.
//
// Field-mapping notes:
//   * `fsq_place_id` is a synthetic `mapkit:` prefix so the engine
//     can distinguish MapKit-sourced candidates from Foursquare ones.
//   * Price tier, dietary tags, photos: MapKit doesn't expose these.
//     Surfaced as `nil` / empty arrays — the VerdictEngine treats
//     missing tier as "unknown ≤ cap" and missing tags as "absent".

import Foundation
import CoreLocation
import MapKit

public final class MapKitPlacesFallback: PlacesMapKitFallback {

    public init() {}

    public func search(
        near coordinate: CLLocationCoordinate2D,
        radiusMeters: Double
    ) async -> [ShapedPlace] {
        let request = MKLocalSearch.Request()
        request.naturalLanguageQuery = "restaurant"
        // Convert the radius into a region centred on the user.
        let region = MKCoordinateRegion(
            center: coordinate,
            latitudinalMeters: max(100, radiusMeters * 2),
            longitudinalMeters: max(100, radiusMeters * 2)
        )
        request.region = region
        request.resultTypes = [.pointOfInterest]
        // Candidate-pool floor (tb-25 / ADR 0012) — degraded-mode
        // approximation. `.cafe` and `.foodMarket` sit outside the floor
        // (cafes and grocery / food markets are not meal venues), so the
        // filter is tightened to `.restaurant` only. The floor's
        // `Sports Bar` carve-out is inexpressible in MapKit's POI
        // taxonomy and is dropped in fallback mode; this is documented
        // degraded-mode behavior, not a defect. Whether Apple Maps files
        // bagel shops / breakfast spots / cafeterias under `.restaurant`
        // is unverified — if it does not, those are under-included in
        // degraded mode, which ADR 0012 accepts.
        request.pointOfInterestFilter = MKPointOfInterestFilter(
            including: [.restaurant]
        )

        let search = MKLocalSearch(request: request)
        do {
            let response = try await search.start()
            let origin = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
            return response.mapItems.compactMap { item in
                shapeMapItem(item, origin: origin)
            }
        } catch {
            // MapKit failed too — caller surfaces the empty state.
            return []
        }
    }

    private func shapeMapItem(_ item: MKMapItem, origin: CLLocation) -> ShapedPlace? {
        let placemark = item.placemark
        let coordinate = placemark.coordinate
        guard coordinate.latitude.isFinite, coordinate.longitude.isFinite else { return nil }

        // Synthetic id — MKMapItem has no stable identifier across
        // queries; using a deterministic hash means a repeat search
        // for the same venue cache-collides cleanly in `options`.
        let synthetic = "mapkit:" + ([
            item.name ?? "?",
            String(format: "%.5f", coordinate.latitude),
            String(format: "%.5f", coordinate.longitude),
        ].joined(separator: "|"))

        let distance = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
            .distance(from: origin)
        let walkMinutes = max(1, Int((distance / 80.0).rounded(.up)))

        let address = [
            placemark.subThoroughfare,
            placemark.thoroughfare,
            placemark.locality,
            placemark.administrativeArea,
        ].compactMap { $0 }.joined(separator: " ")

        return ShapedPlace(
            fsqPlaceId: synthetic,
            name: item.name ?? "Unknown",
            lat: coordinate.latitude,
            lng: coordinate.longitude,
            priceTier: nil,
            walkMinutesEstimate: walkMinutes,
            dietaryTags: [],
            hours: nil,
            photos: [],
            address: address.isEmpty ? nil : address,
            categories: pointOfInterestCategories(item)
        )
    }

    private func pointOfInterestCategories(_ item: MKMapItem) -> [String] {
        if let category = item.pointOfInterestCategory {
            return [category.rawValue]
        }
        return []
    }
}
