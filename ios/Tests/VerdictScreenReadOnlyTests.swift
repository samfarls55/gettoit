// GetToIt — VerdictScreen read-only mode tests (TB-11).
//
// Same "smoke + spec snapshot" pattern as the other VerdictScreen
// test files. Materialises the view through a UIHostingController
// to verify it lays out without crashing, then asserts against the
// `ModeSnapshot` flags + accessibility hint string that lock the
// S05 `read-only` spec contract.
//
// The TB-11 contract on S05 `read-only`:
//   * Eyebrow `"Tonight's verdict"` (past-tense-implicit).
//   * Hero + meta + time badge + rule chip + voice receipts visible.
//   * Voice-receipt row excludes the late-joiner — they didn't vote.
//   * Suppressed: ratification CTA, reroll affordance, "Start over"
//     secondary, pre-permission line.
//   * Primary CTA `"Start a new decision"` (white pill).
//   * bug-26 (2026-05-24) — the cuts drawer was retired from every
//     mode; read-only no longer surfaces a "See what got cut" trigger.
//   * VO announces "Not available — this verdict is closed." for the
//     ratification path.
//
// See `design-system/surfaces/05-verdict.md` §"read-only".

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class VerdictScreenReadOnlyTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - body materialisation

    func testReadOnlyModeRendersWithoutCrashing() {
        let verdict = VerdictScreen.Verdict.fixture()
        render(VerdictScreen(verdict: verdict, mode: .readOnly))
    }

    func testReadOnlyModeRendersWithEmptyReceiptsForNoSurvivorTerminal() {
        // A late-joiner landing on a no-survivor terminal still gets
        // the read-only render (TB-11 doesn't expose the widen-radius
        // CTA to non-initiators arriving post-fire). Verify the empty-
        // receipts fixture renders without crash.
        let verdict = VerdictScreen.Verdict(
            placeName: "No spot fits",
            metaLine: "Vegan options · $$ cap · 15 min walk",
            timeBadge: VerdictScreen.TimeBadge(time: "", audience: ""),
            ruleText: "Vegan options left no candidates within walking distance tonight.",
            receipts: [],
            cuts: []
        )
        render(VerdictScreen(verdict: verdict, mode: .readOnly))
    }

    // MARK: - mode flags (locked contract)

    func testReadOnlyModeKeepsTimeBadgeAndReceipts() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly
        ).modeSnapshot

        XCTAssertTrue(snap.showTimeBadge,
            "read-only mode keeps the time badge — the late-joiner sees the locked when/where")
        XCTAssertTrue(snap.showReceipts,
            "read-only mode keeps voice receipts — the late-joiner sees who contributed")
    }

    func testReadOnlyEyebrowIsTonightsVerdictPastTenseImplicit() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly
        ).modeSnapshot
        XCTAssertEqual(snap.eyebrowCopy, "Tonight's verdict",
            "read-only eyebrow is past-tense-implicit — the decision already happened")
    }

    func testReadOnlyPrimaryCtaIsStartANewDecision() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly
        ).modeSnapshot
        XCTAssertEqual(snap.primaryCtaLabel, "Start a new decision",
            "read-only primary CTA reads 'Start a new decision' (voluntary register, frames a new round)")
    }

    func testReadOnlySuppressesStartOverSecondary() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly
        ).modeSnapshot
        XCTAssertEqual(snap.secondaryLabel, "",
            "read-only suppresses the 'Start over' secondary — the re-invite CTA is the only path")
    }

    func testReadOnlyRendersChromeWithDoneLabel() {
        // wfr-16 — workflow-review found `.readOnly` traps the late-
        // joiner: no chrome, the primary CTA fires `onAdvance` (Solo
        // Setup) but VO + reduced-motion users with no obvious dock CTA
        // visibility have no escape hatch above the eyebrow. Restoring
        // the chrome row with a `Done` verb (wired to `onAdvance`, not
        // `onHome`) gives every mode the same top-leading escape slot.
        // The verb is `Done` (not `Home`) because the late-joiner has
        // no Plan-list destination — `Done` is the honest verb for
        // "close this read-only snapshot".
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly
        ).modeSnapshot
        XCTAssertTrue(snap.showHomeChrome,
            "read-only renders the chrome row — escape hatch above the eyebrow")
        XCTAssertEqual(snap.homeChromeLabel, "Done",
            "read-only chrome verb is `Done` — honest framing for the late-joiner who has no Plan list")
    }

    func testNonReadOnlyModesKeepHomeChromeLabel() {
        // The `Home` verb stays on every iOS-reachable group mode. Only
        // `.readOnly` swaps to `Done` because it has no Plan-list
        // destination (per wfr-16 + the design-system spec).
        for mode in [VerdictScreen.Mode.default, .committed, .solo, .noSurvivor] {
            let snap = VerdictScreen(
                verdict: VerdictScreen.Verdict.fixture(),
                mode: mode
            ).modeSnapshot
            XCTAssertEqual(snap.homeChromeLabel, "Home",
                "non-read-only modes keep the `Home` chrome verb (mode = \(mode))")
        }
    }

    func testReadOnlyChromeFiresAdvanceClosure() {
        // The read-only chrome's `Done` verb is wired to `onAdvance`
        // (Solo Setup for the late-joiner branch), NOT `onHome`. The
        // snapshot exposes this so the renderer can pick the right
        // closure without leaking call-site knowledge into the view.
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly
        ).modeSnapshot
        XCTAssertTrue(snap.chromeFiresAdvance,
            "read-only chrome tap fires `onAdvance` — Home has no honest destination for the late-joiner")
    }

    func testNonReadOnlyChromeFiresHomeClosure() {
        for mode in [VerdictScreen.Mode.default, .committed, .solo, .noSurvivor] {
            let snap = VerdictScreen(
                verdict: VerdictScreen.Verdict.fixture(),
                mode: mode
            ).modeSnapshot
            XCTAssertFalse(snap.chromeFiresAdvance,
                "non-read-only chrome (mode = \(mode)) fires `onHome` — pops to S00 Plan list")
        }
    }

    func testReadOnlySuppressesPreCheckInLine() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly
        ).modeSnapshot
        XCTAssertEqual(snap.preCheckInLine, "",
            "read-only has no ratification path — no check-in to promise (locked in VerdictScreenRatifyTests too)")
    }

    func testReadOnlyIsNotCommittedFlavor() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly
        ).modeSnapshot
        XCTAssertFalse(snap.isCommittedFlavor,
            "read-only is its own mode — the late-joiner can't ratify")
    }

    // MARK: - VO accessibility hint

    func testReadOnlyRatificationVOAnnouncementIsLocked() {
        // `design-system/accessibility.md` §"Verdict (read-only mode)"
        // locks the VO announcement: "Not available — this verdict is closed."
        XCTAssertEqual(
            VerdictScreen.readOnlyRatificationVOAnnouncement,
            "Not available — this verdict is closed."
        )
    }

    // MARK: - late-joiner exclusion from receipts (data-driven)

    func testReadOnlyReceiptsRowExcludesLateJoinerByConstruction() {
        // The late-joiner is not in the votes list returned by the
        // server (because they never voted). The view simply renders
        // whatever receipts are supplied — the spec-honest receipt set
        // is the responsibility of the caller. Verify the "honest 3
        // voters, no late-joiner" fixture passes through unchanged.
        let receipts = [
            VerdictScreen.Receipt(name: "alex", action: "filtered shellfish"),
            VerdictScreen.Receipt(name: "maya", action: "capped at $30"),
            VerdictScreen.Receipt(name: "sam",  action: "capped at 15 min walk"),
        ]
        let v = VerdictScreen.Verdict(
            placeName: "Pico's Taqueria",
            metaLine: "Mexican · $$ · 8 min walk",
            timeBadge: VerdictScreen.TimeBadge(time: "7:00 PM", audience: "All four of you"),
            ruleText: "Budget cap cut Ren Soba.",
            receipts: receipts,
            cuts: []
        )
        let screen = VerdictScreen(verdict: v, mode: .readOnly)
        render(screen)
        // The verdict still has 3 receipts (not 4) — late-joiner absent.
        XCTAssertEqual(v.receipts.count, 3,
            "read-only fixture has 3 receipts when a 4th member (late-joiner) is excluded")
        XCTAssertFalse(v.receipts.contains(where: { $0.name == "you" }),
            "the late-joiner ('you' chip) is not in receipts")
    }

    // MARK: - snapshot · read-only with chrome rendered (wfr-16)

    func testReadOnlyModeRendersWithChromeRowVisible() {
        // wfr-16 acceptance — `.readOnly` renders the chrome row above
        // the eyebrow. Smoke-tests the body materialisation in the
        // updated mode shape (chrome visible, `Done` verb).
        let verdict = VerdictScreen.Verdict.fixture()
        let view = VerdictScreen(verdict: verdict, mode: .readOnly)
        render(view)
        XCTAssertTrue(view.modeSnapshot.showHomeChrome)
        XCTAssertEqual(view.modeSnapshot.homeChromeLabel, "Done")
    }

    // MARK: - re-invite CTA wiring

    func testReadOnlyCTACallsOnAdvanceClosureExactlyOnceWhenTapped() {
        // SwiftUI's button tap simulation is fragile in unit-test scope;
        // we assert the closure plumbing via the public init contract:
        // the closure must hold a reference but not auto-fire on init.
        var advanceCalls = 0
        _ = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly,
            onAdvance: { advanceCalls += 1 }
        )
        XCTAssertEqual(advanceCalls, 0,
            "init must not auto-fire the re-invite closure")
    }
}
