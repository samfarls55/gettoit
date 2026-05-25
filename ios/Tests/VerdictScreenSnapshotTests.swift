// GetToIt — VerdictScreen snapshot-style smoke tests (TB-06).
//
// Same shape as `QuizScreenSnapshotTests`: pixel-snapshot tooling is
// not yet on the dependency graph, so "snapshot test for S05 default
// state" (ticket AC) is satisfied by smoke tests that:
//   * verify the SwiftUI body materialises without crashing in the
//     verdict's `default` mode,
//   * confirm spec-driven inputs (the choreography delays, the eyebrow
//     copy, the receipts) feed through unchanged,
//   * lock the design-system contract for the choreo timings via direct
//     assertions on the constants the view reads.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class VerdictScreenSnapshotTests: XCTestCase {

    /// Force a SwiftUI view body to materialise. Same hosting-controller
    /// trick `QuizScreenSnapshotTests` uses.
    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - body materialisation

    func testDefaultModeRendersWithoutCrashing() {
        let verdict = VerdictScreen.Verdict.fixture()
        render(VerdictScreen(verdict: verdict, mode: .default))
    }

    func testDefaultModeRendersWithEmptyReceiptsAndCuts() {
        // Defensive — a verdict with zero receipts or zero cuts should
        // still materialise without crashing (e.g. an early-trigger
        // room where no member has answered yet).
        let empty = VerdictScreen.Verdict(
            placeName: "Solo Spot",
            metaLine: "American · $ · 5 min walk",
            timeBadge: VerdictScreen.TimeBadge(time: "7:00 PM", audience: "All four of you"),
            ruleText: "Solo Spot was the only candidate that fit every constraint.",
            receipts: [],
            cuts: []
        )
        render(VerdictScreen(verdict: empty, mode: .default))
    }

    // MARK: - bug-28 · audience subtitle suppression

    func testTimeBadgeRendersWithoutCrashingWhenAudienceIsEmpty() {
        // bug-28 — solo mode (and any caller that opts in) signals
        // "suppress the audience subtitle" by passing an empty audience
        // string. The renderer must materialise the time badge as a
        // single line (the timestamp only) without crashing — no empty
        // `Text("")` placeholder, the VStack collapses to one child.
        let verdict = VerdictScreen.Verdict(
            placeName: "Pico's Taqueria",
            metaLine: "Mexican · $$ · 8 min walk",
            timeBadge: VerdictScreen.TimeBadge(time: "7:00 PM", audience: ""),
            ruleText: "Pico's was the only candidate that fit every constraint.",
            receipts: [],
            cuts: []
        )
        render(VerdictScreen(verdict: verdict, mode: .solo))
    }

    // MARK: - choreography timings (locked, ms-exact)

    func testChoreoTimingsMatchTheDesignSystemTokens() {
        // The verdict reveal timings are canon in `design-system/motion.md`
        // §"Verdict reveal — full choreography" and in `VERDICT_CHOREO`
        // at the top of `design-system/code/screens/ScreenVerdict.jsx`.
        // The GTITokens generator pulls them from `tokens.json` — so
        // asserting against the generated values is equivalent to
        // asserting against the canonical source. The numerical values
        // are written into the snapshot so a silent token bump trips
        // the test.
        XCTAssertEqual(VerdictScreen.Choreo.eyebrowDelay,  0.080, accuracy: 0.0001)
        XCTAssertEqual(VerdictScreen.Choreo.nameDelay,     0.280, accuracy: 0.0001)
        XCTAssertEqual(VerdictScreen.Choreo.metaDelay,     0.700, accuracy: 0.0001)
        XCTAssertEqual(VerdictScreen.Choreo.timeDelay,     0.820, accuracy: 0.0001)
        XCTAssertEqual(VerdictScreen.Choreo.ruleDelay,     1.020, accuracy: 0.0001)
        XCTAssertEqual(VerdictScreen.Choreo.receiptsDelay, 1.140, accuracy: 0.0001)
        XCTAssertEqual(VerdictScreen.Choreo.ctaDelay,      1.380, accuracy: 0.0001)
        XCTAssertEqual(VerdictScreen.Choreo.staggerReceipt, 0.080, accuracy: 0.0001,
                       "receipt stagger is 80ms per chip per motion.md")
    }

    func testHeroLineIsStackedOneWordPerLine() {
        let lines = VerdictScreen.heroLines(for: "Pico's Taqueria")
        XCTAssertEqual(lines.count, 2, "S05 hero stacks two words / lines")
        XCTAssertEqual(lines[0], "PICO'S")
        XCTAssertEqual(lines[1], "TAQUERIA")
    }

    func testHeroLineWithThreeWordsCollapsesToTwoBalancedLines() {
        // Spec rule (S05 §"Copy register"): place name UPPERCASE stacked,
        // one word per line. When the name has 3+ tokens the rule still
        // wants visible balance — split halves.
        let lines = VerdictScreen.heroLines(for: "Bar Pastoral Italian")
        XCTAssertEqual(lines.count, 2)
        // First line carries the leading word; the rest land on the
        // second line so the verdict reads as a hero, not a list.
        XCTAssertEqual(lines[0], "BAR")
        XCTAssertEqual(lines[1], "PASTORAL ITALIAN")
    }

    // MARK: - mode flags

    func testDefaultModeFlagsAreLockedToTheSpec() {
        let verdict = VerdictScreen.Verdict.fixture()
        let snap = VerdictScreen(verdict: verdict, mode: .default).modeSnapshot
        XCTAssertTrue(snap.showTimeBadge,    "default mode renders the time badge")
        XCTAssertTrue(snap.showReceipts,     "default mode renders voice receipts")
        XCTAssertTrue(snap.showCutsDrawer,   "default mode renders the cuts trigger")
        XCTAssertFalse(snap.cutsExpanded,    "cuts drawer collapsed by default per S05 §Modes")
        XCTAssertEqual(snap.eyebrowCopy, "Tonight, the verdict is")
        XCTAssertEqual(snap.primaryCtaLabel, "I'm in")
        // bug-22 — `Start over` tertiary slot removed; the Home verb
        // now lives in the top-leading chrome row. CTA dock secondary
        // is empty until the user commits (where the countdown lands).
        XCTAssertEqual(snap.secondaryLabel, "")
    }

    // MARK: - bug-22 · Home chrome row

    func testDefaultModeShowsHomeChrome() {
        // bug-22 — top-leading text verb `Home` lives on the chrome
        // row above the eyebrow on every iOS-reachable mode. The
        // ModeSnapshot surfaces a render-gate flag so the snapshot
        // suite can lock the contract without depending on view-
        // internals.
        let snap = VerdictScreen(
            verdict: .fixture(),
            mode: .default
        ).modeSnapshot
        XCTAssertTrue(snap.showHomeChrome,
            "default mode surfaces the Home chrome row per bug-22")
    }

    func testHomeChromeLabelIsLocked() {
        // bug-22 spec resolves the verb as text-only "Home"; never an
        // SF Symbol house glyph (the chrome-row idiom is text-only,
        // mirroring quiz `Back`/`Exit`/`Leave`).
        XCTAssertEqual(VerdictScreen.homeChromeLabel, "Home",
            "Home chrome verb is text-only 'Home' per bug-22 grill outcome")
    }

    func testHomeChromeIsPureNavigationAndDoesNotAutoFireOnInit() {
        // The Home tap is pure nav — pops to S00 Plan list, no session
        // teardown, no membership mutation (the room is already closed
        // at verdict per CONTEXT.md). Verify the closure is held but
        // not auto-fired on init.
        var homeCalls = 0
        _ = VerdictScreen(
            verdict: .fixture(),
            mode: .default,
            onHome: { homeCalls += 1 }
        )
        XCTAssertEqual(homeCalls, 0,
            "init must not auto-fire the Home closure")
    }

    // MARK: - fixture contract

    func testFixtureProducesFourReceiptsMatchingTheJSX() {
        let fixture = VerdictScreen.Verdict.fixture()
        XCTAssertEqual(fixture.receipts.count, 4,
                       "JSX fixture surfaces 4 receipts on the verdict reveal")
        XCTAssertEqual(fixture.receipts.map { $0.name }, ["you", "alex", "maya", "sam"],
                       "receipt names mirror the JSX fixture order")
    }
}
