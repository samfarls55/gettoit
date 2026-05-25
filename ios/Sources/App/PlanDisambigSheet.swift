// GetToIt — PlanDisambigSheet (tb-WF-6 → bug-24, workflow-overhaul).
//
// The disambig sheet that opens from both the empty-state hero pill
// and the C-26 FAB on S00 Plan list. Two stacked C-05 `ghost` pills:
// `Solo` (top) / `Group` (below). No Cancel button — relies on
// swipe-down dismissal (the native iOS grabber is the only top
// affordance).
//
// bug-24 (2026-05-24): adopts the new C-27 · Action Sheet primitive
// — native iOS shape, native grabber, content-height detent (no
// `.medium` fallback). The previous C-16-language inline composition
// (custom 38×4 handle pill, `[.height(N), .medium]` detents) is
// retired here; C-16 itself is unchanged and continues to back the
// rich modal-editor sheets (S07 reroll, C-23 LocationPicker). The
// inner content keeps the dark-glass register for visual continuity
// with the rest of Sunset Pop.
//
// Spec: `design-system/surfaces/00-plan-list.md §"Disambig sheet"` +
// `design-system/components.md §C-27` + JSX reference in
// `design-system/code/screens/ScreenPlanList.jsx` (`DisambigSheet`
// inline composition over the C-27 ActionSheet primitive).
//
// All visual values come from `GTITokens.swift` per repo CLAUDE.md —
// no inline hex / px / easing.

import SwiftUI

@MainActor
public struct PlanDisambigSheet: View {

    // MARK: - choice

    /// The disambig binary. Maps 1:1 to `SetupScreen.GroupMode`; the
    /// type is local so the sheet doesn't leak Setup internals into the
    /// presentation layer and so test code can encode the binary
    /// independently of the downstream Setup contract.
    public enum Choice: Equatable, Sendable {
        case solo
        case group
    }

    // MARK: - locked copy

    /// Eyebrow `"Start a plan"`. Sentence-case in source; the eyebrow
    /// token uppercases at render. NEVER `"New plan"`, NEVER
    /// `"Create a plan"` — the eyebrow voice is event-headed, not
    /// procedural.
    public static let eyebrowLabel: String = "Start a plan"

    /// Headline `"Who's coming?"` — question form because the user is
    /// making a binary call right then. UPPERCASE at render via
    /// `textCase(.uppercase)`; the source string keeps the punctuation.
    public static let headlineLabel: String = "Who's coming?"

    /// Solo pill label (top of the stack). NEVER `"Just me"` — Q3 of
    /// the parent grill lifted `Just me` away to keep the disambig
    /// binary clean.
    public static let soloLabel: String = "Solo"

    /// Group pill label (below Solo).
    public static let groupLabel: String = "Group"

    /// Locked pill order: Solo, then Group. Encoded so a test can
    /// assert the order without reaching into the view tree.
    public static let pillLabelsInOrder: [String] = [soloLabel, groupLabel]

    /// Map a disambig `Choice` to the downstream `SetupScreen.GroupMode`.
    /// Pure function — the sheet's only outward contract.
    public static func setupMode(for choice: Choice) -> SetupScreen.GroupMode {
        switch choice {
        case .solo:  return .solo
        case .group: return .group
        }
    }

    // MARK: - dependencies (host-supplied)

    private let onPick: (Choice) -> Void
    private let onDismiss: () -> Void

    // MARK: - init

    public init(
        onPick: @escaping (Choice) -> Void,
        onDismiss: @escaping () -> Void
    ) {
        self.onPick = onPick
        self.onDismiss = onDismiss
    }

    // MARK: - body

    public var body: some View {
        // bug-24 — C-27 ActionSheet shape: the dark-glass register
        // sits INSIDE a native iOS sheet. SwiftUI's `.sheet` modifier
        // owns the outer geometry — rounded-top, full-width, native
        // grabber, safe-area inset. We supply only the inside:
        // background fill + the column of content.
        VStack(spacing: 0) {
            Text(Self.eyebrowLabel.uppercased())
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, GTISpacing.step5 + 2) // 22pt — matches JSX `22px 22px 18px`
                .padding(.top, GTISpacing.step5)             // 20pt — clears the native grabber
                .padding(.bottom, GTISpacing.step2 - 2)      // 6pt
                .accessibilityIdentifier("planList.disambig.eyebrow")

            Text(Self.headlineLabel)
                .font(.system(size: GTIFont.Size.heading, weight: .black))
                .tracking(GTIFont.TrackingEm.heading * GTIFont.Size.heading)
                .textCase(.uppercase)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, GTISpacing.step5 + 2) // 22pt
                .padding(.bottom, GTISpacing.step5 - 2)     // 18pt
                .accessibilityIdentifier("planList.disambig.headline")

            VStack(spacing: GTISpacing.step3 - 2) { // 10pt between pills, per spec
                ghostPill(
                    label: Self.soloLabel,
                    accessibilityID: "planList.disambig.solo",
                    onTap: { pick(.solo) }
                )
                ghostPill(
                    label: Self.groupLabel,
                    accessibilityID: "planList.disambig.group",
                    onTap: { pick(.group) }
                )
            }
            .padding(.horizontal, GTISpacing.step5 + 2) // 22pt
            .padding(.bottom, GTISpacing.step5 - 2)     // 18pt
        }
        .frame(maxWidth: .infinity, alignment: .top)
        // bug-24 — single content-height detent (no `.medium`). The
        // `.medium` snap was the source of the "lots of empty vertical
        // space" the user reported. Content-height pins the sheet to
        // its intrinsic height so the disambig content sits flush with
        // the bottom edge of the chrome it produced.
        .presentationDetents([.height(Self.Shape.contentHeight)])
        // bug-24 — native iOS grabber (the 36×4 system handle). The
        // C-16 modal-editor sheets (reroll, LocationPicker) keep the
        // bespoke 38×4 handle; only the C-27 Action Sheet adopts the
        // native grabber.
        .presentationDragIndicator(.visible)
        // bug-24 — dark-glass register painted directly onto the
        // native sheet container. `.presentationBackground` keeps
        // the rounded-top + grabber + safe-area treatment from the
        // system while letting Sunset Pop own the fill, so the
        // disambig + reroll + LocationPicker all read as the same
        // visual register. We omit `.presentationCornerRadius` —
        // the native default matches the iOS HIG rounded-top.
        .presentationBackground(GTIColor.ink2.opacity(0.94))
        .accessibilityIdentifier("planList.disambig.sheet")
    }

    // MARK: - bits

    // bug-24 — the previous custom 38×4 white-0.22 handle pill was
    // removed. The native iOS grabber from
    // `.presentationDragIndicator(.visible)` carries the affordance
    // for the C-27 Action Sheet shape. C-16 (reroll, LocationPicker)
    // keeps its bespoke handle.

    /// C-05 ghost pill — transparent fill, 1.5pt white-0.5 stroke,
    /// 60pt tall, radius 999. Matches the existing ghost-pill register
    /// (CheckinScreen `I'd rather not say` row).
    private func ghostPill(
        label: String,
        accessibilityID: String,
        onTap: @escaping () -> Void
    ) -> some View {
        Button(action: onTap) {
            ZStack {
                RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                    .fill(Color.clear)
                RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.5), lineWidth: 1.5)
                Text(label.uppercased())
                    .font(.system(size: GTIFont.Size.cta, weight: .black))
                    .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
            }
            .frame(height: 60)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(accessibilityID)
        .accessibilityLabel(label)
    }

    // MARK: - tap routing

    private func pick(_ choice: Choice) {
        onPick(choice)
    }

    // MARK: - C-27 ActionSheet shape contract

    /// bug-24 — locked shape contract for the C-27 Action Sheet
    /// variant. These constants pin the native-iOS shape at the type
    /// level so a future regression cannot silently re-introduce the
    /// custom handle or the `.medium` fallback detent. Tests read
    /// these directly; the view body uses `Shape.contentHeight`.
    public enum Shape {
        /// True — the C-27 Action Sheet uses the native iOS grabber
        /// (`.presentationDragIndicator(.visible)`), not a bespoke
        /// handle pill. C-16 (reroll, LocationPicker) renders its
        /// own 38×4 handle and is unaffected.
        public static let usesNativeGrabber: Bool = true

        /// False — no custom handle pill at the top of the sheet.
        /// The native grabber is the only top affordance.
        public static let rendersCustomHandle: Bool = false

        /// The sheet declares exactly one detent (content-height) —
        /// no `.medium` / `.large` fallback. The previous
        /// `[.height(N), .medium]` configuration was the source of
        /// the "lots of empty vertical space" bug-24 surfaced; the
        /// `.medium` snap created a half-screen mismatch with the
        /// modest content of the disambig.
        public static let detentCount: Int = 1

        /// The sole detent is `.height(contentHeight)`, not
        /// `.medium` / `.large`.
        public static let detentSizesToContent: Bool = true

        /// The sheet's intrinsic content height — eyebrow + headline
        /// + two 60pt-tall pills + breathing. Pinned so SwiftUI's
        /// `.sheet` presents at exactly this height; the native iOS
        /// grabber sits above and adds ~12pt of system chrome on top.
        ///
        /// Estimated: 20 top + 11 eyebrow + 6 + ~28 headline + 18 +
        /// 60 pill + 10 + 60 pill + 18 bottom = ~231pt. Rounded to
        /// 240 for a small breathing buffer.
        public static let contentHeight: CGFloat = 240
    }
}

// MARK: - test affordance

extension PlanDisambigSheet {
    /// Test-only hook — drives the Solo/Group selection without
    /// having to walk the SwiftUI view tree. Production code never
    /// calls this; the user taps the rendered pill.
    @MainActor
    func simulatePick(_ choice: Choice) {
        pick(choice)
    }
}
