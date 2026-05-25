// GetToIt — MemberFetchWriter (TB-21 quiz redesign).
//
// Persists a member's full raw Foursquare candidate fetch into the
// server-readable `member_fetches` table at quiz time.
//
// Parent bug-08: `QuizCandidateFetch` fetched each member's full
// per-member Foursquare venue union, picked the three Q5 factorial
// cards from it, and then discarded the union as a local variable.
// Nothing ever wrote the server-side `options` table, so the verdict
// engine had no candidate pool and every room's `compute-verdict`
// returned `no_candidates` (404).
//
// The bug-08 fork (2026-05-18) put the union server-side: the iOS
// quiz persists each member's RAW fetch here, and the `compute-verdict`
// Edge Function unions every member's persisted fetch into `options`
// at verdict fire time. iOS never writes `options` — the server is the
// single owner of the union.
//
// The write is a single upsert keyed on (room_id, user_id): re-running
// the quiz must REPLACE the stale fetch so the server-side union
// reflects the member's latest fetch rather than a stacked duplicate.
// This differs from `votes` (write-once — a re-answer pollutes regret
// math); a re-fetch is simply newer data.
//
// The closure indirection mirrors `QuizVoteWriter` — unit tests drive
// the coordinator with an in-memory recording writer, with no Supabase
// imports needed in the test target.

import Foundation
import Supabase

/// The wire shape for a `member_fetches` row. `payload` is the full
/// raw fetched venue union — every `ShapedPlace` the executor's N+1
/// calls returned, NOT just the three Q5 factorial cards.
///
/// `ShapedPlace` already encodes with the snake_case `CodingKeys` that
/// match the Edge `ShapedPlace` interface (`fsq_place_id`, `name`,
/// `price_tier`, `dietary_tags`, `categories`, …), so the persisted
/// `payload` array is a venue list the `compute-verdict` Edge Function
/// can union straight into `options` — its `RoomOptionRow.payload`
/// reads exactly that slice.
public struct MemberFetchRow: Encodable, Equatable, Sendable {
    public let roomID: UUID
    public let userID: UUID
    public let payload: [ShapedPlace]

    public init(roomID: UUID, userID: UUID, payload: [ShapedPlace]) {
        self.roomID = roomID
        self.userID = userID
        self.payload = payload
    }

    private enum CodingKeys: String, CodingKey {
        case roomID = "room_id"
        case userID = "user_id"
        case payload
    }
}

/// Reusable shape for the network write. Indirected through a closure
/// so unit tests can drive the `QuizCoordinator` without a live
/// Supabase client. `@Sendable` so it can cross actor boundaries
/// inside the coordinator's fetch task.
public typealias MemberFetchWriter = @Sendable (MemberFetchRow) async throws -> Void

@MainActor
public enum MemberFetchSupabaseWriter {
    /// Build a `MemberFetchWriter` closure that upserts the row through
    /// the supplied client.
    ///
    /// The write is an UPSERT on the `member_fetches` (room_id,
    /// user_id) primary key: a member who re-runs the quiz overwrites
    /// their prior raw fetch rather than hitting a unique-constraint
    /// reject. The verdict-time union must reflect the member's latest
    /// fetch — a re-fetch is newer data, not a pollution risk.
    public static func make(client: SupabaseClient) -> MemberFetchWriter {
        return { row in
            try await client
                .from("member_fetches")
                .upsert(row, onConflict: "room_id,user_id")
                .execute()
        }
    }
}
