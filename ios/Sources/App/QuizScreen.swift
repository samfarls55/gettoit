// GetToIt — QuizScreen (TB-04, chrome added by tb-WF-2).
//
// Hosts the five quiz questions. Owns:
//   * The 4-stop gradient surface and its 1100ms ease-in-out tween
//     between adjacent Q-surfaces (`design-system/motion.md`
//     §"Gradient surface tween" — duration locked at
//     `GTIMotion.Duration.gradTween`, easing locked at
//     `GTIMotion.Easing.inOut`).
//   * The Quiz chrome row (Back top-leading on Q2-Q5, Exit/Leave
//     top-trailing on Q1-Q5) — sg-WF-2 / tb-WF-2. The chrome sits
//     above the C-02 TopBar; the TopBar's `×` is suppressed in the
//     quiz context (the chrome owns the exit verb now). Back wires to
//     `QuizCoordinator.back()`; Exit/Leave hands `onExit` up to the
//     host, which performs the `members` DELETE-self + (solo
//     initiator) `rooms.status = 'expired'` round-trip and routes
//     to the post-exit destination.
//   * The 5-segment progress strip on the top bar.
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

import SwiftUI

@MainActor
public struct QuizScreen: View {
    @State private var coordinator: QuizCoordinator
    @State private var stops: [Color]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// tb-WF-2 — the QuizChrome role (`Exit` vs `Leave` label).
    /// Resolved by the caller from `room.creator_user_id == auth.uid()`.
    private let role: QuizChromeRole

    /// tb-WF-2 — whether this is a solo session (the chrome's
    /// confirmation copy uses the solo variant; the leave write also
    /// expires the room on a solo initiator). Derived by the caller
    /// from the existing `SoloPath.shouldSkipWaiting(memberCount:
    /// invitedShared:)` signal, which in practice equals
    /// `!invitedShared` for the on-device quiz (a single-member room
    /// where the share sheet was never opened).
    private let isSolo: Bool

    /// Called after Q5 has been written successfully — the host
    /// routes to the post-Q5 router (PostQuizHost).
    private let onSubmitted: () -> Void

    /// Called when the user confirms `Exit` / `Leave` on the chrome's
    /// alert. The host performs the member-drop write and routes to
    /// the post-exit destination (`QuizChromePostExitDestination`).
    private let onExit: () -> Void

    /// Legacy `onClose` — preserved for the pre-chrome callers (test
    /// targets, snapshot harness). Live callers should use `onExit`
    /// instead; the chrome's `Exit` button always routes through
    /// `onExit`, never `onClose`. Kept as a no-op default so the new
    /// chrome-aware init is the canonical surface.
    private let onClose: () -> Void

    /// tb-WF-2 init. The chrome consumes `role` + `isSolo`; the host
    /// owns `onExit` (member-drop + route) and `onSubmitted` (Q5
    /// success → post-Q5 router).
    public init(
        coordinator: QuizCoordinator,
        role: QuizChromeRole,
        isSolo: Bool,
        onClose: @escaping () -> Void = {},
        onExit: @escaping () -> Void,
        onSubmitted: @escaping () -> Void = {}
    ) {
        self._coordinator = State(initialValue: coordinator)
        self._stops = State(initialValue: GTIGradient.colorStops(.q1))
        self.role = role
        self.isSolo = isSolo
        self.onClose = onClose
        self.onExit = onExit
        self.onSubmitted = onSubmitted
    }

    /// Pre-chrome init — preserved for the snapshot harness and the
    /// existing unit tests that constructed a QuizScreen without the
    /// chrome wiring. Defaults `role` to `.initiator` and `isSolo` to
    /// `false` (the most-common live state); `onExit` forwards to
    /// `onClose` so the existing close-on-exit semantics survive.
    public init(
        coordinator: QuizCoordinator,
        onClose: @escaping () -> Void,
        onSubmitted: @escaping () -> Void = {}
    ) {
        self._coordinator = State(initialValue: coordinator)
        self._stops = State(initialValue: GTIGradient.colorStops(.q1))
        self.role = .initiator
        self.isSolo = false
        self.onClose = onClose
        self.onExit = onClose
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
                // tb-WF-2 — QuizChrome row above the C-02 TopBar. The
                // chrome owns the Exit/Leave affordance, so the TopBar's
                // `×` is suppressed (the close button below is
                // intentionally hidden by zero-opacity + zero-frame to
                // preserve the progress strip's horizontal alignment
                // without changing the layout).
                QuizChromeView(
                    canBack: canBackForStep(coordinator.step),
                    role: role,
                    isSolo: isSolo,
                    onBack: { coordinator.back() },
                    onExit: onExit
                )
                .padding(.top, GTISpacing.step4)

                topBar
                    .padding(.top, GTISpacing.step3)

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
        // tb-WF-2 — the C-02 TopBar's `×` is suppressed in the quiz
        // context. The QuizChrome row above owns the Exit/Leave verb
        // now; the spec's "no icons" rule applies (`surfaces/03-quiz.md`
        // §"Quiz skeleton").
        //
        // bug-25 — the pre-fix layout reserved a 32pt-wide leading
        // spacer (where the C-02 `×` used to sit) with NO trailing
        // counterpart. The 5-segment progress strip therefore sat
        // 32pt right-of-centre on every quiz question. The fix
        // mirrors the leading reservation with a 32pt trailing spacer
        // so the strip centres naturally inside the parent's
        // `.padding(.horizontal, step5)` insets. Both spacers are
        // `accessibilityHidden` so the strip is the only addressable
        // element in this row.
        HStack(alignment: .center, spacing: GTISpacing.step4) {
            Color.clear
                .frame(width: 32, height: 32)
                .accessibilityHidden(true)

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

            Color.clear
                .frame(width: 32, height: 32)
                .accessibilityHidden(true)
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
            // loading state.
            //
            // TB-26 (v1.1) — once the fetch resolves Q5 routes on the
            // result: a real factorial pool renders the rateable cards;
            // a no-factorial-usable pool (empty union, `nil` factorial,
            // thrown fetch, or no session coordinate) renders the
            // no-results screen. The app never surfaces a fictitious
            // venue.
            switch coordinator.q5CandidatesState {
            case .loading:
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
            case .noResults:
                // The no-results CTA runs the SAME submit-then-route
                // path as the normal Q5 CTA — the member's quiz submits
                // (Q1-Q4 plus an empty Q5) and they advance to Waiting
                // (group) or the verdict (solo).
                QuizQ5NoResults(onAdvance: submitFromQ5)
            case .idle, .ready:
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
        // bug-12 — `onSubmitted` is fired from a SINGLE place: the
        // `.submitted` step's `.task`. A successful `coordinator.submit()`
        // moves the step machine to `.submitted`, which renders the
        // `Color.clear` view whose `.task` calls `onSubmitted()`. Calling
        // it here as well delivered `onSubmitted` twice per submit, which
        // orphaned the post-Q5 polling host (see `RootView.enterPostQuiz`).
        // The `.submitted` step's `.task` also covers the `.failed`-retry
        // path (RETRY → `coordinator.submit()` → `.submitted`), so it is
        // the correct single trigger.
        Task {
            _ = await coordinator.submit()
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

    /// tb-WF-2 — whether the QuizChrome row renders a Back affordance
    /// for the given step. Per spec, Q1 omits Back (no prior question);
    /// Q2-Q5 carry it. The submitting / submitted / failed states are
    /// post-Q5 terminal — the chrome is not interactive there, so the
    /// answer doesn't matter (defensively returns `false`).
    private func canBackForStep(_ step: QuizCoordinator.Step) -> Bool {
        switch step {
        case .q1, .submitting, .submitted, .failed: return false
        case .q2, .q3, .q4, .q5: return true
        }
    }
}
