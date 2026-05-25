// GetToIt — Q5 · Preference probe (TB-04 shell, TB-08 framing).
//
// 3 candidate cards × 5 excitement buttons each. The only surface in
// the system where multi-option rating is allowed. CTA flips to
// sun-yellow `Drop the verdict` — telegraphs that the verdict is
// landing (S03 §"Cross-quiz invariants").
//
// TB-08 (quiz redesign): Q5 is a preference *probe*, not a tiebreaker. The
// member rates three real, strict-factorial candidate venues 1–5 on
// **excitement** ("How excited does this make you?") — the surface
// spec (`design-system/surfaces/03-quiz.md` §Q5) and the quiz-redesign PRD
// fixed the framing as excitement, replacing the pre-redesign "regret" wording.
// Card selection is the `Q5FactorialCardGenerator`; the real venues
// reach this view as `coordinator.allCandidates`.

import SwiftUI

@MainActor
public struct QuizQ5Regret: View {
    let coordinator: QuizCoordinator
    let onSubmit: () -> Void

    public init(coordinator: QuizCoordinator, onSubmit: @escaping () -> Void) {
        self.coordinator = coordinator
        self.onSubmit = onSubmit
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer().frame(height: GTISpacing.step10)

            // placeholder: marketing-branding pass
            QuizQuestionHeader(
                index: 5,
                title: "How excited does each of these make you?",
                sub: "Three real spots near you. Rate each."
            )

            VStack(spacing: 12) {
                ForEach(coordinator.allCandidates) { candidate in
                    candidateCard(candidate: candidate)
                }
            }
            .padding(.top, 22)
            .padding(.horizontal, GTISpacing.step5)

            Spacer(minLength: 0)

            // placeholder: marketing-branding pass
            QuizPrimaryCTA(label: "Drop the verdict", fill: .sun, action: onSubmit)
        }
    }

    private func candidateCard(candidate: QuizCandidate) -> some View {
        let selected = coordinator.q5Ratings[candidate.id] ?? 3
        return VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(candidate.name)
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                Text(candidate.meta.uppercased())
                    .font(.system(size: 11, weight: .semibold))
                    .tracking(0.08 * 11)
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
            }

            HStack(spacing: 6) {
                ForEach(1...5, id: \.self) { score in
                    regretButton(candidateID: candidate.id, score: score, selected: selected == score)
                }
            }

            HStack {
                // placeholder: marketing-branding pass
                Text("NOT FOR ME")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.12 * 9)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.6))
                Spacer()
                // placeholder: marketing-branding pass
                Text("CAN'T WAIT")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.12 * 9)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.6))
            }
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .fill(GTIColor.Glass.fillSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .stroke(GTIColor.Glass.stroke, lineWidth: 0.75)
        )
        .accessibilityIdentifier("quiz.q5.card.\(candidate.id)")
    }

    private func regretButton(candidateID: String, score: Int, selected: Bool) -> some View {
        Button {
            coordinator.setRegret(candidateID: candidateID, score: score)
        } label: {
            Text("\(score)")
                .font(.system(size: GTIFont.Size.cta, weight: .heavy))
                .foregroundStyle(selected ? GTIColor.ink : GTIColor.TextOnGradient.primary)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(selected ? GTIColor.sun : Color.white.opacity(0.10))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(selected ? Color.clear : Color.white.opacity(0.22), lineWidth: 1)
                )
        }
        .accessibilityIdentifier("quiz.q5.score.\(candidateID).\(score)")
        .accessibilityLabel("Rate \(score) for \(candidateID)")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }
}
