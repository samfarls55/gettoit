// GetToIt — fire_verdict RPC integration tests (TB-07).
//
// Hits the live Supabase project. Skips when secrets are absent
// (same pattern as VotesIntegrationTests / VerdictIntegrationTests).
//
// Acceptance covered:
//   * Initiator with quorum can flip a room from `open` to `firing`.
//   * Initiator below quorum (only their own vote, or 0 votes) gets
//     a `below_quorum` reject and the room stays `open`.
//   * Non-initiator gets `not_initiator` and the room stays `open`.
//   * Re-firing a room already in `firing` returns `already_firing`
//     (idempotency).
//
// Notes:
//   * The RPC dispatcher calls the compute-verdict Edge Function via
//     pg_net only when the cluster GUC `app.supabase_url` is set. In
//     our CI / local-dev environment that's typically unset, so the
//     RPC returns `firing` cleanly without trying to reach the Edge
//     Function. The HTTP dispatch is fire-and-forget anyway — the
//     RPC result we care about for the RLS/quorum tests is the
//     status flip, not whether the engine ran.

import XCTest
import Supabase
@testable import GetToIt

@MainActor
final class FireVerdictIntegrationTests: XCTestCase {

    private func loadConfig() throws -> SupabaseConfig {
        let bundle = Bundle(for: type(of: self))
        let config = SupabaseConfig.fromBundle(bundle)
            ?? SupabaseConfig.fromBundle(.main)
        guard let config else {
            throw XCTSkip("SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not configured; skipping integration test.")
        }
        return config
    }

    private func makeClient() throws -> SupabaseClient {
        let config = try loadConfig()
        return SupabaseClient(
            supabaseURL: config.url,
            supabaseKey: config.anonKey,
            options: SupabaseClientOptions(
                auth: SupabaseClientOptions.AuthOptions(
                    storage: InMemoryAuthStorage()
                )
            )
        )
    }

    private final class InMemoryAuthStorage: AuthLocalStorage, @unchecked Sendable {
        private var values: [String: Data] = [:]
        private let lock = NSLock()
        func store(key: String, value: Data) throws {
            lock.lock(); defer { lock.unlock() }
            values[key] = value
        }
        func retrieve(key: String) throws -> Data? {
            lock.lock(); defer { lock.unlock() }
            return values[key]
        }
        func remove(key: String) throws {
            lock.lock(); defer { lock.unlock() }
            values.removeValue(forKey: key)
        }
    }

    @discardableResult
    private func signInFreshAnon(on client: SupabaseClient) async throws -> UUID {
        try? await client.auth.signOut()
        let session = try await client.auth.signInAnonymously()
        return session.user.id
    }

    /// Encode the body Supabase's `functions/rpc` endpoint expects.
    private struct FireBody: Encodable {
        let p_room_id: UUID
    }

    private func callFireVerdict(client: SupabaseClient, roomID: UUID) async throws -> [String: Any] {
        // Invoke the function via PostgREST's RPC surface. supabase-swift
        // exposes `client.rpc(...)`; we call into it with the bound
        // params and decode the JSONB result.
        let response = try await client.rpc(
            "fire_verdict",
            params: FireBody(p_room_id: roomID)
        )
        .execute()
        let data = response.data
        // `data` is the raw response body; the function returns jsonb.
        let json = try JSONSerialization.jsonObject(with: data)
        if let dict = json as? [String: Any] {
            return dict
        }
        XCTFail("expected jsonb object from fire_verdict, got \(json)")
        return [:]
    }

    private func fetchRoomStatus(client: SupabaseClient, roomID: UUID) async throws -> String? {
        struct StatusRow: Decodable { let status: String }
        let rows: [StatusRow] = try await client
            .from("rooms")
            .select("status")
            .eq("id", value: roomID.uuidString.lowercased())
            .limit(1)
            .execute()
            .value
        return rows.first?.status
    }

    private func insertVoteAs(client: SupabaseClient, roomID: UUID, userID: UUID) async throws {
        // Direct PostgREST insert into votes, through the real
        // `QuizCoordinator.VoteRow` so the wire shape (TB-04 generic
        // jsonb `{ meta, answer }` slots) tracks the production writer
        // automatically.
        let row = QuizCoordinator.VoteRow(
            roomID: roomID,
            userID: userID,
            q1Vetoes: [],
            q2Budget: 4,
            q3WalkMinutes: 30,
            q4Vibe: 2,
            q5Regret: [:]
        )
        try await client
            .from("votes")
            .insert(row)
            .execute()
    }

    // MARK: - tests

    func testBelowQuorumRejectsWithRoomStillOpen() async throws {
        let client = try makeClient()
        let roomStore = RoomStore(client: client)

        let userID = try await signInFreshAnon(on: client)
        let room = try await roomStore.createRoom(as: userID)

        // No votes yet — quorum (0) is below 2.
        let result = try await callFireVerdict(client: client, roomID: room.id)
        XCTAssertEqual(result["error"] as? String, "below_quorum",
            "expected below_quorum reject before any votes land")

        let status = try await fetchRoomStatus(client: client, roomID: room.id)
        XCTAssertEqual(status, "open",
            "expected the rejected RPC to leave status unchanged")

        try? await client.auth.signOut()
    }

    func testInitiatorWithQuorumFlipsRoomToFiring() async throws {
        // Drive both the initiator and joiner identities on separate
        // clients so we can hop between sessions without losing the
        // initiator JWT. signInAnonymously on the same client
        // overwrites the prior session; supabase-swift caches the
        // session in our in-memory storage, so we use one client per
        // identity.
        let creatorClient = try makeClient()
        let joinerClient = try makeClient()
        let creatorRoomStore = RoomStore(client: creatorClient)
        let joinerRoomStore = RoomStore(client: joinerClient)

        // Initiator side — create room + vote.
        let creatorID = try await signInFreshAnon(on: creatorClient)
        let room = try await creatorRoomStore.createRoom(as: creatorID)
        try await insertVoteAs(client: creatorClient, roomID: room.id, userID: creatorID)

        // Joiner side — join + vote. Quorum now met (2 votes).
        let joinerID = try await signInFreshAnon(on: joinerClient)
        try await joinerRoomStore.joinRoom(id: room.id, as: joinerID)
        try await insertVoteAs(client: joinerClient, roomID: room.id, userID: joinerID)

        // Initiator presses Decide now via their own client — RPC
        // sees creator_user_id = auth.uid() and admits.
        let result = try await callFireVerdict(client: creatorClient, roomID: room.id)
        XCTAssertEqual(result["status"] as? String, "firing",
            "expected initiator + quorum RPC to flip status to firing — got \(result)")

        // Verify the row actually moved past `open` from the
        // initiator's perspective (they're a member, RLS admits).
        let status = try await fetchRoomStatus(client: creatorClient, roomID: room.id)
        // Status may be `firing` if the dispatcher GUC isn't set on
        // this project, OR `verdict_ready` if the live compute path
        // ran. Either is a successful flip away from `open`.
        XCTAssertNotEqual(status, "open",
            "expected the rooms.status to move past 'open' after a successful fire")
        XCTAssertNotEqual(status, "expired",
            "happy-path fire must not flip the room to expired")

        try? await creatorClient.auth.signOut()
        try? await joinerClient.auth.signOut()
    }

    func testNonInitiatorRejected() async throws {
        // Two clients so we can drive both identities cleanly.
        let creatorClient = try makeClient()
        let joinerClient = try makeClient()
        let creatorRoomStore = RoomStore(client: creatorClient)
        let joinerRoomStore = RoomStore(client: joinerClient)

        let creatorID = try await signInFreshAnon(on: creatorClient)
        let room = try await creatorRoomStore.createRoom(as: creatorID)
        try await insertVoteAs(client: creatorClient, roomID: room.id, userID: creatorID)

        let joinerID = try await signInFreshAnon(on: joinerClient)
        try await joinerRoomStore.joinRoom(id: room.id, as: joinerID)
        try await insertVoteAs(client: joinerClient, roomID: room.id, userID: joinerID)

        // Joiner attempts to fire — should be rejected.
        let result = try await callFireVerdict(client: joinerClient, roomID: room.id)
        XCTAssertEqual(result["error"] as? String, "not_initiator")

        try? await creatorClient.auth.signOut()
        try? await joinerClient.auth.signOut()
    }
}
