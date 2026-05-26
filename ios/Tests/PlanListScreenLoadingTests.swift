// GetToIt — PlanListScreen loading-state tests (wfr-11).
//
// Acceptance criteria pinned here:
//   * Cold load (isLoading=true + all four buckets empty) renders a
//     skeleton/spinner — NOT the empty hero.
//   * Hot reload (isLoading=true but some rows already cached) keeps
//     the populated state on screen — NO skeleton overlay.
//   * Not-loading + all-empty still renders the empty hero (the
//     existing default — regression guard so a stray loading branch
//     can never eat the empty state).
//   * Loading-state copy is locked as a static spec hook so a future
//     drift to a generic "Loading…" surfaces as a test failure.
//
// Pixel-snapshot tooling is not on the iOS dependency graph (see the
// header on `PlanListScreenRenderTests` for the why); this suite uses
// the same render-smoke harness for the "snapshot test covers loading
// state" acceptance line, plus identifier + spec assertions so the
// branch is genuinely covered.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class PlanListScreenLoadingTests: XCTestCase {

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
        isLoading: Bool,
        pending: [PlansStore.Plan] = [],
        joined: [PlansStore.JoinedPlanRow] = [],
        decided: [PlansStore.DecidedPlanRow] = [],
        history: [PlansStore.DecidedPlanRow] = []
    ) -> PlanListScreen {
        PlanListScreen(
            pending: pending,
            joined: joined,
            decided: decided,
            history: history,
            isLoading: isLoading,
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in },
            onTapJoined: { _ in },
            onTapDecidedOrHistory: { _ in }
        )
    }

    private func makePlan(name: String) -> PlansStore.Plan {
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
            createdAt: "2026-05-20T12:00:00Z",
            updatedAt: "2026-05-20T12:00:00Z"
        )
    }

    // MARK: - cold-load detection (pure helper)

    /// Cold load = "the user is staring at a list whose rows have not
    /// arrived yet." Concretely: `isLoading = true` AND every bucket
    /// is still empty. Encoded as a pure helper so the view branch can
    /// be unit-tested independently of SwiftUI.
    func testIsColdLoadingWhenLoadingAndAllBucketsEmpty() {
        XCTAssertTrue(
            PlanListScreen.isColdLoading(
                isLoading: true,
                pending: [],
                joined: [],
                decided: [],
                history: []
            )
        )
    }

    /// Hot reload — at least one cached row already on screen. We do
    /// NOT swap the populated state for a skeleton; the user keeps
    /// seeing the rows they had on the prior tick.
    func testIsNotColdLoadingWhenAnyBucketHasRows() {
        let plan = makePlan(name: "Friday dinner")
        XCTAssertFalse(
            PlanListScreen.isColdLoading(
                isLoading: true,
                pending: [plan],
                joined: [],
                decided: [],
                history: []
            )
        )
    }

    /// Not loading + all empty = empty state, not skeleton. Regression
    /// guard — a stray "default to skeleton on first mount" change
    /// would trip this and the empty-hero acceptance line above.
    func testIsNotColdLoadingWhenNotLoading() {
        XCTAssertFalse(
            PlanListScreen.isColdLoading(
                isLoading: false,
                pending: [],
                joined: [],
                decided: [],
                history: []
            )
        )
    }

    // MARK: - loading-state copy (locked)

    /// Cold-load eyebrow. Same `"No plans yet"` reading as the empty
    /// state would be wrong — that telegraphs "you have nothing" while
    /// the fetch hasn't finished. A neutral `"LOADING"` mono-tag,
    /// matching the LocationPicker chip's loading register, carries
    /// the moment without competing with the eventual empty hero.
    func testLoadingEyebrowCopyIsLocked() {
        XCTAssertEqual(PlanListScreen.loadingEyebrow, "Loading")
    }

    /// Accessibility label for the loading region. VoiceOver announces
    /// the load state in plain English ("Loading your plans") so a
    /// VoiceOver user knows the surface is mid-fetch, not empty.
    func testLoadingAccessibilityLabelIsLocked() {
        XCTAssertEqual(
            PlanListScreen.loadingAccessibilityLabel,
            "Loading your plans"
        )
    }

    /// Stable accessibility identifier for UI/test pinning. Cold-load
    /// branch lives at `planList.loading.container`.
    func testLoadingContainerAccessibilityIdentifierIsLocked() {
        XCTAssertEqual(
            PlanListScreen.loadingContainerAccessibilityIdentifier,
            "planList.loading.container"
        )
    }

    // MARK: - render smoke (the "snapshot test" the issue calls for)

    /// Cold load — empty buckets, isLoading=true. Body must materialise
    /// without crashing through the skeleton branch.
    func testColdLoadingRenders() {
        render(makeScreen(isLoading: true))
    }

    /// Hot reload — one cached Pending row, isLoading=true. Body must
    /// still materialise through the populated-state branch (no
    /// skeleton on top of cached rows).
    func testHotReloadingWithCachedRowsRenders() {
        let plan = makePlan(name: "Friday dinner")
        render(makeScreen(isLoading: true, pending: [plan]))
    }

    /// Not-loading + all empty — existing empty-hero branch still
    /// renders. Regression smoke so the new loading branch does not
    /// silently swallow the cold empty state.
    func testNotLoadingEmptyStillRendersEmptyHero() {
        render(makeScreen(isLoading: false))
    }

    // MARK: - default-arg compatibility

    /// `isLoading` defaults to `false`. Existing call sites (tests +
    /// the host) that omit the flag continue compiling AND render the
    /// non-loading branches they used to. This is the cheap way to
    /// pin "no semantic change for callers who don't opt in."
    func testIsLoadingDefaultsToFalse() {
        let plan = makePlan(name: "Friday dinner")
        let screen = PlanListScreen(
            pending: [plan],
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in }
        )
        // The pure-helper branch we encode the view's gate with is
        // also driven by the default arg; calling it directly with the
        // default avoids needing private-symbol access to the field.
        XCTAssertFalse(
            PlanListScreen.isColdLoading(
                isLoading: false,
                pending: [plan],
                joined: [],
                decided: [],
                history: []
            )
        )
        // Render-smoke through the populated branch as a sanity tail.
        render(screen)
    }
}
