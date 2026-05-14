// GetToIt — LateJoinerStore (TB-11).
//
// Late-joiner deep-link router + read-only verdict reader. Wraps the
// two TB-11 RPCs added in
// `supabase/migrations/20260514000500000_join_room_smart.sql`:
//
//   * `join_room_smart(p_room_id)` — atomic check of `rooms.status` +
//     membership insert (open / firing branch). Returns a routing
//     JSON the iOS RootView reads to decide whether to push the
//     quiz path, the existing-member path, or the read-only S05
//     surface.
//
//   * `fetch_read_only_verdict(p_room_id)` — SECURITY DEFINER reader
//     that assembles the verdict + cuts + receipts + member-count
//     payload for the read-only S05 render. The late-joiner is NOT
//     a member of the closed room, so the base table RLS would
//     hide everything — the RPC bypasses that.
//
// Why two RPCs and not one fat call:
//   * The open / firing branch is hot — the iOS quiz path follows.
//     Keeping `join_room_smart` cheap (one read + one optional
//     insert) avoids paying for the verdict assembly when the room
//     hasn't fired.
//   * The read-only payload is much larger and only needed in the
//     read-only branch.
//
// What this store does NOT do:
//   * Decide UI. The route enum is data; the RootView surfaces it.
//   * Cache. Each tap re-fetches because invite links are share-
//     sheet artifacts — the user has already committed to the round
//     trip by tapping.
//   * Handle the re-invite CTA's room create — that runs through
//     the standard `RoomStore.createRoom` with the timer + radius
//     defaults pulled from the prior room's payload.

import Foundation
import Supabase

@MainActor
public final class LateJoinerStore {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - routing

    /// The route the late-joiner's deep-link tap resolves to.
    public enum Route: Equatable, Sendable {
        /// The room is still open / firing — `members` row was
        /// inserted and the client should route to the quiz path.
        case joinedToOpenRoom(role: String)
        /// The caller is already a member (cold-restart re-tap). The
        /// client routes the same way it would on app launch — to
        /// whatever surface the room status dictates. No insert.
        case alreadyMember(role: String)
        /// The verdict was sealed before the tap. Render S05 in
        /// read-only mode. Late-joiner is NOT added to members.
        case readOnly(roomStatus: String, timerMinutes: Int, radiusMeters: Int)
    }

    /// Errors surfaced by the routing RPC.
    public enum RouteError: Error, Equatable, Sendable {
        case unauthenticated
        case roomNotFound
        case noVerdict
        case unknown(String)
    }

    /// Resolve the route for a tapped invite link. Calls the
    /// `join_room_smart` RPC and decodes the response.
    public func resolveRoute(roomID: UUID) async throws -> Route {
        let payload = RoomIDPayload(p_room_id: roomID.uuidString.lowercased())

        // The RPC returns JSON. `supabase-swift` gives us a raw `Data`
        // response we hand to the static parser so the integration
        // test and unit test share the same code path.
        let data: Data = try await client
            .rpc("join_room_smart", params: payload)
            .execute()
            .data

        guard let json = String(data: data, encoding: .utf8) else {
            throw RouteError.unknown("non_utf8_response")
        }
        return try LateJoinerStore.parseRoute(jsonString: json)
    }

    /// Read the read-only verdict payload for the S05 render. Calls
    /// the `fetch_read_only_verdict` RPC.
    public func fetchReadOnlyPayload(roomID: UUID) async throws -> ReadOnlyPayload {
        let payload = RoomIDPayload(p_room_id: roomID.uuidString.lowercased())
        let data: Data = try await client
            .rpc("fetch_read_only_verdict", params: payload)
            .execute()
            .data

        guard let json = String(data: data, encoding: .utf8) else {
            throw RouteError.unknown("non_utf8_response")
        }
        return try LateJoinerStore.parseReadOnlyPayload(jsonString: json)
    }

    // MARK: - pure parsing (test-readable)

    /// Decode a `join_room_smart` JSON response into a `Route`. Pure
    /// so the unit tests can exercise the decision tree without a
    /// Supabase round-trip.
    public static func parseRoute(jsonString: String) throws -> Route {
        let response = try decode(jsonString)

        if let error = response.error {
            throw mapRouteError(error)
        }

        switch response.status {
        case "joined":
            guard let role = response.role else {
                throw RouteError.unknown("joined_missing_role")
            }
            return .joinedToOpenRoom(role: role)

        case "already_member":
            guard let role = response.role else {
                throw RouteError.unknown("already_member_missing_role")
            }
            return .alreadyMember(role: role)

        case "read_only":
            guard let roomStatus = response.room_status,
                  let timer = response.timer_minutes,
                  let radius = response.radius_meters else {
                throw RouteError.unknown("read_only_missing_payload")
            }
            return .readOnly(
                roomStatus: roomStatus,
                timerMinutes: timer,
                radiusMeters: radius
            )

        default:
            throw RouteError.unknown(response.status ?? "missing_status")
        }
    }

    /// Decode a `fetch_read_only_verdict` JSON response into a
    /// rendering payload. Pure so the unit tests can exercise the
    /// receipts-exclude-late-joiner property without a Supabase
    /// round-trip.
    public static func parseReadOnlyPayload(jsonString: String) throws -> ReadOnlyPayload {
        guard let data = jsonString.data(using: .utf8) else {
            throw RouteError.unknown("non_utf8_payload")
        }

        // Error envelope first.
        let probe = try? JSONDecoder().decode(ErrorEnvelope.self, from: data)
        if let err = probe?.error {
            throw mapRouteError(err)
        }

        let raw = try JSONDecoder().decode(ReadOnlyRawPayload.self, from: data)

        let placeName: String
        let metaLine: String
        if let option = raw.verdict.option {
            placeName = option.payload.name ?? "Unnamed"
            metaLine = ReadOnlyPayload.metaLine(for: option.payload)
        } else {
            // No-survivor terminal — late-joiner still sees the
            // sealed "NO SPOT / FITS" hero; meta line is empty (the
            // engine's rule_text carries the message).
            placeName = "No spot fits"
            metaLine = ""
        }

        let receipts: [VerdictScreen.Receipt] = raw.receipts.map { row in
            VerdictScreen.Receipt(
                name: ReadOnlyPayload.shortName(forUserID: row.user_id),
                action: ReadOnlyPayload.action(for: row)
            )
        }

        let cuts: [VerdictScreen.Cut] = raw.cuts.map { cut in
            VerdictScreen.Cut(
                name: cut.option_name ?? "—",
                reason: cut.cut_text
            )
        }

        let verdict = VerdictScreen.Verdict(
            placeName: placeName,
            metaLine: metaLine,
            timeBadge: VerdictScreen.TimeBadge(
                time: "7:00 PM", // placeholder — same as VerdictStore
                audience: ReadOnlyPayload.audience(forMemberCount: raw.member_count)
            ),
            ruleText: raw.verdict.rule_text,
            receipts: receipts,
            cuts: cuts
        )

        return ReadOnlyPayload(
            verdict: verdict,
            mode: .readOnly,
            timerMinutes: raw.room.timer_minutes,
            radiusMeters: raw.room.radius_meters,
            roomStatus: raw.room.status
        )
    }

    // MARK: - re-invite pre-fill helpers (pure)

    /// Convert a stored `radius_meters` back to the S01 slider's
    /// miles register, clamped to the S01 legal range `0.5..5.0`.
    /// Late-joiners coming off a widened no-survivor run could carry
    /// a 9.5 mi radius — the re-invite CTA still has to land on the
    /// S01 slider's valid range.
    public static func radiusMilesForMeters(_ meters: Int) -> Double {
        let miles = Double(meters) / 1609.344
        return min(max(miles, 0.5), 5.0)
    }

    /// Snap a `timer_minutes` to the S01 chip set `{5, 10, 15, 30}`.
    /// Uses nearest-legal-value to handle a future column relax.
    public static func timerMinutesClampedToS01(_ minutes: Int) -> Int {
        let legal = [5, 10, 15, 30]
        // Pick the value with the smallest absolute distance, biased
        // to the lower option on a tie (matches the visual default
        // chip-row reading left-to-right).
        var best = legal[0]
        var bestDistance = abs(minutes - legal[0])
        for option in legal.dropFirst() {
            let distance = abs(minutes - option)
            if distance < bestDistance {
                best = option
                bestDistance = distance
            }
        }
        return best
    }

    // MARK: - read-only payload value type

    public struct ReadOnlyPayload: Equatable, Sendable {
        public let verdict: VerdictScreen.Verdict
        public let mode: VerdictScreen.Mode
        public let timerMinutes: Int
        public let radiusMeters: Int
        public let roomStatus: String

        public init(
            verdict: VerdictScreen.Verdict,
            mode: VerdictScreen.Mode,
            timerMinutes: Int,
            radiusMeters: Int,
            roomStatus: String
        ) {
            self.verdict = verdict
            self.mode = mode
            self.timerMinutes = timerMinutes
            self.radiusMeters = radiusMeters
            self.roomStatus = roomStatus
        }

        // MARK: pure shaping helpers (mirrors VerdictStore)

        /// `"All N of you"` audience copy — same shape as
        /// `VerdictStore.audienceCopy(forMemberCount:)`.
        public static func audience(forMemberCount n: Int) -> String {
            let word = numberWord(n)
            return "All \(word) of you"
        }

        /// `"Mexican · $$ · 8 min walk"` — same shape as
        /// `VerdictStore.metaLine(for:)`.
        public static func metaLine(for payload: OptionPayload) -> String {
            var parts: [String] = []
            if let categories = payload.categories, let first = categories.first {
                parts.append(first)
            }
            if let tier = payload.price_tier {
                parts.append(String(repeating: "$", count: max(1, min(4, tier))))
            }
            if let walk = payload.walk_minutes_estimate {
                parts.append("\(walk) min walk")
            }
            return parts.joined(separator: " · ")
        }

        /// Map vote row → receipt action — same priority order as
        /// `VerdictStore.action(for:)`.
        public static func action(for vote: ReceiptRow) -> String {
            if vote.q4_vibe >= 3 { return "wanted lively" }
            if vote.q4_vibe <= 0 { return "wanted hushed" }
            if let chip = vote.q1_vetoes.first(where: { !$0.isEmpty && $0 != "nothing_tonight" }) {
                return "filtered \(chip)"
            }
            if vote.q2_budget < 4 {
                let dollar = String(repeating: "$", count: vote.q2_budget)
                return "capped at \(dollar)"
            }
            if vote.q3_walk_minutes < 30 {
                return "capped at \(vote.q3_walk_minutes) min walk"
            }
            return "voted in"
        }

        /// Anonymous short-name shape — same as VerdictStore.
        public static func shortName(forUserID userIDString: String) -> String {
            let prefix = userIDString.prefix(4).lowercased()
            return "m\(prefix)"
        }

        private static func numberWord(_ n: Int) -> String {
            switch n {
            case 1: return "one"
            case 2: return "two"
            case 3: return "three"
            case 4: return "four"
            case 5: return "five"
            case 6: return "six"
            case 7: return "seven"
            case 8: return "eight"
            default: return "\(n)"
            }
        }
    }

    // MARK: - JSON shape (RPC return + internal raw decode)

    private static func decode(_ jsonString: String) throws -> RouteResponse {
        guard let data = jsonString.data(using: .utf8) else {
            throw RouteError.unknown("non_utf8_payload")
        }
        return try JSONDecoder().decode(RouteResponse.self, from: data)
    }

    private static func mapRouteError(_ err: String) -> RouteError {
        switch err {
        case "unauthenticated":  return .unauthenticated
        case "room_not_found":   return .roomNotFound
        case "no_verdict":       return .noVerdict
        default:                  return .unknown(err)
        }
    }

    private struct RoomIDPayload: Encodable {
        let p_room_id: String
    }

    private struct RouteResponse: Decodable {
        let status: String?
        let role: String?
        let room_status: String?
        let timer_minutes: Int?
        let radius_meters: Int?
        let error: String?
    }

    private struct ErrorEnvelope: Decodable {
        let error: String?
    }

    private struct ReadOnlyRawPayload: Decodable {
        let verdict: VerdictBody
        let cuts: [CutRow]
        let receipts: [ReceiptRow]
        let member_count: Int
        let room: RoomFooter

        struct VerdictBody: Decodable {
            let id: String
            let method: String
            let rule_text: String
            let computed_at: String
            let option: OptionRow?
        }
        struct OptionRow: Decodable {
            let id: String
            let payload: OptionPayload
        }
        struct CutRow: Decodable {
            let option_id: String
            let option_name: String?
            let cut_reason: String
            let cut_text: String
        }
        struct RoomFooter: Decodable {
            let timer_minutes: Int
            let radius_meters: Int
            let status: String
        }
    }

    /// Vote-row shape on the read-only payload. Public so the
    /// pure `ReadOnlyPayload.action(for:)` shaping helper can read
    /// the fields.
    public struct ReceiptRow: Decodable, Equatable, Sendable {
        public let user_id: String
        public let q1_vetoes: [String]
        public let q2_budget: Int
        public let q3_walk_minutes: Int
        public let q4_vibe: Int

        public init(
            user_id: String,
            q1_vetoes: [String],
            q2_budget: Int,
            q3_walk_minutes: Int,
            q4_vibe: Int
        ) {
            self.user_id = user_id
            self.q1_vetoes = q1_vetoes
            self.q2_budget = q2_budget
            self.q3_walk_minutes = q3_walk_minutes
            self.q4_vibe = q4_vibe
        }
    }

    /// Option payload shape (subset). Public so the pure shaping
    /// helper can read the meta-line fields.
    public struct OptionPayload: Decodable, Equatable, Sendable {
        public let name: String?
        public let price_tier: Int?
        public let walk_minutes_estimate: Int?
        public let categories: [String]?

        public init(
            name: String? = nil,
            price_tier: Int? = nil,
            walk_minutes_estimate: Int? = nil,
            categories: [String]? = nil
        ) {
            self.name = name
            self.price_tier = price_tier
            self.walk_minutes_estimate = walk_minutes_estimate
            self.categories = categories
        }
    }
}
