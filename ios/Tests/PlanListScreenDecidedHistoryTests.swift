// GetToIt — PlanListScreen Decided + History pure-logic tests (tb-WF-8).
//
// The S00 Plan list (workflow-overhaul) renders three sections —
// Pending, Decided, History. tb-WF-5 shipped Pending; tb-WF-7 added
// Joined-Pending; this slice (tb-WF-8) lights up Decided + History.
//
// These tests target the pure helpers:
//
//   * `sortedDecided` — sort by `verdict_fired_at DESC`, tiebreaker
//     `created_at DESC`. Matches surface §"Ordering within sections"
//     (Q7).
//   * `sortedHistory` — sort by `expired_at DESC`, tiebreaker
//     `created_at DESC`.
//   * `isEmpty` — widened to count Decided + History rows so an
//     all-history user still sees the populated state, not the empty
//     hero.
//   * Section header labels — `"Decided"` and `"History"` per surface
//     §"Copy register".
//
// The render-smoke coverage lives in `PlanListScreenRenderTests`; the
// live PostgREST round-trip is the integration lane's job.

import XCTest
@testable import GetToIt

@MainActor
final class PlanListScreenDecidedHistoryTests: XCTestCase {

    // MARK: - section header copy (locked)

    /// Decided section header label. Title-case, single word, eyebrow
    /// token. NEVER `"Resolved"`.
    func testDecidedSectionHeaderLabel() {
        XCTAssertEqual(PlanListScreen.decidedSectionLabel, "Decided")
    }

    /// History section header label. NEVER `"Past"`.
    func testHistorySectionHeaderLabel() {
        XCTAssertEqual(PlanListScreen.historySectionLabel, "History")
    }

    // MARK: - empty-state widening (tb-WF-8)

    /// A user with only Decided rows is NOT in the empty state. The
    /// surface must render the populated state with the Decided
    /// section visible.
    func testIsNotEmptyWithAtLeastOneDecidedRow() {
        let row = Self.makeDecidedRow(name: "Friday dinner", status: .decidedActive)
        XCTAssertFalse(PlanListScreen.isEmpty(
            pending: [],
            joined: [],
            decided: [row],
            history: []
        ))
    }

    /// A user with only History rows is NOT in the empty state. The
    /// surface must render the populated state with the History
    /// section visible.
    func testIsNotEmptyWithAtLeastOneHistoryRow() {
        let row = Self.makeDecidedRow(name: "Friday dinner", status: .decidedExpired)
        XCTAssertFalse(PlanListScreen.isEmpty(
            pending: [],
            joined: [],
            decided: [],
            history: [row]
        ))
    }

    /// All four buckets empty → the empty hero renders.
    func testIsEmptyWithAllFourBucketsEmpty() {
        XCTAssertTrue(PlanListScreen.isEmpty(
            pending: [],
            joined: [],
            decided: [],
            history: []
        ))
    }

    // MARK: - sortedDecided

    /// Decided section sorts `verdict_fired_at DESC` per surface
    /// §"Ordering within sections" (Q7). The newest verdict-fire lands
    /// at the top — so a Plan that just transitioned to Decided
    /// becomes immediately visible without the user having to scroll.
    func testSortedDecidedNewestVerdictFiredFirst() {
        let earlier = Self.makeDecidedRow(
            name: "Earlier",
            status: .decidedActive,
            verdictFiredAt: "2026-05-20T12:00:00Z"
        )
        let later = Self.makeDecidedRow(
            name: "Later",
            status: .decidedActive,
            verdictFiredAt: "2026-05-20T18:00:00Z"
        )
        let middle = Self.makeDecidedRow(
            name: "Middle",
            status: .decidedActive,
            verdictFiredAt: "2026-05-20T15:00:00Z"
        )
        let sorted = PlanListScreen.sortedDecided([earlier, later, middle])
        XCTAssertEqual(sorted.map(\.plan.name), ["Later", "Middle", "Earlier"])
    }

    /// Decided rows with the same `verdict_fired_at` fall back to
    /// `created_at DESC` per the tiebreaker spec.
    func testSortedDecidedTiebreaksOnCreatedAtDesc() {
        let firedAt = "2026-05-20T18:00:00Z"
        let earlierCreated = Self.makeDecidedRow(
            name: "Earlier created",
            status: .decidedActive,
            verdictFiredAt: firedAt,
            createdAt: "2026-05-19T08:00:00Z"
        )
        let laterCreated = Self.makeDecidedRow(
            name: "Later created",
            status: .decidedActive,
            verdictFiredAt: firedAt,
            createdAt: "2026-05-19T14:00:00Z"
        )
        let sorted = PlanListScreen.sortedDecided([earlierCreated, laterCreated])
        XCTAssertEqual(sorted.first?.plan.name, "Later created")
    }

    /// A row with a nil `verdict_fired_at` sorts last — defensive
    /// against a stale row that pre-dates the tb-WF-8 column.
    func testSortedDecidedHandlesNilVerdictFiredAt() {
        let nilFired = Self.makeDecidedRow(
            name: "Nil fired",
            status: .decidedActive,
            verdictFiredAt: nil
        )
        let stamped = Self.makeDecidedRow(
            name: "Stamped",
            status: .decidedActive,
            verdictFiredAt: "2026-05-20T18:00:00Z"
        )
        let sorted = PlanListScreen.sortedDecided([nilFired, stamped])
        XCTAssertEqual(sorted.first?.plan.name, "Stamped")
        XCTAssertEqual(sorted.last?.plan.name, "Nil fired")
    }

    // MARK: - sortedHistory

    /// History section sorts `expired_at DESC` per surface
    /// §"Ordering within sections" (Q7). Newest expiry on top so a
    /// freshly-moved-to-History Plan is at the top of the section.
    func testSortedHistoryNewestExpiredFirst() {
        let earlier = Self.makeDecidedRow(
            name: "Earlier",
            status: .decidedExpired,
            expiredAt: "2026-05-19T23:59:59Z"
        )
        let later = Self.makeDecidedRow(
            name: "Later",
            status: .decidedExpired,
            expiredAt: "2026-05-20T23:59:59Z"
        )
        let sorted = PlanListScreen.sortedHistory([earlier, later])
        XCTAssertEqual(sorted.map(\.plan.name), ["Later", "Earlier"])
    }

    /// History rows with the same `expired_at` fall back to
    /// `created_at DESC`.
    func testSortedHistoryTiebreaksOnCreatedAtDesc() {
        let expiredAt = "2026-05-20T23:59:59Z"
        let earlierCreated = Self.makeDecidedRow(
            name: "Earlier created",
            status: .decidedExpired,
            expiredAt: expiredAt,
            createdAt: "2026-05-19T08:00:00Z"
        )
        let laterCreated = Self.makeDecidedRow(
            name: "Later created",
            status: .decidedExpired,
            expiredAt: expiredAt,
            createdAt: "2026-05-19T14:00:00Z"
        )
        let sorted = PlanListScreen.sortedHistory([earlierCreated, laterCreated])
        XCTAssertEqual(sorted.first?.plan.name, "Later created")
    }

    /// A row with a nil `expired_at` sorts last — defensive.
    func testSortedHistoryHandlesNilExpiredAt() {
        let nilExpired = Self.makeDecidedRow(
            name: "Nil expired",
            status: .decidedExpired,
            expiredAt: nil
        )
        let stamped = Self.makeDecidedRow(
            name: "Stamped",
            status: .decidedExpired,
            expiredAt: "2026-05-20T23:59:59Z"
        )
        let sorted = PlanListScreen.sortedHistory([nilExpired, stamped])
        XCTAssertEqual(sorted.first?.plan.name, "Stamped")
        XCTAssertEqual(sorted.last?.plan.name, "Nil expired")
    }

    // MARK: - history-collapse storage key

    /// The History collapse persistence key is scoped per signed-in
    /// user — `@AppStorage` keyed on `planList.historyOpen.<userID>`.
    /// That way two users sharing a device don't see each other's
    /// collapsed state, and a sign-out + sign-in-as-someone-else
    /// resets the state cleanly.
    func testHistoryCollapseStorageKeyIsScopedPerUser() {
        let userID = UUID()
        let key = PlanListScreen.historyOpenStorageKey(for: userID)
        // Key contains the userID's lowercase UUID string so two users
        // never collide.
        XCTAssertTrue(key.contains(userID.uuidString.lowercased()))
        // Key starts with the namespacing prefix used in the surface.
        XCTAssertTrue(key.hasPrefix("planList.historyOpen."))
    }

    // MARK: - tap routing for Created Decided/History (§"Tap behavior")

    /// Per surface §"Tap behavior": tap on a Created Decided card
    /// opens VerdictScreen with the reroll affordance. Tap on a
    /// Created History card opens VerdictScreen read-only.
    func testTapRouteForCreatedDecidedIsFullVerdict() {
        let row = Self.makeDecidedRow(
            name: "Friday dinner",
            status: .decidedActive,
            role: .owner
        )
        XCTAssertEqual(
            PlanListScreen.tapRoute(for: row),
            .createdVerdictFull
        )
    }

    func testTapRouteForCreatedHistoryIsReadOnlyVerdict() {
        let row = Self.makeDecidedRow(
            name: "Friday dinner",
            status: .decidedExpired,
            role: .owner
        )
        XCTAssertEqual(
            PlanListScreen.tapRoute(for: row),
            .createdVerdictReadOnly
        )
    }

    /// Joined cards always route through the §Q8 router (read-only),
    /// regardless of Decided-active vs Decided-expired.
    func testTapRouteForJoinedDecidedActiveIsReadOnly() {
        let row = Self.makeDecidedRow(
            name: "Alex's birthday",
            status: .decidedActive,
            role: .joined
        )
        XCTAssertEqual(
            PlanListScreen.tapRoute(for: row),
            .joinedVerdictReadOnlyActive
        )
    }

    func testTapRouteForJoinedHistoryIsReadOnlyHistory() {
        let row = Self.makeDecidedRow(
            name: "Alex's birthday",
            status: .decidedExpired,
            role: .joined
        )
        XCTAssertEqual(
            PlanListScreen.tapRoute(for: row),
            .joinedVerdictReadOnlyHistory
        )
    }

    // MARK: - tap routing off a freshly-resolved status (sg-WF-6)

    /// sg-WF-6 — `tapRoute(role:status:)` derives the destination from
    /// an explicit, freshly-fetched status rather than a stale list
    /// row. A Created Plan that is still decided-active routes to the
    /// full VerdictScreen (reroll affordance present).
    func testTapRouteRoleStatusCreatedActiveIsFullVerdict() {
        XCTAssertEqual(
            PlanListScreen.tapRoute(role: .owner, status: .decidedActive),
            .createdVerdictFull
        )
    }

    /// sg-WF-6 — the load-bearing case. A Created Plan whose list row
    /// still reads `decided-active` but whose reroll window has since
    /// closed (live status `decided-expired`) must route to the
    /// read-only verdict screen — NOT the full one. The tap path
    /// re-fetches the status and calls this overload with the fresh
    /// value, so an expired Plan never opens the reroll affordance.
    func testTapRouteRoleStatusCreatedExpiredIsReadOnlyVerdict() {
        XCTAssertEqual(
            PlanListScreen.tapRoute(role: .owner, status: .decidedExpired),
            .createdVerdictReadOnly
        )
    }

    /// sg-WF-6 — Joined cards stay read-only on both live statuses.
    func testTapRouteRoleStatusJoinedActiveIsReadOnlyActive() {
        XCTAssertEqual(
            PlanListScreen.tapRoute(role: .joined, status: .decidedActive),
            .joinedVerdictReadOnlyActive
        )
    }

    func testTapRouteRoleStatusJoinedExpiredIsReadOnlyHistory() {
        XCTAssertEqual(
            PlanListScreen.tapRoute(role: .joined, status: .decidedExpired),
            .joinedVerdictReadOnlyHistory
        )
    }

    /// sg-WF-6 — `tapRoute(for:)` and `tapRoute(role:status:)` agree
    /// when fed the same role + status: the row overload is a thin
    /// delegate over the explicit one, so a stale snapshot and a fresh
    /// re-fetch produce identical routing for identical inputs.
    func testTapRouteForRowDelegatesToRoleStatusOverload() {
        for role in [PlansStore.DecidedPlanRow.Role.owner, .joined] {
            for status in [PlansStore.LifecycleState.decidedActive, .decidedExpired] {
                let row = Self.makeDecidedRow(
                    name: "Friday dinner",
                    status: status,
                    role: role
                )
                XCTAssertEqual(
                    PlanListScreen.tapRoute(for: row),
                    PlanListScreen.tapRoute(role: role, status: status),
                    "tapRoute(for:) must delegate to tapRoute(role:status:)"
                )
            }
        }
    }

    // MARK: - History-collapse persistence (per-user, across remount)

    /// The History collapse state defaults to expanded ("first
    /// viewing" per surface §"Surface structure (locked Q1)"). A
    /// fresh PlanListScreen with no stored value reads as open.
    func testHistoryCollapseDefaultsExpandedOnFirstViewing() {
        let userID = UUID()
        // Clean slate — wipe any stored value for this user id so the
        // test is hermetic.
        UserDefaults.standard.removeObject(
            forKey: PlanListScreen.historyOpenStorageKey(for: userID)
        )
        let screen = Self.makeScreenForTest(userID: userID)
        XCTAssertTrue(
            screen.currentHistoryOpenForTest(),
            "History defaults expanded on first viewing"
        )
    }

    /// Toggling the History header writes the new value to
    /// `UserDefaults` under the per-user key, and a fresh PlanListScreen
    /// mounted with the same user id reads back the collapsed state.
    /// That is the "persists per user across launches within a session"
    /// acceptance criterion.
    func testHistoryCollapsePersistsPerUserAcrossRemount() {
        let userID = UUID()
        let key = PlanListScreen.historyOpenStorageKey(for: userID)
        UserDefaults.standard.removeObject(forKey: key)

        let first = Self.makeScreenForTest(userID: userID)
        XCTAssertTrue(first.currentHistoryOpenForTest())
        first.simulateHistoryToggle() // → collapsed

        // The collapsed value lands in UserDefaults.
        XCTAssertFalse(
            UserDefaults.standard.bool(forKey: key),
            "Toggle writes false to UserDefaults under the per-user key"
        )

        // Re-mount — the new instance reads back the collapsed value.
        let second = Self.makeScreenForTest(userID: userID)
        XCTAssertFalse(
            second.currentHistoryOpenForTest(),
            "Remount reads the prior collapsed state from UserDefaults"
        )

        // Cleanup so other tests don't see this user's state.
        UserDefaults.standard.removeObject(forKey: key)
    }

    /// Two users on the same device see independent History collapse
    /// state. User A collapsing must NOT collapse user B's History.
    func testHistoryCollapseIsIndependentBetweenUsers() {
        let userA = UUID()
        let userB = UUID()
        let keyA = PlanListScreen.historyOpenStorageKey(for: userA)
        let keyB = PlanListScreen.historyOpenStorageKey(for: userB)
        UserDefaults.standard.removeObject(forKey: keyA)
        UserDefaults.standard.removeObject(forKey: keyB)

        let screenA = Self.makeScreenForTest(userID: userA)
        screenA.simulateHistoryToggle() // userA → collapsed

        let screenB = Self.makeScreenForTest(userID: userB)
        XCTAssertTrue(
            screenB.currentHistoryOpenForTest(),
            "userB sees the default expanded state, not userA's collapsed"
        )

        UserDefaults.standard.removeObject(forKey: keyA)
        UserDefaults.standard.removeObject(forKey: keyB)
    }

    // MARK: - helpers

    static func makeScreenForTest(userID: UUID) -> PlanListScreen {
        PlanListScreen(
            pending: [],
            joined: [],
            decided: [],
            history: [],
            signedInUserID: userID,
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in },
            onTapJoined: { _ in },
            onTapDecidedOrHistory: { _ in }
        )
    }

    static func makeDecidedRow(
        name: String,
        status: PlansStore.LifecycleState,
        role: PlansStore.DecidedPlanRow.Role = .owner,
        verdictFiredAt: String? = "2026-05-20T18:00:00Z",
        expiredAt: String? = nil,
        createdAt: String? = "2026-05-20T12:00:00Z",
        verdictPlaceName: String? = "Pico's Taqueria"
    ) -> PlansStore.DecidedPlanRow {
        let plan = PlansStore.Plan(
            id: UUID(),
            creatorID: UUID(),
            name: name,
            category: "food",
            scope: .group,
            location: nil,
            sessionParameters: SessionParameters.default,
            distanceMeters: 1609,
            status: status,
            rerollWindowClosesAt: nil,
            verdictFiredAt: verdictFiredAt,
            expiredAt: expiredAt,
            createdAt: createdAt,
            updatedAt: createdAt
        )
        return PlansStore.DecidedPlanRow(
            plan: plan,
            role: role,
            verdictPlaceName: verdictPlaceName
        )
    }
}
