// GetToIt — Q3 · Reputation / discovery (TB-06).
//
// Single-select chip picker — Popular / Hidden gem / Classic / New /
// No preference. A client-side-scored soft axis (the query-chip
// fetch-filter technique was retired in the quiz redesign — see
// `50_product/0.1.0-quiz-amendments` §5). Spec:
// `design-system/surfaces/03-quiz.md` §"Q3 — Reputation" + the C-04
// Chip component used in its single-select mode.
//
// All copy on this surface except the canonical Q-counter is
// `// placeholder: marketing-branding pass`.

import SwiftUI

@MainActor
public struct QuizQ3Reputation: View {
    let coordinator: QuizCoordinator

    public init(coordinator: QuizCoordinator) {
        self.coordinator = coordinator
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer().frame(height: GTISpacing.step10)

            // placeholder: marketing-branding pass
            QuizQuestionHeader(
                index: 3,
                title: "What kind of place?",
                sub: "The standing of the spot, not the food."
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
        QuizChipFlow(items: QuizReputation.all) { entry in
            let isSel = coordinator.q3Reputation == entry.id
            Button {
                coordinator.setReputation(entry.id)
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
            .accessibilityIdentifier("quiz.q3.chip.\(entry.id)")
            .accessibilityAddTraits(isSel ? [.isSelected] : [])
        }
    }
}
