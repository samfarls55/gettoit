// GetToIt — SignInScreen (S00a — forced first-launch Apple sign-in gate, TB-02 quiz redesign).
//
// SwiftUI port of `design-system/code/screens/ScreenSignIn.jsx`. The
// first surface a fresh-install iOS user sees: a single Sign-in-with-
// Apple affordance gates the rest of the app. No skip, no "continue as
// guest," no email fallback — closes the iOS half of ADR 0007's
// anonymous-default for the quiz redesign.
//
// Render gate: `RootView` mounts this view iff
// `AuthCoordinator.state` is `.idle` (fresh install, no cached
// session) OR `.anonymous` (pre-S00a install with a legacy anonymous
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
// tb-WF-14 / sg-WF-8 / wfr-21 — the "Voted on the web?" account-claim
// affordance. Beneath the Apple pill sits a labeled secondary
// `PillCTA` `ghost` button (wfr-21 promoted this from the original
// quiet `eyebrow`-token text link after a workflow-review flagged the
// link as buried); the common fresh-install user reads it, answers
// "no" in their head, and ignores it. The small population of Web
// invitees converting to an app install taps it, types the claim code
// minted on the web, and the redeem installs the carried anonymous
// session into the keychain — so the Apple tap then routes through
// `linkApple`, preserving the `user_id`. Pure composition of existing
// primitives — the soft-glass input pattern (C-23 typeahead) +
// `PillCTA white` for submit + `PillCTA ghost` for reveal — no new
// component, no new token. See design-system/surfaces/00a-signin.md
// §"Voted on the web?".
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

    // MARK: - spec-locked copy (00a-signin.md §"Copy register")

    /// Apple sign-in pill label. Reuses the C-22 register; the `cta`
    /// token uppercases this at render time. NEVER `"Sign in with Apple"`.
    public static let applePillLabel = "Save my taste profile"

    /// "Voted on the web?" account-claim reveal label. Question-form,
    /// warm-friend register; asks the user to self-identify rather than
    /// announcing a feature. NEVER `"Restore account"`, NEVER `"Have a code?"`.
    public static let claimRevealLabel = "Voted on the web?"

    /// Claim-code submit CTA label. Voluntary verb, plain noun; the
    /// `cta` token uppercases it at render. NEVER `"Redeem"`, NEVER `"Submit"`.
    public static let claimSubmitLabel = "Bring my Plans over"

    // MARK: - spec-locked CTA treatment (wfr-21)
    //
    // The workflow-review found the claim-code affordance was rendering
    // as a quiet eyebrow text link — buried under the Apple pill. The
    // treatments below are the regression guard: the view body reads
    // from these declarations and the snapshot test asserts they
    // remain distinct and that the claim reveal stays a labeled button
    // (C-05 `ghost`), not an eyebrow link.

    /// Visual hierarchy for a CTA on the sign-in surface.
    public enum CtaStyle: Equatable { case filledPill, ghostPill, textLink }

    /// Background-fill token used by a CTA.
    public enum CtaFill: Equatable { case paper, none }

    /// Foreground-text token used by a CTA.
    public enum CtaForeground: Equatable {
        case ink
        case paper
        case textOnGradientTertiary
    }

    /// Treatment of a single CTA on the surface — style + fill + foreground.
    public struct CtaTreatment: Equatable {
        public let style: CtaStyle
        public let fill: CtaFill
        public let foreground: CtaForeground
    }

    /// The primary Apple pill — filled white (C-05 `white`).
    public static let applePillTreatment = CtaTreatment(
        style: .filledPill,
        fill: .paper,
        foreground: .ink
    )

    /// The claim-code reveal — labeled secondary button (C-05 `ghost`).
    /// wfr-21 promoted this from an eyebrow text link so users with a
    /// code can find the entry without scanning.
    public static let claimRevealTreatment = CtaTreatment(
        style: .ghostPill,
        fill: .none,
        foreground: .paper
    )

    @State private var phase: Phase = .idle
    @State private var errorMessage: String?

    // tb-WF-14 — the "Voted on the web?" account-claim affordance's
    // state lives in an `@Observable` model (not a SwiftUI `@State`
    // value) so it is unit-testable on a bare `SignInScreen` struct —
    // `@State` value writes do not persist outside a render. The screen
    // `@State`-stores a stable model reference; SwiftUI tracks the
    // model's `@Observable` mutations. `internal` (not `private`) so
    // unit tests can read `claim` directly via `@testable import`.
    @State var claim: ClaimAffordanceModel

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
        _claim = State(initialValue: ClaimAffordanceModel(auth: auth))
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
                Text(Self.applePillLabel)
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
        .accessibilityLabel(Text(Self.applePillLabel))
        .accessibilityHint(Text("Signs you in with Apple"))
    }

    // MARK: - "Voted on the web?" account-claim affordance (tb-WF-14)

    /// The account-claim affordance — collapsed ghost pill by default
    /// (wfr-21), the revealed code-entry state once tapped. See
    /// sg-WF-8 §"Default state" / §"Revealed state" and the wfr-21
    /// amendment in 00a-signin.md.
    @ViewBuilder
    private var claimAffordance: some View {
        switch claim.phase {
        case .collapsed:
            votedOnTheWebLink
        case .entry, .redeeming:
            codeEntryState
        }
    }

    /// The secondary entry — `C-05 ghost` PillCTA treatment
    /// (transparent fill, white text, 1.5px white-0.5 inset stroke).
    /// wfr-21 promoted this from an eyebrow text link so the small
    /// population of web invitees converting to an app install can
    /// find their bridge without scanning the surface. The label
    /// stays in `cta` register (UPPERCASE) so it reads as a button,
    /// not a sentence link.
    private var votedOnTheWebLink: some View {
        Button {
            onVotedOnTheWebTapped()
        } label: {
            Text(Self.claimRevealLabel)
                .font(.system(size: GTIFont.Size.cta, weight: .heavy))
                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                .textCase(.uppercase)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .frame(maxWidth: .infinity, minHeight: 52)
                .background(
                    RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                        .fill(Color.clear)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                        .stroke(GTIColor.paper.opacity(0.5), lineWidth: 1.5)
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("signin.claim.reveal")
        .accessibilityLabel(Text(Self.claimRevealLabel))
        .accessibilityHint(Text("Bring a Plan you voted on in your browser into the app"))
    }

    /// The revealed code-entry state — teaching copy, the soft-glass
    /// claim-code field, and the "Bring my Plans over" submit CTA.
    /// sg-WF-8 §"Revealed state".
    private var codeEntryState: some View {
        let redeeming = (claim.phase == .redeeming)
        let trimmed = claim.code.trimmingCharacters(in: .whitespacesAndNewlines)
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
            TextField("", text: $claim.code, prompt:
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
            if let claimErrorMessage = claim.errorMessage {
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
                Text(Self.claimSubmitLabel)
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
            .accessibilityLabel(Text(Self.claimSubmitLabel))
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
    /// bug-06 (quiz redesign) — the coordinator method depends on the starting
    /// state, captured at tap time:
    ///   * `.anonymous` — a legacy pre-S00a anonymous session is in
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

    /// tb-WF-14 — reveal the code-entry state. Delegates the state
    /// transition to `ClaimAffordanceModel` and additionally moves
    /// keyboard focus to the field so it rises on reveal (sg-WF-8
    /// §"Behavior" #2). Internal (not `private`) so unit tests can
    /// drive the reveal directly via `@testable import GetToIt`.
    func onVotedOnTheWebTapped() {
        claim.reveal()
        if claim.phase == .entry {
            claimFieldFocused = true
        }
    }

    /// tb-WF-14 — submit the typed claim code. Delegates to
    /// `ClaimAffordanceModel.submit`: on success the coordinator
    /// reaches `.anonymous` and the affordance collapses (the user
    /// still taps the Apple pill, which now routes through `linkApple`
    /// — sg-WF-8 §"Behavior" #3); on a bad / expired / used / mistyped
    /// code the model surfaces the retryable inline error and keeps the
    /// field open (#4). Internal so unit tests can drive the submit.
    func onBringMyPlansOverTapped() async {
        await claim.submit()
    }
}
