// GetToIt — RunningUnionPoolManager (TB-10 v1.1, PRD module G).
//
// Server-side candidate-pool manager. Holds the group candidate pool as
// the **running union** of every member's Foursquare fetch — never an
// intersection. The verdict engine (PRD module B / tb-11) is built to
// take a broad set and narrow it (EBA prune, then satisficing floor);
// intersecting fetch sets would hard-cut soft signal, front-run that
// narrowing, and leave no empty-pool safety net (PRD §"Design
// constraints", amendments §5).
//
// As the union grows with each member's fetch, the manager re-scores
// the new venues for every already-completed member via that member's
// cached `prefFn`, so no member's scores go stale. Per-member scores
// are cached keyed by venue id; the verdict engine reads them directly
// via `scores(for:)`.
//
// Why the manager owns the score cache rather than scoring lazily at
// verdict time (amendments §5):
//
//   * Per-member scoring runs **incrementally** the moment a member
//     completes Q5 — `prefFn` is a stored pure function and scoring is
//     sub-millisecond, so re-scoring the union on every fetch is cheap.
//   * Only the *fetch* cost scales with group size; scoring does not.
//     Doing the work eagerly here keeps the verdict-engine path a pure
//     read of a fully-populated cache.
//
// Purity / boundaries. The manager carries no I/O, no clock, no
// randomness. It is the seam between the fetch executor (PRD module F /
// tb-07 — produces a member's deduped venue list) and the verdict
// engine (PRD module B / tb-11 — consumes the union + per-member
// scores). The `prefFn` it caches is the pure closure built by
// `PreferenceFunction.build` (PRD module A / tb-09).
//
// Reference class, not a struct: the manager is mutable session state
// accumulated across the quiz, and callers hold one shared instance per
// session. Not `Sendable` — a single session's quiz flow is
// single-threaded on the actor that owns it (the verdict store /
// quiz coordinator); the manager does not cross actor boundaries.

import Foundation

/// Holds the group candidate pool as the running union of per-member
/// Foursquare fetches, and caches per-member preference scores for the
/// verdict engine to consume.
public final class RunningUnionPoolManager {

    /// The running union, keyed by venue id (`fsq_place_id`). First-seen
    /// wins on a duplicate id so the union is stable as it grows — a
    /// later member's fetch re-contributing a venue never mutates the
    /// profile already in the pool.
    private var unionByVenueId: [String: Q5PoolVenue] = [:]

    /// Insertion order of venue ids, so `pool` is deterministic for
    /// tests and for any caller that iterates the union.
    private var venueOrder: [String] = []

    /// Each completed member's cached preference function. The closure
    /// is the pure `prefFn` built by `PreferenceFunction.build`
    /// (tb-09) — a deterministic `Q5VenueProfile -> Double` on the 1…5
    /// scale.
    private var prefFnByMember: [String: (Q5VenueProfile) -> Double] = [:]

    /// Per-member score cache. `scoreByVenueIdByMember[member][venueId]`
    /// is `member`'s `prefFn` applied to that venue's profile. Kept
    /// fresh against the full union after every `addMemberFetch`.
    private var scoreByVenueIdByMember: [String: [String: Double]] = [:]

    /// Insertion order of completed member ids, so `completedMemberIds`
    /// is deterministic.
    private var memberOrder: [String] = []

    public init() {}

    // MARK: - Reads (verdict-engine surface)

    /// The group candidate pool — the running union of every member's
    /// fetch, deduped by venue id, in first-seen order.
    public var pool: [Q5PoolVenue] {
        venueOrder.compactMap { unionByVenueId[$0] }
    }

    /// The ids of every member who has completed a fetch, in completion
    /// order.
    public var completedMemberIds: [String] {
        memberOrder
    }

    /// The cached per-member preference scores, keyed by venue id. Every
    /// pool venue carries a score for `memberId` (the manager keeps the
    /// cache fresh against the full union). Returns an empty map for a
    /// member who has not completed a fetch.
    public func scores(for memberId: String) -> [String: Double] {
        scoreByVenueIdByMember[memberId] ?? [:]
    }

    // MARK: - Mutation (fetch-executor surface)

    /// Fold a member's completed Foursquare fetch into the group pool.
    ///
    /// Three effects, in order:
    ///   1. `venues` are unioned into the pool, deduped by venue id
    ///      (first-seen profile wins on a duplicate).
    ///   2. `prefFn` is cached for `memberId` — replacing any prior
    ///      `prefFn` for that id, so a member who re-completes the quiz
    ///      overwrites their stale contribution rather than stacking.
    ///   3. Every member's score cache is refreshed against the
    ///      resulting union — the joining member scores the whole
    ///      existing union, and every already-completed member
    ///      re-scores the newly-added venues. No member's scores go
    ///      stale.
    ///
    /// - Parameters:
    ///   - memberId: the completing member's id.
    ///   - venues: the member's deduped fetch result (PRD module F /
    ///     tb-07 output, profiled by the axis scorers / tb-09). May be
    ///     empty — a thin-pool fetch still registers the member and
    ///     still scores the rest of the union.
    ///   - prefFn: the member's cached preference function (PRD module
    ///     A / tb-09) — a pure `Q5VenueProfile -> Double` on the 1…5
    ///     scale.
    public func addMemberFetch(
        memberId: String,
        venues: [Q5PoolVenue],
        prefFn: @escaping (Q5VenueProfile) -> Double
    ) {
        // 1 — union the member's venues into the pool. First-seen wins:
        // a duplicate id never overwrites the profile already in the
        // union, so the running union is stable as it grows.
        for venue in venues where unionByVenueId[venue.id] == nil {
            unionByVenueId[venue.id] = venue
            venueOrder.append(venue.id)
        }

        // 2 — cache (or replace) the member's prefFn. A member who
        // re-completes the quiz overwrites their prior function; the
        // re-score in step 3 then refreshes their whole cache against
        // the latest function.
        if prefFnByMember[memberId] == nil {
            memberOrder.append(memberId)
        }
        prefFnByMember[memberId] = prefFn

        // 3 — refresh every member's score cache against the full
        // union. Scoring is sub-millisecond and `prefFn` is pure, so a
        // full re-score per fetch is the cheapest correct option — it
        // also covers the re-completed-member case in step 2 without a
        // special path. This is the "no member's scores go stale"
        // acceptance criterion.
        rescoreAllMembers()
    }

    // MARK: - Internals

    /// Re-score the full union for every completed member from their
    /// cached `prefFn`, replacing the per-member cache wholesale.
    private func rescoreAllMembers() {
        for (member, prefFn) in prefFnByMember {
            var scores: [String: Double] = [:]
            scores.reserveCapacity(venueOrder.count)
            for venueId in venueOrder {
                guard let venue = unionByVenueId[venueId] else { continue }
                scores[venueId] = prefFn(venue.profile)
            }
            scoreByVenueIdByMember[member] = scores
        }
    }
}
