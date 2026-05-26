// GetToIt — VerdictRerollHost tests (bug-27).
//
// bug-27 (2026-05-25): the S05 tertiary "Reroll" CTA was a dead tap on
// the two live sites (`RootView.swift:424` createdDecidedVerdict,
// `PostQuizHostScreen.swift:64` post-quiz verdict). The fix introduces
// `VerdictRerollHost` — a small SwiftUI host that owns:
//   * a `RerollStore` for the room (drives the `rerollsUsed` count
//     flowing into `VerdictScreen` + the S07 sheet's stamp),
//   * a `RerollSheetState` `@Observable` that flips `isShowingSheet`
//     when the tertiary "Reroll" CTA fires,
//   * a `.sheet` presenting `RerollScreen` whose `onSubmit` calls
//     `RerollStore.applyReroll` then dismisses the sheet.
//
// The new host is what both live call sites mount instead of the bare
// `VerdictScreen(...)`. The test seam is the small `@Observable`
// `RerollSheetState` — `present()` flips `isShowingSheet`. Pre-bug-27
// the `onReroll` parameter on `VerdictScreen` defaulted to `{}` so the
// missing wire-up was a silent compile-pass; bug-27 also drops that
// default so the next call site has to wire it explicitly.

import XCTest
import SwiftUI
import Supabase
@testable import GetToIt

@MainActor
final class VerdictRerollHostTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    private func makeClient() -> SupabaseClient {
        let url = URL(string: "https://example.supabase.co")!
        return SupabaseClient(supabaseURL: url, supabaseKey: "anon")
    }

    // MARK: - RerollSheetState — the test seam

    func testSheetStateDefaultsToNotPresenting() {
        // A freshly-built host state holds the sheet closed; the only
        // way to open it is the user tapping the tertiary REROLL CTA,
        // which fires `present()`.
        let store = RerollStore(client: makeClient(), roomID: UUID())
        let state = RerollSheetState(store: store)
        XCTAssertFalse(state.isShowingSheet,
            "host state starts with the sheet hidden")
    }

    func testPresentFlipsTheSheetOpen() {
        // The wired-up `onReroll` closure on `VerdictScreen` calls
        // `state.present()`. The state flips `isShowingSheet` to true,
        // which the host's `.sheet(isPresented:)` modifier observes to
        // mount the S07 `RerollScreen`. This is the bug-27 fix in one
        // line — before bug-27 the closure was `{}` so this transition
        // never happened.
        let store = RerollStore(client: makeClient(), roomID: UUID())
        let state = RerollSheetState(store: store)
        state.present()
        XCTAssertTrue(state.isShowingSheet,
            "present() must open the sheet — this is the bug-27 fix")
    }

    func testDismissClosesTheSheet() {
        // S07's Cancel CTA + the `onSubmit` completion both route
        // through `dismiss()`.
        let store = RerollStore(client: makeClient(), roomID: UUID())
        let state = RerollSheetState(store: store)
        state.present()
        state.dismiss()
        XCTAssertFalse(state.isShowingSheet,
            "dismiss() must close the sheet")
    }

    // MARK: - host view materialisation

    func testHostRendersWithoutCrashing() {
        // Smoke — the host materialises a body holding both the
        // VerdictScreen and the (initially-hidden) sheet without
        // crashing under the hosting-controller drive used elsewhere
        // in this suite.
        let verdict = VerdictScreen.Verdict.fixture()
        render(
            VerdictRerollHost(
                verdict: verdict,
                roomID: UUID(),
                surface: .live(flavor: .default),
                isInitiator: true,
                client: makeClient()
            )
        )
    }

    func testHostRendersWithSoloMode() {
        // Post-quiz solo verdict — the second live site
        // (`PostQuizHostScreen.swift:64`) renders the host in `.solo`
        // mode when the lone initiator's verdict lands.
        let verdict = VerdictScreen.Verdict.soloFixture()
        render(
            VerdictRerollHost(
                verdict: verdict,
                roomID: UUID(),
                surface: .live(flavor: .solo),
                isInitiator: true,
                client: makeClient()
            )
        )
    }
}
