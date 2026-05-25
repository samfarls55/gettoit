// GetToIt — RunningUnionPoolManager tests (TB-10 quiz redesign, PRD module G).
//
// The pool manager holds the group candidate pool as the running union
// of every member's Foursquare fetch — never an intersection. As the
// union grows with each member's fetch, the manager re-scores the new
// venues for every already-completed member via their cached `prefFn`,
// so no member's scores go stale, and caches per-member scores for the
// verdict engine to consume.
//
// These tests encode the three acceptance criteria from tb-10:
//   1. The group pool is the running union of all members' fetches,
//      deduped by venue id.
//   2. Adding a member's fetch re-scores the new venues for every
//      already-completed member via their cached `prefFn`.
//   3. Per-member scores are cached and readable by the verdict engine.

import XCTest
@testable import GetToIt

final class RunningUnionPoolManagerTests: XCTestCase {

    // MARK: - Fixtures

    /// Build a profiled pool venue. Cuisine / reputation / vibe default
    /// to neutral values; tests override the axis they probe.
    private func venue(
        _ id: String,
        cuisine: String? = nil,
        reputation: String = QuizReputation.popular,
        vibe: Int = 2
    ) -> Q5PoolVenue {
        Q5PoolVenue(
            place: ShapedPlace(fsqPlaceId: id, name: id, lat: 0, lng: 0),
            profile: Q5VenueProfile(cuisine: cuisine, reputation: reputation, vibe: vibe)
        )
    }

    /// A `prefFn` that scores by exact cuisine match: `match` for a
    /// venue whose cuisine equals `cravedCuisine`, `softNonMatchScore`
    /// otherwise. Deterministic and pure — the manager caches it as-is.
    private func cuisinePrefFn(craving cravedCuisine: String) -> (Q5VenueProfile) -> Double {
        { profile in
            profile.cuisine == cravedCuisine
                ? PreferenceFunction.matchScore
                : PreferenceFunction.softNonMatchScore
        }
    }

    // MARK: - Criterion 1: running union, deduped by venue id

    func testPoolIsTheUnionOfTwoMembersFetches() {
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("v-1"), venue("v-2")],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )
        manager.addMemberFetch(
            memberId: "bob",
            venues: [venue("v-3"), venue("v-4")],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )

        XCTAssertEqual(
            Set(manager.pool.map(\.id)),
            ["v-1", "v-2", "v-3", "v-4"],
            "the group pool is the union of every member's fetch"
        )
    }

    func testOverlappingVenuesAreDedupedByVenueId() {
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("v-1"), venue("v-shared")],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )
        manager.addMemberFetch(
            memberId: "bob",
            venues: [venue("v-shared"), venue("v-2")],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )

        XCTAssertEqual(manager.pool.count, 3, "v-shared appears once, not twice")
        XCTAssertEqual(Set(manager.pool.map(\.id)), ["v-1", "v-shared", "v-2"])
    }

    func testUnionNeverIntersects() {
        // Two members with entirely disjoint fetches — the pool keeps
        // every venue (a broad set the engine narrows), never the empty
        // intersection.
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("a-1"), venue("a-2")],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )
        manager.addMemberFetch(
            memberId: "bob",
            venues: [venue("b-1"), venue("b-2")],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )

        XCTAssertEqual(manager.pool.count, 4, "disjoint fetches union, never intersect")
    }

    func testFirstSeenVenueProfileWinsOnDuplicate() {
        // A later member's fetch carrying a duplicate venue id does not
        // overwrite the first-seen profile — the union is stable.
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("v-dup", cuisine: QuizCuisine.italian)],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )
        manager.addMemberFetch(
            memberId: "bob",
            venues: [venue("v-dup", cuisine: QuizCuisine.thai)],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )

        let dup = manager.pool.first { $0.id == "v-dup" }
        XCTAssertEqual(dup?.profile.cuisine, QuizCuisine.italian,
            "first-seen venue profile wins on a duplicate id")
    }

    // MARK: - Criterion 3: per-member scores cached + readable

    func testScoresAreCachedAndReadablePerMember() {
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [
                venue("v-italian", cuisine: QuizCuisine.italian),
                venue("v-thai", cuisine: QuizCuisine.thai),
            ],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )

        let scores = manager.scores(for: "alice")
        XCTAssertEqual(scores["v-italian"], PreferenceFunction.matchScore,
            "alice craves Italian — the Italian venue scores a match")
        XCTAssertEqual(scores["v-thai"], PreferenceFunction.softNonMatchScore,
            "the Thai venue is a soft non-match for alice")
    }

    func testEveryPoolVenueHasAScoreForEveryMember() {
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("v-1"), venue("v-2")],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )
        manager.addMemberFetch(
            memberId: "bob",
            venues: [venue("v-3")],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )

        for member in ["alice", "bob"] {
            let scores = manager.scores(for: member)
            XCTAssertEqual(Set(scores.keys), ["v-1", "v-2", "v-3"],
                "every member has a score for every pool venue (\(member))")
        }
    }

    func testScoresForUnknownMemberIsEmpty() {
        let manager = RunningUnionPoolManager()
        XCTAssertTrue(manager.scores(for: "nobody").isEmpty)
    }

    // MARK: - Criterion 2: re-scoring keeps earlier members fresh

    func testAddingALaterFetchRescoresNewVenuesForEarlierMembers() {
        // Alice completes first with two venues. Bob completes second,
        // adding two MORE venues. Alice's `prefFn` must have re-scored
        // Bob's venues so her score cache is not stale.
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [
                venue("v-italian", cuisine: QuizCuisine.italian),
            ],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )

        // Before Bob completes, Alice only has her own venue scored.
        XCTAssertEqual(Set(manager.scores(for: "alice").keys), ["v-italian"])

        manager.addMemberFetch(
            memberId: "bob",
            venues: [
                venue("v-bob-italian", cuisine: QuizCuisine.italian),
                venue("v-bob-thai", cuisine: QuizCuisine.thai),
            ],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )

        let aliceScores = manager.scores(for: "alice")
        XCTAssertEqual(Set(aliceScores.keys), ["v-italian", "v-bob-italian", "v-bob-thai"],
            "Bob's new venues were re-scored for Alice — no stale scores")
        XCTAssertEqual(aliceScores["v-bob-italian"], PreferenceFunction.matchScore,
            "Alice craves Italian — Bob's Italian venue scores a match for her")
        XCTAssertEqual(aliceScores["v-bob-thai"], PreferenceFunction.softNonMatchScore,
            "Bob's Thai venue is a soft non-match for Alice")
    }

    func testNewMemberScoresTheWholeExistingUnion() {
        // The reverse direction: a late-joining member must score every
        // venue already in the union, not just their own fetch.
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("v-italian", cuisine: QuizCuisine.italian)],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )
        manager.addMemberFetch(
            memberId: "bob",
            venues: [venue("v-thai", cuisine: QuizCuisine.thai)],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )

        let bobScores = manager.scores(for: "bob")
        XCTAssertEqual(Set(bobScores.keys), ["v-italian", "v-thai"],
            "Bob scored Alice's venue too, not just his own")
        XCTAssertEqual(bobScores["v-thai"], PreferenceFunction.matchScore)
        XCTAssertEqual(bobScores["v-italian"], PreferenceFunction.softNonMatchScore)
    }

    func testThreeMembersAllStayFreshAcrossEveryFetch() {
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("a-1", cuisine: QuizCuisine.italian)],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )
        manager.addMemberFetch(
            memberId: "bob",
            venues: [venue("b-1", cuisine: QuizCuisine.thai)],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )
        manager.addMemberFetch(
            memberId: "carol",
            venues: [venue("c-1", cuisine: QuizCuisine.mexican)],
            prefFn: cuisinePrefFn(craving: QuizCuisine.mexican)
        )

        // All three members score the full 3-venue union.
        for member in ["alice", "bob", "carol"] {
            XCTAssertEqual(Set(manager.scores(for: member).keys), ["a-1", "b-1", "c-1"],
                "\(member) scores the entire union")
        }
        // And each member's own craved venue scores a match for them.
        XCTAssertEqual(manager.scores(for: "alice")["a-1"], PreferenceFunction.matchScore)
        XCTAssertEqual(manager.scores(for: "bob")["b-1"], PreferenceFunction.matchScore)
        XCTAssertEqual(manager.scores(for: "carol")["c-1"], PreferenceFunction.matchScore)
    }

    func testReaddingAMembersFetchReplacesTheirPriorContribution() {
        // A member who re-completes the quiz (e.g. edits answers before
        // the verdict fires) replaces their prior prefFn + fetch rather
        // than stacking — the latest fetch + prefFn win, and every
        // member is re-scored against the resulting union.
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("v-italian", cuisine: QuizCuisine.italian)],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )
        // Alice re-completes craving Thai instead.
        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("v-thai", cuisine: QuizCuisine.thai)],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )

        // The union still carries both venues (union never shrinks).
        XCTAssertEqual(Set(manager.pool.map(\.id)), ["v-italian", "v-thai"])
        // Alice's scores now reflect her LATEST prefFn (craves Thai).
        let aliceScores = manager.scores(for: "alice")
        XCTAssertEqual(aliceScores["v-thai"], PreferenceFunction.matchScore)
        XCTAssertEqual(aliceScores["v-italian"], PreferenceFunction.softNonMatchScore)
    }

    func testCompletedMemberIdsTracksEveryMemberWhoFetched() {
        let manager = RunningUnionPoolManager()
        XCTAssertTrue(manager.completedMemberIds.isEmpty)

        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("v-1")],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )
        manager.addMemberFetch(
            memberId: "bob",
            venues: [venue("v-2")],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )

        XCTAssertEqual(manager.completedMemberIds, ["alice", "bob"])
    }

    func testEmptyFetchStillRegistersTheMemberAndScoresTheUnion() {
        // A member whose fetch came back empty (a thin pool) still
        // counts as completed and still scores every venue other
        // members contributed.
        let manager = RunningUnionPoolManager()

        manager.addMemberFetch(
            memberId: "alice",
            venues: [venue("v-italian", cuisine: QuizCuisine.italian)],
            prefFn: cuisinePrefFn(craving: QuizCuisine.italian)
        )
        manager.addMemberFetch(
            memberId: "bob",
            venues: [],
            prefFn: cuisinePrefFn(craving: QuizCuisine.thai)
        )

        XCTAssertEqual(manager.completedMemberIds, ["alice", "bob"])
        XCTAssertEqual(Set(manager.scores(for: "bob").keys), ["v-italian"],
            "an empty-fetch member still scores the rest of the union")
    }
}
