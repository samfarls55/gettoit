// GetToIt — QuizPrimaryCTA (TB-04).
//
// Pill CTA at the bottom of each quiz surface. Two fills:
//   * `.paper` — Q1..Q4 default. White pill, ink-black UPPERCASE label.
//   * `.sun`   — Q5 only. Sun-yellow pill, ink-black label. The "Drop
//                the verdict" CTA telegraphs the verdict is landing —
//                S03 §"Cross-quiz invariants".
//
// Shadow recipes match `tokens.md` §5 (cta-white / cta-sun).

import SwiftUI

@MainActor
public struct QuizPrimaryCTA: View {
    public enum Fill { case paper, sun }

    public let label: String
    public let fill: Fill
    public let action: () -> Void

    public init(label: String, fill: Fill = .paper, action: @escaping () -> Void) {
        self.label = label
        self.fill = fill
        self.action = action
    }

    public var body: some View {
        Button(action: action) {
            ZStack {
                RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                    .fill(fill == .sun ? GTIColor.sun : GTIColor.paper)
                    .frame(height: 60)
                Text(label)
                    .font(.system(size: GTIFont.Size.cta, weight: .black))
                    .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                    .foregroundStyle(GTIColor.ink)
                    .textCase(.uppercase)
            }
        }
        .padding(.horizontal, GTISpacing.step5)
        .padding(.bottom, 18)
        .accessibilityIdentifier(fill == .sun ? "quiz.cta.sun" : "quiz.cta.paper")
    }
}
