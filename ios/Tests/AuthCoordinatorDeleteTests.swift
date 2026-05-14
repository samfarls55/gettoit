// GetToIt — AuthCoordinator.deleteAndReboot unit tests (TB-16).
//
// Covers the state-machine contract of the in-app delete flow WITHOUT
// requiring a real Supabase round-trip. The actual end-to-end delete
// (Edge function → cascade → fresh anonymous session) is exercised by
// the integration tests in `DeleteUserIntegrationTests`.
//
// Test seam:
//   * `StubAccountDeleter` — injected via `AuthCoordinator(deleter:)`,
//     drives the success / failure paths through the unit's own state
//     machine without touching the network.
//
// Cases:
//   1. deleteAndReboot before sign-in → throws `.notSignedIn`; state
//      stays `.idle`; deleter never called.
//   2. deleteAndReboot when the deleter throws → state goes to
//      `.error`; error rethrown so the surface can re-enable for retry.
//      `signOut` / `signInAnonymously` are not invoked (the local
//      session is still alive).
//   3. The happy path (deleter succeeds, signOut + signInAnonymously
//      land a fresh anon) cannot be unit-tested in isolation because
//      both `signOut` and `signInAnonymously` are concrete supabase-swift
//      methods that hit the real auth service. The integration test
//      lane (DeleteUserIntegrationTests) covers that.

import XCTest
import Foundation
import Supabase
@testable import GetToIt

@MainActor
final class AuthCoordinatorDeleteTests: XCTestCase {

    func testDeleteWhenNotSignedInThrowsAndDoesNotChangeState() async {
        let deleter = StubAccountDeleter()
        let coord = makeCoordinator(deleter: deleter)
        // Default state is .idle.
        XCTAssertEqual(coord.state, .idle)

        do {
            _ = try await coord.deleteAndReboot()
            XCTFail("expected deleteAndReboot to throw when not signed in")
        } catch AuthCoordinator.DeleteError.notSignedIn {
            // expected
        } catch {
            XCTFail("expected .notSignedIn, got \(error)")
        }

        XCTAssertEqual(coord.state, .idle, "state must stay .idle when delete is called without a session.")
        XCTAssertEqual(deleter.callCount, 0, "deleter must not be invoked without a session.")
    }

    func testDeleteWhenDeleterThrowsTransitionsToError() async {
        let anonID = UUID()
        let deleter = StubAccountDeleter()
        deleter.result = .failure(StubError.network)

        let coord = makeCoordinator(deleter: deleter)
        coord._setStateForTesting(.anonymous(userID: anonID))

        do {
            _ = try await coord.deleteAndReboot()
            XCTFail("expected deleteAndReboot to rethrow the deleter error")
        } catch StubError.network {
            // expected
        } catch {
            XCTFail("expected StubError.network, got \(error)")
        }

        // State must go to .error so the surface can re-enable the CTA
        // for retry. Crucially, the local session is still alive — the
        // userID stayed on the coordinator until the moment we
        // transitioned to signingIn, and the deleter failure happens
        // before signOut, so the cached JWT is untouched.
        if case .error = coord.state {
            // expected
        } else {
            XCTFail("expected state to be .error after deleter failure; got \(coord.state)")
        }
        XCTAssertEqual(deleter.callCount, 1, "deleter must have been invoked exactly once.")
    }

    func testDeleteFromLinkedAppleStateAlsoCallsDeleterAndTransitionsToError() async {
        // The flow doesn't branch on linked vs anonymous — deleteAndReboot
        // works the same for both. This test pins that: a linked user's
        // delete attempt with a failing deleter behaves identically.
        let linkedID = UUID()
        let deleter = StubAccountDeleter()
        deleter.result = .failure(StubError.network)

        let coord = makeCoordinator(deleter: deleter)
        coord._setStateForTesting(.linkedApple(userID: linkedID))

        do {
            _ = try await coord.deleteAndReboot()
            XCTFail("expected deleteAndReboot to rethrow")
        } catch StubError.network {
            // expected
        } catch {
            XCTFail("expected StubError.network, got \(error)")
        }

        XCTAssertEqual(deleter.callCount, 1, "deleter must be invoked once even for linked users.")
        if case .error = coord.state {
            // expected
        } else {
            XCTFail("expected state to be .error after deleter failure; got \(coord.state)")
        }
    }

    // MARK: - helpers

    /// Build an AuthCoordinator with a stub deleter. Mirrors the
    /// helper used by AuthCoordinatorLinkAppleTests — the SupabaseClient
    /// is real-but-throwaway because supabase-swift's initializer
    /// doesn't admit a fake.
    private func makeCoordinator(deleter: any SupabaseAccountDeleter) -> AuthCoordinator {
        let url = URL(string: "https://example.invalid")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "stub")
        return AuthCoordinator(client: client, deleter: deleter)
    }
}

// MARK: - test doubles

/// Stub deleter — captures invocation and returns a canned result.
@MainActor
final class StubAccountDeleter: SupabaseAccountDeleter, @unchecked Sendable {
    enum Outcome {
        case success
        case failure(Error)
    }

    var result: Outcome = .success
    private(set) var callCount = 0

    func deleteCurrentUser() async throws {
        callCount += 1
        switch result {
        case .success:
            return
        case .failure(let err):
            throw err
        }
    }
}
