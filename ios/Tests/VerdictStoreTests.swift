// GetToIt — VerdictStore pure-function tests (TB-06).
//
// The Supabase-side integration tests live alongside the existing
// `VotesIntegrationTests` pattern — gated on `SUPABASE_PROJECT_URL` so
// PRs without backend secrets stay green. These tests cover the pure
// shaping helpers that drive the verdict UI (action mapping, meta line,
// audience copy). They have no Supabase coupling.

import XCTest
@testable import GetToIt

@MainActor
final class VerdictStoreTests: XCTestCase {

    // MARK: - action mapping

    func testActionMapsLoudVibeToWantedLively() {
        let vote = VerdictStore.VoteRow(
            userID: UUID(), q1Vetoes: [], q2Budget: 4, q3WalkMinutes: 30, q4Vibe: 3,
            q5Regret: [:]
        )
        XCTAssertEqual(VerdictStore.action(for: vote), "wanted lively")
    }

    func testActionMapsHushedVibeToWantedHushed() {
        let vote = VerdictStore.VoteRow(
            userID: UUID(), q1Vetoes: [], q2Budget: 4, q3WalkMinutes: 30, q4Vibe: 0,
            q5Regret: [:]
        )
        XCTAssertEqual(VerdictStore.action(for: vote), "wanted hushed")
    }

    func testActionMapsFirstDietaryChipToFilteredAttribute() {
        let vote = VerdictStore.VoteRow(
            userID: UUID(), q1Vetoes: ["shellfish"], q2Budget: 4, q3WalkMinutes: 30, q4Vibe: 2,
            q5Regret: [:]
        )
        XCTAssertEqual(VerdictStore.action(for: vote), "filtered shellfish")
    }

    func testActionIgnoresNothingTonightChip() {
        let vote = VerdictStore.VoteRow(
            userID: UUID(), q1Vetoes: ["nothing_tonight"], q2Budget: 4, q3WalkMinutes: 30, q4Vibe: 2,
            q5Regret: [:]
        )
        XCTAssertEqual(VerdictStore.action(for: vote), "voted in",
                       "the no-op chip must not produce 'filtered nothing_tonight'")
    }

    func testActionMapsLowBudgetToCappedAtDollars() {
        let vote = VerdictStore.VoteRow(
            userID: UUID(), q1Vetoes: [], q2Budget: 2, q3WalkMinutes: 30, q4Vibe: 2,
            q5Regret: [:]
        )
        XCTAssertEqual(VerdictStore.action(for: vote), "capped at $$")
    }

    func testActionMapsLowWalkToCappedAtMinutes() {
        let vote = VerdictStore.VoteRow(
            userID: UUID(), q1Vetoes: [], q2Budget: 4, q3WalkMinutes: 10, q4Vibe: 2,
            q5Regret: [:]
        )
        XCTAssertEqual(VerdictStore.action(for: vote), "capped at 10 min walk")
    }

    // MARK: - meta line shaping

    func testMetaLineBuildsCategoryPriceWalk() {
        let payload = VerdictStore.OptionRow.Payload(
            fsqPlaceId: "x",
            name: "Pico's",
            priceTier: 2,
            walkMinutesEstimate: 8,
            dietaryTags: [],
            categories: ["Mexican"]
        )
        XCTAssertEqual(VerdictStore.metaLine(for: payload), "Mexican · $$ · 8 min walk")
    }

    func testMetaLineSkipsMissingFields() {
        let payload = VerdictStore.OptionRow.Payload(
            fsqPlaceId: "x",
            name: "Anon",
            priceTier: nil,
            walkMinutesEstimate: nil,
            dietaryTags: [],
            categories: nil
        )
        XCTAssertEqual(VerdictStore.metaLine(for: payload), "")
    }

    // MARK: - audience copy

    func testAudienceCopyForGroup() {
        XCTAssertEqual(VerdictStore.audienceCopy(forMemberCount: 4), "All four of you")
    }

    func testAudienceCopyForSolo() {
        XCTAssertEqual(VerdictStore.audienceCopy(forMemberCount: 1), "All one of you",
                       "solo group is rare; the copy should still parse — TB-09 owns the solo-flow special case")
    }

    func testAudienceCopyForLargeGroupFallsBackToNumber() {
        XCTAssertEqual(VerdictStore.audienceCopy(forMemberCount: 12), "All 12 of you")
    }
}
