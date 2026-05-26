// GetToIt — PostQuizHostScreen (TB-19).
//
// The SwiftUI surface for the post-Q5 router. Renders whatever phase
// `PostQuizHost` is in:
//
//   * .resolving — a neutral hold surface for a SOLO session. NOT S00
//     Landing — the session no longer dead-ends here (bug-07). A solo
//     session passes through it in the moment it takes the engine to
//     commit the row.
//   * .waiting — the S04 Waiting surface for a GROUP session (tb-20).
//     `WaitingScreen` renders the avatar row + headline, driven by the
//     host's `WaitingStore` which the snapshot poll re-bootstraps on a
//     few-second cadence.
//   * .verdict — `VerdictScreen` renders the engine's verdict. A solo
//     session renders in `.solo` mode (the mode `VerdictStore`
//     resolved).
//   * .failed — a quiet retry surface.
//
// Lifecycle: the verdict poll is driven by `.task`, which SwiftUI
// cancels when the view leaves the hierarchy — so the poll loop
// unwinds on teardown with no leaked timer / task. Ending the session
// (the `×` on resolving, the chrome-row `Home` verb on the verdict —
// see bug-22) calls `onEndSession`, which routes the caller back to
// S00 Plan list — now the correct destination, not a dead-end.
//
// Tokens: GTIGradient / GTIColor / GTIFont / GTISpacing. Per repo
// CLAUDE.md — no inline hex / px / easing literals.

import SwiftUI
import Supabase

@MainActor
public struct PostQuizHostScreen: View {

    private let host: PostQuizHost
    /// Routes the caller back to S00 Landing. Wired by `RootView`.
    private let onEndSession: () -> Void
    /// Auth coordinator + prompt store for the C-22 Auth Upgrade Chip
    /// the S04 Waiting surface hosts. Optional — when nil (the tb-19
    /// solo-only call sites + the snapshot tests) the `.waiting` phase
    /// is never reached, so the chip dependencies are never needed.
    private let auth: AuthCoordinator?
    private let promptStore: AuthPromptStore?
    /// bug-27 (2026-05-25) — Supabase client the `.verdict` phase
    /// passes to `VerdictRerollHost` so the tertiary REROLL CTA can
    /// open the S07 sheet. Optional so the existing snapshot tests
    /// keep passing without a client; when nil the verdict renders as
    /// the bare `VerdictScreen` (no live reroll wiring, same as
    /// pre-bug-27 behaviour) which is fine for the smoke tests. The
    /// `RootView` call site always supplies it.
    private let client: SupabaseClient?
    /// wfr-17 — invoked when the initiator taps the top-leading Leave
    /// chrome on the `.waiting` phase. Distinct from `onEndSession`
    /// because Leave on S04 carries a side effect (expire the room
    /// via `MemberLeaveStore.leaveAndExpire`) on top of the
    /// host-teardown + route-flip that `onEndSession` performs.
    /// Defaults to `onEndSession` so call sites that don't supply it
    /// (the existing snapshot tests, the failed/verdict phases that
    /// don't reach Waiting) keep working — the chrome row is still
    /// hidden for invitees and for the legacy TB-12 call sites that
    /// don't wire `auth` + `promptStore`, so the default is only
    /// reachable in code paths where a Leave tap was impossible
    /// anyway.
    private let onLeaveWaiting: () -> Void
    /// bug-37 — invoked when `WaitingScreen`'s session-ended handler
    /// fires (the room's status flipped to `.expired` out from under
    /// the joiner — Plan delete, initiator Leave, etc.). The
    /// production call site (`RootView`) wires this to a
    /// `host.teardown() + postQuizHost = nil` sequence so the
    /// precedence chain returns the user to S00 Plan list. Per
    /// ADR-0019 the screen owns the toast; the host owns the
    /// precedence-chain teardown. Defaults to `onEndSession` so call
    /// sites that don't supply it (snapshot tests, the legacy paths
    /// that never reach `.waiting`) keep working unchanged.
    private let onSessionEnded: () -> Void

    public init(
        host: PostQuizHost,
        auth: AuthCoordinator? = nil,
        promptStore: AuthPromptStore? = nil,
        client: SupabaseClient? = nil,
        onEndSession: @escaping () -> Void = {},
        onLeaveWaiting: (() -> Void)? = nil,
        onSessionEnded: (() -> Void)? = nil
    ) {
        self.host = host
        self.auth = auth
        self.promptStore = promptStore
        self.client = client
        self.onEndSession = onEndSession
        self.onLeaveWaiting = onLeaveWaiting ?? onEndSession
        self.onSessionEnded = onSessionEnded ?? onEndSession
    }

    public var body: some View {
        ZStack {
            switch host.phase {
            case .resolving:
                resolvingSurface
            case .waiting(let store):
                waitingSurface(store: store)
            case .verdict(let view):
                verdictSurface(view: view)
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

    // MARK: - verdict (bug-27)

    /// bug-27 — wire the verdict phase to `VerdictRerollHost` so the
    /// tertiary REROLL CTA actually opens the S07 sheet. Before bug-27
    /// the bare `VerdictScreen(...)` here left `onReroll` defaulted to
    /// `{}` and the tap was dead for any post-quiz session that landed
    /// the verdict on this surface (the second live `VerdictScreen`
    /// site documented on bug-27's diagnosis).
    ///
    /// When `client` is nil (the snapshot-test call sites that never
    /// reach a real reroll) we fall back to the bare `VerdictScreen`
    /// passing an explicit empty `onReroll` so the screen still
    /// materialises — this mirrors the read-only branches in
    /// `RootView`.
    @ViewBuilder
    private func verdictSurface(view: VerdictStore.VerdictView) -> some View {
        if let client {
            VerdictRerollHost(
                verdict: view.verdict,
                roomID: host.context.roomID,
                mode: view.mode,
                isInitiator: host.context.isInitiator,
                client: client,
                // bug-22 — the chrome-row `Home` verb pops to S00 Plan
                // list with the just-decided Plan visible in the
                // Decided section. `onEndSession` already performs that
                // fallback through the precedence chain in `RootView`
                // (clears `postQuizHost` → chain falls through to
                // PlanListScreen).
                onHome: onEndSession
            )
        } else {
            VerdictScreen(
                verdict: view.verdict,
                mode: view.mode,
                isInitiator: host.context.isInitiator,
                onHome: onEndSession,
                onReroll: { }
            )
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

            // wfr-13 — Escape Hatch (interaction-patterns: Escape Hatch /
            // P-01 Safe Exploration). Before this the user was trapped on
            // the spinner while the post-Q5 router polled `verdicts`. The
            // top-trailing Cancel returns to S00 Plan list — `onEndSession`
            // (wired by `RootView`) calls `host.teardown()` to cancel the
            // poll task and clears `postQuizHost` so the precedence chain
            // falls through to PlanList. No confirmation: Q5 has already
            // been submitted, nothing to discard, and the Escape Hatch
            // anti-pattern guidance is explicit that a Cancel button that
            // requires confirmation defeats its own purpose.
            VStack {
                HStack {
                    Spacer()
                    Button(action: onEndSession) {
                        Text(PostQuizHostScreen.resolvingCancelLabel.uppercased())
                            .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                            .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.78))
                            .frame(minWidth: 44, minHeight: 44, alignment: .trailing)
                            .padding(.horizontal, 4)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("postQuiz.resolving.cancel")
                    .accessibilityLabel(PostQuizHostScreen.resolvingCancelLabel)
                }
                .padding(.horizontal, GTISpacing.step5)
                .frame(minHeight: 44)
                Spacer()
            }
        }
        .accessibilityIdentifier("postQuiz.resolving")
    }

    // MARK: - wfr-13 test seams

    /// wfr-13 — text-only verb on the top-trailing chrome slot of the
    /// `.resolving` phase. Matches the QuizChrome / LockedScreen
    /// text-verb idiom (eyebrow type, no SF Symbol). Pinned by
    /// `PostQuizHostScreenTests` so future paraphrase drift trips the
    /// build, not the user.
    public static let resolvingCancelLabel = "Cancel"

    /// wfr-13 — test seam. The chrome Cancel is a SwiftUI Button bound
    /// to the host-supplied `onEndSession` closure; SwiftUI tests do
    /// not traverse the rendered tree to hit-test buttons, so this
    /// exposes the closure invocation as a public surface for the
    /// unit tests. The `forTesting` suffix marks it as a test-only
    /// contract; the production code never calls this. Mirrors
    /// `LockedScreen.simulateHomeTapForTesting()` (wfr-12).
    public func simulateResolvingCancelTapForTesting() {
        onEndSession()
    }

    // MARK: - waiting (S04 — group path)

    /// The S04 Waiting surface for a group session. `WaitingScreen` is
    /// driven by the host's `WaitingStore`, which the snapshot poll
    /// re-bootstraps every cadence tick. `WaitingScreen` publishes the
    /// verdict-ready bit via its own `onAdvanceToVerdict`, but the
    /// canonical advance here is the host's snapshot+verdict poll
    /// flipping `phase` to `.verdict` — so the `onAdvanceToVerdict`
    /// callback is a no-op (the host owns the routing).
    @ViewBuilder
    private func waitingSurface(store: WaitingStore) -> some View {
        if let auth, let promptStore {
            WaitingScreen(
                auth: auth,
                promptStore: promptStore,
                waitingStore: store,
                onAdvanceToVerdict: { _ in },
                onStartOver: onEndSession,
                // wfr-17 — initiator-only Leave chrome. The view layer
                // gates this on `store.isInitiator`, so an invitee
                // instance never invokes it; the host screen forwards
                // unconditionally.
                onLeave: onLeaveWaiting,
                // bug-37 — session-ended handler. Fires when the
                // room's status flips to `.expired` (Plan delete,
                // initiator Leave, no-signal sweeper). Forwards to
                // the host-supplied `onSessionEnded` so RootView can
                // tear down `postQuizHost` and the precedence chain
                // returns the user to PlanList (ADR-0019).
                onSessionEnded: onSessionEnded
            )
        } else {
            // No chip dependencies wired — fall back to the neutral
            // hold rather than crash. A real group session always
            // supplies them via `RootView`.
            resolvingSurface
        }
    }

    // MARK: - wfr-17 test seam

    /// wfr-17 — test seam. Mirrors
    /// `simulateResolvingCancelTapForTesting()` (wfr-13). SwiftUI
    /// tests don't traverse the rendered tree to hit-test buttons,
    /// so this exposes the closure invocation as a public surface
    /// for the unit tests. The `forTesting` suffix marks it as a
    /// test-only contract; production code never calls this.
    public func simulateWaitingLeaveTapForTesting() {
        onLeaveWaiting()
    }

    /// bug-37 — test seam. SwiftUI tests don't traverse the rendered
    /// tree to observe `WaitingScreen.onSessionEnded` actually firing
    /// when the store flips to `.expired`, so this exposes the host's
    /// closure invocation as a public surface for the unit tests.
    /// Mirrors `simulateWaitingLeaveTapForTesting()` (wfr-17). The
    /// `forTesting` suffix marks it as a test-only contract;
    /// production code never calls this.
    public func simulateWaitingSessionEndedForTesting() {
        onSessionEnded()
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
