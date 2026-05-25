// GetToIt — Q1 · Cuisine craving (TB-06).
//
// Multi-select cuisine chips, capped at 3 picks, with a mutually-
// exclusive "No preference" chip. A soft scoring signal — dietary
// vetoes moved to the profile in the quiz redesign. Spec:
// `design-system/surfaces/03-quiz.md` §"Q1 — Cuisine craving" +
// the C-04 Chip component (`design-system/components.md` §C-04).
//
// Cap behavior: once 3 cuisines are selected, the remaining unselected
// chips render in C-04's `disabled` state (dimmed, non-interactive).
// Selecting "No preference" clears every cuisine; selecting a cuisine
// clears "No preference".
//
// All copy on this surface except the canonical Q-counter is
// `// placeholder: marketing-branding pass`.

import SwiftUI

@MainActor
public struct QuizQ1Cuisine: View {
    let coordinator: QuizCoordinator

    public init(coordinator: QuizCoordinator) {
        self.coordinator = coordinator
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer().frame(height: GTISpacing.step10)

            // placeholder: marketing-branding pass
            QuizQuestionHeader(
                index: 1,
                title: "What are you craving?",
                sub: "Pick up to 3 — or tap No preference."
            )

            chipGrid
                .padding(.top, GTISpacing.step6)
                .padding(.horizontal, GTISpacing.step5)

            Spacer(minLength: 0)

            // placeholder: marketing-branding pass
            QuizPrimaryCTA(label: "Next") {
                coordinator.advance()
            }
        }
    }

    private var chipGrid: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step4) {
            QuizChipFlow(items: QuizCuisine.displayOrder) { entry in
                let isSel = coordinator.q1Cuisines.contains(entry.id)
                // A chip is disabled when the 3-cap is full AND this
                // chip isn't already one of the selected three (a
                // selected chip must always stay tappable to deselect).
                let isDisabled = !isSel && !coordinator.q1HasFreeCuisineSlot
                cuisineChip(entry: entry, selected: isSel, disabled: isDisabled)
            }

            // "No preference" — mutually exclusive with every cuisine.
            noPreferenceChip
        }
    }

    private func cuisineChip(
        entry: (id: String, label: String),
        selected: Bool,
        disabled: Bool
    ) -> some View {
        Button {
            coordinator.toggleCuisine(entry.id)
        } label: {
            chipLabel(entry.label, selected: selected, disabled: disabled)
        }
        .disabled(disabled)
        .accessibilityIdentifier("quiz.q1.chip.\(entry.id)")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    private var noPreferenceChip: some View {
        Button {
            coordinator.toggleCuisineNoPreference()
        } label: {
            // placeholder: marketing-branding pass
            chipLabel("No preference", selected: coordinator.q1NoPreference, disabled: false)
        }
        .accessibilityIdentifier("quiz.q1.chip.no_preference")
        .accessibilityAddTraits(coordinator.q1NoPreference ? [.isSelected] : [])
    }

    /// C-04 Chip label. `selected` flips to sun fill / ink text;
    /// `disabled` dims it to the spec'd 0.4 white text on the soft
    /// fill (C-04 `disabled` row).
    private func chipLabel(_ text: String, selected: Bool, disabled: Bool) -> some View {
        Text(text)
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(
                selected
                    ? GTIColor.ink
                    : (disabled
                        ? GTIColor.TextOnGradient.primary.opacity(0.4)
                        : GTIColor.TextOnGradient.primary)
            )
            .padding(.horizontal, GTISpacing.step5)
            .padding(.vertical, GTISpacing.step3)
            .frame(minHeight: 48)
            .background(
                Capsule()
                    .fill(selected ? GTIColor.sun : Color.white.opacity(0.04))
            )
            .overlay(
                Capsule()
                    .stroke(
                        selected
                            ? Color.clear
                            : GTIColor.Glass.stroke.opacity(disabled ? 0.42 : 1.0),
                        lineWidth: 1.5
                    )
            )
            .scaleEffect(selected ? 1.02 : 1.0)
            .animation(
                .timingCurve(
                    GTIMotion.Easing.out.0,
                    GTIMotion.Easing.out.1,
                    GTIMotion.Easing.out.2,
                    GTIMotion.Easing.out.3,
                    duration: GTIMotion.Duration.chip
                ),
                value: selected
            )
    }
}

/// Minimal chip-flow that wraps chips onto multiple lines. Built with
/// SwiftUI's `Layout` protocol so we can match the JSX
/// `flexWrap: wrap; gap: 10` precisely without pulling in a third-party
/// flow layout. Shared by Q1 (cuisine) and Q3 (reputation).
@MainActor
struct QuizChipFlow<Item, Cell: View>: View {
    let items: [Item]
    let cell: (Item) -> Cell

    init(items: [Item], @ViewBuilder cell: @escaping (Item) -> Cell) {
        self.items = items
        self.cell = cell
    }

    var body: some View {
        QuizFlowLayout(spacing: 10) {
            ForEach(items.indices, id: \.self) { i in
                cell(items[i])
            }
        }
    }
}

/// 2-axis flow layout. Lays children left-to-right, wrapping when the
/// row width is exceeded. `spacing` applies in both axes.
@MainActor
struct QuizFlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rowWidth: CGFloat = 0
        var totalHeight: CGFloat = 0
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let s = sub.sizeThatFits(.unspecified)
            if rowWidth + s.width > maxWidth, rowWidth > 0 {
                totalHeight += rowHeight + spacing
                rowWidth = 0
                rowHeight = 0
            }
            rowWidth += s.width + spacing
            rowHeight = max(rowHeight, s.height)
        }
        totalHeight += rowHeight
        return CGSize(width: maxWidth.isFinite ? maxWidth : rowWidth, height: totalHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let maxWidth = bounds.width
        var x: CGFloat = bounds.minX
        var y: CGFloat = bounds.minY
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let s = sub.sizeThatFits(.unspecified)
            if x + s.width > bounds.minX + maxWidth, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: s.width, height: s.height))
            x += s.width + spacing
            rowHeight = max(rowHeight, s.height)
        }
    }
}
