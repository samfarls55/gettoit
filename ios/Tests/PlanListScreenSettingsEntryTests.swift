// GetToIt — PlanListScreen settings-entry coverage (wfr-06).
//
// Issue: wfr-06 — `SettingsScreen` had no UI entry point anywhere in
// the app. The S00 Plan list is the post-sign-in landing surface, and
// the workflow-design hub's `Sign-In Tools` pattern reserves the
// top-trailing slot for account/settings tooling. This slice wires
// a settings chrome glyph into PlanListScreen's top bar so the
// existing `RootView.showingSettings` route finally has an entry
// affordance.
//
// Acceptance criteria pinned here:
//   1. PlanListScreen exposes a stable accessibility identifier for
//      the settings chrome glyph (`planList.settings.glyph`) and a
//      locked accessibility label so VoiceOver users can find it.
//   2. PlanListScreen takes an `onOpenSettings` callback the host
//      wires to `showingSettings = true`. The init defaults to a
//      no-op so existing call sites compile unchanged.
//   3. A test-only `simulateOpenSettings()` hook drives the callback
//      so we can assert the host wiring without mounting a UI test.
//   4. The render harness materialises the populated state with the
//      glyph present (render-smoke — guarantees the trailing slot
//      type-checks and lays out).
//   5. Empty state also exposes a settings entry point — a first-
//      launch user with zero plans must still be able to reach
//      Settings (App Store guideline 5.1.1(v) — account deletion
//      must be "easily discoverable").

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class PlanListScreenSettingsEntryTests: XCTestCase {

    // MARK: - identifiers + copy locks

    /// The settings chrome glyph's accessibility identifier is stable
    /// (`planList.settings.glyph`). UI test harnesses + future a11y
    /// audits pin this — changing it is a breaking contract.
    func testSettingsGlyphAccessibilityIdentifierIsLocked() {
        XCTAssertEqual(
            PlanListScreen.settingsGlyphAccessibilityIdentifier,
            "planList.settings.glyph"
        )
    }

    /// The settings chrome glyph's VoiceOver label is `"Settings"`.
    /// Single noun, sentence-case in source. NEVER `"Open settings"`,
    /// `"Account"`, or `"Gear"` (which describe the icon, not the
    /// destination).
    func testSettingsGlyphAccessibilityLabelIsLocked() {
        XCTAssertEqual(
            PlanListScreen.settingsGlyphAccessibilityLabel,
            "Settings"
        )
    }

    // MARK: - host wiring (callback)

    /// Tapping the settings chrome glyph fires the host's
    /// `onOpenSettings` callback exactly once. The host flips
    /// `RootView.showingSettings = true`; SettingsScreen renders via
    /// the existing precedence chain.
    func testOpenSettingsCallbackFiresOnSimulatedTap() {
        var calls = 0
        let screen = PlanListScreen(
            pending: [],
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in },
            onTapJoined: { _ in },
            onTapDecidedOrHistory: { _ in },
            onOpenSettings: { calls += 1 }
        )
        screen.simulateOpenSettings()
        XCTAssertEqual(calls, 1)
    }

    /// `onOpenSettings` defaults to a no-op so pre-wfr-06 call sites
    /// compile unchanged. The default closure must not crash when
    /// invoked.
    func testOpenSettingsDefaultsToNoOp() {
        let screen = PlanListScreen(
            pending: [],
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in },
            onTapJoined: { _ in },
            onTapDecidedOrHistory: { _ in }
        )
        // Should not crash — the default is { }.
        screen.simulateOpenSettings()
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

    /// Populated state renders with the settings chrome glyph in the
    /// top bar — render-smoke. The view tree must lay out without
    /// crashing.
    func testPopulatedStateWithSettingsGlyphRenders() {
        let screen = PlanListScreen(
            pending: [makePlan(name: "Friday dinner")],
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in },
            onTapJoined: { _ in },
            onTapDecidedOrHistory: { _ in },
            onOpenSettings: {}
        )
        render(screen)
    }

    /// Empty state also exposes a settings entry — a first-launch user
    /// with zero plans must still be able to reach Settings (App Store
    /// 5.1.1(v) — account deletion must be discoverable from a cold
    /// launch). Render-smoke; the chrome glyph's a11y identifier is
    /// the actual contract.
    func testEmptyStateWithSettingsGlyphRenders() {
        let screen = PlanListScreen(
            pending: [],
            onRequestDisambig: {},
            onPickGroupMode: { _ in },
            onTapPlan: { _ in },
            onTapJoined: { _ in },
            onTapDecidedOrHistory: { _ in },
            onOpenSettings: {}
        )
        render(screen)
    }
}
