// GetToIt — PlanListScreen History `Jump to Item` search tests (bug-36).
//
// History section gets a threshold-gated inline search input at
// `history.count >= 10`, per the surface §"Threshold-gated affordances"
// addendum locked 2026-05-26 in workflow-review grill #4. The search
// input is also gated on the section being expanded.
//
// These tests pin the pure helpers:
//
//   * `shouldShowHistorySearch(historyCount:isOpen:)` — threshold +
//     expand gate.
//   * `filterHistory(_:query:)` — case-insensitive substring match
//     against Plan name OR verdict place name.
//   * `historySearchPlaceholder` / `historySearchEmptyResultLabel` —
//     locked copy strings.
//
// The render-smoke coverage (under threshold no search; at threshold
// expanded with empty + matching + 0-matching filter) lives below.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class PlanListScreenHistorySearchTests: XCTestCase {

    // MARK: - copy (locked)

    /// History search placeholder. Verb-first, sentence-case in source.
    /// Locked per workflow-design hub §"Copy register". NEVER `"Find"`,
    /// `"Filter"`, `"Type to filter"`.
    func testHistorySearchPlaceholderCopy() {
        XCTAssertEqual(
            PlanListScreen.historySearchPlaceholder,
            "Search plans"
        )
    }

    /// Empty-result placeholder when an active filter matches zero
    /// rows. Locked per vault spec §"Empty filter result state".
    /// NEVER `"No results"`, `"Nothing found"`.
    func testHistorySearchEmptyResultCopy() {
        XCTAssertEqual(
            PlanListScreen.historySearchEmptyResultLabel,
            "No matching plans"
        )
    }

    /// Threshold constant — pinned at 10 per the surface §"Threshold-
    /// gated affordances" default. Future tuning is a constant edit +
    /// re-pinning this test.
    func testHistorySearchThresholdIsTen() {
        XCTAssertEqual(PlanListScreen.historySearchThreshold, 10)
    }

    // MARK: - threshold + expand gate

    /// Below the threshold the search input is suppressed even when
    /// the section is expanded — P-03 Satisficing.
    func testShouldShowHistorySearchFalseBelowThreshold() {
        XCTAssertFalse(
            PlanListScreen.shouldShowHistorySearch(historyCount: 9, isOpen: true)
        )
        XCTAssertFalse(
            PlanListScreen.shouldShowHistorySearch(historyCount: 0, isOpen: true)
        )
    }

    /// At the threshold the search input renders when expanded.
    func testShouldShowHistorySearchTrueAtThresholdExpanded() {
        XCTAssertTrue(
            PlanListScreen.shouldShowHistorySearch(historyCount: 10, isOpen: true)
        )
    }

    /// Above the threshold the search input renders when expanded.
    func testShouldShowHistorySearchTrueAboveThresholdExpanded() {
        XCTAssertTrue(
            PlanListScreen.shouldShowHistorySearch(historyCount: 25, isOpen: true)
        )
    }

    /// When the History section is collapsed the search input is
    /// hidden even if the threshold is met. Hiding the search input
    /// inside the collapsed body is part of P-09 Spatial Memory — the
    /// search field has one home (between header and first row), and
    /// it disappears with the rest of the section when collapsed.
    func testShouldShowHistorySearchFalseWhenCollapsed() {
        XCTAssertFalse(
            PlanListScreen.shouldShowHistorySearch(historyCount: 10, isOpen: false)
        )
        XCTAssertFalse(
            PlanListScreen.shouldShowHistorySearch(historyCount: 50, isOpen: false)
        )
    }

    // MARK: - filterHistory — substring match contract

    /// Empty / whitespace-only query returns the full list unchanged.
    /// A blank search field must NOT filter rows away.
    func testFilterHistoryEmptyQueryReturnsAllRows() {
        let rows = [
            Self.makeRow(name: "Friday dinner", verdict: "Pico's"),
            Self.makeRow(name: "Sunday brunch", verdict: "Bistro X")
        ]
        XCTAssertEqual(
            PlanListScreen.filterHistory(rows, query: "").map(\.plan.name),
            ["Friday dinner", "Sunday brunch"]
        )
        XCTAssertEqual(
            PlanListScreen.filterHistory(rows, query: "   ").map(\.plan.name),
            ["Friday dinner", "Sunday brunch"]
        )
    }

    /// Case-insensitive substring match against the Plan name.
    func testFilterHistoryMatchesPlanNameCaseInsensitive() {
        let rows = [
            Self.makeRow(name: "Friday dinner", verdict: "Pico's Taqueria"),
            Self.makeRow(name: "Sunday brunch", verdict: "Bistro X"),
            Self.makeRow(name: "Date night",    verdict: "Tom's Pizza")
        ]
        let filtered = PlanListScreen.filterHistory(rows, query: "FRIDAY")
        XCTAssertEqual(filtered.map(\.plan.name), ["Friday dinner"])
    }

    /// Case-insensitive substring match against the verdict place name.
    func testFilterHistoryMatchesPlaceNameCaseInsensitive() {
        let rows = [
            Self.makeRow(name: "Friday dinner", verdict: "Pico's Taqueria"),
            Self.makeRow(name: "Sunday brunch", verdict: "Bistro X"),
            Self.makeRow(name: "Date night",    verdict: "Tom's Pizza")
        ]
        let filtered = PlanListScreen.filterHistory(rows, query: "pizza")
        XCTAssertEqual(filtered.map(\.plan.name), ["Date night"])
    }

    /// A query matching neither Plan name nor place name returns zero
    /// rows — drives the "No matching plans" placeholder.
    func testFilterHistoryNoMatchesReturnsEmpty() {
        let rows = [
            Self.makeRow(name: "Friday dinner", verdict: "Pico's"),
            Self.makeRow(name: "Sunday brunch", verdict: "Bistro X")
        ]
        XCTAssertTrue(
            PlanListScreen.filterHistory(rows, query: "xyzzy").isEmpty
        )
    }

    /// A row with a nil verdict place name (no-survivor verdict) is
    /// still matchable on its Plan name.
    func testFilterHistoryMatchesPlanNameWhenPlaceIsNil() {
        let rows = [
            Self.makeRow(name: "Friday dinner", verdict: nil),
            Self.makeRow(name: "Sunday brunch", verdict: "Bistro X")
        ]
        let filtered = PlanListScreen.filterHistory(rows, query: "friday")
        XCTAssertEqual(filtered.map(\.plan.name), ["Friday dinner"])
    }

    /// A row with a nil verdict place name and a non-matching plan
    /// name does NOT match a query that would otherwise hit the place.
    func testFilterHistorySkipsRowWithNilPlaceNotMatchingName() {
        let rows = [
            Self.makeRow(name: "Friday dinner", verdict: nil)
        ]
        XCTAssertTrue(
            PlanListScreen.filterHistory(rows, query: "pico").isEmpty
        )
    }

    /// Leading / trailing whitespace on the query is trimmed before
    /// matching — a stray space after typing doesn't kill the match.
    func testFilterHistoryTrimsWhitespaceFromQuery() {
        let rows = [
            Self.makeRow(name: "Friday dinner", verdict: "Pico's")
        ]
        let filtered = PlanListScreen.filterHistory(rows, query: "  friday  ")
        XCTAssertEqual(filtered.map(\.plan.name), ["Friday dinner"])
    }

    /// Sort order of the input list is preserved in the output —
    /// filter is order-stable.
    func testFilterHistoryPreservesInputOrder() {
        let rows = [
            Self.makeRow(name: "Dinner A", verdict: "Pico's"),
            Self.makeRow(name: "Dinner B", verdict: "Pico's"),
            Self.makeRow(name: "Dinner C", verdict: "Pico's")
        ]
        let filtered = PlanListScreen.filterHistory(rows, query: "pico")
        XCTAssertEqual(filtered.map(\.plan.name), ["Dinner A", "Dinner B", "Dinner C"])
    }

    // MARK: - render smoke (snapshot stand-ins)

    /// History section under threshold (< 10 rows) — search input is
    /// absent. The view materialises without crashing.
    func testHistorySectionUnderThresholdRenders() {
        let history = Self.makeHistoryRows(count: 5)
        Self.render(Self.makeScreen(history: history))
    }

    /// History section at threshold (10 rows) expanded with an empty
    /// search query — the search input is present, all rows visible.
    func testHistorySectionAtThresholdEmptyQueryRenders() {
        let history = Self.makeHistoryRows(count: 10)
        Self.render(Self.makeScreen(history: history))
    }

    /// History section over threshold with an active matching filter.
    /// At least one row matches.
    func testHistorySectionWithActiveMatchingFilterRenders() {
        let history = Self.makeHistoryRows(count: 12)
        let screen = Self.makeScreen(history: history)
        screen.simulateHistorySearchQueryForTest("dinner-3")
        Self.render(screen)
    }

    /// History section over threshold with an active filter that
    /// matches zero rows — the "No matching plans" placeholder
    /// renders.
    func testHistorySectionWithZeroMatchFilterRenders() {
        let history = Self.makeHistoryRows(count: 12)
        let screen = Self.makeScreen(history: history)
        screen.simulateHistorySearchQueryForTest("xyzzy-no-match")
        Self.render(screen)
    }

    // MARK: - helpers

    @discardableResult
    static func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    static func makeScreen(
        history: [PlansStore.DecidedPlanRow]
    ) -> PlanListScreen {
        // Add a Pending row so the empty-state branch doesn't swallow
        // the History section in render-smoke coverage.
        let pending = PlansStore.Plan(
            id: UUID(),
            creatorID: UUID(),
            name: "Anchor pending",
            category: "food",
            scope: .solo,
            location: nil,
            sessionParameters: SessionParameters.default,
            distanceMeters: 1609,
            status: .pending,
            rerollWindowClosesAt: nil,
            createdAt: "2026-05-20T12:00:00Z",
            updatedAt: "2026-05-20T12:00:00Z"
        )
        return PlanListScreen(
            pending: [pending],
            joined: [],
            decided: [],
            history: history,
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in },
            onTapJoined: { _ in },
            onTapDecidedOrHistory: { _ in }
        )
    }

    static func makeHistoryRows(count: Int) -> [PlansStore.DecidedPlanRow] {
        (0..<count).map { idx in
            makeRow(name: "Dinner-\(idx)", verdict: "Place-\(idx)")
        }
    }

    static func makeRow(
        name: String,
        verdict: String?
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
            status: .decidedExpired,
            rerollWindowClosesAt: nil,
            verdictFiredAt: "2026-05-20T18:00:00Z",
            expiredAt: "2026-05-20T23:59:59Z",
            createdAt: "2026-05-20T12:00:00Z",
            updatedAt: "2026-05-20T12:00:00Z"
        )
        return PlansStore.DecidedPlanRow(
            plan: plan,
            role: .owner,
            verdictPlaceName: verdict
        )
    }
}
