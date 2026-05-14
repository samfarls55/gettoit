// GetToIt — votes integration tests (TB-04).
//
// Hits the live Supabase project configured in the bundle. Skips
// itself when SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY aren't set so
// design-system-only PRs don't get blocked.
//
// Acceptance covered:
//   * Full-quiz submission writes a single `votes` row whose columns
//     match the answers captured by the coordinator.
//   * RLS blocks a non-member from inserting a row in someone else's
//     room. Membership in the room is the gate.
//   * RLS blocks a member from writing a row with `user_id` belonging
//     to a different user (the "wrong user" case from the ticket).
//   * Re-submit raises a unique-constraint violation, and the
//     coordinator's `isUniqueViolation` recognises it as such.

import XCTest
import Supabase
@testable import GetToIt

@MainActor
final class VotesIntegrationTests: XCTestCase {

    private func loadConfig() throws -> SupabaseConfig {
        let bundle = Bundle(for: type(of: self))
        let config = SupabaseConfig.fromBundle(bundle)
            ?? SupabaseConfig.fromBundle(.main)
        guard let config else {
            throw XCTSkip("SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not configured for this build; skipping integration test.")
        }
        return config
    }

    /// Mirrors `RoomStoreIntegrationTests.makeClient()`. In-memory auth
    /// storage so unsigned simulator builds can persist the session in
    /// heap memory.
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

    /// Read back a votes row through the live client. Returns nil
    /// when RLS hides the row from the caller.
    private struct VoteRowReadback: Decodable {
        let roomID: UUID
        let userID: UUID
        let q1Vetoes: [String]
        let q2Budget: Int
        let q3WalkMinutes: Int
        let q4Vibe: Int

        enum CodingKeys: String, CodingKey {
            case roomID = "room_id"
            case userID = "user_id"
            case q1Vetoes = "q1_vetoes"
            case q2Budget = "q2_budget"
            case q3WalkMinutes = "q3_walk_minutes"
            case q4Vibe = "q4_vibe"
        }
    }

    private func fetchVotes(client: SupabaseClient, roomID: UUID) async throws -> [VoteRowReadback] {
        let rows: [VoteRowReadback] = try await client
            .from("votes")
            .select("room_id,user_id,q1_vetoes,q2_budget,q3_walk_minutes,q4_vibe")
            .eq("room_id", value: roomID.uuidString.lowercased())
            .execute()
            .value
        return rows
    }

    /// Build a fully-answered QuizCoordinator bound to the supplied
    /// (room, user) and the live Supabase client.
    private func makeCoordinator(
        client: SupabaseClient,
        roomID: UUID,
        userID: UUID
    ) -> QuizCoordinator {
        let coord = QuizCoordinator(
            roomID: roomID,
            userID: userID,
            writer: QuizSupabaseWriter.make(client: client)
        )
        coord.toggleVeto(QuizVeto.shellfish)
        coord.advance()
        coord.setBudget(2)
        coord.advance()
        coord.setWalkMinutes(10)
        coord.advance()
        coord.setVibe(3)
        coord.advance()
        coord.setRegret(candidateID: QuizDummyCandidates.all[0].id, score: 5)
        coord.setRegret(candidateID: QuizDummyCandidates.all[1].id, score: 2)
        coord.setRegret(candidateID: QuizDummyCandidates.all[2].id, score: 4)
        return coord
    }

    // MARK: - happy path

    func testFullQuizSubmissionWritesASingleVotesRow() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        let userID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: userID)

        let coord = makeCoordinator(client: client, roomID: room.id, userID: userID)
        let result = await coord.submit()
        guard case .success(let outcome) = result else {
            return XCTFail("expected vote insert to succeed, got \(result)")
        }
        XCTAssertEqual(outcome, .written)

        let rows = try await fetchVotes(client: client, roomID: room.id)
        XCTAssertEqual(rows.count, 1, "expected exactly one votes row")
        let row = try XCTUnwrap(rows.first)
        XCTAssertEqual(row.userID, userID)
        XCTAssertEqual(row.q1Vetoes, [QuizVeto.shellfish])
        XCTAssertEqual(row.q2Budget, 2)
        XCTAssertEqual(row.q3WalkMinutes, 10)
        XCTAssertEqual(row.q4Vibe, 3)

        try? await client.auth.signOut()
    }

    // MARK: - idempotency

    func testResubmitFoldsToIdempotentSuccess() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        let userID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: userID)

        // First submit lands a row.
        let firstCoord = makeCoordinator(client: client, roomID: room.id, userID: userID)
        let first = await firstCoord.submit()
        guard case .success = first else {
            return XCTFail("expected first submit to succeed: \(first)")
        }

        // Second submit (same room + user) must fold to .idempotent —
        // the (room_id, user_id) primary key collides.
        let secondCoord = makeCoordinator(client: client, roomID: room.id, userID: userID)
        let second = await secondCoord.submit()
        guard case .success(let outcome) = second else {
            return XCTFail("expected resubmit to fold to idempotent: \(second)")
        }
        XCTAssertEqual(outcome, .idempotent)

        // Only one row exists in the table for this (room, user).
        let rows = try await fetchVotes(client: client, roomID: room.id)
        XCTAssertEqual(rows.count, 1, "expected the resubmit to NOT create a second row")

        try? await client.auth.signOut()
    }

    // MARK: - RLS

    func testRLSBlocksWritingAVoteForADifferentUser() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        // Device A creates a room.
        let creatorID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: creatorID)

        // Device B joins.
        let joinerID = try await signInFreshAnon(on: client)
        try await store.joinRoom(id: room.id, as: joinerID)

        // Device B tries to insert a row for the creator's user_id —
        // RLS rejects (`with check (user_id = auth.uid())`).
        let badCoord = QuizCoordinator(
            roomID: room.id,
            userID: creatorID,                    // <- not the signed-in user
            writer: QuizSupabaseWriter.make(client: client)
        )
        badCoord.advance(); badCoord.advance(); badCoord.advance(); badCoord.advance()
        let result = await badCoord.submit()
        guard case .failure = result else {
            return XCTFail("expected RLS to reject the cross-user insert, got \(result)")
        }

        // No row for the creator was written.
        let rows = try await fetchVotes(client: client, roomID: room.id)
        XCTAssertTrue(rows.allSatisfy { $0.userID != creatorID },
            "expected RLS to prevent any row from being written for the creator's user_id by the joiner")

        try? await client.auth.signOut()
    }

    func testRLSBlocksWritingAVoteForARoomTheUserDidNotJoin() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        // Device A creates a room.
        let creatorID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: creatorID)

        // Device C — never joined — tries to vote.
        let nonMemberID = try await signInFreshAnon(on: client)
        let coord = QuizCoordinator(
            roomID: room.id,
            userID: nonMemberID,
            writer: QuizSupabaseWriter.make(client: client)
        )
        coord.advance(); coord.advance(); coord.advance(); coord.advance()
        let result = await coord.submit()
        guard case .failure = result else {
            return XCTFail("expected RLS to reject the non-member insert, got \(result)")
        }

        try? await client.auth.signOut()
    }
}
