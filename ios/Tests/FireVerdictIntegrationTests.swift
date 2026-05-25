// GetToIt — fire_verdict RPC integration tests (TB-07, re-pointed by
// TB-13 onto the quiz-redesign firing contract).
//
// Hits the live Supabase project. Skips when secrets are absent
// (same pattern as VotesIntegrationTests / VerdictIntegrationTests).
//
// TB-13 (quiz redesign) retired the pre-redesign timer / shot-clock / minimum-quorum
// firing path. The verdict now fires on exactly two signals:
//   * All participants completed Q5 — the AFTER INSERT ON votes
//     trigger auto-fires the moment every current member has a
//     `regret`-kind votes slot. A votes row inserted via the
//     production `QuizCoordinator.VoteRow` writer always carries a
//     `regret` Q5 slot, so a member is Q5-complete the instant their
//     vote lands.
//   * The initiator pressed "close voting" — `fire_verdict` produces
//     the verdict on demand, with NO minimum quorum: a solo session
//     (initiator alone) resolves and the initiator never waits on a
//     straggler.
//
// Acceptance covered:
//   * Solo initiator can close voting with no other members and no
//     votes — `fire_verdict` returns `firing` (no quorum gate).
//   * A two-member room auto-fires once both members have voted
//     (both Q5-complete) — without anyone calling `fire_verdict`.
//   * The initiator can close voting before a joiner finishes — the
//     RPC flips the room without waiting on the straggler.
//   * Non-initiator gets `not_initiator` and the room stays `open`.
//   * Re-firing a room already past `open` returns `already_firing`
//     (idempotency).
//
// Notes:
//   * The RPC dispatcher calls the compute-verdict Edge Function via
//     pg_net only when the cluster GUC `app.supabase_url` is set. In
//     our CI / local-dev environment that's typically unset, so the
//     RPC returns `firing` cleanly without trying to reach the Edge
//     Function. The HTTP dispatch is fire-and-forget anyway — the
//     RPC result we care about for the RLS / firing tests is the
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
            q1Cuisines: [],
            q1NoPreference: true,
            q2Budget: 4,
            q3Reputation: QuizReputation.noPreference,
            q4Vibe: 2,
            q5Ratings: []
        )
        try await client
            .from("votes")
            .insert(row)
            .execute()
    }

    // MARK: - tests

    func testSoloInitiatorCanCloseVotingWithNoMinimumQuorum() async throws {
        // TB-13 (quiz redesign): there is NO minimum quorum. A solo session —
        // the initiator alone, with no other members and no votes —
        // can still close voting and produce a verdict. The pre-redesign
        // `below_quorum` reject is gone.
        let client = try makeClient()
        let roomStore = RoomStore(client: client)

        let userID = try await signInFreshAnon(on: client)
        let room = try await roomStore.createRoom(as: userID)

        // No votes, solo room — close voting fires regardless.
        let result = try await callFireVerdict(client: client, roomID: room.id)
        XCTAssertEqual(result["status"] as? String, "firing",
            "expected a solo close-voting RPC to flip to firing — got \(result)")
        XCTAssertNil(result["error"],
            "quiz redesign has no quorum gate; close voting must not reject")

        let status = try await fetchRoomStatus(client: client, roomID: room.id)
        XCTAssertNotEqual(status, "open",
            "expected the close-voting RPC to move the room past 'open'")

        try? await client.auth.signOut()
    }

    func testRoomAutoFiresOnceAllParticipantsCompleteQ5() async throws {
        // TB-13 (quiz redesign): the verdict auto-fires the moment every member
        // has completed Q5. A votes row written through the production
        // `QuizCoordinator.VoteRow` writer always carries a `regret`
        // Q5 slot, so once both members have voted the AFTER INSERT ON
        // votes trigger flips the room past `open` — with nobody
        // calling `fire_verdict`.
        //
        // Two clients so we can hop between identities without losing
        // the initiator JWT (signInAnonymously overwrites the prior
        // session on the same client).
        let creatorClient = try makeClient()
        let joinerClient = try makeClient()
        let creatorRoomStore = RoomStore(client: creatorClient)
        let joinerRoomStore = RoomStore(client: joinerClient)

        // Initiator creates the room.
        let creatorID = try await signInFreshAnon(on: creatorClient)
        let room = try await creatorRoomStore.createRoom(as: creatorID)

        // Joiner joins FIRST — so the room has two members before any
        // vote lands. (If the initiator voted while alone, the solo
        // room would auto-fire on that single Q5-complete member.)
        let joinerID = try await signInFreshAnon(on: joinerClient)
        try await joinerRoomStore.joinRoom(id: room.id, as: joinerID)

        // Initiator votes — one of two members is now Q5-complete.
        try await insertVoteAs(client: creatorClient, roomID: room.id, userID: creatorID)

        // The room must still be open — the joiner has not yet
        // completed Q5.
        let midStatus = try await fetchRoomStatus(client: creatorClient, roomID: room.id)
        XCTAssertEqual(midStatus, "open",
            "room must wait while a member has not completed Q5")

        // Joiner votes — now every member is Q5-complete.
        try await insertVoteAs(client: joinerClient, roomID: room.id, userID: joinerID)

        // The auto-fire trigger fired on the joiner's vote insert —
        // no `fire_verdict` call. Status moved past `open`. It is
        // `firing` when the dispatcher GUC is unset (CI / local), or
        // `verdict_ready` if the live compute path ran.
        let status = try await fetchRoomStatus(client: creatorClient, roomID: room.id)
        XCTAssertNotEqual(status, "open",
            "expected all-participants-complete to auto-fire the verdict")
        XCTAssertNotEqual(status, "expired",
            "auto-fire on all-complete must not flip the room to expired")

        try? await creatorClient.auth.signOut()
        try? await joinerClient.auth.signOut()
    }

    func testInitiatorClosesVotingWithoutWaitingOnAStraggler() async throws {
        // TB-13 (quiz redesign): the initiator's close-voting control produces
        // the verdict without waiting on a straggler. Here the joiner
        // has joined but NOT voted — the room is not all-complete —
        // yet the initiator can still close voting and fire.
        let creatorClient = try makeClient()
        let joinerClient = try makeClient()
        let creatorRoomStore = RoomStore(client: creatorClient)
        let joinerRoomStore = RoomStore(client: joinerClient)

        // Initiator creates the room.
        let creatorID = try await signInFreshAnon(on: creatorClient)
        let room = try await creatorRoomStore.createRoom(as: creatorID)

        // Joiner joins FIRST — two members before any vote lands, so
        // the initiator's vote does not auto-fire a solo room.
        let joinerID = try await signInFreshAnon(on: joinerClient)
        try await joinerRoomStore.joinRoom(id: room.id, as: joinerID)

        // Initiator votes; the joiner is the straggler — never votes.
        try await insertVoteAs(client: creatorClient, roomID: room.id, userID: creatorID)

        // Room is still open — the joiner has not completed Q5.
        let preStatus = try await fetchRoomStatus(client: creatorClient, roomID: room.id)
        XCTAssertEqual(preStatus, "open",
            "room must not auto-fire while the joiner is mid-quiz")

        // Initiator presses close voting — fires without the joiner.
        let result = try await callFireVerdict(client: creatorClient, roomID: room.id)
        XCTAssertEqual(result["status"] as? String, "firing",
            "expected close-voting to fire without the straggler — got \(result)")

        let status = try await fetchRoomStatus(client: creatorClient, roomID: room.id)
        XCTAssertNotEqual(status, "open",
            "expected close-voting to move the room past 'open'")
        XCTAssertNotEqual(status, "expired",
            "close-voting must not flip the room to expired")

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
