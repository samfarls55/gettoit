// GetToIt — WaitingScreen (S04 — TB-12 chip + TB-07 full surface).
//
// History:
//   * TB-12 introduced a minimal placeholder hosting just the C-22
//     Auth Upgrade Chip. Render gate state machine documented in the
//     ChipPhase enum below.
//   * TB-07 fleshes the surface out to the full S04 spec:
//       — avatar row with answered / answering states (live via
//         `WaitingStore` events)
//       — display headline `"N of M / ARE IN"`
//       — initiator-only `"Decide now"` ghost CTA
//       — Nudge ghost CTA (rate-limited 1 per 2 min)
//       — Auth Upgrade Chip preserved in the CTA dock
//   * tb-WF-3 (sg-WF-3 iOS port) retires the session timer: the
//     `"AUTO-FIRES IN 7:42"` mono-tag countdown, the 1Hz tick state,
//     the reduced-motion countdown variant, the timer-expiry no-quorum
//     terminal ("Couldn't reach quorum tonight"), and the dependency
//     on `TimerCoordinator` are all gone. The two surviving verdict
//     triggers are (a) all-Q5-complete (engine-side auto-fire) and
//     (b) the initiator's `"Decide now"` tap, owned by
//     `FireVerdictCoordinator`. The `"Decide now"` CTA is always
//     tappable for the initiator — minimum quorum is one member, per
//     surfaces/04-waiting.md §"`Decide now` CTA (initiator-only)".
//
// Tokens consumed: GTIColor / GTIGradient / GTIFont / GTISpacing /
// GTIRadii / GTIMotion. Per repo CLAUDE.md no inline hex / px / easing.
//
// What this view DOES NOT own:
//   * Wiring the Realtime channel to `WaitingStore.apply(event:)` —
//     that's the responsibility of the call-site that owns the
//     SupabaseClient. Tests drive `apply(event:)` directly; the
//     production call site (RootView, when it lands TB-07 routing)
//     binds the channel callbacks.
//   * Routing into S05 when the verdict lands — also up to the call
//     site. The view publishes the ready bit via `WaitingStore.verdictReady`.

import SwiftUI
import UIKit
import AuthenticationServices
import CryptoKit

@MainActor
public struct WaitingScreen: View {
    public enum ChipPhase: Equatable {
        case loading      // initial — checking the prompt store
        case idle         // anonymous + not dismissed → render `default`
        case linking      // user tapped — Apple sheet on top, pill disabled
        case linked       // success — show quiet "Saved."
        case dismissed    // user tapped "Maybe later" within 30d
        case hidden       // already linked, OR prompt store says suppress
    }

    @State private var phase: ChipPhase = .loading
    @State private var linkError: String?
    @State private var fireError: String?
    /// Local state for the Nudge CTA — surfaces "tap again later"
    /// after a rate-limited press.
    @State private var nudgeMessage: String?

    private let auth: AuthCoordinator
    private let promptStore: AuthPromptStore
    private let appleProvider: AppleSignInProviding
    private let now: () -> Date
    /// New in TB-07. `nil` for the legacy TB-12 instantiation that
    /// only needed the chip surface.
    private let waitingStore: WaitingStore?
    /// tb-WF-3 — owns the manual `"Decide now"` fire path. `nil` for
    /// the legacy TB-12 instantiation; production wires it alongside
    /// the `waitingStore` so the initiator's CTA can call
    /// `fire_verdict(room_id)`.
    private let fireCoordinator: FireVerdictCoordinator?
    /// Closure invoked when the host (PostQuizHostScreen) leaves the
    /// `onStartOver` slot unfilled; the view passes it through as a
    /// no-op. Retained on the type so existing call sites compile.
    private let onAdvanceToVerdict: ((UUID) -> Void)?
    private let onStartOver: (() -> Void)?

    /// Designated initializer — used by TB-07 to drive the full
    /// surface against a live `WaitingStore` + `FireVerdictCoordinator`.
    public init(
        auth: AuthCoordinator,
        promptStore: AuthPromptStore,
        waitingStore: WaitingStore? = nil,
        fireCoordinator: FireVerdictCoordinator? = nil,
        appleProvider: AppleSignInProviding? = nil,
        now: @escaping () -> Date = { .now },
        onAdvanceToVerdict: ((UUID) -> Void)? = nil,
        onStartOver: (() -> Void)? = nil
    ) {
        self.auth = auth
        self.promptStore = promptStore
        self.waitingStore = waitingStore
        self.fireCoordinator = fireCoordinator
        self.appleProvider = appleProvider ?? LiveAppleSignInProvider()
        self.now = now
        self.onAdvanceToVerdict = onAdvanceToVerdict
        self.onStartOver = onStartOver
    }

    public var body: some View {
        ZStack {
            GTIGradient.surface(.waiting)
                .ignoresSafeArea()

            mainBody
        }
        .task {
            await refreshChipPhase()
        }
        .onChange(of: waitingStore?.verdictReady ?? false) { _, ready in
            guard ready, let store = waitingStore else { return }
            onAdvanceToVerdict?(store.roomID)
        }
    }

    // MARK: - main body

    @ViewBuilder
    private var mainBody: some View {
        VStack(spacing: 0) {
            topRow
                .padding(.horizontal, GTISpacing.step6)
                .padding(.top, GTISpacing.step4)

            Spacer(minLength: 0)

            if let store = waitingStore {
                headlineBlock(store: store)
                    .padding(.horizontal, GTISpacing.step6)
                    .padding(.top, GTISpacing.step10)

                avatarRow(store: store)
                    .padding(.top, GTISpacing.step8)

                bodyCopy(store: store)
                    .padding(.horizontal, GTISpacing.step6)
                    .padding(.top, GTISpacing.step8)
            } else {
                // TB-12 legacy path: no store wired — just hold space.
                Text("Waiting")
                    .font(.system(size: GTIFont.Size.heading, weight: .heavy))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .accessibilityIdentifier("waiting.headline")
            }

            Spacer(minLength: 0)

            ctaDock
                .padding(.horizontal, GTISpacing.step6)
                .padding(.bottom, GTISpacing.step5)
        }
    }

    private var topRow: some View {
        HStack(alignment: .center) {
            // GTIMark stand-in — small wordmark tile.
            ZStack {
                RoundedRectangle(cornerRadius: GTISpacing.step1, style: .continuous)
                    .fill(GTIColor.paper.opacity(0.18))
                    .frame(width: 22, height: 22)
                Text("g")
                    .font(.system(size: 14, weight: .black))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
            }
            .accessibilityHidden(true)

            Spacer()

            Text("YOU'RE IN")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .accessibilityIdentifier("waiting.eyebrow")
        }
    }

    private func headlineBlock(store: WaitingStore) -> some View {
        VStack(spacing: GTISpacing.step1 + 2) {
            Text("\(store.answeredCount) of \(store.memberCount)")
                .font(.system(size: GTIFont.Size.displayL, weight: .black))
                .tracking(GTIFont.TrackingEm.displayL * GTIFont.Size.displayL)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .accessibilityIdentifier("waiting.ratio")
            Text("ARE IN")
                .font(.system(size: GTIFont.Size.displayS, weight: .black))
                .tracking(GTIFont.TrackingEm.displayS * GTIFont.Size.displayS)
                .foregroundStyle(GTIColor.TextOnGradient.secondary)
                .textCase(.uppercase)
                .accessibilityIdentifier("waiting.areIn")
        }
        .frame(maxWidth: .infinity)
        .multilineTextAlignment(.center)
    }

    private func avatarRow(store: WaitingStore) -> some View {
        HStack(spacing: GTISpacing.step3 + 2) {
            ForEach(Array(store.members.enumerated()), id: \.element.id) { (index, member) in
                avatarDot(member: member, index: index, isAnswered: store.answered.contains(member.id))
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("waiting.avatarRow")
    }

    private func avatarDot(member: WaitingMember, index: Int, isAnswered: Bool) -> some View {
        // Sun-yellow for the current user; per-member-identity palette
        // for the rest, cycling through the 3 registered colors.
        let isMe = member.id == waitingStore?.currentUserID
        let palette = GTIColor.memberIdentity
        let fill: Color = isMe
            ? GTIColor.sun
            : palette[index % palette.count]
        let initialChar: String = isMe ? "Y" : String(member.id.uuidString.prefix(1)).uppercased()

        return ZStack {
            Circle()
                .fill(fill)
                .frame(width: 48, height: 48)
                .shadow(color: isAnswered ? Color.black.opacity(0.18) : .clear,
                        radius: isAnswered ? 11 : 0, x: 0, y: 8)
                .overlay(
                    Circle()
                        .stroke(GTIColor.paper.opacity(isAnswered ? 0.85 : 0.25),
                                lineWidth: isAnswered ? 2.5 : 1)
                )
                .saturation(isAnswered ? 1.0 : 0.5)
                .opacity(isAnswered ? 1.0 : 0.55)
                .animation(
                    .timingCurve(
                        GTIMotion.Easing.out.0,
                        GTIMotion.Easing.out.1,
                        GTIMotion.Easing.out.2,
                        GTIMotion.Easing.out.3,
                        duration: 0.320
                    ),
                    value: isAnswered
                )
            Text(initialChar)
                .font(.system(size: 48 * 0.42, weight: .black))
                .foregroundStyle(GTIColor.ink)
                .accessibilityHidden(true)
            if isAnswered {
                checkBadge
                    .offset(x: 17, y: 17)
            }
        }
        .frame(width: 48, height: 48)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(isMe ? "You" : "Member"))
        .accessibilityValue(Text(isAnswered ? "answered" : "still answering"))
        .accessibilityIdentifier("waiting.avatar.\(isAnswered ? "answered" : "pending")")
    }

    private var checkBadge: some View {
        ZStack {
            Circle()
                .fill(GTIColor.sun)
                .overlay(Circle().stroke(GTIColor.paper, lineWidth: 2))
                .frame(width: 14, height: 14)
            Text("✓")
                .font(.system(size: 8, weight: .black))
                .foregroundStyle(GTIColor.ink)
        }
    }

    private func bodyCopy(store: WaitingStore) -> some View {
        let pending = store.members.filter { store.answered.contains($0.id) == false }
        let copyText: String
        if pending.isEmpty {
            copyText = "Everyone's in. Holding for the engine — no spinners, promise."
        } else if pending.count == 1 {
            copyText = "Someone's still answering. We'll surface the verdict the second they're done — no spinners, promise."
        } else {
            copyText = "\(pending.count) people are still answering. We'll surface the verdict the second they're done — no spinners, promise."
        }
        return Text(copyText)
            .font(.system(size: GTIFont.Size.sm, weight: .semibold))
            .foregroundStyle(GTIColor.TextOnGradient.secondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: 280)
            .frame(maxWidth: .infinity, alignment: .center)
            .accessibilityIdentifier("waiting.body")
    }

    @ViewBuilder
    private var ctaDock: some View {
        VStack(spacing: GTISpacing.step3 + 2) {
            // Surface the fire-error and nudge messages first — they're
            // both transient.
            if let fireError {
                Text(fireError)
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("waiting.fireError")
            }
            if let nudgeMessage {
                Text(nudgeMessage)
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("waiting.nudgeMessage")
            }
            if let linkError {
                Text(linkError)
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("authChip.error")
            }

            AuthUpgradeChip(
                state: chipState,
                onSave: { Task { await onSaveTapped() } },
                onDismiss: { Task { await onDismissTapped() } }
            )

            decideNowCTA

            nudgeCTA
        }
    }

    @ViewBuilder
    private var decideNowCTA: some View {
        if let coord = fireCoordinator, coord.isInitiator, let store = waitingStore {
            // Quiz redesign: minimum quorum is one member — the initiator
            // alone always satisfies it. The CTA is always tappable
            // (no `need 2 in` gate); the label surfaces the partial-
            // quorum cost so the initiator can decide. Per
            // surfaces/04-waiting.md §"`Decide now` CTA".
            let label = "DECIDE NOW · \(store.answeredCount) OF \(store.memberCount) IN"
            Button {
                Task { await onDecideNowTapped() }
            } label: {
                Text(label)
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
            .disabled(coord.isFiring)
            .opacity(coord.isFiring ? 0.7 : 1.0)
            .accessibilityIdentifier("waiting.decideNow")
            .accessibilityLabel(Text("Decide now"))
            .accessibilityHint(Text("Fires the verdict for whoever has answered"))
        }
    }

    @ViewBuilder
    private var nudgeCTA: some View {
        if let store = waitingStore, store.pendingTargets().isEmpty == false {
            Button {
                onNudgeTapped(store: store)
            } label: {
                Text("NUDGE")
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
            .accessibilityIdentifier("waiting.nudge")
            .accessibilityLabel(Text("Nudge"))
        }
    }

    /// Map the local phase to the AuthUpgradeChip's state enum.
    private var chipState: AuthUpgradeChip.State {
        switch phase {
        case .loading:    return .hidden
        case .idle:       return .defaultIdle
        case .linking:    return .inProgress
        case .linked:     return .success
        case .dismissed:  return .dismissed
        case .hidden:     return .hidden
        }
    }

    // MARK: - actions

    private func onDecideNowTapped() async {
        guard let coord = fireCoordinator else { return }
        fireError = nil
        let outcome = await coord.tapDecideNow()
        switch outcome {
        case .firing, .alreadyFiring:
            // Server will broadcast verdict_ready when the engine
            // commits. No-op here — the view re-renders via
            // WaitingStore.verdictReady.
            break
        case .belowQuorum(let count):
            fireError = "Need 2 in to fire — only \(count) so far."
        case .notInitiator:
            fireError = "Only the room owner can fire the verdict."
        case .roomNotFound:
            fireError = "Couldn't find this room."
        case .unauthenticated:
            fireError = "You're signed out. Try opening the link again."
        case .rpcError(let message):
            fireError = "Couldn't fire the verdict. \(message)"
        }
    }

    private func onNudgeTapped(store: WaitingStore) {
        let outcome = store.nudge()
        switch outcome {
        case .sent:
            nudgeMessage = "Nudge sent."
        case .rateLimited(let seconds):
            let minutes = max(1, Int((Double(seconds) / 60.0).rounded(.up)))
            nudgeMessage = "Wait \(minutes) min before nudging again."
        case .noOneToNudge:
            nudgeMessage = "Everyone's already in."
        }
    }

    // MARK: - chip phase transitions

    private func refreshChipPhase() async {
        guard auth.state.isAnonymous, let userID = auth.state.userID else {
            phase = (auth.state.userID != nil) ? .hidden : .loading
            return
        }
        do {
            let render = try await promptStore.shouldRenderAuthChip(for: userID, now: now())
            phase = render ? .idle : .dismissed
        } catch {
            phase = .idle
        }
    }

    private func onSaveTapped() async {
        guard phase == .idle else { return }
        phase = .linking
        linkError = nil
        do {
            let credential = try await appleProvider.requestAppleCredential()
            _ = try await auth.linkApple(
                idToken: credential.idToken,
                nonce: credential.nonce
            )
            phase = .linked
        } catch is CancellationError {
            phase = .idle
        } catch {
            phase = .idle
            linkError = "Couldn't link Apple. Try again or tap Maybe later."
        }
    }

    private func onDismissTapped() async {
        guard phase == .idle else { return }
        guard let userID = auth.state.userID else { return }
        do {
            try await promptStore.recordDismissal(for: userID, now: now())
        } catch {
            // Read fail-soft. Local intent honored.
        }
        phase = .dismissed
    }
}

// MARK: - Apple credential seam

/// Minimal credential payload our coordinator needs. Kept distinct
/// from `ASAuthorization*` types so the protocol is testable on Linux
/// + the iOS unit-test target.
public struct AppleSignInCredential: Equatable, Sendable {
    public let idToken: String
    public let nonce: String?
    public init(idToken: String, nonce: String?) {
        self.idToken = idToken
        self.nonce = nonce
    }
}

/// Run the Apple Sign-in flow and return a credential.
/// Production: `LiveAppleSignInProvider` calls `ASAuthorizationController`.
/// Tests: substitute a stub that returns a fixed credential or throws.
@MainActor
public protocol AppleSignInProviding {
    func requestAppleCredential() async throws -> AppleSignInCredential
}

/// Live implementation backed by `AuthenticationServices`. Runs the
/// native Apple sheet, generates a per-request nonce per Apple's HIG,
/// and surfaces the resulting `identityToken` + nonce to the
/// coordinator.
@MainActor
public final class LiveAppleSignInProvider: NSObject, AppleSignInProviding {

    // Holds the delegate alive for the duration of an Apple sheet
    // session. Cleared after the continuation resumes.
    private var activeDelegate: AppleAuthDelegate?

    public override init() {
        super.init()
    }

    public func requestAppleCredential() async throws -> AppleSignInCredential {
        let rawNonce = Self.randomNonce()
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256(rawNonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        let delegate = AppleAuthDelegate()
        controller.delegate = delegate
        controller.presentationContextProvider = delegate
        self.activeDelegate = delegate

        // Await the delegate callback, then clear the retain so the
        // delegate can deallocate.
        do {
            let credential = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<AppleSignInCredential, Error>) in
                delegate.continuation = cont
                delegate.rawNonce = rawNonce
                controller.performRequests()
            }
            self.activeDelegate = nil
            return credential
        } catch {
            self.activeDelegate = nil
            throw error
        }
    }

    private static func randomNonce(length: Int = 32) -> String {
        let charset: [Character] =
            Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            let randoms: [UInt8] = (0..<16).map { _ in UInt8.random(in: 0...255) }
            for r in randoms where remaining > 0 {
                if r < charset.count {
                    result.append(charset[Int(r)])
                    remaining -= 1
                }
            }
        }
        return result
    }

    private static func sha256(_ input: String) -> String {
        let digest = SHA256.hash(data: Data(input.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

/// Continuation-bridging delegate for `ASAuthorizationController`.
private final class AppleAuthDelegate: NSObject,
                                        ASAuthorizationControllerDelegate,
                                        ASAuthorizationControllerPresentationContextProviding {

    var continuation: CheckedContinuation<AppleSignInCredential, Error>?
    var rawNonce: String?

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            continuation?.resume(throwing: AppleSignInError.missingIdentityToken)
            continuation = nil
            return
        }
        let payload = AppleSignInCredential(idToken: token, nonce: rawNonce)
        continuation?.resume(returning: payload)
        continuation = nil
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        // Apple's cancel maps to ASAuthorizationError.canceled. We
        // bubble it as a CancellationError so the view layer returns
        // to .idle quietly instead of surfacing an error string.
        if let nserror = error as? ASAuthorizationError, nserror.code == .canceled {
            continuation?.resume(throwing: CancellationError())
        } else {
            continuation?.resume(throwing: error)
        }
        continuation = nil
    }

    func presentationAnchor(
        for controller: ASAuthorizationController
    ) -> ASPresentationAnchor {
        // `ASAuthorizationController` requires a real on-screen anchor
        // — handing back a freshly-constructed `ASPresentationAnchor`
        // (= a detached `UIWindow`) makes the controller bail with an
        // `ASAuthorizationError` BEFORE the Apple sheet renders, which
        // surfaces in the UI as "Couldn't reach Apple. Try again."
        // with no sheet shown. Reach into the live scene graph for
        // the active key window instead. The empty fallback is only
        // hit if the app has no foreground scene at all (impossible
        // when this delegate is fired from a user tap).
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)
            ?? ASPresentationAnchor()
    }
}

public enum AppleSignInError: Error, Equatable {
    case missingIdentityToken
}
