// GetToIt — PlanListScreen pure-logic tests (tb-WF-5).
//
// The S00 Plan list surface is the new post-sign-in landing
// (replaces S00 LandingScreen). This slice ships the foundation:
//
//   * Empty state → centered hero pill `"Create your first plan"`,
//     no top-trailing `+` glyph.
//   * Populated state → 1-line Pending cards + temp top-trailing
//     `+` chrome glyph (replaced by the real C-26 FAB in tb-WF-6).
//   * Both the hero pill AND the temp `+` route directly to Solo
//     Setup (`SetupScreen(mode: .solo)`). The disambig sheet lands
//     in tb-WF-6 — see issue body §"Out of scope".
//
// Acceptance criteria mirror the surface doc at
// `design-system/surfaces/00-plan-list.md`.
//
// These tests intentionally target the pure helpers — they encode the
// state-machine + copy invariants the issue ACs pin without depending
// on SwiftUI view materialisation (the render-smoke coverage lives in
// `PlanListScreenRenderTests`).

import XCTest
@testable import GetToIt

@MainActor
final class PlanListScreenTests: XCTestCase {

    // MARK: - empty-state detection

    /// All three sections empty (pending/decided/history) → empty
    /// state. In this slice only `pending` ever has rows; the
    /// `Decided` / `History` arrays are wired through but always
    /// empty (tb-WF-8 lights them up).
    func testIsEmptyWhenAllSectionsEmpty() {
        XCTAssertTrue(PlanListScreen.isEmpty(pending: []))
    }

    /// Even one Pending row flips to the populated state.
    func testIsNotEmptyWithAtLeastOnePending() {
        let plan = Self.makePlan(name: "Friday dinner")
        XCTAssertFalse(PlanListScreen.isEmpty(pending: [plan]))
    }

    // MARK: - empty-state hero copy (locked)

    /// Empty-state hero pill copy. `"Create your first plan"` is
    /// locked in surfaces/00-plan-list.md §"Empty state — hero pill"
    /// (Q3 of the parent grill). NEVER `"Get started"` / `"Begin"` /
    /// `"New plan"`.
    func testEmptyHeroPillCopyIsLocked() {
        XCTAssertEqual(PlanListScreen.emptyHeroPillLabel, "Create your first plan")
    }

    /// Empty-state eyebrow + body copy. Mirrors the JSX literal — the
    /// eyebrow is `"No plans yet"`, the body explains the surface.
    func testEmptyHeroEyebrowAndBodyCopyMatchTheJSX() {
        XCTAssertEqual(PlanListScreen.emptyHeroEyebrow, "No plans yet")
        XCTAssertEqual(
            PlanListScreen.emptyHeroBody,
            "This is where your Plans live — solo nights, group dinners, anything you'd rather decide once and forget."
        )
    }

    // MARK: - populated-state chrome copy

    /// Populated-state top eyebrow. `"Welcome back"` per surface
    /// §"Copy register". NEVER `"Your plans"` (label-as-title is
    /// procedural).
    func testPopulatedEyebrowCopyIsWelcomeBack() {
        XCTAssertEqual(PlanListScreen.populatedEyebrow, "Welcome back")
    }

    /// Pending section header label. Title-case, single word.
    func testPendingSectionHeaderLabel() {
        XCTAssertEqual(PlanListScreen.pendingSectionLabel, "Pending")
    }

    /// Temp `+` chrome glyph label. The chrome `+` is the populated-
    /// state create affordance until tb-WF-6 lands the C-26 FAB. The
    /// glyph itself is a literal `+` per the issue body.
    func testTempPlusChromeGlyph() {
        XCTAssertEqual(PlanListScreen.tempCreateGlyph, "+")
    }

    // MARK: - sort order

    /// Pending section sorts `created_at DESC` per surface §"Ordering
    /// within sections" (Q7). The PlansStore.fetchMine path orders by
    /// `updated_at desc` (its general-purpose order); the list query
    /// for this slice is the section-specific sort. Defensive client
    /// sort guards against a server-side order drift.
    func testSortedPendingNewestFirst() {
        let older = Self.makePlan(name: "Older", createdAt: "2026-05-19T12:00:00Z")
        let newer = Self.makePlan(name: "Newer", createdAt: "2026-05-20T12:00:00Z")
        let middle = Self.makePlan(name: "Middle", createdAt: "2026-05-19T18:00:00Z")
        let sorted = PlanListScreen.sortedPending([older, newer, middle])
        XCTAssertEqual(sorted.map(\.name), ["Newer", "Middle", "Older"])
    }

    /// A nil `createdAt` sorts last — defensive against a server row
    /// missing the column (shouldn't happen because the migration sets
    /// `default now()`, but the Codable shape allows it).
    func testSortedPendingHandlesMissingCreatedAt() {
        let nilCreated = Self.makePlan(name: "Stamped nil", createdAt: nil)
        let stamped = Self.makePlan(name: "Stamped", createdAt: "2026-05-20T12:00:00Z")
        let sorted = PlanListScreen.sortedPending([nilCreated, stamped])
        XCTAssertEqual(sorted.first?.name, "Stamped")
        XCTAssertEqual(sorted.last?.name, "Stamped nil")
    }

    // MARK: - helpers

    static func makePlan(
        name: String,
        scope: PlansStore.Scope = .solo,
        status: PlansStore.LifecycleState = .pending,
        createdAt: String? = "2026-05-20T12:00:00Z"
    ) -> PlansStore.Plan {
        PlansStore.Plan(
            id: UUID(),
            creatorID: UUID(),
            name: name,
            category: "food",
            scope: scope,
            location: nil,
            sessionParameters: SessionParameters.default,
            distanceMeters: 1609,
            status: status,
            rerollWindowClosesAt: nil,
            createdAt: createdAt,
            updatedAt: createdAt
        )
    }
}
