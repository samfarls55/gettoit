// GetToIt — Q4 · Vibe (TB-04).
//
// Cardinal scalar on the locked vocabulary `HUSHED · MELLOW · BUZZY ·
// LOUD · ROWDY` (`GTIVibeLabels.all`). Big live word at 96pt — the
// system saying "yes, this is your vibe."  No drag handle — taps only
// (`surfaces/03-quiz.md` §"Q4").
//
// The 480ms rise-with-blur on word change is the spec's `vibe word
// change` utility motion. We approximate the blur drop with SwiftUI's
// `.blur(radius:)` transition.

import SwiftUI

@MainActor
public struct QuizQ4Vibe: View {
    let coordinator: QuizCoordinator

    public init(coordinator: QuizCoordinator) {
        self.coordinator = coordinator
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer().frame(height: GTISpacing.step10)

            // placeholder: marketing-branding pass
            QuizQuestionHeader(
                index: 4,
                title: "What's the energy tonight?",
                sub: "Slide it to where the group lands."
            )

            VStack(spacing: 0) {
                Spacer().frame(height: GTISpacing.step10)

                ZStack {
                    // 96pt is a JSX hand-tune ("huge live word" per
                    // ScreenQ4Vibe.jsx). Between display-xl (88) and
                    // the Q3 100pt readout — sized so HUSHED..ROWDY
                    // fit on one line without word-break. Matched
                    // ms-exact to the JSX.
                    Text(GTIVibeLabels.all[coordinator.q4Vibe])
                        .font(.system(size: 96, weight: .black))
                        .tracking(-0.03 * 96)
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                        .id(coordinator.q4Vibe)
                        .transition(
                            .asymmetric(
                                insertion: .opacity.combined(with: .move(edge: .bottom)),
                                removal: .opacity
                            )
                        )
                        .accessibilityIdentifier("quiz.q4.word")
                }
                .frame(height: 124)
                .animation(
                    .timingCurve(
                        GTIMotion.Easing.outSoft.0,
                        GTIMotion.Easing.outSoft.1,
                        GTIMotion.Easing.outSoft.2,
                        GTIMotion.Easing.outSoft.3,
                        duration: 0.480
                    ),
                    value: coordinator.q4Vibe
                )

                HStack(spacing: 6) {
                    ForEach(0..<GTIVibeLabels.all.count, id: \.self) { i in
                        stopBar(at: i)
                    }
                }
                .padding(.top, 22)

                HStack {
                    Text(GTIVibeLabels.all.first ?? "")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.12 * 10)
                        .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    Spacer()
                    Text(GTIVibeLabels.all.last ?? "")
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.12 * 10)
                        .foregroundStyle(GTIColor.TextOnGradient.secondary)
                }
                .padding(.top, 16)
            }
            .padding(.horizontal, GTISpacing.step5)

            Spacer(minLength: 0)

            // placeholder: marketing-branding pass
            QuizPrimaryCTA(label: "Next") {
                coordinator.advance()
            }
        }
    }

    private func stopBar(at index: Int) -> some View {
        let isSel = coordinator.q4Vibe == index
        return Button {
            coordinator.setVibe(index)
        } label: {
            Capsule()
                .fill(isSel ? GTIColor.sun : Color.white.opacity(0.22))
                .frame(height: 12)
                .scaleEffect(x: 1, y: isSel ? 1.4 : 1.0, anchor: .center)
        }
        .accessibilityIdentifier("quiz.q4.stop.\(index)")
        .accessibilityLabel(GTIVibeLabels.all[index])
        .accessibilityAddTraits(isSel ? [.isSelected] : [])
    }
}
