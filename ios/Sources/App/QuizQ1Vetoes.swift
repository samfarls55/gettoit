// GetToIt — Q1 · Vetoes (TB-04).
//
// EBA-veto multi-select chips. "Nothing tonight" is mutually exclusive
// with every other chip. Spec: `design-system/surfaces/03-quiz.md`
// §"Q1 — Vetoes" + `code/screens/ScreenQ1Vetoes.jsx`.
//
// All copy on this surface except the canonical Q-counter is
// `// placeholder: marketing-branding pass`.

import SwiftUI

@MainActor
public struct QuizQ1Vetoes: View {
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
                title: "Any hard no's tonight?",
                sub: "Tap everything that's off the table."
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
        // FlowLayout — simple chip wrap via a `FlexibleView`-style
        // helper would be overkill here. Use an HFlow approximation
        // via stacked HStacks driven by the GeometryReader on width.
        // A flat WrappedHStack-style helper is sufficient because the
        // chip count is fixed at 6 and the labels don't change.
        QuizChipFlow(items: QuizVeto.displayOrder) { entry in
            let isSel = coordinator.q1Vetoes.contains(entry.id)
            Button {
                coordinator.toggleVeto(entry.id)
            } label: {
                Text(entry.label)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(isSel ? GTIColor.ink : GTIColor.TextOnGradient.primary)
                    .padding(.horizontal, GTISpacing.step5)
                    .padding(.vertical, GTISpacing.step3)
                    .frame(minHeight: 48)
                    .background(
                        Capsule()
                            .fill(isSel ? GTIColor.sun : Color.white.opacity(0.04))
                    )
                    .overlay(
                        Capsule()
                            .stroke(
                                isSel ? Color.clear : GTIColor.Glass.stroke,
                                lineWidth: 1.5
                            )
                    )
                    .scaleEffect(isSel ? 1.02 : 1.0)
                    .animation(
                        .timingCurve(
                            GTIMotion.Easing.out.0,
                            GTIMotion.Easing.out.1,
                            GTIMotion.Easing.out.2,
                            GTIMotion.Easing.out.3,
                            duration: GTIMotion.Duration.chip
                        ),
                        value: isSel
                    )
            }
            .accessibilityIdentifier("quiz.q1.chip.\(entry.id)")
            .accessibilityAddTraits(isSel ? [.isSelected] : [])
        }
    }
}

/// Minimal chip-flow that wraps chips onto multiple lines. Built with
/// SwiftUI's `Layout` protocol so we can match the JSX
/// `flexWrap: wrap; gap: 10` precisely without pulling in a third-party
/// flow layout.
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
