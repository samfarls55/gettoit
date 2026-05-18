// GetToIt — QuizCandidateFetch (TB-15 v1.1, factorial-wired TB-16 v1.1).
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
// coordinator forwards the member's REAL Q1-Q4 answers so the fetch and
// the downstream factorial reflect what the member actually picked.
//
// TB-16 (v1.1) — the factorial wiring. TB-15 shipped Q5 with a *flat*
// presentation: the raw fetched pool was shaped first-3 into the Q5
// rows. TB-16 routes the pool through the v1.1 factorial probe instead:
//
//   1. The unioned pool is classified into `Q5PoolVenue`s by
//      `Q5VenueClassifier` — each venue gets its cuisine / reputation /
//      vibe `Q5VenueProfile`.
//   2. `Q5FactorialCardGenerator.generate` runs against the member's
//      stated Q1-Q4 `Q5MemberProfile` and the profiled pool, selecting
//      the three strict-factorial cards (one cuisine-drop, one
//      reputation-drop, one vibe-drop — never a perfect match).
//   3. The three cards are shaped into the `[QuizCandidate]` list Q5
//      renders, carrying real `fsq_place_id`s.
//
// Pool-starvation fallback — the bug-03 hard rule, carried forward
// through every layer:
//   * the executor union is empty (proxy thin AND MapKit empty across
//     every call), OR
//   * the union is non-empty but too thin / too uniform for the
//     factorial to furnish three one-axis-deviation cards
//     (`generate` returns `nil`),
// then the fetch returns `QuizDummyCandidates.all` so Q5 still renders
// three rateable rows and the member is never stranded mid-flow. The
// factorial never invents a placeholder venue — pool starvation surfaces
// as the dummy fixture at this surface boundary, exactly as TB-15's
// flat-pool starvation did.

import Foundation
import CoreLocation

/// The result of a per-member candidate fetch — the shaped Q5 rows plus
/// a note on where they came from. Callers can ignore `source`; the
/// boundary tests inspect it.
public struct QuizCandidateFetchResult: Equatable, Sendable {
    /// Where the rendered candidate list came from.
    public enum Source: Equatable, Sendable {
        /// Real venues — the three strict-factorial cards the
        /// `Q5FactorialCardGenerator` selected from the classified,
        /// unioned Foursquare / MapKit pool.
        case fetched
        /// The dummy fixture — genuine pool starvation (every call came
        /// back empty, or the pool was too thin / uniform for the
        /// factorial to furnish three cards), or no session coordinate
        /// to fetch against.
        case fallbackDummy
    }

    public let candidates: [QuizCandidate]
    public let source: Source

    public init(candidates: [QuizCandidate], source: Source) {
        self.candidates = candidates
        self.source = source
    }
}

/// The member's stated Q1-Q4 answers, forwarded to the per-member
/// fetch. TB-15 forwarded only Q1 (cuisines) + Q2 (spend cap) because
/// the flat presentation needed nothing else; TB-16's factorial also
/// needs Q3 (reputation) and Q4 (vibe) to build the member's
/// `Q5MemberProfile`, so they ride along here.
public struct QuizFetchAnswers: Equatable, Sendable {
    /// Q1 craved cuisines (`QuizCuisine` ids). Empty for the
    /// "No preference" answer.
    public let cuisines: [String]
    /// Q2 spend cap, 1…4.
    public let budgetTier: Int
    /// Q3 reputation answer (`QuizReputation` id). May be
    /// `no_preference`.
    public let reputation: String
    /// Q4 vibe level, 0…4.
    public let vibe: Int

    public init(cuisines: [String], budgetTier: Int, reputation: String, vibe: Int) {
        self.cuisines = cuisines
        self.budgetTier = budgetTier
        self.reputation = reputation
        self.vibe = vibe
    }

    /// The Q1-Q4 answers as the `Q5MemberProfile` the factorial
    /// generator and the preference function deviate against. Cuisine
    /// and vibe come straight through; reputation is the stated Q3 id.
    public var memberProfile: Q5MemberProfile {
        Q5MemberProfile(cuisines: cuisines, reputation: reputation, vibe: vibe)
    }
}

/// The per-member candidate fetch the `QuizCoordinator` fires on the
/// Q4 -> Q5 transition. Protocol-typed so the boundary tests can inject
/// a recording double without standing up `PlacesService`.
public protocol QuizCandidateFetch: Sendable {
    /// Fetch the member's Q5 candidate pool and select the three
    /// factorial cards.
    ///
    /// - Parameter answers: the member's stated Q1-Q4 answers.
    /// - Parameter parameters: the shared `SessionParameters`.
    /// - Returns: the three shaped Q5 rows plus the source note. Never
    ///   throws — a failed / empty / too-thin fetch degrades to the
    ///   dummy fixture so Q5 always has three rateable rows.
    func fetchCandidates(
        answers: QuizFetchAnswers,
        parameters: SessionParameters
    ) async -> QuizCandidateFetchResult
}

/// The production `QuizCandidateFetch`. Wraps the tb-07
/// `FoursquareFetchExecutor`: plans + runs the N+1 answer-tailored
/// calls, classifies the unioned pool, then routes it through the v1.1
/// factorial probe.
public struct FoursquareQuizCandidateFetch: QuizCandidateFetch {
    private let executor: FoursquareFetchExecutor
    private let coordinate: CLLocationCoordinate2D
    private let radiusMeters: Double
    private let timeZone: TimeZone

    /// - Parameters:
    ///   - executor: the tb-07 fetch executor (`FoursquareFetchExecutor`)
    ///     — wraps `PlacesService` and the `FoursquareFetchPlanner`.
    ///   - coordinate: the session geo anchor (resolved from the shared
    ///     `LocationCoordinator` on both the initiator and joiner path).
    ///   - radiusMeters: the transport-radius circle.
    ///   - timeZone: the search area's timezone — drives the venue-local
    ///     `open_at` token. Resolved from the same `ResolvedPlace` as
    ///     `coordinate` so initiator and joiner plan identically.
    public init(
        executor: FoursquareFetchExecutor,
        coordinate: CLLocationCoordinate2D,
        radiusMeters: Double,
        timeZone: TimeZone = .current
    ) {
        self.executor = executor
        self.coordinate = coordinate
        self.radiusMeters = radiusMeters
        self.timeZone = timeZone
    }

    public func fetchCandidates(
        answers: QuizFetchAnswers,
        parameters: SessionParameters
    ) async -> QuizCandidateFetchResult {
        let union: [ShapedPlace]
        do {
            let result = try await executor.fetch(
                cuisines: answers.cuisines,
                budgetTier: answers.budgetTier,
                parameters: parameters,
                coordinate: coordinate,
                radiusMeters: radiusMeters,
                timeZone: timeZone
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

        return Self.selectFactorialCards(
            from: union,
            member: answers.memberProfile
        )
    }

    /// Classify the unioned pool, run the factorial generator, and
    /// shape the result into Q5 rows. Exposed `static` so the boundary
    /// tests can drive the pool -> factorial path directly with a
    /// canned union, without standing up the executor.
    ///
    /// On pool starvation — an empty union, or a union the factorial
    /// cannot furnish three one-axis-deviation cards from — this returns
    /// the dummy fixture. The factorial never invents a placeholder.
    static func selectFactorialCards(
        from union: [ShapedPlace],
        member: Q5MemberProfile,
        now: Date = Date()
    ) -> QuizCandidateFetchResult {
        // Classify every pooled venue into its three-axis profile —
        // reputation is pool-relative, so the whole pool is classified
        // in one call.
        let profiled = Q5VenueClassifier.classify(pool: union, now: now)

        // Run the strict factorial: three cards, one per axis, each
        // deviating from the member's stated profile on exactly that
        // axis. `nil` means the pool is too thin / uniform.
        guard let cards = Q5FactorialCardGenerator.generate(
            member: member,
            pool: profiled
        ) else {
            // Pool starvation at the factorial boundary — Q5 still
            // renders three rateable rows; no placeholder venue is ever
            // invented mid-pool (the bug-03 hard rule).
            return QuizCandidateFetchResult(
                candidates: QuizDummyCandidates.all,
                source: .fallbackDummy
            )
        }

        // The three factorial cards become Q5's candidate list, each
        // carrying its real `fsq_place_id`.
        let candidates = Q5FactorialCardGenerator.quizCandidates(from: cards)
        return QuizCandidateFetchResult(candidates: candidates, source: .fetched)
    }
}

/// A `QuizCandidateFetch` that always resolves to the dummy fixture
/// without touching `PlacesService`. Used when the session has no
/// coordinate to fetch against — Q5 still renders three rateable rows
/// so the member is never stranded mid-flow.
public struct DummyQuizCandidateFetch: QuizCandidateFetch {
    public init() {}

    public func fetchCandidates(
        answers: QuizFetchAnswers,
        parameters: SessionParameters
    ) async -> QuizCandidateFetchResult {
        QuizCandidateFetchResult(
            candidates: QuizDummyCandidates.all,
            source: .fallbackDummy
        )
    }
}
