// GetToIt — PreferenceFunction (TB-09 quiz redesign, PRD modules A + E).
//
// The per-member preference engine. `PreferenceFunction.build` takes a
// member's stated Q1–Q4 profile and their three Q5 factorial ratings
// and returns a `prefFn(venue) -> Double` that scores any axis-profiled
// venue on the 1…5 scale the verdict engine's satisficing floor reads.
//
// Pure: no I/O, no clock, no randomness, no group state. The returned
// closure is itself pure — a deterministic function of `member` and the
// Q5 ratings it was built from. The verdict engine caches one `prefFn`
// per member and re-applies it to every pool venue (PRD module G).
//
// Design source — gti-vault/50_product/0.1.0-quiz-amendments §3
// ("Q5 — the preference probe"):
//
//   * **Stated-weight initialization.** The three axis weights seed at
//     an equal 1/3. Q1–Q4 give the member's *position* on each axis,
//     not how much they care; the weight hierarchy is Q5's job, so the
//     prior is deliberately neutral. An explicit "No preference" (the
//     Q3 chip, or Q1 left empty) is a genuine zero-weight signal — that
//     axis is zeroed and its weight redistributed equally to the
//     survivors.
//   * **Soft re-weight.** For each axis,
//     `marginal_value = avg(two keep-card ratings) - drop-card rating`,
//     floored at 0, normalized across axes to give `w_revealed`. Final
//     weights are a *partial* blend toward the revealed signal:
//     `w_final = (1 - alpha) * w_prior + alpha * w_revealed`. Blending
//     toward a non-zero prior means an axis the member positively
//     selected is never discounted all the way to zero by a thin 3-card
//     probe — only an explicit "No preference" zeroes an axis.
//   * **Hard-contradiction override.** A strict, two-condition trigger:
//     fires for an axis only when BOTH that axis's keep-cards score
//     strictly below its drop-card AND the drop-card is rated 4 or 5.
//     Action is **demote to no-preference** (weight zeroed, axis stops
//     scoring) — never invert toward the drop-card's value. A demoted
//     axis is neutral, never a liability.
//   * **Score normalization.** Each axis produces a 1…5 match score;
//     the venue score is the weighted average over nonzero-weight axes.
//     A match scores 5; a soft non-match scores ~2 — below threshold T
//     — so the satisficing floor has teeth.
//
// Axis metadata mapping — gti-vault/60_engineering/research/
// foursquare-filter-surface-2026-05/report.md §4–5:
//
//   * **Cuisine** — clean set membership: the venue's cuisine is in the
//     member's craved set, or it is not.
//   * **Reputation** — a categorical axis (Popular / Hidden gem /
//     Classic / New). The factorial treats it as keep/drop, so the
//     scorer here is exact-match vs not. The continuous volume/quality
//     space the research describes is a post-cohort tuning refinement;
//     the cohort-zero scorer matches the binary factorial lever.
//   * **Vibe** — the one *graded* axis: distance on the 0…4 energy
//     scale, 5 at an exact match descending linearly toward the bottom
//     of the 1…5 scale at the opposite end.
//
// Cohort-zero constants — `match=5`, `soft-non-match~2`, `T=3`,
// `alpha=0.5` — are tunable post-cohort (amendments §3).

import Foundation

/// One Q5 factorial card's excitement rating, tagged with the axis that
/// card deviates on. The Q5 factorial (`Q5FactorialCard`, tb-08) emits
/// exactly three cards — one per axis — and the member rates each 1…5;
/// `Q5Rating` is that rating paired with its card's `droppedAxis` so the
/// preference function can read each axis's weight from its
/// drop-card-vs-keep-card spread.
public struct Q5Rating: Equatable, Sendable {
    /// The factorial axis the rated card deviates on. Each Q5 triple
    /// carries exactly one rating per axis.
    public let droppedAxis: Q5FactorialCard.Axis
    /// The member's 1…5 excitement rating for that card.
    public let score: Int

    public init(droppedAxis: Q5FactorialCard.Axis, score: Int) {
        self.droppedAxis = droppedAxis
        self.score = score
    }
}

// MARK: - Axis scorers (PRD module E)

/// Cuisine axis — a clean set-membership match. The venue's cuisine is
/// either one the member craved (a match) or it is not (a soft
/// non-match). An unclassified (`nil`) venue cuisine can never match.
public enum CuisineAxisScorer {
    /// Score a venue's cuisine against the member's craved set, 1…5.
    public static func score(venueCuisine: String?, cravedCuisines: [String]) -> Double {
        guard let venueCuisine, cravedCuisines.contains(venueCuisine) else {
            return PreferenceFunction.softNonMatchScore
        }
        return PreferenceFunction.matchScore
    }
}

/// Reputation axis — a categorical match. The member states one
/// reputation bucket (Popular / Hidden gem / Classic / New); a venue in
/// that bucket matches, any other bucket is a soft non-match.
///
/// research-01 §4 describes reputation as a position in a continuous
/// volume/quality space; the Q5 factorial treats it as a binary
/// keep/drop lever, so the cohort-zero scorer is exact-match. Refining
/// to the graded volume/quality space is a post-cohort tuning item — it
/// does not change this `venue -> 1…5` interface.
public enum ReputationAxisScorer {
    /// Score a venue's reputation bucket against the member's stated
    /// bucket, 1…5. `statedReputation` is never `no_preference` here —
    /// a no-preference reputation zeroes the whole axis upstream, so the
    /// scorer is never consulted for it.
    public static func score(venueReputation: String, statedReputation: String) -> Double {
        venueReputation == statedReputation
            ? PreferenceFunction.matchScore
            : PreferenceFunction.softNonMatchScore
    }
}

/// Vibe axis — the one *graded* axis. Vibe is a cardinal 0…4 energy
/// scale (Quiet…Rowdy); the score is graded by distance: 5 at an exact
/// match, descending linearly toward the bottom of the 1…5 scale at the
/// maximum distance (4 steps apart).
public enum VibeAxisScorer {
    /// Score a venue's vibe level against the member's stated vibe,
    /// 1…5, graded by distance on the 0…4 energy scale.
    public static func score(venueVibe: Int, statedVibe: Int) -> Double {
        let maxDistance = Double(GTIVibeLabels.all.count - 1)   // 4
        let distance = Double(abs(venueVibe - statedVibe))
        let fraction = maxDistance > 0 ? distance / maxDistance : 0
        // distance 0 -> matchScore (5); distance maxDistance -> 1.
        return PreferenceFunction.matchScore
            - fraction * (PreferenceFunction.matchScore - 1.0)
    }
}

// MARK: - Preference function (PRD module A)

public enum PreferenceFunction {

    // MARK: Cohort-zero constants (tunable post-cohort — amendments §3)

    /// A full axis match scores 5.
    public static let matchScore: Double = 5.0
    /// A soft non-match scores ~2 — deliberately below `thresholdT` so
    /// the satisficing floor can eliminate a venue in aggregate.
    public static let softNonMatchScore: Double = 2.0
    /// The satisficing threshold T the verdict engine's floor keeps
    /// venues at or above. Carried here so tests and callers read one
    /// canonical value.
    public static let thresholdT: Double = 3.0
    /// The soft re-weight blend constant: `w_final` is `alpha` of the
    /// way from the prior toward the Q5-revealed weights.
    public static let alpha: Double = 0.5

    /// The three preference axes.
    enum Axis: CaseIterable {
        case cuisine
        case reputation
        case vibe
    }

    /// Build a member's preference function from their stated Q1–Q4
    /// profile and their three Q5 factorial ratings.
    ///
    /// - Parameters:
    ///   - member: the member's stated Q1–Q4 profile.
    ///   - q5Ratings: the three Q5 card ratings, one per axis. Order is
    ///     irrelevant — each rating carries its own `droppedAxis`.
    /// - Returns: a pure `prefFn(venue) -> Double` scoring any
    ///   axis-profiled venue 1…5.
    public static func build(
        member: Q5MemberProfile,
        q5Ratings: [Q5Rating]
    ) -> (Q5VenueProfile) -> Double {
        let weights = resolveWeights(member: member, q5Ratings: q5Ratings)
        let craved = member.cuisines
        let statedReputation = member.reputation
        let statedVibe = member.vibe

        return { venue in
            // Per-axis 1…5 match scores.
            var contributions: [(weight: Double, score: Double)] = []

            if weights.cuisine > 0 {
                contributions.append((
                    weights.cuisine,
                    CuisineAxisScorer.score(venueCuisine: venue.cuisine, cravedCuisines: craved)
                ))
            }
            if weights.reputation > 0 {
                contributions.append((
                    weights.reputation,
                    ReputationAxisScorer.score(
                        venueReputation: venue.reputation,
                        statedReputation: statedReputation
                    )
                ))
            }
            if weights.vibe > 0 {
                contributions.append((
                    weights.vibe,
                    VibeAxisScorer.score(venueVibe: venue.vibe, statedVibe: statedVibe)
                ))
            }

            // Every axis zeroed (the member no-prefed all three, or
            // every axis was demoted) — no preference signal at all, so
            // every venue is equally acceptable. Score at the match
            // ceiling: a member with no stated preference is satisfied
            // by anything, never blocked by the satisficing floor.
            let totalWeight = contributions.reduce(0) { $0 + $1.weight }
            guard totalWeight > 0 else { return matchScore }

            // Weighted average over the nonzero-weight axes; the weights
            // renormalize to sum to 1 implicitly via the divisor.
            let weighted = contributions.reduce(0) { $0 + $1.weight * $1.score }
            return weighted / totalWeight
        }
    }

    // MARK: - Weight resolution

    /// The resolved per-axis weights, post-init, post-reweight,
    /// post-override. A zeroed axis drops out of the weighted average.
    struct AxisWeights {
        var cuisine: Double
        var reputation: Double
        var vibe: Double
    }

    /// Resolve the final axis weights: equal-weight init with
    /// no-preference zeroing, then the hard-contradiction override
    /// (which zeroes more axes), then the soft re-weight blend over the
    /// axes that survive.
    static func resolveWeights(
        member: Q5MemberProfile,
        q5Ratings: [Q5Rating]
    ) -> AxisWeights {
        // Which axes carry a stated preference at all. An explicit
        // "No preference" is a genuine zero-weight signal.
        var active: Set<Axis> = []
        if !member.cuisines.isEmpty { active.insert(.cuisine) }
        if member.reputation != QuizReputation.noPreference { active.insert(.reputation) }
        // Vibe is always a stated answer (the Q4 scale has no
        // "no preference" stop) — it is always active at init.
        active.insert(.vibe)

        // Hard-contradiction override — demote any axis whose strict
        // two-condition trigger fires. A demoted axis joins the
        // no-preference set: weight zeroed.
        for axis in Axis.allCases where active.contains(axis) {
            if overrideFires(for: axis, q5Ratings: q5Ratings) {
                active.remove(axis)
            }
        }

        // Equal-weight prior over the surviving (active) axes — the
        // no-preference-adjusted prior the blend pulls toward.
        guard !active.isEmpty else {
            return AxisWeights(cuisine: 0, reputation: 0, vibe: 0)
        }
        let priorEach = 1.0 / Double(active.count)
        var prior: [Axis: Double] = [:]
        for axis in active { prior[axis] = priorEach }

        // Soft re-weight — blend the prior toward the Q5-revealed
        // weights. Revealed weights are computed only over the surviving
        // axes (a demoted axis contributes nothing).
        let revealed = revealedWeights(active: active, q5Ratings: q5Ratings)

        var final: [Axis: Double] = [:]
        for axis in active {
            let p = prior[axis] ?? 0
            let r = revealed[axis] ?? 0
            final[axis] = (1 - alpha) * p + alpha * r
        }

        return AxisWeights(
            cuisine: final[.cuisine] ?? 0,
            reputation: final[.reputation] ?? 0,
            vibe: final[.vibe] ?? 0
        )
    }

    /// The Q5-revealed weights for the surviving axes, normalized to sum
    /// to 1. For each axis, `marginal_value = avg(keep-card ratings) -
    /// drop-card rating`, floored at 0. If every marginal value is 0
    /// (all cards rated equal — the degenerate case), the revealed
    /// distribution falls back to the equal prior so the blend leaves
    /// the weights untouched.
    private static func revealedWeights(
        active: Set<Axis>,
        q5Ratings: [Q5Rating]
    ) -> [Axis: Double] {
        var marginal: [Axis: Double] = [:]
        for axis in active {
            marginal[axis] = max(0, marginalValue(for: axis, q5Ratings: q5Ratings))
        }
        let total = marginal.values.reduce(0, +)

        // Degenerate: no axis reveals any weight -> fall back to the
        // equal prior so `w_final` == `w_prior`.
        guard total > 0 else {
            let each = 1.0 / Double(active.count)
            return active.reduce(into: [:]) { $0[$1] = each }
        }
        return marginal.mapValues { $0 / total }
    }

    /// An axis's marginal value: the average of its two keep-card
    /// ratings minus its drop-card rating. A large positive value means
    /// dropping that axis hurt the member's excitement — the axis
    /// matters.
    ///
    /// The keep-cards for an axis are the two factorial cards whose
    /// `droppedAxis` is *not* this axis (each of the other two cards
    /// keeps this axis). The drop-card is the one card that drops it.
    static func marginalValue(for axis: Axis, q5Ratings: [Q5Rating]) -> Double {
        guard let dropScore = dropCardScore(for: axis, q5Ratings: q5Ratings) else {
            return 0
        }
        let keeps = keepCardScores(for: axis, q5Ratings: q5Ratings)
        guard !keeps.isEmpty else { return 0 }
        let avgKeep = Double(keeps.reduce(0, +)) / Double(keeps.count)
        return avgKeep - Double(dropScore)
    }

    // MARK: - Hard-contradiction override

    /// The strict two-condition override trigger for an axis: fires only
    /// when BOTH the axis's keep-cards score strictly below its
    /// drop-card AND the drop-card is rated 4 or 5.
    ///
    /// "Both keep-cards below" — not the averaged margin — rules out a
    /// confound from the keep-cards' differing other-axis deviations; a
    /// single odd rating cannot fire it.
    static func overrideFires(for axis: Axis, q5Ratings: [Q5Rating]) -> Bool {
        guard let dropScore = dropCardScore(for: axis, q5Ratings: q5Ratings) else {
            return false
        }
        guard dropScore >= 4 else { return false }
        let keeps = keepCardScores(for: axis, q5Ratings: q5Ratings)
        // Need both keep-cards present and both strictly below the drop.
        guard keeps.count == 2 else { return false }
        return keeps.allSatisfy { $0 < dropScore }
    }

    // MARK: - Card lookups

    /// The rating of the card that drops `axis` (the one factorial card
    /// whose `droppedAxis` is this axis).
    private static func dropCardScore(
        for axis: Axis,
        q5Ratings: [Q5Rating]
    ) -> Int? {
        q5Ratings.first { $0.droppedAxis == cardAxis(for: axis) }?.score
    }

    /// The ratings of the cards that keep `axis` (the factorial cards
    /// whose `droppedAxis` is some *other* axis — each of them keeps
    /// this axis).
    private static func keepCardScores(
        for axis: Axis,
        q5Ratings: [Q5Rating]
    ) -> [Int] {
        q5Ratings
            .filter { $0.droppedAxis != cardAxis(for: axis) }
            .map { $0.score }
    }

    /// Map a `PreferenceFunction.Axis` to the matching
    /// `Q5FactorialCard.Axis`. The two enums are intentionally separate
    /// — the factorial axis is a tb-08 surface type — so this is the one
    /// crossing point.
    private static func cardAxis(for axis: Axis) -> Q5FactorialCard.Axis {
        switch axis {
        case .cuisine:    return .cuisine
        case .reputation: return .reputation
        case .vibe:       return .vibe
        }
    }
}
