// GetToIt — PostQuizHostScreen (TB-19).
//
// The SwiftUI surface for the post-Q5 router. Renders whatever phase
// `PostQuizHost` is in:
//
//   * .resolving — a neutral hold surface. NOT S00 Landing — the
//     session no longer dead-ends here (bug-07). For tb-19 this is a
//     minimal "lining up the verdict" hold; the full S04 Waiting
//     surface (avatar row, countdown, nudge) is the next slice, tb-20.
//     A solo session passes through it in the moment it takes the
//     engine to commit the row.
//   * .verdict — `VerdictScreen` renders the engine's verdict. A solo
//     session renders in `.solo` mode (the mode `VerdictStore`
//     resolved).
//   * .failed — a quiet retry surface.
//
// Lifecycle: the verdict poll is driven by `.task`, which SwiftUI
// cancels when the view leaves the hierarchy — so the poll loop
// unwinds on teardown with no leaked timer / task. Ending the session
// (the `×` on resolving, "Start over" on the verdict) calls
// `onEndSession`, which routes the caller back to S00 Landing — now
// the correct destination, not a dead-end.
//
// Tokens: GTIGradient / GTIColor / GTIFont / GTISpacing. Per repo
// CLAUDE.md — no inline hex / px / easing literals.

import SwiftUI

@MainActor
public struct PostQuizHostScreen: View {

    private let host: PostQuizHost
    /// Routes the caller back to S00 Landing. Wired by `RootView`.
    private let onEndSession: () -> Void

    public init(
        host: PostQuizHost,
        onEndSession: @escaping () -> Void = {}
    ) {
        self.host = host
        self.onEndSession = onEndSession
    }

    public var body: some View {
        ZStack {
            switch host.phase {
            case .resolving:
                resolvingSurface
            case .verdict(let view):
                VerdictScreen(
                    verdict: view.verdict,
                    mode: view.mode,
                    isInitiator: host.context.isInitiator,
                    onStartOver: onEndSession
                )
            case .failed:
                failedSurface
            }
        }
        .task {
            // SwiftUI cancels this task when the view leaves the
            // hierarchy — the poll loop's `Task.checkCancellation()`
            // catches that and unwinds. No leaked task.
            await host.start()
        }
    }

    // MARK: - resolving

    private var resolvingSurface: some View {
        ZStack {
            GTIGradient.surface(.waiting)
                .ignoresSafeArea()

            VStack(spacing: GTISpacing.step4) {
                Spacer()

                ProgressView()
                    .tint(GTIColor.TextOnGradient.primary)
                    .accessibilityIdentifier("postQuiz.resolving.spinner")

                Text("LINING UP THE VERDICT")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                    .accessibilityIdentifier("postQuiz.resolving.eyebrow")

                Text("Your answers are in. Holding for the engine — no spinners forever, promise.")
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)

                Spacer()
            }
            .padding(.horizontal, GTISpacing.step6)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .accessibilityIdentifier("postQuiz.resolving")
    }

    // MARK: - failed

    private var failedSurface: some View {
        ZStack {
            GTIGradient.surface(.waiting)
                .ignoresSafeArea()

            VStack(spacing: GTISpacing.step6) {
                Spacer()

                VStack(spacing: GTISpacing.step3) {
                    Text("COULDN'T REACH")
                        .font(.system(size: GTIFont.Size.displayS, weight: .black))
                        .tracking(GTIFont.TrackingEm.displayS * GTIFont.Size.displayS)
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                    Text("THE VERDICT")
                        .font(.system(size: GTIFont.Size.displayS, weight: .black))
                        .tracking(GTIFont.TrackingEm.displayS * GTIFont.Size.displayS)
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                }
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("postQuiz.failed.headline")

                Text("Something went sideways on our end. Try again?")
                    .font(.system(size: GTIFont.Size.body, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 280)

                Spacer()

                Button {
                    host.retry()
                } label: {
                    Text("TRY AGAIN")
                        .font(.system(size: GTIFont.Size.cta, weight: .black))
                        .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                        .foregroundStyle(GTIColor.ink)
                        .textCase(.uppercase)
                        .frame(maxWidth: .infinity, minHeight: 60)
                        .background(Capsule(style: .continuous).fill(GTIColor.paper))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("postQuiz.failed.retry")

                Button {
                    onEndSession()
                } label: {
                    Text("START OVER")
                        .font(.system(size: GTIFont.Size.cta, weight: .black))
                        .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                        .textCase(.uppercase)
                        .frame(maxWidth: .infinity, minHeight: 60)
                        .background(
                            Capsule(style: .continuous)
                                .stroke(GTIColor.Glass.stroke, lineWidth: 1.5)
                        )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("postQuiz.failed.startOver")
            }
            .padding(.horizontal, GTISpacing.step6)
            .padding(.bottom, GTISpacing.step5)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .accessibilityIdentifier("postQuiz.failed")
    }
}
