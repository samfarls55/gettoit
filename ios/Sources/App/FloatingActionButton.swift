// GetToIt — C-26 FloatingActionButton (tb-WF-6, workflow-overhaul).
//
// The bottom-right circular create button on S00 Plan list, and the
// canonical Sunset Pop FAB primitive for any future surface needing a
// single persistent create affordance. Ink-2 body, sun-yellow glyph,
// sun-tinted halo, 56pt diameter. Sits anchored 18pt off the trailing +
// bottom edges of the host surface.
//
// Spec: `design-system/components.md §C-26` + JSX reference in
// `design-system/code/components.jsx` (`FloatingActionButton`). Visual
// values lift from `GTITokens.swift` per repo CLAUDE.md — no inline
// hex / px / easing.
//
// Visual register: T1 ink-fill (bug-23, 2026-05-24). Replaces the
// original glass body + black-0.18 shadow combo that broke
// `impeccable`'s "Glassmorphism as default" absolute ban — see
// `components.md §C-26 → "Why ink-fill"` for the full rationale. The
// SwiftUI port drops `.ultraThinMaterial` glass + the white-stroke
// border overlay, switches the disc to `GTIColor.ink2`, and applies the
// new `GTIShadow.fab` sun-tinted halo via the generated `.gtiShadow(_:)`
// helper. The 0.08-white inset highlight from the CSS `--shadow-fab`
// recipe is intentionally dropped on iOS — it does not read on a 56pt
// disc and SwiftUI does not natively render multi-stop shadows; the
// outer sun halo is the load-bearing piece.
//
// Behavior — single tap target; the FAB emits `onTap`, the host owns
// navigation. On the Plan list the host opens the disambig sheet.
//
// The FAB suppresses itself in the empty-state hero by host
// composition (the Plan list never mounts it when its `isEmpty` branch
// renders). The FAB itself doesn't carry empty-state awareness — the
// host owns that.

import SwiftUI

@MainActor
public struct FloatingActionButton: View {

    // MARK: - locked visual constants

    /// 56pt diameter per the C-26 visual spec. Locked at the type level
    /// so a host can't accidentally render a 40 or 64pt FAB by mistake.
    public static let diameter: CGFloat = 56

    /// Default trailing inset — 18pt off the trailing edge of the host
    /// surface. Matches the surface spec `surfaces/00-plan-list.md
    /// §"Create affordance — populated state"`.
    public static let defaultTrailingInset: CGFloat = 18

    /// Default bottom inset — 18pt off the bottom edge of the host
    /// surface.
    public static let defaultBottomInset: CGFloat = 18

    /// Default glyph — `+`. The verb glyph for the create affordance
    /// across Sunset Pop surfaces.
    public static let defaultGlyph: String = "+"

    /// Default accessibility label. Describes the *action* ("Start a
    /// new plan"), not the *shape* ("plus button") — per the C-26
    /// accessibility note.
    public static let defaultAccessibilityLabel: String = "Start a new plan"

    /// 28pt glyph size per the spec. Locked here so any host overriding
    /// the glyph (default `+`) still renders at the correct weight.
    private static let glyphSize: CGFloat = 28

    /// Pressed-state scale — 0.96 per the C-26 spec "Pressed" row.
    private static let pressedScale: CGFloat = 0.96

    // MARK: - dependencies (host-supplied)

    private let onTap: () -> Void
    private let glyph: String
    private let trailingInset: CGFloat
    private let bottomInset: CGFloat
    private let accessibilityLabelText: String

    // MARK: - init

    public init(
        onTap: @escaping () -> Void,
        glyph: String = FloatingActionButton.defaultGlyph,
        trailingInset: CGFloat = FloatingActionButton.defaultTrailingInset,
        bottomInset: CGFloat = FloatingActionButton.defaultBottomInset,
        accessibilityLabel: String = FloatingActionButton.defaultAccessibilityLabel
    ) {
        self.onTap = onTap
        self.glyph = glyph
        self.trailingInset = trailingInset
        self.bottomInset = bottomInset
        self.accessibilityLabelText = accessibilityLabel
    }

    // MARK: - body

    public var body: some View {
        Button(action: onTap) {
            // T1 ink-fill body per the C-26 spec — `GTIColor.ink2`
            // disc, no border, sun-tinted `GTIShadow.fab` halo. Glass
            // + black-shadow combo retired in bug-23 (see file header
            // for the full rationale). `components.md §C-26 → SwiftUI
            // primitive` codifies this shape.
            Text(glyph)
                .font(.system(size: Self.glyphSize, weight: .black))
                .foregroundStyle(GTIColor.sun)
                .frame(width: Self.diameter, height: Self.diameter)
                .background(GTIColor.ink2, in: Circle())
                .gtiShadow(GTIShadow.fab)
        }
        .buttonStyle(FABPressStyle())
        .accessibilityLabel(accessibilityLabelText)
        .accessibilityIdentifier("planList.fab")
        .padding(.trailing, trailingInset)
        .padding(.bottom, bottomInset)
    }
}

// MARK: - press style

/// Press style that drives the C-26 spec's `scale(0.96)` pressed-state
/// over a 140ms ease-out curve.
private struct FABPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.96 : 1.0)
            .animation(.easeOut(duration: 0.14), value: configuration.isPressed)
    }
}

// MARK: - test affordance

extension FloatingActionButton {
    /// Test-only hook — drives the `onTap` closure directly. SwiftUI
    /// doesn't expose a synchronous "press the button" API in the
    /// unit-test target, so the surface owns a tiny shim. Production
    /// code never calls this.
    @MainActor
    func simulateTap() {
        onTap()
    }
}
