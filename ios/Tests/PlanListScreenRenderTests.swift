// GetToIt — PlanListScreen render smoke tests (tb-WF-5).
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

    private func makeScreen(pending: [PlansStore.Plan]) -> PlanListScreen {
        PlanListScreen(
            pending: pending,
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in }
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
}
