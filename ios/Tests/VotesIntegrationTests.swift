// GetToIt — votes integration tests (TB-04).
//
// Hits the live Supabase project configured in the bundle. Skips
// itself when SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY aren't set so
// design-system-only PRs don't get blocked.
//
// Acceptance covered:
//   * Full-quiz submission writes a single `votes` row whose columns
//     match the answers captured by the coordinator.
//   * Re-submit folds to idempotent — the (room_id, user_id) PK
//     collides, the coordinator surfaces `.idempotent`, no second row.
//   * RLS blocks a non-member from inserting a row in someone else's
//     room. Membership in the room is the gate.
//   * RLS blocks a member from writing a row with `user_id` belonging
//     to a different user (the "wrong user" case from the ticket).
//
// Test layout — two consolidated cases. The contracts are unchanged;
// what differs is how many fresh anonymous identities the suite
// burns against the shared Supabase project's signup rate limit.
// The free-tier auth budget is shared across every integration
// suite in a single CI run — adding any new test risks tipping the
// cumulative cliff. We fold:
//   * happy + idempotent share a single (room, user) fixture.
//   * cross-user RLS + non-member RLS share a single (room, user1,
//     user2) fixture — User2 first attempts a write while still a
//     non-member, then again after joining with user_id=user1.

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
    ///
    /// TB-04 (v1.1): `votes` stores answers in five generic jsonb
    /// slots (`q1`..`q5`), each a `{ meta, answer }` envelope. The
    /// readback decodes the envelopes and re-exposes the typed values
    /// so the assertions below stay legible.
    ///
    /// TB-06: Q1 carries the cuisine-craving answer (`cuisines` /
    /// `no_preference`) and Q3 the reputation chip (`reputation`).
    private struct VoteRowReadback: Decodable {
        let roomID: UUID
        let userID: UUID
        let q1Cuisines: [String]
        let q1NoPreference: Bool
        let q2Budget: Int
        let q3Reputation: String
        let q4Vibe: Int

        /// One generic `{ meta, answer }` slot.
        private struct Slot<Answer: Decodable>: Decodable {
            let answer: Answer
        }
        private struct CuisineAnswer: Decodable {
            let cuisines: [String]
            let noPreference: Bool
            enum CodingKeys: String, CodingKey {
                case cuisines
                case noPreference = "no_preference"
            }
        }
        private struct TierAnswer: Decodable { let tier: Int }
        private struct ReputationAnswer: Decodable { let reputation: String }
        private struct LevelAnswer: Decodable { let level: Int }

        enum CodingKeys: String, CodingKey {
            case roomID = "room_id"
            case userID = "user_id"
            case q1, q2, q3, q4
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            roomID = try c.decode(UUID.self, forKey: .roomID)
            userID = try c.decode(UUID.self, forKey: .userID)
            let cuisine = try c.decode(Slot<CuisineAnswer>.self, forKey: .q1).answer
            q1Cuisines = cuisine.cuisines
            q1NoPreference = cuisine.noPreference
            q2Budget = try c.decode(Slot<TierAnswer>.self, forKey: .q2).answer.tier
            q3Reputation = try c.decode(Slot<ReputationAnswer>.self, forKey: .q3).answer.reputation
            q4Vibe = try c.decode(Slot<LevelAnswer>.self, forKey: .q4).answer.level
        }
    }

    private func fetchVotes(client: SupabaseClient, roomID: UUID) async throws -> [VoteRowReadback] {
        let rows: [VoteRowReadback] = try await client
            .from("votes")
            .select("room_id,user_id,q1,q2,q3,q4")
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
        coord.toggleCuisine(QuizCuisine.japanese)
        coord.advance()
        coord.setBudget(2)
        coord.advance()
        coord.setReputation(QuizReputation.hiddenGem)
        coord.advance()
        coord.setVibe(3)
        coord.advance()
        coord.setRegret(candidateID: QuizDummyCandidates.all[0].id, score: 5)
        coord.setRegret(candidateID: QuizDummyCandidates.all[1].id, score: 2)
        coord.setRegret(candidateID: QuizDummyCandidates.all[2].id, score: 4)
        return coord
    }

    // MARK: - happy path + idempotency (single fixture)
    //
    // Folds the original `testFullQuizSubmissionWritesASingleVotesRow`
    // and `testResubmitFoldsToIdempotentSuccess` into one. Both
    // contracts are still asserted on the same (room, user) — the
    // happy-path columns land on the first submit, the idempotent
    // outcome lands on the second. Saves one anonymous signup
    // against the shared Supabase free-tier auth rate-limit budget.

    func testFullQuizHappyPathAndIdempotentResubmit() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        let userID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: userID)

        // First submit — happy path. Row lands with the right columns.
        let firstCoord = makeCoordinator(client: client, roomID: room.id, userID: userID)
        let first = await firstCoord.submit()
        guard case .success(let firstOutcome) = first else {
            return XCTFail("expected first vote insert to succeed, got \(first)")
        }
        XCTAssertEqual(firstOutcome, .written)

        let afterFirst = try await fetchVotes(client: client, roomID: room.id)
        XCTAssertEqual(afterFirst.count, 1, "expected exactly one votes row after the first submit")
        let row = try XCTUnwrap(afterFirst.first)
        XCTAssertEqual(row.userID, userID)
        XCTAssertEqual(row.q1Cuisines, [QuizCuisine.japanese])
        XCTAssertFalse(row.q1NoPreference)
        XCTAssertEqual(row.q2Budget, 2)
        XCTAssertEqual(row.q3Reputation, QuizReputation.hiddenGem)
        XCTAssertEqual(row.q4Vibe, 3)

        // Second submit — same (room, user) → idempotent. Coordinator
        // sees the (room_id, user_id) PK collide and folds the failure
        // back into a `.success(.idempotent)` outcome.
        let secondCoord = makeCoordinator(client: client, roomID: room.id, userID: userID)
        let second = await secondCoord.submit()
        guard case .success(let secondOutcome) = second else {
            return XCTFail("expected resubmit to fold to idempotent, got \(second)")
        }
        XCTAssertEqual(secondOutcome, .idempotent)

        let afterSecond = try await fetchVotes(client: client, roomID: room.id)
        XCTAssertEqual(afterSecond.count, 1, "expected the resubmit to NOT create a second row")

        try? await client.auth.signOut()
    }

    // MARK: - RLS (consolidated cross-user + non-member fixture)
    //
    // Folds the two RLS tests into one. The cross-user check and the
    // non-member check are independently exercised within a single
    // (creator, attacker) fixture by ordering the two attacks:
    //   1. While `attacker` is NOT yet a member, they try to vote
    //      → RLS rejects (non-member path).
    //   2. `attacker` joins the room.
    //   3. `attacker` (now a legitimate member) tries to write with
    //      `user_id = creatorID` → RLS rejects (cross-user path).
    // Saves two anonymous signups against the rate-limit budget.

    func testRLSBlocksBothNonMemberInsertAndCrossUserInsert() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        // Creator creates a room.
        let creatorID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: creatorID)

        // Attacker signs in but does NOT join yet.
        let attackerID = try await signInFreshAnon(on: client)
        XCTAssertNotEqual(creatorID, attackerID)

        // (1) Non-member attempt — attacker tries to insert their own
        // vote into a room they didn't join. RLS rejects.
        let nonMemberCoord = QuizCoordinator(
            roomID: room.id,
            userID: attackerID,
            writer: QuizSupabaseWriter.make(client: client)
        )
        nonMemberCoord.advance(); nonMemberCoord.advance()
        nonMemberCoord.advance(); nonMemberCoord.advance()
        let nonMemberResult = await nonMemberCoord.submit()
        guard case .failure = nonMemberResult else {
            return XCTFail("expected RLS to reject the non-member insert, got \(nonMemberResult)")
        }

        // (2) Cross-user attempt — attacker joins the room, then
        // tries to insert with the creator's user_id. RLS rejects on
        // the `with check (user_id = auth.uid())` clause.
        try await store.joinRoom(id: room.id, as: attackerID)
        let crossUserCoord = QuizCoordinator(
            roomID: room.id,
            userID: creatorID,                    // <- not the signed-in user
            writer: QuizSupabaseWriter.make(client: client)
        )
        crossUserCoord.advance(); crossUserCoord.advance()
        crossUserCoord.advance(); crossUserCoord.advance()
        let crossUserResult = await crossUserCoord.submit()
        guard case .failure = crossUserResult else {
            return XCTFail("expected RLS to reject the cross-user insert, got \(crossUserResult)")
        }

        // No row exists for the creator (attacker couldn't write for them).
        let rows = try await fetchVotes(client: client, roomID: room.id)
        XCTAssertTrue(rows.allSatisfy { $0.userID != creatorID },
            "expected RLS to prevent any row from being written for the creator's user_id by the attacker")

        try? await client.auth.signOut()
    }
}
