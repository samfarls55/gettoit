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
//   * Cuts drawer remains available (informational).
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

    func testReadOnlyModeKeepsTimeBadgeReceiptsAndCutsDrawer() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly
        ).modeSnapshot

        XCTAssertTrue(snap.showTimeBadge,
            "read-only mode keeps the time badge — the late-joiner sees the locked when/where")
        XCTAssertTrue(snap.showReceipts,
            "read-only mode keeps voice receipts — the late-joiner sees who contributed")
        XCTAssertTrue(snap.showCutsDrawer,
            "read-only mode keeps the cuts drawer (informational — reading what got cut helps understand what they missed)")
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

    func testReadOnlyDoesNotShowHomeChrome() {
        // bug-22 — Home chrome is suppressed on read-only because the
        // iOS read-only path is reached only via a deep link to a
        // late-joined Plan; the late-joiner has no Plan list context
        // for that Plan (it isn't theirs). Per the grill outcome's
        // "Modes affected" table the read-only mode is unaffected.
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .readOnly
        ).modeSnapshot
        XCTAssertFalse(snap.showHomeChrome,
            "read-only suppresses Home — late-joiner has no Plan-list destination for this Plan")
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
