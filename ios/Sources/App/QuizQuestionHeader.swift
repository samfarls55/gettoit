// GetToIt — QuizQuestionHeader (TB-04).
//
// Eyebrow ("Q1 OF 5") + display title + sub. Shared across all five
// quiz screens; matches `QuestionHeader` in
// `design-system/code/components.jsx`.
//
// Display title size 38pt — between `display-m` (44) and `display-s`
// (32). The JSX hand-tunes to 38 so multi-line titles fit; we mirror.

import SwiftUI

@MainActor
public struct QuizQuestionHeader: View {
    public let index: Int
    public let total: Int
    public let title: String
    public let sub: String?

    public init(index: Int, total: Int = 5, title: String, sub: String?) {
        self.index = index
        self.total = total
        self.title = title
        self.sub = sub
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step3) {
            Text("Q\(index) OF \(total)")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.secondary)
                .accessibilityIdentifier("quiz.header.eyebrow.q\(index)")

            Text(title)
                .font(.system(size: 38, weight: .black))
                .tracking(-0.025 * 38)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .lineSpacing(0)
                .multilineTextAlignment(.leading)
                .accessibilityIdentifier("quiz.header.title.q\(index)")

            if let sub {
                Text(sub)
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .multilineTextAlignment(.leading)
                    .accessibilityIdentifier("quiz.header.sub.q\(index)")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, GTISpacing.step5)
    }
}
