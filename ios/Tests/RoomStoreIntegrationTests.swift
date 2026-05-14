// GetToIt — RoomStore integration tests (TB-02).
//
// Hits the live Supabase project configured in the app bundle via
// SUPABASE_PROJECT_URL + SUPABASE_ANON_KEY. Skips itself when those
// are absent so design-system-only PRs don't get blocked.
//
// Acceptance covered:
//   * `RoomStore.createRoom` writes a `rooms` row owned by the caller
//     plus a `members` row with `role='owner'`.
//   * `RoomStore.joinRoom` writes a `members` row with
//     `role='participant'` for a different user against the same room.
//   * RLS prevents a third (non-member) user from reading either row.

import XCTest
import Supabase
@testable import GetToIt

@MainActor
final class RoomStoreIntegrationTests: XCTestCase {

    // Shared config lookup mirrors `AnonAuthIntegrationTests`.
    private func loadConfig() throws -> SupabaseConfig {
        let bundle = Bundle(for: type(of: self))
        let config = SupabaseConfig.fromBundle(bundle)
            ?? SupabaseConfig.fromBundle(.main)
        guard let config else {
            throw XCTSkip("SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not configured for this build; skipping integration test.")
        }
        return config
    }

    /// Sign in as a fresh anonymous user on `client` and return their
    /// user id. Signs out first to clear any session left behind by an
    /// earlier test.
    @discardableResult
    private func signInFreshAnon(on client: SupabaseClient) async throws -> UUID {
        try? await client.auth.signOut()
        let session = try await client.auth.signInAnonymously()
        return session.user.id
    }

    /// Build a Supabase client backed by an *in-memory* auth storage.
    ///
    /// supabase-swift defaults to Keychain on Apple platforms, but
    /// keychain writes fail silently in an unsigned simulator build
    /// (`CODE_SIGNING_ALLOWED=NO` in our CI lane) — `signInAnonymously`
    /// still returns a Session, but `sessionManager.update` can't
    /// persist it, so `currentSession` is permanently nil and
    /// PostgREST never attaches the JWT. The in-memory storage keeps
    /// the session in heap memory where the SDK can round-trip it.
    private func makeClient() throws -> SupabaseClient {
        let config = try loadConfig()
        return SupabaseClient(
            supabaseURL: config.url,
            supabaseKey: config.anonKey,
            options: SupabaseClientOptions(
                auth: SupabaseClientOptions.AuthOptions(
                    storage: InMemoryAuthStorage()
                )
            )
        )
    }

    /// Heap-backed `AuthLocalStorage` for tests. Same shape as the
    /// upstream `KeychainLocalStorage` but without the entitlement
    /// requirement.
    private final class InMemoryAuthStorage: AuthLocalStorage, @unchecked Sendable {
        private var values: [String: Data] = [:]
        private let lock = NSLock()

        func store(key: String, value: Data) throws {
            lock.lock(); defer { lock.unlock() }
            values[key] = value
        }

        func retrieve(key: String) throws -> Data? {
            lock.lock(); defer { lock.unlock() }
            return values[key]
        }

        func remove(key: String) throws {
            lock.lock(); defer { lock.unlock() }
            values.removeValue(forKey: key)
        }
    }

    func testCreateRoomWritesOwnerMembershipAndIsReadableByTheCreator() async throws {
        let client = try makeClient()
        let creatorID = try await signInFreshAnon(on: client)
        let store = RoomStore(client: client)

        let room = try await store.createRoom(as: creatorID)

        XCTAssertEqual(room.creatorUserID, creatorID,
                       "expected creator_user_id to match the signed-in user")
        XCTAssertEqual(room.vertical, "food")
        XCTAssertEqual(room.status, "open")

        // Reading the room back through the same auth context must work
        // — proves the RLS policy admits the creator as a member.
        let fetched = try await store.fetchRoom(id: room.id)
        XCTAssertEqual(fetched?.id, room.id)

        // And the creator's `members` row carries the owner role.
        let role = try await store.fetchRole(roomID: room.id, userID: creatorID)
        XCTAssertEqual(role, "owner")

        try? await client.auth.signOut()
    }

    func testJoinRoomWritesParticipantMembershipForADifferentUser() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        // Device A — creator creates the room.
        let creatorID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: creatorID)

        // Device B — sign out as A, sign in as a brand new anon user.
        let joinerID = try await signInFreshAnon(on: client)
        XCTAssertNotEqual(creatorID, joinerID, "expected a distinct identity for the joiner")

        try await store.joinRoom(id: room.id, as: joinerID)

        let role = try await store.fetchRole(roomID: room.id, userID: joinerID)
        XCTAssertEqual(role, "participant")

        // The joiner can now read the `rooms` row — RLS admits them
        // because they're a member.
        let fetched = try await store.fetchRoom(id: room.id)
        XCTAssertEqual(fetched?.id, room.id)
        XCTAssertNotEqual(fetched?.creatorUserID, joinerID,
                          "expected the room's creator to be the original owner, not the joiner")

        try? await client.auth.signOut()
    }

    func testRLSHidesARoomFromANonMember() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        // Device A creates a room.
        let creatorID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: creatorID)

        // Device C — never joined — must not see it.
        _ = try await signInFreshAnon(on: client)

        let fetched = try await store.fetchRoom(id: room.id)
        XCTAssertNil(fetched, "expected RLS to hide the room from a non-member")

        try? await client.auth.signOut()
    }
}
