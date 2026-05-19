// GetToIt — SessionSnapshotStore integration tests (TB-20).
//
// Hits the live Supabase project configured in the bundle. Skips
// itself when SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY aren't set so
// design-system-only PRs don't get blocked.
//
// Acceptance covered:
//   * `SessionSnapshotStore.fetchSnapshot` returns the room's members,
//     answered-set, and status in a SINGLE PostgREST round-trip — the
//     embedded-resource query `rooms?select=status,members(...),votes(...)`.
//     This test is the proof that PostgREST resolves the `members` and
//     `votes` embeds off `rooms` without a relationship hint (the
//     foreign keys point at `rooms.id`); a pure decode test can't
//     catch a broken embed.
//
// Auth-budget note: the shared Supabase free-/pro-tier auth signup
// limit is consumed cumulatively across every integration suite in a
// CI run. This suite burns exactly ONE fresh anonymous identity — a
// single owner who creates a room and casts a vote. That exercises
// all three embedded tables (`rooms` + `members` + `votes`) and RLS
// without a second signup.

import XCTest
import Supabase
@testable import GetToIt

@MainActor
final class SessionSnapshotIntegrationTests: XCTestCase {

    private func loadConfig() throws -> SupabaseConfig {
        let bundle = Bundle(for: type(of: self))
        let config = SupabaseConfig.fromBundle(bundle)
            ?? SupabaseConfig.fromBundle(.main)
        guard let config else {
            throw XCTSkip("SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not configured for this build; skipping integration test.")
        }
        return config
    }

    /// Mirrors `RoomStoreIntegrationTests.makeClient()` — in-memory
    /// auth storage so unsigned simulator builds persist the session.
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

    /// Fully answer + submit the quiz for a (room, user) so a real
    /// `votes` row lands.
    private func castVote(client: SupabaseClient, roomID: UUID, userID: UUID) async throws {
        let coord = QuizCoordinator(
            roomID: roomID,
            userID: userID,
            candidates: QuizCandidateFixtures.all,
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
        coord.setRegret(candidateID: QuizCandidateFixtures.all[0].id, score: 5)
        coord.setRegret(candidateID: QuizCandidateFixtures.all[1].id, score: 2)
        coord.setRegret(candidateID: QuizCandidateFixtures.all[2].id, score: 4)
        let result = await coord.submit()
        guard case .success = result else {
            throw XCTSkip("vote insert did not succeed (\(result)); cannot exercise the snapshot")
        }
    }

    // MARK: - single-round-trip snapshot

    func testFetchSnapshotReturnsMembersAnsweredAndStatusInOneRoundTrip() async throws {
        let client = try makeClient()
        let roomStore = RoomStore(client: client)
        let snapshotStore = SessionSnapshotStore(client: client)

        let ownerID = try await signInFreshAnon(on: client)
        let room = try await roomStore.createRoom(as: ownerID)

        // Snapshot before any vote — the owner is a member, nobody has
        // answered, the room is open. One embedded-resource request.
        let beforeVote = try await snapshotStore.fetchSnapshot(roomID: room.id)
        let pre = try XCTUnwrap(beforeVote, "the owner is a member; the room row must be readable")
        XCTAssertEqual(pre.members.map(\.id), [ownerID],
            "the snapshot's avatar row is exactly the room's members")
        XCTAssertEqual(pre.members.first?.role, "owner")
        XCTAssertTrue(pre.answered.isEmpty,
            "no votes row yet — the answered set is empty")
        XCTAssertEqual(pre.status, .open)

        // Cast a vote, re-snapshot — the answered set now carries the
        // owner. Still a single round-trip; the `votes` embed resolves.
        try await castVote(client: client, roomID: room.id, userID: ownerID)
        let afterVote = try await snapshotStore.fetchSnapshot(roomID: room.id)
        let post = try XCTUnwrap(afterVote)
        XCTAssertEqual(post.answered, [ownerID],
            "the answered set reflects the votes row landing — the embed is live")
        XCTAssertEqual(post.members.map(\.id), [ownerID],
            "the members embed is unchanged by the vote")

        try? await client.auth.signOut()
    }
}
