// GetToIt — SignInScreen (S00a — forced first-launch Apple sign-in gate, TB-02 v1.1).
//
// SwiftUI port of `design-system/code/screens/ScreenSignIn.jsx`. The
// first surface a fresh-install iOS user sees: a single Sign-in-with-
// Apple affordance gates the rest of the app. No skip, no "continue as
// guest," no email fallback — closes the iOS half of ADR 0007's
// anonymous-default for v1.1.
//
// Render gate: `RootView` mounts this view iff
// `AuthCoordinator.state == .idle` after `restoreSessionIfPresent()`
// returns. A cached Apple session bypasses the surface entirely; a
// fresh install with no session lands here.
//
// Tokens consumed: GTIColor / GTIGradient / GTIFont / GTISpacing /
// GTIRadii / GTIMotion. Per repo CLAUDE.md no inline hex / px / easing.
//
// Copy register (LOCKED per `design-system/surfaces/00a-signin.md`):
//   * Eyebrow:        "Tonight's session"  (reuses S01 verbatim)
//   * Headline:       "Pick up where you left off"
//   * Body sub:       "Sign in once and your taste profile saves itself."
//   * CTA label:      "Save my taste profile"  (NEVER "Sign in with Apple")
//   * Error line:     "Couldn't reach Apple. Try again."

import SwiftUI
import AuthenticationServices

@MainActor
public struct SignInScreen: View {

    /// Local view phase. Mirrors the three-state contract documented
    /// in S00a §Behavior:
    ///   * idle      — pill is `default`; surface awaits a tap.
    ///   * linking   — Apple sheet is on top; pill renders disabled.
    ///   * (success) — view dismisses; RootView re-renders into S01.
    public enum Phase: Equatable {
        case idle
        case linking
    }

    @State private var phase: Phase = .idle
    @State private var errorMessage: String?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let auth: AuthCoordinator
    private let appleProvider: AppleSignInProviding
    private let onSignedIn: () -> Void

    public init(
        auth: AuthCoordinator,
        appleProvider: AppleSignInProviding? = nil,
        onSignedIn: @escaping () -> Void = {}
    ) {
        self.auth = auth
        self.appleProvider = appleProvider ?? LiveAppleSignInProvider()
        self.onSignedIn = onSignedIn
    }

    public var body: some View {
        ZStack {
            // Reuses the `initiator` gradient stop so the transition to
            // S01 after sign-in is visually identity — no gradient
            // tween. See surface doc §"Gradient choice — initiator".
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                // GTIMark stand-in — small wordmark tile. Mirrors the
                // WaitingScreen.topRow treatment so the mark reads
                // consistently across surfaces.
                ZStack(alignment: .center) {
                    RoundedRectangle(cornerRadius: GTISpacing.step1, style: .continuous)
                        .fill(GTIColor.paper.opacity(0.18))
                        .frame(width: 22, height: 22)
                    Text("g")
                        .font(.system(size: 14, weight: .black))
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                }
                .accessibilityHidden(true)

                Spacer().frame(height: GTISpacing.step12 + GTISpacing.step2)

                Text("Tonight's session")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .textCase(.uppercase)
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                    .accessibilityIdentifier("signin.eyebrow")

                Spacer().frame(height: GTISpacing.step3 + 2)

                // display-l, one word per line per the stacked-uppercase
                // rule (tokens.md §2). Locked phrase — see surface doc.
                Text("PICK UP\nWHERE\nYOU LEFT\nOFF")
                    .font(.system(size: GTIFont.Size.displayL, weight: .black))
                    .tracking(GTIFont.TrackingEm.displayL * GTIFont.Size.displayL)
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .lineSpacing(0)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("signin.headline")

                Spacer().frame(height: GTISpacing.step6)

                Text("Sign in once and your taste profile saves itself.")
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .frame(maxWidth: 300, alignment: .leading)
                    .accessibilityIdentifier("signin.body")

                if let errorMessage {
                    Spacer().frame(height: GTISpacing.step3)
                    Text(errorMessage)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                        .frame(maxWidth: 300, alignment: .leading)
                        .accessibilityIdentifier("signin.error")
                        .accessibilityAddTraits(.isStaticText)
                }

                Spacer()

                pillCTA
            }
            .padding(.horizontal, GTISpacing.step5 + 2)
            .padding(.top, GTISpacing.step16)
            .padding(.bottom, GTISpacing.step6)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
    }

    // MARK: - subviews

    /// The pill is the only interactive element. C-22's default-state
    /// visual treatment is the precedent — white pill, Apple-glyph
    /// prefix, locked copy in the warm-friend register. We do not
    /// import C-22 here: S00a has no dismiss path and no in-pill state
    /// machine; the surface owns its copy and post-tap routes away
    /// rather than swapping states.
    private var pillCTA: some View {
        let inProgress = (phase == .linking)
        return Button {
            Task { await onSaveTapped() }
        } label: {
            HStack(spacing: GTISpacing.step2 + GTISpacing.step1 / 2) {
                Image(systemName: "applelogo")
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(GTIColor.TextOnSurface.primary)
                    .accessibilityHidden(true)
                Text("Save my taste profile")
                    .font(.system(size: GTIFont.Size.cta, weight: .heavy))
                    .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                    .textCase(.uppercase)
                    .foregroundStyle(GTIColor.TextOnSurface.primary)
            }
            .frame(maxWidth: .infinity, minHeight: 60)
            .background(GTIColor.paper)
            .clipShape(RoundedRectangle(cornerRadius: GTIRadii.pill))
            .shadow(color: Color.black.opacity(0.18), radius: 32 / 2, x: 0, y: 12)
            .opacity(inProgress ? 0.45 : 1.0)
        }
        .buttonStyle(.plain)
        .disabled(inProgress)
        .accessibilityIdentifier("signin.cta")
        .accessibilityLabel(Text("Save my taste profile"))
        .accessibilityHint(Text("Signs you in with Apple"))
    }

    // MARK: - actions

    /// Trigger the Apple sheet, then hand the resulting credential to
    /// `AuthCoordinator.signInWithApple`. Three terminal outcomes:
    ///   * success     — coordinator state becomes `.linkedApple(userID)`;
    ///                   onSignedIn fires; RootView routes to S01.
    ///   * user-cancel — sheet dismisses; phase returns to .idle; no
    ///                   error toast (cancel is a valid choice).
    ///   * error       — phase returns to .idle; non-blocking inline
    ///                   error line renders below the body sub copy.
    private func onSaveTapped() async {
        guard phase == .idle else { return }
        phase = .linking
        errorMessage = nil
        do {
            let credential = try await appleProvider.requestAppleCredential()
            _ = try await auth.signInWithApple(
                idToken: credential.idToken,
                nonce: credential.nonce
            )
            // Successful: pop the gate. RootView observes the auth
            // state change and routes to S01 on the next render pass.
            onSignedIn()
            // No need to flip phase back — view is about to disappear.
        } catch is CancellationError {
            phase = .idle
        } catch {
            phase = .idle
            errorMessage = "Couldn't reach Apple. Try again."
        }
    }
}
