// GetToIt - Q5CandidatesLoader (bug-03 v1.1, narrowed TB-15 v1.1).
//
// Q5 candidate *shaping* — turns a fetched `[ShapedPlace]` into the
// `[QuizCandidate]` shape the Q5 surface (`QuizQ5Regret`) renders.
//
// TB-15 (v1.1) — this type used to ALSO own the bug-03 tracer-bullet
// fetch: `load(near:radiusMeters:)` called `PlacesService.fetchPlaces`
// once, early, with an empty `PlacesFilters()`, before the member
// answered any quiz question. That early empty-filter fetch is removed
// — the per-member answer-tailored fetch (`QuizCandidateFetch` ->
// `FoursquareFetchExecutor`) is the only path that reaches Foursquare,
// and it fires on the Q4 -> Q5 transition with the member's real
// answers. What remains here is the pure shaping logic, reused by
// `FoursquareQuizCandidateFetch` (TB-15) and `Q5FactorialCardGenerator`
// (TB-08) so a plain fetch row and a factorial card format identically.

import Foundation

public enum Q5CandidatesLoader {

    /// Number of cards rendered on Q5. Locked at 3 by the surface spec
    /// (`design-system/surfaces/03-quiz.md` "Q5 - Regret rater
    /// (3 cards x 5 buttons)"). `shapeCandidates` truncates the fetched
    /// venue set to this count so a generous Foursquare pool still
    /// renders the canonical 3-card layout.
    public static let cardCount: Int = 3

    /// Shape a `[ShapedPlace]` into the Q5 `[QuizCandidate]` list -
    /// truncated to `cardCount` rows, with `meta` formatted as
    /// `Category - $$ - N min` to mirror the JSX fixture in
    /// `design-system/code/screens/ScreenQ5Regret.jsx`.
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
