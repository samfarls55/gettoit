// GetToIt — ParametersScreen smoke tests (TB-05 v1.1).
//
// Pixel-snapshot tooling is not yet on the iOS dependency graph (see
// `QuizScreenSnapshotTests` header). Until then, the S01b surface's
// "renders without crashing" coverage is a smoke test that forces the
// SwiftUI body to materialise, plus a pure-logic assertion that the
// chip selections compile into the right `SessionParameters` value —
// which is what the CTA persists onto the room.

import XCTest
import SwiftUI
import Supabase
@testable import GetToIt

@MainActor
final class ParametersScreenTests: XCTestCase {

    /// Force a SwiftUI view body to run. A `body` that fails to
    /// type-check or throws surfaces here as a crash.
    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    /// A throwaway store. A render-only test never exercises the CTA
    /// action — the only path that touches the store — so a client
    /// built from a stub config is fine.
    private func makeStore() -> RoomStore {
        RoomStore(
            client: SupabaseClient(
                supabaseURL: URL(string: "https://example.supabase.co")!,
                supabaseKey: "test-anon-key"
            )
        )
    }

    private func makeScreen(
        initial: SessionParameters = .default,
        locationName: String? = "Mission · San Francisco"
    ) -> ParametersScreen {
        ParametersScreen(
            roomID: UUID(),
            roomStore: makeStore(),
            locationName: locationName,
            initialParameters: initial,
            onContinue: {}
        )
    }

    /// The S01b body materialises without crashing in its default
    /// state — the four chip groups, the geography echo, the CTA.
    func testRendersWithoutCrashingInDefaultState() {
        render(makeScreen())
    }

    /// It also renders with a non-default initial parameter set (the
    /// chips reflect the passed-in selections rather than the
    /// canonical defaults).
    func testRendersWithoutCrashingWithNonDefaultParameters() {
        render(makeScreen(initial: SessionParameters(
            mealTime: .lateNight,
            groupContext: .solo,
            serviceShape: .takeoutDelivery,
            transportMode: .drive
        )))
    }

    /// It renders even when no geography name is available — the
    /// geography row falls back to a neutral placeholder.
    func testRendersWithoutLocationName() {
        render(makeScreen(locationName: nil))
    }

    // MARK: - chip selections → SessionParameters

    /// `selectedParameters` echoes the initial parameter set before
    /// any chip is tapped — the surface opens on the passed-in values
    /// (the zero-tap default contract).
    func testSelectedParametersReflectsInitialState() {
        let initial = SessionParameters(
            mealTime: .lunch,
            groupContext: .duo,
            serviceShape: .dineInOutdoor,
            transportMode: .walk
        )
        let screen = makeScreen(initial: initial)
        XCTAssertEqual(screen.selectedParameters, initial,
            "the surface opens on the parameters it was initialised with")
    }

    /// The default surface opens on the canonical `SessionParameters`
    /// default — a skim-and-tap initiator still ships a valid session.
    func testDefaultScreenOpensOnCanonicalDefault() {
        XCTAssertEqual(makeScreen().selectedParameters, SessionParameters.default)
    }
}
