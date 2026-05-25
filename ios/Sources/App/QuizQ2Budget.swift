// GetToIt — Q2 · Spend cap (TB-04 surface, TB-06 question rework).
//
// Single-select tier. 4 fixed tiers — never a slider (see
// `surfaces/03-quiz.md` §"Q2"). Each tier row uses the spec'd
// 32pt display label + uppercase-tracked sub line; selected row
// flips to sun-yellow fill.
//
// The spend cap is a hard ceiling — the verdict never exceeds it
// (PRD user story 15). Its 4-tier shape is unchanged from the pre-redesign quiz; the
// quiz-redesign rework only re-labels the question "spend cap" and keeps the
// `budget_cap` wire kind.

import SwiftUI

@MainActor
public struct QuizQ2Budget: View {
    let coordinator: QuizCoordinator

    public init(coordinator: QuizCoordinator) {
        self.coordinator = coordinator
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer().frame(height: GTISpacing.step10)

            // placeholder: marketing-branding pass
            QuizQuestionHeader(
                index: 2,
                title: "What's your max?",
                sub: "Pick the ceiling — we won't suggest above it."
            )

            VStack(spacing: 10) {
                ForEach(Array(QuizConstants.budgetTiers.enumerated()), id: \.offset) { idx, tier in
                    tierRow(index: idx + 1, label: tier.label, sub: tier.sub)
                }
            }
            .padding(.top, GTISpacing.step5)
            .padding(.horizontal, GTISpacing.step5)

            Spacer(minLength: 0)

            // placeholder: marketing-branding pass
            QuizPrimaryCTA(label: "Next") {
                coordinator.advance()
            }
        }
    }

    private func tierRow(index: Int, label: String, sub: String) -> some View {
        let isSel = coordinator.q2Budget == index
        return Button {
            coordinator.setBudget(index)
        } label: {
            HStack(alignment: .firstTextBaseline) {
                Text(label)
                    .font(.system(size: GTIFont.Size.displayS, weight: .black))
                    .tracking(GTIFont.TrackingEm.displayS * GTIFont.Size.displayS)
                    .foregroundStyle(isSel ? GTIColor.ink : GTIColor.TextOnGradient.primary)
                Spacer()
                Text(sub.uppercased())
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(isSel ? GTIColor.ink.opacity(0.8) : GTIColor.TextOnGradient.secondary)
                    .tracking(0.08 * 13)
            }
            .padding(.horizontal, GTISpacing.step5)
            .padding(.vertical, GTISpacing.step4)
            .frame(maxWidth: .infinity)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(isSel ? GTIColor.sun : Color.white.opacity(0.06))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(isSel ? Color.clear : GTIColor.Glass.stroke, lineWidth: 1.5)
            )
            .scaleEffect(isSel ? 1.015 : 1.0)
            .animation(
                .timingCurve(
                    GTIMotion.Easing.out.0,
                    GTIMotion.Easing.out.1,
                    GTIMotion.Easing.out.2,
                    GTIMotion.Easing.out.3,
                    duration: 0.220
                ),
                value: isSel
            )
        }
        .accessibilityIdentifier("quiz.q2.tier.\(index)")
        .accessibilityLabel("\(label). \(sub)")
        .accessibilityAddTraits(isSel ? [.isSelected] : [])
    }
}
