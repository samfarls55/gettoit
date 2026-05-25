// GetToIt — Q5 · no-results screen (TB-26 quiz redesign).
//
// The Q5 `no-results` mode — the iOS consumption of the sg-05
// design-system spec (`design-system/surfaces/03-quiz.md` §Q5
// "`no-results` mode" + `design-system/code/screens/ScreenQ5Regret.jsx`).
//
// Rendered when the per-member Foursquare fetch produced no
// factorial-usable pool: an empty venue union, a `nil` factorial, a
// thrown fetch, or no session coordinate. Before TB-26 the app shipped
// three hardcoded fictitious restaurants (`QuizDummyCandidates`) and
// rendered them as the Q5 cards in this case. That was a tb-04-era
// scaffold; the app must never surface a made-up place to a user, so
// the dummy fixture was removed entirely and this screen took its
// place.
//
// Structure mirrors the verdict-side `no-survivor` mode: a centered
// headline + body block in place of the surface's primary content, an
// action-shaped sun-fill CTA, no fictitious filler. The three factorial
// rater cards and the "Drop the verdict" CTA are suppressed — there is
// nothing to rate.
//
// The CTA runs the SAME submit-then-route path as the normal Q5 CTA
// (`QuizScreen.submitFromQ5`): the member's quiz submits (Q1–Q4 answers
// plus an empty Q5 ratings array) and they advance to Waiting (group)
// or the verdict (solo). The member is never stranded mid-flow.
//
// Locked copy — headline / body / CTA — is fixed by the sg-05 spec and
// reproduced here verbatim.

import SwiftUI

@MainActor
public struct QuizQ5NoResults: View {
    let onAdvance: () -> Void

    public init(onAdvance: @escaping () -> Void) {
        self.onAdvance = onAdvance
    }

    public var body: some View {
        VStack(alignment: .center, spacing: 0) {
            Spacer().frame(height: GTISpacing.step10)

            VStack(alignment: .center, spacing: 12) {
                // Locked copy — sg-05 §"`no-results` mode".
                Text("No spots to rate near you.")
                    .font(.system(size: 38, weight: .black))
                    .tracking(-0.025 * 38)
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("quiz.q5.noResults.headline")

                Text("Couldn't line up rateable spots in your radius "
                     + "tonight. Your other answers still count — the "
                     + "verdict lands without this step.")
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(GTIFont.Size.sm * (GTIFont.LineHeight.sm - 1))
                    .accessibilityIdentifier("quiz.q5.noResults.body")
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, GTISpacing.step5)

            Spacer(minLength: 0)

            // C-05 primary pill CTA, sun fill — locked label.
            // Action-shaped per the design system's ban on generic
            // Next / Continue / OK CTAs. Runs the same submit-then-route
            // path as the normal Q5 CTA.
            QuizPrimaryCTA(label: "Head to the verdict", fill: .sun, action: onAdvance)
        }
        .accessibilityIdentifier("quiz.q5.noResults")
    }
}
