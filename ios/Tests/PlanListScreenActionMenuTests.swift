// GetToIt — PlanListScreen action-menu tests (tb-WF-9).
//
// Pins the C-25 Action Dot Menu wiring on PlanListScreen — which menu
// items appear per (role, status), and where each item routes.
//
// The role × status × menu items table from
// `surfaces/00-plan-list.md §"Three-dot menu (locked Q4)"`:
//
// | Card               | Menu items (in order)               |
// |--------------------|--------------------------------------|
// | Created Pending    | Edit plan, Delete plan              |
// | Created Decided    | Delete plan                         |
// | Created History    | Delete plan                         |
// | Joined (any)       | Leave plan                          |
//
// HARD RULE — Joined cards NEVER show `Delete plan`. The variant
// resolver lives on `PlanListScreen` as a pure helper so the iOS port
// can pin the contract without walking the view tree.

import XCTest
@testable import GetToIt

@MainActor
final class PlanListScreenActionMenuTests: XCTestCase {

    // MARK: - Created Pending — Edit + Delete

    /// Created Pending → [Edit plan, Delete plan] in that order. Edit
    /// is first because the discoverable verb is the dominant intent;
    /// Delete is below because it is the destructive escape hatch.
    func testCreatedPendingMenuItems() {
        let items = PlanListScreen.menuItemLabels(
            role: .owner,
            status: .pending
        )
        XCTAssertEqual(items, ["Edit plan", "Delete plan"])
    }

    /// Created Decided → [Delete plan] only. Edit is suppressed because
    /// a Decided Plan's parameters are frozen (the reroll mechanism
    /// owns post-verdict mutations, not Setup edit).
    func testCreatedDecidedMenuItems() {
        let items = PlanListScreen.menuItemLabels(
            role: .owner,
            status: .decidedActive
        )
        XCTAssertEqual(items, ["Delete plan"])
    }

    /// Created History (decided-expired) → [Delete plan] only.
    func testCreatedHistoryMenuItems() {
        let items = PlanListScreen.menuItemLabels(
            role: .owner,
            status: .decidedExpired
        )
        XCTAssertEqual(items, ["Delete plan"])
    }

    // MARK: - Joined — Leave only

    /// Joined Pending → [Leave plan] only. Per the locked rule, joiners
    /// can never delete; only the Plan creator can.
    func testJoinedPendingMenuItems() {
        let items = PlanListScreen.menuItemLabels(
            role: .joined,
            status: .pending
        )
        XCTAssertEqual(items, ["Leave plan"])
    }

    /// Joined Decided-active → [Leave plan] only. Same rule.
    func testJoinedDecidedActiveMenuItems() {
        let items = PlanListScreen.menuItemLabels(
            role: .joined,
            status: .decidedActive
        )
        XCTAssertEqual(items, ["Leave plan"])
    }

    /// Joined Decided-expired → [Leave plan] only.
    func testJoinedHistoryMenuItems() {
        let items = PlanListScreen.menuItemLabels(
            role: .joined,
            status: .decidedExpired
        )
        XCTAssertEqual(items, ["Leave plan"])
    }

    // MARK: - hard rule — Joined never shows Delete plan

    /// Defensive: across every Joined status, no menu item ever
    /// contains the substring `Delete`. Pins the HARD RULE without
    /// hardcoding per-status counts.
    func testJoinedNeverShowsDeletePlan() {
        for status in PlansStore.LifecycleState.allCases {
            let items = PlanListScreen.menuItemLabels(role: .joined, status: status)
            for label in items {
                XCTAssertFalse(
                    label.contains("Delete"),
                    "Joined \(status.rawValue) menu must not contain Delete plan; got \(label)"
                )
            }
        }
    }
}
