// GetToIt — TelemetryWriter unit tests (TB-14).
//
// Drives the TelemetryWriter without a live Supabase project. The
// writer composes the row shape (event_type + room_id + user_id +
// properties); the integration round-trip lives in
// `RoomStoreIntegrationTests` / a future telemetry-specific
// integration test that hits the live `events` table.
//
// What these tests lock:
//   * The five documented event types are emitted via dedicated
//     helper methods so callers can't fat-finger the string.
//   * The row shape matches the `events` schema column-for-column
//     (event_type, room_id?, user_id?, properties).
//   * The `properties` payload is jsonb-encodable (no Date / URL
//     primitives that PostgREST can't serialize).
//   * The writer fans every call through a single `EventSink` seam
//     so tests can intercept without touching the network.

import XCTest
@testable import GetToIt

@MainActor
final class TelemetryWriterTests: XCTestCase {

    // MARK: - fixtures

    private final class CaptureSink: TelemetryEventSink, @unchecked Sendable {
        var rows: [TelemetryRow] = []
        var errorToThrow: Error?

        func write(_ row: TelemetryRow) async throws {
            if let error = errorToThrow { throw error }
            rows.append(row)
        }
    }

    private func makeWriter(sink: CaptureSink) -> TelemetryWriter {
        TelemetryWriter(sink: sink)
    }

    // MARK: - event-type helpers

    func testRoomCreatedEmitsCanonicalEventType() async throws {
        let sink = CaptureSink()
        let writer = makeWriter(sink: sink)
        let room = UUID()
        let user = UUID()
        try await writer.roomCreated(roomID: room, userID: user, properties: ["vertical": "food"])
        XCTAssertEqual(sink.rows.count, 1)
        let row = sink.rows[0]
        XCTAssertEqual(row.eventType, "room_created")
        XCTAssertEqual(row.roomID, room)
        XCTAssertEqual(row.userID, user)
        XCTAssertEqual(row.properties["vertical"]?.stringValue, "food")
    }

    func testQuizCompletedEmitsCanonicalEventType() async throws {
        let sink = CaptureSink()
        let writer = makeWriter(sink: sink)
        try await writer.quizCompleted(roomID: UUID(), userID: UUID())
        XCTAssertEqual(sink.rows.count, 1)
        XCTAssertEqual(sink.rows[0].eventType, "quiz_completed")
    }

    func testVerdictReadyEmitsCanonicalEventType() async throws {
        let sink = CaptureSink()
        let writer = makeWriter(sink: sink)
        try await writer.verdictReady(roomID: UUID(), properties: ["method": "manual"])
        XCTAssertEqual(sink.rows.count, 1)
        XCTAssertEqual(sink.rows[0].eventType, "verdict_ready")
        // verdict_ready is a room-level event — user_id is nil because
        // the verdict is the room's outcome, not a user's action.
        XCTAssertNil(sink.rows[0].userID)
        XCTAssertEqual(sink.rows[0].properties["method"]?.stringValue, "manual")
    }

    func testRatifiedEmitsCanonicalEventType() async throws {
        let sink = CaptureSink()
        let writer = makeWriter(sink: sink)
        try await writer.ratified(roomID: UUID(), userID: UUID())
        XCTAssertEqual(sink.rows.count, 1)
        XCTAssertEqual(sink.rows[0].eventType, "ratified")
    }

    func testRerolledEmitsCanonicalEventType() async throws {
        let sink = CaptureSink()
        let writer = makeWriter(sink: sink)
        try await writer.rerolled(roomID: UUID(), userID: UUID(), reason: "wallet_time")
        XCTAssertEqual(sink.rows.count, 1)
        let row = sink.rows[0]
        XCTAssertEqual(row.eventType, "rerolled")
        XCTAssertEqual(row.properties["reason"]?.stringValue, "wallet_time")
    }

    // MARK: - invite-acceptance helpers (drive metric_invite_acceptance)

    func testInviteSharedEmitsCanonicalEventType() async throws {
        let sink = CaptureSink()
        let writer = makeWriter(sink: sink)
        try await writer.inviteShared(roomID: UUID(), userID: UUID())
        XCTAssertEqual(sink.rows.count, 1)
        XCTAssertEqual(sink.rows[0].eventType, "invite_shared")
    }

    func testMemberJoinedEmitsCanonicalEventType() async throws {
        let sink = CaptureSink()
        let writer = makeWriter(sink: sink)
        try await writer.memberJoined(roomID: UUID(), userID: UUID())
        XCTAssertEqual(sink.rows.count, 1)
        XCTAssertEqual(sink.rows[0].eventType, "member_joined")
    }

    // MARK: - row-shape contract

    func testPropertiesDefaultsToEmptyJsonObject() async throws {
        let sink = CaptureSink()
        let writer = makeWriter(sink: sink)
        try await writer.quizCompleted(roomID: UUID(), userID: UUID())
        XCTAssertEqual(sink.rows[0].properties, [:])
    }

    func testCustomPropertiesAreCarriedThrough() async throws {
        let sink = CaptureSink()
        let writer = makeWriter(sink: sink)
        try await writer.emit(
            eventType: "custom_event",
            roomID: nil,
            userID: nil,
            properties: ["k1": .string("v1"), "k2": .int(42), "k3": .bool(true)]
        )
        XCTAssertEqual(sink.rows.count, 1)
        let row = sink.rows[0]
        XCTAssertEqual(row.properties["k1"]?.stringValue, "v1")
        XCTAssertEqual(row.properties["k2"]?.intValue, 42)
        XCTAssertEqual(row.properties["k3"]?.boolValue, true)
    }

    // MARK: - error propagation

    func testWriteFailurePropagates() async {
        struct DummyError: Error {}
        let sink = CaptureSink()
        sink.errorToThrow = DummyError()
        let writer = makeWriter(sink: sink)
        do {
            try await writer.quizCompleted(roomID: UUID(), userID: UUID())
            XCTFail("expected error to propagate")
        } catch {
            XCTAssertTrue(error is DummyError)
        }
    }
}
