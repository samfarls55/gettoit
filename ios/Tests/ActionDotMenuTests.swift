// GetToIt — C-25 ActionDotMenu tests (tb-WF-9).
//
// Pure-property + render-smoke coverage for the C-25 Action Dot Menu
// primitive that lands the trailing `⋯` glyph + popover menu on the
// owned Plan cards in S00 Plan list. The component is spec'd in
// `design-system/components.md §C-25` and the matching JSX is in
// `design-system/code/components.jsx`.
//
// The visual specifics (36×36 trigger, glyph weight, dark-glass popover,
// 200pt min-width, 14pt corner radius) are encoded as static constants
// on the type so the iOS port can pin them without rewiring the layout
// tree. Tap-target gating is enforced at the type so a host can't
// accidentally render a < 44pt tap area by mistake.
//
// HARD RULE — NO RED. The destructive flag on items is informational
// only: it does NOT alter visual treatment in any way. The component
// renders every item in the same white-on-glass register. Destructive
// weight lives in the confirm sheet's copy + the C-05 white-pill
// primary, not in color. The `testDestructiveFlagDoesNotAffectColor`
// test below pins this contract at the type level so a future
// regression that paints a red destructive row fails CI.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class ActionDotMenuTests: XCTestCase {

    // MARK: - locked visual constants

    /// 36×36 trigger button per `components.md §C-25` "Visual spec —
    /// ActionDotMenuTrigger". Locks the size on the type so a host
    /// can't accidentally render a 28 or 44pt trigger by mistake.
    /// The visible button is 36pt; the surrounding card row's 14pt
    /// vertical padding pads the tap target to clear HIG 44.
    func testTriggerDiameterIsLockedAt36() {
        XCTAssertEqual(ActionDotMenu.triggerDiameter, 36)
    }

    /// Default trigger glyph `⋯` per the surface spec. Locks the
    /// character so a future "Three-dot" / "More" swap can't sneak
    /// past the type checker.
    func testTriggerGlyphIsThreeDots() {
        XCTAssertEqual(ActionDotMenu.triggerGlyph, "⋯")
    }

    /// Popover min-width per the spec (`min-width 200`). Locks the
    /// width so a single-item menu doesn't collapse below the
    /// readability target.
    func testPopoverMinWidthIsLockedAt200() {
        XCTAssertEqual(ActionDotMenu.popoverMinWidth, 200)
    }

    /// Item row min-height 44 — clears HIG.
    func testItemRowMinHeightClearsHIG() {
        XCTAssertGreaterThanOrEqual(ActionDotMenu.itemRowMinHeight, 44)
    }

    // MARK: - bug-21 — trigger hit area clears HIG 44

    /// bug-21 — the trigger's effective tap area is a separate, HIG-
    /// compliant 44pt square that surrounds the 36pt visible glyph.
    /// The visual diameter from C-25 stays locked at 36; the hit
    /// diameter is a non-visual companion constant.
    func testTriggerHitDiameterClearsHIG() {
        XCTAssertGreaterThanOrEqual(ActionDotMenu.triggerHitDiameter, 44,
                                    "trigger hit area must clear HIG 44pt minimum")
    }

    /// bug-21 — the C-25 visual diameter stays 36, the hit diameter
    /// stays 44, and the hit diameter is strictly larger than the
    /// visual diameter. Pins the "visual stays 36, hit grows to 44"
    /// fix contract at the type level so a future refactor cannot
    /// silently collapse the hit area back into the visual one.
    func testTriggerHitDiameterStrictlyExceedsVisualDiameter() {
        XCTAssertGreaterThan(ActionDotMenu.triggerHitDiameter,
                             ActionDotMenu.triggerDiameter,
                             "hit diameter (44) must strictly exceed visual diameter (36)")
    }

    /// bug-21 — the trigger's natural SwiftUI size matches the hit
    /// diameter (44), not the visual diameter (36). This is the
    /// load-bearing fact that makes a tap in the 36–44pt corona land
    /// on the menu trigger instead of falling through to the host card
    /// row. We measure via `UIHostingController.sizeThatFits` against
    /// an unbounded proposed size so the SwiftUI layout reports the
    /// trigger's intrinsic size with no parent constraints.
    func testTriggerRendersAtHitDiameter() {
        let view = ActionDotMenu.Trigger(
            isOpen: false,
            onToggle: {},
            accessibilityLabel: "More actions"
        )
        let host = UIHostingController(rootView: view)
        let unbounded = CGSize(
            width: UIView.layoutFittingCompressedSize.width,
            height: UIView.layoutFittingCompressedSize.height
        )
        let natural = host.sizeThatFits(in: unbounded)
        XCTAssertEqual(natural.width, ActionDotMenu.triggerHitDiameter, accuracy: 0.5,
                       "trigger natural width must equal HIG 44pt hit diameter")
        XCTAssertEqual(natural.height, ActionDotMenu.triggerHitDiameter, accuracy: 0.5,
                       "trigger natural height must equal HIG 44pt hit diameter")
    }

    // MARK: - item construction

    /// A plain item carries label + onSelect. The destructive flag
    /// defaults to false.
    func testItemDefaultsToNonDestructive() {
        let item = ActionDotMenu.Item(label: "Edit plan", onSelect: {})
        XCTAssertFalse(item.destructive,
                       "destructive defaults to false; only delete/leave flip it")
    }

    /// A destructive item carries the flag — informational only, the
    /// renderer does not paint it red.
    func testItemDestructiveFlag() {
        let item = ActionDotMenu.Item(
            label: "Delete plan",
            destructive: true,
            onSelect: {}
        )
        XCTAssertTrue(item.destructive)
    }

    // MARK: - render smoke

    /// Trigger materialises without crashing.
    func testTriggerRenders() {
        let view = ActionDotMenu.Trigger(
            isOpen: false,
            onToggle: {},
            accessibilityLabel: "More actions"
        )
        render(view)
    }

    /// Trigger in the open state renders. The open state paints the
    /// 0.10 white background + glyph at white 1.0; ensures the
    /// composition type-checks.
    func testTriggerOpenStateRenders() {
        let view = ActionDotMenu.Trigger(
            isOpen: true,
            onToggle: {},
            accessibilityLabel: "More actions"
        )
        render(view)
    }

    /// Popover with a single item renders.
    func testPopoverSingleItemRenders() {
        let view = ActionDotMenu.Popover(
            items: [
                ActionDotMenu.Item(label: "Leave plan", destructive: true, onSelect: {})
            ],
            onDismiss: {}
        )
        render(view)
    }

    /// Popover with two items renders.
    func testPopoverTwoItemsRenders() {
        let view = ActionDotMenu.Popover(
            items: [
                ActionDotMenu.Item(label: "Edit plan", onSelect: {}),
                ActionDotMenu.Item(label: "Delete plan", destructive: true, onSelect: {}),
            ],
            onDismiss: {}
        )
        render(view)
    }

    // MARK: - tap routing

    /// Trigger tap fires onToggle once.
    func testTriggerTapFiresOnToggle() {
        var toggles = 0
        let view = ActionDotMenu.Trigger(
            isOpen: false,
            onToggle: { toggles += 1 },
            accessibilityLabel: "More actions"
        )
        view.simulateTap()
        XCTAssertEqual(toggles, 1)
    }

    /// Popover item tap fires the item's onSelect.
    func testPopoverItemTapFiresOnSelect() {
        var selected: String?
        let view = ActionDotMenu.Popover(
            items: [
                ActionDotMenu.Item(label: "Edit plan", onSelect: { selected = "Edit plan" }),
                ActionDotMenu.Item(label: "Delete plan", destructive: true,
                                   onSelect: { selected = "Delete plan" }),
            ],
            onDismiss: {}
        )
        view.simulateItemTap(label: "Delete plan")
        XCTAssertEqual(selected, "Delete plan")
    }

    /// Scrim tap fires onDismiss.
    func testPopoverScrimTapFiresOnDismiss() {
        var dismissed = 0
        let view = ActionDotMenu.Popover(
            items: [
                ActionDotMenu.Item(label: "Leave plan", destructive: true, onSelect: {})
            ],
            onDismiss: { dismissed += 1 }
        )
        view.simulateDismiss()
        XCTAssertEqual(dismissed, 1)
    }

    // MARK: - destructive flag contract

    /// HARD RULE — the destructive flag is informational only. The
    /// renderer applies the same foreground color (white-on-glass) to
    /// every item regardless of destructive. Locking this at the
    /// type level so a future regression that paints a red destructive
    /// row fails CI.
    ///
    /// The contract is: `ActionDotMenu.itemForegroundColor(destructive:)`
    /// returns the same `.white` for both `true` and `false`.
    func testDestructiveFlagDoesNotAffectColor() {
        // The renderer uses a single foreground color resolver so a
        // host can't accidentally pass a red color into a destructive
        // item slot. Both branches return the exact same color — that's
        // the "no red anywhere in this slice" hard rule from the issue.
        let nonDestructive = ActionDotMenu.itemForegroundColor(destructive: false)
        let destructive = ActionDotMenu.itemForegroundColor(destructive: true)
        XCTAssertEqual(nonDestructive, destructive,
                       "destructive items must use the same foreground color as non-destructive — no red")
    }

    // MARK: - wfr-28 — closed-state trigger discoverability

    /// wfr-28 — the closed-state trigger glyph foreground must be the
    /// `secondary` text-on-gradient color (white 0.78), not `tertiary`
    /// (white 0.6). Pre-fix the trigger painted at 0.6 which workflow-
    /// review flagged as effectively invisible on the gradient. Open
    /// state stays at `primary` (1.0). Locked at the type level via a
    /// `triggerForegroundColor(isOpen:)` resolver so a future
    /// "soften the dot to feel less busy" regression fails CI.
    func testTriggerClosedForegroundIsSecondaryNotTertiary() {
        let closed = ActionDotMenu.triggerForegroundColor(isOpen: false)
        XCTAssertEqual(closed, GTIColor.TextOnGradient.secondary,
                       "closed-state trigger must use secondary (white 0.78) for wfr-28 discoverability — not tertiary (0.6)")
        XCTAssertNotEqual(closed, GTIColor.TextOnGradient.tertiary,
                          "closed-state trigger must NOT use tertiary (white 0.6) — too low contrast (wfr-28)")
    }

    /// wfr-28 — open-state trigger foreground stays at `primary` (white 1.0)
    /// per the C-25 spec. The discoverability bump only raises the *closed*
    /// state; the open state's full-white treatment is unchanged so the
    /// open/closed visual delta still reads.
    func testTriggerOpenForegroundIsPrimary() {
        let open = ActionDotMenu.triggerForegroundColor(isOpen: true)
        XCTAssertEqual(open, GTIColor.TextOnGradient.primary,
                       "open-state trigger must remain at primary (white 1.0)")
    }

    /// wfr-28 — the open/closed states must render in visibly distinct
    /// foregrounds so the toggle still reads after the closed-state bump.
    /// Locks the open > closed alpha relationship at the type level.
    func testTriggerOpenAndClosedForegroundsDiffer() {
        let open = ActionDotMenu.triggerForegroundColor(isOpen: true)
        let closed = ActionDotMenu.triggerForegroundColor(isOpen: false)
        XCTAssertNotEqual(open, closed,
                          "open and closed trigger foregrounds must differ to preserve the toggle's visual delta")
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
