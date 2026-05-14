// GetToIt — TelemetryWriter (TB-14).
//
// Thin wrapper that writes rows into the Supabase `events` table per
// ADR 0005. Owns the canonical event-type vocabulary so callers can
// never typo an event_type — every emitted event goes through a
// dedicated method.
//
// The writer is intentionally minimal:
//
//   * Composes a `TelemetryRow` (event_type + room_id? + user_id? +
//     properties) and hands it off to an injected `TelemetryEventSink`.
//   * Production binds the sink to `SupabaseTelemetrySink`, which
//     POSTs into the `events` table via PostgREST.
//   * Tests bind the sink to a capture spy.
//
// Documented event types (per the TB-14 ticket + ADR 0005):
//
//   | event_type      | room_id | user_id | properties                  |
//   |-----------------|---------|---------|-----------------------------|
//   | room_created    |   yes   |   yes   | { vertical, radius_m? }    |
//   | quiz_completed  |   yes   |   yes   | {}                          |
//   | verdict_ready   |   yes   |   no    | { method, option_id? }     |
//   | ratified        |   yes   |   yes   | {}                          |
//   | rerolled        |   yes   |   yes   | { reason }                 |
//   | invite_shared   |   yes   |   yes   | {}                          |
//   | member_joined   |   yes   |   yes   | {}                          |
//
// `verdict_ready` is room-level — there's only one verdict per room
// and it isn't "owned" by any single user. The other six are per-
// user actions.
//
// What this module does NOT do:
//   * Compute metrics. Metrics are SQL views over `events` +
//     `check_ins` (see `20260514000440000_metric_views.sql`).
//   * Sync rows to a third-party analytics platform. Telemetry stays
//     on-stack per ADR 0006 (privacy posture).
//   * Buffer / batch. v1 throughput is well inside Supabase's per-row
//     insert capacity; per-event POSTs are the simplest correct shape.
//     If throughput becomes a problem, batching layers in cleanly
//     behind the same `TelemetryEventSink` protocol.

import Foundation
import Supabase

// MARK: - row + sink

/// A single telemetry event ready for the `events` table.
public struct TelemetryRow: Equatable, Sendable {
    public let eventType: String
    public let roomID: UUID?
    public let userID: UUID?
    public let properties: [String: TelemetryValue]

    public init(
        eventType: String,
        roomID: UUID? = nil,
        userID: UUID? = nil,
        properties: [String: TelemetryValue] = [:]
    ) {
        self.eventType = eventType
        self.roomID = roomID
        self.userID = userID
        self.properties = properties
    }
}

/// A jsonb-safe leaf value. Limited on purpose — PostgREST serializes
/// `Encodable` types, but only the primitives below match the
/// `events.properties jsonb` column without ambiguity. If a caller
/// needs a richer payload, lift it into the protocol — never reach
/// for `Date` / `URL` / custom struct here because the round-trip
/// shape is not under our control.
public enum TelemetryValue: Equatable, Sendable, Encodable {
    case string(String)
    case int(Int)
    case double(Double)
    case bool(Bool)
    case null

    public var stringValue: String? {
        if case .string(let s) = self { return s }
        return nil
    }
    public var intValue: Int? {
        if case .int(let i) = self { return i }
        return nil
    }
    public var doubleValue: Double? {
        if case .double(let d) = self { return d }
        return nil
    }
    public var boolValue: Bool? {
        if case .bool(let b) = self { return b }
        return nil
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let s): try container.encode(s)
        case .int(let i):    try container.encode(i)
        case .double(let d): try container.encode(d)
        case .bool(let b):   try container.encode(b)
        case .null:          try container.encodeNil()
        }
    }
}

/// Injectable write seam. Production binds to the Supabase adapter;
/// tests bind to a capture spy.
public protocol TelemetryEventSink: AnyObject, Sendable {
    func write(_ row: TelemetryRow) async throws
}

// MARK: - TelemetryWriter

/// Thin wrapper over a `TelemetryEventSink`. Owns the documented
/// event-type vocabulary so callers can never typo an event_type.
@MainActor
public final class TelemetryWriter {
    private let sink: TelemetryEventSink

    public init(sink: TelemetryEventSink) {
        self.sink = sink
    }

    // MARK: - documented event helpers

    /// PRD user story 2 — initiator creates a room. Fires on the S01
    /// "Start" tap once the room id is allocated.
    public func roomCreated(
        roomID: UUID,
        userID: UUID,
        properties: [String: TelemetryValue] = [:]
    ) async throws {
        try await emit(
            eventType: "room_created",
            roomID: roomID,
            userID: userID,
            properties: properties
        )
    }

    /// PRD user story 22 — member submits Q5. The vote becomes
    /// reachable to the VerdictEngine after this fires.
    public func quizCompleted(
        roomID: UUID,
        userID: UUID,
        properties: [String: TelemetryValue] = [:]
    ) async throws {
        try await emit(
            eventType: "quiz_completed",
            roomID: roomID,
            userID: userID,
            properties: properties
        )
    }

    /// PRD user story 26 — VerdictEngine writes the verdict. Per the
    /// time-to-verdict metric, fires server-side ideally, but is also
    /// emitted client-side as a defensive backup when the iOS layer
    /// observes the row land via Realtime.
    public func verdictReady(
        roomID: UUID,
        properties: [String: TelemetryValue] = [:]
    ) async throws {
        try await emit(
            eventType: "verdict_ready",
            roomID: roomID,
            userID: nil,
            properties: properties
        )
    }

    /// PRD user story 37 — member taps "I'm in" on S05.
    public func ratified(
        roomID: UUID,
        userID: UUID,
        properties: [String: TelemetryValue] = [:]
    ) async throws {
        try await emit(
            eventType: "ratified",
            roomID: roomID,
            userID: userID,
            properties: properties
        )
    }

    /// PRD user story 52 — member tapped a reroll reason. `reason` is
    /// the machine token (wallet_time, group_bailed, place_packed,
    /// mood_shifted, other).
    public func rerolled(
        roomID: UUID,
        userID: UUID,
        reason: String,
        properties: [String: TelemetryValue] = [:]
    ) async throws {
        var props = properties
        props["reason"] = .string(reason)
        try await emit(
            eventType: "rerolled",
            roomID: roomID,
            userID: userID,
            properties: props
        )
    }

    /// PRD user story 8 — initiator taps "Share invite" on S02. Drives
    /// the denominator of the invite-acceptance metric.
    public func inviteShared(
        roomID: UUID,
        userID: UUID,
        properties: [String: TelemetryValue] = [:]
    ) async throws {
        try await emit(
            eventType: "invite_shared",
            roomID: roomID,
            userID: userID,
            properties: properties
        )
    }

    /// PRD user story 9 — invitee taps the deep link and the member
    /// row lands. Drives the numerator of the invite-acceptance
    /// metric's join-rate.
    public func memberJoined(
        roomID: UUID,
        userID: UUID,
        properties: [String: TelemetryValue] = [:]
    ) async throws {
        try await emit(
            eventType: "member_joined",
            roomID: roomID,
            userID: userID,
            properties: properties
        )
    }

    // MARK: - generic seam

    /// Escape hatch for events outside the documented vocabulary. The
    /// helpers above are the supported API; this exists for the
    /// integration test + a future TB-NN's event type before it gets
    /// its own helper. Use sparingly.
    public func emit(
        eventType: String,
        roomID: UUID?,
        userID: UUID?,
        properties: [String: TelemetryValue]
    ) async throws {
        try await sink.write(TelemetryRow(
            eventType: eventType,
            roomID: roomID,
            userID: userID,
            properties: properties
        ))
    }
}

// MARK: - SupabaseTelemetrySink

/// Production adapter — writes `TelemetryRow` into Supabase `events`
/// via PostgREST. The row's user_id, when nil, becomes a literal SQL
/// NULL — the RLS policy admits null user_id rows so an unauth'd
/// background event can still land (covers the verdict_ready
/// emission post auth-logout).
public final class SupabaseTelemetrySink: TelemetryEventSink, @unchecked Sendable {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func write(_ row: TelemetryRow) async throws {
        struct InsertRow: Encodable {
            let event_type: String
            let room_id: String?
            let user_id: String?
            let properties: [String: TelemetryValue]
        }
        let payload = InsertRow(
            event_type: row.eventType,
            room_id: row.roomID?.uuidString.lowercased(),
            user_id: row.userID?.uuidString.lowercased(),
            properties: row.properties
        )
        try await client
            .from("events")
            .insert(payload)
            .execute()
    }
}
