// GetToIt — PlansStore Decided + History query tests (tb-WF-8).
//
// The S00 Plan list (workflow-overhaul) renders three sections —
// Pending, Decided, History — per `surfaces/00-plan-list.md`. tb-WF-5
// shipped Pending; tb-WF-7 added Joined-Pending. This slice (tb-WF-8)
// adds Decided + History.
//
// Each Decided/History row in the iOS surface needs to render a 2-line
// card: Plan name (primary) + verdict place name (secondary). The
// canonical wire shape that backs the row is `DecidedPlanRow`, a
// flat row returned by the new SECURITY DEFINER RPCs:
//
//   * `plans_decided_for_user(p_user_id uuid)`  — status='decided-active'
//   * `plans_history_for_user(p_user_id uuid)`  — status='decided-expired'
//
// Both RPCs return the same flat shape: every `plans.*` column plus
// a `role` text column ('owner' for Created / 'joined' for Joined) and
// a `verdict_place_name` text column extracted from the linked verdict
// option's `payload->>'name'`.
//
// Live PostgREST coverage (the actual join + RLS) lives in the
// integration lane; the AFK lane stays on the unit-grade contract pin
// here per `feedback_worktree_env_not_propagated`.

import XCTest
import Supabase
@testable import GetToIt

@MainActor
final class PlansStoreDecidedHistoryTests: XCTestCase {

    // MARK: - DecidedPlanRow decoding

    /// The canonical server response: a Plan row inline-joined with the
    /// per-membership `role` projection + the verdict's place name. The
    /// iOS Decodable splits the row into the `Plan` body + the two
    /// surface-specific projections so call sites reason about them
    /// explicitly.
    func testDecidedPlanRowDecodesACanonicalServerResponse() throws {
        let json = """
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "creator_id": "22222222-2222-2222-2222-222222222222",
            "name": "Friday dinner",
            "category": "food",
            "scope": "group",
            "location": null,
            "session_params": {},
            "distance_meters": 1609,
            "status": "decided-active",
            "reroll_window_closes_at": "2026-05-22T23:59:59Z",
            "verdict_fired_at": "2026-05-20T18:30:00Z",
            "expired_at": null,
            "created_at": "2026-05-20T12:00:00Z",
            "updated_at": "2026-05-20T18:30:00Z",
            "role": "owner",
            "verdict_place_name": "Pico's Taqueria"
        }
        """.data(using: .utf8)!

        let row = try JSONDecoder().decode(PlansStore.DecidedPlanRow.self, from: json)
        XCTAssertEqual(row.plan.name, "Friday dinner")
        XCTAssertEqual(row.plan.status, .decidedActive)
        XCTAssertEqual(row.plan.verdictFiredAt, "2026-05-20T18:30:00Z")
        XCTAssertEqual(row.role, .owner)
        XCTAssertEqual(row.verdictPlaceName, "Pico's Taqueria")
    }

    /// A History (decided-expired) row carries `expired_at` and a null
    /// `reroll_window_closes_at` does not block decoding.
    func testDecidedPlanRowDecodesAHistoryRow() throws {
        let json = """
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "creator_id": "22222222-2222-2222-2222-222222222222",
            "name": "Friday dinner",
            "category": "food",
            "scope": "group",
            "location": null,
            "session_params": {},
            "distance_meters": 1609,
            "status": "decided-expired",
            "reroll_window_closes_at": null,
            "verdict_fired_at": "2026-05-19T18:30:00Z",
            "expired_at": "2026-05-20T23:59:59Z",
            "created_at": "2026-05-19T12:00:00Z",
            "updated_at": "2026-05-20T23:59:59Z",
            "role": "joined",
            "verdict_place_name": "Sushi Ren"
        }
        """.data(using: .utf8)!

        let row = try JSONDecoder().decode(PlansStore.DecidedPlanRow.self, from: json)
        XCTAssertEqual(row.plan.status, .decidedExpired)
        XCTAssertEqual(row.plan.expiredAt, "2026-05-20T23:59:59Z")
        XCTAssertEqual(row.role, .joined)
        XCTAssertEqual(row.verdictPlaceName, "Sushi Ren")
    }

    /// A null `verdict_place_name` decodes to nil — defensive against a
    /// Plan whose verdict landed without an option name (no-survivor or
    /// the place lookup failed). The card should still render with the
    /// Plan name and an empty secondary line.
    func testDecidedPlanRowDecodesWithMissingVerdictPlaceName() throws {
        let json = """
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "creator_id": "22222222-2222-2222-2222-222222222222",
            "name": "Friday dinner",
            "category": "food",
            "scope": "group",
            "location": null,
            "session_params": {},
            "distance_meters": 1609,
            "status": "decided-active",
            "reroll_window_closes_at": "2026-05-22T23:59:59Z",
            "verdict_fired_at": "2026-05-20T18:30:00Z",
            "expired_at": null,
            "created_at": "2026-05-20T12:00:00Z",
            "updated_at": "2026-05-20T18:30:00Z",
            "role": "owner",
            "verdict_place_name": null
        }
        """.data(using: .utf8)!

        let row = try JSONDecoder().decode(PlansStore.DecidedPlanRow.self, from: json)
        XCTAssertNil(row.verdictPlaceName)
    }

    // MARK: - role enum

    /// `role` is the surface-driving signal for the JOINED chip on
    /// Decided/History cards. 'owner' = Created (no chip); 'joined' =
    /// Joined (chip).
    func testRoleEnumDecodesOwnerAndJoined() throws {
        XCTAssertEqual(PlansStore.DecidedPlanRow.Role.owner.rawValue, "owner")
        XCTAssertEqual(PlansStore.DecidedPlanRow.Role.joined.rawValue, "joined")
    }

    // MARK: - Plan.verdictFiredAt / Plan.expiredAt

    /// The Plan value type carries the two new sort-key columns. They
    /// are `String?` to match the existing tb-WF-1 timestamp shape
    /// (PostgREST emits ISO-8601 with microsecond precision; the iOS
    /// UI never renders the raw timestamp directly).
    func testPlanDecodesNewLifecycleTimestamps() throws {
        let json = """
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "creator_id": "22222222-2222-2222-2222-222222222222",
            "name": "Friday dinner",
            "category": "food",
            "scope": "group",
            "location": null,
            "session_params": {},
            "distance_meters": 1609,
            "status": "decided-active",
            "reroll_window_closes_at": "2026-05-22T23:59:59Z",
            "verdict_fired_at": "2026-05-20T18:30:00Z",
            "expired_at": null,
            "created_at": "2026-05-20T12:00:00Z",
            "updated_at": "2026-05-20T18:30:00Z"
        }
        """.data(using: .utf8)!

        let plan = try JSONDecoder().decode(PlansStore.Plan.self, from: json)
        XCTAssertEqual(plan.verdictFiredAt, "2026-05-20T18:30:00Z")
        XCTAssertNil(plan.expiredAt)
    }

    /// A Plan row missing the two new timestamps decodes cleanly (the
    /// columns are nullable in the DB; an old wire shape from a stale
    /// row should still hydrate without error).
    func testPlanDecodesWithMissingLifecycleTimestamps() throws {
        let json = """
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "creator_id": "22222222-2222-2222-2222-222222222222",
            "name": "Friday dinner",
            "category": "food",
            "scope": "solo",
            "location": null,
            "session_params": {},
            "distance_meters": 1609,
            "status": "pending",
            "reroll_window_closes_at": null,
            "created_at": "2026-05-20T12:00:00Z",
            "updated_at": "2026-05-20T12:00:00Z"
        }
        """.data(using: .utf8)!

        let plan = try JSONDecoder().decode(PlansStore.Plan.self, from: json)
        XCTAssertNil(plan.verdictFiredAt)
        XCTAssertNil(plan.expiredAt)
    }

    // MARK: - query signatures

    /// `plansDecidedForList(userID:)` is the read-side query for the
    /// S00 Plan list's Decided section. The actual PostgREST round-trip
    /// is covered by the integration lane; this test pins the symbol
    /// exists with the right typed signature.
    func testPlansDecidedForListSignatureExistsOnPlansStore() async throws {
        let client = SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "test-anon-key"
        )
        let store = PlansStore(client: client)
        let _: (UUID) async throws -> [PlansStore.DecidedPlanRow] =
            store.plansDecidedForList(userID:)
    }

    /// `plansHistoryForList(userID:)` is the read-side query for the
    /// S00 Plan list's History section.
    func testPlansHistoryForListSignatureExistsOnPlansStore() async throws {
        let client = SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "test-anon-key"
        )
        let store = PlansStore(client: client)
        let _: (UUID) async throws -> [PlansStore.DecidedPlanRow] =
            store.plansHistoryForList(userID:)
    }
}
