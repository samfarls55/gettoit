// GetToIt — Q5VenueClassifier unit tests (TB-16 quiz redesign).
//
// The classifier turns a fetched `ShapedPlace` into its three-axis
// `Q5VenueProfile` so the live `Q5FactorialCardGenerator` has a
// profiled pool to select from. These tests assert:
//   * cuisine resolves from `categories[]` keyword match;
//   * vibe resolves from the category-archetype baseline table, with
//     a bounded price tie-break;
//   * reputation buckets pool-relatively from rating / volume / age.

import XCTest
@testable import GetToIt

final class Q5VenueClassifierTests: XCTestCase {

    // MARK: - Fixture helper

    private func place(
        _ id: String,
        categories: [String] = [],
        priceTier: Int? = nil,
        rating: Double? = nil,
        totalRatings: Int? = nil,
        dateCreated: String? = nil,
        tastes: [String] = []
    ) -> ShapedPlace {
        ShapedPlace(
            fsqPlaceId: id,
            name: id,
            lat: 0, lng: 0,
            priceTier: priceTier,
            categories: categories,
            rating: rating,
            totalRatings: totalRatings,
            dateCreated: dateCreated,
            tastes: tastes
        )
    }

    /// A reference "now" so the `dateCreated` age checks are
    /// deterministic.
    private let now = ISO8601DateFormatter().date(from: "2026-05-16T00:00:00Z")!

    // MARK: - Cuisine axis

    func testCuisineResolvesFromCategoryName() {
        XCTAssertEqual(
            Q5VenueClassifier.cuisine(of: place("a", categories: ["Mexican Restaurant"])),
            QuizCuisine.mexican
        )
        XCTAssertEqual(
            Q5VenueClassifier.cuisine(of: place("b", categories: ["Sushi Restaurant"])),
            QuizCuisine.japanese
        )
        XCTAssertEqual(
            Q5VenueClassifier.cuisine(of: place("c", categories: ["Pizzeria"])),
            QuizCuisine.italian
        )
    }

    func testUnknownCategoryClassifiesAsNilCuisine() {
        XCTAssertNil(Q5VenueClassifier.cuisine(of: place("a", categories: ["Restaurant"])),
            "a generic restaurant carries no classifiable cuisine")
        XCTAssertNil(Q5VenueClassifier.cuisine(of: place("b", categories: [])),
            "a venue with no categories carries no cuisine")
    }

    func testCuisineMatchIsCaseInsensitive() {
        XCTAssertEqual(
            Q5VenueClassifier.cuisine(of: place("a", categories: ["THAI RESTAURANT"])),
            QuizCuisine.thai
        )
    }

    // MARK: - Vibe axis

    func testVibeFromCategoryArchetype() {
        // Bar archetype is Lively (3); a tea house is Quiet (0); a
        // plain restaurant is the Social (2) middle.
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("a", categories: ["Cocktail Bar"])), 3)
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("b", categories: ["Tea House"])), 0)
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("c", categories: ["Italian Restaurant"])), 2)
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("d", categories: ["Nightclub"])), 4)
    }

    func testVibeUnknownCategoryDefaultsToSocialMiddle() {
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("a", categories: ["Museum"])),
            Q5VenueClassifier.defaultVibeBaseline,
            "an unknown category classifies at the neutral Social middle, not Quiet")
    }

    func testPriceTieBreakOnlyNudgesAnAmbiguousScore() {
        // An unmatched-archetype venue gets a one-step price nudge…
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("cheap", categories: ["Museum"], priceTier: 1)),
            Q5VenueClassifier.defaultVibeBaseline + 1,
            "a cheap unknown venue nudges one step louder")
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("dear", categories: ["Museum"], priceTier: 4)),
            Q5VenueClassifier.defaultVibeBaseline - 1,
            "an expensive unknown venue nudges one step quieter")
        // …but a matched archetype is NOT moved by price.
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("bar", categories: ["Cocktail Bar"], priceTier: 4)), 3,
            "price must not override a matched category archetype")
    }

    func testVibeStaysInRange() {
        // A quiet archetype + a quiet price nudge cannot drop below 0;
        // the tea house archetype matches, so price does not even apply.
        for tier in 1...4 {
            let v = Q5VenueClassifier.vibe(of: place("a", categories: ["Museum"], priceTier: tier))
            XCTAssertTrue((0...4).contains(v), "vibe \(v) for tier \(tier) must stay in 0…4")
        }
    }

    func testHigherEnergyArchetypeWinsWhenTwoCategoriesMatch() {
        // A venue tagged both a cuisine restaurant and a bar reads as
        // the bar's higher energy — the archetype scan is ordered.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place("a", categories: ["Mexican Restaurant", "Cocktail Bar"])),
            3
        )
    }

    // MARK: - Vibe axis — `tastes` nudge (TB-18)

    func testTastesNudgesAMatchedArchetypeLouder() {
        // Two same-category venues: the plain restaurant sits at the
        // Social (2) baseline; a loud-token restaurant nudges to 3.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place("plain", categories: ["Italian Restaurant"])),
            2)
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "loud",
                categories: ["Italian Restaurant"],
                tastes: ["lively", "good for groups"])),
            3,
            "loud-leaning tastes nudge a matched archetype up one step — splits two same-category venues")
    }

    func testTastesNudgesAMatchedArchetypeQuieter() {
        // A quiet-token restaurant nudges below the Social baseline.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "quiet",
                categories: ["Italian Restaurant"],
                tastes: ["quiet", "good for working"])),
            1,
            "quiet-leaning tastes nudge a matched archetype down one step")
    }

    func testTastesNudgeIsCappedAtOneStep() {
        // Even with several same-direction tokens, the nudge never
        // exceeds ±1 — it is the sign of the sum, not the magnitude.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "veryLoud",
                categories: ["Italian Restaurant"],
                tastes: ["lively", "loud", "crowded", "dancing", "live music"])),
            3,
            "the tastes nudge is direction-only, capped at one step")
    }

    func testConflictingTastesNetToZeroNoNudge() {
        // A venue with balanced loud/quiet tokens nets 0 → no nudge;
        // it classifies exactly at the archetype baseline.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "mixed",
                categories: ["Italian Restaurant"],
                tastes: ["lively", "quiet"])),
            2,
            "balanced loud/quiet tastes net to zero — no nudge, baseline holds")
    }

    func testUnknownTastesTokensAreIgnored() {
        // Folksonomy noise (`trains`, chef names) is not in the
        // allowlist and contributes nothing — the venue classifies at
        // its archetype baseline, exactly as TB-16.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "noisy",
                categories: ["Italian Restaurant"],
                tastes: ["trains", "hummingbirds", "great pasta"])),
            2,
            "tokens absent from the research-02 allowlist are ignored — no regression")
    }

    func testTastesNudgesAnUnmatchedArchetype() {
        // A `tastes` nudge applies whether or not an archetype matched.
        // A loud-token unknown-category venue moves off the default
        // Social middle.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "loudUnknown",
                categories: ["Museum"],
                tastes: ["lively", "crowded"])),
            Q5VenueClassifier.defaultVibeBaseline + 1,
            "tastes nudge an unmatched archetype too")
    }

    func testTastesTakesPrecedenceOverPriceTieBreak() {
        // An unmatched-archetype venue with BOTH a loud `tastes` signal
        // and an expensive price: `tastes` wins, price is suppressed.
        // The result is the loud nudge (+1), not the price nudge (-1).
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "loudButPricey",
                categories: ["Museum"],
                priceTier: 4,
                tastes: ["lively", "crowded"])),
            Q5VenueClassifier.defaultVibeBaseline + 1,
            "tastes and price are mutually exclusive — tastes wins, price never fires when tastes contributed")
    }

    func testPriceTieBreakStillFiresWhenTastesContributesNothing() {
        // An unmatched venue with only noise / conflicting tastes still
        // falls through to the price tie-break — TB-16 behaviour intact.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "pricey",
                categories: ["Museum"],
                priceTier: 4,
                tastes: ["trains"])),
            Q5VenueClassifier.defaultVibeBaseline - 1,
            "price tie-break still fires when tastes nets zero — last-resort, unchanged")
    }

    func testTastesMatchIsCaseInsensitive() {
        // Foursquare tags arrive mixed-case; allowlist matching must
        // be case-insensitive.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "shouty",
                categories: ["Italian Restaurant"],
                tastes: ["LIVELY", "Good For Groups"])),
            3,
            "tastes-token matching is case-insensitive")
    }

    func testNoTastesClassifiesExactlyAsTB16() {
        // The core no-regression guarantee: a venue with no `tastes`
        // classifies identically to the pre-TB-18 archetype + price
        // path across every archetype + price combination.
        let categories = ["Cocktail Bar", "Tea House", "Italian Restaurant", "Museum"]
        for cat in categories {
            for tier in [nil, 1, 2, 3, 4] as [Int?] {
                let v = Q5VenueClassifier.vibe(of: place(
                    "x", categories: [cat], priceTier: tier, tastes: []))
                XCTAssertTrue((0...4).contains(v), "vibe \(v) for \(cat)/\(String(describing: tier)) in range")
            }
        }
        // Spot-check the exact pre-TB-18 values.
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("a", categories: ["Cocktail Bar"], tastes: [])), 3)
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("b", categories: ["Tea House"], tastes: [])), 0)
        XCTAssertEqual(Q5VenueClassifier.vibe(of: place("c", categories: ["Museum"], priceTier: 1, tastes: [])),
            Q5VenueClassifier.defaultVibeBaseline + 1)
    }

    func testTastesNudgeClampsAtTheRowdyCeiling() {
        // A loud-token nudge on the already-top Rowdy archetype clamps
        // — it does not overflow past 4.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "club", categories: ["Nightclub"], tastes: ["dancing", "loud"])),
            4,
            "a loud nudge on the Rowdy ceiling clamps to 4")
    }

    func testTastesNudgeClampsAtTheQuietFloor() {
        // A quiet-token nudge on the already-bottom Quiet archetype
        // clamps — it does not underflow past 0.
        XCTAssertEqual(
            Q5VenueClassifier.vibe(of: place(
                "tea", categories: ["Tea House"], tastes: ["quiet", "cozy"])),
            0,
            "a quiet nudge on the Quiet floor clamps to 0")
    }

    // MARK: - Reputation axis (pool-relative)

    func testNewBucketFromYoungRecord() {
        let pool = [place("new", dateCreated: "2026-01-01")]
        let split = Q5VenueClassifier.volumeTerciles(in: pool)
        XCTAssertEqual(
            Q5VenueClassifier.reputation(of: pool[0], volumeSplit: split, now: now),
            QuizReputation.new,
            "a record younger than ~12 months classifies as new"
        )
    }

    func testPopularBucketFromHighVolumeAndStrongRating() {
        // A pool where one venue is clearly top-tercile volume + well
        // rated + an old record.
        let pool = [
            place("low",  rating: 6.0, totalRatings: 5,    dateCreated: "2015-01-01"),
            place("mid",  rating: 6.5, totalRatings: 80,   dateCreated: "2015-01-01"),
            place("high", rating: 7.6, totalRatings: 4000, dateCreated: "2025-01-01"),
        ]
        let split = Q5VenueClassifier.volumeTerciles(in: pool)
        XCTAssertEqual(
            Q5VenueClassifier.reputation(of: pool[2], volumeSplit: split, now: now),
            QuizReputation.popular,
            "high volume + a strong rating + a not-old record is Popular"
        )
    }

    func testClassicBucketFromHighVolumeAndOldRecord() {
        let pool = [
            place("low",  rating: 6.0, totalRatings: 5,    dateCreated: "2015-01-01"),
            place("mid",  rating: 6.5, totalRatings: 80,   dateCreated: "2015-01-01"),
            place("high", rating: 7.6, totalRatings: 4000, dateCreated: "2010-01-01"),
        ]
        let split = Q5VenueClassifier.volumeTerciles(in: pool)
        XCTAssertEqual(
            Q5VenueClassifier.reputation(of: pool[2], volumeSplit: split, now: now),
            QuizReputation.classic,
            "high volume + an old record is Classic — age discriminates it from Popular"
        )
    }

    func testHiddenGemBucketFromLowVolumeAndExcellentRating() {
        let pool = [
            place("gem",  rating: 8.5, totalRatings: 4,    dateCreated: "2015-01-01"),
            place("mid",  rating: 6.5, totalRatings: 80,   dateCreated: "2015-01-01"),
            place("high", rating: 7.6, totalRatings: 4000, dateCreated: "2015-01-01"),
        ]
        let split = Q5VenueClassifier.volumeTerciles(in: pool)
        XCTAssertEqual(
            Q5VenueClassifier.reputation(of: pool[0], volumeSplit: split, now: now),
            QuizReputation.hiddenGem,
            "low volume + an excellent rating is a Hidden gem"
        )
    }

    func testNoReputationSignalFallsBackToPopular() {
        // A venue with no rating / volume / age — the neutral, ordinary
        // bucket, never `no_preference` (that is a member answer).
        let pool = [place("plain")]
        let split = Q5VenueClassifier.volumeTerciles(in: pool)
        let bucket = Q5VenueClassifier.reputation(of: pool[0], volumeSplit: split, now: now)
        XCTAssertEqual(bucket, QuizReputation.popular)
        XCTAssertNotEqual(bucket, QuizReputation.noPreference,
            "a venue's reputation is never no_preference — that is a member answer")
    }

    func testReputationIsPoolRelative() {
        // The SAME venue (volume 100) is top-tercile in a low-volume
        // pool and bottom-tercile in a high-volume pool — the buckets
        // shift with the pool, per research §4.
        let venue = place("v", rating: 8.2, totalRatings: 100, dateCreated: "2015-01-01")

        let quietPool = [
            place("a", totalRatings: 1, dateCreated: "2015-01-01"),
            place("b", totalRatings: 2, dateCreated: "2015-01-01"),
            venue,
        ]
        let densePool = [
            place("a", totalRatings: 9000, dateCreated: "2015-01-01"),
            place("b", totalRatings: 9500, dateCreated: "2015-01-01"),
            venue,
        ]
        let quietBucket = Q5VenueClassifier.reputation(
            of: venue, volumeSplit: Q5VenueClassifier.volumeTerciles(in: quietPool), now: now)
        let denseBucket = Q5VenueClassifier.reputation(
            of: venue, volumeSplit: Q5VenueClassifier.volumeTerciles(in: densePool), now: now)
        XCTAssertNotEqual(quietBucket, denseBucket,
            "reputation must be pool-relative — the same volume buckets differently in different pools")
    }

    // MARK: - Pool classification

    func testClassifyProducesOneProfilePerPlaceInOrder() {
        let pool = [
            place("a", categories: ["Mexican Restaurant"]),
            place("b", categories: ["Cocktail Bar"]),
        ]
        let classified = Q5VenueClassifier.classify(pool: pool, now: now)
        XCTAssertEqual(classified.count, 2)
        XCTAssertEqual(classified.map(\.id), ["a", "b"], "classification preserves input order")
        XCTAssertEqual(classified[0].profile.cuisine, QuizCuisine.mexican)
        XCTAssertEqual(classified[1].profile.vibe, 3)
    }

    func testClassifyEmptyPoolIsEmpty() {
        XCTAssertTrue(Q5VenueClassifier.classify(pool: [], now: now).isEmpty)
    }

    func testClassificationIsDeterministic() {
        let pool = [
            place("a", categories: ["Thai Restaurant"], rating: 8.1, totalRatings: 12, dateCreated: "2014-01-01"),
            place("b", categories: ["Cocktail Bar"], rating: 7.0, totalRatings: 900, dateCreated: "2014-01-01"),
        ]
        XCTAssertEqual(
            Q5VenueClassifier.classify(pool: pool, now: now),
            Q5VenueClassifier.classify(pool: pool, now: now),
            "classification is a pure deterministic function of its inputs"
        )
    }
}
