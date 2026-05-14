// GetToIt — AuthPromptStore integration tests (TB-12).
//
// Drives `user_preferences` against the live Supabase project the rest
// of the integration tests use. Skips itself when the project URL /
// anon key are absent on this build (mirrors `AnonAuthIntegrationTests`
// and `RoomStoreIntegrationTests`).
//
// Schema:
//   `supabase/migrations/20260513213000000_user_preferences.sql`
//
// Coverage:
//   * Fresh user has no dismissal row — `shouldRenderAuthChip` is true.
//   * After `recordDismissal`, the row exists and the timestamp
//     reflects the injected `now` value.
//   * Within 30 days of dismissal → `shouldRenderAuthChip` is false
//     (suppressed).
//   * Past 30 days → `shouldRenderAuthChip` flips back to true.
//   * RLS hides one user's `user_preferences` row from another.

import XCTest
import Supabase
@testable import GetToIt

@MainActor
final class AuthPromptStoreIntegrationTests: XCTestCase {

    private func loadConfig() throws -> SupabaseConfig {
        let bundle = Bundle(for: type(of: self))
        let config = SupabaseConfig.fromBundle(bundle)
            ?? SupabaseConfig.fromBundle(.main)
        guard let config else {
            throw XCTSkip("SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not configured for this build; skipping integration test.")
        }
        return config
    }

    /// Sign in as a fresh anonymous user — mirrors `RoomStore` tests.
    @discardableResult
    private func signInFreshAnon(on client: SupabaseClient) async throws -> UUID {
        try? await client.auth.signOut()
        let session = try await client.auth.signInAnonymously()
        return session.user.id
    }

    /// Build a Supabase client backed by an in-memory auth storage.
    /// Same rationale as `RoomStoreIntegrationTests` — keychain writes
    /// fail silently in unsigned simulator builds.
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

    // MARK: - cases

    func testFreshUserHasNoDismissalAndChipRenders() async throws {
        let client = try makeClient()
        let userID = try await signInFreshAnon(on: client)
        let store = AuthPromptStore(client: client)

        let dismissal = try await store.fetchDismissalDate(for: userID)
        XCTAssertNil(dismissal,
                     "fresh user should have no dismissal row; got \(String(describing: dismissal))")

        let render = try await store.shouldRenderAuthChip(for: userID)
        XCTAssertTrue(render, "chip should render for a user who never dismissed")

        try? await client.auth.signOut()
    }

    func testDismissPersistsAndSuppressesForThirtyDays() async throws {
        let client = try makeClient()
        let userID = try await signInFreshAnon(on: client)
        let store = AuthPromptStore(client: client)

        let dismissalTime = Date(timeIntervalSinceReferenceDate: 800_000_000)
        try await store.recordDismissal(for: userID, now: dismissalTime)

        // Read it back — within tolerance for the timestamptz round-trip.
        let readBack = try await store.fetchDismissalDate(for: userID)
        XCTAssertNotNil(readBack, "dismissal row should exist after recordDismissal")
        XCTAssertEqual(readBack?.timeIntervalSinceReferenceDate ?? 0,
                       dismissalTime.timeIntervalSinceReferenceDate,
                       accuracy: 1.0,
                       "round-tripped dismissal time should match within 1s")

        // 1 day after dismissal → still suppressed.
        let oneDayLater = dismissalTime.addingTimeInterval(24 * 60 * 60)
        let renderDay1 = try await store.shouldRenderAuthChip(for: userID, now: oneDayLater)
        XCTAssertFalse(renderDay1, "chip should be suppressed 1 day after dismissal")

        // 29 days after dismissal → still suppressed (the cliff is 30).
        let day29 = dismissalTime.addingTimeInterval(29 * 24 * 60 * 60)
        let renderDay29 = try await store.shouldRenderAuthChip(for: userID, now: day29)
        XCTAssertFalse(renderDay29, "chip should be suppressed at day 29")

        // 30 days + 1 second → chip re-enables.
        let day30 = dismissalTime.addingTimeInterval(30 * 24 * 60 * 60 + 1)
        let renderDay30 = try await store.shouldRenderAuthChip(for: userID, now: day30)
        XCTAssertTrue(renderDay30, "chip should re-render past the 30-day window")

        try? await client.auth.signOut()
    }

    func testDismissIsIdempotentAndResetsTheClock() async throws {
        let client = try makeClient()
        let userID = try await signInFreshAnon(on: client)
        let store = AuthPromptStore(client: client)

        let first = Date(timeIntervalSinceReferenceDate: 700_000_000)
        try await store.recordDismissal(for: userID, now: first)

        // Re-dismissing later (e.g. user got re-prompted after 30d and
        // dismissed again) overwrites the timestamp — the 30-day
        // clock restarts.
        let second = first.addingTimeInterval(35 * 24 * 60 * 60)
        try await store.recordDismissal(for: userID, now: second)

        let readBack = try await store.fetchDismissalDate(for: userID)
        XCTAssertEqual(readBack?.timeIntervalSinceReferenceDate ?? 0,
                       second.timeIntervalSinceReferenceDate,
                       accuracy: 1.0,
                       "second dismissal should overwrite the first")

        // From second + 1 day → suppressed (clock restarted).
        let oneDayAfterSecond = second.addingTimeInterval(24 * 60 * 60)
        let render = try await store.shouldRenderAuthChip(for: userID, now: oneDayAfterSecond)
        XCTAssertFalse(render, "re-dismissal should restart the 30-day suppression clock")

        try? await client.auth.signOut()
    }

    func testRLSHidesOneUsersDismissalFromAnother() async throws {
        let client = try makeClient()
        let store = AuthPromptStore(client: client)

        // User A dismisses.
        let userA = try await signInFreshAnon(on: client)
        try await store.recordDismissal(for: userA, now: .init(timeIntervalSinceReferenceDate: 750_000_000))
        let readBackA = try await store.fetchDismissalDate(for: userA)
        XCTAssertNotNil(readBackA, "user A should see their own dismissal row")

        // User B (fresh anon) tries to read user A's row. RLS hides it.
        _ = try await signInFreshAnon(on: client)
        let readBackB = try await store.fetchDismissalDate(for: userA)
        XCTAssertNil(readBackB, "RLS should hide user A's dismissal row from user B")

        try? await client.auth.signOut()
    }
}
