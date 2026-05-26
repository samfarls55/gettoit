// GetToIt — VerdictReadOnlyScreen tests (bug-34 / ADR 0018).
//
// Lifted from `VerdictScreenReadOnlyTests.swift`. ADR 0018 split the
// closed-verdict view out of the 5-mode `VerdictScreen` into its own
// single-intent `VerdictReadOnlyScreen`. The contract is:
//
//   * Eyebrow `"Tonight's verdict"` (past-tense-implicit).
//   * Hero + meta + time-badge + receipts shell rendered.
//   * Suppressed: ratify, reroll, dock countdown, save-chip,
//     pre-permission line.
//   * Primary CTA `"Start a new decision"` (white pill) → `onAdvance`.
//   * Home chrome parameterised by arrival vector: rendered when
//     `showHomeChrome == true` (Account-member History deep-link),
//     omitted when `false` (Web invitee with no Plan list).
//   * Chrome verb is `Done` (the late-joiner has no Plan-list
//     destination — `Done` is the honest verb for "close this read-only
//     snapshot"). Tap fires `onAdvance`.
//   * VO announces "Not available — this verdict is closed." for the
//     suppressed ratification path.
//
// See `design-system/surfaces/05a-verdict-read-only.md`.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class VerdictReadOnlyScreenTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - body materialisation

    func testRendersWithoutCrashingWithHomeChrome() {
        let verdict = VerdictScreen.Verdict.fixture()
        render(VerdictReadOnlyScreen(verdict: verdict, showHomeChrome: true))
    }

    func testRendersWithoutCrashingWithoutHomeChrome() {
        // Web invitee arrival vector — no Plan list to honor; the
        // chrome row is omitted entirely.
        let verdict = VerdictScreen.Verdict.fixture()
        render(VerdictReadOnlyScreen(verdict: verdict, showHomeChrome: false))
    }

    func testRendersWithEmptyReceipts() {
        // A late-joiner on a no-survivor terminal (deep-linked into the
        // sealed Plan) renders through VerdictReadOnlyScreen too —
        // verify the empty-receipts fixture materialises.
        let verdict = VerdictScreen.Verdict(
            placeName: "No spot fits",
            metaLine: "Vegan options · $$ cap · 15 min walk",
            timeBadge: VerdictScreen.TimeBadge(time: "", audience: ""),
            ruleText: "Vegan options left no candidates within walking distance tonight.",
            receipts: [],
            cuts: []
        )
        render(VerdictReadOnlyScreen(verdict: verdict, showHomeChrome: true))
    }

    // MARK: - chrome contract

    func testHomeChromeIsRenderedWhenFlagIsTrue() {
        let view = VerdictReadOnlyScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            showHomeChrome: true
        )
        XCTAssertTrue(view.showHomeChrome,
            "showHomeChrome == true renders the chrome row above the eyebrow")
    }

    func testHomeChromeIsSuppressedWhenFlagIsFalse() {
        let view = VerdictReadOnlyScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            showHomeChrome: false
        )
        XCTAssertFalse(view.showHomeChrome,
            "showHomeChrome == false suppresses the chrome row (Web invitee arrival)")
    }

    func testChromeVerbIsDone() {
        // The late-joiner has no Plan list — `Done` is the honest verb
        // for "close this read-only snapshot". Same eyebrow-token
        // treatment as the live verdict's Home verb.
        XCTAssertEqual(VerdictReadOnlyScreen.chromeLabel, "Done",
            "read-only chrome verb is the locked `Done` label per wfr-16")
    }

    func testInitDoesNotAutoFireOnAdvance() {
        var advanceCalls = 0
        _ = VerdictReadOnlyScreen(
            verdict: VerdictScreen.Verdict.fixture(),
            showHomeChrome: true,
            onAdvance: { advanceCalls += 1 }
        )
        XCTAssertEqual(advanceCalls, 0,
            "init must not auto-fire the advance closure")
    }

    // MARK: - VO accessibility hint

    func testReadOnlyRatificationVOAnnouncementIsLocked() {
        // `design-system/accessibility.md` §"Verdict (read-only mode)"
        // locks the VO announcement.
        XCTAssertEqual(
            VerdictReadOnlyScreen.ratificationVOAnnouncement,
            "Not available — this verdict is closed."
        )
    }

    // MARK: - primary CTA copy

    func testPrimaryCtaCopyIsStartANewDecision() {
        XCTAssertEqual(VerdictReadOnlyScreen.primaryCtaLabel, "Start a new decision",
            "read-only primary CTA reads 'Start a new decision' (voluntary register)")
    }
}
