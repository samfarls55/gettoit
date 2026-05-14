// GetToIt — RoomStore (TB-02).
//
// Thin wrapper over `supabase-swift` for the two-row room+member
// create-and-join handshake. Kept narrow on purpose: anything beyond
// "create my room", "join this room", "tell me my role" belongs in a
// later tracer bullet (TB-03 adds timer/radius, TB-04 adds votes,
// TB-07 adds realtime presence).
//
// Schema is defined in `supabase/migrations/20260513210000000_rooms_and_members.sql`.
// RLS policies enforce that:
//   * Reading `rooms` requires being in `members` for that room.
//   * Inserting a `rooms` row requires `creator_user_id = auth.uid()`.
//   * Inserting a `members` row requires `user_id = auth.uid()`.
//
// The room create path runs *two* inserts back-to-back:
//   1. `rooms` row owned by the caller.
//   2. `members` row inserting the caller as `role='owner'`.
// They aren't in a Postgres transaction. If step 2 fails the caller
// is left without read access to their own room — the iOS UI surfaces
// the failure and the next session create succeeds on its own. A
// future RPC could fuse them into a single round-trip; for v1 this is
// the simpler shape and the failure mode is recoverable.

import Foundation
import Supabase

@MainActor
public final class RoomStore {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - public surface

    /// Create a new room owned by `userID` and insert their `members`
    /// row with `role='owner'`. The caller is responsible for ensuring
    /// `userID` matches the active Supabase auth session — RLS rejects
    /// the insert otherwise.
    ///
    /// We allocate the room id client-side rather than letting Postgres
    /// generate it. Reason: the `rooms` SELECT policy requires the
    /// caller to be a member of the room, but the bootstrap member
    /// row isn't written until AFTER the rooms insert succeeds — so
    /// asking PostgREST for the inserted row back (`returning=representation`)
    /// would fail the SELECT policy and surface as a "0 rows" error from
    /// `.single()`. Skipping the read-back lets us return the row built
    /// from the values we already hold.
    @discardableResult
    public func createRoom(as userID: UUID) async throws -> Room {
        let roomID = UUID()
        let insert = RoomInsert(id: roomID, creatorUserID: userID, status: "open", vertical: "food")
        try await client
            .from("rooms")
            .insert(insert)
            .execute()

        let membership = MemberInsert(roomID: roomID, userID: userID, role: "owner")
        try await client
            .from("members")
            .insert(membership)
            .execute()

        // Now that the membership row exists the rooms SELECT policy
        // admits the caller; read the row back so we surface the
        // server-side defaults (`status`, `vertical`, `created_at`).
        if let room = try await fetchRoom(id: roomID) {
            return room
        }

        // Server didn't echo the row back — extremely unlikely, but
        // construct a best-effort representation so callers don't fail
        // silently. The id and creator are authoritative.
        return Room(
            id: roomID,
            creatorUserID: userID,
            status: "open",
            vertical: "food",
            createdAt: ""
        )
    }

    /// Join an existing room as `role='participant'`. Idempotent in
    /// the sense that the underlying primary key on `(room_id, user_id)`
    /// would reject a duplicate insert — callers can choose to swallow
    /// the conflict if they want re-join-is-a-no-op semantics. For TB-02
    /// the join surface only calls this once per deep-link tap.
    public func joinRoom(id roomID: UUID, as userID: UUID) async throws {
        let membership = MemberInsert(roomID: roomID, userID: userID, role: "participant")
        try await client
            .from("members")
            .insert(membership)
            .execute()
    }

    /// Read a room by id. Returns nil when RLS hides the row from the
    /// caller (i.e. the caller isn't a member) — the test target uses
    /// this to assert RLS rejects non-members.
    public func fetchRoom(id roomID: UUID) async throws -> Room? {
        do {
            let room: Room = try await client
                .from("rooms")
                .select()
                .eq("id", value: roomID.uuidString.lowercased())
                .single()
                .execute()
                .value
            return room
        } catch {
            // `single()` raises when zero rows come back, which is the
            // shape RLS produces for a non-member. Treating that as
            // "not visible to me" is exactly what the test expects.
            return nil
        }
    }

    /// Look up the given user's role in a given room. Returns nil when
    /// no row exists for the user (either not a member, or RLS hid it).
    public func fetchRole(roomID: UUID, userID: UUID) async throws -> String? {
        do {
            let row: MemberRoleRow = try await client
                .from("members")
                .select("role")
                .eq("room_id", value: roomID.uuidString.lowercased())
                .eq("user_id", value: userID.uuidString.lowercased())
                .single()
                .execute()
                .value
            return row.role
        } catch {
            return nil
        }
    }

    // MARK: - wire types

    public struct Room: Codable, Equatable, Sendable {
        public let id: UUID
        public let creatorUserID: UUID
        public let status: String
        public let vertical: String
        // Keep `created_at` as a string for now. The Postgres timestamp
        // shape (with microseconds and a timezone offset) doesn't decode
        // cleanly via the default supabase-swift JSON decoder, and v1's
        // iOS surfaces never render this value — server-side cron + the
        // realtime broadcast carry the timing semantics.
        public let createdAt: String

        enum CodingKeys: String, CodingKey {
            case id
            case creatorUserID = "creator_user_id"
            case status
            case vertical
            case createdAt = "created_at"
        }
    }

    private struct RoomInsert: Encodable {
        let id: UUID
        let creatorUserID: UUID
        let status: String
        let vertical: String

        enum CodingKeys: String, CodingKey {
            case id
            case creatorUserID = "creator_user_id"
            case status
            case vertical
        }
    }

    private struct MemberInsert: Encodable {
        let roomID: UUID
        let userID: UUID
        let role: String

        enum CodingKeys: String, CodingKey {
            case roomID = "room_id"
            case userID = "user_id"
            case role
        }
    }

    private struct MemberRoleRow: Decodable {
        let role: String
    }
}
