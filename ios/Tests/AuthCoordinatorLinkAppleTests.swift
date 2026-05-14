// GetToIt — AuthCoordinator.linkApple unit tests (TB-12).
//
// Covers the state-machine contract of the anonymous → Apple-linked
// upgrade WITHOUT requiring a real Apple identity token. The actual
// network round-trip against Supabase is verified manually in
// TestFlight per TB-17 — CI can't mint a sandbox Apple idToken.
//
// Test seams:
//   * `StubAuthLinker` — injected via `AuthCoordinator(linker:)`,
//     drives the success / failure / userID-changed paths.
//   * No SupabaseClient touched here. (The integration tests in
//     `AuthIntegrationTests` cover the round-trip against the live
//     project where credentials permit.)
//
// Cases:
//   1. linkApple on an anonymous user → state transitions to
//      `.linkedApple(sameUserID)`. **The user_id does not change.**
//      This is the merge-correctness invariant — the whole TB-12
//      promise depends on it.
//   2. linkApple before sign-in → throws `.notSignedIn`, state stays
//      `.idle`.
//   3. linkApple while linker errors → state restored to
//      `.anonymous(sameUserID)`, error rethrown so the chip can
//      re-render in default state.
//   4. linkApple where the linker returns a DIFFERENT user_id →
//      throws `.userIDChanged`, state goes to `.error`. (Defensive:
//      catches an upstream Supabase semantics break loudly.)
//   5. linkApple on an already-linked user is a no-op success.

import XCTest
import Foundation
import Supabase
@testable import GetToIt

@MainActor
final class AuthCoordinatorLinkAppleTests: XCTestCase {

    func testLinkApplePreservesUserIDOnSuccess() async throws {
        let anonID = UUID()
        let linker = StubAuthLinker()
        linker.result = .success(anonID)  // server returns the SAME id

        let (coord, _) = makeCoordinator(linker: linker)
        // Force coordinator into the anonymous state without hitting
        // the network — exercises the state machine in isolation.
        coord._setStateForTesting(.anonymous(userID: anonID))

        let returned = try await coord.linkApple(idToken: "stub.token", nonce: "abc")

        XCTAssertEqual(returned, anonID,
                       "linkApple must return the SAME user_id — that's the merge-correctness invariant.")
        XCTAssertEqual(coord.state, .linkedApple(userID: anonID),
                       "state must transition to .linkedApple with the SAME user_id.")
        XCTAssertEqual(coord.state.userID, anonID,
                       "state.userID accessor must surface the linked id.")
        XCTAssertFalse(coord.state.isAnonymous,
                       "isAnonymous must be false after a successful link.")
    }

    func testLinkAppleWhenNotSignedInThrowsAndDoesNotChangeState() async {
        let linker = StubAuthLinker()
        let (coord, _) = makeCoordinator(linker: linker)
        // Coordinator is in `.idle` by default.
        XCTAssertEqual(coord.state, .idle)

        do {
            _ = try await coord.linkApple(idToken: "stub.token", nonce: nil)
            XCTFail("expected linkApple to throw when not signed in")
        } catch AuthCoordinator.LinkError.notSignedIn {
            // expected
        } catch {
            XCTFail("expected .notSignedIn, got \(error)")
        }

        XCTAssertEqual(coord.state, .idle, "state must stay .idle on a notSignedIn error.")
        XCTAssertEqual(linker.callCount, 0, "linker must not be called when there's no session.")
    }

    func testLinkAppleRestoresAnonymousStateOnLinkerError() async {
        let anonID = UUID()
        let linker = StubAuthLinker()
        linker.result = .failure(StubError.network)

        let (coord, _) = makeCoordinator(linker: linker)
        coord._setStateForTesting(.anonymous(userID: anonID))

        do {
            _ = try await coord.linkApple(idToken: "stub.token", nonce: nil)
            XCTFail("expected linkApple to rethrow the linker error")
        } catch StubError.network {
            // expected
        } catch {
            XCTFail("expected StubError.network, got \(error)")
        }

        XCTAssertEqual(coord.state, .anonymous(userID: anonID),
                       "state must be restored to .anonymous so the chip can re-render in default state.")
        XCTAssertTrue(coord.state.isAnonymous,
                      "isAnonymous must still be true after a link failure.")
    }

    func testLinkAppleDetectsUserIDDriftFromSupabase() async {
        let anonID = UUID()
        let driftedID = UUID()
        let linker = StubAuthLinker()
        linker.result = .success(driftedID)  // server returns a DIFFERENT id

        let (coord, _) = makeCoordinator(linker: linker)
        coord._setStateForTesting(.anonymous(userID: anonID))

        do {
            _ = try await coord.linkApple(idToken: "stub.token", nonce: nil)
            XCTFail("expected linkApple to throw .userIDChanged")
        } catch let AuthCoordinator.LinkError.userIDChanged(before, after) {
            XCTAssertEqual(before, anonID)
            XCTAssertEqual(after, driftedID)
        } catch {
            XCTFail("expected .userIDChanged, got \(error)")
        }

        // State goes to .error rather than silently masking the drift.
        // The acceptance criterion "merge preserves user_id" can't be
        // satisfied if the server returns a fresh id — surface loudly.
        if case .error = coord.state {
            // expected
        } else {
            XCTFail("expected state to be .error after user_id drift; got \(coord.state)")
        }
    }

    func testLinkAppleOnAlreadyLinkedUserIsNoOpSuccess() async throws {
        let linkedID = UUID()
        let linker = StubAuthLinker()
        // The linker MUST NOT be called — caller is already linked.
        linker.result = .failure(StubError.network)

        let (coord, _) = makeCoordinator(linker: linker)
        coord._setStateForTesting(.linkedApple(userID: linkedID))

        let returned = try await coord.linkApple(idToken: "stub.token", nonce: nil)
        XCTAssertEqual(returned, linkedID)
        XCTAssertEqual(coord.state, .linkedApple(userID: linkedID))
        XCTAssertEqual(linker.callCount, 0,
                       "linker must not be called when the user is already linked.")
    }

    // MARK: - helpers

    /// Build an AuthCoordinator with a stub linker. The SupabaseClient
    /// is real (no good way to fully fake it without inheriting the
    /// whole SDK), but `ensureSignedIn` is never called in these
    /// tests — the state machine is driven via `forceState`.
    private func makeCoordinator(linker: any SupabaseAuthLinker) -> (AuthCoordinator, Any) {
        // A throwaway client whose URL/key are valid shapes but never
        // get hit. Constructed via the same SupabaseClient initializer
        // RoomStoreIntegrationTests uses; no network calls happen
        // unless the test explicitly invokes a method that needs one.
        let url = URL(string: "https://example.invalid")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "stub")
        let coord = AuthCoordinator(client: client, linker: linker)
        return (coord, client)
    }
}

// MARK: - test doubles

/// Stub linker — captures invocation and returns a canned result.
@MainActor
final class StubAuthLinker: SupabaseAuthLinker, @unchecked Sendable {
    enum Outcome {
        case success(UUID)
        case failure(Error)
    }

    var result: Outcome = .failure(StubError.unset)
    private(set) var callCount = 0
    private(set) var lastIdToken: String?
    private(set) var lastNonce: String?
    private(set) var lastUserID: UUID?

    func linkApple(idToken: String, nonce: String?, currentUserID: UUID) async throws -> UUID {
        callCount += 1
        lastIdToken = idToken
        lastNonce = nonce
        lastUserID = currentUserID
        switch result {
        case .success(let id):
            return id
        case .failure(let err):
            throw err
        }
    }
}

enum StubError: Error, Equatable {
    case unset
    case network
}

// The state-machine driver lives on AuthCoordinator itself —
// `_setStateForTesting` is internal and visible via `@testable`.
