// GetToIt — SignInScreen tap-dispatch unit tests (bug-06 v1.1).
//
// Covers the conditional dispatch in `SignInScreen.onSaveTapped`:
//   * `.idle`      → `AuthCoordinator.signInWithApple`
//   * `.anonymous` → `AuthCoordinator.linkApple`
// Both branches accept the same Apple credential shape; only the
// dispatch differs. The Apple sheet is faked via the existing
// `AppleSignInProviding` injection seam, and the Supabase round-trip
// is faked via the same `StubAuthLinker` used by the AuthCoordinator
// tests.
//
// No SwiftUI body is rendered — we invoke `onSaveTapped` directly.
// What the test verifies is the dispatch, not the surface motion or
// gradient stop (those are covered by the surface doc / snapshot
// tests when iOS gets a host harness).

import XCTest
import Foundation
import Supabase
@testable import GetToIt

@MainActor
final class SignInScreenTests: XCTestCase {

    func testTapFromIdleInvokesSignInWithApple() async throws {
        let returnedID = UUID()
        let linker = StubAuthLinker()
        linker.signInResult = .success(returnedID)
        let auth = makeCoordinator(linker: linker)
        // Default state is .idle — confirm the precondition rather
        // than rely on initialization.
        XCTAssertEqual(auth.state, .idle)

        var onSignedInCalls = 0
        let provider = StubAppleProvider(credential: AppleSignInCredential(
            idToken: "stub.idtoken.idle",
            nonce: "nonce-idle"
        ))
        let screen = SignInScreen(
            auth: auth,
            appleProvider: provider,
            onSignedIn: { onSignedInCalls += 1 }
        )

        await screen.onSaveTapped()

        XCTAssertEqual(linker.signInCallCount, 1,
                       ".idle must dispatch to signInWithApple, not linkApple.")
        XCTAssertEqual(linker.callCount, 0,
                       ".idle must NOT call linkApple — there is no prior user_id to preserve.")
        XCTAssertEqual(linker.lastIdToken, "stub.idtoken.idle")
        XCTAssertEqual(linker.lastNonce, "nonce-idle")
        XCTAssertEqual(auth.state, .linkedApple(userID: returnedID),
                       "coordinator must transition to .linkedApple on a successful gate clearance.")
        XCTAssertEqual(onSignedInCalls, 1,
                       "onSignedIn must fire once so RootView can route to S00 Landing.")
    }

    func testTapFromAnonymousInvokesLinkApple() async throws {
        let anonID = UUID()
        let linker = StubAuthLinker()
        // linkApple must return the SAME id (merge invariant); the
        // sign-in path is wired to a distinct failure so a stray call
        // would surface loudly.
        linker.result = .success(anonID)
        linker.signInResult = .failure(StubError.network)

        let auth = makeCoordinator(linker: linker)
        auth._setStateForTesting(.anonymous(userID: anonID))

        var onSignedInCalls = 0
        let provider = StubAppleProvider(credential: AppleSignInCredential(
            idToken: "stub.idtoken.anon",
            nonce: "nonce-anon"
        ))
        let screen = SignInScreen(
            auth: auth,
            appleProvider: provider,
            onSignedIn: { onSignedInCalls += 1 }
        )

        await screen.onSaveTapped()

        XCTAssertEqual(linker.callCount, 1,
                       ".anonymous must dispatch to linkApple to preserve user_id.")
        XCTAssertEqual(linker.signInCallCount, 0,
                       ".anonymous must NOT call signInWithApple — it would refuse with .haveAnonymousSession anyway, but the screen shouldn't even reach that guard.")
        XCTAssertEqual(linker.lastIdToken, "stub.idtoken.anon")
        XCTAssertEqual(linker.lastNonce, "nonce-anon")
        XCTAssertEqual(linker.lastUserID, anonID,
                       "linker must receive the prior anonymous user_id so the auth server can attach the Apple identity to the existing row.")
        XCTAssertEqual(auth.state, .linkedApple(userID: anonID),
                       "linkApple must preserve the user_id end-to-end; coordinator must surface that as .linkedApple(sameID).")
        XCTAssertEqual(onSignedInCalls, 1)
    }

    func testCancelledAppleFlowDoesNotTouchAnyAuthMethod() async {
        let linker = StubAuthLinker()
        // Both knobs wired to fail loudly so a stray dispatch is
        // caught.
        linker.signInResult = .failure(StubError.network)
        linker.result = .failure(StubError.network)

        let auth = makeCoordinator(linker: linker)
        let provider = StubAppleProvider(error: CancellationError())
        let screen = SignInScreen(
            auth: auth,
            appleProvider: provider,
            onSignedIn: { XCTFail("onSignedIn must not fire on user-cancel.") }
        )

        await screen.onSaveTapped()

        XCTAssertEqual(linker.signInCallCount, 0,
                       "user cancel must not invoke signInWithApple.")
        XCTAssertEqual(linker.callCount, 0,
                       "user cancel must not invoke linkApple.")
        XCTAssertEqual(auth.state, .idle,
                       "state must stay .idle when the Apple flow is cancelled before the coordinator is hit.")
    }

    // MARK: - helpers

    private func makeCoordinator(linker: any SupabaseAuthLinker) -> AuthCoordinator {
        let url = URL(string: "https://example.invalid")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "stub")
        return AuthCoordinator(client: client, linker: linker)
    }
}

// MARK: - test doubles

/// Returns a canned `AppleSignInCredential` or throws a canned error.
/// Mirrors the same shape as `WaitingScreenSnapshotTests.StubAppleProvider`
/// but lives here to avoid cross-test-file coupling.
@MainActor
private final class StubAppleProvider: AppleSignInProviding {
    private let credential: AppleSignInCredential?
    private let error: Error?

    init(credential: AppleSignInCredential) {
        self.credential = credential
        self.error = nil
    }

    init(error: Error) {
        self.credential = nil
        self.error = error
    }

    func requestAppleCredential() async throws -> AppleSignInCredential {
        if let error { throw error }
        return credential!
    }
}
