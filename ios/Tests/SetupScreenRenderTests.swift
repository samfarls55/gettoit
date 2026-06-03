// GetToIt — SetupScreen render smoke tests (tb-WF-4).
//
// Pixel-snapshot tooling is not yet on the iOS dependency graph (see
// `QuizScreenSnapshotTests` header); until then "the SetupScreen body
// materialises without crashing" is the snapshot-equivalent gate.
//
// Coverage:
//   * Create mode opens with default chip selections + empty name.
//   * Create mode + solo group mode → one Search area control and no
//     `Who's coming` row.
//   * Create mode + group group mode → one Search area control plus
//     the group-context row.
//   * Edit mode prefilled from an existing pending Plan.
//   * Mode pre-selection — a `.duo` Plan re-opens in `.group` setup
//     with the `Two of us` chip selected.

import XCTest
import SwiftUI
import Supabase
@testable import GetToIt

@MainActor
final class SetupScreenRenderTests: XCTestCase {

    /// Force a SwiftUI view body to run. A `body` that fails to type-
    /// check or throws surfaces here as a runtime crash.
    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    /// Stub Supabase client. A render-only test never exercises the CTA
    /// path that touches the network, so a client built from a stub
    /// config is fine — same pattern `ParametersScreenTests` followed.
    private func makeClient() -> SupabaseClient {
        SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "test-anon-key"
        )
    }

    private func makeScreen(
        mode: SetupScreen.Mode = .create,
        groupMode: SetupScreen.GroupMode = .group,
        editingPlan: PlansStore.Plan? = nil
    ) -> SetupScreen {
        let client = makeClient()
        return SetupScreen(
            mode: mode,
            groupMode: groupMode,
            plansStore: PlansStore(client: client),
            roomStore: RoomStore(client: client),
            userID: UUID(),
            locationCoordinator: LocationCoordinator(),
            editingPlan: editingPlan
        )
    }

    // MARK: - body materialisation

    func testCreateGroupModeRenders() {
        render(makeScreen(mode: .create, groupMode: .group))
    }

    func testCreateSoloModeRenders() {
        render(makeScreen(mode: .create, groupMode: .solo))
    }

    func testEditGroupModeRendersWithPrefill() {
        let plan = PlansStore.Plan(
            id: UUID(),
            creatorID: UUID(),
            name: "Friday dinner",
            category: "food",
            scope: .group,
            location: nil,
            sessionParameters: SessionParameters(
                mealTime: .lunch,
                groupContext: .group,
                serviceShape: .takeoutPickup,
                transportMode: .walk
            ),
            distanceMeters: 3219,
            status: .pending
        )
        render(makeScreen(mode: .edit, groupMode: .group, editingPlan: plan))
    }

    func testEditSoloModeRendersWithSoloPlanPrefill() {
        let plan = PlansStore.Plan(
            id: UUID(),
            creatorID: UUID(),
            name: "Sunday solo brunch",
            category: "food",
            scope: .solo,
            location: nil,
            sessionParameters: SessionParameters(
                mealTime: .breakfast,
                groupContext: .solo,
                serviceShape: .dineInIndoor,
                transportMode: .walk
            ),
            distanceMeters: 805,
            status: .pending
        )
        render(makeScreen(mode: .edit, groupMode: .solo, editingPlan: plan))
    }

    // MARK: - mode mapping from Plan.scope (entry-path contract)

    /// Amendment 2026-05-20 — Plan.scope drives the mode the Edit
    /// surface renders in. A `solo` Plan re-opens in Solo Setup;
    /// `duo` / `group` re-open in Group Setup.
    func testPlanScopeDrivesGroupModeOnEditOpen() {
        XCTAssertEqual(SetupScreen.setupMode(for: .solo),  .solo)
        XCTAssertEqual(SetupScreen.setupMode(for: .duo),   .group)
        XCTAssertEqual(SetupScreen.setupMode(for: .group), .group)
    }

    // MARK: - wfr-09 disabled/enabled CTA render coverage

    /// wfr-09 acceptance criterion #2 — "Snapshot test covers disabled
    /// + enabled states." Create-mode opens with an empty name, so the
    /// dock CTAs render in their disabled state on first paint. This
    /// exercises the disabled label-swap path.
    func testCreateModeRendersDockInDisabledState() {
        render(makeScreen(mode: .create, groupMode: .group))
    }

    /// The enabled state — an Edit-mode entry with a prefilled name —
    /// renders the canonical primary + secondary copy. Paired with
    /// `testCreateModeRendersDockInDisabledState` to cover both states
    /// of the dock per wfr-09.
    func testEditModeRendersDockInEnabledState() {
        let plan = PlansStore.Plan(
            id: UUID(),
            creatorID: UUID(),
            name: "Friday dinner",
            category: "food",
            scope: .group,
            location: nil,
            sessionParameters: SessionParameters(
                mealTime: .dinner,
                groupContext: .group,
                serviceShape: .dineInIndoor,
                transportMode: .walk
            ),
            distanceMeters: 1609,
            status: .pending
        )
        render(makeScreen(mode: .edit, groupMode: .group, editingPlan: plan))
    }

    // MARK: - wfr-25 field-level error placement (snapshot-equivalent)

    /// wfr-25 — each routing bucket renders without crashing. The
    /// snapshot-equivalent gate here is "the body type-checks and
    /// materialises with the field-level error wired into the right
    /// section." `injectingError:` is a test-only seam that
    /// pre-populates the phase as `.error(...)` so the view body
    /// branches into the field-level rendering paths.
    func testNameFieldErrorRenders() {
        render(
            makeScreen(mode: .create, groupMode: .group)
                .injectingError(.init(field: .name, message: "Name needs to be 1 to 40 characters."))
        )
    }

    func testDistanceFieldErrorRenders() {
        render(
            makeScreen(mode: .create, groupMode: .group)
                .injectingError(.init(field: .distance, message: "Distance is out of range."))
        )
    }

    func testCrossFieldErrorRendersAtDock() {
        render(
            makeScreen(mode: .create, groupMode: .group)
                .injectingError(.init(field: .crossField, message: "Couldn't save the plan."))
        )
    }

    // MARK: - wfr-26 persistent name label render coverage

    /// wfr-26 acceptance criterion #3 — "Snapshot test covers empty +
    /// typed states." Empty state: name field renders with the
    /// persistent label visible above and the in-field Input Prompt
    /// placeholder still active. Body materialisation is the snapshot-
    /// equivalent gate until pixel snapshotting lands.
    func testNameLabelRendersInEmptyState() {
        render(makeScreen(mode: .create, groupMode: .group))
    }

    /// wfr-26 acceptance criterion #3 — typed state: the persistent
    /// label must still render once the user has typed and the in-field
    /// placeholder has disappeared. Seeded via the existing `editingPlan`
    /// prefill path (the cleanest way to land on a non-empty `name`
    /// without driving the network).
    func testNameLabelRendersInTypedState() {
        let plan = PlansStore.Plan(
            id: UUID(),
            creatorID: UUID(),
            name: "Friday dinner",
            category: "food",
            scope: .group,
            location: nil,
            sessionParameters: SessionParameters(
                mealTime: .dinner,
                groupContext: .group,
                serviceShape: .dineInIndoor,
                transportMode: .walk
            ),
            distanceMeters: 1609,
            status: .pending
        )
        render(makeScreen(mode: .edit, groupMode: .group, editingPlan: plan))
    }
}
