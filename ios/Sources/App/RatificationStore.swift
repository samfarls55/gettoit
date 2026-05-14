// GetToIt — RatificationStore (TB-08).
//
// Writes "I'm in" ratifications into the `ratifications` table and
// surfaces the live mutual-state count for the S05 committed-mode
// CTA (`"You're in · N of M"`). Pure observable; the SwiftUI surface
// reads `@Published` properties.
//
// Wiring contract:
//   * `ratify(userID:)` upserts a `ratifications` row for the current
//     verdict. Idempotent on the (verdict_id, user_id) PK — a re-tap
//     in the same session is swallowed as "already in."
//   * `refreshCount()` reads the current ratifications count for the
//     verdict + the member count for the room and republishes
//     `count` / `total`. Called once on appear; the iOS Realtime
//     subscriber (TB-08 follow-up) will push subsequent updates via
//     `apply(event:)`.
//   * `events.commit(_:)` is the test-readable seam — the integration
//     test drives this directly with a synthetic Realtime push.
//
// What this store does NOT do:
//   * Compute the verdict, ratify on behalf of others, or store the
//     correctability window. The window lives on `rooms.verdict_committed_at`
//     and is closed by the trigger / cron in
//     `20260514000010000_rooms_lock_columns.sql`.

import Foundation
import Supabase

@MainActor
public final class RatificationStore: ObservableObject {
    @Published public private(set) var count: Int = 0
    @Published public private(set) var total: Int = 0
    @Published public private(set) var hasRatified: Bool = false

    private let client: SupabaseClient
    private let roomID: UUID
    private let verdictID: UUID

    public init(client: SupabaseClient, roomID: UUID, verdictID: UUID) {
        self.client = client
        self.roomID = roomID
        self.verdictID = verdictID
    }

    /// Idempotent "I'm in" write. Returns the same `count` / `total`
    /// snapshot the store publishes; raises only on transport errors.
    public func ratify(userID: UUID) async throws {
        struct Row: Encodable {
            let verdict_id: String
            let user_id: String
        }
        do {
            try await client
                .from("ratifications")
                .insert(Row(
                    verdict_id: verdictID.uuidString.lowercased(),
                    user_id: userID.uuidString.lowercased()
                ))
                .execute()
        } catch {
            // 23505 unique_violation = already ratified; swallow as
            // "already in." Anything else surfaces.
            let message = "\(error)".lowercased()
            if !(message.contains("23505") || message.contains("unique")) {
                throw error
            }
        }
        self.hasRatified = true
        try await refreshCount(currentUserID: userID)
    }

    /// Pull the current ratification count + member total for the
    /// verdict. The view calls this on appear; subsequent updates
    /// come through `apply(event:)` driven by the Realtime channel.
    public func refreshCount(currentUserID: UUID) async throws {
        struct RatRow: Decodable {
            let user_id: UUID

            enum CodingKeys: String, CodingKey {
                case user_id
            }
        }
        struct MemberRow: Decodable {
            let user_id: UUID

            enum CodingKeys: String, CodingKey {
                case user_id
            }
        }

        async let ratsTask: [RatRow] = client
            .from("ratifications")
            .select("user_id")
            .eq("verdict_id", value: verdictID.uuidString.lowercased())
            .execute()
            .value
        async let membersTask: [MemberRow] = client
            .from("members")
            .select("user_id")
            .eq("room_id", value: roomID.uuidString.lowercased())
            .execute()
            .value

        let rats = try await ratsTask
        let members = try await membersTask

        self.count = rats.count
        self.total = members.count
        self.hasRatified = rats.contains { $0.user_id == currentUserID }
    }

    // MARK: - Realtime apply seam (test-readable)

    /// Synthetic Realtime push for the integration test + future live
    /// subscriber. The TB-08 follow-up wires Supabase Realtime Broadcast
    /// on `room:{roomID}` with event `ratification`; until then this
    /// seam is exercised from the integration test.
    public func apply(event: RatificationEvent) {
        switch event {
        case .ratified(let userID):
            self.count = min(total, count + 1)
            if let id = currentRatifierIDOverride.wrappedValue, id == userID {
                self.hasRatified = true
            }
        case .countSnapshot(let snapshotCount, let snapshotTotal):
            self.count = snapshotCount
            self.total = snapshotTotal
        }
    }

    /// Test-injectable "this is the current user" override so the
    /// store can flag `hasRatified` on a synthetic event. Not used in
    /// production — the writer call sets `hasRatified` directly.
    public var currentRatifierIDOverride: Wrapper<UUID?> = Wrapper(value: nil)

    public final class Wrapper<T>: @unchecked Sendable {
        public var wrappedValue: T
        public init(value: T) { self.wrappedValue = value }
    }

    public enum RatificationEvent: Equatable, Sendable {
        case ratified(userID: UUID)
        case countSnapshot(count: Int, total: Int)
    }
}
