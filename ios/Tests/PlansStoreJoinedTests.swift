// GetToIt — PlansStore Joined-Plans query tests (tb-WF-7).
//
// The S00 Plan list (workflow-overhaul) renders Plans the caller
// JOINED — Plans whose room they are a non-owner member of — alongside
// the Plans they created. This file pins the wire shape + symbol
// existence of the new `PlansStore.joinedPlansForList(userID:)` query
// and the per-joiner progress envelope it returns.
//
// Live PostgREST coverage (the actual `members → rooms → plans` join
// + RLS) lives next to the existing `*IntegrationTests` and runs in
// the iOS CI lane with real Supabase secrets — those secrets are not
// propagated to AFK worktrees (`feedback_worktree_env_not_propagated`),
// so the AFK lane stays on the unit-grade contract pin here.

import XCTest
import Supabase
@testable import GetToIt

@MainActor
final class PlansStoreJoinedTests: XCTestCase {

    // MARK: - JoinedPlanRow value type

    /// The Joined-list query returns Plans the caller did NOT create
    /// but is a member of through `rooms.plan_id`. Each row carries:
    ///   * the `Plan` itself (so the list can render name + status),
    ///   * `lastAnsweredQuestionIndex` (0..5) — the resume-from-state
    ///     signal sg-WF-4 §Q8 pinned (Pending+0 → Q1, Pending+N → Qn,
    ///     Pending+5 → Waiting; Decided* routes to Verdict regardless),
    ///   * `hasVoted` — true when the caller already wrote a `votes`
    ///     row. Distinguishes Pending+5 (finished, Waiting) from a
    ///     joiner whose progress index never updated (treat as 0).
    ///
    /// Persisting `lastAnsweredQuestionIndex` (not the answer scalars)
    /// keeps the resume signal small; the answers themselves live in
    /// `members.quiz_progress`'s `answers` slot and hydrate the
    /// coordinator on tap.
    func testJoinedPlanRowDecodesACanonicalServerResponse() throws {
        // The wire shape PostgREST returns for the list query — the
        // `plans` row inline-joined with the per-member projection of
        // `members.quiz_progress.last_index` and `votes` membership.
        let json = """
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "creator_id": "22222222-2222-2222-2222-222222222222",
            "name": "Sam's dinner",
            "category": "food",
            "scope": "group",
            "location": null,
            "session_params": {},
            "distance_meters": 1609,
            "status": "pending",
            "reroll_window_closes_at": null,
            "created_at": "2026-05-20T12:00:00Z",
            "updated_at": "2026-05-20T12:00:00Z",
            "last_answered_question_index": 3,
            "has_voted": false
        }
        """.data(using: .utf8)!

        let row = try JSONDecoder().decode(PlansStore.JoinedPlanRow.self, from: json)
        XCTAssertEqual(row.plan.name, "Sam's dinner")
        XCTAssertEqual(row.plan.status, .pending)
        XCTAssertEqual(row.lastAnsweredQuestionIndex, 3)
        XCTAssertFalse(row.hasVoted)
    }

    /// A row missing the progress fields (a joiner who hasn't started
    /// the quiz yet — `members.quiz_progress = '{}'::jsonb`) decodes
    /// with `lastAnsweredQuestionIndex = 0` and `hasVoted = false`.
    /// That is the "Pending, joiner hasn't opened the quiz" state in
    /// the §Q8 resume table.
    func testJoinedPlanRowDecodesWithMissingProgressFields() throws {
        let json = """
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "creator_id": "22222222-2222-2222-2222-222222222222",
            "name": "Sam's dinner",
            "category": "food",
            "scope": "group",
            "location": null,
            "session_params": {},
            "distance_meters": 1609,
            "status": "pending",
            "reroll_window_closes_at": null,
            "created_at": "2026-05-20T12:00:00Z",
            "updated_at": "2026-05-20T12:00:00Z"
        }
        """.data(using: .utf8)!

        let row = try JSONDecoder().decode(PlansStore.JoinedPlanRow.self, from: json)
        XCTAssertEqual(row.lastAnsweredQuestionIndex, 0,
                       "absent last_answered_question_index defaults to 0 (untouched quiz)")
        XCTAssertFalse(row.hasVoted,
                       "absent has_voted defaults to false")
    }

    /// A joiner who completed Q5 has `hasVoted = true`. The §Q8 table
    /// routes this to `WaitingScreen` (not back into the quiz).
    func testJoinedPlanRowDecodesAFinishedQuizState() throws {
        let json = """
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "creator_id": "22222222-2222-2222-2222-222222222222",
            "name": "Sam's dinner",
            "category": "food",
            "scope": "group",
            "location": null,
            "session_params": {},
            "distance_meters": 1609,
            "status": "pending",
            "reroll_window_closes_at": null,
            "created_at": "2026-05-20T12:00:00Z",
            "updated_at": "2026-05-20T12:00:00Z",
            "last_answered_question_index": 5,
            "has_voted": true
        }
        """.data(using: .utf8)!

        let row = try JSONDecoder().decode(PlansStore.JoinedPlanRow.self, from: json)
        XCTAssertEqual(row.lastAnsweredQuestionIndex, 5)
        XCTAssertTrue(row.hasVoted)
    }

    // MARK: - joinedPlansForList signature

    /// `joinedPlansForList(userID:)` is the read-side query backing
    /// the Joined section of the S00 Plan list. The actual PostgREST
    /// round-trip is covered by the integration lane; this test pins
    /// the symbol exists with the right typed signature so a future
    /// refactor can't quietly retire it.
    func testJoinedPlansForListSignatureExistsOnPlansStore() async throws {
        let client = SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "test-anon-key"
        )
        let store = PlansStore(client: client)
        // Symbol-existence + typed-signature assertion. The body is
        // not invoked — we never call the network in unit tests.
        let _: (UUID) async throws -> [PlansStore.JoinedPlanRow] = store.joinedPlansForList(userID:)
    }

    // MARK: - JoinedPlanRow is the right shape for the router

    /// The §Q8 resume-from-state table:
    ///
    /// | Joiner state                          | Destination       |
    /// |---------------------------------------|-------------------|
    /// | Pending, joiner hasn't opened quiz    | QuizScreen at Q1  |
    /// | Pending, mid-quiz                     | QuizScreen at Qn  |
    /// | Pending, joiner finished quiz         | WaitingScreen     |
    /// | Decided-active                        | Verdict read-only |
    /// | Decided-expired                       | Verdict read-only |
    ///
    /// The `JoinedTapDestination` enum encodes the five rows; the
    /// pure helper `PlanListScreen.routeFor(joinedRow:)` derives it
    /// from a `JoinedPlanRow`. Both are exercised in
    /// `PlanListScreenJoinedTests`; here we just pin the enum exists.
    func testJoinedTapDestinationEnumCoversTheFiveStates() {
        // The five cases mirror the §Q8 table row-for-row.
        let allCases: [JoinedTapDestination] = [
            .quizAtStart,
            .quizAtQuestion(index: 3),
            .waiting,
            .verdictReadOnlyActive,
            .verdictReadOnlyHistory,
        ]
        XCTAssertEqual(allCases.count, 5,
                       "five resume-from-state destinations per §Q8")
    }
}
