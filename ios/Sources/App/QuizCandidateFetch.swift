// GetToIt — QuizCandidateFetch (TB-15 v1.1, PRD modules D + F wiring).
//
// The seam that fires the per-member Foursquare fetch when a member
// completes Q1-Q4. Before TB-15 the live quiz still ran the bug-03
// tracer-bullet bridge: `QuizSessionAssembler` called `PlacesService`
// once, BEFORE the user answered anything, with an empty
// `PlacesFilters()`, and truncated the result to three venues. The
// real per-member fetch (`FoursquareFetchPlanner` + `FoursquareFetch-
// Executor`, built in tb-07) was fully unit/boundary-tested but had no
// live callers.
//
// `QuizCandidateFetch` closes that wiring gap. The `QuizCoordinator`
// holds one and invokes `fetchCandidates(...)` exactly once, on the
// Q4 -> Q5 transition — never on the pre-quiz assembler seam. The
// coordinator forwards the member's REAL Q1 cuisines + Q2 spend cap so
// the N+1 answer-tailored calls reflect what the member actually
// picked.
//
// The default implementation, `FoursquareQuizCandidateFetch`, wraps
// the tb-07 `FoursquareFetchExecutor`: it plans + runs the N+1 calls,
// then shapes the unioned, deduped venue pool into the `[QuizCandidate]`
// list Q5 renders. This slice keeps Q5's flat presentation — the
// factorial card selection is TB-16 — so the pool is shaped here the
// same dot-delimited way `Q5CandidatesLoader` shaped a single fetch.
//
// Pool-starvation fallback: if the executor's union is empty (proxy
// thin AND MapKit empty across every call — rare but real) the fetch
// returns `QuizDummyCandidates.all` so Q5 still renders three rateable
// rows and the member is never stranded mid-flow (the bug-03 hard
// rule, carried forward).

import Foundation
import CoreLocation

/// The result of a per-member candidate fetch — the shaped Q5 rows plus
/// a note on where they came from. Callers can ignore `source`; the
/// boundary tests inspect it.
public struct QuizCandidateFetchResult: Equatable, Sendable {
    /// Where the rendered candidate list came from.
    public enum Source: Equatable, Sendable {
        /// Real venues drawn from the executor's unioned Foursquare /
        /// MapKit pool.
        case fetched
        /// The dummy fixture — genuine pool starvation (every call came
        /// back empty), or no session coordinate to fetch against.
        case fallbackDummy
    }

    public let candidates: [QuizCandidate]
    public let source: Source

    public init(candidates: [QuizCandidate], source: Source) {
        self.candidates = candidates
        self.source = source
    }
}

/// The per-member candidate fetch the `QuizCoordinator` fires on the
/// Q4 -> Q5 transition. Protocol-typed so the boundary tests can inject
/// a recording double without standing up `PlacesService`.
public protocol QuizCandidateFetch: Sendable {
    /// Fetch the member's Q5 candidate pool.
    ///
    /// - Parameters:
    ///   - cuisines: the member's Q1 craved cuisines (`QuizCuisine`
    ///     ids). Empty for the "No preference" answer.
    ///   - budgetTier: the Q2 spend cap, 1…4.
    ///   - parameters: the shared `SessionParameters`.
    /// - Returns: the shaped Q5 rows plus the source note. Never throws
    ///   — a failed / empty fetch degrades to the dummy fixture so Q5
    ///   always has three rateable rows.
    func fetchCandidates(
        cuisines: [String],
        budgetTier: Int,
        parameters: SessionParameters
    ) async -> QuizCandidateFetchResult
}

/// The production `QuizCandidateFetch`. Wraps the tb-07
/// `FoursquareFetchExecutor`: plans + runs the N+1 answer-tailored
/// calls, then shapes the unioned, deduped pool into Q5 rows.
public struct FoursquareQuizCandidateFetch: QuizCandidateFetch {
    private let executor: FoursquareFetchExecutor
    private let coordinate: CLLocationCoordinate2D
    private let radiusMeters: Double

    /// - Parameters:
    ///   - executor: the tb-07 fetch executor (`FoursquareFetchExecutor`)
    ///     — wraps `PlacesService` and the `FoursquareFetchPlanner`.
    ///   - coordinate: the session geo anchor (resolved from the shared
    ///     `LocationCoordinator` on both the initiator and joiner path).
    ///   - radiusMeters: the transport-radius circle.
    public init(
        executor: FoursquareFetchExecutor,
        coordinate: CLLocationCoordinate2D,
        radiusMeters: Double
    ) {
        self.executor = executor
        self.coordinate = coordinate
        self.radiusMeters = radiusMeters
    }

    public func fetchCandidates(
        cuisines: [String],
        budgetTier: Int,
        parameters: SessionParameters
    ) async -> QuizCandidateFetchResult {
        let union: [ShapedPlace]
        do {
            let result = try await executor.fetch(
                cuisines: cuisines,
                budgetTier: budgetTier,
                parameters: parameters,
                coordinate: coordinate,
                radiusMeters: radiusMeters
            )
            union = result.places
        } catch {
            // The whole fetch threw — degrade to the dummy fixture so
            // Q5 still has three rateable rows (bug-03 hard rule).
            return QuizCandidateFetchResult(
                candidates: QuizDummyCandidates.all,
                source: .fallbackDummy
            )
        }

        // TB-15 keeps Q5's flat presentation — the factorial card
        // selection is the next slice (TB-16). Shape the pool the same
        // dot-delimited way `Q5CandidatesLoader` shaped a single fetch.
        let shaped = Q5CandidatesLoader.shapeCandidates(from: union)
        if shaped.isEmpty {
            // Genuine pool starvation: proxy thin and MapKit empty
            // across every call. Q5 still renders three rows.
            return QuizCandidateFetchResult(
                candidates: QuizDummyCandidates.all,
                source: .fallbackDummy
            )
        }
        return QuizCandidateFetchResult(candidates: shaped, source: .fetched)
    }
}
