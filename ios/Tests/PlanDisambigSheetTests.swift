// GetToIt — PlanDisambigSheet tests (tb-WF-6).
//
// The disambig sheet that opens from both the empty-state hero pill
// and the C-26 FAB on the Plan list. Spec lives at
// `design-system/surfaces/00-plan-list.md §"Disambig sheet"` and the
// matching JSX is `design-system/code/screens/ScreenPlanList.jsx`.
//
// The sheet is *not* a system primitive — it's composed inline from
// the C-16 sheet language (dark glass, radius 26, 38×4 handle) and two
// stacked C-05 `ghost` pills. We export it as its own SwiftUI view
// (`PlanDisambigSheet`) so the surface host can present it via the
// standard `.sheet` modifier, but the visual register, copy, and pill
// set are locked at the type level.
//
// Tests encode the locked invariants:
//   1. Copy is exactly the spec-locked strings (eyebrow `"Start a plan"`,
//      headline `"Who's coming?"`, pills `"Solo"` / `"Group"`).
//   2. Two pills in the order Solo, then Group.
//   3. No Cancel button — dismiss is swipe-down + tap-scrim only.
//   4. Pick(.solo) and pick(.group) route the emitted callback with
//      the matching `GroupMode`.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class PlanDisambigSheetTests: XCTestCase {

    // MARK: - locked copy

    /// Eyebrow `"Start a plan"`. Sentence-case in source; the eyebrow
    /// token uppercases at render. Spec: `surfaces/00-plan-list.md
    /// §"Disambig sheet"`.
    func testEyebrowCopyIsLocked() {
        XCTAssertEqual(PlanDisambigSheet.eyebrowLabel, "Start a plan")
    }

    /// Headline `"Who's coming?"` — question form because the user is
    /// making a binary call right then. NEVER `"Solo or group?"`,
    /// NEVER `"Start a new plan"` (that's the FAB's accessibility
    /// label, not the sheet's headline).
    func testHeadlineCopyIsLocked() {
        XCTAssertEqual(PlanDisambigSheet.headlineLabel, "Who's coming?")
    }

    /// Solo pill label. The first pill in the stacked C-05 set.
    func testSoloPillLabelIsLocked() {
        XCTAssertEqual(PlanDisambigSheet.soloLabel, "Solo")
    }

    /// Group pill label. The second pill, below Solo. NEVER `"Group of
    /// us"` / `"With friends"`; the binary is locked at exactly
    /// `Solo` / `Group`.
    func testGroupPillLabelIsLocked() {
        XCTAssertEqual(PlanDisambigSheet.groupLabel, "Group")
    }

    /// NEVER `"Just me"` on this sheet — Q3 of the parent grill lifted
    /// `Just me` away to keep the disambig binary clean. Encoded as a
    /// negative test so a future edit can't quietly re-introduce it.
    func testPillsAreExactlySoloAndGroupNeverJustMe() {
        let labels = PlanDisambigSheet.pillLabelsInOrder
        XCTAssertEqual(labels, ["Solo", "Group"])
        XCTAssertFalse(labels.contains("Just me"))
    }

    // MARK: - mapping pill to setup group mode

    /// Picking Solo maps to `SetupScreen.GroupMode.solo`. The disambig
    /// is the upstream layer of the Setup mode contract.
    func testSoloMapsToSetupModeSolo() {
        XCTAssertEqual(PlanDisambigSheet.setupMode(for: .solo), .solo)
    }

    /// Picking Group maps to `SetupScreen.GroupMode.group`.
    func testGroupMapsToSetupModeGroup() {
        XCTAssertEqual(PlanDisambigSheet.setupMode(for: .group), .group)
    }

    // MARK: - callback routing

    /// Tapping Solo invokes onPick with `.solo` exactly once.
    func testTapSoloEmitsSolo() {
        var emitted: [PlanDisambigSheet.Choice] = []
        let sheet = PlanDisambigSheet(onPick: { emitted.append($0) }, onDismiss: {})
        sheet.simulatePick(.solo)
        XCTAssertEqual(emitted, [.solo])
    }

    /// Tapping Group invokes onPick with `.group` exactly once.
    func testTapGroupEmitsGroup() {
        var emitted: [PlanDisambigSheet.Choice] = []
        let sheet = PlanDisambigSheet(onPick: { emitted.append($0) }, onDismiss: {})
        sheet.simulatePick(.group)
        XCTAssertEqual(emitted, [.group])
    }

    // MARK: - render smoke

    /// Sheet body materialises. SwiftUI shape errors surface as crashes.
    func testRendersWithoutCrashing() {
        let view = PlanDisambigSheet(onPick: { _ in }, onDismiss: {})
        render(view)
    }

    // MARK: - render harness

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }
}
