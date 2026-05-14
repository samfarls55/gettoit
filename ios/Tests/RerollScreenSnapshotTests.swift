// GetToIt — RerollScreen snapshot-style smoke tests (TB-10).
//
// Same shape as `VerdictScreenSnapshotTests` and other snapshot suites
// in this codebase: pixel snapshots aren't on the dependency graph;
// we verify the SwiftUI body materialises in every mode and that the
// spec-locked copy + timings feed through unchanged. The motion-
// timing constants are pulled from `tokens.json` via `GTITokens.swift`
// so a silent token bump trips the assertion.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class RerollScreenSnapshotTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - body materialisation

    func testRendersWithNoReasonSelected() {
        render(
            RerollScreen(
                placeName: "Pico's",
                rerollsUsed: 0,
                onCancel: {},
                onSubmit: { _, _, _, _ in }
            )
        )
    }

    func testRendersWithLastReroll() {
        render(
            RerollScreen(
                placeName: "Pico's",
                rerollsUsed: 2,
                onCancel: {},
                onSubmit: { _, _, _, _ in }
            )
        )
    }

    // MARK: - 2 LEFT stamp + CTA copy

    func testStampCopyForFirstReroll() {
        XCTAssertEqual(RerollScreen.stampCopy(rerollsUsed: 0), "3 left")
    }

    func testStampCopyDecrementsAsRerollsBurn() {
        XCTAssertEqual(RerollScreen.stampCopy(rerollsUsed: 0), "3 left")
        XCTAssertEqual(RerollScreen.stampCopy(rerollsUsed: 1), "2 left")
        XCTAssertEqual(RerollScreen.stampCopy(rerollsUsed: 2), "1 left")
    }

    func testPrimaryCtaCopyWithReasonSelected() {
        XCTAssertEqual(
            RerollScreen.primaryCtaLabel(rerollsUsed: 0, hasReason: true),
            "Reroll · burns 1 of 3"
        )
        XCTAssertEqual(
            RerollScreen.primaryCtaLabel(rerollsUsed: 1, hasReason: true),
            "Reroll · burns 2 of 3"
        )
    }

    func testPrimaryCtaCopySwitchesToLastOneOnThirdReroll() {
        XCTAssertEqual(
            RerollScreen.primaryCtaLabel(rerollsUsed: 2, hasReason: true),
            "Reroll · last one"
        )
    }

    func testPrimaryCtaCopyWithoutReasonGate() {
        XCTAssertEqual(
            RerollScreen.primaryCtaLabel(rerollsUsed: 0, hasReason: false),
            "Pick a reason first"
        )
    }

    func testCancelCtaCopyNamesThePriorPick() {
        XCTAssertEqual(
            RerollScreen.cancelCtaLabel(placeName: "Pico's"),
            "Cancel · keep Pico's"
        )
    }

    // MARK: - last-reroll body line

    func testLastRerollBodyLineRendersAfterThisTonightIsCommitted() {
        // Per S07 §"Edge cases" the 3rd (last) reroll surfaces the
        // additional body line `"After this, tonight is committed."`.
        XCTAssertEqual(
            RerollScreen.lastRerollNotice(rerollsUsed: 2),
            "After this, tonight is committed."
        )
        XCTAssertNil(
            RerollScreen.lastRerollNotice(rerollsUsed: 0),
            "non-last-reroll states must NOT surface the lock notice"
        )
        XCTAssertNil(
            RerollScreen.lastRerollNotice(rerollsUsed: 1),
            "non-last-reroll states must NOT surface the lock notice"
        )
    }

    // MARK: - reason taxonomy (locked to spec)

    func testReasonTaxonomyMatchesTheSpec() {
        // S07 + PRD lock the 5 reasons: cost · dist · mood · diet · avail.
        let ids = RerollScreen.Reason.allCases.map(\.id)
        XCTAssertEqual(ids, ["cost", "dist", "mood", "diet", "avail"])
    }

    func testReasonLabelsMatchTheJSX() {
        // Labels mirror `ScreenReroll.jsx` verbatim — these are
        // load-bearing copy that the design system locks.
        XCTAssertEqual(RerollScreen.Reason.cost.label,  "Too pricey")
        XCTAssertEqual(RerollScreen.Reason.dist.label,  "Too far")
        XCTAssertEqual(RerollScreen.Reason.mood.label,  "Mood shifted")
        XCTAssertEqual(RerollScreen.Reason.diet.label,  "Diet missed")
        XCTAssertEqual(RerollScreen.Reason.avail.label, "Not open")
    }

    func testReasonGlyphsMatchTheJSX() {
        XCTAssertEqual(RerollScreen.Reason.cost.glyph,  "$")
        XCTAssertEqual(RerollScreen.Reason.dist.glyph,  "→")
        XCTAssertEqual(RerollScreen.Reason.mood.glyph,  "~")
        XCTAssertEqual(RerollScreen.Reason.diet.glyph,  "✕")
        XCTAssertEqual(RerollScreen.Reason.avail.glyph, "○")
    }

    // MARK: - motion timing

    func testSheetOpenDurationMatchesMotionMd() {
        // Per `motion.md` §"Utility motion" — sheet open is
        // 380ms ease-out-soft. This is the canonical timing for S07.
        XCTAssertEqual(RerollScreen.Motion.sheetOpenDuration, 0.380, accuracy: 0.0001)
    }
}
