// GetToIt — SignInScreen "Voted on the web?" account-claim tests (tb-WF-14).
//
// Covers the S00a code-entry affordance from the sg-WF-8 design-system
// spec (design-system/surfaces/00a-signin.md §"Voted on the web?").
// The visual layer is spec'd there; this exercises the WIRING:
//   * tapping "Voted on the web?" reveals the code-entry state.
//   * submitting a valid code drives `AuthCoordinator.redeemClaimCode`,
//     after which the coordinator is `.anonymous` — so a subsequent
//     Apple tap routes through `linkApple` (covered by the existing
//     SignInScreenTests `.anonymous` case).
//   * a bad / expired / used code surfaces a visible, retryable inline
//     error and leaves the field open — nothing is destroyed.
//   * the submit is a no-op for an empty / whitespace-only field.
//
// The affordance state lives in an `@Observable` `ClaimAffordanceModel`
// (lifted out of `SignInScreen` precisely so it is unit-testable — a
// SwiftUI `@State` value-type property does not persist outside a
// render). The tests drive `screen.claim` directly, mirroring how the
// existing `AuthCoordinator` tests drive the coordinator.

import XCTest
import Foundation
import Supabase
@testable import GetToIt

@MainActor
final class SignInScreenClaimCodeTests: XCTestCase {

    func testTappingVotedOnTheWebRevealsTheCodeEntryState() {
        let screen = makeScreen(redeemer: StubClaimCodeRedeemer())
        XCTAssertEqual(screen.claim.phase, .collapsed,
                       "the affordance starts collapsed — a fresh-install user ignores it without friction.")

        screen.onVotedOnTheWebTapped()

        XCTAssertEqual(screen.claim.phase, .entry,
                       "tapping 'Voted on the web?' must reveal the inline code-entry state.")
    }

    func testSubmittingAValidCodeRedeemsAndReachesAnonymous() async {
        let carriedID = UUID()
        let redeemer = StubClaimCodeRedeemer()
        redeemer.result = .success(carriedID)
        let auth = makeCoordinator(redeemer: redeemer)
        let screen = makeScreen(auth: auth, redeemer: redeemer)

        screen.onVotedOnTheWebTapped()
        screen.claim.code = "ABCD2345"
        await screen.onBringMyPlansOverTapped()

        XCTAssertEqual(redeemer.lastCode, "ABCD2345",
                       "the typed code must reach the redeemer.")
        XCTAssertEqual(auth.state, .anonymous(userID: carriedID),
                       "a successful claim must land the coordinator in .anonymous so the Apple tap becomes linkApple.")
        XCTAssertNil(screen.claim.errorMessage,
                     "a successful redeem must clear any prior error.")
    }

    func testSubmittingABadCodeShowsARetryableInlineError() async {
        let redeemer = StubClaimCodeRedeemer()
        redeemer.result = .failure(ClaimCodeRedeemError.codeNotFound)
        let auth = makeCoordinator(redeemer: redeemer)
        let screen = makeScreen(auth: auth, redeemer: redeemer)

        screen.onVotedOnTheWebTapped()
        screen.claim.code = "WRONGCD2"
        await screen.onBringMyPlansOverTapped()

        XCTAssertEqual(
            screen.claim.errorMessage,
            "That code didn't work. Generate a fresh one from your web link.",
            "a bad code must surface the locked sg-WF-8 inline-error copy.")
        XCTAssertEqual(screen.claim.phase, .entry,
                       "the code-entry state must stay open so the user can retry.")
        XCTAssertEqual(auth.state, .idle,
                       "a failed redeem must not change auth state — nothing is destroyed.")
    }

    func testSubmittingAnExpiredCodeShowsTheSameRetryableError() async {
        let redeemer = StubClaimCodeRedeemer()
        redeemer.result = .failure(ClaimCodeRedeemError.codeExpired)
        let auth = makeCoordinator(redeemer: redeemer)
        let screen = makeScreen(auth: auth, redeemer: redeemer)

        screen.onVotedOnTheWebTapped()
        screen.claim.code = "EXPIRED2"
        await screen.onBringMyPlansOverTapped()

        XCTAssertEqual(
            screen.claim.errorMessage,
            "That code didn't work. Generate a fresh one from your web link.")
        XCTAssertEqual(screen.claim.phase, .entry)
    }

    func testEmptyCodeSubmitIsANoOp() async {
        let redeemer = StubClaimCodeRedeemer()
        redeemer.result = .success(UUID())
        let auth = makeCoordinator(redeemer: redeemer)
        let screen = makeScreen(auth: auth, redeemer: redeemer)

        screen.onVotedOnTheWebTapped()
        screen.claim.code = "   "
        await screen.onBringMyPlansOverTapped()

        XCTAssertEqual(redeemer.callCount, 0,
                       "an empty / whitespace-only field must not invoke the redeemer.")
        XCTAssertEqual(auth.state, .idle)
    }

    func testRetryAfterAFailureClearsTheStaleError() async {
        let redeemer = StubClaimCodeRedeemer()
        let auth = makeCoordinator(redeemer: redeemer)
        let screen = makeScreen(auth: auth, redeemer: redeemer)

        screen.onVotedOnTheWebTapped()

        // First attempt fails.
        redeemer.result = .failure(ClaimCodeRedeemError.codeNotFound)
        screen.claim.code = "WRONGCD2"
        await screen.onBringMyPlansOverTapped()
        XCTAssertNotNil(screen.claim.errorMessage)

        // Second attempt with a good code succeeds — the stale error
        // line must clear.
        let carriedID = UUID()
        redeemer.result = .success(carriedID)
        screen.claim.code = "ABCD2345"
        await screen.onBringMyPlansOverTapped()
        XCTAssertNil(screen.claim.errorMessage,
                     "a successful retry must clear the stale error.")
        XCTAssertEqual(auth.state, .anonymous(userID: carriedID))
    }

    // MARK: - helpers

    private func makeCoordinator(
        redeemer: any ClaimCodeRedeemer
    ) -> AuthCoordinator {
        let url = URL(string: "https://example.invalid")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "stub")
        return AuthCoordinator(client: client, claimRedeemer: redeemer)
    }

    private func makeScreen(
        auth: AuthCoordinator? = nil,
        redeemer: any ClaimCodeRedeemer
    ) -> SignInScreen {
        let coordinator = auth ?? makeCoordinator(redeemer: redeemer)
        return SignInScreen(auth: coordinator)
    }
}
