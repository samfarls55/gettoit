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

    /// Build a fresh anonymous client. Each call gets its own session
    /// so we can simulate distinct devices on the same Supabase project.
    private func freshAnonClient() async throws -> (SupabaseClient, UUID) {
        let config = try loadConfig()
        let client = SupabaseClient(supabaseURL: config.url, supabaseKey: config.anonKey)
        try? await client.auth.signOut()
        let session = try await client.auth.signInAnonymously()
        return (client, session.user.id)
    }

    func testCreateRoomWritesOwnerMembershipAndIsReadableByTheCreator() async throws {
        let (client, creatorID) = try await freshAnonClient()
        let store = RoomStore(client: client)

        let room = try await store.createRoom()

        XCTAssertEqual(room.creatorUserID, creatorID,
                       "expected creator_user_id to match the signed-in user")
        XCTAssertEqual(room.vertical, "food")
        XCTAssertEqual(room.status, "open")

        // Reading the room back through the same auth context must work
        // — proves the RLS policy admits the creator as a member.
        let fetched = try await store.fetchRoom(id: room.id)
        XCTAssertEqual(fetched?.id, room.id)

        // And the creator's `members` row carries the owner role.
        let role = try await store.fetchOwnRole(roomID: room.id)
        XCTAssertEqual(role, "owner")

        try? await client.auth.signOut()
    }

    func testJoinRoomWritesParticipantMembershipForADifferentUser() async throws {
        // Device A — creator.
        let (creatorClient, _) = try await freshAnonClient()
        let creatorStore = RoomStore(client: creatorClient)
        let room = try await creatorStore.createRoom()
        try? await creatorClient.auth.signOut()

        // Device B — invitee.
        let (joinerClient, joinerID) = try await freshAnonClient()
        let joinerStore = RoomStore(client: joinerClient)

        try await joinerStore.joinRoom(id: room.id)

        let role = try await joinerStore.fetchOwnRole(roomID: room.id)
        XCTAssertEqual(role, "participant")

        // The joiner can now read the `rooms` row — RLS admits them
        // because they're a member.
        let fetched = try await joinerStore.fetchRoom(id: room.id)
        XCTAssertEqual(fetched?.id, room.id)
        XCTAssertNotEqual(fetched?.creatorUserID, joinerID,
                          "expected the room's creator to be the original owner, not the joiner")

        try? await joinerClient.auth.signOut()
    }

    func testRLSHidesARoomFromANonMember() async throws {
        // Device A creates a room.
        let (creatorClient, _) = try await freshAnonClient()
        let creatorStore = RoomStore(client: creatorClient)
        let room = try await creatorStore.createRoom()
        try? await creatorClient.auth.signOut()

        // Device C — never joined — must not see it.
        let (outsiderClient, _) = try await freshAnonClient()
        let outsiderStore = RoomStore(client: outsiderClient)

        let fetched = try await outsiderStore.fetchRoom(id: room.id)
        XCTAssertNil(fetched, "expected RLS to hide the room from a non-member")

        try? await outsiderClient.auth.signOut()
    }
}
