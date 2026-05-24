// GetToIt — PlanDisambigSheet tests (tb-WF-6 → bug-24).
//
// The disambig sheet that opens from both the empty-state hero pill
// and the C-26 FAB on the Plan list. Spec lives at
// `design-system/surfaces/00-plan-list.md §"Disambig sheet"` and the
// matching JSX is `design-system/code/screens/ScreenPlanList.jsx`.
//
// bug-24 (2026-05-24): the sheet now consumes the C-27 ActionSheet
// primitive — native iOS shape (rounded-top, native grabber via
// `.presentationDragIndicator(.visible)`, content-height detent). It
// previously inlined the C-16 modal-editor language (custom 38×4
// handle pill, `[.height(N), .medium]` detents); the C-16 primitive
// itself is unchanged and continues to back the S07 reroll + C-23
// LocationPicker sheets. We export the sheet as its own SwiftUI view
// (`PlanDisambigSheet`) so the surface host can present it via the
// standard `.sheet` modifier, but the visual register, copy, pill set,
// and C-27 shape contract are locked at the type level.
//
// Tests encode the locked invariants:
//   1. Copy is exactly the spec-locked strings (eyebrow `"Start a plan"`,
//      headline `"Who's coming?"`, pills `"Solo"` / `"Group"`).
//   2. Two pills in the order Solo, then Group.
//   3. No Cancel button — dismiss is swipe-down on the native grabber.
//   4. Pick(.solo) and pick(.group) route the emitted callback with
//      the matching `GroupMode`.
//   5. (bug-24) The sheet uses the C-27 native shape — native grabber,
//      no custom handle, single content-height detent.

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

    // MARK: - bug-24 — native-iOS C-27 ActionSheet shape

    /// bug-24 — the sheet adopts the C-27 native-iOS Action Sheet
    /// shape: native grabber visible, NO custom 38×4 handle pill.
    /// Pins the spec-level contract from `surfaces/00-plan-list.md
    /// §"Disambig sheet"` (revised) + `components.md §C-27`.
    func testUsesNativeGrabber() {
        XCTAssertTrue(PlanDisambigSheet.Shape.usesNativeGrabber,
                      "C-27 ActionSheet must use the native iOS grabber, not a custom handle")
    }

    /// bug-24 — the custom 38×4 white-0.22 handle pill is removed.
    /// The native grabber from `.presentationDragIndicator(.visible)`
    /// is the only top affordance. The C-16 modal-editor sheets
    /// (reroll, location picker) keep their custom handle; only the
    /// C-27 Action Sheet drops it.
    func testNoCustomHandlePill() {
        XCTAssertFalse(PlanDisambigSheet.Shape.rendersCustomHandle,
                       "C-27 ActionSheet must NOT render a custom handle pill — the native grabber carries the affordance")
    }

    /// bug-24 — exactly ONE detent (content-height). No `.medium`
    /// fallback — the half-screen `.medium` is what created the
    /// "lots of empty vertical space" the user complained about.
    /// A single content-height detent sizes the sheet to its content
    /// and nothing more.
    func testUsesSingleContentHeightDetent() {
        XCTAssertEqual(PlanDisambigSheet.Shape.detentCount, 1,
                       "C-27 ActionSheet must use a single content-height detent — no .medium fallback")
        XCTAssertTrue(PlanDisambigSheet.Shape.detentSizesToContent,
                      "the sole detent must be content-height (`.height(N)`), not `.medium` / `.large`")
    }

    /// bug-24 — the content-height detent is < 320pt. The previous
    /// implementation pinned 260pt with a `.medium` fallback; the
    /// user-visible regression was the `.medium` snap. The content
    /// height stays modest (room for handle + eyebrow + headline +
    /// two pills + footer).
    func testContentHeightDetentIsModest() {
        XCTAssertLessThan(PlanDisambigSheet.Shape.contentHeight, 320,
                          "disambig content fits under 320pt — handle + eyebrow + headline + two pills")
        XCTAssertGreaterThan(PlanDisambigSheet.Shape.contentHeight, 200,
                             "content height must leave room for the 60pt-tall pills + breathing")
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
