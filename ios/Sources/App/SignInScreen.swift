// GetToIt — SignInScreen (S00a — forced first-launch Apple sign-in gate, TB-02 v1.1).
//
// SwiftUI port of `design-system/code/screens/ScreenSignIn.jsx`. The
// first surface a fresh-install iOS user sees: a single Sign-in-with-
// Apple affordance gates the rest of the app. No skip, no "continue as
// guest," no email fallback — closes the iOS half of ADR 0007's
// anonymous-default for v1.1.
//
// Render gate: `RootView` mounts this view iff
// `AuthCoordinator.state` is `.idle` (fresh install, no cached
// session) OR `.anonymous` (pre-v1.1 install with a v1 anonymous
// session still in Keychain — bug-06). A cached `.linkedApple`
// session bypasses the surface entirely; both gate-eligible states
// resolve to a Linked-Apple session by the time S00a dismisses.
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
//
// tb-WF-14 / sg-WF-8 — the "Voted on the web?" account-claim affordance.
// Beneath the Apple pill sits a quiet `eyebrow`-token text link; the
// common fresh-install user reads it, answers "no" in their head, and
// ignores it. The small population of Web invitees converting to an app
// install taps it, types the claim code minted on the web, and the
// redeem installs the carried anonymous session into the keychain — so
// the Apple tap then routes through `linkApple`, preserving the
// `user_id`. Pure composition of existing primitives — the soft-glass
// input pattern (C-23 typeahead) + `PillCTA white` — no new component,
// no new token. See design-system/surfaces/00a-signin.md §"Voted on the
// web?".
//   * Claim affordance label:  "Voted on the web?"
//   * Teaching copy:           "Bring back your recent web Plans. ..."
//   * Claim CTA label:         "Bring my Plans over"  (NEVER "Redeem")
//   * Claim error line:        "That code didn't work. Generate a fresh
//                               one from your web link."

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

    /// tb-WF-14 — the "Voted on the web?" account-claim affordance's
    /// local state, per the sg-WF-8 spec §"Behavior":
    ///   * collapsed — the quiet "Voted on the web?" text link; the
    ///                 default. A non-web user ignores it.
    ///   * entry     — the revealed code-entry state: teaching copy,
    ///                 the soft-glass field, and the submit CTA.
    ///   * redeeming — a redeem is in flight; the submit CTA disables.
    public enum ClaimPhase: Equatable {
        case collapsed
        case entry
        case redeeming
    }

    @State private var phase: Phase = .idle
    @State private var errorMessage: String?

    // tb-WF-14 — claim-affordance state. `internal` (not `private`) so
    // unit tests can drive the reveal + submit directly via
    // `@testable import GetToIt`, matching the `onSaveTapped` seam.
    @State var claimPhase: ClaimPhase = .collapsed
    @State var claimCode: String = ""
    @State var claimErrorMessage: String?

    @FocusState private var claimFieldFocused: Bool

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

                // tb-WF-14 / sg-WF-8 — the "Voted on the web?"
                // account-claim affordance sits in the CTA dock beneath
                // the Apple pill. Collapsed by default; the revealed
                // code-entry state expands inline (not a route change).
                claimAffordance
                    .padding(.top, GTISpacing.step3)
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

    // MARK: - "Voted on the web?" account-claim affordance (tb-WF-14)

    /// The account-claim affordance — collapsed quiet link by default,
    /// the revealed code-entry state once tapped. sg-WF-8 §"Default
    /// state" / §"Revealed state".
    @ViewBuilder
    private var claimAffordance: some View {
        switch claimPhase {
        case .collapsed:
            votedOnTheWebLink
        case .entry, .redeeming:
            codeEntryState
        }
    }

    /// The quiet secondary entry — `eyebrow`-token text-link treatment
    /// (Inter 700 / 11 / tracking 0.18em / UPPERCASE, white 0.6, a
    /// 44pt-tall centered hit row). The same low-key treatment S00b's
    /// "Pick a place manually" and S01's "SETTINGS" link use. It never
    /// competes with the white pill for the eye.
    private var votedOnTheWebLink: some View {
        Button {
            onVotedOnTheWebTapped()
        } label: {
            Text("Voted on the web?")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .textCase(.uppercase)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("signin.claim.reveal")
        .accessibilityLabel(Text("Voted on the web?"))
        .accessibilityHint(Text("Bring a Plan you voted on in your browser into the app"))
    }

    /// The revealed code-entry state — teaching copy, the soft-glass
    /// claim-code field, and the "Bring my Plans over" submit CTA.
    /// sg-WF-8 §"Revealed state".
    private var codeEntryState: some View {
        let redeeming = (claimPhase == .redeeming)
        let trimmed = claimCode.trimmingCharacters(in: .whitespacesAndNewlines)
        let submitDisabled = trimmed.isEmpty || redeeming
        return VStack(alignment: .leading, spacing: GTISpacing.step3) {
            // Teaching copy — tells a user without a code how to mint
            // one, and is honest about the ~30-day TTL ceiling.
            Text("Bring back your recent web Plans. Open any link you voted on, tap \u{201C}Getting the app?\u{201D}, and enter the code here.")
                .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.84))
                .frame(maxWidth: 300, alignment: .leading)
                .accessibilityIdentifier("signin.claim.teaching")

            // The claim-code field — the existing soft-glass input
            // pattern (C-23 typeahead, web-01 §A name input). Not a new
            // component. Height 56, radius `row` (12), `fillSoft` over
            // a 1px glass stroke; the sun-yellow caret is the focus
            // signal. A claim code is an opaque token — characters
            // autocapitalize, autocorrect off.
            TextField("", text: $claimCode, prompt:
                Text("Enter your code")
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
            )
            .focused($claimFieldFocused)
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled(true)
            .submitLabel(.go)
            .onSubmit { Task { await onBringMyPlansOverTapped() } }
            .font(.system(size: GTIFont.Size.body, weight: .semibold))
            .foregroundStyle(GTIColor.TextOnGradient.primary)
            .tint(GTIColor.sun)
            .padding(.horizontal, GTISpacing.step4)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(
                RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                    .fill(GTIColor.Glass.fillSoft)
            )
            .overlay(
                RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                    .stroke(
                        claimFieldFocused
                            ? GTIColor.sun
                            : GTIColor.Glass.stroke,
                        lineWidth: 1
                    )
            )
            .accessibilityIdentifier("signin.claim.field")
            .accessibilityLabel(Text("Claim code"))

            // Inline error — non-blocking, retryable. Same treatment as
            // the Apple-flow error line; `role="alert"` equivalent via
            // the announcement trait.
            if let claimErrorMessage {
                Text(claimErrorMessage)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.7))
                    .frame(maxWidth: 300, alignment: .leading)
                    .accessibilityIdentifier("signin.claim.error")
                    .accessibilityAddTraits(.isStaticText)
            }

            // Submit CTA — `PillCTA white`, disabled until the trimmed
            // input is non-empty (opacity 0.45, no inline validation
            // copy — the design system's "disabled CTA, no error copy"
            // posture).
            Button {
                Task { await onBringMyPlansOverTapped() }
            } label: {
                Text("Bring my Plans over")
                    .font(.system(size: GTIFont.Size.cta, weight: .heavy))
                    .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                    .textCase(.uppercase)
                    .foregroundStyle(GTIColor.TextOnSurface.primary)
                    .frame(maxWidth: .infinity, minHeight: 56)
                    .background(GTIColor.paper)
                    .clipShape(RoundedRectangle(cornerRadius: GTIRadii.pill))
                    .opacity(submitDisabled ? 0.45 : 1.0)
            }
            .buttonStyle(.plain)
            .disabled(submitDisabled)
            .accessibilityIdentifier("signin.claim.submit")
            .accessibilityLabel(Text("Bring my Plans over"))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - actions

    /// Trigger the Apple sheet, then hand the resulting credential to
    /// the coordinator. Three terminal outcomes:
    ///   * success     — coordinator state becomes `.linkedApple(userID)`;
    ///                   onSignedIn fires; RootView routes to S01.
    ///   * user-cancel — sheet dismisses; phase returns to .idle; no
    ///                   error toast (cancel is a valid choice).
    ///   * error       — phase returns to .idle; non-blocking inline
    ///                   error line renders below the body sub copy.
    ///
    /// bug-06 (v1.1) — the coordinator method depends on the starting
    /// state, captured at tap time:
    ///   * `.anonymous` — a legacy v1 anonymous session is in
    ///                    Keychain. Use `linkApple` so the Apple
    ///                    identity attaches to the existing `user_id`
    ///                    (rooms, votes, members, events all survive).
    ///   * otherwise    — fresh install / post-sign-out. Use
    ///                    `signInWithApple` to mint a brand-new
    ///                    Linked-Apple session.
    /// Both methods take the same Apple credential shape; only the
    /// dispatch differs.
    /// Internal (not `private`) so unit tests can drive the dispatch
    /// directly via `@testable import GetToIt`. The `pillCTA` button
    /// is still the only production caller.
    func onSaveTapped() async {
        guard phase == .idle else { return }
        phase = .linking
        errorMessage = nil
        do {
            let credential = try await appleProvider.requestAppleCredential()
            if case .anonymous = auth.state {
                _ = try await auth.linkApple(
                    idToken: credential.idToken,
                    nonce: credential.nonce
                )
            } else {
                _ = try await auth.signInWithApple(
                    idToken: credential.idToken,
                    nonce: credential.nonce
                )
            }
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

    /// tb-WF-14 — reveal the code-entry state. The quiet "Voted on the
    /// web?" link is consumed by the reveal (it does not persist beside
    /// the open field — sg-WF-8 §"Behavior" #2); the field autofocuses
    /// so the keyboard rises.
    /// Internal (not `private`) so unit tests can drive the reveal
    /// directly via `@testable import GetToIt`.
    func onVotedOnTheWebTapped() {
        guard claimPhase == .collapsed else { return }
        claimPhase = .entry
        claimErrorMessage = nil
        claimFieldFocused = true
    }

    /// tb-WF-14 — submit the typed claim code. On success the
    /// coordinator reaches `.anonymous` (the carried web identity is in
    /// the keychain) and the surface re-renders so the Apple tap then
    /// routes through `linkApple` — the user has NOT signed in yet, they
    /// still tap the Apple pill (sg-WF-8 §"Behavior" #3). On a bad /
    /// expired / used / mistyped code the inline error line appears and
    /// the field stays open for a retry; nothing is destroyed (#4).
    /// Internal (not `private`) so unit tests can drive the submit
    /// directly.
    func onBringMyPlansOverTapped() async {
        guard claimPhase == .entry else { return }
        let trimmed = claimCode.trimmingCharacters(in: .whitespacesAndNewlines)
        // The CTA is disabled while the field is empty; this guard is
        // belt-and-braces (an `onSubmit` from an empty field, a stale
        // tap) so an empty redeem never reaches the network.
        guard !trimmed.isEmpty else { return }

        claimPhase = .redeeming
        claimErrorMessage = nil
        do {
            // The coordinator invokes redeem-claim-code, installs the
            // carried anonymous session into the keychain, and reaches
            // `.anonymous`. The Apple pill's next tap is now `linkApple`.
            _ = try await auth.redeemClaimCode(trimmed)
            // Success: the dock re-renders. The code-entry state has
            // done its job; collapse it. The user still must tap the
            // Apple pill (the claim does not sign them in).
            claimPhase = .collapsed
            claimCode = ""
        } catch {
            // Every recoverable redeem failure — bad / expired / used /
            // mistyped code, rate-limit, transport — collapses to one
            // retryable inline error per the sg-WF-8 spec. The
            // code-entry state stays open so the user re-types or goes
            // back to the web link for a fresh code.
            claimPhase = .entry
            claimErrorMessage =
                "That code didn't work. Generate a fresh one from your web link."
        }
    }
}
