// GetToIt — SessionSnapshotStore unit tests (TB-20).
//
// The snapshot read returns the room's members, answered-set, and
// status in a single PostgREST round-trip. The network call itself is
// exercised by the `ios` integration lane against the live project;
// these pure tests cover the decode + projection
// (`SessionSnapshot.init(row:)`) — the load-bearing shaping that turns
// the PostgREST embedded-resource JSON into the shape
// `WaitingStore.bootstrap` consumes.

import XCTest
@testable import GetToIt

@MainActor
final class SessionSnapshotStoreTests: XCTestCase {

    /// Decode a `SnapshotRow` from the exact JSON shape PostgREST
    /// returns for `rooms?select=status,members(user_id,role),votes(user_id)`.
    private func decodeRow(_ json: String) throws -> SessionSnapshotStore.SnapshotRow {
        let rows = try JSONDecoder().decode(
            [SessionSnapshotStore.SnapshotRow].self,
            from: Data(json.utf8)
        )
        guard let row = rows.first else {
            throw XCTSkip("empty decode")
        }
        return row
    }

    // MARK: - single-round-trip decode

    func testSnapshotDecodesMembersAnsweredAndStatusFromOneRow() throws {
        let owner = UUID()
        let joiner = UUID()
        let json = """
        [{
          "status": "open",
          "members": [
            {"user_id": "\(owner.uuidString)", "role": "owner"},
            {"user_id": "\(joiner.uuidString)", "role": "participant"}
          ],
          "votes": [
            {"user_id": "\(owner.uuidString)"}
          ]
        }]
        """
        let row = try decodeRow(json)
        let snapshot = SessionSnapshot(row: row)

        XCTAssertEqual(snapshot.members.count, 2,
            "both member rows embedded off the one rooms row decode")
        XCTAssertEqual(snapshot.answered, [owner],
            "the answered set is exactly the user-ids with a votes row")
        XCTAssertEqual(snapshot.status, .open)
        XCTAssertEqual(snapshot.members.first(where: { $0.id == owner })?.role, "owner")
    }

    func testSnapshotWithNoVotesYieldsAnEmptyAnsweredSet() throws {
        let json = """
        [{
          "status": "open",
          "members": [{"user_id": "\(UUID().uuidString)", "role": "owner"}],
          "votes": []
        }]
        """
        let snapshot = SessionSnapshot(row: try decodeRow(json))
        XCTAssertTrue(snapshot.answered.isEmpty,
            "a room nobody has answered yet projects to an empty answered set")
    }

    func testSnapshotMapsVerdictReadyStatus() throws {
        let json = """
        [{
          "status": "verdict_ready",
          "members": [{"user_id": "\(UUID().uuidString)", "role": "owner"}],
          "votes": []
        }]
        """
        let snapshot = SessionSnapshot(row: try decodeRow(json))
        XCTAssertEqual(snapshot.status, .verdictReady,
            "the verdict_ready wire string maps to the RoomStatus case")
    }

    func testUnknownStatusDegradesToOpenRatherThanDroppingTheSnapshot() throws {
        let json = """
        [{
          "status": "some_future_status",
          "members": [{"user_id": "\(UUID().uuidString)", "role": "owner"}],
          "votes": []
        }]
        """
        let snapshot = SessionSnapshot(row: try decodeRow(json))
        XCTAssertEqual(snapshot.status, .open,
            "an unmodelled status degrades to .open so the avatar row still renders")
    }

    // MARK: - bootstrap idempotence

    func testSnapshotRoundTripsThroughWaitingStoreBootstrap() throws {
        // The poll re-bootstraps the WaitingStore from a fresh snapshot
        // every cycle — `bootstrap` is documented idempotent. Applying
        // two different snapshots in sequence must leave the store on
        // the second, with no residue from the first.
        let store = WaitingStore(
            roomID: UUID(),
            currentUserID: UUID(),
            isInitiator: true
        )
        let m1 = UUID()
        let m2 = UUID()

        let first = SessionSnapshot(
            members: [WaitingMember(id: m1, role: "owner")],
            answered: [],
            status: .open
        )
        store.bootstrap(members: first.members, answered: first.answered, status: first.status)
        XCTAssertEqual(store.memberCount, 1)
        XCTAssertEqual(store.answeredCount, 0)

        let second = SessionSnapshot(
            members: [
                WaitingMember(id: m1, role: "owner"),
                WaitingMember(id: m2, role: "participant"),
            ],
            answered: [m1, m2],
            status: .open
        )
        store.bootstrap(members: second.members, answered: second.answered, status: second.status)
        XCTAssertEqual(store.memberCount, 2,
            "a re-bootstrap reflects the peer who joined since the last poll")
        XCTAssertEqual(store.answeredCount, 2,
            "a re-bootstrap reflects the peers who answered since the last poll")
    }
}
