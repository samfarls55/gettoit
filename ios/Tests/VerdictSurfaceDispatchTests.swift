// GetToIt — VerdictRerollHost dispatch tests (bug-34 / ADR 0018).
//
// ADR 0018 turned `VerdictRerollHost` into a dispatcher. The host
// accepts a `VerdictRerollHost.Surface` value that names which of the
// three surfaces to mount:
//
//   * `.live(flavor:)` → `VerdictScreen` (with reroll wired)
//   * `.readOnly(showHomeChrome:)` → `VerdictReadOnlyScreen`
//   * `.noSurvivor` → `NoSurvivorScreen`
//
// This test file locks the dispatch contract — the host's surface
// resolution and the per-surface pass-throughs that the call sites
// rely on. The host body's actual SwiftUI tree is exercised by
// `VerdictRerollHostTests` (smoke) and the three per-surface test
// files (contract).
//
// See ADR 0018 §"VerdictRerollHost dispatch".

import XCTest
import SwiftUI
import Supabase
@testable import GetToIt

@MainActor
final class VerdictSurfaceDispatchTests: XCTestCase {

    private func makeClient() -> SupabaseClient {
        let url = URL(string: "https://example.supabase.co")!
        return SupabaseClient(supabaseURL: url, supabaseKey: "anon")
    }

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - Surface resolution from VerdictStore.VerdictView

    func testSurfaceForLiveVerdictResolvesToLiveDefaultFlavor() {
        // The post-quiz happy path: VerdictStore returns `.default`
        // mode (the live verdict). The dispatcher resolves to
        // `.live(.default)`.
        let view = VerdictStore.VerdictView(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .default
        )
        let surface = VerdictRerollHost.Surface.from(verdictView: view)
        XCTAssertEqual(surface, .live(flavor: .default),
            "live default-mode VerdictView resolves to .live(.default)")
    }

    func testSurfaceForSoloVerdictResolvesToLiveSoloFlavor() {
        let view = VerdictStore.VerdictView(
            verdict: VerdictScreen.Verdict.soloFixture(),
            mode: .solo
        )
        let surface = VerdictRerollHost.Surface.from(verdictView: view)
        XCTAssertEqual(surface, .live(flavor: .solo))
    }

    func testSurfaceForCommittedVerdictResolvesToLiveCommittedFlavor() {
        let view = VerdictStore.VerdictView(
            verdict: VerdictScreen.Verdict.fixture(),
            mode: .committed
        )
        let surface = VerdictRerollHost.Surface.from(verdictView: view)
        XCTAssertEqual(surface, .live(flavor: .committed))
    }

    func testSurfaceForNoSurvivorVerdictResolvesToNoSurvivorSurface() {
        // VerdictStore writes `.noSurvivor` for the no-survivor
        // terminal. The dispatcher routes to the dedicated screen
        // (NOT the live verdict surface, regardless of flavor).
        let view = VerdictStore.VerdictView(
            verdict: VerdictScreen.Verdict.noSurvivorFixture(),
            mode: .noSurvivor
        )
        let surface = VerdictRerollHost.Surface.from(verdictView: view)
        XCTAssertEqual(surface, .noSurvivor)
    }

    // MARK: - Read-only construction is explicit (callers signal arrival vector)

    func testReadOnlySurfaceHonoursShowHomeChromeFlag() {
        // The host has no way to know whether the call site is an
        // Account-member History deep-link (chrome on) or a Web
        // invitee SMS deep-link (chrome off). Callers signal via the
        // surface case's associated value.
        let surfaceA: VerdictRerollHost.Surface = .readOnly(showHomeChrome: true)
        let surfaceB: VerdictRerollHost.Surface = .readOnly(showHomeChrome: false)
        XCTAssertNotEqual(surfaceA, surfaceB,
            "readOnly surfaces with different chrome flags are distinct values")
    }

    // MARK: - host smoke under each surface

    func testHostRendersLiveSurface() {
        render(
            VerdictRerollHost(
                verdict: .fixture(),
                roomID: UUID(),
                surface: .live(flavor: .default),
                isInitiator: true,
                client: makeClient()
            )
        )
    }

    func testHostRendersReadOnlySurfaceWithChrome() {
        render(
            VerdictRerollHost(
                verdict: .fixture(),
                roomID: UUID(),
                surface: .readOnly(showHomeChrome: true),
                isInitiator: false,
                client: makeClient()
            )
        )
    }

    func testHostRendersReadOnlySurfaceWithoutChrome() {
        render(
            VerdictRerollHost(
                verdict: .fixture(),
                roomID: UUID(),
                surface: .readOnly(showHomeChrome: false),
                isInitiator: false,
                client: makeClient()
            )
        )
    }

    func testHostRendersNoSurvivorSurface() {
        render(
            VerdictRerollHost(
                verdict: .noSurvivorFixture(),
                roomID: UUID(),
                surface: .noSurvivor,
                isInitiator: true,
                client: makeClient()
            )
        )
    }
}
