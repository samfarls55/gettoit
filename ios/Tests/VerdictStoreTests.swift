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
        // TB-13 — solo audience reads bare `"You"`. The communal frame
        // `"All N of you"` doesn't apply to a single voice. The S05
        // solo variant time badge surfaces this copy directly. See
        // `surfaces/05-verdict.md` §"solo".
        XCTAssertEqual(VerdictStore.audienceCopy(forMemberCount: 1), "You",
                       "solo time-badge audience reads 'You' (singular) — no communal frame")
    }

    func testAudienceCopyForLargeGroupFallsBackToNumber() {
        XCTAssertEqual(VerdictStore.audienceCopy(forMemberCount: 12), "All 12 of you")
    }

    // MARK: - VoteRow decoder — Q5 slot tolerance (TB-24)

    /// TB-24 moved the Q5 write to the factorial probe shape
    /// (`answer.ratings`), dropping the pre-tb-23 per-venue
    /// `answer.scores` map. `VerdictStore.VoteRow` reads live `votes`
    /// rows for the verdict screen, so its decoder must tolerate a Q5
    /// slot with no `scores` key — otherwise reading any freshly
    /// written vote row would throw.
    func testVoteRowDecodesAQ5SlotCarryingTheFactorialRatingsShape() throws {
        let json = """
        {
          "user_id": "00000000-0000-0000-0000-000000000001",
          "q1": { "meta": { "question_kind": "cuisine_craving" },
                  "answer": { "cuisines": ["thai"], "no_preference": false } },
          "q2": { "meta": { "question_kind": "budget_cap" },
                  "answer": { "tier": 3 } },
          "q3": { "meta": { "question_kind": "reputation" },
                  "answer": { "reputation": "popular" } },
          "q4": { "meta": { "question_kind": "vibe" },
                  "answer": { "level": 2 } },
          "q5": { "meta": { "question_kind": "regret" },
                  "answer": { "ratings": [
                    { "droppedAxis": "cuisine", "score": 4 },
                    { "droppedAxis": "reputation", "score": 2 },
                    { "droppedAxis": "vibe", "score": 5 }
                  ] } }
        }
        """.data(using: .utf8)!

        // The decode must not throw on the missing `answer.scores`.
        let row = try JSONDecoder().decode(VerdictStore.VoteRow.self, from: json)
        XCTAssertEqual(row.q2Budget, 3)
        XCTAssertEqual(row.q4Vibe, 2)
        // The verdict screen never reads `q5Regret` — server-side
        // scoring, tb-23 — so an absent `scores` map resolves to empty.
        XCTAssertEqual(row.q5Regret, [:],
            "a factorial-shape Q5 slot yields an empty legacy score map")
    }

    /// A surviving legacy row that still carries `answer.scores` keeps
    /// decoding into `q5Regret` — the decoder stays back-compatible.
    func testVoteRowStillDecodesALegacyQ5ScoresSlot() throws {
        let json = """
        {
          "user_id": "00000000-0000-0000-0000-000000000002",
          "q1": { "meta": { "question_kind": "cuisine_craving" },
                  "answer": { "cuisines": [], "no_preference": true } },
          "q2": { "meta": { "question_kind": "budget_cap" },
                  "answer": { "tier": 4 } },
          "q3": { "meta": { "question_kind": "reputation" },
                  "answer": { "reputation": "no_preference" } },
          "q4": { "meta": { "question_kind": "vibe" },
                  "answer": { "level": 1 } },
          "q5": { "meta": { "question_kind": "regret" },
                  "answer": { "scores": { "fsq-a": 5, "fsq-b": 2 } } }
        }
        """.data(using: .utf8)!

        let row = try JSONDecoder().decode(VerdictStore.VoteRow.self, from: json)
        XCTAssertEqual(row.q5Regret, ["fsq-a": 5, "fsq-b": 2])
    }
}
