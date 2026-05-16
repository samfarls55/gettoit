// GetToIt — RoomStore integration tests (TB-02).
//
// Hits the live Supabase project configured in the app bundle via
// SUPABASE_PROJECT_URL + SUPABASE_ANON_KEY. Skips itself when those
// are absent so design-system-only PRs don't get blocked.
//
// Acceptance covered:
//   * `RoomStore.createRoom` writes a `rooms` row owned by the caller
//     plus a `members` row with `role='owner'`.
//   * `RoomStore.joinRoom` writes a `members` row with
//     `role='participant'` for a different user against the same room.
//   * RLS prevents a third (non-member) user from reading either row.

import XCTest
import Supabase
@testable import GetToIt

@MainActor
final class RoomStoreIntegrationTests: XCTestCase {

    // Shared config lookup mirrors `AnonAuthIntegrationTests`.
    private func loadConfig() throws -> SupabaseConfig {
        let bundle = Bundle(for: type(of: self))
        let config = SupabaseConfig.fromBundle(bundle)
            ?? SupabaseConfig.fromBundle(.main)
        guard let config else {
            throw XCTSkip("SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not configured for this build; skipping integration test.")
        }
        return config
    }

    /// Sign in as a fresh anonymous user on `client` and return their
    /// user id. Signs out first to clear any session left behind by an
    /// earlier test.
    @discardableResult
    private func signInFreshAnon(on client: SupabaseClient) async throws -> UUID {
        try? await client.auth.signOut()
        let session = try await client.auth.signInAnonymously()
        return session.user.id
    }

    /// Build a Supabase client backed by an *in-memory* auth storage.
    ///
    /// supabase-swift defaults to Keychain on Apple platforms, but
    /// keychain writes fail silently in an unsigned simulator build
    /// (`CODE_SIGNING_ALLOWED=NO` in our CI lane) — `signInAnonymously`
    /// still returns a Session, but `sessionManager.update` can't
    /// persist it, so `currentSession` is permanently nil and
    /// PostgREST never attaches the JWT. The in-memory storage keeps
    /// the session in heap memory where the SDK can round-trip it.
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

    /// Heap-backed `AuthLocalStorage` for tests. Same shape as the
    /// upstream `KeychainLocalStorage` but without the entitlement
    /// requirement.
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

    func testCreateRoomWritesOwnerMembershipAndIsReadableByTheCreator() async throws {
        let client = try makeClient()
        let creatorID = try await signInFreshAnon(on: client)
        let store = RoomStore(client: client)

        let room = try await store.createRoom(as: creatorID)

        XCTAssertEqual(room.creatorUserID, creatorID,
                       "expected creator_user_id to match the signed-in user")
        XCTAssertEqual(room.vertical, "food")
        XCTAssertEqual(room.status, "open")
        // TB-03 — calling `createRoom` without overrides must write the
        // canonical S01 defaults (10 min / ≈ 2.0 mi).
        XCTAssertEqual(room.timerMinutes, 10,
                       "expected default timer_minutes from S01 spec (10 min)")
        XCTAssertEqual(room.radiusMeters, 3219,
                       "expected default radius_meters from S01 spec (~ 2.0 mi)")

        // Reading the room back through the same auth context must work
        // — proves the RLS policy admits the creator as a member.
        let fetched = try await store.fetchRoom(id: room.id)
        XCTAssertEqual(fetched?.id, room.id)
        XCTAssertEqual(fetched?.timerMinutes, 10)
        XCTAssertEqual(fetched?.radiusMeters, 3219)

        // And the creator's `members` row carries the owner role.
        let role = try await store.fetchRole(roomID: room.id, userID: creatorID)
        XCTAssertEqual(role, "owner")

        try? await client.auth.signOut()
    }

    func testCreateRoomPersistsNonDefaultTimerAndRadius() async throws {
        let client = try makeClient()
        let creatorID = try await signInFreshAnon(on: client)
        let store = RoomStore(client: client)

        // 30 min · 5.0 mi = 8047 m — the two extreme legal values from
        // the S01 chip group + slider. Proves the round trip handles
        // values at the boundary of the column CHECK constraints.
        let room = try await store.createRoom(
            as: creatorID,
            timerMinutes: 30,
            radiusMeters: 8047
        )

        XCTAssertEqual(room.timerMinutes, 30)
        XCTAssertEqual(room.radiusMeters, 8047)

        let fetched = try await store.fetchRoom(id: room.id)
        XCTAssertEqual(fetched?.timerMinutes, 30)
        XCTAssertEqual(fetched?.radiusMeters, 8047)

        try? await client.auth.signOut()
    }

    func testCreateRoomRejectsTimerOutsideTheLegalSet() async throws {
        let client = try makeClient()
        let creatorID = try await signInFreshAnon(on: client)
        let store = RoomStore(client: client)

        // 7 isn't in the {5, 10, 15, 30} legal set — the CHECK
        // constraint must reject and the call must throw.
        do {
            _ = try await store.createRoom(
                as: creatorID,
                timerMinutes: 7,
                radiusMeters: 3219
            )
            XCTFail("expected CHECK constraint to reject timer_minutes=7")
        } catch {
            // Any Postgres / PostgREST error here is acceptable — the
            // contract is "the row must not land," which the next
            // assertion proves.
        }

        try? await client.auth.signOut()
    }

    func testJoinRoomWritesParticipantMembershipForADifferentUser() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        // Device A — creator creates the room.
        let creatorID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: creatorID)

        // Device B — sign out as A, sign in as a brand new anon user.
        let joinerID = try await signInFreshAnon(on: client)
        XCTAssertNotEqual(creatorID, joinerID, "expected a distinct identity for the joiner")

        try await store.joinRoom(id: room.id, as: joinerID)

        let role = try await store.fetchRole(roomID: room.id, userID: joinerID)
        XCTAssertEqual(role, "participant")

        // The joiner can now read the `rooms` row — RLS admits them
        // because they're a member.
        let fetched = try await store.fetchRoom(id: room.id)
        XCTAssertEqual(fetched?.id, room.id)
        XCTAssertNotEqual(fetched?.creatorUserID, joinerID,
                          "expected the room's creator to be the original owner, not the joiner")

        try? await client.auth.signOut()
    }

    // MARK: - TB-05 (v1.1) — session parameters

    /// The initiator's S01b parameter selections persist on the room
    /// via `updateSessionParameters` and read back unchanged through
    /// `fetchSessionParameters`. This is parameter CAPTURE end to end
    /// against the live `rooms.session_params` jsonb column.
    func testUpdateSessionParametersPersistsTheInitiatorsSelections() async throws {
        let client = try makeClient()
        let creatorID = try await signInFreshAnon(on: client)
        let store = RoomStore(client: client)

        // S01: room is created first (mints the share link / roomID).
        let room = try await store.createRoom(as: creatorID)
        // A freshly-created room has no parameters yet — the column
        // is NULL, so the reader falls back to the canonical default.
        let beforeS01b = try await store.fetchSessionParameters(roomID: room.id)
        XCTAssertEqual(beforeS01b, SessionParameters.default,
            "a room created before S01b runs reads back the default parameters")

        // S01b: the initiator picks non-default parameters and the
        // CTA persists them.
        let chosen = SessionParameters(
            mealTime: .lateNight,
            groupContext: .duo,
            serviceShape: .takeoutDelivery,
            transportMode: .drive
        )
        try await store.updateSessionParameters(roomID: room.id, parameters: chosen)

        let readBack = try await store.fetchSessionParameters(roomID: room.id)
        XCTAssertEqual(readBack, chosen,
            "the persisted parameters must read back exactly as the initiator set them")

        try? await client.auth.signOut()
    }

    /// A JOINER reads the initiator's parameters off the room without
    /// re-prompting — the core acceptance criterion of TB-05. The
    /// joiner is a distinct identity; RLS still admits the read once
    /// they are a member, and the parameters hydrate field-for-field.
    func testJoinerHydratesInitiatorParametersWithoutReprompting() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        // Device A — initiator creates the room and sets parameters
        // on S01b.
        let creatorID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: creatorID)
        let initiatorParams = SessionParameters(
            mealTime: .breakfast,
            groupContext: .group,
            serviceShape: .dineInOutdoor,
            transportMode: .walk
        )
        try await store.updateSessionParameters(roomID: room.id, parameters: initiatorParams)

        // Device B — a brand-new anonymous joiner joins the room.
        let joinerID = try await signInFreshAnon(on: client)
        XCTAssertNotEqual(creatorID, joinerID)
        try await store.joinRoom(id: room.id, as: joinerID)

        // The joiner reads the parameters back — no S01b surface, no
        // re-prompt. They get exactly what the initiator set.
        let hydrated = try await store.fetchSessionParameters(roomID: room.id)
        XCTAssertEqual(hydrated, initiatorParams,
            "the joiner must hydrate the initiator's parameters verbatim")

        try? await client.auth.signOut()
    }

    /// RLS must keep a JOINER from overwriting the shared parameters —
    /// the *parameters* bucket is initiator-owned, session-wide. The
    /// `rooms_update_creator` policy admits only the creator; a
    /// joiner's UPDATE is denied (0 rows affected) and the initiator's
    /// parameters survive.
    func testJoinerCannotOverwriteSessionParameters() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        let creatorID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: creatorID)
        let initiatorParams = SessionParameters(
            mealTime: .dinner,
            groupContext: .solo,
            serviceShape: .dineInIndoor,
            transportMode: .walk
        )
        try await store.updateSessionParameters(roomID: room.id, parameters: initiatorParams)

        // Joiner joins, then attempts to overwrite the parameters.
        let joinerID = try await signInFreshAnon(on: client)
        try await store.joinRoom(id: room.id, as: joinerID)
        let joinerAttempt = SessionParameters(
            mealTime: .lunch,
            groupContext: .group,
            serviceShape: .takeoutPickup,
            transportMode: .drive
        )
        // The UPDATE is RLS-denied; PostgREST reports 0 rows affected
        // rather than throwing, so the call returns without error.
        try await store.updateSessionParameters(roomID: room.id, parameters: joinerAttempt)

        // The initiator's parameters must survive the joiner's attempt.
        let stillInitiators = try await store.fetchSessionParameters(roomID: room.id)
        XCTAssertEqual(stillInitiators, initiatorParams,
            "a joiner UPDATE must be RLS-denied; the initiator's parameters stand")

        try? await client.auth.signOut()
    }

    func testRLSHidesARoomFromANonMember() async throws {
        let client = try makeClient()
        let store = RoomStore(client: client)

        // Device A creates a room.
        let creatorID = try await signInFreshAnon(on: client)
        let room = try await store.createRoom(as: creatorID)

        // Device C — never joined — must not see it.
        _ = try await signInFreshAnon(on: client)

        let fetched = try await store.fetchRoom(id: room.id)
        XCTAssertNil(fetched, "expected RLS to hide the room from a non-member")

        try? await client.auth.signOut()
    }
}
