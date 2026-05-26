// GetToIt — C-25 Action Dot Menu (tb-WF-9, workflow-overhaul).
//
// The trailing `⋯` glyph + popover menu used on every owned Plan card
// in S00 Plan list. Reusable across future overflow surfaces (Verdict
// overflow, plan-detail row actions). A custom primitive — NOT the
// native SwiftUI `Menu` / `UIMenu` — because:
//
//   * Sunset Pop forbids red as a state color (tokens.md §1.3). The
//     native `Menu` paints `.destructive` items red; we can't supply
//     that. Our custom primitive renders every item in the same
//     white-on-glass register and pushes destructive weight into the
//     confirm sheet's copy + C-05 white-pill primary.
//   * The native menu chrome (blur, corner radius, separator weight,
//     item typography) cannot be fully restyled to match the C-16
//     dark-glass register. Owning the popover lets the menu compose
//     visually with the existing sheet idiom.
//
// Spec: `design-system/components.md §C-25` + JSX reference in
// `design-system/code/components.jsx` (`ActionDotMenuTrigger` +
// `ActionDotMenu`). Visual values lift from `GTITokens.swift` per the
// repo CLAUDE.md — no inline hex / px / easing.
//
// The primitive ships as a pair of nested types so call sites read
// `ActionDotMenu.Trigger(...)` + `ActionDotMenu.Popover(...)` and the
// shared `Item` shape is namespaced.
//
// HARD RULE — NO RED ANYWHERE. The `destructive` flag on an `Item` is
// informational only; it does NOT alter the visual treatment. The
// `itemForegroundColor(destructive:)` resolver returns the same
// white color for both flavors. Hosts that need to telegraph
// destructive intent do so via the confirm-sheet flow on tap, not by
// painting the item red.

import SwiftUI

public enum ActionDotMenu {

    // MARK: - locked visual constants

    /// 36×36 trigger button per the C-25 visual spec. This is the
    /// **visible glyph footprint**, not the tap target — bug-21
    /// flipped the tap target into its own `triggerHitDiameter` (44pt)
    /// so the visible glyph stays 36 while the hit area clears HIG.
    /// Locked at the type level so a host can't accidentally render a
    /// 28 or 44pt visible glyph by mistake.
    public static let triggerDiameter: CGFloat = 36

    /// bug-21 — 44×44 trigger **tap target** that surrounds the 36pt
    /// visible glyph. Pre-fix the trigger's rendered SwiftUI frame was
    /// 36pt — below the HIG 44pt minimum AND nested inside the
    /// PlanCard row's much larger tap target, so tap-misses fell
    /// through to the row and opened the verdict screen by accident.
    /// The fix is two-part:
    ///
    ///   1. The Trigger now renders at `triggerHitDiameter` (44),
    ///      with the visible glyph centered inside via the
    ///      `triggerDiameter`-sized background circle. `contentShape`
    ///      paints the full 44pt as the Button's tap area.
    ///   2. The Button's hit area is consumed by SwiftUI's Button
    ///      gesture recognizer before the outer card row's Button
    ///      sees the tap (inner Button wins precedence in a ZStack).
    ///
    /// C-25's locked **visual** diameter (36) is preserved.
    public static let triggerHitDiameter: CGFloat = 44

    /// Trigger glyph — `⋯` per the surface spec. Locked here so a
    /// future "Three-dot" / "More" / SF-Symbol swap can't sneak past
    /// the type checker without a deliberate spec update.
    public static let triggerGlyph: String = "⋯"

    /// Popover min-width per the C-25 visual spec (`min-width 200`).
    /// Single-item menus get the same readability target as multi-item
    /// menus.
    public static let popoverMinWidth: CGFloat = 200

    /// Item row min-height — clears HIG 44pt minimum.
    public static let itemRowMinHeight: CGFloat = 44

    /// Glyph point size for the trigger `⋯` per the JSX (Inter 900 / 18).
    private static let triggerGlyphSize: CGFloat = 18

    // MARK: - item

    /// A single menu row. `label` is the human-readable verb
    /// (`"Edit plan"`, `"Delete plan"`, `"Leave plan"`). `onSelect`
    /// fires when the row is tapped. `destructive` is informational
    /// only — it does NOT alter the visual treatment (see HARD RULE
    /// above). Hosts pass `destructive: true` so test introspection
    /// can pin which rows are routed through a confirm sheet.
    public struct Item {
        public let label: String
        public let destructive: Bool
        public let onSelect: () -> Void

        public init(
            label: String,
            destructive: Bool = false,
            onSelect: @escaping () -> Void
        ) {
            self.label = label
            self.destructive = destructive
            self.onSelect = onSelect
        }
    }

    // MARK: - foreground color resolver

    /// Foreground color for an item row. Returns the same white color
    /// for both destructive and non-destructive flavors — the HARD
    /// RULE — NO RED contract. A test pins this so a future
    /// regression that paints a red destructive row fails CI.
    public static func itemForegroundColor(destructive: Bool) -> Color {
        // Intentionally branch-agnostic. The argument exists so the
        // call sites are explicit, but both branches return the same
        // color.
        _ = destructive
        return GTIColor.TextOnGradient.primary
    }

    /// Foreground color for the trigger glyph. wfr-28 raised the
    /// closed-state weight from `tertiary` (white 0.6) to `secondary`
    /// (white 0.78) after workflow-review flagged the dot as
    /// effectively invisible on the gradient. The open state stays at
    /// `primary` (white 1.0) so the open/closed visual delta still
    /// reads. Locked here so a future "soften the dot" regression has
    /// to update the test that pins the contract.
    public static func triggerForegroundColor(isOpen: Bool) -> Color {
        isOpen
            ? GTIColor.TextOnGradient.primary
            : GTIColor.TextOnGradient.secondary
    }

    // MARK: - Trigger

    /// The always-visible `⋯` button on the host row. Owns its own
    /// visual state (default → open) and emits `onToggle` to the host.
    /// The host manages the open/close state so it can render the
    /// `Popover` only when needed.
    public struct Trigger: View {
        internal let isOpen: Bool
        internal let onToggle: () -> Void
        internal let accessibilityLabelText: String

        public init(
            isOpen: Bool,
            onToggle: @escaping () -> Void,
            accessibilityLabel: String = "More actions"
        ) {
            self.isOpen = isOpen
            self.onToggle = onToggle
            self.accessibilityLabelText = accessibilityLabel
        }

        public var body: some View {
            Button(action: onToggle) {
                // bug-21 — the visible 36pt glyph is centered inside a
                // 44pt hit area. The outer `.frame` defines the
                // button's tap footprint (HIG 44); the inner `.frame`
                // sizes the visible disc per C-25's locked 36pt visual
                // spec. `contentShape(Rectangle())` paints the full
                // 44pt as the hit-test surface so a tap in the 36–44pt
                // corona lands on the trigger instead of falling
                // through to the surrounding card row's tap target.
                ZStack {
                    Text(ActionDotMenu.triggerGlyph)
                        .font(.system(size: ActionDotMenu.triggerGlyphSize, weight: .black))
                        .foregroundStyle(
                            ActionDotMenu.triggerForegroundColor(isOpen: isOpen)
                        )
                        .frame(
                            width: ActionDotMenu.triggerDiameter,
                            height: ActionDotMenu.triggerDiameter
                        )
                        .background(
                            Circle()
                                .fill(isOpen
                                      ? GTIColor.Glass.fillSoft
                                      : Color.clear)
                        )
                        .animation(.easeOut(duration: 0.14), value: isOpen)
                }
                .frame(
                    width: ActionDotMenu.triggerHitDiameter,
                    height: ActionDotMenu.triggerHitDiameter
                )
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(accessibilityLabelText)
            .accessibilityIdentifier("planList.card.actionDot")
            .accessibilityAddTraits(.isButton)
        }
    }

    // MARK: - Popover

    /// The popover surface. Renders the items as accessible menu rows.
    /// Owns the tap-scrim that dismisses on outside tap. The host card
    /// supplies the `position: relative` wrapper around the trigger;
    /// this view paints itself anchored at the trailing-edge slot.
    ///
    /// The visual register matches the C-16 dark-glass sheet
    /// (`ink2 @ 0.92`, 14pt corner radius, 1px white-0.10 border).
    /// The fade-up open motion runs 180ms `var(--ease-out)` per the
    /// spec — `Animation.easeOut(duration: 0.18)` is the SwiftUI
    /// translation.
    public struct Popover: View {
        internal let items: [Item]
        internal let onDismiss: () -> Void

        public init(
            items: [Item],
            onDismiss: @escaping () -> Void
        ) {
            self.items = items
            self.onDismiss = onDismiss
        }

        public var body: some View {
            ZStack(alignment: .topTrailing) {
                // Tap-scrim — closes the menu on any outside tap. The
                // scrim is transparent because the popover paints on
                // top of the host surface, not against a tinted
                // backdrop (that visual is reserved for the C-16
                // confirm sheet).
                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
                    .onTapGesture { onDismiss() }
                    .accessibilityHidden(true)

                VStack(spacing: 0) {
                    ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                        itemRow(item)
                    }
                }
                .padding(GTISpacing.step2 - 2) // 6pt inner padding per spec
                .frame(minWidth: ActionDotMenu.popoverMinWidth, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(GTIColor.ink2.opacity(0.92))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(Color.white.opacity(0.10), lineWidth: 1)
                )
                .shadow(color: Color.black.opacity(0.32), radius: 16, x: 0, y: 12)
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("planList.card.actionDot.popover")
            }
        }

        /// One menu row. Min-height 44pt; padding 10×14. Fully
        /// transparent background by default — the popover container
        /// owns the dark-glass treatment. Foreground color comes from
        /// `ActionDotMenu.itemForegroundColor(destructive:)` so both
        /// destructive and non-destructive items render in the same
        /// white-on-glass register.
        private func itemRow(_ item: Item) -> some View {
            Button(action: item.onSelect) {
                HStack {
                    Text(item.label)
                        .font(.system(size: GTIFont.Size.sm, weight: .bold))
                        .tracking(0.1)
                        .foregroundStyle(
                            ActionDotMenu.itemForegroundColor(destructive: item.destructive)
                        )
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, GTISpacing.step4 - 2) // 14pt
                .padding(.vertical, GTISpacing.step3 - 2)   // 10pt
                .frame(minHeight: ActionDotMenu.itemRowMinHeight, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("planList.card.actionDot.item.\(slug(item.label))")
            .accessibilityLabel(item.label)
        }

        /// Lowercase-with-dashes slug for an accessibility identifier
        /// suffix. `"Delete plan"` → `"delete-plan"`. Stable per label.
        private func slug(_ label: String) -> String {
            label.lowercased()
                .replacingOccurrences(of: " ", with: "-")
        }
    }
}

// MARK: - test affordances

extension ActionDotMenu.Trigger {
    /// Test-only hook — drives the `onToggle` closure directly.
    /// Production code never calls this; the user taps the rendered
    /// trigger.
    @MainActor
    func simulateTap() {
        onToggle()
    }
}

extension ActionDotMenu.Popover {
    /// Test-only hook — drives a named item's `onSelect`. Looks up the
    /// item by label and invokes it directly without a view-tree walk.
    @MainActor
    func simulateItemTap(label: String) {
        guard let item = items.first(where: { $0.label == label }) else { return }
        item.onSelect()
    }

    /// Test-only hook — drives the scrim-tap dismiss.
    @MainActor
    func simulateDismiss() {
        onDismiss()
    }
}
