// GetToIt — PreferenceFunction pure unit tests (TB-09 v1.1).
//
// The preference engine (PRD modules A `buildPreferenceFunction` + E
// axis scorers) is pure: it takes a member's stated Q1–Q4 profile and
// their three Q5 factorial ratings, and returns a `prefFn` that scores
// any axis-profiled venue 1…5. No I/O, no clock, no group state.
//
// These tests assert the acceptance criteria (PRD module A + E test
// plans, gti-vault/15_issues/v1.1/issues/tb-09-…):
//   * `buildPreferenceFunction` returns a `prefFn` producing 1…5
//     scores for canned venues from canned Q1–Q5 inputs;
//   * equal-weight init; an explicit "No preference" zeroes that axis;
//     soft re-weight blends toward the Q5-revealed weights;
//   * the hard-contradiction override fires only on the strict two-
//     condition trigger and demotes (never inverts); a single odd
//     rating does not flip a stated preference;
//   * a soft non-match scores below T so the satisficing floor has
//     teeth;
//   * the cuisine / reputation / vibe axis scorers each satisfy the
//     fixed `venue -> 1…5` interface.
//
// Design source: gti-vault/50_product/v1.1-quiz-amendments §3
// ("Q5 — the preference probe") and the research-01 metadata mapping
// (gti-vault/60_engineering/research/foursquare-filter-surface-2026-05).

import XCTest
@testable import GetToIt

final class PreferenceFunctionTests: XCTestCase {

    // MARK: - Fixture helpers

    /// An axis-profiled venue. Reuses tb-08's `Q5VenueProfile` — the
    /// already-classified shape the factorial and the preference
    /// function both consume.
    private func venue(
        cuisine: String?,
        reputation: String,
        vibe: Int
    ) -> Q5VenueProfile {
        Q5VenueProfile(cuisine: cuisine, reputation: reputation, vibe: vibe)
    }

    /// A member craving Mexican, wanting Popular, vibe 2 (Social).
    private let mexicanSocialPopular = Q5MemberProfile(
        cuisines: [QuizCuisine.mexican],
        reputation: QuizReputation.popular,
        vibe: 2
    )

    /// Three Q5 ratings where every card scores the same — no axis
    /// reveals any weight signal (marginal value 0 everywhere).
    private func flatRatings(_ score: Int) -> [Q5Rating] {
        [
            Q5Rating(droppedAxis: .cuisine, score: score),
            Q5Rating(droppedAxis: .reputation, score: score),
            Q5Rating(droppedAxis: .vibe, score: score),
        ]
    }

    // MARK: - buildPreferenceFunction — basic contract

    func testPrefFnScoresWithinOneToFive() {
        let prefFn = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: flatRatings(3)
        )
        // A full match — craved cuisine, stated reputation, exact vibe.
        let perfect = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 2)
        // A full non-match on every axis.
        let miss = venue(cuisine: QuizCuisine.thai, reputation: QuizReputation.hiddenGem, vibe: 4)
        for v in [perfect, miss] {
            let s = prefFn(v)
            XCTAssertGreaterThanOrEqual(s, 1.0)
            XCTAssertLessThanOrEqual(s, 5.0)
        }
    }

    func testPerfectMatchScoresFive() {
        let prefFn = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: flatRatings(3)
        )
        let perfect = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 2)
        XCTAssertEqual(prefFn(perfect), 5.0, accuracy: 0.001)
    }

    // MARK: - Soft non-match has teeth (scores below T)

    func testSoftNonMatchScoresBelowThreshold() {
        // Flat Q5 ratings — weights stay at the equal 1/3 prior. A venue
        // that misses every soft axis must land below T so the
        // satisficing floor can eliminate it.
        let prefFn = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: flatRatings(3)
        )
        let miss = venue(cuisine: QuizCuisine.thai, reputation: QuizReputation.hiddenGem, vibe: 4)
        XCTAssertLessThan(prefFn(miss), PreferenceFunction.thresholdT)
    }

    func testNonMatchOnLowWeightAxisBarelyDentsScore() {
        // A venue matching two axes and missing one should still score
        // well above a venue that misses everything.
        let prefFn = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: flatRatings(3)
        )
        let twoOfThree = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 3)
        let allMiss = venue(cuisine: QuizCuisine.thai, reputation: QuizReputation.hiddenGem, vibe: 4)
        XCTAssertGreaterThan(prefFn(twoOfThree), prefFn(allMiss))
    }

    // MARK: - "No preference" zeroes an axis

    func testReputationNoPreferenceZeroesThatAxis() {
        // A member who no-prefs reputation: a venue's reputation must
        // not move its score at all. Two venues differing only on
        // reputation score identically.
        let member = Q5MemberProfile(
            cuisines: [QuizCuisine.mexican],
            reputation: QuizReputation.noPreference,
            vibe: 2
        )
        let prefFn = PreferenceFunction.build(member: member, q5Ratings: flatRatings(3))
        let a = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 2)
        let b = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 2)
        XCTAssertEqual(prefFn(a), prefFn(b), accuracy: 0.001)
    }

    func testCuisineNoPreferenceZeroesThatAxis() {
        // Q1 left empty == no cuisine preference. Cuisine must not move
        // the score.
        let member = Q5MemberProfile(
            cuisines: [],
            reputation: QuizReputation.popular,
            vibe: 2
        )
        let prefFn = PreferenceFunction.build(member: member, q5Ratings: flatRatings(3))
        let a = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 2)
        let b = venue(cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 2)
        XCTAssertEqual(prefFn(a), prefFn(b), accuracy: 0.001)
    }

    func testNoPreferenceAxisWeightRedistributesToSurvivors() {
        // With reputation zeroed, the remaining two axes carry full
        // weight. A venue matching cuisine + vibe but missing
        // reputation still scores a perfect 5 — reputation contributes
        // nothing, so its miss costs nothing.
        let member = Q5MemberProfile(
            cuisines: [QuizCuisine.mexican],
            reputation: QuizReputation.noPreference,
            vibe: 2
        )
        let prefFn = PreferenceFunction.build(member: member, q5Ratings: flatRatings(3))
        let v = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 2)
        XCTAssertEqual(prefFn(v), 5.0, accuracy: 0.001)
    }

    // MARK: - Soft re-weight blends toward the Q5-revealed weights

    func testSoftReweightLiftsAHighMarginalAxis() {
        // Cuisine-drop card rated low (1), the two cuisine-keep cards
        // rated high (5) — cuisine has a large positive marginal value,
        // so the blend lifts cuisine's weight above the 1/3 prior.
        // Reputation and vibe ratings are flat (their drop cards rate
        // the same as their keep cards) so they reveal no weight.
        //
        // Concretely: a venue that matches ONLY cuisine should now
        // score higher under the revealed weights than under the flat
        // prior, because cuisine carries more of the weighted average.
        let highCuisineWeight = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: [
                Q5Rating(droppedAxis: .cuisine, score: 1),
                Q5Rating(droppedAxis: .reputation, score: 3),
                Q5Rating(droppedAxis: .vibe, score: 3),
            ]
        )
        let flatWeight = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: flatRatings(3)
        )
        // Matches cuisine only.
        let cuisineOnly = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 4)
        XCTAssertGreaterThan(highCuisineWeight(cuisineOnly), flatWeight(cuisineOnly))
    }

    func testSoftReweightIsPartialNotFullReplacement() {
        // Even with a maximal cuisine marginal value, the blend toward a
        // non-zero prior means reputation and vibe keep some weight — a
        // venue missing cuisine but matching the other two still scores
        // well above the 1…5 floor (the axes are NOT discounted to 0).
        let prefFn = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: [
                Q5Rating(droppedAxis: .cuisine, score: 1),
                Q5Rating(droppedAxis: .reputation, score: 3),
                Q5Rating(droppedAxis: .vibe, score: 3),
            ]
        )
        let missCuisineOnly = venue(cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 2)
        // Reputation + vibe still carry real weight, so this is a
        // partial match well above 1.
        XCTAssertGreaterThan(prefFn(missCuisineOnly), 2.0)
    }

    func testFlatRatingsLeaveWeightsAtPrior() {
        // All three Q5 cards rated identically -> every marginal value
        // 0 -> weights stay at the equal 1/3 prior. Two venues each
        // matching exactly one *categorical* axis (cuisine, reputation)
        // and missing the others identically score the same. (Vibe is
        // the graded axis, so a vibe match is not symmetric with a
        // cuisine/reputation match — the symmetry test uses the two
        // categorical axes, both held at the maximum vibe distance.)
        let prefFn = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: flatRatings(4)
        )
        // member vibe is 2; vibe 4 is two steps away in both venues, so
        // the vibe contribution is identical and the comparison
        // isolates the cuisine-vs-reputation weight equality.
        let cuisineOnly = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 4)
        let reputationOnly = venue(cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 4)
        XCTAssertEqual(prefFn(cuisineOnly), prefFn(reputationOnly), accuracy: 0.001)
    }

    // MARK: - Hard-contradiction override

    func testHardContradictionOverrideFiresOnStrictTrigger() {
        // Reputation override trigger: BOTH reputation-keep cards score
        // strictly below the reputation-drop card, AND the drop card is
        // rated 4 or 5. The reputation-drop card is one of the three
        // factorial cards; the other two cards KEEP reputation.
        //
        // cuisine-drop keeps reputation -> rated 2.
        // vibe-drop    keeps reputation -> rated 2.
        // reputation-drop                -> rated 5.
        // Both keeps (2, 2) strictly < drop (5), drop >= 4 -> fires.
        let prefFn = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: [
                Q5Rating(droppedAxis: .cuisine, score: 2),
                Q5Rating(droppedAxis: .reputation, score: 5),
                Q5Rating(droppedAxis: .vibe, score: 2),
            ]
        )
        // Override demotes reputation to no-preference: a venue that
        // misses reputation but matches cuisine + vibe now scores a
        // perfect 5 (reputation no longer scores points).
        let v = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 2)
        XCTAssertEqual(prefFn(v), 5.0, accuracy: 0.001)
    }

    func testHardContradictionOverrideDemotesNeverInverts() {
        // After a reputation override, the member's stated reputation
        // (Popular) must NOT become a liability and the drop card's
        // reputation must NOT become the new preferred value. Two
        // venues differing only on reputation score identically — the
        // axis is neutral, not inverted.
        let prefFn = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: [
                Q5Rating(droppedAxis: .cuisine, score: 2),
                Q5Rating(droppedAxis: .reputation, score: 5),
                Q5Rating(droppedAxis: .vibe, score: 2),
            ]
        )
        let statedRep = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 2)
        let otherRep = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.classic, vibe: 2)
        XCTAssertEqual(prefFn(statedRep), prefFn(otherRep), accuracy: 0.001)
    }

    func testSingleOddRatingDoesNotFireOverride() {
        // Only ONE reputation-keep card scores below the drop card; the
        // other keep card scores at or above it. The strict "both keep
        // cards below" trigger is not met -> no override. Reputation
        // stays a real scoring axis.
        let prefFn = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: [
                Q5Rating(droppedAxis: .cuisine, score: 2),   // a rep-keep card, below drop
                Q5Rating(droppedAxis: .reputation, score: 5), // the rep-drop card
                Q5Rating(droppedAxis: .vibe, score: 5),       // a rep-keep card, NOT below drop
            ]
        )
        // Reputation still scores: a venue missing only reputation
        // scores strictly below a full match.
        let missRep = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 2)
        let perfect = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 2)
        XCTAssertLessThan(prefFn(missRep), prefFn(perfect))
    }

    func testOverrideDoesNotFireWhenDropCardRatedBelowFour() {
        // Both keep cards score below the drop card, but the drop card
        // is only a 3 — the "drop rated 4 or 5" half of the trigger
        // fails. No override; reputation still scores.
        let prefFn = PreferenceFunction.build(
            member: mexicanSocialPopular,
            q5Ratings: [
                Q5Rating(droppedAxis: .cuisine, score: 1),
                Q5Rating(droppedAxis: .reputation, score: 3),
                Q5Rating(droppedAxis: .vibe, score: 2),
            ]
        )
        let missRep = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 2)
        let perfect = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 2)
        XCTAssertLessThan(prefFn(missRep), prefFn(perfect))
    }

    func testOverrideOnMultiPickCuisineDemotesWholeSet() {
        // A member who picked three cuisines; the cuisine override
        // fires. The whole cuisine set demotes to no-preference,
        // including the untested third cuisine. Cuisine stops scoring.
        let member = Q5MemberProfile(
            cuisines: [QuizCuisine.mexican, QuizCuisine.italian, QuizCuisine.thai],
            reputation: QuizReputation.popular,
            vibe: 2
        )
        let prefFn = PreferenceFunction.build(
            member: member,
            q5Ratings: [
                Q5Rating(droppedAxis: .cuisine, score: 5),    // cuisine-drop, excited
                Q5Rating(droppedAxis: .reputation, score: 2), // cuisine-keep
                Q5Rating(droppedAxis: .vibe, score: 2),       // cuisine-keep
            ]
        )
        // Cuisine demoted: a non-craved cuisine venue matching the
        // other two axes scores a perfect 5.
        let v = venue(cuisine: QuizCuisine.chinese, reputation: QuizReputation.popular, vibe: 2)
        XCTAssertEqual(prefFn(v), 5.0, accuracy: 0.001)
    }

    // MARK: - Axis scorers — fixed venue -> 1…5 interface

    func testCuisineScorerSetMembership() {
        // Cuisine is a clean set-membership axis: in the craved set -> 5,
        // not in it -> the soft non-match (~2).
        let craved = ["mexican", "italian"]
        XCTAssertEqual(
            CuisineAxisScorer.score(venueCuisine: "mexican", cravedCuisines: craved),
            PreferenceFunction.matchScore
        )
        XCTAssertEqual(
            CuisineAxisScorer.score(venueCuisine: "thai", cravedCuisines: craved),
            PreferenceFunction.softNonMatchScore
        )
        // An unclassified venue cannot match -> soft non-match.
        XCTAssertEqual(
            CuisineAxisScorer.score(venueCuisine: nil, cravedCuisines: craved),
            PreferenceFunction.softNonMatchScore
        )
    }

    func testReputationScorerExactMatchAndMiss() {
        // Reputation is a categorical axis: the stated bucket -> 5,
        // any other bucket -> the soft non-match.
        XCTAssertEqual(
            ReputationAxisScorer.score(venueReputation: QuizReputation.popular,
                                       statedReputation: QuizReputation.popular),
            PreferenceFunction.matchScore
        )
        XCTAssertEqual(
            ReputationAxisScorer.score(venueReputation: QuizReputation.hiddenGem,
                                       statedReputation: QuizReputation.popular),
            PreferenceFunction.softNonMatchScore
        )
    }

    func testVibeScorerIsGradedByDistance() {
        // Vibe is the one graded axis — distance on the 0…4 energy
        // scale. Exact match -> 5; the maximum distance (4) -> the
        // bottom of the scale; an intermediate distance scores in
        // between, strictly monotone in distance.
        let exact = VibeAxisScorer.score(venueVibe: 2, statedVibe: 2)
        let near = VibeAxisScorer.score(venueVibe: 3, statedVibe: 2)
        let far = VibeAxisScorer.score(venueVibe: 4, statedVibe: 0)
        XCTAssertEqual(exact, 5.0, accuracy: 0.001)
        XCTAssertGreaterThan(exact, near)
        XCTAssertGreaterThan(near, far)
        XCTAssertGreaterThanOrEqual(far, 1.0)
    }

    func testAllAxisScorersReturnOneToFive() {
        // Every axis scorer must honour the fixed venue -> 1…5
        // interface across its whole input domain.
        for craved in [[], ["mexican"], ["mexican", "thai"]] {
            for vc: String? in ["mexican", "thai", nil] {
                let s = CuisineAxisScorer.score(venueCuisine: vc, cravedCuisines: craved)
                XCTAssertGreaterThanOrEqual(s, 1.0)
                XCTAssertLessThanOrEqual(s, 5.0)
            }
        }
        let reps = [QuizReputation.popular, QuizReputation.hiddenGem,
                    QuizReputation.classic, QuizReputation.new]
        for vr in reps {
            for sr in reps {
                let s = ReputationAxisScorer.score(venueReputation: vr, statedReputation: sr)
                XCTAssertGreaterThanOrEqual(s, 1.0)
                XCTAssertLessThanOrEqual(s, 5.0)
            }
        }
        for vv in 0...4 {
            for sv in 0...4 {
                let s = VibeAxisScorer.score(venueVibe: vv, statedVibe: sv)
                XCTAssertGreaterThanOrEqual(s, 1.0)
                XCTAssertLessThanOrEqual(s, 5.0)
            }
        }
    }

    // MARK: - Determinism

    func testPrefFnIsDeterministic() {
        let v = venue(cuisine: QuizCuisine.mexican, reputation: QuizReputation.classic, vibe: 1)
        let a = PreferenceFunction.build(member: mexicanSocialPopular, q5Ratings: flatRatings(3))(v)
        let b = PreferenceFunction.build(member: mexicanSocialPopular, q5Ratings: flatRatings(3))(v)
        XCTAssertEqual(a, b, accuracy: 0.0)
    }
}
