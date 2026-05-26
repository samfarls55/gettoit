// GetToIt — VerdictStore (TB-06 + TB-09 + bug-34).
//
// Reads the `verdicts` + `option_cuts` rows for a room and shapes them
// into a `(VerdictScreen.Verdict, VerdictStore.Mode)` pair the
// `VerdictRerollHost` dispatcher uses to pick the right surface. iOS
// NEVER recomputes the verdict — that's the engine's job. This store
// is read-only over PostgREST + supabase-swift.
//
// bug-34 / ADR 0018: VerdictStore now owns the `Mode` enum (the prior
// `VerdictScreen.Mode` was retired when the 5-mode unified struct was
// split into three surfaces). `Mode` is the room-state signal — the
// dispatcher (`VerdictRerollHost.Surface.from(verdictView:)`)
// translates it into the matching surface.
//
// TB-09 additions:
//   * `fetchVerdict` returns `(verdict, mode)` so the caller knows
//     when to switch to the `noSurvivor` mode.
//   * `widenRadius(roomID:meters:)` re-invokes `compute-verdict` with
//     the `radius_meters_override` payload field.
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
// N is the member count. bug-28 — in solo (`N == 1`) the audience
// subtitle is omitted entirely (empty string); the communal frame
// doesn't apply to a single voice. For TB-06 we don't yet have a
// stable wall-clock "when" for the meet-up — the JSX prints `7:00 PM`
// as a placeholder. The store surfaces the same placeholder until the
// scheduling work (post-launch candidate) lands.

import Foundation
import Supabase

@MainActor
public final class VerdictStore {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - public surface

    /// Room-state signal for the verdict view. The dispatcher
    /// (`VerdictRerollHost.Surface.from(verdictView:)`) maps these
    /// cases onto the three post-bug-34 surfaces:
    ///
    ///   * `.default` / `.committed` / `.solo` → live `VerdictScreen`
    ///   * `.noSurvivor` → `NoSurvivorScreen`
    ///   * `.readOnly` → `VerdictReadOnlyScreen` (set by
    ///     `LateJoinerStore` for sealed deep-link arrivals, not by this
    ///     store — `VerdictStore` only fetches live + no-survivor).
    public enum Mode: String, Sendable {
        case `default`
        case committed
        case solo
        case readOnly
        case noSurvivor
    }

    /// Bundle of a verdict + its rendering mode + the surface inputs.
    /// Returning the mode lets the caller switch to `.noSurvivor` /
    /// `.readOnly` without re-fetching.
    public struct VerdictView: Equatable, Sendable {
        public let verdict: VerdictScreen.Verdict
        public let mode: Mode
        /// Surviving hard-needs labels for the no-survivor meta line.
        /// Empty for non-no-survivor modes.
        public let survivingHardNeeds: [String]

        public init(
            verdict: VerdictScreen.Verdict,
            mode: Mode,
            survivingHardNeeds: [String] = []
        ) {
            self.verdict = verdict
            self.mode = mode
            self.survivingHardNeeds = survivingHardNeeds
        }
    }

    /// Pull a verdict + its cuts + the matching member receipts for a
    /// room. Returns nil when no verdict exists yet (the engine hasn't
    /// fired). Throws on transport / decode errors.
    public func fetchVerdict(roomID: UUID) async throws -> VerdictView? {
        let verdictRow = try await fetchVerdictRow(roomID: roomID)
        guard let verdict = verdictRow else {
            return nil
        }

        // TB-09 — no_survivor terminals carry no winning option and no
        // cuts. Build a placeholder `Verdict` whose hero stacks to
        // "NO SPOT / FITS" and whose meta line carries the surviving
        // hard-needs surfaced by the engine.
        if verdict.method == "no_survivor" {
            async let votesTask = fetchVotes(roomID: roomID)
            let voteRows = try await votesTask
            let survivingHardNeeds = VerdictStore.survivingHardNeeds(forVotes: voteRows)
            let metaLine = survivingHardNeeds.joined(separator: " · ")
            return VerdictView(
                verdict: VerdictScreen.Verdict(
                    placeName: "No spot fits",
                    metaLine: metaLine,
                    timeBadge: VerdictScreen.TimeBadge(time: "", audience: ""),
                    ruleText: verdict.ruleText,
                    receipts: [],
                    cuts: []
                ),
                mode: .noSurvivor,
                survivingHardNeeds: survivingHardNeeds
            )
        }

        guard let optionID = verdict.optionID else {
            // A manual verdict with no option_id is malformed — the
            // engine never writes this; surface nil rather than crash.
            return nil
        }

        async let optionsTask = fetchOption(id: optionID)
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

        return VerdictView(
            verdict: VerdictScreen.Verdict(
                placeName: option.payload.name ?? "Unnamed",
                metaLine: meta,
                timeBadge: VerdictScreen.TimeBadge(
                    time: "7:00 PM",  // placeholder — scheduling lands later
                    audience: VerdictStore.audienceCopy(forMemberCount: memberCount)
                ),
                ruleText: verdict.ruleText,
                receipts: receipts,
                cuts: cuts
            ),
            mode: .default
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

    /// Re-fire the VerdictEngine for a room at a wider radius.
    /// Called from the S05 no-survivor "Widen radius" CTA. The
    /// handler drops the prior `no_survivor` verdict + cuts and
    /// re-runs the engine against the new radius. Successful prior
    /// verdicts are NOT replaced.
    public func widenRadius(roomID: UUID, meters: Int) async throws {
        struct Body: Encodable {
            let room_id: UUID
            let radius_meters_override: Int
        }
        try await client.functions.invoke(
            "compute-verdict",
            options: FunctionInvokeOptions(
                method: .post,
                body: Body(room_id: roomID, radius_meters_override: meters)
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
        // TB-04 (quiz redesign) — `votes` stores answers in five generic jsonb
        // slots (`q1`..`q5`). `VoteRow`'s decoder unwraps the
        // `{ meta, answer }` envelopes back to the typed values.
        try await client
            .from("votes")
            .select("user_id, q1, q2, q3, q4, q5")
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
    /// bug-28 — for the solo case (`n == 1`) the audience subtitle is
    /// OMITTED entirely. The communal frame self-cancels with N = 1, and
    /// the earlier `"You"` relabel (TB-13) only restates what the solo
    /// voter already knows. Empty string signals the renderer to drop
    /// the subtitle row; the time badge renders the timestamp alone.
    /// See `design-system/surfaces/05-verdict.md` §"solo" (post-bug-28).
    public static func audienceCopy(forMemberCount n: Int) -> String {
        if n == 1 { return "" }
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

    /// Anonymous users have no display name in the pre-redesign era — surface a short
    /// uuid prefix so receipts have something legible. TB-08 / TB-12
    /// will introduce a real `display_name` source.
    private func displayName(forUserID userID: UUID) -> String {
        let prefix = userID.uuidString.prefix(4).lowercased()
        return "m\(prefix)"
    }

    /// Derive the surviving hard-needs meta-line labels for the no-
    /// survivor surface from the room's votes. Mirrors the engine's
    /// `buildSurvivingHardNeeds` logic so the iOS surface can render
    /// the meta line without a second round-trip to the engine.
    ///
    /// Order: dietary chips → budget cap → walk threshold. Anonymized
    /// labels — "vegan options" not "alex's vegan veto", "$$ cap"
    /// not "alex capped at $$".
    public static func survivingHardNeeds(forVotes votes: [VoteRow]) -> [String] {
        var labels: [String] = []
        // Dietary first — collect unique chips.
        var dietarySeen = Set<String>()
        for vote in votes {
            for chip in vote.q1Vetoes {
                let normalized = chip.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if normalized.isEmpty { continue }
                if normalized == "nothing_tonight" || normalized == "nothing tonight"
                   || normalized == "nothing" || normalized == "none" { continue }
                guard let label = dietaryLabel(forChip: normalized) else { continue }
                if dietarySeen.insert(label).inserted {
                    labels.append(label)
                }
            }
        }
        // Budget cap — MIN tier across members.
        if !votes.isEmpty {
            let minBudget = votes.map(\.q2Budget).min() ?? 4
            if minBudget < 4 {
                labels.append("\(String(repeating: "$", count: max(1, minBudget))) cap")
            }
        }
        // Walk threshold — MIN minutes across members.
        if !votes.isEmpty {
            let minWalk = votes.map(\.q3WalkMinutes).min() ?? 30
            if minWalk < 30 {
                labels.append("\(minWalk) min walk")
            }
        }
        return labels
    }

    /// Q1 dietary chip → short anonymized label. Mirrors the engine's
    /// `DIETARY_REQUIREMENTS.label` table.
    private static func dietaryLabel(forChip chip: String) -> String? {
        switch chip {
        case "vegan":      return "vegan options"
        case "vegetarian": return "vegetarian options"
        case "halal":      return "halal options"
        case "kosher":     return "kosher options"
        case "gluten":     return "gluten-free options"
        case "dairy":      return "dairy-safe options"
        case "shellfish":  return "shellfish-safe options"
        case "nuts":       return "nut-safe options"
        default:           return nil
        }
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
        /// Null when `method == "no_survivor"` — the engine emitted
        /// no winning option for this run.
        public let optionID: UUID?
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

    /// A `votes` row as read for the verdict screen.
    ///
    /// TB-04 (quiz redesign): `votes` stores answers in five generic jsonb
    /// slots (`q1`..`q5`), each a `{ meta, answer }` envelope. The
    /// decoder unwraps the envelopes back to the typed values so the
    /// shaping helpers below stay unchanged. Decode-only — the verdict
    /// screen reads votes, never writes them. The typed `init` is kept
    /// for unit-test fixture construction.
    ///
    /// TB-06 (quiz redesign): Q1 changed from a dietary-veto answer
    /// to a positive cuisine-craving answer (`{cuisines, no_preference}`)
    /// and Q3 from a walk-minutes threshold to a reputation chip
    /// (`{reputation}`). Dietary vetoes moved to the profile and
    /// walk-minutes to the session parameters, so neither is carried by
    /// the session quiz any more. The decoder is tolerant of BOTH the
    /// legacy and the new answer shapes — `q1Vetoes` / `q3WalkMinutes`
    /// stay on the struct (the verdict-screen receipt helpers still
    /// reference them) but resolve to the no-constraint default
    /// (`[]` / `30`) when the slot carries the new quiz-redesign shape. The
    /// dietary/walk receipts simply do not fire from session votes
    /// once dietary/walk have moved buckets — the verdict-engine
    /// rewrite (tb-11) re-sources those receipts.
    public struct VoteRow: Decodable, Sendable {
        public let userID: UUID
        public let q1Vetoes: [String]
        public let q1Cuisines: [String]
        public let q1NoPreference: Bool
        public let q2Budget: Int
        public let q3WalkMinutes: Int
        public let q3Reputation: String?
        public let q4Vibe: Int
        public let q5Regret: [String: Int]

        public init(
            userID: UUID,
            q1Vetoes: [String],
            q2Budget: Int,
            q3WalkMinutes: Int,
            q4Vibe: Int,
            q5Regret: [String: Int],
            q1Cuisines: [String] = [],
            q1NoPreference: Bool = false,
            q3Reputation: String? = nil
        ) {
            self.userID = userID
            self.q1Vetoes = q1Vetoes
            self.q1Cuisines = q1Cuisines
            self.q1NoPreference = q1NoPreference
            self.q2Budget = q2Budget
            self.q3WalkMinutes = q3WalkMinutes
            self.q3Reputation = q3Reputation
            self.q4Vibe = q4Vibe
            self.q5Regret = q5Regret
        }

        private enum RowKey: String, CodingKey {
            case userID = "user_id"
            case q1, q2, q3, q4, q5
        }
        private struct Slot<Answer: Decodable>: Decodable { let answer: Answer }
        /// Tolerant Q1 answer — accepts the legacy dietary-veto shape
        /// (`vetoes` / `vetoes_extra`) AND the quiz-redesign cuisine-craving
        /// shape (`cuisines` / `no_preference`). Every field optional.
        private struct Q1Answer: Decodable {
            let vetoes: [String]?
            let vetoesExtra: [String]?
            let cuisines: [String]?
            let noPreference: Bool?
            enum CodingKeys: String, CodingKey {
                case vetoes
                case vetoesExtra = "vetoes_extra"
                case cuisines
                case noPreference = "no_preference"
            }
        }
        /// Tolerant Q3 answer — accepts the legacy walk-minutes shape
        /// (`minutes`) AND the quiz-redesign reputation shape (`reputation`).
        private struct Q3Answer: Decodable {
            let minutes: Int?
            let reputation: String?
        }
        private struct TierAnswer: Decodable { let tier: Int }
        private struct LevelAnswer: Decodable { let level: Int }
        /// Tolerant Q5 answer. TB-24 moved the Q5 write to the factorial
        /// probe shape (`answer.ratings: [{ droppedAxis, score }]`); the
        /// pre-tb-23 per-venue `answer.scores` map is no longer written.
        /// Both fields are optional so the decoder accepts the new
        /// `ratings` rows (and any surviving legacy `scores` rows)
        /// without throwing. The verdict screen does not read `q5Regret`
        /// — verdict scoring moved server-side in tb-23 — so an absent
        /// `scores` simply resolves to an empty map.
        private struct Q5Answer: Decodable {
            let scores: [String: Int]?
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: RowKey.self)
            userID = try c.decode(UUID.self, forKey: .userID)

            let q1 = try c.decode(Slot<Q1Answer>.self, forKey: .q1).answer
            // Legacy dietary veto: a diet-reason reroll appends to
            // `vetoes_extra`; the engine prunes on the union. New quiz-redesign
            // quiz: no vetoes — dietary moved to the profile.
            q1Vetoes = (q1.vetoes ?? []) + (q1.vetoesExtra ?? [])
            q1Cuisines = q1.cuisines ?? []
            q1NoPreference = q1.noPreference ?? false

            q2Budget = try c.decode(Slot<TierAnswer>.self, forKey: .q2).answer.tier

            let q3 = try c.decode(Slot<Q3Answer>.self, forKey: .q3).answer
            // Absent walk-minutes (quiz-redesign dropped it) defaults to the
            // open ceiling so the walk receipt never fires spuriously.
            q3WalkMinutes = q3.minutes ?? 30
            q3Reputation = q3.reputation

            q4Vibe = try c.decode(Slot<LevelAnswer>.self, forKey: .q4).answer.level
            // TB-24: the Q5 slot now carries the factorial `ratings`
            // probe, not a per-venue `scores` map. `q5Regret` defaults
            // to empty when `scores` is absent — the verdict screen
            // never reads it (server-side scoring, tb-23).
            q5Regret = try c.decode(Slot<Q5Answer>.self, forKey: .q5).answer.scores ?? [:]
        }
    }

    private struct MemberRow: Decodable {
        let userID: UUID

        enum CodingKeys: String, CodingKey {
            case userID = "user_id"
        }
    }
}
