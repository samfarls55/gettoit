// GetToIt — Q5FactorialCardGenerator (TB-08 v1.1, PRD module C).
//
// Pure card-selection logic, no I/O. Given one member's Q1–Q4 answers
// and their fetched candidate pool, the generator picks the three
// strict-factorial Q5 cards the preference probe rates.
//
// The factorial (v1.1-quiz-amendments §3 "Card generation"):
//
//   * Three axes — cuisine, reputation, vibe.
//   * Three cards — each card **drops exactly one distinct axis** and
//     **matches the other two** against the member's stated Q1–Q4
//     profile. Each axis is therefore kept by two cards and dropped by
//     one; the preference function reads an axis's weight by comparing
//     its drop-card rating to its two keep-card ratings.
//   * **Never a 100% match** — every card deviates on exactly one axis,
//     so no card confirms the member's stated profile outright. A
//     perfect-match card teaches the probe nothing.
//
// Axis-profile source. A venue's position on the three axes is a
// `Q5VenueProfile` — cuisine id, reputation bucket, vibe level. Scoring
// a raw Foursquare venue into a profile is the axis scorers' job
// (PRD module E — tb-09); this generator consumes the already-profiled
// pool so the factorial selection logic is pure and unit-testable on
// its own. tb-09 wires the real scorers in front of it.
//
// Member-local cuisine selection. Q1 caps the member at three craved
// cuisines, but the strict factorial supplies only two cuisine
// keep-cards — so Q5 probes at most TWO of the member's cuisines
// (v1.1-quiz-amendments §"Q1 multi-select and the cuisine cap"). Which
// two is a **member-local** rule: the two craved cuisines with the
// best card-generation feasibility in *this member's* pool. Group state
// — other members' votes, the running union — never influences card
// selection; Q5 is a per-member measurement and its stimulus must not
// be curated by the group, or the probe reading is contaminated.
//
// Pool starvation (a thin pool that cannot furnish three valid cards)
// is an explicit PRD "Out of Scope" edge case — the generator surfaces
// it as a `nil` return rather than inventing a placeholder card, since
// Q5 must never show a placeholder. TB-26: a `nil` factorial resolves
// the candidate fetch to the `.noResults` source, and Q5 renders the
// no-results screen (sg-05's `no-results` mode) at the surface
// boundary — the app never surfaces a fictitious venue.

import Foundation

/// A venue's position on the three Q5 factorial axes. Produced by the
/// axis scorers (PRD module E / tb-09) from a raw Foursquare venue;
/// consumed here as the already-classified input so the factorial
/// selection logic stays pure.
public struct Q5VenueProfile: Equatable, Sendable {
    /// The venue's cuisine — a `QuizCuisine` id (e.g. `"mexican"`), or
    /// `nil` when the venue has no classifiable cuisine. A `nil`
    /// cuisine can never match a craved cuisine, and is always a valid
    /// deviation for the cuisine-drop card.
    public let cuisine: String?
    /// The venue's reputation bucket — a `QuizReputation` id
    /// (`popular` / `hidden_gem` / `classic` / `new`). Never
    /// `no_preference`: that is a member answer, not a venue property.
    public let reputation: String
    /// The venue's vibe energy level, 0…4 on the Quiet…Rowdy scale —
    /// the same cardinal scale as Q4 (`GTIVibeLabels`).
    public let vibe: Int

    public init(cuisine: String?, reputation: String, vibe: Int) {
        self.cuisine = cuisine
        self.reputation = reputation
        self.vibe = vibe
    }
}

/// A pool venue paired with its axis profile. The `place` is the real
/// `ShapedPlace` the Q5 card renders; the `profile` is what the
/// factorial selects on.
public struct Q5PoolVenue: Equatable, Sendable, Identifiable {
    public let place: ShapedPlace
    public let profile: Q5VenueProfile

    public var id: String { place.fsqPlaceId }

    public init(place: ShapedPlace, profile: Q5VenueProfile) {
        self.place = place
        self.profile = profile
    }
}

/// The member's stated Q1–Q4 profile — the three axes the factorial
/// deviates against. Cuisine is the (possibly multi-pick) craved set;
/// reputation and vibe are single answers.
public struct Q5MemberProfile: Equatable, Sendable {
    /// Q1 craved cuisines (`QuizCuisine` ids). Empty when the member
    /// answered "No preference".
    public let cuisines: [String]
    /// Q3 reputation answer (`QuizReputation` id). May be
    /// `no_preference`.
    public let reputation: String
    /// Q4 vibe level, 0…4.
    public let vibe: Int

    public init(cuisines: [String], reputation: String, vibe: Int) {
        self.cuisines = cuisines
        self.reputation = reputation
        self.vibe = vibe
    }
}

/// One generated Q5 card: the venue the member rates, plus which axis
/// this card drops (deviates on). `droppedAxis` is carried for the
/// preference function (tb-09) — it reads an axis's weight from the
/// drop-card vs keep-card ratings — and lets the unit tests assert the
/// strict-factorial structure.
public struct Q5FactorialCard: Equatable, Sendable, Identifiable {
    /// The factorial axis a card deviates on. Each generated triple has
    /// exactly one card per axis.
    public enum Axis: String, Equatable, Sendable, CaseIterable {
        case cuisine
        case reputation
        case vibe
    }

    public let venue: Q5PoolVenue
    /// The single axis this card deviates from the member's stated
    /// profile on. The other two axes match.
    public let droppedAxis: Axis

    public var id: String { venue.id }

    public init(venue: Q5PoolVenue, droppedAxis: Axis) {
        self.venue = venue
        self.droppedAxis = droppedAxis
    }
}

public enum Q5FactorialCardGenerator {

    /// The number of Q5 cards. Locked at 3 by the strict factorial —
    /// one card per axis (`Axis.allCases.count`).
    public static let cardCount = Q5FactorialCard.Axis.allCases.count

    /// Generate the three strict-factorial Q5 cards for one member.
    ///
    /// - Parameters:
    ///   - member: the member's stated Q1–Q4 profile.
    ///   - pool: the member's fetched, axis-profiled candidate pool.
    /// - Returns: exactly three cards — one cuisine-drop, one
    ///   reputation-drop, one vibe-drop — each a distinct venue, or
    ///   `nil` when the pool cannot furnish a valid factorial triple
    ///   (the PRD's out-of-scope pool-starvation case). The generator
    ///   never invents a placeholder venue.
    ///
    /// Determinism: the result is a pure function of `member` and the
    /// order of `pool`. No clock, no randomness, no group state.
    public static func generate(
        member: Q5MemberProfile,
        pool: [Q5PoolVenue]
    ) -> [Q5FactorialCard]? {
        // The two cuisines Q5 probes — the member-local feasibility
        // pick. The keep-cards (reputation-drop, vibe-drop) match a
        // craved cuisine; the drop-card deviates from every craved
        // cuisine.
        let probedCuisines = selectProbedCuisines(member: member, pool: pool)

        // Each card matches the axes it does NOT drop. The two
        // cuisine-keeping cards (reputation-drop, vibe-drop) each pin a
        // distinct probed cuisine so the factorial probes two cuisines;
        // when only one cuisine is feasible both keep-cards share it
        // (still a valid factorial — the cuisine axis is just probed
        // once).
        let cuisineForReputationDrop = probedCuisines.first
        let cuisineForVibeDrop = probedCuisines.count > 1
            ? probedCuisines[1]
            : probedCuisines.first

        var used = Set<String>()

        // Card 1 — cuisine-drop. Deviates on cuisine, matches
        // reputation + vibe.
        guard let cuisineDrop = pickVenue(
            from: pool,
            excluding: used,
            cuisineRule: .deviateFromAll(member.cuisines),
            reputationRule: .match(member.reputation),
            vibeRule: .match(member.vibe)
        ) else { return nil }
        used.insert(cuisineDrop.id)

        // Card 2 — reputation-drop. Deviates on reputation, matches
        // cuisine + vibe.
        guard let reputationDrop = pickVenue(
            from: pool,
            excluding: used,
            cuisineRule: .match(cuisineForReputationDrop),
            reputationRule: .deviateFrom(member.reputation),
            vibeRule: .match(member.vibe)
        ) else { return nil }
        used.insert(reputationDrop.id)

        // Card 3 — vibe-drop. Deviates on vibe, matches cuisine +
        // reputation.
        guard let vibeDrop = pickVenue(
            from: pool,
            excluding: used,
            cuisineRule: .match(cuisineForVibeDrop),
            reputationRule: .match(member.reputation),
            vibeRule: .deviateFrom(member.vibe)
        ) else { return nil }
        used.insert(vibeDrop.id)

        return [
            Q5FactorialCard(venue: cuisineDrop, droppedAxis: .cuisine),
            Q5FactorialCard(venue: reputationDrop, droppedAxis: .reputation),
            Q5FactorialCard(venue: vibeDrop, droppedAxis: .vibe),
        ]
    }

    // MARK: - Member-local cuisine selection

    /// Pick the (up to two) craved cuisines Q5 probes, by member-local
    /// pool feasibility. Feasibility = how many pool venues actually
    /// carry that cuisine; a cuisine with venues to spare furnishes its
    /// keep-cards reliably. Ties break on the member's Q1 pick order
    /// (stable), so the choice is deterministic and never depends on
    /// group state.
    ///
    /// Returns an empty array when the member answered "No preference"
    /// on Q1 — in that case the keep-cards match `nil` (any cuisine is
    /// fine), which `pickVenue` treats as an always-satisfied rule.
    static func selectProbedCuisines(
        member: Q5MemberProfile,
        pool: [Q5PoolVenue]
    ) -> [String] {
        guard !member.cuisines.isEmpty else { return [] }

        // Count pool support per craved cuisine.
        var support: [String: Int] = [:]
        for cuisine in member.cuisines { support[cuisine] = 0 }
        for venue in pool {
            if let cuisine = venue.profile.cuisine, support[cuisine] != nil {
                support[cuisine, default: 0] += 1
            }
        }

        // Rank by feasibility (descending), ties broken by the member's
        // Q1 pick order — `enumerated` index makes the sort stable.
        let ranked = member.cuisines.enumerated().sorted { lhs, rhs in
            let lSupport = support[lhs.element, default: 0]
            let rSupport = support[rhs.element, default: 0]
            if lSupport != rSupport { return lSupport > rSupport }
            return lhs.offset < rhs.offset
        }

        // Q5 probes at most two cuisines (only two cuisine keep-cards).
        return ranked.prefix(2).map { $0.element }
    }

    // MARK: - Per-axis venue picking

    /// How a card constrains one axis.
    private enum CuisineRule {
        /// Match this cuisine. `nil` means "any cuisine is fine" (the
        /// member's Q1 "No preference", or only one probed cuisine).
        case match(String?)
        /// Deviate from every cuisine in this set — the cuisine-drop
        /// card. An empty set (member no-prefed Q1) makes deviation
        /// impossible, so the cuisine-drop card needs the pool to carry
        /// a venue with a cuisine the member never craved; with an
        /// empty craved set every venue satisfies "deviates from all".
        case deviateFromAll([String])
    }

    private enum ValueRule {
        case match(Int)
        case deviateFrom(Int)
    }

    private enum ReputationRule {
        case match(String)
        case deviateFrom(String)
    }

    /// First pool venue (in pool order — deterministic) satisfying all
    /// three axis rules and not already used by an earlier card.
    private static func pickVenue(
        from pool: [Q5PoolVenue],
        excluding used: Set<String>,
        cuisineRule: CuisineRule,
        reputationRule: ReputationRule,
        vibeRule: ValueRule
    ) -> Q5PoolVenue? {
        pool.first { venue in
            guard !used.contains(venue.id) else { return false }
            guard cuisineSatisfies(cuisineRule, venue.profile.cuisine) else { return false }
            guard reputationSatisfies(reputationRule, venue.profile.reputation) else { return false }
            guard vibeSatisfies(vibeRule, venue.profile.vibe) else { return false }
            return true
        }
    }

    private static func cuisineSatisfies(_ rule: CuisineRule, _ cuisine: String?) -> Bool {
        switch rule {
        case .match(let target):
            // `nil` target — any cuisine (incl. an unclassified venue)
            // is fine. A concrete target must match exactly.
            guard let target else { return true }
            return cuisine == target
        case .deviateFromAll(let craved):
            // The venue's cuisine must NOT be one the member craved. An
            // unclassified (`nil`) venue trivially deviates.
            guard let cuisine else { return true }
            return !craved.contains(cuisine)
        }
    }

    private static func reputationSatisfies(_ rule: ReputationRule, _ reputation: String) -> Bool {
        switch rule {
        case .match(let target):
            // A member who answered "No preference" on reputation has
            // no stated position to match — any reputation satisfies a
            // keep-card.
            guard target != QuizReputation.noPreference else { return true }
            return reputation == target
        case .deviateFrom(let target):
            // "No preference" cannot be deviated from — there is no
            // stated position. The reputation-drop card then accepts
            // any venue (the axis carries no probe signal, the
            // degenerate-axis case the amendments doc flags as
            // acceptable).
            guard target != QuizReputation.noPreference else { return true }
            return reputation != target
        }
    }

    private static func vibeSatisfies(_ rule: ValueRule, _ vibe: Int) -> Bool {
        switch rule {
        case .match(let target):
            return vibe == target
        case .deviateFrom(let target):
            return vibe != target
        }
    }
}

// MARK: - Q5 surface bridge

public extension Q5FactorialCardGenerator {
    /// Shape the three factorial cards into the `[QuizCandidate]` list
    /// the Q5 surface (`QuizQ5Regret`) renders. The factorial selects
    /// *which* real venues the member rates; `QuizCandidate` is the
    /// view shape — id, name, dot-delimited meta — Q5 already consumes.
    ///
    /// The meta string reuses `Q5CandidatesLoader.metaString`, so a
    /// factorial card and a plain loader card format identically. The
    /// `QuizCandidate.id` stays the venue's `fsq_place_id` so the
    /// `votes.q5` jsonb slot keys ratings on real venue ids — the bug-03
    /// "no placeholder venues" guarantee carried through to the write.
    ///
    /// TB-24: each shaped candidate carries its card's `droppedAxis` so
    /// the vote write can emit `votes.q5.answer.ratings` as the factorial
    /// `[{ droppedAxis, score }]` array the `compute-verdict` preference
    /// re-weight reads.
    static func quizCandidates(from cards: [Q5FactorialCard]) -> [QuizCandidate] {
        cards.map { card in
            QuizCandidate(
                id: card.venue.place.fsqPlaceId,
                name: card.venue.place.name,
                meta: Q5CandidatesLoader.metaString(for: card.venue.place),
                droppedAxis: card.droppedAxis
            )
        }
    }
}
