// GetToIt — SettingsScreen render-hierarchy tests (wfr-07, wfr-29).
//
// Pins the visual hierarchy of S09 Settings per
// `surfaces/09-settings.md`:
//   * wfr-07 — `DELETE MY DATA` renders in the C-05 `ghost` destructive
//     treatment (transparent fill + 1.5pt white-0.5 stroke). The no-red
//     contract (`tokens.md §1.3`) still governs — the destructive weight
//     lives in copy + outline + the native two-step confirm alert, never
//     in color.
//   * wfr-29 — the surface escape is a top-leading `xmark` icon (iOS
//     sheet-dismissal convention, P-07 Habituation). The bottom-center
//     `DONE` PillCTA is retired; the close glyph owns the dismiss.
//
// The visual contract is encoded as `SettingsScreen.Style` constants
// so a regression cannot silently re-promote DELETE to the white-pill
// register or re-introduce a bottom DONE without flipping these flags.

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

    // MARK: - wfr-29 top-leading close affordance

    /// wfr-29 — the surface escape is a top-leading icon-button using
    /// the SF Symbol `xmark`. Matches the iOS sheet-dismissal
    /// convention (P-07 Habituation) and visually distinguishes the
    /// Settings utility surface from the Sunset Pop ritual arc.
    func testCloseAffordanceUsesXmarkSymbol() {
        XCTAssertEqual(SettingsScreen.Style.closeSymbolName, "xmark",
                       "Top-leading close affordance must use the `xmark` SF Symbol per iOS sheet-dismissal convention")
    }

    /// wfr-29 — the close glyph anchors top-leading. A regression that
    /// flips it to top-trailing (Quiz `Exit` slot) or back to a
    /// bottom-dock pill must trip this contract.
    func testCloseAffordanceAnchorsTopLeading() {
        XCTAssertEqual(SettingsScreen.Style.closeAlignment, .topLeading,
                       "Close affordance must anchor top-leading (iOS sheet-dismissal convention)")
    }

    /// wfr-29 — the close glyph carries a 44pt minimum tap target.
    /// Matches the QuizChrome / VerdictReadOnly chrome convention and
    /// the Apple HIG minimum touch dimension.
    func testCloseAffordanceMeetsMinTapTarget() {
        XCTAssertGreaterThanOrEqual(SettingsScreen.Style.closeMinTapTarget, 44,
                                    "Close affordance must meet the 44pt minimum tap target")
    }

    /// wfr-29 — the bottom-center DONE PillCTA is retired. The
    /// surface escape lives on the top-leading close glyph; no DONE
    /// pill renders in the CTA dock.
    func testNoBottomDonePillRenders() {
        XCTAssertFalse(SettingsScreen.Style.rendersBottomDonePill,
                       "Bottom-center DONE PillCTA must be removed per wfr-29 — the top-leading close glyph owns the dismiss")
    }

    // MARK: - wfr-07 visual hierarchy contract

    /// `DELETE MY DATA` renders in the C-05 `ghost` destructive
    /// treatment — transparent fill + 1.5pt white-0.5 stroke, white
    /// text — per `surfaces/09-settings.md`.
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
