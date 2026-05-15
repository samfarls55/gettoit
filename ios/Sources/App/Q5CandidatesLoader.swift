// GetToIt - Q5CandidatesLoader (bug-03 v1.1).
//
// Bridge between PlacesService and the QuizCoordinator's Q5 candidate
// list. Before bug-03 the QuizCoordinator was constructed with the
// hardcoded `QuizDummyCandidates.all` fixture - Q5 rendered placeholder
// strings and the Foursquare API was never asked. The loader closes
// that gap: it calls PlacesService.fetchPlaces near the session's
// location, then shapes the returned `[ShapedPlace]` into the
// `[QuizCandidate]` shape Q5 already consumes.
//
// Wiring:
//   * `QuizSessionAssembler.assembleCoordinator` (RootView.startQuiz's
//     async body) is the single seam where both the initiator and
//     the joiner paths converge. The loader fires there, awaits the
//     candidates, and hands them to the QuizCoordinator init - no
//     race between the network call and the Q5 render because the
//     coordinator can't reach Q5 until the user advances through
//     Q1..Q4 anyway (the fetch races against four taps, comfortably).
//   * The coordinate is taken from `LocationCoordinator.place` (the
//     C-23 picker's committed place). For the joiner path the host
//     hydrates the coordinator from the room's `location_*` columns
//     before invoking the loader, so the location source is always
//     LocationCoordinator - one path, per the bug-03 hard rule.
//
// Fallback contract: if PlacesService surfaces zero rows (proxy thin
// and MapKit empty - rare but real, e.g. cold-start emulator with no
// granted location) the loader returns `QuizDummyCandidates.all` so
// Q5 still renders three rateable rows instead of an empty card list.
// We log the fallback via a Source enum the caller can inspect.

import Foundation
import CoreLocation

public final class Q5CandidatesLoader {
    public enum Source: Equatable, Sendable {
        case places(PlacesFetchResult.Source)
        case fallbackDummy
    }

    public struct Loaded: Equatable, Sendable {
        public let candidates: [QuizCandidate]
        public let source: Source

        public init(candidates: [QuizCandidate], source: Source) {
            self.candidates = candidates
            self.source = source
        }
    }

    /// Number of cards rendered on Q5. Locked at 3 by the surface spec
    /// (`design-system/surfaces/03-quiz.md` "Q5 - Regret rater
    /// (3 cards x 5 buttons)"). The loader truncates the proxy/MapKit
    /// result set to this count so a generous Foursquare payload still
    /// renders the canonical 3-card layout.
    public static let cardCount: Int = 3

    private let places: PlacesService

    public init(places: PlacesService) {
        self.places = places
    }

    /// Fetch candidate places near `coordinate` at `radiusMeters` and
    /// shape them into Q5 rows. Errors and empty results both surface
    /// as `Source.fallbackDummy` so Q5 always has three rateable rows.
    public func load(
        near coordinate: CLLocationCoordinate2D,
        radiusMeters: Int
    ) async -> Loaded {
        let result: PlacesFetchResult
        do {
            result = try await places.fetchPlaces(
                near: coordinate,
                radiusMeters: Double(radiusMeters),
                filters: PlacesFilters()
            )
        } catch {
            return Loaded(candidates: QuizDummyCandidates.all, source: .fallbackDummy)
        }

        let shaped = Q5CandidatesLoader.shapeCandidates(from: result.places)
        if shaped.isEmpty {
            return Loaded(candidates: QuizDummyCandidates.all, source: .fallbackDummy)
        }
        return Loaded(candidates: shaped, source: .places(result.source))
    }

    /// Shape a `[ShapedPlace]` into the Q5 `[QuizCandidate]` list -
    /// truncated to `cardCount` rows, with `meta` formatted as
    /// `Category - $$ - N min` to mirror the JSX fixture in
    /// `design-system/code/screens/ScreenQ5Regret.jsx`. Pulled out as a
    /// static so the unit test can exercise it without standing up the
    /// full PlacesService graph.
    public static func shapeCandidates(from places: [ShapedPlace]) -> [QuizCandidate] {
        places.prefix(cardCount).map { place in
            QuizCandidate(
                id: place.fsqPlaceId,
                name: place.name,
                meta: metaString(for: place)
            )
        }
    }

    /// Build the dot-delimited meta string. Each segment is optional;
    /// if every segment is empty the meta collapses to an empty string
    /// rather than rendering a bare separator.
    static func metaString(for place: ShapedPlace) -> String {
        var segments: [String] = []
        if let first = place.categories.first, !first.isEmpty {
            segments.append(first)
        }
        if let tier = place.priceTier, (1...4).contains(tier) {
            segments.append(String(repeating: "$", count: tier))
        }
        if let walk = place.walkMinutesEstimate {
            segments.append("\(walk) min")
        }
        return segments.joined(separator: " - ")
    }
}
