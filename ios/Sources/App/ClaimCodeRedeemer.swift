// GetToIt — ClaimCodeRedeemer (tb-WF-14).
//
// The iOS side of the web-invitee account-claim bridge (ADR 0015). A
// Web invitee who voted in the browser installs the iOS app, taps the
// S00a "Voted on the web?" affordance, and types a claim code minted
// by the web "Getting the app?" affordance (tb-WF-13). Redeeming the
// code carries the browser's anonymous Supabase session into the app
// keychain — so the subsequent Sign-in-with-Apple tap on S00a becomes
// `linkApple` (preserving the `user_id`) instead of `signInWithApple`.
//
// ── Two steps behind one seam ───────────────────────────────────────
// `redeem(code:)` does two things that both have to succeed:
//   1. Invoke the `redeem-claim-code` Edge Function with the bare code.
//      The function looks the code up, burns it single-use, and returns
//      the carried anonymous session's refresh token.
//   2. Install that refresh token into the app keychain via
//      `auth.refreshSession(refreshToken:)`, which exchanges it for a
//      fresh session and persists it to supabase-swift's session
//      storage. From that point the app holds the exact web identity.
// Both steps live behind the `ClaimCodeRedeemer` protocol because step
// 2 needs the real `SupabaseClient` (the keychain install cannot be
// faked) — tests substitute a stub for the whole seam.
//
// ── Why the redeem call is unauthenticated ──────────────────────────
// A fresh-install app sitting on S00a has NO session — it cannot
// present a bearer JWT. The claim code itself is the credential; the
// Edge Function authenticates the request by the unguessable, single-
// use, short-TTL code plus rate limiting (ADR 0015 §Decision). The
// `functions.invoke` call still carries the project anon key, which is
// all an unauthed Edge Function call needs.

import Foundation
import Supabase

/// The seam the `AuthCoordinator` redeem path is built on. Production
/// uses `LiveClaimCodeRedeemer`; unit tests substitute a stub so the
/// success / failure paths are driven without a live Supabase
/// round-trip or a real keychain write.
@MainActor
public protocol ClaimCodeRedeemer: Sendable {
    /// Redeem `code` end to end: call the `redeem-claim-code` Edge
    /// Function, then install the returned anonymous session into the
    /// app keychain. Returns the carried anonymous `user_id` once the
    /// session is resident. Throws `ClaimCodeRedeemError` for a bad /
    /// expired / used code or a transport failure.
    func redeem(code: String) async throws -> UUID
}

/// The redeem failure taxonomy surfaced to S00a. Each case maps to a
/// distinct `redeem-claim-code` Edge Function response; S00a collapses
/// the recoverable ones (`codeNotFound` / `codeExpired` /
/// `codeAlreadyRedeemed` / `invalidCode` / `rateLimited`) to one
/// retryable inline error per the sg-WF-8 spec — "generate a fresh one
/// from your web link."
public enum ClaimCodeRedeemError: Error, Equatable {
    /// The code is structurally invalid or has no matching row.
    case invalidCode
    /// No `claim_codes` row for the code (404 `code_not_found`).
    case codeNotFound
    /// The code is past its ~30-minute TTL (410 `code_expired`).
    case codeExpired
    /// The code was already redeemed once (409 `code_already_redeemed`).
    case codeAlreadyRedeemed
    /// Too many redeem attempts from this source (429 `rate_limited`).
    case rateLimited
    /// A server-side fault — misconfiguration, decryption failure, or a
    /// transport error reaching the function (500 / network).
    case serverError
    /// The redeem succeeded but the returned session could not be
    /// installed into the keychain (the refresh-token exchange failed).
    case sessionInstallFailed
}

/// Live redeemer backed by supabase-swift. Invokes the
/// `redeem-claim-code` Edge Function, then calls
/// `auth.refreshSession(refreshToken:)` to exchange the carried
/// anonymous refresh token for a session and persist it to the
/// keychain.
@MainActor
public struct LiveClaimCodeRedeemer: ClaimCodeRedeemer {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    /// The `redeem-claim-code` success body. The function returns the
    /// decrypted refresh token of the carried anonymous identity plus
    /// that identity's `user_id` (echoed for a sanity check).
    private struct RedeemResponse: Decodable {
        let status: String
        let refresh_token: String
        let user_id: String
    }

    /// The `redeem-claim-code` error body — `{ "error": "<code>" }`.
    private struct RedeemErrorBody: Decodable {
        let error: String
    }

    private struct CodeBody: Encodable {
        let code: String
    }

    public func redeem(code: String) async throws -> UUID {
        // ── 1. Invoke the Edge Function ───────────────────────────────
        let response: RedeemResponse
        do {
            response = try await client.functions.invoke(
                "redeem-claim-code",
                options: FunctionInvokeOptions(
                    method: .post,
                    body: CodeBody(code: code)
                )
            )
        } catch {
            // supabase-swift surfaces a non-2xx response as
            // `FunctionsError.httpError(code:data:)`. Map the function's
            // structured error body onto the redeem taxonomy so S00a
            // can show the right copy.
            throw Self.mapInvokeError(error)
        }

        // ── 2. Install the carried session into the keychain ──────────
        // `refreshSession(refreshToken:)` exchanges the carried
        // anonymous refresh token for a fresh access/refresh pair and
        // persists it to supabase-swift's session storage (the
        // keychain). After this returns, the app holds the exact web
        // anonymous identity — `AuthCoordinator` can read it back as
        // `.anonymous`.
        let session: Session
        do {
            session = try await client.auth.refreshSession(
                refreshToken: response.refresh_token
            )
        } catch {
            throw ClaimCodeRedeemError.sessionInstallFailed
        }

        return session.user.id
    }

    /// Map a `functions.invoke` failure to a `ClaimCodeRedeemError`.
    /// Reads the `{ "error": "<code>" }` body the Edge Function emits;
    /// an unrecognized shape falls back to `.serverError`.
    private static func mapInvokeError(_ error: Error) -> ClaimCodeRedeemError {
        guard case let FunctionsError.httpError(_, data) = error else {
            // A transport / decoding failure with no HTTP body.
            return .serverError
        }
        guard
            let body = try? JSONDecoder().decode(RedeemErrorBody.self, from: data)
        else {
            return .serverError
        }
        switch body.error {
        case "code_not_found":
            return .codeNotFound
        case "code_expired":
            return .codeExpired
        case "code_already_redeemed":
            return .codeAlreadyRedeemed
        case "invalid_code":
            return .invalidCode
        case "rate_limited":
            return .rateLimited
        default:
            // redeem_claim_code_misconfigured / redeem_claim_code_failed
            // / invalid_request_body / anything else.
            return .serverError
        }
    }
}

// MARK: - S00a "Voted on the web?" affordance model (tb-WF-14)

/// The presentation state of the S00a "Voted on the web?" account-claim
/// affordance, lifted out of `SignInScreen` into an `@Observable` model
/// so it is unit-testable the same way `AuthCoordinator` is.
///
/// SwiftUI `@State` value-type properties only persist while the view
/// is mounted in a hierarchy; a unit test that invokes a handler on a
/// bare `SignInScreen` struct cannot observe `@State` writes. By
/// holding the affordance's mutable state in an `@Observable` reference
/// type the screen instead `@State`-stores a stable object reference,
/// and the tests drive `ClaimAffordanceModel` directly — mirroring the
/// `AuthCoordinator` test seam.
@MainActor
@Observable
public final class ClaimAffordanceModel {
    /// The affordance's local phase, per the sg-WF-8 spec §"Behavior":
    ///   * collapsed — the quiet "Voted on the web?" text link; default.
    ///   * entry     — the revealed code-entry state.
    ///   * redeeming — a redeem is in flight; the submit CTA disables.
    public enum Phase: Equatable {
        case collapsed
        case entry
        case redeeming
    }

    public private(set) var phase: Phase = .collapsed
    /// The user's typed claim code — two-way bound to the soft-glass
    /// text field.
    public var code: String = ""
    /// The non-blocking inline error line, or nil when clear.
    public private(set) var errorMessage: String?

    /// The locked sg-WF-8 inline-error copy. Every recoverable redeem
    /// failure — bad / expired / used / mistyped code, rate-limit,
    /// transport — collapses to this one retryable line.
    static let errorCopy =
        "That code didn't work. Generate a fresh one from your web link."

    private let auth: AuthCoordinator

    public init(auth: AuthCoordinator) {
        self.auth = auth
    }

    /// Reveal the code-entry state. The quiet link is consumed by the
    /// reveal (sg-WF-8 §"Behavior" #2).
    public func reveal() {
        guard phase == .collapsed else { return }
        phase = .entry
        errorMessage = nil
    }

    /// Submit the typed claim code. On success the coordinator reaches
    /// `.anonymous` (the carried web identity is in the keychain) and
    /// the affordance collapses — the user still must tap the Apple
    /// pill, which now routes through `linkApple`. On a bad / expired /
    /// used / mistyped code the inline error appears and the code-entry
    /// state stays open for a retry; nothing is destroyed.
    public func submit() async {
        guard phase == .entry else { return }
        let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
        // The CTA is disabled while the field is empty; this guard is
        // belt-and-braces so an empty redeem never reaches the network.
        guard !trimmed.isEmpty else { return }

        phase = .redeeming
        errorMessage = nil
        do {
            _ = try await auth.redeemClaimCode(trimmed)
            // Success: the dock re-renders. The code-entry state has
            // done its job; collapse it.
            phase = .collapsed
            code = ""
        } catch {
            phase = .entry
            errorMessage = Self.errorCopy
        }
    }
}
