// GetToIt — SessionSnapshotStore (TB-20).
//
// The room-snapshot read the post-Q5 router's group (S04 Waiting) path
// polls on a few-second cadence. One PostgREST round-trip returns
// everything the `WaitingStore` needs to bootstrap:
//
//   * the room's `members` (id + role) — the avatar row,
//   * the set of user-ids that have a `votes` row — the answered set,
//   * the room's `status` — `open` / `firing` / `verdict_ready` / …
//
// Why one round-trip: the web fallback's `SessionRoom` issues three
// parallel `from(...)` selects (members / votes / rooms). PostgREST
// embedded resources collapse that to a single request — selecting
// `members` and `votes` as embedded children off the `rooms` row.
// `rooms?id=eq.<id>&select=status,members(user_id,role),votes(user_id)`
// is one HTTP request; the foreign keys `members.room_id` and
// `votes.room_id` both point at `rooms.id`, so PostgREST resolves the
// embeds without a hint. Fewer round-trips keeps the poll cheap and
// the snapshot internally consistent (no torn read across three
// separate requests).
//
// Design seam:
//   * The store is a thin wrapper over `supabase-swift`. The decode +
//     projection into `SessionSnapshot` is a pure function
//     (`SessionSnapshot.init(row:)`) so it's unit-testable with no
//     live client.
//   * `PostQuizHost` injects `fetchSnapshot` rather than the store
//     itself, mirroring how it injects `fetchVerdict` — the poll loop
//     stays testable with a stub.

import Foundation
import Supabase

/// One room snapshot. The exact shape `WaitingStore.bootstrap` needs.
/// `bootstrap` is documented idempotent, so re-applying a fresh
/// snapshot on every poll cycle is safe — it overwrites cleanly.
public struct SessionSnapshot: Equatable, Sendable {
    public let members: [WaitingMember]
    public let answered: Set<UUID>
    public let status: RoomStatus

    public init(members: [WaitingMember], answered: Set<UUID>, status: RoomStatus) {
        self.members = members
        self.answered = answered
        self.status = status
    }
}

/// One snapshot round-trip. Production wires this to
/// `SessionSnapshotStore.fetchSnapshot`; tests pass a stub.
public typealias SessionSnapshotFetch =
    @Sendable (UUID) async throws -> SessionSnapshot?

@MainActor
public final class SessionSnapshotStore {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    /// Read the room snapshot in a single PostgREST round-trip.
    ///
    /// Returns nil when the room row is missing or RLS hides it from
    /// the caller (a non-member) — the caller treats a nil snapshot as
    /// "nothing to re-bootstrap this cycle" rather than an error.
    public func fetchSnapshot(roomID: UUID) async throws -> SessionSnapshot? {
        let rows: [SnapshotRow] = try await client
            .from("rooms")
            .select("status, members(user_id, role), votes(user_id)")
            .eq("id", value: roomID.uuidString.lowercased())
            .limit(1)
            .execute()
            .value
        guard let row = rows.first else { return nil }
        return SessionSnapshot(row: row)
    }

    // MARK: - wire types

    /// The embedded-resource shape PostgREST returns for
    /// `rooms?select=status,members(user_id,role),votes(user_id)`.
    public struct SnapshotRow: Decodable, Sendable {
        public let status: String
        public let members: [MemberRow]
        public let votes: [VoteRow]

        public struct MemberRow: Decodable, Sendable {
            public let userID: UUID
            public let role: String
            enum CodingKeys: String, CodingKey {
                case userID = "user_id"
                case role
            }
        }

        public struct VoteRow: Decodable, Sendable {
            public let userID: UUID
            enum CodingKeys: String, CodingKey {
                case userID = "user_id"
            }
        }
    }
}

extension SessionSnapshot {
    /// Pure projection of a PostgREST embedded-resource row into the
    /// snapshot shape. Split out from the network call so the decode +
    /// shaping is unit-testable with no live client.
    ///
    /// An unknown `rooms.status` string degrades to `.open` rather than
    /// dropping the whole snapshot — a forward-compatible status the
    /// app doesn't yet model should still let the avatar row render.
    public init(row: SessionSnapshotStore.SnapshotRow) {
        let members = row.members.map {
            WaitingMember(id: $0.userID, role: $0.role)
        }
        let answered = Set(row.votes.map(\.userID))
        let status = RoomStatus(rawValue: row.status) ?? .open
        self.init(members: members, answered: answered, status: status)
    }
}
