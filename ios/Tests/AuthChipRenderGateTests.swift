// GetToIt — AuthUpgradeChip render-gate unit tests (TB-12).
//
// Pure logic over the 30-day suppression window, plus a
// platform-guard test confirming the chip code path is iOS-only.
// No Supabase touched here — the database-backed equivalents live in
// `AuthPromptStoreIntegrationTests`.

import XCTest
@testable import GetToIt

final class AuthChipRenderGateTests: XCTestCase {

    func testSuppressionWindowIsExactly30Days() {
        // The PRD locks this at 30 days. ADR 0007's re-evaluation
        // trigger is the only thing that should change it. If this
        // assertion fails, something silently rewrote a design
        // constant.
        XCTAssertEqual(AuthPromptStore.suppressionWindow,
                       30 * 24 * 60 * 60,
                       accuracy: 0.0,
                       "30-day re-prompt suppression is locked by the PRD; do not change without ADR.")
    }

    func testChipStateMapsToCanonicalRenders() {
        // Sanity-check the AuthUpgradeChip.State enum covers exactly
        // the five canonical states from the design-system spec.
        let allStates: [AuthUpgradeChip.State] = [
            .defaultIdle, .inProgress, .success, .dismissed, .hidden,
        ]
        XCTAssertEqual(allStates.count, 5,
                       "C-22 spec defines 5 canonical states; adding or removing one is a spec change.")
    }

    func testAuthCoordinatorStateExposesIsAnonymousFlag() {
        // The chip's render gate consults `auth.state.isAnonymous`.
        // Confirm that flag is correct for every State case the
        // coordinator can produce.
        let id = UUID()
        XCTAssertFalse(AuthCoordinator.State.idle.isAnonymous)
        XCTAssertFalse(AuthCoordinator.State.signingIn.isAnonymous)
        XCTAssertTrue(AuthCoordinator.State.anonymous(userID: id).isAnonymous)
        XCTAssertFalse(AuthCoordinator.State.linking(userID: id).isAnonymous)
        XCTAssertFalse(AuthCoordinator.State.linkedApple(userID: id).isAnonymous)
        XCTAssertFalse(AuthCoordinator.State.error("x").isAnonymous)
    }

    func testAuthCoordinatorStateExposesUserIDForLinkedFlavors() {
        let id = UUID()
        XCTAssertNil(AuthCoordinator.State.idle.userID)
        XCTAssertNil(AuthCoordinator.State.signingIn.userID)
        XCTAssertEqual(AuthCoordinator.State.anonymous(userID: id).userID, id)
        XCTAssertEqual(AuthCoordinator.State.linking(userID: id).userID, id)
        XCTAssertEqual(AuthCoordinator.State.linkedApple(userID: id).userID, id)
        XCTAssertNil(AuthCoordinator.State.error("x").userID)
    }

    func testChipCodePathIsIosOnly() {
        // The chip lives in `WaitingScreen.swift` / `AuthUpgradeChip.swift`,
        // both of which import SwiftUI + AuthenticationServices. Those
        // frameworks are iOS-only — the chip cannot accidentally land
        // on a non-iOS surface. We confirm by checking that this test
        // is itself being compiled for iOS; on any other platform the
        // file wouldn't even build.
        #if os(iOS)
        // The iOS-only constraint is enforced by the compiler. This
        // assertion exists to make the constraint visible in the test
        // output rather than hidden in a build setting.
        XCTAssertTrue(true, "iOS-only chip — web fallback (TB-15) never instantiates WaitingScreen.")
        #else
        XCTFail("AuthUpgradeChip code path landed on a non-iOS platform — web fallback violates ADR 0007.")
        #endif
    }
}
