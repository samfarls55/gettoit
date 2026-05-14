// GetToIt — AuthCoordinator.
//
// Wraps the two auth states v1 supports per ADR 0007:
//   * `anonymous`     — the default. Created on first app launch via
//                       `signInAnonymously()`. Persists across launches
//                       via supabase-swift session storage.
//   * `linkedApple`   — the user tapped the S04 auth-upgrade chip
//                       (TB-12) and completed the Sign in with Apple
//                       flow. The Apple identity is attached to the
//                       SAME `user_id` the anonymous session carried —
//                       all `votes`, `members`, `events` rows survive.
//
// TB-01 introduced the anonymous path; TB-12 extends with the upgrade.
// The interface is shaped so the rest of the app can read
// `coordinator.state.userID` without caring which identity flavor is
// active.
//
// `linkApple` is dependency-injected via the `SupabaseAuthLinker`
// protocol so the unit tests can drive the success / failure paths
// deterministically. The production call site uses
// `SupabaseAuthLinker.live(client:)` which goes through
// `supabase-swift`'s `signInWithIdToken` — when the session is
// anonymous, Supabase's auth server attaches the Apple identity to
// the existing `user_id` rather than minting a fresh one. The actual
// network round-trip is verified manually in TestFlight per TB-17;
// the unit tests here cover the state-machine contract.

import Foundation
import Supabase

@MainActor
@Observable
public final class AuthCoordinator {
    public enum State: Equatable, Sendable {
        case idle
        case signingIn
        case anonymous(userID: UUID)
        case linking(userID: UUID)
        case linkedApple(userID: UUID)
        case error(String)

        /// The active `user_id` regardless of identity flavor. Returns
        /// nil while signed-out or still signing in. The TB-12 merge
        /// invariant is "the userID before and after `linkApple` is
        /// the same"; this accessor is how callers verify that.
        public var userID: UUID? {
            switch self {
            case .anonymous(let id), .linking(let id), .linkedApple(let id):
                return id
            case .idle, .signingIn, .error:
                return nil
            }
        }

        /// Whether the current state represents an anonymous (un-linked)
        /// user. Drives the S04 auth-upgrade chip's render gate.
        public var isAnonymous: Bool {
            if case .anonymous = self { return true }
            return false
        }
    }

    public private(set) var state: State = .idle

    private let client: SupabaseClient
    private let linker: any SupabaseAuthLinker
    private let deleter: any SupabaseAccountDeleter

    public init(
        client: SupabaseClient,
        linker: (any SupabaseAuthLinker)? = nil,
        deleter: (any SupabaseAccountDeleter)? = nil
    ) {
        self.client = client
        self.linker = linker ?? LiveSupabaseAuthLinker(client: client)
        self.deleter = deleter ?? LiveSupabaseAccountDeleter(client: client)
    }

    /// Sign the device in as a fresh anonymous identity. Subsequent
    /// launches reuse the persisted session via `supabase-swift`. If
    /// the cached session is already Apple-linked (the user upgraded
    /// in a prior run), surface that as `.linkedApple` instead.
    public func ensureSignedIn() async {
        if let session = try? await client.auth.session {
            // The `is_anonymous` claim in the JWT tells us whether the
            // user is still anonymous or has been upgraded. We could
            // also inspect `session.user.identities` for an Apple
            // provider entry, but the JWT claim is the authoritative
            // signal Supabase exposes and avoids decoding identities
            // from JSON.
            let id = session.user.id
            if session.user.isAnonymous == false {
                self.state = .linkedApple(userID: id)
            } else {
                self.state = .anonymous(userID: id)
            }
            return
        }

        self.state = .signingIn
        do {
            let session = try await client.auth.signInAnonymously()
            self.state = .anonymous(userID: session.user.id)
        } catch {
            self.state = .error(String(describing: error))
        }
    }

    /// Link the current anonymous identity to a Sign-in-with-Apple
    /// account. The `idToken` + `nonce` come from
    /// `ASAuthorizationController` on the device — the chip's tap
    /// handler runs that flow and then calls this method.
    ///
    /// Invariant: the `user_id` does not change. Supabase attaches the
    /// Apple identity to the existing anonymous user, so every
    /// `votes`, `members`, `events`, `ratifications` row keyed off
    /// that id continues to belong to the same human.
    ///
    /// Failure modes:
    ///   * Already linked → no-op success; state becomes
    ///     `.linkedApple(currentUserID)`.
    ///   * Not currently signed in → throws `LinkError.notSignedIn`;
    ///     state stays `.idle` (caller must `ensureSignedIn()` first).
    ///   * Apple token invalid / network error → state stays
    ///     `.anonymous` (unchanged); error is rethrown so the chip
    ///     can re-enable for retry.
    @discardableResult
    public func linkApple(idToken: String, nonce: String?) async throws -> UUID {
        guard let priorID = state.userID else {
            throw LinkError.notSignedIn
        }

        // Re-link on an already-linked user is a no-op. Callers should
        // guard against this (the chip only renders when anonymous),
        // but defending here means a stale chip tap can't corrupt
        // anything.
        if case .linkedApple = state {
            return priorID
        }

        self.state = .linking(userID: priorID)
        let newID: UUID
        do {
            newID = try await linker.linkApple(
                idToken: idToken,
                nonce: nonce,
                currentUserID: priorID
            )
        } catch {
            // Linker error (network / Apple token invalid / etc.).
            // Restore the anonymous state so the chip can re-render
            // and the user can retry or dismiss. The userIDChanged
            // case is detected OUTSIDE the do/catch below so we don't
            // accidentally re-enter this branch and overwrite the
            // .error state.
            self.state = .anonymous(userID: priorID)
            throw error
        }

        // Merge-correctness assertion: the same `user_id` must come
        // back out the other side. If Supabase ever changes semantics
        // and returns a fresh id, this assertion catches it loudly
        // rather than the user silently losing history. Surface .error
        // so the UI can render a hard-stop rather than masking drift
        // as a transient anonymous-state re-render.
        guard newID == priorID else {
            self.state = .error("Apple link returned a different user_id")
            throw LinkError.userIDChanged(before: priorID, after: newID)
        }
        self.state = .linkedApple(userID: newID)
        return newID
    }

    public enum LinkError: Error, Equatable {
        case notSignedIn
        case userIDChanged(before: UUID, after: UUID)
    }

    /// TB-16 — delete the current user and bootstrap a fresh anonymous
    /// session. The actual auth.users row deletion happens server-side
    /// in the `delete-user` Edge Function (the iOS client doesn't ship
    /// a service-role key, so it can't call `auth.admin.deleteUser`
    /// directly). Cascade FKs in the public schema handle the rest
    /// (per ADR 0006).
    ///
    /// Flow on success:
    ///   1. Edge function validates the caller's JWT and deletes the
    ///      auth.users row matching it.
    ///   2. Local session storage still holds the (now-stale) JWT —
    ///      `signOut()` clears it.
    ///   3. `signInAnonymously()` mints a fresh anonymous identity.
    ///   4. State transitions to `.anonymous(newUserID)`.
    ///
    /// Failure modes:
    ///   * Not currently signed in → `DeleteError.notSignedIn`; state
    ///     unchanged.
    ///   * Edge function reachable but rejects → rethrows; state
    ///     becomes `.error`. The Settings surface re-enables the CTA
    ///     so the user can retry.
    ///   * Edge function unreachable (network) → rethrows.
    ///   * signOut / signInAnonymously fails after delete → bubbles
    ///     up as `.error`; the local row is dead but the app may need
    ///     a relaunch to recover.
    @discardableResult
    public func deleteAndReboot() async throws -> UUID {
        guard state.userID != nil else {
            throw DeleteError.notSignedIn
        }

        self.state = .signingIn
        do {
            try await deleter.deleteCurrentUser()
        } catch {
            self.state = .error(String(describing: error))
            throw error
        }

        // The cached JWT now references a row that no longer exists.
        // signOut clears the keychain entry; we use `try?` because the
        // server-side session is already invalid and may 401 the
        // revoke call, which we don't care about — the goal is
        // wiping the local session.
        try? await client.auth.signOut()

        do {
            let session = try await client.auth.signInAnonymously()
            self.state = .anonymous(userID: session.user.id)
            return session.user.id
        } catch {
            self.state = .error(String(describing: error))
            throw error
        }
    }

    public enum DeleteError: Error, Equatable {
        case notSignedIn
    }

    // MARK: - test seam

    /// Internal-only setter so unit tests can push the coordinator
    /// into a specific state without performing a real anonymous
    /// sign-in. Not part of the public API — callers from outside
    /// the module can't see this method (same-module @testable).
    /// Used by `AuthCoordinatorLinkAppleTests`.
    internal func _setStateForTesting(_ value: State) {
        self.state = value
    }
}

// MARK: - Auth linker dependency

/// Minimal seam for the Apple link call. Production uses
/// `LiveSupabaseAuthLinker`; tests substitute a stub to drive the
/// success / failure / userID-changed paths without an actual Apple
/// identity token.
public protocol SupabaseAuthLinker: Sendable {
    /// Perform the Supabase Apple-link call. Returns the `user_id`
    /// the auth server says is active after the link. In the happy
    /// path this equals `currentUserID`; the coordinator asserts on
    /// that equality.
    func linkApple(
        idToken: String,
        nonce: String?,
        currentUserID: UUID
    ) async throws -> UUID
}

/// Live implementation backed by `supabase-swift`. Calls
/// `linkIdentityWithIdToken` — the dedicated supabase-swift method
/// for attaching a new OIDC identity to the **currently authenticated**
/// user. The auth server receives the existing session's bearer token
/// in the Authorization header and merges the Apple identity onto
/// that user's `auth.users` row, leaving `user_id` untouched. Every
/// `votes`, `members`, `events`, `ratifications` row continues to be
/// owned by the same id.
///
/// Cross-device login + history-preservation is verified end-to-end
/// in TestFlight per TB-17 (CI can't mint a real Apple identity token
/// against the sandbox).
// MARK: - Account deleter dependency

/// Minimal seam for the in-app delete call. Production uses
/// `LiveSupabaseAccountDeleter`; tests substitute a stub to drive the
/// success / failure paths without invoking the real Edge function.
public protocol SupabaseAccountDeleter: Sendable {
    /// Invoke the `delete-user` Edge function with the current
    /// session's JWT. Returns on success; throws on transport,
    /// auth, or server error.
    func deleteCurrentUser() async throws
}

/// Live implementation backed by `supabase-swift`'s Functions API.
/// POSTs to `/functions/v1/delete-user` with the active session's
/// bearer token. The Edge function reads the user_id from the JWT
/// (the request body is ignored for identity), so no payload is
/// needed.
public struct LiveSupabaseAccountDeleter: SupabaseAccountDeleter {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func deleteCurrentUser() async throws {
        let _: DeleteUserResponse = try await client.functions.invoke(
            "delete-user",
            options: FunctionInvokeOptions(
                method: .post,
                body: EmptyBody()
            )
        )
    }

    private struct EmptyBody: Encodable {}

    private struct DeleteUserResponse: Decodable {
        let status: String
        let user_id: String
        let existed: Bool
    }
}

public struct LiveSupabaseAuthLinker: SupabaseAuthLinker {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func linkApple(
        idToken: String,
        nonce: String?,
        currentUserID: UUID
    ) async throws -> UUID {
        let credentials = OpenIDConnectCredentials(
            provider: .apple,
            idToken: idToken,
            nonce: nonce
        )
        let session = try await client.auth.linkIdentityWithIdToken(credentials: credentials)
        return session.user.id
    }
}
