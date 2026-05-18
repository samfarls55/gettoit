// GetToIt — Q5VenueClassifier (TB-16 v1.1, PRD module E live wiring).
//
// The `ShapedPlace -> Q5VenueProfile` axis classification that tb-09
// deferred. tb-09 shipped the *scorers* — `Q5VenueProfile -> 1…5` —
// but explicitly left the *classifier* (`ShapedPlace -> Q5VenueProfile`)
// out of scope because it needs Foursquare response fields the
// `ShapedPlace` of the day did not carry. TB-16 carries those fields
// (`rating`, `totalRatings`, `dateCreated` — see `PlacesService.swift`)
// and adds this classifier so the live `Q5FactorialCardGenerator` has a
// profiled pool to select from.
//
// The classifier turns a real fetched venue into its position on the
// three Q5 factorial axes:
//
//   * **Cuisine** — set membership over `categories[]`. A venue's
//     `categories` are human-readable Foursquare category names
//     (e.g. "Mexican Restaurant", "Thai Restaurant"). The classifier
//     matches them against the `QuizCuisine` vocabulary by keyword;
//     a venue whose categories match no known cuisine classifies as
//     `nil` (an unclassified cuisine — a valid cuisine-drop deviation).
//
//   * **Vibe** — a category-archetype baseline table, 0…4 on the
//     Quiet…Rowdy scale, with a curated `tastes`-token nudge as the
//     secondary signal and `priceTier` as a last-resort tie-break.
//     Most of the vibe signal lives in the category archetype (a
//     cocktail bar is reliably high-energy, a tea house reliably low);
//     TB-18 adds a bounded ±1 nudge from Foursquare's crowd-sourced
//     `tastes` tag cloud — matched against the research-02 curated
//     vibe-token allowlist — so two same-category venues can differ.
//     `priceTier` drops to last-resort: it fires only on an unmatched
//     archetype where `tastes` contributed nothing. `tastes` and price
//     are mutually exclusive, so drift from the baseline is ≤ ±1.
//
//   * **Reputation** — a pool-relative bucketing over `totalRatings`
//     (volume), `rating` (quality), and `dateCreated` (age), per
//     research §4. "Pool-relative" is load-bearing: a dense metro and
//     a quiet suburb have wildly different absolute rating counts, so
//     the volume terciles are computed *within the fetched pool*, not
//     against a global constant. Bucketing the whole pool at once is
//     why classification is a pool-level call (`classify(pool:)`), not
//     a per-venue one.
//
// Purity. No I/O, no clock, no randomness, no group state. `classify`
// is a deterministic pure function of the pool it is handed. The
// `dateCreated` age check needs a reference "now"; it is an injected
// parameter (defaulting to `Date()`) so tests stay deterministic.
//
// Cohort-zero thresholds (the `rating` floors, the tercile split, the
// New/Classic age cutoffs) are tunable post-cohort, exactly as
// research §4 and the tb-09 scorer constants are. They are gathered as
// named constants below.

import Foundation

public enum Q5VenueClassifier {

    // MARK: - Cohort-zero thresholds (tunable post-cohort — research §4)

    /// A venue is "well-rated enough to be Popular" at or above this
    /// `rating` (Foursquare's 0…10 scale).
    static let popularRatingFloor: Double = 7.0
    /// A venue is "excellent enough to be a Hidden gem" at or above
    /// this `rating` — a higher bar than Popular: a hidden gem is
    /// few-but-strong ratings.
    static let hiddenGemRatingFloor: Double = 8.0
    /// A venue whose Foursquare record is younger than this many days
    /// classifies as `new` — age dominates that bucket (research §4:
    /// "within ~12 months").
    static let newRecordMaxAgeDays: Double = 365
    /// A high-volume venue whose record is older than this many days
    /// classifies as `classic` rather than `popular` — age is the
    /// discriminator between the two high-volume buckets (research §4:
    /// "older than ~3 years").
    static let classicRecordMinAgeDays: Double = 365 * 3

    // MARK: - Pool classification

    /// Classify a fetched venue pool into `Q5PoolVenue`s — each real
    /// `ShapedPlace` paired with its three-axis `Q5VenueProfile`.
    ///
    /// Reputation is pool-relative, so the whole pool is classified in
    /// one call: the volume terciles are derived from this pool's
    /// `totalRatings` spread. Cuisine and vibe are per-venue and would
    /// classify identically venue-by-venue, but they ride along here so
    /// callers have a single classification entry point.
    ///
    /// - Parameters:
    ///   - pool: the deduped fetched venue pool (the
    ///     `FoursquareFetchExecutor` union).
    ///   - now: the reference instant the `dateCreated` age check reads.
    ///     Injected so tests are deterministic; defaults to `Date()`.
    /// - Returns: one `Q5PoolVenue` per input place, in input order.
    public static func classify(
        pool: [ShapedPlace],
        now: Date = Date()
    ) -> [Q5PoolVenue] {
        // Volume terciles for the reputation axis — pool-relative.
        let volumeSplit = volumeTerciles(in: pool)
        return pool.map { place in
            Q5PoolVenue(
                place: place,
                profile: Q5VenueProfile(
                    cuisine: cuisine(of: place),
                    reputation: reputation(of: place, volumeSplit: volumeSplit, now: now),
                    vibe: vibe(of: place)
                )
            )
        }
    }

    // MARK: - Cuisine axis

    /// Keyword fragments that identify each `QuizCuisine` inside a
    /// Foursquare category name. Matching is case-insensitive substring.
    /// Order is irrelevant — the first cuisine with any matching
    /// fragment wins, and the `QuizCuisine.displayOrder` iteration makes
    /// that deterministic.
    static let cuisineKeywords: [(cuisine: String, fragments: [String])] = [
        (QuizCuisine.mexican,       ["mexican", "taqueria", "taco", "burrito"]),
        (QuizCuisine.italian,       ["italian", "pizza", "pizzeria", "trattoria", "pasta"]),
        (QuizCuisine.japanese,      ["japanese", "sushi", "ramen", "izakaya", "soba", "udon"]),
        (QuizCuisine.chinese,       ["chinese", "dim sum", "szechuan", "sichuan", "cantonese", "noodle"]),
        (QuizCuisine.thai,          ["thai"]),
        (QuizCuisine.indian,        ["indian", "curry", "tandoor"]),
        (QuizCuisine.american,      ["american", "burger", "diner", "steakhouse", "bbq", "barbecue"]),
        (QuizCuisine.mediterranean, ["mediterranean", "greek", "falafel", "kebab", "shawarma", "lebanese"]),
    ]

    /// The venue's cuisine — a `QuizCuisine` id — derived from its
    /// `categories[]` names, or `nil` when no category matches a known
    /// cuisine. A `nil` cuisine is a valid cuisine-drop deviation.
    static func cuisine(of place: ShapedPlace) -> String? {
        let haystack = place.categories.map { $0.lowercased() }
        for entry in cuisineKeywords {
            for fragment in entry.fragments {
                if haystack.contains(where: { $0.contains(fragment) }) {
                    return entry.cuisine
                }
            }
        }
        return nil
    }

    // MARK: - Vibe axis

    /// Category-archetype keyword → baseline vibe (0…4 on the
    /// Quiet…Rowdy scale). research §5: the category carries most of
    /// the vibe signal. Scanned in order; the first matching archetype
    /// wins, so the more specific / higher-energy archetypes are listed
    /// before the generic mid-energy ones.
    static let vibeArchetypes: [(fragments: [String], baseline: Int)] = [
        // Rowdy (4) — nightlife-forward.
        (["nightclub", "night club", "sports bar", "dance"], 4),
        // Lively (3) — bar-forward, social-drinking energy.
        (["bar", "pub", "gastropub", "brewery", "taproom", "wine bar", "cocktail"], 3),
        // Quiet (0) — calm, low-energy.
        (["tea", "tea house", "tearoom", "library cafe"], 0),
        // Chill (1) — relaxed daytime.
        (["cafe", "café", "coffee", "bakery", "bistro", "creperie"], 1),
        // Social (2) — the default sit-down restaurant energy. Listed
        // last so a more specific archetype above always wins.
        (["restaurant", "diner", "eatery", "grill", "kitchen"], 2),
    ]

    /// The baseline vibe with no category match — the mid-scale Social
    /// level. research §5 treats an unknown category as the neutral
    /// middle, not as quiet.
    static let defaultVibeBaseline: Int = 2

    /// Curated Foursquare `tastes` vibe-token allowlist — transcribed
    /// verbatim from the research-02 deliverable
    /// (`gti-vault/60_engineering/research/foursquare-tastes-vibe-2026-05/`
    /// `data/vibe-token-allowlist.json`). Each token is direction-only:
    /// `+1` loud-leaning, `-1` quiet-leaning, no magnitude. Tokens are
    /// lower-cased; allowlist matching is case-insensitive. A venue's
    /// matched-token tags are summed and the *sign* of the sum is the
    /// nudge (`-1` / `0` / `+1`) — see `tastesNudge(for:)`.
    ///
    /// research-02 measured `tastes` coverage at 66.8% of sampled
    /// venues (the issue's earlier ~76% estimate was corrected by the
    /// live sample); the ~33% with no `tastes` net a zero nudge and
    /// classify exactly as TB-16 did.
    static let vibeTokenAllowlist: [String: Int] = [
        // Loud-leaning (+1).
        "crowded": 1,
        "trendy": 1,
        "good for groups": 1,
        "happy hour": 1,
        "good for singles": 1,
        "hipster": 1,
        "people watching": 1,
        "dancing": 1,
        "live music": 1,
        "lively": 1,
        "loud": 1,
        "fun atmosphere": 1,
        "nightclubs": 1,
        "night clubs": 1,
        "festive atmosphere": 1,
        "noisy": 1,
        // Quiet-leaning (-1).
        "spacious": -1,
        "good for dates": -1,
        "comfortable": -1,
        "quiet": -1,
        "good for working": -1,
        "good for business meetings": -1,
        "comfortable seats": -1,
        "cozy": -1,
        "cosy atmosphere": -1,
        "study area": -1,
        "romantic": -1,
        "business meetings": -1,
        "quaint atmosphere": -1,
        "pleasant atmosphere": -1,
    ]

    /// The `tastes` nudge for a venue — `-1`, `0`, or `+1`. Sums the
    /// direction tags of the venue's `tastes` tokens that appear in the
    /// `vibeTokenAllowlist`, then returns the *sign* of that sum.
    /// Direction-only: magnitude is intentionally discarded so a venue
    /// with five loud tokens nudges the same one step as a venue with
    /// one. A balanced or conflicting venue (and a venue with no
    /// matching tokens) nets `0` → no nudge. Folksonomy noise that is
    /// not in the allowlist contributes nothing.
    static func tastesNudge(for place: ShapedPlace) -> Int {
        let sum = place.tastes.reduce(0) { acc, token in
            acc + (vibeTokenAllowlist[token.lowercased()] ?? 0)
        }
        if sum > 0 { return 1 }
        if sum < 0 { return -1 }
        return 0
    }

    /// The venue's vibe level, 0…4. The category archetype is the
    /// baseline; a curated `tastes`-token nudge is the secondary
    /// signal; `priceTier` is the last-resort tie-break.
    ///
    /// Precedence (locked TB-18, grill-with-docs 2026-05-18):
    ///   1. Category-archetype baseline (0…4) — the TB-16 table.
    ///   2. `tastes` nudge (±1, the sign of the summed allowlist-token
    ///      tags) — applies whether or not an archetype matched, so it
    ///      splits two same-category venues.
    ///   3. Else `priceTier` tie-break (±1, unmatched archetype only) —
    ///      the TB-16 behaviour, demoted to last-resort: it fires only
    ///      when `tastes` contributed nothing.
    ///   4. Clamp to 0…4.
    ///
    /// `tastes` and `priceTier` are mutually exclusive, so total drift
    /// from the baseline is always ≤ ±1.
    static func vibe(of place: ShapedPlace) -> Int {
        let haystack = place.categories.map { $0.lowercased() }
        var baseline = defaultVibeBaseline
        var matched = false
        for archetype in vibeArchetypes {
            if archetype.fragments.contains(where: { fragment in
                haystack.contains { $0.contains(fragment) }
            }) {
                baseline = archetype.baseline
                matched = true
                break
            }
        }

        // `tastes` nudge — the secondary signal. Applies whether or not
        // an archetype matched (a nudge on a matched archetype is the
        // point — it splits two same-category venues).
        let nudge = tastesNudge(for: place)
        if nudge != 0 {
            return clampVibe(baseline + nudge)
        }

        // Price tie-break — last-resort, and only when `tastes`
        // contributed nothing. Still gated on an *ambiguous* (unmatched-
        // archetype) score, and still at most one step, so price never
        // overrides the category signal. tier 1 (cheap) nudges louder,
        // tier 4 (expensive) nudges quieter.
        if !matched, let tier = place.priceTier {
            if tier <= 1 { baseline += 1 }
            else if tier >= 4 { baseline -= 1 }
        }

        return clampVibe(baseline)
    }

    /// Clamp a vibe value into the valid 0…4 range.
    private static func clampVibe(_ value: Int) -> Int {
        min(max(value, 0), GTIVibeLabels.all.count - 1)
    }

    // MARK: - Reputation axis

    /// The pool-relative volume split — the `totalRatings` cutoffs that
    /// separate the bottom / middle / top tercile of the fetched pool.
    struct VolumeTerciles: Equatable {
        /// At or below this `totalRatings` a venue is bottom-tercile
        /// (low volume — the Hidden gem candidate band).
        let lowCeiling: Int
        /// At or above this `totalRatings` a venue is top-tercile
        /// (high volume — the Popular / Classic candidate band).
        let highFloor: Int
    }

    /// Compute the pool-relative volume terciles from the pool's
    /// `totalRatings` values. Venues with no `totalRatings` are treated
    /// as zero-volume — an unrated venue is genuinely low-footfall.
    static func volumeTerciles(in pool: [ShapedPlace]) -> VolumeTerciles {
        let volumes = pool.map { $0.totalRatings ?? 0 }.sorted()
        guard !volumes.isEmpty else {
            return VolumeTerciles(lowCeiling: 0, highFloor: Int.max)
        }
        // Tercile boundaries by index — the value at the 1/3 and 2/3
        // marks. With a tiny pool the two marks can coincide; that is
        // fine, the buckets just compress.
        let lowIndex = max(0, (volumes.count - 1) / 3)
        let highIndex = min(volumes.count - 1, (volumes.count - 1) * 2 / 3)
        return VolumeTerciles(
            lowCeiling: volumes[lowIndex],
            highFloor: volumes[highIndex]
        )
    }

    /// The venue's reputation bucket — a `QuizReputation` id, never
    /// `no_preference` (that is a member answer, not a venue property).
    ///
    /// The decision order (research §4) — age first, then volume×quality:
    ///   * a record younger than `newRecordMaxAgeDays` is `new`;
    ///   * a high-volume, old record is `classic`;
    ///   * a high-volume, well-rated record is `popular`;
    ///   * a low-volume, excellently-rated record is `hidden_gem`;
    ///   * everything else falls back to `popular` — the neutral,
    ///     most-common bucket (a venue with no reputation signal is, by
    ///     default, an ordinary known place).
    static func reputation(
        of place: ShapedPlace,
        volumeSplit: VolumeTerciles,
        now: Date
    ) -> String {
        let ageDays = recordAgeDays(of: place, now: now)
        let volume = place.totalRatings ?? 0
        let rating = place.rating

        // New — age dominates, regardless of volume.
        if let ageDays, ageDays <= newRecordMaxAgeDays {
            return QuizReputation.new
        }

        let isHighVolume = volume >= volumeSplit.highFloor && volumeSplit.highFloor > 0
        let isLowVolume = volume <= volumeSplit.lowCeiling

        // Classic — high volume + an old record.
        if isHighVolume, let ageDays, ageDays >= classicRecordMinAgeDays {
            return QuizReputation.classic
        }
        // Popular — high volume + well-rated.
        if isHighVolume, let rating, rating >= popularRatingFloor {
            return QuizReputation.popular
        }
        // Hidden gem — low volume + an excellent rating.
        if isLowVolume, let rating, rating >= hiddenGemRatingFloor {
            return QuizReputation.hiddenGem
        }
        // No discriminating signal — the neutral, ordinary bucket.
        return QuizReputation.popular
    }

    /// The age of the venue's Foursquare record in days, or `nil` when
    /// `dateCreated` is absent or unparseable. ISO-8601 date or
    /// date-time are both accepted.
    static func recordAgeDays(of place: ShapedPlace, now: Date) -> Double? {
        guard let raw = place.dateCreated, !raw.isEmpty else { return nil }
        guard let created = parseISODate(raw) else { return nil }
        let seconds = now.timeIntervalSince(created)
        guard seconds >= 0 else { return 0 }
        return seconds / 86_400
    }

    /// Parse an ISO-8601 date (`2024-01-15`) or date-time
    /// (`2024-01-15T00:00:00Z`) string. Foursquare's `date_created` is
    /// a plain date; the date-time path is a tolerance for any future
    /// schema shift.
    private static func parseISODate(_ raw: String) -> Date? {
        let isoFormatter = ISO8601DateFormatter()
        if let date = isoFormatter.date(from: raw) { return date }
        let dateOnly = DateFormatter()
        dateOnly.locale = Locale(identifier: "en_US_POSIX")
        dateOnly.timeZone = TimeZone(identifier: "UTC")
        dateOnly.dateFormat = "yyyy-MM-dd"
        return dateOnly.date(from: raw)
    }
}
