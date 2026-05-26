// GetToIt — SignInScreen snapshot-style smoke tests (wfr-21).
//
// Same shape as `LocationPermissionScreenSnapshotTests` and the rest of
// the snapshot suites in this codebase: pixel snapshots aren't on the
// dependency graph; we verify the SwiftUI body materialises and that
// the spec-locked CTA treatments feed through unchanged.
//
// The wfr-21 acceptance bar is that the claim-code affordance ("Voted
// on the web?") renders as a clearly labeled secondary action — not as
// a quiet eyebrow text link buried under the Apple pill. The two
// renders covered:
//
//   * Apple-only render — the gate before reveal. Primary Apple pill +
//     a labeled secondary chip ("Voted on the web?") in the dock.
//   * Apple+claim render — the reveal expands the chip into the
//     soft-glass code-entry field + the "Bring my Plans over" submit.
//
// The CTA treatments are exposed as static spec data so a silent
// regression to "both render in the same pill style" trips the
// assertion here. The primary Apple pill is filled white; the claim
// reveal is a ghost pill (C-05 `ghost`) — transparent fill, white
// label, 1.5px white-0.5 inset stroke. Distinct visual weight, but
// still a labeled button, not an eyebrow link.

import XCTest
import SwiftUI
import Supabase
@testable import GetToIt

@MainActor
final class SignInScreenSnapshotTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - body materialisation

    func testAppleOnlyRendersWithoutCrashing() {
        let auth = makeCoordinator()
        let screen = SignInScreen(auth: auth)
        // Claim affordance is collapsed by default — this is the
        // "Apple-only" render of the surface.
        XCTAssertEqual(screen.claim.phase, .collapsed)
        render(screen)
    }

    func testAppleAndClaimRevealRendersWithoutCrashing() {
        let auth = makeCoordinator()
        let screen = SignInScreen(auth: auth)
        screen.onVotedOnTheWebTapped()
        // Claim affordance reveal — soft-glass code field + submit
        // pill in addition to the Apple pill.
        XCTAssertEqual(screen.claim.phase, .entry)
        render(screen)
    }

    // MARK: - copy locks (per 00a-signin.md)

    func testApplePillCopyMatchesSpec() {
        // Spec lock — see 00a-signin.md §"Copy register".
        XCTAssertEqual(SignInScreen.applePillLabel, "Save my taste profile")
    }

    func testClaimRevealCopyMatchesSpec() {
        // Spec lock — see 00a-signin.md §"Copy register".
        XCTAssertEqual(SignInScreen.claimRevealLabel, "Voted on the web?")
    }

    func testClaimSubmitCopyMatchesSpec() {
        // Spec lock — see 00a-signin.md §"Copy register".
        XCTAssertEqual(SignInScreen.claimSubmitLabel, "Bring my Plans over")
    }

    // MARK: - wfr-21 acceptance — claim affordance is a labeled secondary button

    func testApplePillUsesFilledPillTreatment() {
        // The primary affordance — filled white pill, the canonical
        // C-05 `white` variant.
        let treatment = SignInScreen.applePillTreatment
        XCTAssertEqual(treatment.style, SignInScreen.CtaStyle.filledPill)
        XCTAssertEqual(treatment.fill, SignInScreen.CtaFill.paper)
        XCTAssertEqual(treatment.foreground, SignInScreen.CtaForeground.ink)
    }

    func testClaimRevealUsesGhostPillTreatment() {
        // wfr-21: the claim affordance must render as a labeled
        // secondary BUTTON or CHIP — not a quiet eyebrow text link.
        // The C-05 `ghost` variant (transparent fill, white text,
        // 1.5px white-0.5 inset stroke) is the canonical secondary
        // pill in the design system; this is the treatment we lock.
        let treatment = SignInScreen.claimRevealTreatment
        XCTAssertEqual(treatment.style, SignInScreen.CtaStyle.ghostPill,
                       "wfr-21 — the claim affordance must read as a button, not an eyebrow link.")
        XCTAssertEqual(treatment.fill, SignInScreen.CtaFill.none)
        XCTAssertEqual(treatment.foreground, SignInScreen.CtaForeground.paper)
    }

    func testApplePillAndClaimRevealUseDistinctTreatments() {
        // The visual hierarchy is the whole point of wfr-21: the
        // primary Apple pill must read louder than the secondary
        // claim entry. If both ever resolve to the same style enum,
        // the surface has lost its hierarchy.
        let primary = SignInScreen.applePillTreatment
        let secondary = SignInScreen.claimRevealTreatment
        XCTAssertNotEqual(primary.style, secondary.style)
        XCTAssertNotEqual(primary.fill, secondary.fill)
        XCTAssertNotEqual(primary.foreground, secondary.foreground)
    }

    func testClaimRevealTreatmentIsNotATextLink() {
        // The pre-wfr-21 treatment was a `textLink` — an eyebrow-
        // token text link, deliberately quiet. wfr-21 promotes it to
        // a labeled button, so this assertion is the regression
        // guard against a silent revert.
        XCTAssertNotEqual(SignInScreen.claimRevealTreatment.style,
                          SignInScreen.CtaStyle.textLink,
                          "wfr-21 — the claim affordance must not regress to an eyebrow-text-link treatment.")
    }

    // MARK: - helpers

    private func makeCoordinator() -> AuthCoordinator {
        let url = URL(string: "https://example.invalid")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "stub")
        return AuthCoordinator(client: client, claimRedeemer: StubClaimCodeRedeemer())
    }
}
