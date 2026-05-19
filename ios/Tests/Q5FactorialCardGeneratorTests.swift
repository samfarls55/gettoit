// GetToIt — Q5FactorialCardGenerator pure unit tests (TB-08 v1.1).
//
// The generator (PRD module C) is pure: it takes a member's stated
// Q1–Q4 profile and their axis-profiled candidate pool, and emits the
// three strict-factorial Q5 cards. No I/O, no clock, no group state.
//
// These tests assert the acceptance criteria:
//   * each card deviates on exactly one axis and matches the other two;
//   * no card is a 100% match;
//   * the member-local cuisine selection (pool feasibility) is honored.
//
// Factorial spec source: gti-vault/50_product/v1.1-quiz-amendments §3.

import XCTest
@testable import GetToIt

final class Q5FactorialCardGeneratorTests: XCTestCase {

    // MARK: - Fixture helpers

    /// Build a profiled pool venue. `id` doubles as the place name so
    /// assertions read clearly.
    private func venue(
        _ id: String,
        cuisine: String?,
        reputation: String,
        vibe: Int
    ) -> Q5PoolVenue {
        Q5PoolVenue(
            place: ShapedPlace(
                fsqPlaceId: id,
                name: id,
                lat: 0, lng: 0,
                categories: cuisine.map { [$0] } ?? []
            ),
            profile: Q5VenueProfile(cuisine: cuisine, reputation: reputation, vibe: vibe)
        )
    }

    /// A pool that comfortably furnishes all three factorial cards for
    /// a member craving Mexican, wanting Popular, vibe 2 (Social).
    private func wellStockedPool() -> [Q5PoolVenue] {
        [
            // cuisine-drop candidate — non-craved cuisine, matches rep + vibe.
            venue("cuisine-drop", cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 2),
            // reputation-drop candidate — craved cuisine, deviating rep, matches vibe.
            venue("rep-drop", cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 2),
            // vibe-drop candidate — craved cuisine, matches rep, deviating vibe.
            venue("vibe-drop", cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 4),
            // a perfect-match venue — must NEVER be chosen.
            venue("perfect", cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 2),
        ]
    }

    private let mexicanSocialPopular = Q5MemberProfile(
        cuisines: [QuizCuisine.mexican],
        reputation: QuizReputation.popular,
        vibe: 2
    )

    // MARK: - Strict factorial: one card per axis

    func testGeneratesThreeCardsOnePerAxis() {
        let cards = Q5FactorialCardGenerator.generate(
            member: mexicanSocialPopular,
            pool: wellStockedPool()
        )
        XCTAssertNotNil(cards)
        XCTAssertEqual(cards?.count, 3)
        XCTAssertEqual(
            Set(cards?.map(\.droppedAxis) ?? []),
            Set(Q5FactorialCard.Axis.allCases),
            "the three cards must each drop a distinct axis"
        )
    }

    // MARK: - Each card deviates on exactly one axis

    func testEachCardDeviatesOnExactlyItsDroppedAxis() {
        let member = mexicanSocialPopular
        guard let cards = Q5FactorialCardGenerator.generate(member: member, pool: wellStockedPool()) else {
            return XCTFail("expected a factorial triple from a well-stocked pool")
        }

        for card in cards {
            let p = card.venue.profile
            let cuisineMatches = p.cuisine.map { member.cuisines.contains($0) } ?? false
            let reputationMatches = p.reputation == member.reputation
            let vibeMatches = p.vibe == member.vibe

            switch card.droppedAxis {
            case .cuisine:
                XCTAssertFalse(cuisineMatches, "cuisine-drop card must deviate on cuisine")
                XCTAssertTrue(reputationMatches, "cuisine-drop card must match reputation")
                XCTAssertTrue(vibeMatches, "cuisine-drop card must match vibe")
            case .reputation:
                XCTAssertTrue(cuisineMatches, "reputation-drop card must match cuisine")
                XCTAssertFalse(reputationMatches, "reputation-drop card must deviate on reputation")
                XCTAssertTrue(vibeMatches, "reputation-drop card must match vibe")
            case .vibe:
                XCTAssertTrue(cuisineMatches, "vibe-drop card must match cuisine")
                XCTAssertTrue(reputationMatches, "vibe-drop card must match reputation")
                XCTAssertFalse(vibeMatches, "vibe-drop card must deviate on vibe")
            }
        }
    }

    // MARK: - No card is a 100% match

    func testNoCardIsAPerfectMatch() {
        let member = mexicanSocialPopular
        guard let cards = Q5FactorialCardGenerator.generate(member: member, pool: wellStockedPool()) else {
            return XCTFail("expected a factorial triple")
        }

        for card in cards {
            let p = card.venue.profile
            let cuisineMatches = p.cuisine.map { member.cuisines.contains($0) } ?? false
            let allThreeMatch = cuisineMatches
                && p.reputation == member.reputation
                && p.vibe == member.vibe
            XCTAssertFalse(allThreeMatch, "no Q5 card may be a 100% match (\(card.venue.id))")
        }

        // The deliberately-perfect venue in the pool must be left out.
        XCTAssertFalse(
            cards.contains { $0.venue.id == "perfect" },
            "the perfect-match venue must never be selected"
        )
    }

    // MARK: - Distinct venues

    func testCardsAreThreeDistinctVenues() {
        guard let cards = Q5FactorialCardGenerator.generate(
            member: mexicanSocialPopular,
            pool: wellStockedPool()
        ) else { return XCTFail("expected a factorial triple") }
        XCTAssertEqual(Set(cards.map(\.venue.id)).count, 3, "the three cards must be distinct venues")
    }

    // MARK: - Member-local cuisine selection (pool feasibility)

    func testProbedCuisinesAreTheTwoMostFeasibleInThePool() {
        // Member craves three cuisines; Q5 probes only the two with the
        // best pool feasibility. `chinese` has the most venues, `thai`
        // the next, `indian` only one — so `indian` is dropped.
        let member = Q5MemberProfile(
            cuisines: [QuizCuisine.indian, QuizCuisine.thai, QuizCuisine.chinese],
            reputation: QuizReputation.popular,
            vibe: 2
        )
        let pool = [
            venue("ch-1", cuisine: QuizCuisine.chinese, reputation: QuizReputation.popular, vibe: 2),
            venue("ch-2", cuisine: QuizCuisine.chinese, reputation: QuizReputation.classic, vibe: 2),
            venue("ch-3", cuisine: QuizCuisine.chinese, reputation: QuizReputation.popular, vibe: 1),
            venue("th-1", cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 2),
            venue("th-2", cuisine: QuizCuisine.thai, reputation: QuizReputation.hiddenGem, vibe: 2),
            venue("in-1", cuisine: QuizCuisine.indian, reputation: QuizReputation.popular, vibe: 2),
        ]
        let probed = Q5FactorialCardGenerator.selectProbedCuisines(member: member, pool: pool)
        XCTAssertEqual(probed.count, 2)
        XCTAssertEqual(Set(probed), Set([QuizCuisine.chinese, QuizCuisine.thai]),
                       "Q5 must probe the two cuisines with the best pool feasibility")
        XCTAssertFalse(probed.contains(QuizCuisine.indian),
                       "the least-feasible craved cuisine must be dropped from the probe")
    }

    func testProbedCuisineTiesBreakOnQ1PickOrder() {
        // Two cuisines with equal pool support — the tie breaks on the
        // member's Q1 pick order, deterministically.
        let member = Q5MemberProfile(
            cuisines: [QuizCuisine.mexican, QuizCuisine.italian, QuizCuisine.japanese],
            reputation: QuizReputation.popular,
            vibe: 2
        )
        // Each craved cuisine has exactly one supporting venue — a
        // three-way tie. Pick order picks mexican then italian.
        let pool = [
            venue("mx", cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 2),
            venue("it", cuisine: QuizCuisine.italian, reputation: QuizReputation.popular, vibe: 2),
            venue("jp", cuisine: QuizCuisine.japanese, reputation: QuizReputation.popular, vibe: 2),
        ]
        let probed = Q5FactorialCardGenerator.selectProbedCuisines(member: member, pool: pool)
        XCTAssertEqual(probed, [QuizCuisine.mexican, QuizCuisine.italian],
                       "an all-tie feasibility must break on Q1 pick order")
    }

    func testProbedCuisinesIgnorePoolOrderAndCarryNoGroupState() {
        // The feasibility count is order-independent: shuffling the
        // pool must not change which cuisines are probed. This guards
        // the "group state never influences card selection" criterion —
        // pool order is the only thing that could leak ordering, and it
        // must not.
        let member = Q5MemberProfile(
            cuisines: [QuizCuisine.thai, QuizCuisine.chinese],
            reputation: QuizReputation.popular,
            vibe: 2
        )
        let forward = [
            venue("ch-1", cuisine: QuizCuisine.chinese, reputation: QuizReputation.popular, vibe: 2),
            venue("ch-2", cuisine: QuizCuisine.chinese, reputation: QuizReputation.classic, vibe: 2),
            venue("th-1", cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 2),
        ]
        let reversed = Array(forward.reversed())
        XCTAssertEqual(
            Q5FactorialCardGenerator.selectProbedCuisines(member: member, pool: forward),
            Q5FactorialCardGenerator.selectProbedCuisines(member: member, pool: reversed),
            "probed-cuisine selection must be independent of pool order"
        )
    }

    func testKeepCardsUseProbedCuisinesOnly() {
        // The two cuisine keep-cards (reputation-drop, vibe-drop) must
        // each carry one of the two probed cuisines — not the dropped
        // third craved cuisine.
        let member = Q5MemberProfile(
            cuisines: [QuizCuisine.indian, QuizCuisine.thai, QuizCuisine.chinese],
            reputation: QuizReputation.popular,
            vibe: 2
        )
        let pool = [
            // cuisine-drop candidate.
            venue("drop", cuisine: QuizCuisine.american, reputation: QuizReputation.popular, vibe: 2),
            // chinese — high feasibility.
            venue("ch-rep", cuisine: QuizCuisine.chinese, reputation: QuizReputation.hiddenGem, vibe: 2),
            venue("ch-vibe", cuisine: QuizCuisine.chinese, reputation: QuizReputation.popular, vibe: 4),
            venue("ch-extra", cuisine: QuizCuisine.chinese, reputation: QuizReputation.popular, vibe: 2),
            // thai — next feasibility.
            venue("th-rep", cuisine: QuizCuisine.thai, reputation: QuizReputation.classic, vibe: 2),
            venue("th-vibe", cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 0),
            // indian — single venue, must be dropped from the probe.
            venue("in-1", cuisine: QuizCuisine.indian, reputation: QuizReputation.popular, vibe: 2),
        ]
        guard let cards = Q5FactorialCardGenerator.generate(member: member, pool: pool) else {
            return XCTFail("expected a factorial triple")
        }
        let probed: Set<String> = [QuizCuisine.chinese, QuizCuisine.thai]
        for card in cards where card.droppedAxis != .cuisine {
            let cuisine = card.venue.profile.cuisine
            XCTAssertNotNil(cuisine)
            XCTAssertTrue(probed.contains(cuisine ?? ""),
                          "keep-card cuisine \(cuisine ?? "nil") must be one of the two probed cuisines")
        }
    }

    // MARK: - "No preference" answers

    func testNoCuisinePreferenceStillGeneratesAFactorialTriple() {
        // Member answered "No preference" on Q1. The cuisine-drop card
        // then needs no craved cuisine to deviate from; the keep-cards
        // match `nil` (any cuisine).
        let member = Q5MemberProfile(
            cuisines: [],
            reputation: QuizReputation.classic,
            vibe: 3
        )
        let pool = [
            venue("a", cuisine: QuizCuisine.mexican, reputation: QuizReputation.classic, vibe: 3),
            venue("b", cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 3),
            venue("c", cuisine: QuizCuisine.italian, reputation: QuizReputation.classic, vibe: 1),
        ]
        let cards = Q5FactorialCardGenerator.generate(member: member, pool: pool)
        XCTAssertNotNil(cards, "an empty craved-cuisine set must still yield a factorial triple")
        XCTAssertEqual(cards?.count, 3)
    }

    func testNoReputationPreferenceYieldsADegenerateButValidTriple() {
        // "No preference" on Q3 — reputation has no stated position, so
        // the reputation axis cannot truly deviate. The amendments doc
        // flags this degenerate case as acceptable: the triple still
        // generates, the reputation-drop card simply carries no probe
        // signal.
        let member = Q5MemberProfile(
            cuisines: [QuizCuisine.mexican],
            reputation: QuizReputation.noPreference,
            vibe: 2
        )
        let pool = [
            venue("a", cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 2),
            venue("b", cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 2),
            venue("c", cuisine: QuizCuisine.mexican, reputation: QuizReputation.classic, vibe: 4),
        ]
        let cards = Q5FactorialCardGenerator.generate(member: member, pool: pool)
        XCTAssertNotNil(cards)
        XCTAssertEqual(cards?.count, 3)
    }

    // MARK: - Pool starvation

    func testThinPoolThatCannotFurnishAllThreeCardsReturnsNil() {
        // A pool with only two venues can never furnish three distinct
        // cards. The generator surfaces this as `nil` — it never
        // invents a placeholder (the bug-03 hard rule).
        let pool = [
            venue("a", cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 2),
            venue("b", cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 2),
        ]
        let cards = Q5FactorialCardGenerator.generate(member: mexicanSocialPopular, pool: pool)
        XCTAssertNil(cards, "a pool too thin for a factorial triple must return nil, not a placeholder")
    }

    func testPoolWithNoDeviatingVibeVenueReturnsNil() {
        // Every venue shares the member's vibe — the vibe-drop card
        // cannot be furnished, so no valid factorial triple exists.
        let pool = [
            venue("a", cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 2),
            venue("b", cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 2),
            venue("c", cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 2),
        ]
        let cards = Q5FactorialCardGenerator.generate(member: mexicanSocialPopular, pool: pool)
        XCTAssertNil(cards, "no vibe-deviating venue means no valid factorial triple")
    }

    func testEmptyPoolReturnsNil() {
        XCTAssertNil(Q5FactorialCardGenerator.generate(member: mexicanSocialPopular, pool: []))
    }

    // MARK: - Determinism

    func testGenerationIsDeterministic() {
        let pool = wellStockedPool()
        let first = Q5FactorialCardGenerator.generate(member: mexicanSocialPopular, pool: pool)
        let second = Q5FactorialCardGenerator.generate(member: mexicanSocialPopular, pool: pool)
        XCTAssertEqual(first, second, "the generator must be a pure deterministic function of its inputs")
    }

    // MARK: - Q5 surface bridge

    func testFactorialCardsShapeIntoRealVenueQuizCandidates() {
        // The Q5 surface renders `[QuizCandidate]`. The bridge must
        // carry the real venue id + name through — never a placeholder.
        let pool = [
            Q5PoolVenue(
                place: ShapedPlace(
                    fsqPlaceId: "fsq-cuisine-drop", name: "Thai Orchid",
                    lat: 0, lng: 0, priceTier: 2, walkMinutesEstimate: 6,
                    categories: ["Thai"]
                ),
                profile: Q5VenueProfile(cuisine: QuizCuisine.thai, reputation: QuizReputation.popular, vibe: 2)
            ),
            Q5PoolVenue(
                place: ShapedPlace(
                    fsqPlaceId: "fsq-rep-drop", name: "Casa Lupita",
                    lat: 0, lng: 0, priceTier: 1, walkMinutesEstimate: 9,
                    categories: ["Mexican"]
                ),
                profile: Q5VenueProfile(cuisine: QuizCuisine.mexican, reputation: QuizReputation.hiddenGem, vibe: 2)
            ),
            Q5PoolVenue(
                place: ShapedPlace(
                    fsqPlaceId: "fsq-vibe-drop", name: "El Farol",
                    lat: 0, lng: 0, priceTier: 3, walkMinutesEstimate: 4,
                    categories: ["Mexican"]
                ),
                profile: Q5VenueProfile(cuisine: QuizCuisine.mexican, reputation: QuizReputation.popular, vibe: 4)
            ),
        ]
        guard let cards = Q5FactorialCardGenerator.generate(member: mexicanSocialPopular, pool: pool) else {
            return XCTFail("expected a factorial triple")
        }
        let candidates = Q5FactorialCardGenerator.quizCandidates(from: cards)

        XCTAssertEqual(candidates.count, 3)
        // The ids are real `fsq_place_id`s — Q5's jsonb slot keys
        // ratings on them, never on placeholder strings.
        XCTAssertEqual(Set(candidates.map(\.id)),
                       Set(["fsq-cuisine-drop", "fsq-rep-drop", "fsq-vibe-drop"]))
        // No placeholder venue leaks through — TB-26 removed the
        // fictitious `dummy-` candidate ids entirely.
        for candidate in candidates {
            XCTAssertFalse(candidate.id.hasPrefix("dummy-"),
                           "a factorial card must key on a real fetched venue id, never a placeholder")
        }
        // Meta formats identically to a plain loader card.
        XCTAssertTrue(candidates.contains { $0.meta == "Thai - $$ - 6 min" })
        // TB-24: each shaped candidate carries its card's `droppedAxis`
        // so the Q5 vote write can emit the factorial probe. The triple
        // covers all three distinct axes; the per-candidate axis matches
        // its source card.
        XCTAssertEqual(Set(candidates.compactMap(\.droppedAxis)),
                       Set([.cuisine, .reputation, .vibe]),
                       "the shaped candidates carry the three factorial axes")
        for (card, candidate) in zip(cards, candidates) {
            XCTAssertEqual(candidate.droppedAxis, card.droppedAxis,
                           "each candidate keeps its source card's dropped axis")
        }
    }
}
