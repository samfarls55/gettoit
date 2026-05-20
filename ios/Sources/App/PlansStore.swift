// GetToIt — PlansStore (tb-WF-1, workflow-overhaul).
//
// The Plan is the workflow-overhaul phase's durable, named, list-
// backed item — it promotes today's ephemeral `rooms` row into a
// Reminders-app-spirit entity. This store is the thin Supabase-swift
// wrapper for the four standard operations + a lifecycle observer:
//
//   * `create(name:scope:locationJSON:sessionParams:distanceMeters:)`
//     — insert a Plan row with `status = 'pending'`.
//   * `fetchMine()` — list the caller's own Plans, ordered
//     `updated_at desc`.
//   * `update(planID:fields:)` — partial update; the call returns the
//     updated row. The store does NOT pre-check `status = 'pending'`
//     — the column-level RLS and the future "decided" lock policy
//     own the contract (tb-WF-1 ships the schema; sg-WF-6 owns the
//     `status != 'pending'` guard).
//   * `delete(planID:)` — destructive. The FK cascade on
//     `rooms.plan_id` is `on delete set null`, so an in-flight Room
//     loses its Plan link rather than disappearing.
//   * `observe(planID:)` — lifecycle-state stream. For tb-WF-1 we
//     ship the polling fallback (foreground re-fetch every 5 s);
//     Realtime subscription is a follow-up once the channel name
//     is decided (sg-WF-4 / future tracer-bullet).
//
// Storage shape (mirrors the migration):
//   plans (
//     id uuid PK,
//     creator_id uuid FK auth.users,
//     name text (1..40),
//     category text default 'food',
//     scope text in ('solo','duo','group'),
//     location jsonb nullable,
//     session_params jsonb not null default '{}',
//     distance_meters int default 1609,
//     status text in ('pending','decided-active','decided-expired'),
//     reroll_window_closes_at timestamptz nullable,
//     created_at timestamptz, updated_at timestamptz
//   )
//
// The Codable wire shape uses snake_case keys to match PostgREST's
// JSON column rendering, same convention RoomStore follows.
//
// References:
//   * gti-vault/15_issues/workflow-overhaul/issues/tb-wf-1-plans-table-schema.md
//   * supabase/migrations/20260519000000000_workflow_overhaul_plans_table.sql

import Foundation
import Supabase

@MainActor
@Observable
public final class PlansStore {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    // MARK: - lifecycle state

    /// The `plans.status` column's enum. The raw values MUST match
    /// the SQL CHECK constraint exactly — a drift will surface as a
    /// rejected UPDATE on the live DB. The migration is the source
    /// of truth; this enum mirrors it.
    public enum LifecycleState: String, Codable, CaseIterable, Sendable {
        case pending
        case decidedActive = "decided-active"
        case decidedExpired = "decided-expired"
    }

    /// The `plans.scope` column's enum. The raw values match today's
    /// S01b group_context chips:
    ///   `Just me`   → `.solo`
    ///   `Two of us` → `.duo`
    ///   `A group`   → `.group`
    public enum Scope: String, Codable, CaseIterable, Sendable {
        case solo
        case duo
        case group
    }

    // MARK: - value types

    /// The shape of `plans.location` (jsonb). Mirrors `RoomLocation`
    /// from `RoomStore` so the Setup screen can read a Plan back and
    /// hydrate the C-23 LocationPicker without a translation step.
    /// `source` is plain `String` rather than a typed enum because the
    /// underlying value space ("gps" / "manual") is owned by
    /// `RoomStore.RoomLocation.Source`; the Plan-side decoder is
    /// tolerant of any string so a future source value (e.g. an
    /// MKMapItem identifier) does not strand the iOS read path.
    public struct Location: Codable, Equatable, Sendable {
        public let name: String
        public let lat: Double
        public let lng: Double
        public let source: String
        public let timeZoneIdentifier: String

        public init(
            name: String,
            lat: Double,
            lng: Double,
            source: String,
            timeZoneIdentifier: String
        ) {
            self.name = name
            self.lat = lat
            self.lng = lng
            self.source = source
            self.timeZoneIdentifier = timeZoneIdentifier
        }
    }

    /// The full row shape. Decodable from a PostgREST select on the
    /// `plans` table. `createdAt` / `updatedAt` / `rerollWindowClosesAt`
    /// are typed as `String?` for the same reason `RoomStore.Room`
    /// uses a `String` for `created_at`: Postgres' timestamptz format
    /// with microseconds + offset does not decode cleanly through the
    /// default `JSONDecoder` `Date` strategy, and the UI never renders
    /// the raw timestamp anyway — the reroll-window countdown is
    /// computed against a parsed window.
    public struct Plan: Codable, Equatable, Sendable, Identifiable {
        public let id: UUID
        public let creatorID: UUID
        public let name: String
        public let category: String
        public let scope: Scope
        public let location: Location?
        public let sessionParameters: SessionParameters?
        public let distanceMeters: Int
        public let status: LifecycleState
        public let rerollWindowClosesAt: String?
        public let createdAt: String?
        public let updatedAt: String?

        public init(
            id: UUID,
            creatorID: UUID,
            name: String,
            category: String,
            scope: Scope,
            location: Location?,
            sessionParameters: SessionParameters?,
            distanceMeters: Int,
            status: LifecycleState,
            rerollWindowClosesAt: String? = nil,
            createdAt: String? = nil,
            updatedAt: String? = nil
        ) {
            self.id = id
            self.creatorID = creatorID
            self.name = name
            self.category = category
            self.scope = scope
            self.location = location
            self.sessionParameters = sessionParameters
            self.distanceMeters = distanceMeters
            self.status = status
            self.rerollWindowClosesAt = rerollWindowClosesAt
            self.createdAt = createdAt
            self.updatedAt = updatedAt
        }

        enum CodingKeys: String, CodingKey {
            case id
            case creatorID = "creator_id"
            case name
            case category
            case scope
            case location
            case sessionParameters = "session_params"
            case distanceMeters = "distance_meters"
            case status
            case rerollWindowClosesAt = "reroll_window_closes_at"
            case createdAt = "created_at"
            case updatedAt = "updated_at"
        }
    }

    /// tb-WF-7 — wire shape for the Joined-section read query
    /// (`joinedPlansForList(userID:)`). The RPC returns a flat row per
    /// Plan: the `plans.*` columns plus two per-joiner projections
    /// (`last_answered_question_index`, `has_voted`). The iOS
    /// Decodable splits the row into a `Plan` body and the two
    /// resume signals so call sites (`PlanListScreen.routeFor`)
    /// reason about the signal explicitly.
    ///
    /// `lastAnsweredQuestionIndex` is 0..5 — 0 means the joiner
    /// hasn't started; 1..4 means they advanced past Q1..Q4; 5 means
    /// they reached Q5. `hasVoted` is the canonical "finished" signal
    /// — the §Q8 router prefers it over `lastAnsweredQuestionIndex`
    /// because the votes row is the ground truth (an index alone can
    /// be stale if a progress write was in flight when the user
    /// backgrounded).
    public struct JoinedPlanRow: Codable, Equatable, Sendable, Identifiable {
        public let plan: Plan
        public let lastAnsweredQuestionIndex: Int
        public let hasVoted: Bool

        public var id: UUID { plan.id }

        public init(
            plan: Plan,
            lastAnsweredQuestionIndex: Int,
            hasVoted: Bool
        ) {
            self.plan = plan
            self.lastAnsweredQuestionIndex = lastAnsweredQuestionIndex
            self.hasVoted = hasVoted
        }

        enum CodingKeys: String, CodingKey {
            case lastAnsweredQuestionIndex = "last_answered_question_index"
            case hasVoted = "has_voted"
        }

        public init(from decoder: Decoder) throws {
            // The RPC returns a single flat row per Plan — the
            // `plans.*` columns are siblings of the two per-joiner
            // projections. Decode each Plan field via the Plan
            // Decodable + decode the two projections at this level.
            self.plan = try Plan(from: decoder)
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.lastAnsweredQuestionIndex =
                try c.decodeIfPresent(Int.self, forKey: .lastAnsweredQuestionIndex) ?? 0
            self.hasVoted = try c.decodeIfPresent(Bool.self, forKey: .hasVoted) ?? false
        }

        public func encode(to encoder: Encoder) throws {
            // Round-trip via the Plan encoder + two sibling fields.
            // Mostly here to satisfy `Codable`; the wire direction is
            // server -> client.
            try plan.encode(to: encoder)
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(lastAnsweredQuestionIndex,
                         forKey: .lastAnsweredQuestionIndex)
            try c.encode(hasVoted, forKey: .hasVoted)
        }
    }

    // MARK: - encoded payloads

    /// Encoded payload for the `plans` INSERT. Skips server-owned
    /// fields entirely (`id`, `status`, `reroll_window_closes_at`,
    /// `created_at`, `updated_at`) so column defaults + triggers
    /// fire. The `location` key is omitted (not encoded as `null`)
    /// when the caller passes `nil` so the column default (NULL)
    /// takes effect cleanly.
    public struct CreateInsert: Encodable, Sendable {
        public let creatorID: UUID
        public let name: String
        public let scope: Scope
        public let location: Location?
        public let sessionParameters: SessionParameters
        public let distanceMeters: Int

        public init(
            creatorID: UUID,
            name: String,
            scope: Scope,
            location: Location?,
            sessionParameters: SessionParameters,
            distanceMeters: Int
        ) {
            self.creatorID = creatorID
            self.name = name
            self.scope = scope
            self.location = location
            self.sessionParameters = sessionParameters
            self.distanceMeters = distanceMeters
        }

        enum CodingKeys: String, CodingKey {
            case creatorID = "creator_id"
            case name
            case scope
            case location
            case sessionParameters = "session_params"
            case distanceMeters = "distance_meters"
        }

        public func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encode(creatorID, forKey: .creatorID)
            try c.encode(name, forKey: .name)
            try c.encode(scope, forKey: .scope)
            // Omit the key entirely when nil — that way the
            // column default (NULL) takes effect cleanly. Encoding
            // `null` explicitly would also work for INSERT but
            // matters for the future UPDATE path: an explicit null
            // wipes a previously-set value; an omitted key leaves
            // the column untouched.
            try c.encodeIfPresent(location, forKey: .location)
            try c.encode(sessionParameters, forKey: .sessionParameters)
            try c.encode(distanceMeters, forKey: .distanceMeters)
        }
    }

    /// Partial-update payload for the `plans` UPDATE. Each field is
    /// optional — only the fields the caller supplies land in the
    /// JSON. An unset field is omitted entirely so the corresponding
    /// column stays at its current value. The `status` /
    /// `reroll_window_closes_at` columns are NOT in this payload —
    /// the lifecycle transitions are server-owned (set by
    /// `set_plan_decided_active` / sg-WF-6's cron), and a stray
    /// client-side status write would race the server.
    public struct PlanUpdate: Encodable, Sendable {
        public let name: String?
        public let scope: Scope?
        public let location: Location?
        public let sessionParameters: SessionParameters?
        public let distanceMeters: Int?

        public init(
            name: String? = nil,
            scope: Scope? = nil,
            location: Location? = nil,
            sessionParameters: SessionParameters? = nil,
            distanceMeters: Int? = nil
        ) {
            self.name = name
            self.scope = scope
            self.location = location
            self.sessionParameters = sessionParameters
            self.distanceMeters = distanceMeters
        }

        enum CodingKeys: String, CodingKey {
            case name
            case scope
            case location
            case sessionParameters = "session_params"
            case distanceMeters = "distance_meters"
        }

        public func encode(to encoder: Encoder) throws {
            var c = encoder.container(keyedBy: CodingKeys.self)
            try c.encodeIfPresent(name, forKey: .name)
            try c.encodeIfPresent(scope, forKey: .scope)
            try c.encodeIfPresent(location, forKey: .location)
            try c.encodeIfPresent(sessionParameters, forKey: .sessionParameters)
            try c.encodeIfPresent(distanceMeters, forKey: .distanceMeters)
        }
    }

    // MARK: - pure helpers

    /// Mirrors the SQL CHECK `char_length(name) between 1 and 40`.
    /// Exposed pure so the Setup CTA can disable the submit button
    /// without a round trip.
    public static func isValidName(_ raw: String) -> Bool {
        let count = raw.count
        return count >= 1 && count <= 40
    }

    // MARK: - mutations

    /// Insert a fresh `pending` Plan. Returns the typed row with
    /// server-allocated id + defaults populated. Throws on the usual
    /// PostgREST failure shapes (network, RLS deny, CHECK violation).
    @discardableResult
    public func create(
        as creatorID: UUID,
        name: String,
        scope: Scope = .group,
        location: Location? = nil,
        sessionParameters: SessionParameters = .default,
        distanceMeters: Int = 1609
    ) async throws -> Plan {
        let insert = CreateInsert(
            creatorID: creatorID,
            name: name,
            scope: scope,
            location: location,
            sessionParameters: sessionParameters,
            distanceMeters: distanceMeters
        )
        let row: Plan = try await client
            .from("plans")
            .insert(insert)
            .select()
            .single()
            .execute()
            .value
        return row
    }

    /// List the caller's own Plans, ordered most-recently-touched
    /// first. RLS gates the select to `creator_id = auth.uid()`, so
    /// the call returns only what the caller owns — no client-side
    /// filtering needed.
    public func fetchMine() async throws -> [Plan] {
        let rows: [Plan] = try await client
            .from("plans")
            .select()
            .order("updated_at", ascending: false)
            .execute()
            .value
        return rows
    }

    /// Read-side list query backing the S00 Plan list surface
    /// (tb-WF-5). Filters to `status = 'pending'` and orders
    /// `created_at DESC` per `surfaces/00-plan-list.md` §"Ordering
    /// within sections" (Q7).
    ///
    /// The `userID` argument is carried for explicit auditability at
    /// the call site — the actual scoping is enforced server-side by
    /// the `plans_select_creator` RLS policy (`creator_id =
    /// auth.uid()`). Passing it here means a future call site can't
    /// silently read someone else's Plans even if the RLS regresses.
    ///
    /// tb-WF-5 only ships the Pending section. Decided + History
    /// queries land in tb-WF-8 (different status filters + different
    /// sort keys — `verdict_fired_at DESC` / `expired_at DESC`).
    public func plansForList(userID: UUID) async throws -> [Plan] {
        let rows: [Plan] = try await client
            .from("plans")
            .select()
            .eq("creator_id", value: userID.uuidString.lowercased())
            .eq("status", value: LifecycleState.pending.rawValue)
            .order("created_at", ascending: false)
            .execute()
            .value
        return rows
    }

    /// tb-WF-7 — read-side query backing the S00 Plan list's Joined
    /// section. Returns every Plan the caller is a non-owner member
    /// of (`members.role <> 'owner'`), with per-joiner resume signals
    /// (`lastAnsweredQuestionIndex`, `hasVoted`) projected inline so
    /// the surface can dispatch the §Q8 tap router without an N+1
    /// lookup per card.
    ///
    /// Server-side filtering — the `joined_plans_for_user` RPC pins
    /// the query to `auth.uid()`, joins `members -> rooms -> plans`,
    /// and excludes exited joiners (no `members` row) and the
    /// caller's own Created Plans (`role = 'owner'`).
    ///
    /// `userID` is explicit at the call site for auditability; the
    /// RPC body checks it matches `auth.uid()` and returns zero rows
    /// otherwise — a future call site can't silently request someone
    /// else's Joined list even if RLS regresses.
    public func joinedPlansForList(userID: UUID) async throws -> [JoinedPlanRow] {
        struct Params: Encodable { let p_user_id: UUID }
        let rows: [JoinedPlanRow] = try await client
            .rpc("joined_plans_for_user", params: Params(p_user_id: userID))
            .execute()
            .value
        return rows
    }

    /// tb-WF-7 — write the in-flight quiz progress payload to the
    /// caller's `members.quiz_progress` jsonb column. Backs the
    /// `MemberProgressWriter` seam on the `QuizCoordinator` so a
    /// joiner who backgrounds the app mid-quiz can resume from the
    /// saved state on next launch.
    ///
    /// Best-effort from the caller's perspective: the underlying
    /// RPC has a `security definer` body that pins to
    /// `auth.uid()`, so a thrown error here is either a transport
    /// failure (network blip) or a malformed payload (a coordinator
    /// bug). Either way the QuizCoordinator catches and drops the
    /// error — the column is a resume-from-state convenience, not a
    /// verdict-engine input.
    public func writeQuizProgress(
        roomID: UUID,
        progress: QuizProgress
    ) async throws {
        // Encode the progress payload to AnyJSON via a JSONEncoder
        // round-trip so the supabase-swift RPC call wraps it as the
        // server-side `p_progress jsonb` argument without us having
        // to hand-build the `AnyJSON` tree. The encoder honors the
        // CodingKey mapping in `QuizProgress` (snake-case wire shape).
        struct Params: Encodable {
            let p_room_id: UUID
            let p_progress: QuizProgress
        }
        try await client
            .rpc(
                "members_progress_upsert",
                params: Params(p_room_id: roomID, p_progress: progress)
            )
            .execute()
    }

    /// tb-WF-7 — build the `MemberProgressWriter` closure the
    /// `QuizCoordinator` consumes. The live joiner-side
    /// `QuizSessionAssembler` (and the RootView resume path) binds
    /// this to a `PlansStore` instance so progress writes flow
    /// through the same Supabase client as every other call.
    public func memberProgressWriter(roomID: UUID) -> MemberProgressWriter {
        return { [weak self] progress in
            guard let self else { return }
            try await self.writeQuizProgress(roomID: roomID, progress: progress)
        }
    }

    /// tb-WF-7 — wire shape for the resume-payload lookup. Carries
    /// the room id (the Joined-list query returns it elsewhere) +
    /// the in-flight `QuizProgress` payload as written into
    /// `members.quiz_progress`.
    public struct JoinedResumePayload: Sendable {
        public let roomID: UUID
        public let progress: QuizProgress
    }

    /// tb-WF-7 — fetch the room id linked to a Joined Plan plus the
    /// caller's saved `members.quiz_progress`. Best-effort: returns
    /// nil on a transport failure or RLS deny so the caller can fall
    /// back to leaving the user on the Plan list.
    ///
    /// One round-trip: the call selects from `members` (which the
    /// caller can read for any room they belong to) and joins to
    /// `rooms` to project the linked `plan_id`. RLS on `members`
    /// already restricts the rows to rooms the caller is in.
    public func fetchJoinedResumePayload(
        planID: UUID,
        userID: UUID
    ) async -> JoinedResumePayload? {
        // Two-step: look up the (room_id, quiz_progress) for the
        // caller's membership on a room whose `plan_id` equals
        // `planID`. The natural shape is a single PostgREST
        // embedded select, but `members` doesn't have a foreign-key
        // alias on rooms that PostgREST infers cleanly here; the
        // direct shape is to filter `rooms` by `plan_id` first then
        // join `members` on the resulting room id. We fold both
        // into a single SECURITY DEFINER RPC.
        struct Params: Encodable {
            let p_plan_id: UUID
            let p_user_id: UUID
        }
        struct Row: Decodable {
            let room_id: UUID
            let quiz_progress: QuizProgress?
        }
        do {
            let rows: [Row] = try await client
                .rpc(
                    "joined_plan_resume_payload",
                    params: Params(p_plan_id: planID, p_user_id: userID)
                )
                .execute()
                .value
            guard let row = rows.first else { return nil }
            return JoinedResumePayload(
                roomID: row.room_id,
                progress: row.quiz_progress ?? QuizProgress()
            )
        } catch {
            return nil
        }
    }

    /// tb-WF-7 — look up only the room id linked to a Joined Plan,
    /// without hydrating the progress payload. Used by the read-only
    /// Verdict branch (a Decided Plan tap), which does not need
    /// quiz progress but does need the room id to call
    /// `LateJoinerStore.fetchReadOnlyPayload`. The userID is the
    /// caller's signed-in id and is checked against `auth.uid()`
    /// server-side; passing it explicitly keeps the call-site
    /// auditable.
    public func roomIDForJoinedPlan(planID: UUID, userID: UUID? = nil) async -> UUID? {
        // The server-side RPC pins to `auth.uid()` regardless of the
        // `p_user_id` we pass, but matching the two means the call
        // site can never mis-route a lookup. `userID` is optional
        // for ergonomic call sites that don't already have it.
        let pinned = userID ?? UUID()
        let payload = await fetchJoinedResumePayload(planID: planID, userID: pinned)
        return payload?.roomID
    }

    /// Apply a partial update to a Plan and return the refreshed row.
    public func update(
        planID: UUID,
        fields: PlanUpdate
    ) async throws -> Plan {
        let row: Plan = try await client
            .from("plans")
            .update(fields)
            .eq("id", value: planID.uuidString.lowercased())
            .select()
            .single()
            .execute()
            .value
        return row
    }

    /// Delete a Plan. The FK on `rooms.plan_id` is `on delete set
    /// null`, so an in-flight Room loses its Plan link rather than
    /// being deleted alongside.
    public func delete(planID: UUID) async throws {
        try await client
            .from("plans")
            .delete()
            .eq("id", value: planID.uuidString.lowercased())
            .execute()
    }

    /// Observe a Plan's lifecycle state with a poll-on-foreground
    /// stream. The Realtime subscription is the eventual target —
    /// for tb-WF-1 we ship the polling fallback so the consumer API
    /// is stable, and a later tracer-bullet swaps the implementation
    /// without changing the surface.
    ///
    /// The stream emits the current row immediately, then re-fetches
    /// every `intervalSeconds`. Terminating the consuming Task drops
    /// the polling timer.
    public func observe(
        planID: UUID,
        intervalSeconds: TimeInterval = 5.0
    ) -> AsyncStream<Plan> {
        AsyncStream { continuation in
            let task = Task { [client] in
                while !Task.isCancelled {
                    do {
                        let row: Plan = try await client
                            .from("plans")
                            .select()
                            .eq("id", value: planID.uuidString.lowercased())
                            .single()
                            .execute()
                            .value
                        continuation.yield(row)
                        // Terminal states do not change again — close
                        // the stream cleanly. `decided-expired` is the
                        // sealed-Plan terminal; `decided-active` keeps
                        // polling until the window closes (sg-WF-6).
                        if row.status == .decidedExpired {
                            continuation.finish()
                            return
                        }
                    } catch {
                        // A transient fetch failure (offline) does not
                        // close the stream — let the next tick retry.
                    }
                    // Sleep until next poll. A cancellation drops out
                    // of the sleep promptly via Task cancellation
                    // propagation, so the stream terminator is
                    // responsive.
                    let nanos = UInt64(intervalSeconds * 1_000_000_000)
                    try? await Task.sleep(nanoseconds: nanos)
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in
                task.cancel()
            }
        }
    }
}
