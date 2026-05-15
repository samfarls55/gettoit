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
    /// `timerMinutes` and `radiusMeters` are the S01 initiator controls
    /// (TB-03). Both parameters are optional — `nil` leaves them off
    /// the wire payload entirely so the column defaults
    /// (`timer_minutes=10`, `radius_meters=3219`) take effect. That
    /// keeps the zero-tap path identical to the TB-02 behavior and is
    /// what `surfaces/01-initiator.md` calls the "sensible default"
    /// contract.
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
    public func createRoom(
        as userID: UUID,
        timerMinutes: Int? = nil,
        radiusMeters: Int? = nil,
        location: RoomLocation? = nil
    ) async throws -> Room {
        let roomID = UUID()
        let insert = RoomInsert(
            id: roomID,
            creatorUserID: userID,
            status: "open",
            vertical: "food",
            timerMinutes: timerMinutes,
            radiusMeters: radiusMeters,
            location: location
        )
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
        // server-side defaults (`status`, `vertical`, `created_at`,
        // and — when the caller passed `nil` — `timer_minutes` and
        // `radius_meters`).
        if let room = try await fetchRoom(id: roomID) {
            return room
        }

        // Server didn't echo the row back — extremely unlikely, but
        // construct a best-effort representation so callers don't fail
        // silently. The id and creator are authoritative; for the
        // S01 controls we fall back to the canonical defaults.
        return Room(
            id: roomID,
            creatorUserID: userID,
            status: "open",
            vertical: "food",
            timerMinutes: timerMinutes ?? RoomStore.defaultTimerMinutes,
            radiusMeters: radiusMeters ?? RoomStore.defaultRadiusMeters,
            location: location,
            createdAt: ""
        )
    }

    /// TB-03 (v1.1) — value type for the rooms.location_* columns.
    /// Carried through `createRoom` and decoded back on the returned
    /// `Room`. `source` records whether the coordinate came from
    /// CLLocationManager (`gps`) or the user's typeahead-committed
    /// pick (`manual`); either path produces an identical downstream
    /// payload to PlacesProxy / MapKit, but the source attribution is
    /// useful for debugging the zero-Foursquare-calls failure mode
    /// owned by bug-03.
    public struct RoomLocation: Codable, Equatable, Sendable {
        public enum Source: String, Codable, Sendable {
            case gps
            case manual
        }
        public let name: String
        public let lat: Double
        public let lng: Double
        public let source: Source

        public init(name: String, lat: Double, lng: Double, source: Source) {
            self.name = name
            self.lat = lat
            self.lng = lng
            self.source = source
        }
    }

    /// Canonical S01 defaults. Source of truth is the column default in
    /// `supabase/migrations/20260513212500000_rooms_timer_radius.sql`;
    /// these constants mirror it for the unlikely "server didn't echo
    /// the row" fallback path.
    public static let defaultTimerMinutes: Int = 10
    public static let defaultRadiusMeters: Int = 3219

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

    /// Read a room by id. Returns an empty array when RLS hides the
    /// row from the caller (i.e. the caller isn't a member) — the test
    /// target uses this shape to assert RLS rejects non-members.
    ///
    /// We use `limit(1)` and decode into `[Room]` rather than `.single()`
    /// so the "no rows" RLS-deny case decodes cleanly to an empty array
    /// instead of throwing — `.single()` raises on zero or many rows
    /// and the error shape is harder to distinguish from JSON decode
    /// failures or transport errors.
    public func fetchRoom(id roomID: UUID) async throws -> Room? {
        let rows: [Room] = try await client
            .from("rooms")
            .select()
            .eq("id", value: roomID.uuidString.lowercased())
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    /// Look up the given user's role in a given room. Returns nil when
    /// no row exists for the user (either not a member, or RLS hid it).
    public func fetchRole(roomID: UUID, userID: UUID) async throws -> String? {
        let rows: [MemberRoleRow] = try await client
            .from("members")
            .select("role")
            .eq("room_id", value: roomID.uuidString.lowercased())
            .eq("user_id", value: userID.uuidString.lowercased())
            .limit(1)
            .execute()
            .value
        return rows.first?.role
    }

    // MARK: - wire types

    public struct Room: Codable, Equatable, Sendable {
        public let id: UUID
        public let creatorUserID: UUID
        public let status: String
        public let vertical: String
        /// Initiator-set verdict-fire timer in minutes (S01 chip
        /// group, TB-03). Column default `10`; legal set
        /// `{5, 10, 15, 30}`.
        public let timerMinutes: Int
        /// Initiator-set candidate-pool radius in meters (S01 slider,
        /// TB-03). Column default `3219` (≈ 2.0 mi). Stored in meters
        /// because the PlacesProxy (TB-05) speaks meters to Foursquare.
        public let radiusMeters: Int
        /// TB-03 (v1.1) — initiator-selected location. NULL on rows
        /// inserted by clients that don't yet wire the LocationPicker
        /// (debug RPCs etc); the iOS S01 surface always supplies it.
        public let location: RoomLocation?
        // Keep `created_at` as a string for now. The Postgres timestamp
        // shape (with microseconds and a timezone offset) doesn't decode
        // cleanly via the default supabase-swift JSON decoder, and v1's
        // iOS surfaces never render this value — server-side cron + the
        // realtime broadcast carry the timing semantics.
        public let createdAt: String

        public init(
            id: UUID,
            creatorUserID: UUID,
            status: String,
            vertical: String,
            timerMinutes: Int,
            radiusMeters: Int,
            location: RoomLocation?,
            createdAt: String
        ) {
            self.id = id
            self.creatorUserID = creatorUserID
            self.status = status
            self.vertical = vertical
            self.timerMinutes = timerMinutes
            self.radiusMeters = radiusMeters
            self.location = location
            self.createdAt = createdAt
        }

        enum CodingKeys: String, CodingKey {
            case id
            case creatorUserID = "creator_user_id"
            case status
            case vertical
            case timerMinutes = "timer_minutes"
            case radiusMeters = "radius_meters"
            case locationName = "location_name"
            case locationLat = "location_lat"
            case locationLng = "location_lng"
            case locationSource = "location_source"
            case createdAt = "created_at"
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.id = try c.decode(UUID.self, forKey: .id)
            self.creatorUserID = try c.decode(UUID.self, forKey: .creatorUserID)
            self.status = try c.decode(String.self, forKey: .status)
            self.vertical = try c.decode(String.self, forKey: .vertical)
            self.timerMinutes = try c.decode(Int.self, forKey: .timerMinutes)
            self.radiusMeters = try c.decode(Int.self, forKey: .radiusMeters)
            self.createdAt = (try? c.decode(String.self, forKey: .createdAt)) ?? ""
            let name = try c.decodeIfPresent(String.self, forKey: .locationName)
            let lat = try c.decodeIfPresent(Double.self, forKey: .locationLat)
            let lng = try c.decodeIfPresent(Double.self, forKey: .locationLng)
            let sourceRaw = try c.decodeIfPresent(String.self, forKey: .locationSource)
            if let name, let lat, let lng,
               let sourceRaw, let source = RoomLocation.Source(rawValue: sourceRaw) {
                self.location = RoomLocation(name: name, lat: lat, lng: lng, source: source)
            } else {
                self.location = nil
            }
        }

        public func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(id, forKey: .id)
            try c.encode(creatorUserID, forKey: .creatorUserID)
            try c.encode(status, forKey: .status)
            try c.encode(vertical, forKey: .vertical)
            try c.encode(timerMinutes, forKey: .timerMinutes)
            try c.encode(radiusMeters, forKey: .radiusMeters)
            try c.encode(createdAt, forKey: .createdAt)
            try c.encodeIfPresent(location?.name, forKey: .locationName)
            try c.encodeIfPresent(location?.lat, forKey: .locationLat)
            try c.encodeIfPresent(location?.lng, forKey: .locationLng)
            try c.encodeIfPresent(location?.source.rawValue, forKey: .locationSource)
        }
    }

    /// Encoded payload for the `rooms` insert. `timerMinutes` and
    /// `radiusMeters` are `Optional<Int>` and skipped from the JSON
    /// when `nil` so the column defaults take effect — the
    /// `Encodable` impl below honors that.
    private struct RoomInsert: Encodable {
        let id: UUID
        let creatorUserID: UUID
        let status: String
        let vertical: String
        let timerMinutes: Int?
        let radiusMeters: Int?
        let location: RoomLocation?

        enum CodingKeys: String, CodingKey {
            case id
            case creatorUserID = "creator_user_id"
            case status
            case vertical
            case timerMinutes = "timer_minutes"
            case radiusMeters = "radius_meters"
            case locationName = "location_name"
            case locationLat = "location_lat"
            case locationLng = "location_lng"
            case locationSource = "location_source"
        }

        func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: CodingKeys.self)
            try container.encode(id, forKey: .id)
            try container.encode(creatorUserID, forKey: .creatorUserID)
            try container.encode(status, forKey: .status)
            try container.encode(vertical, forKey: .vertical)
            // `encodeIfPresent` omits the key entirely when nil — that
            // way the server-side column default fires for the
            // zero-tap path. Encoding `null` explicitly would override
            // the default with NULL and fail the `NOT NULL` constraint.
            try container.encodeIfPresent(timerMinutes, forKey: .timerMinutes)
            try container.encodeIfPresent(radiusMeters, forKey: .radiusMeters)
            // TB-03 (v1.1) — location columns are nullable so the
            // happy-path "no location yet" insert (debug RPCs etc) still
            // works. iOS S01 always supplies a RoomLocation via the
            // C-23 LocationPicker gate.
            try container.encodeIfPresent(location?.name, forKey: .locationName)
            try container.encodeIfPresent(location?.lat, forKey: .locationLat)
            try container.encodeIfPresent(location?.lng, forKey: .locationLng)
            try container.encodeIfPresent(location?.source.rawValue, forKey: .locationSource)
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
