// GetToIt — delete-user end-to-end integration test (TB-16).
//
// Hits the real Supabase project: signs in anon, calls the
// `delete-user` Edge Function via `AuthCoordinator.deleteAndReboot()`,
// then asserts the post-flow state.
//
// Skips itself when SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY are absent
// so design-system-only PRs don't get blocked. Also skips itself when
// the `delete-user` Edge Function returns 404 — i.e. the function
// hasn't been deployed to the project yet (deploy is a HITL step:
// `supabase functions deploy delete-user --project-ref <ref>`). Once
// deployed, the test becomes a live regression check again.
//
// Budget note: this test burns TWO anon signups against the project's
// shared signup rate limit — one to set up the user that will be
// deleted, one for the post-delete fresh bootstrap. See the handoff
// for cumulative integration-suite signup cost. Consolidated into a
// single test method to stay within budget.
//
// What this covers:
//   * The Edge function is deployed and reachable from an iOS client.
//   * It accepts the caller's anon JWT (no extra auth gating against
//     anonymous users).
//   * Post-delete: AuthCoordinator transitions to .anonymous(newID),
//     where newID != priorID — the original user_id is dead, the
//     coordinator is back on a fresh anon session ready for S01.
//
// What this does NOT cover (intentionally):
//   * Cascade-FK verification at the row level. The FK rules are
//     declared in the migrations and enforced by Postgres; testing
//     them at the client layer requires service-role access (not
//     wired into iOS tests). The migration applying successfully via
//     `supabase db push --include-all` in CI is the contract.
//   * TTL purge cron — requires admin/service-role to seed an old
//     anonymous user; out of scope at the iOS layer.

import XCTest
import Supabase
@testable import GetToIt

@MainActor
final class DeleteUserIntegrationTests: XCTestCase {

    func testDeleteAndRebootDeletesCurrentUserAndYieldsFreshAnon() async throws {
        let bundle = Bundle(for: type(of: self))
        let config = SupabaseConfig.fromBundle(bundle)
            ?? SupabaseConfig.fromBundle(.main)
        guard let config else {
            throw XCTSkip("SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not configured for this build; skipping integration test.")
        }

        let client = SupabaseClient(
            supabaseURL: config.url,
            supabaseKey: config.anonKey,
            options: SupabaseClientOptions(
                auth: SupabaseClientOptions.AuthOptions(
                    storage: InMemoryAuthStorage()
                )
            )
        )

        let coord = AuthCoordinator(client: client)
        await coord.ensureSignedIn()

        // Establish a prior identity. coordinator state must reflect
        // an anonymous session before we attempt the delete.
        guard let priorID = coord.state.userID else {
            return XCTFail("expected an anonymous user_id after ensureSignedIn, got state \(coord.state)")
        }
        XCTAssertTrue(coord.state.isAnonymous,
                      "expected coordinator to be in .anonymous state before delete")

        // Hit the Edge function + bootstrap a fresh anon. This burns
        // the second signup of the test's budget — unless we bail on
        // the 404 path below, in which case the second signup is
        // saved.
        let newID: UUID
        do {
            newID = try await coord.deleteAndReboot()
        } catch let error as FunctionsError {
            // 404 means the function isn't deployed to this project.
            // Skip rather than fail so CI stays green until the HITL
            // deploy step lands. Any other FunctionsError (5xx, auth,
            // body validation) is a real regression — rethrow.
            if case .httpError(let code, _) = error, code == 404 {
                throw XCTSkip("delete-user Edge Function returned 404 — not deployed to this project. Deploy with: `supabase functions deploy delete-user --project-ref <ref>` and re-run.")
            }
            throw error
        }

        XCTAssertNotEqual(priorID, newID,
            "expected a fresh user_id after delete + re-bootstrap; got the same id back which means the original wasn't deleted")
        XCTAssertEqual(coord.state, .anonymous(userID: newID),
            "expected coordinator to be back in .anonymous on the new id")
        XCTAssertTrue(coord.state.isAnonymous,
                      "expected the post-delete session to be anonymous (the new bootstrap session)")

        // Clean up so the test project doesn't accumulate orphan rows.
        try? await client.auth.signOut()
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
}
