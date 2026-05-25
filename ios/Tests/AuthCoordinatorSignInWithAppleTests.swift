// GetToIt — AuthCoordinator.signInWithApple unit tests (TB-02 quiz redesign).
//
// Covers the state-machine contract of the forced-sign-in gate
// (S00a) without requiring a real Apple identity token. The actual
// network round-trip against Supabase is verified manually on
// TestFlight per the quiz-redesign acceptance plan — CI can't mint a sandbox
// Apple idToken.
//
// Test seams:
//   * `StubAuthLinker` — shared with AuthCoordinatorLinkAppleTests.
//     `signInResult` drives the signInWithApple success / failure
//     paths independently of the link result.
//
// Cases:
//   1. signInWithApple from `.idle` → state transitions to
//      `.linkedApple(returnedID)` and the coordinator surfaces the
//      same id.
//   2. signInWithApple while in `.error` is allowed (retry from the
//      gate after a failed first attempt) — state transitions to
//      `.linkedApple(returnedID)`.
//   3. signInWithApple while in `.anonymous` throws
//      `.haveAnonymousSession` and does NOT touch the linker — the
//      caller should use `linkApple` to preserve the id.
//   4. signInWithApple while already `.linkedApple` is a no-op
//      success returning the existing id, with no linker call.
//   5. signInWithApple where the linker throws → state becomes
//      `.error`, error rethrown so the SignInScreen can re-enable.

import XCTest
import Foundation
import Supabase
@testable import GetToIt

@MainActor
final class AuthCoordinatorSignInWithAppleTests: XCTestCase {

    func testSignInWithAppleFromIdleSetsLinkedAppleState() async throws {
        let returnedID = UUID()
        let linker = StubAuthLinker()
        linker.signInResult = .success(returnedID)

        let coord = makeCoordinator(linker: linker)
        XCTAssertEqual(coord.state, .idle)

        let id = try await coord.signInWithApple(idToken: "stub.token", nonce: "abc")

        XCTAssertEqual(id, returnedID)
        XCTAssertEqual(coord.state, .linkedApple(userID: returnedID))
        XCTAssertEqual(linker.signInCallCount, 1)
        XCTAssertEqual(linker.lastIdToken, "stub.token")
        XCTAssertEqual(linker.lastNonce, "abc")
    }

    func testSignInWithAppleFromErrorRetriesAndSucceeds() async throws {
        let returnedID = UUID()
        let linker = StubAuthLinker()
        linker.signInResult = .success(returnedID)

        let coord = makeCoordinator(linker: linker)
        coord._setStateForTesting(.error("transient"))

        let id = try await coord.signInWithApple(idToken: "stub.token", nonce: nil)

        XCTAssertEqual(id, returnedID)
        XCTAssertEqual(coord.state, .linkedApple(userID: returnedID))
        XCTAssertEqual(linker.signInCallCount, 1)
    }

    func testSignInWithAppleRejectsExistingAnonymousSession() async {
        let anonID = UUID()
        let linker = StubAuthLinker()
        linker.signInResult = .success(UUID())

        let coord = makeCoordinator(linker: linker)
        coord._setStateForTesting(.anonymous(userID: anonID))

        do {
            _ = try await coord.signInWithApple(idToken: "stub.token", nonce: nil)
            XCTFail("expected signInWithApple to throw on an existing anonymous session")
        } catch AuthCoordinator.SignInError.haveAnonymousSession {
            // expected — callers should use linkApple to preserve the id.
        } catch {
            XCTFail("expected .haveAnonymousSession, got \(error)")
        }

        XCTAssertEqual(coord.state, .anonymous(userID: anonID),
                       "state must stay .anonymous when sign-in is rejected.")
        XCTAssertEqual(linker.signInCallCount, 0,
                       "linker must not be called when sign-in is rejected.")
    }

    func testSignInWithAppleOnAlreadyLinkedUserIsNoOpSuccess() async throws {
        let linkedID = UUID()
        let linker = StubAuthLinker()
        // Linker MUST NOT be called — caller is already linked.
        linker.signInResult = .failure(StubError.network)

        let coord = makeCoordinator(linker: linker)
        coord._setStateForTesting(.linkedApple(userID: linkedID))

        let id = try await coord.signInWithApple(idToken: "stub.token", nonce: nil)
        XCTAssertEqual(id, linkedID)
        XCTAssertEqual(coord.state, .linkedApple(userID: linkedID))
        XCTAssertEqual(linker.signInCallCount, 0,
                       "linker must not be called when the user is already linked.")
    }

    func testSignInWithAppleSurfacesLinkerErrorAndStateBecomesError() async {
        let linker = StubAuthLinker()
        linker.signInResult = .failure(StubError.network)

        let coord = makeCoordinator(linker: linker)
        XCTAssertEqual(coord.state, .idle)

        do {
            _ = try await coord.signInWithApple(idToken: "stub.token", nonce: nil)
            XCTFail("expected signInWithApple to rethrow the linker error")
        } catch StubError.network {
            // expected
        } catch {
            XCTFail("expected StubError.network, got \(error)")
        }

        if case .error = coord.state {
            // expected — surface loudly so the SignInScreen can re-enable.
        } else {
            XCTFail("expected state to be .error after a linker failure; got \(coord.state)")
        }
        XCTAssertEqual(linker.signInCallCount, 1)
    }

    // MARK: - helpers

    private func makeCoordinator(linker: any SupabaseAuthLinker) -> AuthCoordinator {
        let url = URL(string: "https://example.invalid")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "stub")
        return AuthCoordinator(client: client, linker: linker)
    }
}
