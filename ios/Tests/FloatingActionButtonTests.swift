// GetToIt — C-26 FloatingActionButton tests (tb-WF-6).
//
// Pure-property + render-smoke coverage for the C-26 primitive that
// replaces the temp top-trailing `+` chrome glyph on `PlanListScreen`
// populated state. Spec lives at `design-system/components.md §C-26`
// and the matching JSX is `design-system/code/components.jsx`.
//
// The visual specifics (56pt diameter, glass + sun glyph, 18pt off
// trailing + bottom) are encoded as static constants on the type so
// the iOS port can pin them without rewiring the layout tree.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class FloatingActionButtonTests: XCTestCase {

    // MARK: - locked visual constants

    /// 56pt diameter per `components.md §C-26` "Visual spec → Container".
    /// Locks the size on the type so a host can't accidentally render a
    /// 40 or 64pt FAB.
    func testDiameterIsLockedAt56() {
        XCTAssertEqual(FloatingActionButton.diameter, 56)
    }

    /// 18pt off the bottom + trailing edges per the surface spec
    /// (`surfaces/00-plan-list.md §"Create affordance"`).
    func testDefaultInsetsAreLockedAt18() {
        XCTAssertEqual(FloatingActionButton.defaultTrailingInset, 18)
        XCTAssertEqual(FloatingActionButton.defaultBottomInset, 18)
    }

    /// Glyph defaults to `+`. The spec calls out `+` Inter 900 / 28 in
    /// sun-yellow; the glyph itself is the load-bearing piece — Sunset
    /// Pop locks `+` as the create verb across surfaces.
    func testDefaultGlyphIsPlus() {
        XCTAssertEqual(FloatingActionButton.defaultGlyph, "+")
    }

    /// Default accessibility label is `"Start a new plan"`. Per the
    /// spec the label describes the *action* (start a new plan), not
    /// the *shape* ("plus button"). Components.md §C-26 calls this out
    /// explicitly under "Accessibility".
    func testDefaultAccessibilityLabel() {
        XCTAssertEqual(FloatingActionButton.defaultAccessibilityLabel, "Start a new plan")
    }

    // MARK: - render smoke

    /// Default-config FAB materialises without crashing. SwiftUI's
    /// `body` shape errors surface here as a runtime crash; ensures the
    /// glass + sun + shadow composition type-checks end-to-end.
    func testRendersWithDefaultProps() {
        let view = FloatingActionButton(onTap: {})
        render(view)
    }

    /// Custom-inset render — a host that needs to coexist with an
    /// inset bottom dock can override the trailing / bottom inset.
    func testRendersWithCustomInsets() {
        let view = FloatingActionButton(
            onTap: {},
            trailingInset: 24,
            bottomInset: 32
        )
        render(view)
    }

    /// Custom-glyph render. The visual register (size, shadow, glass)
    /// is locked but the glyph is overridable for future surfaces that
    /// want a different verb glyph.
    func testRendersWithCustomGlyph() {
        let view = FloatingActionButton(onTap: {}, glyph: "?")
        render(view)
    }

    // MARK: - tap behavior

    /// Tap invokes the `onTap` callback once. The C-26 spec says the
    /// FAB emits a single tap event; the host owns navigation
    /// (`components.md §C-26 "Behavior"`).
    func testTapInvokesOnTap() {
        var taps = 0
        let view = FloatingActionButton(onTap: { taps += 1 })
        view.simulateTap()
        XCTAssertEqual(taps, 1)
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
