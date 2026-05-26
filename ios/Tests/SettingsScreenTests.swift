// GetToIt — SettingsScreen render-hierarchy tests (wfr-07).
//
// Pins the visual hierarchy of S09 Settings per
// `surfaces/09-settings.md` after the wfr-07 demotion: the white-pill
// primary CTA is `DONE` (return to start), and `DELETE MY DATA` renders
// in the C-05 `ghost` destructive treatment (transparent fill + 1.5pt
// white-0.5 stroke). The no-red contract (`tokens.md §1.3`) still
// governs — the destructive weight lives in copy + outline + the native
// two-step confirm alert, never in color.
//
// The visual contract is encoded as `SettingsScreen.Style` constants
// so a regression cannot silently re-promote DELETE to the white-pill
// register without flipping these flags.

import XCTest
import SwiftUI
import Supabase
@testable import GetToIt

@MainActor
final class SettingsScreenTests: XCTestCase {

    // MARK: - render harness

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    private func makeAuthCoordinator() -> AuthCoordinator {
        // We don't have a live SupabaseClient in unit tests; placeholder
        // URL satisfies the coordinator's init. The settings render path
        // doesn't touch auth until the user taps DELETE → confirm.
        let url = URL(string: "https://placeholder.supabase.co")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "anon")
        return AuthCoordinator(client: client)
    }

    private func makeScreen() -> SettingsScreen {
        SettingsScreen(
            auth: makeAuthCoordinator(),
            onDone: {},
            onDeleted: nil
        )
    }

    // MARK: - body materialisation

    func testRendersWithoutCrashing() {
        render(makeScreen())
    }

    // MARK: - wfr-07 visual hierarchy contract

    /// `DONE` is the visually dominant primary — renders as the C-05
    /// white PillCTA per `surfaces/09-settings.md` after wfr-07.
    func testDoneIsTheWhitePillPrimary() {
        XCTAssertEqual(SettingsScreen.Style.donePillFill, .white,
                       "DONE must be the visually dominant C-05 white PillCTA")
    }

    /// `DELETE MY DATA` is demoted to the C-05 `ghost` destructive
    /// treatment — transparent fill + 1.5pt white-0.5 stroke, white
    /// text — per the issue spec.
    func testDeleteIsGhostDestructive() {
        XCTAssertEqual(SettingsScreen.Style.deletePillFill, .ghost,
                       "DELETE MY DATA must render in the C-05 ghost destructive treatment")
    }

    /// Ghost-pill outline stroke matches the registered C-05 ghost
    /// variant (1.5pt, white at 0.5 opacity). Locked at the type so
    /// the destructive outline cannot drift into a heavier or thinner
    /// stroke without flipping this contract.
    func testGhostStrokeWidthMatchesC05() {
        XCTAssertEqual(SettingsScreen.Style.ghostStrokeWidth, 1.5)
        XCTAssertEqual(SettingsScreen.Style.ghostStrokeOpacity, 0.5)
    }

    /// No red anywhere — the destructive treatment is outline + copy,
    /// never a colored fill. Pins the `tokens.md §1.3` no-red rule
    /// against any future drift on this surface.
    func testDestructivePillUsesNoRedToken() {
        XCTAssertFalse(SettingsScreen.Style.usesRedDestructiveColor,
                       "S09 destructive treatment must never use a red token — sun is the only state color")
    }

    /// DONE must visually outrank DELETE — encoded as an order
    /// constant so the CTA dock orders the primary above the
    /// secondary action.
    func testDoneRendersAboveDeleteInTheCTADock() {
        XCTAssertLessThan(
            SettingsScreen.Style.donePrimaryOrder,
            SettingsScreen.Style.deleteSecondaryOrder,
            "DONE (primary) must render above DELETE (secondary) in the CTA dock so the dominant action sits closest to the thumb dock"
        )
    }

    // MARK: - confirm-alert preservation

    /// Two-step confirm alert preserved — destructive button copy
    /// stays `"Delete forever"` per `surfaces/09-settings.md §"Copy
    /// register"`. The wfr-07 demotion changes the visual register
    /// only; the consent flow is unchanged.
    func testConfirmAlertCopyUnchanged() {
        XCTAssertEqual(SettingsScreen.Style.confirmAlertTitle, "Delete your data?")
        XCTAssertEqual(SettingsScreen.Style.confirmAlertMessage, "This can't be undone.")
        XCTAssertEqual(SettingsScreen.Style.confirmAlertDestructiveLabel, "Delete forever")
        XCTAssertEqual(SettingsScreen.Style.confirmAlertCancelLabel, "Cancel")
    }
}
