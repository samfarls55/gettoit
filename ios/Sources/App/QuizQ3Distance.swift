// GetToIt — Q3 · Distance (walk time) (TB-04).
//
// EBA veto threshold with a display-scale readout. The chosen number
// renders at 100pt — the JSX hand-tunes that size to rehearse the
// constraint in the user's head (see `surfaces/03-quiz.md` §"Q3").
// 5 discrete stops; default 15.

import SwiftUI

@MainActor
public struct QuizQ3Distance: View {
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
                title: "How far is too far?",
                sub: "Max walk from here, right now."
            )

            VStack(spacing: 0) {
                Spacer().frame(height: 36)

                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text("\(coordinator.q3WalkMinutes)")
                        .font(.system(size: 100, weight: .black))
                        .tracking(-0.04 * 100)
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                        .accessibilityIdentifier("quiz.q3.value")
                    Text("MIN")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.7))
                        .tracking(0.08 * 36)
                }
                .frame(maxWidth: .infinity, alignment: .center)

                HStack(spacing: 6) {
                    ForEach(QuizConstants.walkStops, id: \.self) { stop in
                        tickButton(for: stop)
                    }
                }
                .padding(.top, 26)

                HStack {
                    Text("AROUND THE CORNER")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.12 * 10)
                        .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.6))
                    Spacer()
                    Text("HALF A CITY")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.12 * 10)
                        .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.6))
                }
                .padding(.top, 14)
            }
            .padding(.horizontal, GTISpacing.step5)

            Spacer(minLength: 0)

            // placeholder: marketing-branding pass
            QuizPrimaryCTA(label: "Next") {
                coordinator.advance()
            }
        }
    }

    private func tickButton(for stop: Int) -> some View {
        let isSel = coordinator.q3WalkMinutes == stop
        return Button {
            coordinator.setWalkMinutes(stop)
        } label: {
            Text("\(stop)")
                .font(.system(size: GTIFont.Size.cta, weight: .heavy))
                .foregroundStyle(isSel ? GTIColor.ink : GTIColor.TextOnGradient.primary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(isSel ? GTIColor.sun : Color.white.opacity(0.08))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(isSel ? Color.clear : Color.white.opacity(0.32), lineWidth: 1)
                )
        }
        .accessibilityIdentifier("quiz.q3.stop.\(stop)")
        .accessibilityLabel("\(stop) minutes")
        .accessibilityAddTraits(isSel ? [.isSelected] : [])
    }
}
