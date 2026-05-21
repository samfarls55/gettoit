// GetToIt — AuthCoordinator.redeemClaimCode unit tests (tb-WF-14).
//
// Covers the state-machine contract of the web-invitee account-claim
// REDEEM path WITHOUT a live Supabase round-trip. tb-WF-14 / ADR 0015:
// a Web invitee on S00a types a claim code; redeeming it installs the
// carried anonymous session into the app keychain and the coordinator
// must reach `.anonymous(userID:)` so the subsequent Sign-in-with-Apple
// tap routes through `linkApple` (preserving `user_id`).
//
// Test seam:
//   * `ClaimCodeRedeemer` — injected via
//     `AuthCoordinator(claimRedeemer:)`. The live impl invokes the
//     `redeem-claim-code` Edge Function and installs the returned
//     refresh token into the keychain; the stub drives the success /
//     failure paths deterministically.
//
// Cases:
//   1. redeem success → state transitions to `.anonymous(carriedID)`.
//      The carried web identity is now the app identity.
//   2. redeem of a bad / expired / used code → the redeemer throws;
//      the coordinator stays `.idle` (nothing was installed) and the
//      error is rethrown so S00a can show a retryable inline error.
//   3. the carried user_id surfaced by `redeemClaimCode` equals the
//      one the redeemer resolved — the bridge must not swap identities.
//   4. redeem while already linked / already anonymous is rejected —
//      the claim is a fresh-install before-sign-in affordance only.

import XCTest
import Foundation
import Supabase
@testable import GetToIt

@MainActor
final class AuthCoordinatorRedeemClaimCodeTests: XCTestCase {

    func testRedeemSuccessReachesAnonymousWithCarriedUserID() async throws {
        let carriedID = UUID()
        let redeemer = StubClaimCodeRedeemer()
        redeemer.result = .success(carriedID)

        let coord = makeCoordinator(claimRedeemer: redeemer)
        XCTAssertEqual(coord.state, .idle, "precondition — S00a gate state.")

        let returned = try await coord.redeemClaimCode("ABCD2345")

        XCTAssertEqual(returned, carriedID,
                       "redeemClaimCode must return the carried anonymous user_id.")
        XCTAssertEqual(coord.state, .anonymous(userID: carriedID),
                       "a successful redeem must land the coordinator in .anonymous so the Apple tap becomes linkApple.")
        XCTAssertTrue(coord.state.isAnonymous,
                      "the carried identity is anonymous until the user links Apple.")
        XCTAssertEqual(redeemer.lastCode, "ABCD2345",
                       "the typed code must reach the redeemer verbatim.")
        XCTAssertEqual(redeemer.callCount, 1)
    }

    func testRedeemFailureLeavesCoordinatorIdleAndRethrows() async {
        let redeemer = StubClaimCodeRedeemer()
        redeemer.result = .failure(ClaimCodeRedeemError.codeNotFound)

        let coord = makeCoordinator(claimRedeemer: redeemer)

        do {
            _ = try await coord.redeemClaimCode("BADCODE9")
            XCTFail("expected redeemClaimCode to rethrow a redeem failure")
        } catch ClaimCodeRedeemError.codeNotFound {
            // expected
        } catch {
            XCTFail("expected .codeNotFound, got \(error)")
        }

        XCTAssertEqual(coord.state, .idle,
                       "a failed redeem must NOT change auth state — nothing was installed, S00a stays on the gate for a retry.")
    }

    func testRedeemExpiredCodeRethrowsAndDoesNotDestroyState() async {
        let redeemer = StubClaimCodeRedeemer()
        redeemer.result = .failure(ClaimCodeRedeemError.codeExpired)

        let coord = makeCoordinator(claimRedeemer: redeemer)

        do {
            _ = try await coord.redeemClaimCode("EXPIRED2")
            XCTFail("expected an expired-code redeem to throw")
        } catch ClaimCodeRedeemError.codeExpired {
            // expected
        } catch {
            XCTFail("expected .codeExpired, got \(error)")
        }
        XCTAssertEqual(coord.state, .idle,
                       "an expired code is a recoverable error — state is untouched.")
    }

    func testRedeemAlreadyRedeemedCodeRethrows() async {
        let redeemer = StubClaimCodeRedeemer()
        redeemer.result = .failure(ClaimCodeRedeemError.codeAlreadyRedeemed)

        let coord = makeCoordinator(claimRedeemer: redeemer)

        do {
            _ = try await coord.redeemClaimCode("USEDCD23")
            XCTFail("expected a double-redeem to throw")
        } catch ClaimCodeRedeemError.codeAlreadyRedeemed {
            // expected
        } catch {
            XCTFail("expected .codeAlreadyRedeemed, got \(error)")
        }
        XCTAssertEqual(coord.state, .idle)
    }

    func testRedeemRejectedWhenAlreadyLinkedApple() async {
        let redeemer = StubClaimCodeRedeemer()
        redeemer.result = .success(UUID())

        let coord = makeCoordinator(claimRedeemer: redeemer)
        coord._setStateForTesting(.linkedApple(userID: UUID()))

        do {
            _ = try await coord.redeemClaimCode("ABCD2345")
            XCTFail("expected a redeem on a linked session to be rejected")
        } catch AuthCoordinator.ClaimError.notClaimable {
            // expected — the claim is before-sign-in only (ADR 0015).
        } catch {
            XCTFail("expected .notClaimable, got \(error)")
        }
        XCTAssertEqual(redeemer.callCount, 0,
                       "the redeemer must not be invoked when the session is already linked.")
    }

    func testRedeemRejectedWhenAlreadyAnonymous() async {
        // A session already exists — there is nothing to claim onto. The
        // S00a affordance only renders on a fresh-install .idle gate.
        let redeemer = StubClaimCodeRedeemer()
        redeemer.result = .success(UUID())

        let coord = makeCoordinator(claimRedeemer: redeemer)
        coord._setStateForTesting(.anonymous(userID: UUID()))

        do {
            _ = try await coord.redeemClaimCode("ABCD2345")
            XCTFail("expected a redeem on an existing anonymous session to be rejected")
        } catch AuthCoordinator.ClaimError.notClaimable {
            // expected
        } catch {
            XCTFail("expected .notClaimable, got \(error)")
        }
        XCTAssertEqual(redeemer.callCount, 0)
    }

    // MARK: - helpers

    private func makeCoordinator(
        claimRedeemer: any ClaimCodeRedeemer
    ) -> AuthCoordinator {
        let url = URL(string: "https://example.invalid")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "stub")
        return AuthCoordinator(client: client, claimRedeemer: claimRedeemer)
    }
}

// MARK: - test double

/// Stub redeemer — captures the typed code and returns a canned result.
/// Stands in for `LiveClaimCodeRedeemer`, which would invoke the
/// `redeem-claim-code` Edge Function and install the session.
@MainActor
final class StubClaimCodeRedeemer: ClaimCodeRedeemer, @unchecked Sendable {
    enum Outcome {
        case success(UUID)
        case failure(Error)
    }

    var result: Outcome = .failure(StubError.unset)
    private(set) var callCount = 0
    private(set) var lastCode: String?

    func redeem(code: String) async throws -> UUID {
        callCount += 1
        lastCode = code
        switch result {
        case .success(let id):
            return id
        case .failure(let err):
            throw err
        }
    }
}
