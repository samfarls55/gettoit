// GetToIt — PlanListScreen destructive-action wiring tests (tb-WF-9).
//
// Pins that the host-supplied `onDeletePlan` / `onLeavePlan` callbacks
// fire with the right arguments when the user confirms the destructive
// confirm sheet. The actual destructive SQL is exercised by the
// `PlanDeleteCoordinatorTests` + the live-DB integration suite; this
// test pins the surface-to-host contract.

import XCTest
@testable import GetToIt

@MainActor
final class PlanListScreenDestructiveActionsTests: XCTestCase {

    // MARK: - delete journey

    /// Confirming `Delete plan` on a Created Pending card fires the
    /// host `onDeletePlan(plan, .pending)`.
    func testConfirmDeleteFiresOnDeletePlanForPending() {
        var deleted: (PlansStore.Plan, PlansStore.LifecycleState)?
        let plan = Self.makePlan(name: "Friday dinner", status: .pending)
        let screen = makeScreen(
            pending: [plan],
            onDeletePlan: { p, s in deleted = (p, s) }
        )
        screen.simulateDeletePlanConfirm(plan)
        XCTAssertEqual(deleted?.0.id, plan.id)
        XCTAssertEqual(deleted?.1, .pending)
    }

    /// Confirming `Delete plan` on a Created Decided-active card fires
    /// `onDeletePlan(plan, .decidedActive)`.
    func testConfirmDeleteFiresOnDeletePlanForDecidedActive() {
        var deleted: (PlansStore.Plan, PlansStore.LifecycleState)?
        let plan = Self.makePlan(name: "Friday dinner", status: .decidedActive)
        let screen = makeScreen(
            pending: [],
            onDeletePlan: { p, s in deleted = (p, s) }
        )
        screen.simulateDeletePlanConfirm(plan)
        XCTAssertEqual(deleted?.0.id, plan.id)
        XCTAssertEqual(deleted?.1, .decidedActive)
    }

    /// Confirming `Delete plan` on a Created History card fires
    /// `onDeletePlan(plan, .decidedExpired)`.
    func testConfirmDeleteFiresOnDeletePlanForHistory() {
        var deleted: (PlansStore.Plan, PlansStore.LifecycleState)?
        let plan = Self.makePlan(name: "Friday dinner", status: .decidedExpired)
        let screen = makeScreen(
            pending: [],
            onDeletePlan: { p, s in deleted = (p, s) }
        )
        screen.simulateDeletePlanConfirm(plan)
        XCTAssertEqual(deleted?.0.id, plan.id)
        XCTAssertEqual(deleted?.1, .decidedExpired)
    }

    // MARK: - leave journey

    /// Confirming `Leave plan` on a Joined Pending card fires the host
    /// `onLeavePlan(row)` with the matching row.
    func testConfirmLeaveFiresOnLeavePlan() {
        var leftRow: PlansStore.JoinedPlanRow?
        let row = PlansStore.JoinedPlanRow(
            plan: Self.makePlan(name: "Alex's birthday", status: .pending),
            lastAnsweredQuestionIndex: 0,
            hasVoted: false
        )
        let screen = makeScreen(
            pending: [],
            joined: [row],
            onLeavePlan: { r in leftRow = r }
        )
        screen.simulateLeavePlanConfirm(row)
        XCTAssertEqual(leftRow?.plan.id, row.plan.id)
    }

    // MARK: - render harness

    private func makeScreen(
        pending: [PlansStore.Plan],
        joined: [PlansStore.JoinedPlanRow] = [],
        onDeletePlan: @escaping (PlansStore.Plan, PlansStore.LifecycleState) -> Void = { _, _ in },
        onLeavePlan: @escaping (PlansStore.JoinedPlanRow) -> Void = { _ in }
    ) -> PlanListScreen {
        PlanListScreen(
            pending: pending,
            joined: joined,
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in },
            onTapJoined: { _ in },
            onTapDecidedOrHistory: { _ in },
            onDeletePlan: onDeletePlan,
            onLeavePlan: onLeavePlan
        )
    }

    static func makePlan(
        name: String,
        status: PlansStore.LifecycleState = .pending,
        createdAt: String? = "2026-05-20T12:00:00Z"
    ) -> PlansStore.Plan {
        PlansStore.Plan(
            id: UUID(),
            creatorID: UUID(),
            name: name,
            category: "food",
            scope: .solo,
            location: nil,
            sessionParameters: SessionParameters.default,
            distanceMeters: 1609,
            status: status,
            rerollWindowClosesAt: nil,
            verdictFiredAt: status == .decidedActive ? "2026-05-20T18:00:00Z" : nil,
            expiredAt: status == .decidedExpired ? "2026-05-20T23:59:59Z" : nil,
            createdAt: createdAt,
            updatedAt: createdAt
        )
    }
}
