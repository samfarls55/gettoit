// GetToIt — PlanDestructiveConfirmSheet tests (tb-WF-9).
//
// Pins the locked copy table from `surfaces/00-plan-list.md` §"Confirm
// sheet copy (LOCKED)" and the C-16 dark-glass register the sheet uses.
//
// The copy table:
//
// | Section          | Title                    | Body                                                                                       | Primary       | Dismiss |
// |------------------|--------------------------|--------------------------------------------------------------------------------------------|---------------|---------|
// | Pending          | Delete this plan?        | Nothing's been decided yet — no one's been notified.                                       | Delete plan   | KEEP    |
// | Decided-active   | Delete this plan?        | The active room will end. Joiners will see a session-ended notice.                         | Delete plan   | KEEP    |
// | Decided-expired  | Remove from history?     | The verdict will be deleted permanently.                                                   | Remove        | KEEP    |
// | Joined (Leave)   | Leave this plan?         | Your answers will be removed. The room continues for everyone else.                        | Leave plan    | STAY    |
//
// HARD RULE — NO RED. The primary pill is `PillCTA fill="white"` for
// every variant. The destructive weight is in the copy + the sheet's
// visual register (dark glass, no celebration motion). A pure helper
// (`PlanDestructiveConfirmSheet.copyFor`) returns the same locked
// `Copy` struct for every input — tests pin the four mappings.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class PlanDestructiveConfirmSheetTests: XCTestCase {

    // MARK: - copy table (locked)

    /// Pending Created delete copy.
    func testPendingDeleteCopy() {
        let copy = PlanDestructiveConfirmSheet.copyFor(.pendingDelete)
        XCTAssertEqual(copy.title, "Delete this plan?")
        XCTAssertEqual(
            copy.body,
            "Nothing's been decided yet — no one's been notified."
        )
        XCTAssertEqual(copy.primary, "Delete plan")
        XCTAssertEqual(copy.dismiss, "KEEP")
    }

    /// Decided-active Created delete copy.
    func testDecidedActiveDeleteCopy() {
        let copy = PlanDestructiveConfirmSheet.copyFor(.decidedActiveDelete)
        XCTAssertEqual(copy.title, "Delete this plan?")
        XCTAssertEqual(
            copy.body,
            "The active room will end. Joiners will see a session-ended notice."
        )
        XCTAssertEqual(copy.primary, "Delete plan")
        XCTAssertEqual(copy.dismiss, "KEEP")
    }

    /// History (Decided-expired) Created delete copy.
    func testHistoryDeleteCopy() {
        let copy = PlanDestructiveConfirmSheet.copyFor(.historyDelete)
        XCTAssertEqual(copy.title, "Remove from history?")
        XCTAssertEqual(
            copy.body,
            "The verdict will be deleted permanently."
        )
        XCTAssertEqual(copy.primary, "Remove")
        XCTAssertEqual(copy.dismiss, "KEEP")
    }

    /// Joined Leave copy.
    func testJoinedLeaveCopy() {
        let copy = PlanDestructiveConfirmSheet.copyFor(.joinedLeave)
        XCTAssertEqual(copy.title, "Leave this plan?")
        XCTAssertEqual(
            copy.body,
            "Your answers will be removed. The room continues for everyone else."
        )
        XCTAssertEqual(copy.primary, "Leave plan")
        XCTAssertEqual(copy.dismiss, "STAY")
    }

    // MARK: - variant resolver (status + role → variant)

    /// Created Pending → pendingDelete.
    func testVariantForCreatedPending() {
        let variant = PlanDestructiveConfirmSheet.variantFor(
            role: .owner,
            status: .pending,
            verb: .delete
        )
        XCTAssertEqual(variant, .pendingDelete)
    }

    /// Created Decided-active → decidedActiveDelete.
    func testVariantForCreatedDecidedActive() {
        let variant = PlanDestructiveConfirmSheet.variantFor(
            role: .owner,
            status: .decidedActive,
            verb: .delete
        )
        XCTAssertEqual(variant, .decidedActiveDelete)
    }

    /// Created History (decided-expired) → historyDelete.
    func testVariantForCreatedHistory() {
        let variant = PlanDestructiveConfirmSheet.variantFor(
            role: .owner,
            status: .decidedExpired,
            verb: .delete
        )
        XCTAssertEqual(variant, .historyDelete)
    }

    /// Joined (any status) → joinedLeave.
    func testVariantForJoinedAnyStatus() {
        XCTAssertEqual(
            PlanDestructiveConfirmSheet.variantFor(
                role: .joined,
                status: .pending,
                verb: .leave
            ),
            .joinedLeave
        )
        XCTAssertEqual(
            PlanDestructiveConfirmSheet.variantFor(
                role: .joined,
                status: .decidedActive,
                verb: .leave
            ),
            .joinedLeave
        )
        XCTAssertEqual(
            PlanDestructiveConfirmSheet.variantFor(
                role: .joined,
                status: .decidedExpired,
                verb: .leave
            ),
            .joinedLeave
        )
    }

    // MARK: - no-red contract

    /// HARD RULE — every primary pill uses the white fill from C-05.
    /// The pill fill is encoded as a property on `Copy` so tests can
    /// pin "white, every time" without walking the view tree.
    func testPrimaryPillIsAlwaysWhite() {
        for variant in PlanDestructiveConfirmSheet.Variant.allCases {
            let copy = PlanDestructiveConfirmSheet.copyFor(variant)
            XCTAssertEqual(
                copy.primaryFill,
                .white,
                "primary pill must use white fill for every destructive variant — no red"
            )
        }
    }

    // MARK: - render smoke

    /// Render each variant — body type-checks end to end.
    func testRendersAllFourVariants() {
        for variant in PlanDestructiveConfirmSheet.Variant.allCases {
            let view = PlanDestructiveConfirmSheet(
                variant: variant,
                onConfirm: {},
                onDismiss: {}
            )
            render(view)
        }
    }

    // MARK: - tap routing

    func testPrimaryTapFiresOnConfirm() {
        var confirmed = 0
        let view = PlanDestructiveConfirmSheet(
            variant: .pendingDelete,
            onConfirm: { confirmed += 1 },
            onDismiss: {}
        )
        view.simulateConfirm()
        XCTAssertEqual(confirmed, 1)
    }

    func testDismissTapFiresOnDismiss() {
        var dismissed = 0
        let view = PlanDestructiveConfirmSheet(
            variant: .pendingDelete,
            onConfirm: {},
            onDismiss: { dismissed += 1 }
        )
        view.simulateDismiss()
        XCTAssertEqual(dismissed, 1)
    }

    // MARK: - render harness

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }
}
