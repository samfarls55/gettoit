// GetToIt — VerdictStore (TB-06).
//
// Reads the `verdicts` + `option_cuts` rows for a room and shapes them
// into a `VerdictScreen.Verdict` value the S05 surface can render.
// iOS NEVER recomputes the verdict — that's the engine's job. This
// store is read-only over PostgREST + supabase-swift.
//
// Out of scope for TB-06:
//   * Realtime subscription on `verdicts` (TB-07's auto-fire path will
//     push a `verdict_ready` broadcast that VerdictStore subscribes to).
//   * Triggering the engine (`compute-verdict` function invocation) —
//     iOS for TB-06 manual testing pokes the function directly via
//     `client.functions.invoke("compute-verdict", ...)`; production
//     fire-paths in TB-07 wire trigger + cron.
//   * RLS-recursion-aware joins on `members` — covered by TB-02's
//     existing policies. The verdict + cuts SELECT policies in the
//     TB-06 migration mirror the same shape.
//
// Time-badge wall clock: the time badge audience copy is
// `"All N of you"` (PRD user story 31 + S05 §"Copy register"), where
// N is the member count. For TB-06 we don't yet have a stable wall-
// clock "when" for the meet-up — the JSX prints `7:00 PM` as a
// placeholder. The store surfaces the same placeholder until the
// scheduling work (post-v1 candidate) lands.

import Foundation
import Supabase

@MainActor
public final class VerdictStore {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - public surface

    /// Pull a verdict + its cuts + the matching member receipts for a
    /// room. Returns nil when no verdict exists yet (the engine hasn't
    /// fired). Throws on transport / decode errors.
    public func fetchVerdict(roomID: UUID) async throws -> VerdictScreen.Verdict? {
        guard let verdict = try await fetchVerdictRow(roomID: roomID) else {
            return nil
        }
        async let optionsTask = fetchOption(id: verdict.optionID)
        async let cutsTask    = fetchCuts(verdictID: verdict.id)
        async let votesTask   = fetchVotes(roomID: roomID)
        async let memberCountTask = fetchMemberCount(roomID: roomID)

        let option       = try await optionsTask
        let cutRows      = try await cutsTask
        let voteRows     = try await votesTask
        let memberCount  = try await memberCountTask

        guard let option else {
            // The verdict references an option that's no longer
            // readable — RLS shouldn't allow this for a room member,
            // and the engine never writes such a verdict. Surface nil
            // rather than render a broken hero.
            return nil
        }

        // Stitch cuts to option names — the engine writes cuts with
        // `option_id`; the drawer needs the human label.
        let cutOptionIDs = cutRows.map(\.optionID)
        let cutOptions = try await fetchOptionsBatch(ids: cutOptionIDs)
        let cutMap = Dictionary(uniqueKeysWithValues: cutOptions.map { ($0.id, $0) })

        let cuts: [VerdictScreen.Cut] = cutRows.compactMap { row in
            let name = cutMap[row.optionID]?.payload.name ?? "—"
            return VerdictScreen.Cut(name: name, reason: row.cutText)
        }

        let receipts: [VerdictScreen.Receipt] = voteRows.map { row in
            VerdictScreen.Receipt(
                name: displayName(forUserID: row.userID),
                action: VerdictStore.action(for: row)
            )
        }

        let meta = VerdictStore.metaLine(for: option.payload)

        return VerdictScreen.Verdict(
            placeName: option.payload.name ?? "Unnamed",
            metaLine: meta,
            timeBadge: VerdictScreen.TimeBadge(
                time: "7:00 PM",  // placeholder — scheduling lands later
                audience: VerdictStore.audienceCopy(forMemberCount: memberCount)
            ),
            ruleText: verdict.ruleText,
            receipts: receipts,
            cuts: cuts
        )
    }

    /// Manually fire the VerdictEngine for a room. Used for TB-06
    /// manual testing; TB-07's trigger + cron supersede this for
    /// production. The function invocation returns the same verdict +
    /// cuts that a later `fetchVerdict(roomID:)` would surface.
    public func computeVerdict(roomID: UUID) async throws {
        struct Body: Encodable {
            let room_id: UUID
        }
        try await client.functions.invoke(
            "compute-verdict",
            options: FunctionInvokeOptions(
                method: .post,
                body: Body(room_id: roomID)
            )
        )
    }

    // MARK: - reads

    private func fetchVerdictRow(roomID: UUID) async throws -> VerdictRow? {
        let rows: [VerdictRow] = try await client
            .from("verdicts")
            .select("id, room_id, option_id, computed_at, method, rule_text")
            .eq("room_id", value: roomID.uuidString.lowercased())
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    private func fetchOption(id optionID: UUID) async throws -> OptionRow? {
        let rows: [OptionRow] = try await client
            .from("options")
            .select("id, payload")
            .eq("id", value: optionID.uuidString.lowercased())
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    private func fetchOptionsBatch(ids: [UUID]) async throws -> [OptionRow] {
        if ids.isEmpty { return [] }
        let idStrings = ids.map { $0.uuidString.lowercased() }
        return try await client
            .from("options")
            .select("id, payload")
            .in("id", values: idStrings)
            .execute()
            .value
    }

    private func fetchCuts(verdictID: UUID) async throws -> [CutRow] {
        try await client
            .from("option_cuts")
            .select("verdict_id, option_id, cut_reason, cut_text")
            .eq("verdict_id", value: verdictID.uuidString.lowercased())
            .execute()
            .value
    }

    private func fetchVotes(roomID: UUID) async throws -> [VoteRow] {
        try await client
            .from("votes")
            .select("user_id, q1_vetoes, q2_budget, q3_walk_minutes, q4_vibe, q5_regret")
            .eq("room_id", value: roomID.uuidString.lowercased())
            .execute()
            .value
    }

    private func fetchMemberCount(roomID: UUID) async throws -> Int {
        let rows: [MemberRow] = try await client
            .from("members")
            .select("user_id")
            .eq("room_id", value: roomID.uuidString.lowercased())
            .execute()
            .value
        return rows.count
    }

    // MARK: - shaping helpers (pure functions for testability)

    /// Build the audience copy on the time badge. PRD user story 31 +
    /// S05 §"Copy register" — `"ALL N OF YOU"` for the communal frame.
    public static func audienceCopy(forMemberCount n: Int) -> String {
        let word = numberWord(n)
        return "All \(word) of you"
    }

    /// Build the meta line under the hero: "Category · $$ · N min walk".
    public static func metaLine(for payload: OptionRow.Payload) -> String {
        var parts: [String] = []
        if let categories = payload.categories, let first = categories.first {
            parts.append(first)
        }
        if let tier = payload.priceTier {
            parts.append(String(repeating: "$", count: max(1, min(4, tier))))
        }
        if let walk = payload.walkMinutesEstimate {
            parts.append("\(walk) min walk")
        }
        return parts.joined(separator: " · ")
    }

    /// Map a member's vote row to a receipt action — same priority
    /// order as the TS engine's `receiptAction` so the surface reads
    /// consistently across server-side preview and client-side render.
    /// Public for unit-testability.
    public static func action(for vote: VoteRow) -> String {
        if vote.q4Vibe >= 3 { return "wanted lively" }
        if vote.q4Vibe <= 0 { return "wanted hushed" }
        if let chip = vote.q1Vetoes.first(where: { !$0.isEmpty && $0 != "nothing_tonight" }) {
            return "filtered \(chip)"
        }
        if vote.q2Budget < 4 {
            let dollar = String(repeating: "$", count: vote.q2Budget)
            return "capped at \(dollar)"
        }
        if vote.q3WalkMinutes < 30 {
            return "capped at \(vote.q3WalkMinutes) min walk"
        }
        return "voted in"
    }

    /// Anonymous users have no display name in v1 — surface a short
    /// uuid prefix so receipts have something legible. TB-08 / TB-12
    /// will introduce a real `display_name` source.
    private func displayName(forUserID userID: UUID) -> String {
        let prefix = userID.uuidString.prefix(4).lowercased()
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

    // MARK: - wire types

    public struct VerdictRow: Codable, Sendable {
        public let id: UUID
        public let roomID: UUID
        public let optionID: UUID
        public let computedAt: String
        public let method: String
        public let ruleText: String

        enum CodingKeys: String, CodingKey {
            case id
            case roomID = "room_id"
            case optionID = "option_id"
            case computedAt = "computed_at"
            case method
            case ruleText = "rule_text"
        }
    }

    public struct CutRow: Codable, Sendable {
        public let verdictID: UUID
        public let optionID: UUID
        public let cutReason: String
        public let cutText: String

        enum CodingKeys: String, CodingKey {
            case verdictID = "verdict_id"
            case optionID = "option_id"
            case cutReason = "cut_reason"
            case cutText = "cut_text"
        }
    }

    public struct OptionRow: Codable, Sendable {
        public let id: UUID
        public let payload: Payload

        public struct Payload: Codable, Sendable {
            public let fsqPlaceId: String?
            public let name: String?
            public let priceTier: Int?
            public let walkMinutesEstimate: Int?
            public let dietaryTags: [String]?
            public let categories: [String]?

            public init(
                fsqPlaceId: String? = nil,
                name: String? = nil,
                priceTier: Int? = nil,
                walkMinutesEstimate: Int? = nil,
                dietaryTags: [String]? = nil,
                categories: [String]? = nil
            ) {
                self.fsqPlaceId = fsqPlaceId
                self.name = name
                self.priceTier = priceTier
                self.walkMinutesEstimate = walkMinutesEstimate
                self.dietaryTags = dietaryTags
                self.categories = categories
            }

            enum CodingKeys: String, CodingKey {
                case fsqPlaceId = "fsq_place_id"
                case name
                case priceTier = "price_tier"
                case walkMinutesEstimate = "walk_minutes_estimate"
                case dietaryTags = "dietary_tags"
                case categories
            }
        }
    }

    public struct VoteRow: Codable, Sendable {
        public let userID: UUID
        public let q1Vetoes: [String]
        public let q2Budget: Int
        public let q3WalkMinutes: Int
        public let q4Vibe: Int
        public let q5Regret: [String: Int]

        public init(
            userID: UUID,
            q1Vetoes: [String],
            q2Budget: Int,
            q3WalkMinutes: Int,
            q4Vibe: Int,
            q5Regret: [String: Int]
        ) {
            self.userID = userID
            self.q1Vetoes = q1Vetoes
            self.q2Budget = q2Budget
            self.q3WalkMinutes = q3WalkMinutes
            self.q4Vibe = q4Vibe
            self.q5Regret = q5Regret
        }

        enum CodingKeys: String, CodingKey {
            case userID = "user_id"
            case q1Vetoes = "q1_vetoes"
            case q2Budget = "q2_budget"
            case q3WalkMinutes = "q3_walk_minutes"
            case q4Vibe = "q4_vibe"
            case q5Regret = "q5_regret"
        }
    }

    private struct MemberRow: Decodable {
        let userID: UUID

        enum CodingKeys: String, CodingKey {
            case userID = "user_id"
        }
    }
}
