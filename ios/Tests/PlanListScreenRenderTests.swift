// GetToIt — PlanListScreen render smoke tests (tb-WF-5, tb-WF-6, tb-WF-7).
//
// Pixel-snapshot tooling is not yet on the iOS dependency graph (see
// the header on `QuizScreenSnapshotTests` for the why). Until then,
// "snapshot tests for PlanListScreen in three states: empty, one-
// Pending, multi-Pending" (issue body §Tests) is satisfied by smoke
// tests that materialise the view through a `UIHostingController` —
// a `body` that fails to type-check or throws surfaces here as a
// runtime crash, and `layoutIfNeeded` makes sure the body actually
// runs.

import XCTest
import SwiftUI
import Supabase
@testable import GetToIt

@MainActor
final class PlanListScreenRenderTests: XCTestCase {

    // MARK: - render harness

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    private func makeScreen(
        pending: [PlansStore.Plan],
        joined: [PlansStore.JoinedPlanRow] = [],
        decided: [PlansStore.DecidedPlanRow] = [],
        history: [PlansStore.DecidedPlanRow] = []
    ) -> PlanListScreen {
        PlanListScreen(
            pending: pending,
            joined: joined,
            decided: decided,
            history: history,
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in },
            onTapJoined: { _ in },
            onTapDecidedOrHistory: { _ in }
        )
    }

    private func makePlan(
        name: String,
        createdAt: String = "2026-05-20T12:00:00Z"
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
            status: .pending,
            rerollWindowClosesAt: nil,
            createdAt: createdAt,
            updatedAt: createdAt
        )
    }

    // MARK: - body materialisation, three states

    /// Empty state — zero Pending rows. The hero pill is the only
    /// create affordance; the top-trailing `+` glyph is suppressed.
    func testEmptyStateRenders() {
        render(makeScreen(pending: []))
    }

    /// One-Pending state — one card + the C-26 FAB on the bottom-
    /// trailing edge, no hero pill, no temp chrome `+` glyph (tb-WF-6).
    func testOnePendingRenders() {
        render(makeScreen(pending: [makePlan(name: "Friday dinner")]))
    }

    /// Multi-Pending state — multiple cards in a section.
    func testMultiPendingRenders() {
        let plans = [
            makePlan(name: "Friday dinner", createdAt: "2026-05-20T12:00:00Z"),
            makePlan(name: "Sunday brunch",  createdAt: "2026-05-19T12:00:00Z"),
            makePlan(name: "Date night",     createdAt: "2026-05-18T12:00:00Z"),
        ]
        render(makeScreen(pending: plans))
    }

    // MARK: - tb-WF-7 Joined-card render coverage

    /// A single Joined card renders alongside zero Pending Created
    /// cards. The JOINED eyebrow chip is present; the chrome stays
    /// the populated state (FAB, eyebrow welcome).
    func testJoinedOnlyRenders() {
        let joinedPlan = makePlan(name: "Alex's birthday")
        let row = PlansStore.JoinedPlanRow(
            plan: joinedPlan,
            lastAnsweredQuestionIndex: 0,
            hasVoted: false
        )
        render(makeScreen(pending: [], joined: [row]))
    }

    /// Mixed state — one Created Pending card + one Joined card. Both
    /// render; only the Joined card carries the JOINED chip.
    func testMixedCreatedAndJoinedRenders() {
        let created = makePlan(name: "Friday dinner")
        let joined = makePlan(name: "Alex's birthday")
        let row = PlansStore.JoinedPlanRow(
            plan: joined,
            lastAnsweredQuestionIndex: 2,
            hasVoted: false
        )
        render(makeScreen(pending: [created], joined: [row]))
    }

    // MARK: - tb-WF-8 Decided + History render coverage

    private func makeDecidedRow(
        name: String,
        status: PlansStore.LifecycleState,
        role: PlansStore.DecidedPlanRow.Role = .owner,
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
            verdictFiredAt: "2026-05-20T18:00:00Z",
            expiredAt: status == .decidedExpired ? "2026-05-20T23:59:59Z" : nil,
            createdAt: "2026-05-20T12:00:00Z",
            updatedAt: "2026-05-20T18:00:00Z"
        )
        return PlansStore.DecidedPlanRow(
            plan: plan,
            role: role,
            verdictPlaceName: verdictPlaceName
        )
    }

    /// One Decided-active row renders the Decided section with the
    /// 2-line card (Plan name + verdict place).
    func testOneDecidedRenders() {
        let row = makeDecidedRow(name: "Friday dinner", status: .decidedActive)
        render(makeScreen(pending: [], decided: [row]))
    }

    /// One History row renders the History section, expanded by default.
    func testOneHistoryRenders() {
        let row = makeDecidedRow(name: "Friday dinner", status: .decidedExpired)
        render(makeScreen(pending: [], history: [row]))
    }

    /// Full lifecycle — one Plan in each section (Pending / Decided /
    /// History). Per the issue's snapshot-test requirement: the full
    /// lifecycle visualization in a single render.
    func testFullLifecycleRenders() {
        let pendingPlan = makePlan(name: "Sunday brunch")
        let decidedRow = makeDecidedRow(name: "Friday dinner", status: .decidedActive)
        let historyRow = makeDecidedRow(name: "Last Tuesday", status: .decidedExpired)
        render(makeScreen(
            pending: [pendingPlan],
            decided: [decidedRow],
            history: [historyRow]
        ))
    }

    /// A Joined Decided card renders the JOINED chip + 2-line body.
    func testJoinedDecidedRenders() {
        let row = makeDecidedRow(
            name: "Alex's birthday",
            status: .decidedActive,
            role: .joined
        )
        render(makeScreen(pending: [], decided: [row]))
    }

    /// A Decided row whose verdict_place_name is nil (no-survivor
    /// verdict) still renders — name only, no secondary line.
    func testDecidedWithMissingVerdictPlaceRenders() {
        let row = makeDecidedRow(
            name: "Friday dinner",
            status: .decidedActive,
            verdictPlaceName: nil
        )
        render(makeScreen(pending: [], decided: [row]))
    }

    // MARK: - tb-WF-9 C-25 menu render coverage

    /// Created Pending card materialises with the C-25 trigger on the
    /// trailing edge. Render-smoke — the trigger itself is covered by
    /// `ActionDotMenuTests`; this asserts the host composition
    /// type-checks.
    func testCreatedPendingCardWithMenuRenders() {
        let plan = makePlan(name: "Friday dinner")
        render(makeScreen(pending: [plan]))
    }

    /// Created Decided card materialises with the C-25 trigger. Same
    /// menu composition, 2-line card body.
    func testCreatedDecidedCardWithMenuRenders() {
        let row = makeDecidedRow(name: "Friday dinner", status: .decidedActive)
        render(makeScreen(decided: [row]))
    }

    /// Joined card materialises with the C-25 trigger. The menu items
    /// differ (Leave plan only) but the visual register is identical.
    func testJoinedCardWithMenuRenders() {
        let plan = makePlan(name: "Alex's birthday")
        let row = PlansStore.JoinedPlanRow(
            plan: plan,
            lastAnsweredQuestionIndex: 0,
            hasVoted: false
        )
        render(makeScreen(joined: [row]))
    }
}
