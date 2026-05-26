// GetToIt — NoSurvivorScreen tests (bug-34 / ADR 0018).
//
// Lifted from `VerdictScreenNoSurvivorTests.swift`. ADR 0018 split the
// no-survivor surface out of the 5-mode `VerdictScreen` into its own
// single-intent `NoSurvivorScreen`. The contract is:
//
//   * No eyebrow / hero / time-badge / receipts shell — this is NOT a
//     verdict surface (no decision to celebrate).
//   * Renders the no-survivor copy, the inline range slider (1..10 mi,
//     0.5-mi step), and a `Re-run · N.N mi` primary CTA when expanded;
//     collapsed CTA reads `Widen radius`.
//   * Initiator-only primary CTA. Non-initiators see only Home chrome.
//   * Home chrome always present (Plan-list is reachable; this is the
//     initiator's surface).
//   * Reroll burns NOT consumed by the widen action — the widen is
//     free; only post-verdict reroll consumes a burn.
//
// See `design-system/surfaces/05b-no-survivor.md`.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class NoSurvivorScreenTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - body materialisation

    func testRendersWithoutCrashingAsInitiator() {
        let verdict = VerdictScreen.Verdict.noSurvivorFixture()
        render(NoSurvivorScreen(verdict: verdict, isInitiator: true))
    }

    func testRendersWithoutCrashingAsNonInitiator() {
        // Non-initiators see only the Home chrome — the Widen radius
        // CTA is suppressed (initiator-only per spec).
        let verdict = VerdictScreen.Verdict.noSurvivorFixture()
        render(NoSurvivorScreen(verdict: verdict, isInitiator: false))
    }

    // MARK: - hero stacking — "NO SPOT / FITS"

    func testHeroIsStackedNoSpotFits() {
        // The hero reads NO SPOT / FITS — one word per line per the
        // S05b spec. The static helper produces the canonical stack
        // independent of the input placeName.
        let lines = NoSurvivorScreen.heroLines
        XCTAssertEqual(lines, ["NO SPOT", "FITS"])
    }

    // MARK: - eyebrow

    func testEyebrowCopyIsTonightBare() {
        XCTAssertEqual(NoSurvivorScreen.eyebrowCopy, "Tonight",
            "no-survivor eyebrow is bare 'Tonight' — there is no verdict to promise")
    }

    // MARK: - widen-radius slider behavior (pure, lifted)

    func testWidenRadiusInitialValueIsCurrentPlusOneMile() {
        // 2.0 mi current radius → 3.0 mi suggestion.
        let suggestion = NoSurvivorScreen.widenRadiusInitialMiles(currentRadiusMeters: 3219)
        XCTAssertEqual(suggestion, 3.0, accuracy: 0.05)
    }

    func testWidenRadiusInitialValueClampedToTenMileMax() {
        let suggestion = NoSurvivorScreen.widenRadiusInitialMiles(currentRadiusMeters: 15289)
        XCTAssertEqual(suggestion, 10.0, accuracy: 0.05)
    }

    func testWidenRadiusRangeIsOneToTenMiles() {
        XCTAssertEqual(NoSurvivorScreen.widenRadiusMinMiles, 1.0, accuracy: 0.001)
        XCTAssertEqual(NoSurvivorScreen.widenRadiusMaxMiles, 10.0, accuracy: 0.001)
        XCTAssertEqual(NoSurvivorScreen.widenRadiusStepMiles, 0.5, accuracy: 0.001)
    }

    func testWidenRadiusCommitForwardsTheMeterValue() {
        let meters = NoSurvivorScreen.metersForMiles(3.5)
        XCTAssertEqual(meters, 5633)
    }

    // MARK: - closure plumbing

    func testInitDoesNotAutoFireOnWidenRadius() {
        var widenCalls = 0
        _ = NoSurvivorScreen(
            verdict: VerdictScreen.Verdict.noSurvivorFixture(),
            isInitiator: true,
            onWidenRadius: { _ in widenCalls += 1 }
        )
        XCTAssertEqual(widenCalls, 0,
            "init must not auto-fire the widen-radius closure")
    }

    func testInitDoesNotAutoFireOnHome() {
        var homeCalls = 0
        _ = NoSurvivorScreen(
            verdict: VerdictScreen.Verdict.noSurvivorFixture(),
            isInitiator: false,
            onHome: { homeCalls += 1 }
        )
        XCTAssertEqual(homeCalls, 0,
            "init must not auto-fire the Home closure")
    }

    // MARK: - aggregate-rule register

    func testFixtureRuleTextUsesAggregateAttribution() {
        let verdict = VerdictScreen.Verdict.noSurvivorFixture()
        XCTAssertFalse(verdict.ruleText.lowercased().contains("alex"))
        XCTAssertFalse(verdict.ruleText.lowercased().contains("maya"))
    }
}
