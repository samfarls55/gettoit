// GetToIt — VerdictScreen `no-survivor` mode tests (TB-09).
//
// Same SwiftUI "smoke + spec snapshot" pattern as
// `VerdictScreenSnapshotTests` — we materialise the view through a
// UIHostingController to verify it lays out without crashing, then
// assert against the `ModeSnapshot` flags that lock the spec's
// visible / suppressed elements.
//
// The TB-09 contract on S05 `no-survivor`:
//   * Eyebrow `"Tonight"`, hero `"NO SPOT / FITS"` (stacked one word
//     per line), meta line surfaces surviving hard-needs.
//   * Time badge, voice receipts, cuts drawer all SUPPRESSED.
//   * Primary CTA `"Widen radius"` (initiator-only); inline-expansion
//     range slider 1..10 mi when tapped. Re-run commit fires
//     `onWidenRadius(_:)`.
//   * Secondary ghost `"Start over"` returns to S01.
//
// See `design-system/surfaces/05-verdict.md` §"no-survivor".

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class VerdictScreenNoSurvivorTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - body materialisation

    func testNoSurvivorModeRendersWithoutCrashing() {
        let verdict = VerdictScreen.Verdict.noSurvivorFixture()
        render(VerdictScreen(verdict: verdict, mode: .noSurvivor))
    }

    func testNoSurvivorModeRendersInitiatorAndInviteeVariants() {
        // Initiator sees the widen CTA; invitees see "Start over" only.
        let verdict = VerdictScreen.Verdict.noSurvivorFixture()
        render(VerdictScreen(verdict: verdict, mode: .noSurvivor, isInitiator: true))
        render(VerdictScreen(verdict: verdict, mode: .noSurvivor, isInitiator: false))
    }

    // MARK: - mode-flag contract

    func testNoSurvivorModeSuppressesTimeBadgeReceiptsAndCuts() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.noSurvivorFixture(),
            mode: .noSurvivor
        ).modeSnapshot

        XCTAssertFalse(snap.showTimeBadge,
            "no-survivor suppresses the time badge — there is no when/where to celebrate")
        XCTAssertFalse(snap.showReceipts,
            "no-survivor suppresses voice receipts — no verdict to receipt")
        XCTAssertFalse(snap.showCutsDrawer,
            "no-survivor suppresses the cuts drawer — the rule chip carries the load-bearing message")
    }

    func testNoSurvivorEyebrowIsTonightBare() {
        // Bare "Tonight" — no verb, no "the verdict is" promise.
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.noSurvivorFixture(),
            mode: .noSurvivor
        ).modeSnapshot
        XCTAssertEqual(snap.eyebrowCopy, "Tonight",
            "no-survivor eyebrow is bare 'Tonight' — there is no verdict to promise")
    }

    func testNoSurvivorPrimaryCtaIsWidenRadius() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.noSurvivorFixture(),
            mode: .noSurvivor
        ).modeSnapshot
        XCTAssertEqual(snap.primaryCtaLabel, "Widen radius",
            "no-survivor primary CTA is the verb-first 'Widen radius'")
        XCTAssertEqual(snap.secondaryLabel, "Start over",
            "no-survivor secondary ghost is 'Start over'")
    }

    // MARK: - hero stacking — "NO SPOT / FITS"

    func testNoSurvivorHeroIsStackedOneWordPerLine() {
        let lines = VerdictScreen.heroLines(for: "No spot fits")
        XCTAssertEqual(lines.count, 2, "no-survivor hero stacks to two lines")
        XCTAssertEqual(lines[0], "NO SPOT", "first line carries the leading two-word phrase")
        // The spec wants "NO SPOT / FITS" — the heroLines helper
        // collapses 3+ tokens to the leading word + the rest, so
        // hand-shape the no-survivor fixture to deliver the exact
        // two-line read.
        XCTAssertEqual(lines[1], "FITS")
    }

    func testNoSurvivorVerdictFixtureCarriesAggregateRuleCopy() {
        let verdict = VerdictScreen.Verdict.noSurvivorFixture()
        // Aggregate attribution — never names a person.
        XCTAssertFalse(verdict.ruleText.lowercased().contains("alex"),
            "rule_text must not name a person — aggregate attribution")
        XCTAssertFalse(verdict.ruleText.lowercased().contains("maya"))
        XCTAssertTrue(
            verdict.ruleText.lowercased().contains("no candidates") ||
            verdict.ruleText.lowercased().contains("left no") ||
            verdict.ruleText.lowercased().contains("no spot") ||
            verdict.ruleText.lowercased().contains("walking distance"),
            "rule_text must surface the failure in aggregate-rule register: \(verdict.ruleText)"
        )
    }

    // MARK: - widen-radius slider behavior

    func testWidenRadiusInitialValueIsCurrentPlusOneMile() {
        // S05 §"no-survivor" — "current value + 1.0 mi default".
        // With the default fixture radius of 2.0 mi, the slider
        // starts at 3.0 mi.
        let suggestion = VerdictScreen.widenRadiusInitialMiles(currentRadiusMeters: 3219) // 2.0 mi
        XCTAssertEqual(suggestion, 3.0, accuracy: 0.05,
            "widen slider opens at currentRadius + 1.0 mi")
    }

    func testWidenRadiusInitialValueClampedToTenMileMax() {
        // Already at 9.5 mi — the suggested next step (10.5 mi) must
        // clamp to the 10 mi product cap.
        let suggestion = VerdictScreen.widenRadiusInitialMiles(currentRadiusMeters: 15289) // 9.5 mi
        XCTAssertEqual(suggestion, 10.0, accuracy: 0.05,
            "widen slider suggestion clamps to 10.0 mi when current + 1.0 would exceed")
    }

    func testWidenRadiusRangeIsOneToTenMiles() {
        // Spec lock — 1..10 mi range, 0.5-mi step.
        XCTAssertEqual(VerdictScreen.widenRadiusMinMiles, 1.0, accuracy: 0.001)
        XCTAssertEqual(VerdictScreen.widenRadiusMaxMiles, 10.0, accuracy: 0.001)
        XCTAssertEqual(VerdictScreen.widenRadiusStepMiles, 0.5, accuracy: 0.001)
    }

    func testWidenRadiusCommitForwardsTheMeterValue() {
        // The widen commit must surface the slider value as METERS
        // (the engine talks meters). 3.5 mi = 5633 m.
        let meters = VerdictScreen.metersForMiles(3.5)
        XCTAssertEqual(meters, 5633,
            "3.5 mi converts to 5633 m for the engine call")
    }

    // MARK: - mode reveal compression (motion.md no-survivor block)

    func testNoSurvivorReducedRevealHidesTheTimeBadgeStep() {
        // The compressed reveal skips the time-badge beat (820ms in
        // the canonical choreo). The VerdictScreen `Choreo` constants
        // are shared across modes; the time-badge view is simply not
        // rendered. This test confirms the suppression flag drives
        // the layout decision, not the choreo timings.
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.noSurvivorFixture(),
            mode: .noSurvivor
        ).modeSnapshot
        XCTAssertFalse(snap.showTimeBadge)
    }
}
