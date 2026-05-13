// GetToIt — AuthCoordinator (walking-skeleton subset).
//
// TB-01 only needs the anonymous-sign-in path. Future tracer bullets
// (TB-12) extend this with Sign-in-with-Apple linking. Keeping the
// shape now so the upgrade path doesn't require restructuring.

import Foundation
import Supabase

@MainActor
@Observable
public final class AuthCoordinator {
    public enum State: Equatable, Sendable {
        case idle
        case signingIn
        case anonymous(userID: UUID)
        case error(String)
    }

    public private(set) var state: State = .idle

    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    /// Sign the device in as a fresh anonymous identity. Subsequent
    /// launches reuse the persisted session via `supabase-swift`.
    public func ensureSignedIn() async {
        // If a session is already cached, surface it without a network hit.
        if let session = try? await client.auth.session {
            self.state = .anonymous(userID: session.user.id)
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
}
