// GetToIt — QuizScreen (TB-04).
//
// Hosts the five quiz questions. Owns:
//   * The 4-stop gradient surface and its 1100ms ease-in-out tween
//     between adjacent Q-surfaces (`design-system/motion.md`
//     §"Gradient surface tween" — duration locked at
//     `GTIMotion.Duration.gradTween`, easing locked at
//     `GTIMotion.Easing.inOut`).
//   * The top bar (× + 5-segment progress).
//   * Routing between QuizQ1Cuisine / QuizQ2Budget / QuizQ3Reputation /
//     QuizQ4Vibe / QuizQ5Regret based on `coordinator.step`. The
//     content swap cross-fades in lockstep with the gradient tween
//     (same `gradTween` duration + `inOut` easing) per
//     `design-system/motion.md` §"Question card cross-fade" — without
//     this pairing the foreground card advances instantly while the
//     background gradient is still mid-interpolation, which reads as
//     ~1s of motion lag on every question transition (bug-04).
//
// The tween is implemented by holding `@State` color stops and
// re-assigning them inside `withAnimation(...)` whenever the active
// step changes. SwiftUI interpolates each `Color` natively — same
// shape as the SwiftUI snippet in `tokens.md` §1.4.
//
// `×` exits the session by calling `onClose`. No back arrow per S03
// cross-quiz invariants.

import SwiftUI

@MainActor
public struct QuizScreen: View {
    @State private var coordinator: QuizCoordinator
    @State private var stops: [Color]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// Called when the user taps the × to leave the quiz, or after
    /// Q5 has been written successfully (so the parent can route to
    /// the Waiting surface).
    private let onClose: () -> Void
    private let onSubmitted: () -> Void

    public init(
        coordinator: QuizCoordinator,
        onClose: @escaping () -> Void,
        onSubmitted: @escaping () -> Void = {}
    ) {
        self._coordinator = State(initialValue: coordinator)
        self._stops = State(initialValue: GTIGradient.colorStops(.q1))
        self.onClose = onClose
        self.onSubmitted = onSubmitted
    }

    public var body: some View {
        ZStack {
            // The animated gradient. We can't animate a LinearGradient
            // directly across hue changes, but we *can* animate the
            // individual Color stops and rebuild the gradient each tick.
            LinearGradient(
                stops: zip(stops, GTIGradient.stopPositions).map {
                    Gradient.Stop(color: $0.0, location: $0.1)
                },
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .accessibilityIdentifier("quiz.gradient")

            VStack(spacing: 0) {
                topBar
                    .padding(.top, GTISpacing.step6)

                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    // Re-key on the routed step so SwiftUI treats each
                    // question as a distinct view identity and the
                    // `.transition(.opacity)` actually fires on swap.
                    .id(coordinator.step)
                    .transition(.opacity)
                    // Pair the card cross-fade with the gradient tween
                    // ms-exact (same duration + easing) so the
                    // foreground question and the background sunset
                    // sweep move as one piece — `design-system/motion.md`
                    // §"Question card cross-fade" (bug-04).
                    .animation(cardTweenAnimation, value: coordinator.step)
            }
        }
        .onChange(of: coordinator.step) { _, newStep in
            applyTween(for: newStep)
        }
    }

    // MARK: - top bar

    private var topBar: some View {
        HStack(alignment: .center, spacing: GTISpacing.step4) {
            Button(action: onClose) {
                Text("×")
                    // `heading` (28pt) is the tokenised size that
                    // closest matches the JSX hand-tuned 22pt × glyph;
                    // bumped up by one scale step so the × is hit-target
                    // friendly without breaking the design-system gate.
                    .font(.system(size: GTIFont.Size.heading, weight: .black))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .opacity(0.85)
                    .frame(width: 32, height: 32)
            }
            .accessibilityIdentifier("quiz.close")
            .accessibilityLabel("Close session")

            HStack(spacing: 5) {
                ForEach(0..<5, id: \.self) { i in
                    Capsule()
                        .fill(i < activeIndex ? GTIColor.paper : GTIColor.paper.opacity(0.32))
                        .frame(height: 4)
                        .animation(
                            .timingCurve(
                                GTIMotion.Easing.out.0,
                                GTIMotion.Easing.out.1,
                                GTIMotion.Easing.out.2,
                                GTIMotion.Easing.out.3,
                                duration: 0.300
                            ),
                            value: activeIndex
                        )
                }
            }
            .accessibilityIdentifier("quiz.progress")
        }
        .padding(.horizontal, GTISpacing.step5)
    }

    // MARK: - content router

    @ViewBuilder
    private var content: some View {
        switch coordinator.step {
        case .q1:
            QuizQ1Cuisine(coordinator: coordinator)
        case .q2:
            QuizQ2Budget(coordinator: coordinator)
        case .q3:
            QuizQ3Reputation(coordinator: coordinator)
        case .q4:
            QuizQ4Vibe(coordinator: coordinator)
        case .q5:
            // TB-15 (v1.1) — the per-member Foursquare fetch fires on
            // the Q4 -> Q5 transition. While it is in flight Q5 shows a
            // loading state; once the answer-tailored pool lands (or
            // degrades to the dummy fixture) the rateable cards render.
            if coordinator.q5CandidatesState == .loading {
                VStack(spacing: GTISpacing.step3) {
                    ProgressView()
                        .tint(GTIColor.TextOnGradient.primary)
                    Text("LINING UP SPOTS NEAR YOU")
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                        .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                        .foregroundStyle(GTIColor.TextOnGradient.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityIdentifier("quiz.q5.loading")
            } else {
                QuizQ5Regret(coordinator: coordinator, onSubmit: submitFromQ5)
            }
        case .submitting:
            VStack(spacing: GTISpacing.step3) {
                ProgressView()
                    .tint(GTIColor.TextOnGradient.primary)
                Text("DROPPING THE VERDICT")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityIdentifier("quiz.submitting")
        case .submitted:
            // Most commonly we forward to Waiting via onSubmitted before
            // this state ever paints. Keep a fallback view so a stray
            // render doesn't show a blank gradient.
            Color.clear
                .accessibilityIdentifier("quiz.submitted")
                .task { onSubmitted() }
        case .failed(let message):
            VStack(spacing: GTISpacing.step3) {
                Text("Couldn't drop the verdict.")
                    .font(.system(size: GTIFont.Size.body, weight: .heavy))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                Text(message)
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .multilineTextAlignment(.center)
                Button(action: { Task { _ = await coordinator.submit() } }) {
                    Text("RETRY")
                        .font(.system(size: GTIFont.Size.cta, weight: .black))
                        .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                        .foregroundStyle(GTIColor.ink)
                        .frame(maxWidth: .infinity, minHeight: 60)
                        .background(GTIColor.paper, in: RoundedRectangle(cornerRadius: GTIRadii.pill))
                }
                .accessibilityIdentifier("quiz.retry")
            }
            .padding(GTISpacing.step6)
        }
    }

    // MARK: - submit flow

    private func submitFromQ5() {
        Task {
            let result = await coordinator.submit()
            switch result {
            case .success:
                onSubmitted()
            case .failure:
                break  // step is .failed; user can retry
            }
        }
    }

    // MARK: - tween

    /// Animation used by the content cross-fade on step change.
    /// Pinned to the same `gradTween` duration + `inOut` easing as the
    /// gradient surface tween so the card and the gradient move in
    /// lockstep — see file header + `motion.md` §"Question card
    /// cross-fade" (bug-04). Reduced motion mirrors the gradient's
    /// 300ms linear fallback.
    private var cardTweenAnimation: Animation {
        if reduceMotion {
            return .linear(duration: 0.300)
        }
        return .timingCurve(
            GTIMotion.Easing.inOut.0,
            GTIMotion.Easing.inOut.1,
            GTIMotion.Easing.inOut.2,
            GTIMotion.Easing.inOut.3,
            duration: GTIMotion.Duration.gradTween
        )
    }

    /// Run the 1100ms gradient-stop interpolation for a step change.
    /// Reduced motion drops the duration to 300ms linear (per
    /// `motion.md` §"Reduced motion").
    private func applyTween(for step: QuizCoordinator.Step) {
        let target: [Color]
        switch step {
        case .q1: target = GTIGradient.colorStops(.q1)
        case .q2: target = GTIGradient.colorStops(.q2)
        case .q3: target = GTIGradient.colorStops(.q3)
        case .q4: target = GTIGradient.colorStops(.q4)
        case .q5, .submitting: target = GTIGradient.colorStops(.q5)
        case .submitted: target = GTIGradient.colorStops(.waiting)
        case .failed: target = GTIGradient.colorStops(.q5)
        }
        if reduceMotion {
            withAnimation(.linear(duration: 0.300)) {
                stops = target
            }
        } else {
            withAnimation(
                .timingCurve(
                    GTIMotion.Easing.inOut.0,
                    GTIMotion.Easing.inOut.1,
                    GTIMotion.Easing.inOut.2,
                    GTIMotion.Easing.inOut.3,
                    duration: GTIMotion.Duration.gradTween
                )
            ) {
                stops = target
            }
        }
    }

    /// 1-indexed progress for the top bar — current question fills its
    /// segment immediately (matches the JSX `step` semantics passing
    /// `step={1}` etc. — `i < step` paints up to and including `step-1`).
    private var activeIndex: Int {
        switch coordinator.step {
        case .q1: return 1
        case .q2: return 2
        case .q3: return 3
        case .q4: return 4
        case .q5: return 5
        case .submitting, .submitted, .failed: return 5
        }
    }
}
