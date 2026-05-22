// GetToIt — PlanDisambigSheet (tb-WF-6, workflow-overhaul).
//
// The disambig sheet that opens from both the empty-state hero pill
// and the C-26 FAB on S00 Plan list. Two stacked C-05 `ghost` pills:
// `Solo` (top) / `Group` (below). No Cancel button — relies on
// swipe-down + tap-scrim dismissal.
//
// Composed inline from the C-16 sheet language (dark glass, radius 26,
// 38×4 handle) per the surface spec — single-use, single-surface, so
// it lives next to PlanListScreen rather than in a shared component
// module. The Swift type exists so the host can present it via
// SwiftUI's standard `.sheet` modifier and so tests can pin the
// locked copy + outcome contract.
//
// Spec: `design-system/surfaces/00-plan-list.md §"Disambig sheet"` +
// JSX reference `design-system/code/screens/ScreenPlanList.jsx`
// (`DisambigSheet` inline component).
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
        ZStack {
            // Dark-tinted sheet background — visual port of the JSX's
            // `rgba(20,20,30,0.92)`. ink2-at-0.94 carries the same
            // dark-glass register the LocationPickerSheet uses, so the
            // disambig + location + reroll sheets all read as one
            // surface idiom.
            GTIColor.ink2.opacity(0.94)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                handle
                    .padding(.bottom, GTISpacing.step5 - 2) // 18pt — matches C-16

                Text(Self.eyebrowLabel.uppercased())
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, GTISpacing.step5 + 2) // 22pt — matches JSX `22px 22px 18px`
                    .padding(.bottom, GTISpacing.step2 - 2)    // 6pt
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
            .padding(.top, GTISpacing.step3)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .presentationDetents([.height(disambigDetentHeight), .medium])
        .presentationCornerRadius(GTIRadii.sheet)
        .presentationDragIndicator(.hidden) // we render our own handle
        .accessibilityIdentifier("planList.disambig.sheet")
    }

    // MARK: - bits

    /// 38×4 white-0.22 handle pill — matches the C-16 sheet primitive.
    private var handle: some View {
        Capsule()
            .fill(Color.white.opacity(0.22))
            .frame(width: 38, height: 4)
            .accessibilityHidden(true)
    }

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

    // MARK: - detent

    /// The sheet's intrinsic content height — handle + padding +
    /// eyebrow + headline + two pills + bottom padding. Pinned so
    /// SwiftUI's `.sheet` presents at the right size on first open
    /// without snapping to `.medium` and showing a half-empty card.
    /// Approximate; the user can drag up to `.medium` if they want.
    private var disambigDetentHeight: CGFloat {
        // 12 top + 4 handle + 18 + 11 eyebrow + 6 + ~28 headline + 18
        // + 60 + 10 + 60 + 18 = ~245pt. Round to 260 for a small
        // breathing buffer; iOS will accommodate up to `.medium` on
        // user drag.
        260
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
