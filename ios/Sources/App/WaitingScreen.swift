// GetToIt — WaitingScreen (TB-12 minimal placeholder).
//
// SCOPE GUARD: this view is intentionally MINIMAL. It exists to host
// the C-22 Auth Upgrade Chip (TB-12) and exercise its render gate
// against the AuthCoordinator + AuthPromptStore state machine. The
// full S04 surface (avatar row, headline, countdown, Decide-now,
// Nudge) is owned by TB-07 — do NOT pre-empt it here.
//
// What this view does:
//   1. Reads the AuthCoordinator state. If anonymous AND the prompt
//      store says render-OK, renders the C-22 chip in its canonical
//      states.
//   2. On chip tap → save: drives `AuthSignInController` to run the
//      `ASAuthorizationController` flow, then hands the idToken to
//      `AuthCoordinator.linkApple`.
//   3. On chip tap → dismiss: writes through `AuthPromptStore.recordDismissal`
//      and flips the chip to its `dismissed` state.
//
// Web fallback is hosted in `web/` — that path never instantiates
// this view, so the chip never renders on web by construction.
// Confirmed in `AuthUpgradeChipRenderGateTests`.

import SwiftUI
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

    private let auth: AuthCoordinator
    private let promptStore: AuthPromptStore
    private let appleProvider: AppleSignInProviding
    private let now: () -> Date

    public init(
        auth: AuthCoordinator,
        promptStore: AuthPromptStore,
        appleProvider: AppleSignInProviding? = nil,
        now: @escaping () -> Date = { .now }
    ) {
        self.auth = auth
        self.promptStore = promptStore
        // Default-construct inside the init body so MainActor isolation
        // on `LiveAppleSignInProvider` is in scope. A nonisolated default
        // expression in the parameter list cannot call a @MainActor init.
        self.appleProvider = appleProvider ?? LiveAppleSignInProvider()
        self.now = now
    }

    public var body: some View {
        ZStack {
            GTIGradient.surface(.waiting)
                .ignoresSafeArea()

            VStack(spacing: GTISpacing.step6) {
                // Minimal headline so the surface isn't blank. TB-07
                // replaces this with the full N-of-M avatar row.
                Text("Waiting")
                    .font(.system(size: GTIFont.Size.heading, weight: .heavy))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .accessibilityIdentifier("waiting.headline")

                Spacer()

                if let linkError {
                    Text(linkError)
                        .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                        .foregroundStyle(GTIColor.TextOnGradient.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, GTISpacing.step6)
                        .accessibilityIdentifier("authChip.error")
                }

                AuthUpgradeChip(
                    state: chipState,
                    onSave: { Task { await onSaveTapped() } },
                    onDismiss: { Task { await onDismissTapped() } }
                )
                .padding(.horizontal, GTISpacing.step6)
                .padding(.bottom, GTISpacing.step5)
            }
        }
        .task {
            await refreshChipPhase()
        }
    }

    /// Map the local phase to the AuthUpgradeChip's state enum.
    private var chipState: AuthUpgradeChip.State {
        switch phase {
        case .loading:    return .hidden    // no flash while we check
        case .idle:       return .defaultIdle
        case .linking:    return .inProgress
        case .linked:     return .success
        case .dismissed:  return .dismissed
        case .hidden:     return .hidden
        }
    }

    // MARK: - phase transitions

    private func refreshChipPhase() async {
        // If the user is no longer anonymous, hide unconditionally.
        guard auth.state.isAnonymous, let userID = auth.state.userID else {
            phase = (auth.state.userID != nil) ? .hidden : .loading
            return
        }
        do {
            let render = try await promptStore.shouldRenderAuthChip(for: userID, now: now())
            phase = render ? .idle : .dismissed
        } catch {
            // Read failure shouldn't crash the surface. Default to
            // showing the chip — better one extra tap than a missed
            // upgrade moment. (Re-evaluation trigger in ADR 0007.)
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
            // User cancelled the Apple sheet — return to idle without
            // recording a dismissal. The chip remains available.
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
            // Even if the write fails, flip the chip locally — the
            // user signalled intent. A failed write means they'll see
            // the chip on the next launch; not great, but a hard error
            // here would feel punitive for a soft preference.
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
        // delegate can deallocate. Using `withCheckedThrowingContinuation`
        // doesn't accept a defer that crosses the suspension point, so
        // we wrap explicitly.
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
        // CryptoKit is available on iOS 13+; our deployment target is
        // iOS 17 so the import at the top of the file is unconditional.
        let digest = SHA256.hash(data: Data(input.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}

/// Continuation-bridging delegate for `ASAuthorizationController`.
/// Hidden inside the file since nothing else needs it.
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
        // SwiftUI manages the scene; returning a blank anchor lets
        // Apple find the active window on iOS 17+. This is the same
        // pattern Supabase's own iOS sample uses.
        ASPresentationAnchor()
    }
}

public enum AppleSignInError: Error, Equatable {
    case missingIdentityToken
}
