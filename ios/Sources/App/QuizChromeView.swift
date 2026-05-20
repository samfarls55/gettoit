// GetToIt — QuizChromeView (tb-WF-2).
//
// iOS port of the design-system `QuizChrome` component (sg-WF-2 spec,
// `design-system/code/components.jsx` + `design-system/surfaces/03-quiz.md`
// §"Quiz chrome (Back + Exit)"). Two text-label affordances above the
// C-02 TopBar:
//   * `Back` — top-leading on Q2-Q5. Q1 passes `canBack: false`; the
//     leading slot collapses to a 44pt-wide spacer so the Exit/Leave
//     label stays anchored to the trailing edge.
//   * `Exit` (initiator) / `Leave` (joiner) — top-trailing on every
//     quiz surface. Tap opens a confirmation alert; on confirm, the
//     host (`QuizScreen` → `RootView`) drops the user's membership
//     and routes to the Plan list (or S00 Landing until the Plan
//     list surface is user-visible — see `QuizChromePostExitDestination`).
//
// The confirmation copy is locked verbatim — `surfaces/03-quiz.md`
// §"Confirmation copy". The three variants (initiator multi-member,
// joiner, solo) live in `QuizChromeCopy.resolve(role:isSolo:)`; the
// strings are pinned by `QuizChromeCopyTests`.
//
// Visual treatment per spec: existing `eyebrow` token (Inter 700 / 11
// / tracking 0.18em / UPPERCASE), white 0.78, pure text labels (no
// icons), 44pt minimum tap target. Matches the S01 "SETTINGS" footer
// link convention so neither label competes with the primary input
// below.
//
// Why not SwiftUI's `confirmationDialog`: the issue allows either the
// dialog or a native alert; `alert(_:isPresented:actions:message:)` is
// the closer analog to the design-system JSX (a centered dark-glass
// alert card with a destructive primary + neutral cancel). The native
// alert also auto-dismisses on backdrop tap, matching the JSX's
// "Cancel-via-backdrop" spec.

import SwiftUI

/// The two roles the QuizChrome chrome distinguishes (the room
/// creator vs an invitee). Resolved by the caller from
/// `room.creator_user_id == auth.uid()`.
public enum QuizChromeRole: Equatable, Sendable {
    case initiator
    case joiner
}

/// Locked-copy bundle for one (role, solo) combination. The strings
/// are verbatim from `design-system/surfaces/03-quiz.md` §"Confirmation
/// copy (verbatim — do not paraphrase)" and pinned by
/// `QuizChromeCopyTests`. Resolve via `resolve(role:isSolo:)` — the
/// case selection is the only behaviour, every other field is data.
public struct QuizChromeCopy: Equatable, Sendable {
    public let verb: String          // top-trailing label ("Exit" / "Leave")
    public let alertTitle: String
    public let alertBody: String
    public let confirmLabel: String
    public let cancelLabel: String

    /// Spec-locked variant for (role, isSolo). A joiner can never be in
    /// a solo room in practice (solo == one member, and that member
    /// owns the room), so `isSolo: true` is honoured only on the
    /// initiator branch. The joiner branch ignores `isSolo` rather than
    /// inventing a fourth variant the spec doesn't carry.
    public static func resolve(role: QuizChromeRole, isSolo: Bool) -> QuizChromeCopy {
        if role == .joiner {
            return QuizChromeCopy(
                verb: "Leave",
                alertTitle: "Leave this plan?",
                alertBody:
                    "Your answers will be discarded. The host and others can still finish.",
                confirmLabel: "Leave",
                cancelLabel: "Keep going"
            )
        }
        if isSolo {
            return QuizChromeCopy(
                verb: "Exit",
                alertTitle: "Exit this plan?",
                alertBody:
                    "Your answers will be discarded. Your plan will stay saved so you can start over.",
                confirmLabel: "Exit",
                cancelLabel: "Keep going"
            )
        }
        return QuizChromeCopy(
            verb: "Exit",
            alertTitle: "Exit this plan?",
            alertBody:
                "Your answers will be discarded. Others can still finish without you.",
            confirmLabel: "Exit",
            cancelLabel: "Keep going"
        )
    }
}

/// The destination the QuizChrome's `onExit` callback hands up to the
/// host once the member-drop write completes. tb-WF-5 flipped this
/// from `.landing` (S00 Landing) to `.planList` — the Plan list is
/// the canonical post-sign-in surface now that `LandingScreen.swift`
/// is retired. Carrying it as a typed value (rather than a magic enum
/// case buried in `RootView`) means a future change to the post-exit
/// destination is a single-line change with the test in
/// `QuizChromePostExitTests` catching the drift.
public enum QuizChromePostExitDestination: Equatable, Sendable {
    /// S00 Plan list — the canonical post-sign-in idle destination.
    case planList

    /// The destination tb-WF-5 ships with. Reads as "land on S00
    /// Plan list (empty state on first launch, populated list once
    /// the user has at least one Plan)."
    public static let current: QuizChromePostExitDestination = .planList
}

@MainActor
public struct QuizChromeView: View {
    let canBack: Bool
    let role: QuizChromeRole
    let isSolo: Bool
    let onBack: () -> Void
    let onExit: () -> Void

    @State private var confirming = false

    public init(
        canBack: Bool,
        role: QuizChromeRole,
        isSolo: Bool,
        onBack: @escaping () -> Void,
        onExit: @escaping () -> Void
    ) {
        self.canBack = canBack
        self.role = role
        self.isSolo = isSolo
        self.onBack = onBack
        self.onExit = onExit
    }

    public var body: some View {
        let copy = QuizChromeCopy.resolve(role: role, isSolo: isSolo)
        HStack(alignment: .center) {
            // Back — top-leading; suppressed on Q1. The slot collapses
            // to a 44pt-wide spacer so the trailing label stays
            // anchored at the trailing edge regardless of canBack.
            if canBack {
                Button(action: onBack) {
                    Text("BACK")
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                        .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                        .foregroundStyle(GTIColor.TextOnGradient.secondary)
                        .frame(minWidth: 44, minHeight: 44, alignment: .leading)
                        .padding(.horizontal, 4)
                        .contentShape(Rectangle())
                }
                .accessibilityIdentifier("quiz.chrome.back")
                .accessibilityLabel("Back to previous question")
            } else {
                Color.clear
                    .frame(minWidth: 44, minHeight: 44)
                    .accessibilityHidden(true)
            }

            Spacer()

            // Exit / Leave — top-trailing on every Qn surface. Verb
            // resolves to "Exit" (initiator / solo) or "Leave" (joiner)
            // per the spec.
            Button(action: { confirming = true }) {
                Text(copy.verb.uppercased())
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.78))
                    .frame(minWidth: 44, minHeight: 44, alignment: .trailing)
                    .padding(.horizontal, 4)
                    .contentShape(Rectangle())
            }
            .accessibilityIdentifier("quiz.chrome.exit")
            .accessibilityLabel("\(copy.verb) the quiz")
        }
        .padding(.horizontal, GTISpacing.step5)
        .frame(minHeight: 44)
        .alert(copy.alertTitle, isPresented: $confirming) {
            // Destructive primary + neutral cancel — `role: .destructive`
            // surfaces the system's red treatment on iOS, which
            // communicates "this discards your in-flight answers" at
            // a glance. Cancel is the default action (backdrop tap +
            // hardware-back both map to it).
            Button(copy.confirmLabel, role: .destructive) {
                confirming = false
                onExit()
            }
            .accessibilityIdentifier("quiz.chrome.alert.confirm")
            Button(copy.cancelLabel, role: .cancel) {
                confirming = false
            }
            .accessibilityIdentifier("quiz.chrome.alert.cancel")
        } message: {
            Text(copy.alertBody)
        }
    }
}
