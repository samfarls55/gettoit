// GetToIt — PlacesService.
//
// Single point through which the app fetches candidate restaurants.
// Calls the PlacesProxy Edge Function first; if the response is thin
// (empty or below the server-emitted threshold) or the call errors,
// falls back to Apple MapKit POI search on-device per ADR 0002.
//
// The Foursquare API key lives on the server and never reaches the
// client; PlacesProxyRequest is deliberately a pure-data struct that
// does not carry any auth secrets.

import Foundation
import CoreLocation

// MARK: - Shaped place (mirrors the Edge Function's `ShapedPlace`)

/// Wire-shape returned by both the Edge Function and the MapKit
/// fallback so downstream consumers (TB-04 quiz, TB-06 VerdictEngine)
/// don't branch on source.
public struct ShapedPlace: Codable, Equatable, Sendable {
    public let fsqPlaceId: String
    public let name: String
    public let lat: Double
    public let lng: Double
    public let priceTier: Int?
    public let walkMinutesEstimate: Int?
    public let dietaryTags: [String]
    public let hours: PlaceHours?
    public let photos: [String]
    public let address: String?
    public let categories: [String]
    /// TB-16 (v1.1) — reputation-axis metadata. The Foursquare quality
    /// score, 0…10. `nil` when the venue carries no rating, or when the
    /// Edge Function build predates the reputation-field projection
    /// (these three fields are decoded as `nil` on an older response —
    /// `Codable` tolerates the absent key — so the wire is forward- and
    /// backward-compatible). `Q5VenueClassifier` reads it for the
    /// reputation axis (foursquare-filter-surface research §4).
    public let rating: Double?
    /// TB-16 (v1.1) — reputation-axis volume signal: how many people
    /// have rated the venue (`stats.total_ratings`). The primary
    /// "how known is this place" signal. `nil` when absent.
    public let totalRatings: Int?
    /// TB-16 (v1.1) — reputation-axis age signal: the ISO-8601 date the
    /// Foursquare record was created (`date_created`). A proxy for
    /// New vs Classic; `nil` when absent. See the research §4
    /// `date_created` caveat — it is the record's age, not the
    /// restaurant's.
    public let dateCreated: String?

    public init(
        fsqPlaceId: String,
        name: String,
        lat: Double,
        lng: Double,
        priceTier: Int? = nil,
        walkMinutesEstimate: Int? = nil,
        dietaryTags: [String] = [],
        hours: PlaceHours? = nil,
        photos: [String] = [],
        address: String? = nil,
        categories: [String] = [],
        rating: Double? = nil,
        totalRatings: Int? = nil,
        dateCreated: String? = nil
    ) {
        self.fsqPlaceId = fsqPlaceId
        self.name = name
        self.lat = lat
        self.lng = lng
        self.priceTier = priceTier
        self.walkMinutesEstimate = walkMinutesEstimate
        self.dietaryTags = dietaryTags
        self.hours = hours
        self.photos = photos
        self.address = address
        self.categories = categories
        self.rating = rating
        self.totalRatings = totalRatings
        self.dateCreated = dateCreated
    }

    enum CodingKeys: String, CodingKey {
        case fsqPlaceId = "fsq_place_id"
        case name
        case lat
        case lng
        case priceTier = "price_tier"
        case walkMinutesEstimate = "walk_minutes_estimate"
        case dietaryTags = "dietary_tags"
        case hours
        case photos
        case address
        case categories
        case rating
        case totalRatings = "total_ratings"
        case dateCreated = "date_created"
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        fsqPlaceId = try c.decode(String.self, forKey: .fsqPlaceId)
        name = try c.decode(String.self, forKey: .name)
        lat = try c.decode(Double.self, forKey: .lat)
        lng = try c.decode(Double.self, forKey: .lng)
        priceTier = try c.decodeIfPresent(Int.self, forKey: .priceTier)
        walkMinutesEstimate = try c.decodeIfPresent(Int.self, forKey: .walkMinutesEstimate)
        dietaryTags = try c.decodeIfPresent([String].self, forKey: .dietaryTags) ?? []
        hours = try c.decodeIfPresent(PlaceHours.self, forKey: .hours)
        photos = try c.decodeIfPresent([String].self, forKey: .photos) ?? []
        address = try c.decodeIfPresent(String.self, forKey: .address)
        categories = try c.decodeIfPresent([String].self, forKey: .categories) ?? []
        // The three reputation fields are optional on the wire: an Edge
        // Function build that predates the TB-16 projection omits them,
        // and `decodeIfPresent` decodes that as `nil` rather than
        // throwing. Forward-compatible.
        rating = try c.decodeIfPresent(Double.self, forKey: .rating)
        totalRatings = try c.decodeIfPresent(Int.self, forKey: .totalRatings)
        dateCreated = try c.decodeIfPresent(String.self, forKey: .dateCreated)
    }
}

public struct PlaceHours: Codable, Equatable, Sendable {
    public let display: String?
    public let openNow: Bool?

    public init(display: String? = nil, openNow: Bool? = nil) {
        self.display = display
        self.openNow = openNow
    }

    enum CodingKeys: String, CodingKey {
        case display
        case openNow = "open_now"
    }
}

// MARK: - Proxy request / response

public struct PlacesFilters: Codable, Equatable, Sendable {
    public var dietary: [String]?
    public var priceTier: Int?
    public var openAt: String?
    /// TB-07 (v1.1) — the craved cuisine this per-member fetch call is
    /// tagged for (a `QuizCuisine` id, e.g. `"mexican"`). Set on the N
    /// per-cuisine calls of an N+1 fetch; `nil` on the mandatory
    /// general call.
    ///
    /// This is an **advisory** tag, NOT a strict filter. research-01
    /// §3.2 fixes that cuisine must never strict-filter the fetch — a
    /// craved cuisine narrows nothing on the wire; it only records
    /// which cuisine motivated the call so the running-union pool
    /// manager (tb-10) and the verdict engine can read the intent.
    /// The general call (no `cuisine`) supplies non-craved breadth so
    /// the Q5 factorial keeps its variety. It is deliberately kept out
    /// of `dietary` (which IS a hard category filter).
    public var cuisine: String?

    public init(
        dietary: [String]? = nil,
        priceTier: Int? = nil,
        openAt: String? = nil,
        cuisine: String? = nil
    ) {
        self.dietary = dietary
        self.priceTier = priceTier
        self.openAt = openAt
        self.cuisine = cuisine
    }

    enum CodingKeys: String, CodingKey {
        case dietary
        case priceTier = "price_tier"
        case openAt = "open_at"
        case cuisine
    }
}

public struct PlacesProxyRequest: Codable, Equatable, Sendable {
    public let lat: Double
    public let lng: Double
    public let radiusMeters: Double
    public let filters: PlacesFilters?

    public init(lat: Double, lng: Double, radiusMeters: Double, filters: PlacesFilters?) {
        self.lat = lat
        self.lng = lng
        self.radiusMeters = radiusMeters
        self.filters = filters
    }

    enum CodingKeys: String, CodingKey {
        case lat
        case lng
        case radiusMeters = "radius_meters"
        case filters
    }
}

public struct PlacesProxyResponse: Codable, Equatable, Sendable {
    public let places: [ShapedPlace]
    public let disclaimers: [String]
    public let isThin: Bool
    public let servedFromCache: Bool

    public init(places: [ShapedPlace], disclaimers: [String], isThin: Bool, servedFromCache: Bool) {
        self.places = places
        self.disclaimers = disclaimers
        self.isThin = isThin
        self.servedFromCache = servedFromCache
    }

    enum CodingKeys: String, CodingKey {
        case places
        case disclaimers
        case isThin = "is_thin"
        case servedFromCache = "served_from_cache"
    }

    public static let empty = PlacesProxyResponse(
        places: [],
        disclaimers: [],
        isThin: true,
        servedFromCache: false
    )
}

// MARK: - Protocols

/// Abstraction over the PlacesProxy Edge Function — lets tests inject a
/// stub without exercising URLSession.
public protocol PlacesProxyClient: Sendable {
    func search(_ request: PlacesProxyRequest) async throws -> PlacesProxyResponse
}

/// Abstraction over the MapKit POI fallback — lets tests inject a stub
/// without invoking MKLocalSearch from a unit test target (which can
/// hang the simulator on a CI runner).
public protocol PlacesMapKitFallback: Sendable {
    func search(near coordinate: CLLocationCoordinate2D, radiusMeters: Double) async -> [ShapedPlace]
}

// MARK: - PlacesService

/// Result returned to callers, carrying which source produced the rows.
public struct PlacesFetchResult: Equatable, Sendable {
    public enum Source: String, Sendable {
        case foursquare
        case mapKitFallback
    }
    public let places: [ShapedPlace]
    public let disclaimers: [String]
    public let source: Source

    public init(places: [ShapedPlace], disclaimers: [String], source: Source) {
        self.places = places
        self.disclaimers = disclaimers
        self.source = source
    }
}

public final class PlacesService: Sendable {
    private let proxy: PlacesProxyClient
    private let mapKitFallback: PlacesMapKitFallback

    public init(proxy: PlacesProxyClient, mapKitFallback: PlacesMapKitFallback) {
        self.proxy = proxy
        self.mapKitFallback = mapKitFallback
    }

    /// Fetch candidate places near the given coordinate. Returns the
    /// proxy's results if non-thin; otherwise falls back to MapKit.
    public func fetchPlaces(
        near coordinate: CLLocationCoordinate2D,
        radiusMeters: Double,
        filters: PlacesFilters
    ) async throws -> PlacesFetchResult {
        let request = PlacesProxyRequest(
            lat: coordinate.latitude,
            lng: coordinate.longitude,
            radiusMeters: radiusMeters,
            filters: filters
        )

        do {
            let response = try await proxy.search(request)
            if !response.isThin {
                return PlacesFetchResult(
                    places: response.places,
                    disclaimers: response.disclaimers,
                    source: .foursquare
                )
            }
            // Thin response — try MapKit. Carry the disclaimers forward
            // so the verdict rule chip still surfaces them on the
            // MapKit-fallback path.
            let fallback = await mapKitFallback.search(near: coordinate, radiusMeters: radiusMeters)
            return PlacesFetchResult(
                places: fallback,
                disclaimers: response.disclaimers,
                source: .mapKitFallback
            )
        } catch {
            // Proxy outright failed — MapKit fallback, no disclaimers
            // (we couldn't determine them).
            let fallback = await mapKitFallback.search(near: coordinate, radiusMeters: radiusMeters)
            return PlacesFetchResult(
                places: fallback,
                disclaimers: [],
                source: .mapKitFallback
            )
        }
    }
}
