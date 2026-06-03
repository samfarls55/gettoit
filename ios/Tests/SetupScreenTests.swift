// GetToIt — SetupScreen pure-logic tests (tb-WF-4).
//
// Coverage:
//   * Search area — C-28 chip copy, radius formatting, and persistence
//     through existing Plan location + distance storage.
//   * Mode-conditional rendering count — solo path omits the `Who's
//     coming` chip row entirely (4 controls); group path renders 5
//     with `Just me` removed from the chip options.
//   * Name validation — empty trims → CTAs disabled, non-empty → enabled.
//   * Primary CTA copy swaps on the group scope (solo → "Start the
//     quiz", duo/group → "Drop the invite link") — same JSX contract.
//   * Headline + secondary-CTA copy swap on `.create` vs `.edit` mode.
//   * Edit-mode entry path — a `solo` Plan re-opens in `.solo` mode;
//     `duo` / `group` re-open in `.group` mode (per Amendment 2026-05-20
//     in the issue body).
//
// Integration coverage for the Plan + Room mint is in
// `RoomStoreIntegrationTests` (room linking to plan via `plan_id`) and
// `PlansStoreTests` (already cover the insert payload shape).

import XCTest
import CoreLocation
import Supabase
@testable import GetToIt

@MainActor
final class SetupScreenTests: XCTestCase {

    private func makeClient() -> SupabaseClient {
        SupabaseClient(
            supabaseURL: URL(string: "https://example.supabase.co")!,
            supabaseKey: "test-anon-key"
        )
    }

    private func makeScreen(
        mode: SetupScreen.Mode = .create,
        groupMode: SetupScreen.GroupMode = .group,
        locationCoordinator: LocationCoordinator = LocationCoordinator(),
        editingPlan: PlansStore.Plan? = nil
    ) -> SetupScreen {
        let client = makeClient()
        return SetupScreen(
            mode: mode,
            groupMode: groupMode,
            plansStore: PlansStore(client: client),
            roomStore: RoomStore(client: client),
            userID: UUID(),
            locationCoordinator: locationCoordinator,
            editingPlan: editingPlan
        )
    }

    private func makePlan(
        name: String,
        location: PlansStore.Location?,
        distanceMeters: Int
    ) -> PlansStore.Plan {
        PlansStore.Plan(
            id: UUID(),
            creatorID: UUID(),
            name: name,
            category: "food",
            scope: .group,
            location: location,
            sessionParameters: SessionParameters.default,
            distanceMeters: distanceMeters,
            status: .pending
        )
    }

    // MARK: - search area chip + radius foundation (tb-SA-1)

    func testSearchAreaChipCopy() {
        XCTAssertEqual(SetupScreen.emptySearchAreaMainCopy(), "Set search area")
        XCTAssertEqual(SetupScreen.emptySearchAreaSupportCopy(), "Tap to choose on map")
        XCTAssertEqual(
            SetupScreen.searchAreaSupportCopy(radiusMeters: SetupScreen.metersFromMiles(2.0)),
            "Search area - 2.0 mi"
        )
        XCTAssertEqual(
            SetupScreen.searchAreaRadiusBadgeCopy(radiusMeters: SetupScreen.metersFromMiles(2.0)),
            "2.0 MI RADIUS"
        )
    }

    func testSearchAreaViewportRadiusUsesNearestVisibleEdge() {
        let viewport = SetupScreen.SearchAreaViewport(
            centerLat: 37.7767,
            centerLng: -122.4241,
            latitudeDelta: 0.04,
            longitudeDelta: 0.20
        )

        let radius = SetupScreen.searchAreaRadiusMeters(from: viewport)

        let center = CLLocation(latitude: viewport.centerLat, longitude: viewport.centerLng)
        let nearestVerticalEdge = CLLocation(
            latitude: viewport.centerLat + viewport.latitudeDelta / 2.0,
            longitude: viewport.centerLng
        )
        XCTAssertEqual(radius, Int(center.distance(from: nearestVerticalEdge).rounded()))
    }

    func testSearchAreaViewportDraftUpdatesCenterAndRadiusOnly() {
        let committed = SetupScreen.SearchArea(
            centerLabel: "Hayes Valley",
            lat: 37.7767,
            lng: -122.4241,
            source: "manual",
            timeZoneIdentifier: "America/Los_Angeles",
            radiusMeters: SetupScreen.metersFromMiles(2.0)
        )
        let viewport = SetupScreen.SearchAreaViewport(
            centerLat: 37.7599,
            centerLng: -122.4148,
            latitudeDelta: 0.03,
            longitudeDelta: 0.12
        )

        let draft = SetupScreen.searchArea(fromViewport: viewport, previousDraft: committed)

        XCTAssertEqual(draft.lat, viewport.centerLat, accuracy: 0.0001)
        XCTAssertEqual(draft.lng, viewport.centerLng, accuracy: 0.0001)
        XCTAssertEqual(draft.radiusMeters, SetupScreen.searchAreaRadiusMeters(from: viewport))
        XCTAssertEqual(draft.source, committed.source)
        XCTAssertEqual(draft.timeZoneIdentifier, committed.timeZoneIdentifier)
        XCTAssertEqual(committed.centerLabel, "Hayes Valley", "viewport movement must not mutate the committed value")
    }

    func testSearchAreaRadiusStepControlsUseLockedStops() {
        let area = SetupScreen.SearchArea(
            centerLabel: "Hayes Valley",
            lat: 37.7767,
            lng: -122.4241,
            source: "manual",
            timeZoneIdentifier: "America/Los_Angeles",
            radiusMeters: SetupScreen.metersFromMiles(2.0)
        )

        XCTAssertEqual(
            SetupScreen.searchAreaAfterRadiusStep(area, offset: 1).radiusMeters,
            SetupScreen.metersFromMiles(2.5)
        )
        XCTAssertEqual(
            SetupScreen.searchAreaAfterRadiusStep(area, offset: -1).radiusMeters,
            SetupScreen.metersFromMiles(1.5)
        )

        let minArea = SetupScreen.SearchArea(
            centerLabel: "Min",
            lat: 0,
            lng: 0,
            source: "manual",
            timeZoneIdentifier: "UTC",
            radiusMeters: SetupScreen.metersFromMiles(0.25)
        )
        let maxArea = SetupScreen.SearchArea(
            centerLabel: "Max",
            lat: 0,
            lng: 0,
            source: "manual",
            timeZoneIdentifier: "UTC",
            radiusMeters: SetupScreen.metersFromMiles(10.0)
        )
        XCTAssertEqual(
            SetupScreen.searchAreaAfterRadiusStep(minArea, offset: -1).radiusMeters,
            SetupScreen.metersFromMiles(0.25)
        )
        XCTAssertEqual(
            SetupScreen.searchAreaAfterRadiusStep(maxArea, offset: 1).radiusMeters,
            SetupScreen.metersFromMiles(10.0)
        )
    }

    func testFirstOpenSearchAreaDefaultUsesCurrentLocationPlusTwoMiles() {
        let place = ResolvedPlace(
            id: "current:hayes",
            name: "Current location",
            sub: "San Francisco",
            coordinate: .init(latitude: 37.7767, longitude: -122.4241),
            source: .gps,
            timeZone: TimeZone(identifier: "America/Los_Angeles") ?? .current
        )

        let draft = SetupScreen.searchArea(
            from: place,
            radiusMeters: SetupScreen.metersFromMiles(SetupScreen.firstOpenSearchAreaRadiusMiles)
        )

        XCTAssertEqual(draft.centerLabel, "Current location")
        XCTAssertEqual(draft.radiusMeters, SetupScreen.metersFromMiles(2.0))
    }

    func testSearchAreaCloseDecisionCleanVsDirty() {
        let committed = SetupScreen.SearchArea(
            centerLabel: "Hayes Valley",
            lat: 37.7767,
            lng: -122.4241,
            source: "manual",
            timeZoneIdentifier: "America/Los_Angeles",
            radiusMeters: SetupScreen.metersFromMiles(2.0)
        )
        let pannedDraft = SetupScreen.SearchArea(
            centerLabel: "Map center",
            lat: 37.7599,
            lng: -122.4148,
            source: "manual",
            timeZoneIdentifier: "America/Los_Angeles",
            radiusMeters: SetupScreen.metersFromMiles(2.0)
        )
        let steppedDraft = SetupScreen.searchAreaAfterRadiusStep(committed, offset: 1)

        XCTAssertEqual(
            SetupScreen.searchAreaCloseDecision(draft: committed, committed: committed),
            .dismiss
        )
        XCTAssertEqual(
            SetupScreen.searchAreaCloseDecision(draft: pannedDraft, committed: committed),
            .prompt
        )
        XCTAssertEqual(
            SetupScreen.searchAreaCloseDecision(draft: steppedDraft, committed: committed),
            .prompt
        )
        XCTAssertEqual(
            SetupScreen.searchAreaCloseDecision(draft: nil, committed: nil),
            .dismiss
        )
    }

    func testSearchAreaCommitUsesDraftOnly() {
        let draft = SetupScreen.SearchArea(
            centerLabel: "Map center",
            lat: 37.7599,
            lng: -122.4148,
            source: "manual",
            timeZoneIdentifier: "America/Los_Angeles",
            radiusMeters: SetupScreen.metersFromMiles(2.5)
        )

        XCTAssertEqual(SetupScreen.committedSearchArea(fromDraft: draft), draft)
        XCTAssertNil(SetupScreen.committedSearchArea(fromDraft: nil))
    }

    func testLaunchWithoutSearchAreaOpensEditorGate() {
        XCTAssertTrue(
            SetupScreen.shouldOpenSearchAreaEditorOnLaunch(
                nameValid: true,
                hasCommittedSearchArea: false
            )
        )
        XCTAssertFalse(
            SetupScreen.shouldOpenSearchAreaEditorOnLaunch(
                nameValid: true,
                hasCommittedSearchArea: true
            )
        )
        XCTAssertFalse(
            SetupScreen.shouldOpenSearchAreaEditorOnLaunch(
                nameValid: false,
                hasCommittedSearchArea: false
            ),
            "empty-name launch stays on the name gate, not the search-area editor"
        )
    }

    func testEditPlanReloadsCommittedSearchAreaThroughExistingStorage() {
        let plan = makePlan(
            name: "Friday dinner",
            location: PlansStore.Location(
                name: "Mission District",
                lat: 37.7599,
                lng: -122.4148,
                source: "manual",
                timeZoneIdentifier: "America/Los_Angeles"
            ),
            distanceMeters: SetupScreen.metersFromMiles(2.5)
        )
        let screen = makeScreen(mode: .edit, editingPlan: plan)

        let payload = screen.snapshotPayload()

        XCTAssertEqual(payload.location?.name, "Mission District")
        XCTAssertEqual(payload.location?.lat ?? .nan, 37.7599, accuracy: 0.0001)
        XCTAssertEqual(payload.location?.lng ?? .nan, -122.4148, accuracy: 0.0001)
        XCTAssertEqual(payload.distanceMeters, SetupScreen.metersFromMiles(2.5))
    }

    func testCommittedSearchAreaCompilesToExistingLocationAndRadiusStorage() {
        let searchArea = SetupScreen.SearchArea(
            centerLabel: "Hayes Valley",
            lat: 37.7767,
            lng: -122.4241,
            source: "manual",
            timeZoneIdentifier: "America/Los_Angeles",
            radiusMeters: SetupScreen.metersFromMiles(3.0)
        )

        let planLocation = SetupScreen.planLocation(fromCommittedSearchArea: searchArea)
        let roomLocation = SetupScreen.roomLocation(fromCommittedSearchArea: searchArea)
        let radius = SetupScreen.payloadDistanceMeters(
            committedSearchArea: searchArea,
            fallbackDistanceMiles: SetupScreen.defaultDistanceMiles
        )

        XCTAssertEqual(planLocation?.name, "Hayes Valley")
        XCTAssertEqual(planLocation?.lat ?? .nan, 37.7767, accuracy: 0.0001)
        XCTAssertEqual(planLocation?.lng ?? .nan, -122.4241, accuracy: 0.0001)
        XCTAssertEqual(planLocation?.source, "manual")
        XCTAssertEqual(planLocation?.timeZoneIdentifier, "America/Los_Angeles")
        XCTAssertEqual(roomLocation?.name, "Hayes Valley")
        XCTAssertEqual(roomLocation?.lat ?? .nan, 37.7767, accuracy: 0.0001)
        XCTAssertEqual(roomLocation?.lng ?? .nan, -122.4241, accuracy: 0.0001)
        XCTAssertEqual(roomLocation?.source, .manual)
        XCTAssertEqual(roomLocation?.timeZoneIdentifier, "America/Los_Angeles")
        XCTAssertEqual(radius, SetupScreen.metersFromMiles(3.0))
    }

    func testFreshPlanDoesNotInheritLocationCoordinatorPlaceAsCommittedSearchArea() {
        let coordinator = LocationCoordinator()
        coordinator.commit(place: ResolvedPlace(
            id: "manual:previous",
            name: "Previous plan area",
            sub: "San Francisco",
            coordinate: .init(latitude: 37.77, longitude: -122.42),
            source: .manual,
            timeZone: TimeZone(identifier: "America/Los_Angeles") ?? .current
        ))
        let screen = makeScreen(mode: .create, locationCoordinator: coordinator)

        let payload = screen.snapshotPayload()

        XCTAssertNil(payload.location, "fresh Plans must not silently reuse a prior Plan's search area")
    }

    func testFreshPlanPayloadAllowsSaveForLaterWithoutSearchArea() {
        let screen = makeScreen(mode: .create)

        let payload = screen.snapshotPayload()

        XCTAssertNil(payload.location)
        XCTAssertEqual(payload.distanceMeters, SetupScreen.metersFromMiles(SetupScreen.defaultDistanceMiles))
    }

    // MARK: - distance/radius snap-list (workflow-overhaul Q8)

    /// The 17-stop schedule locked in `surfaces/01-setup.md` §"Distance
    /// slider". Mirrors the JSX `DISTANCE_STEPS` constant. Order
    /// matters — the slider snaps onChange to the nearest entry.
    func testDistanceStepsMatchTheLockedSchedule() {
        XCTAssertEqual(
            SetupScreen.distanceSteps,
            [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
        )
    }

    /// Default lands on `1.0 mi` per the spec (tick anchor).
    func testDistanceDefaultIsOneMile() {
        XCTAssertEqual(SetupScreen.defaultDistanceMiles, 1.0, accuracy: 0.001)
        XCTAssertTrue(SetupScreen.distanceSteps.contains(SetupScreen.defaultDistanceMiles))
    }

    /// The native slider slides through the smallest step (0.25 mi); the
    /// `snap` helper maps any continuous value to the nearest entry
    /// in `distanceSteps`. End-positions clamp inside the schedule.
    func testSnapDistanceMaps_endpoints_andInterior() {
        XCTAssertEqual(SetupScreen.snapDistance(0.0), 0.25, accuracy: 0.001,
            "below-range value clamps to the smallest stop")
        XCTAssertEqual(SetupScreen.snapDistance(0.25), 0.25, accuracy: 0.001)
        XCTAssertEqual(SetupScreen.snapDistance(0.4), 0.5, accuracy: 0.001,
            "0.4 mi snaps to 0.5 (nearer than 0.25 by 0.05)")
        XCTAssertEqual(SetupScreen.snapDistance(1.0), 1.0, accuracy: 0.001)
        XCTAssertEqual(SetupScreen.snapDistance(1.2), 1.0, accuracy: 0.001,
            "1.2 snaps down to 1.0 (closer than 1.5)")
        XCTAssertEqual(SetupScreen.snapDistance(1.3), 1.5, accuracy: 0.001,
            "1.3 snaps up to 1.5")
        XCTAssertEqual(SetupScreen.snapDistance(5.5), 5.0, accuracy: 0.001,
            "5.5 snaps to 5.0 (tied with 6.0 — lower-index wins on tie)")
        XCTAssertEqual(SetupScreen.snapDistance(5.6), 6.0, accuracy: 0.001,
            "5.6 snaps to 6.0")
        XCTAssertEqual(SetupScreen.snapDistance(10.0), 10.0, accuracy: 0.001)
        XCTAssertEqual(SetupScreen.snapDistance(15.0), 10.0, accuracy: 0.001,
            "above-range value clamps to the top stop")
    }

    /// bug-30 — `snapDistance` originally force-unwrapped `distanceSteps.first!`
    /// / `distanceSteps.last!`. The fix replaces both with `??` fallbacks
    /// (`0` floor, `Self.maxDistanceMiles` ceiling) per CODING_STANDARDS.md
    /// rule OPT-001. Behavior is observably identical because
    /// `distanceSteps` is a static-let literal, but the three acceptance
    /// criteria from the bug-30 spec are pinned here so a future
    /// regression that breaks the clamp / passthrough contract fails
    /// loud — and so the snap helper is exercised at the exact endpoints
    /// the spec named.
    func testSnapDistance_bug30AcceptanceCriteria() {
        guard
            let first = SetupScreen.distanceSteps.first,
            let last = SetupScreen.distanceSteps.last
        else {
            return XCTFail("distanceSteps must be non-empty")
        }
        XCTAssertEqual(SetupScreen.snapDistance(-1), first, accuracy: 0.001,
            "negative input clamps to the first stop")
        XCTAssertEqual(SetupScreen.snapDistance(100), last, accuracy: 0.001,
            "far-above-range input clamps to the last stop")
        let interior = SetupScreen.distanceSteps[2]
        XCTAssertEqual(SetupScreen.snapDistance(interior), interior, accuracy: 0.001,
            "an exact stop passes through unchanged")
    }

    /// `metersFromMiles` — uses the same canonical conversion as the
    /// existing radius column writer (1609.344). The Plan column is
    /// `distance_meters`, default 1609 (≈ 1.0 mi).
    func testMetersFromMilesMatchesPlanColumnDefault() {
        XCTAssertEqual(SetupScreen.metersFromMiles(1.0), 1609,
            "1.0 mi → 1609 m matches plans.distance_meters default")
        XCTAssertEqual(SetupScreen.metersFromMiles(0.25), 402)
        XCTAssertEqual(SetupScreen.metersFromMiles(10.0), 16093)
    }

    // MARK: - mode-conditional rendering

    /// Per tb-SA-1: the separate location + distance controls collapse
    /// into one Search area chip. Solo omits `Who's coming`; group
    /// keeps that row but still renders one geography control.
    func testControlsRenderedSoloOmitsWhosComing() {
        XCTAssertEqual(SetupScreen.controlsRendered(for: .solo), 4,
            "solo path omits Who's coming and has one Search area control")
        XCTAssertEqual(SetupScreen.controlsRendered(for: .group), 5,
            "group path renders one Search area control instead of separate location and distance")
    }

    /// `Who's coming` chip options on the group path drop `Just me`
    /// (the user already disambiguated upstream via the create-Plan
    /// affordance — disambig sheet lives in tb-WF-6).
    func testWhosComingOptionsGroupModeOmitsJustMe() {
        let solo = SetupScreen.whosComingOptions(for: .solo)
        XCTAssertTrue(solo.isEmpty, "solo path renders no Who's coming chips")

        let group = SetupScreen.whosComingOptions(for: .group)
        XCTAssertEqual(group, [.duo, .group],
            "group path keeps Two of us / A group, drops Just me")
    }

    // MARK: - persistent name field label (wfr-26)

    /// wfr-26 — the persistent label copy above the name input. The
    /// label is the **field label** (not the section eyebrow it
    /// replaces). Sentence case, second-person casual register —
    /// matches the placeholder's verb phrase so the field and its label
    /// read as a single Input Prompt + Label pair per
    /// `patterns.md` §"Input Prompt" + §"Input Hints".
    func testNameLabelCopy() {
        XCTAssertEqual(SetupScreen.nameLabelCopy(), "Name this plan")
    }

    // MARK: - name validation

    /// Both dock CTAs gate on `name.trim().length > 0` per
    /// `surfaces/01-setup.md` §Validation.
    func testNameValidation() {
        XCTAssertFalse(SetupScreen.isNameValid(""))
        XCTAssertFalse(SetupScreen.isNameValid("   "))
        XCTAssertFalse(SetupScreen.isNameValid("\n\t"))
        XCTAssertTrue(SetupScreen.isNameValid("a"))
        XCTAssertTrue(SetupScreen.isNameValid("Friday dinner"))
        // 40-char cap is enforced by `maxLength` on the TextField; the
        // pure validator just confirms non-empty. PlansStore.isValidName
        // owns the 1..40 contract via the SQL CHECK constraint.
    }

    // MARK: - primary CTA copy (group context swap)

    /// Primary CTA copy swaps on the live `groupContext` selection per
    /// the surface doc §Modes. Solo gets `Start the quiz`; the two
    /// group options get `Drop the invite link`.
    func testPrimaryCTACopyForGroupContext() {
        XCTAssertEqual(SetupScreen.primaryCTACopy(for: .solo), "Start the quiz")
        XCTAssertEqual(SetupScreen.primaryCTACopy(for: .duo), "Drop the invite link")
        XCTAssertEqual(SetupScreen.primaryCTACopy(for: .group), "Drop the invite link")
    }

    // MARK: - mode-driven headline + secondary copy

    func testHeadlineCopyForCreateAndEditModes() {
        XCTAssertEqual(SetupScreen.headlineCopy(for: .create), "Start a new plan")
        XCTAssertEqual(SetupScreen.headlineCopy(for: .edit),   "Edit your plan")
    }

    func testSecondaryCTACopyForCreateAndEditModes() {
        XCTAssertEqual(SetupScreen.secondaryCTACopy(for: .create), "SAVE FOR LATER")
        XCTAssertEqual(SetupScreen.secondaryCTACopy(for: .edit),   "SAVE CHANGES")
    }

    // MARK: - edit-mode entry path (Plan.scope → SetupScreen.mode)

    /// Amendment 2026-05-20: a `solo` Plan re-opens in Solo Setup;
    /// `duo` / `group` re-open in Group Setup.
    func testSetupModeForPlanScope() {
        XCTAssertEqual(SetupScreen.setupMode(for: .solo),  .solo)
        XCTAssertEqual(SetupScreen.setupMode(for: .duo),   .group)
        XCTAssertEqual(SetupScreen.setupMode(for: .group), .group)
    }

    // MARK: - PlansStore.Scope mapping for the chip selection

    /// On the group path, picking the `Two of us` chip writes
    /// `Plan.scope = .duo`; picking `A group` writes `.group`. The
    /// solo path never asks — the upstream disambig (tb-WF-6) wrote
    /// `.solo` and the chip row is hidden.
    func testPlanScopeFromChipSelection() {
        XCTAssertEqual(SetupScreen.planScope(from: .duo,   setupMode: .group), .duo)
        XCTAssertEqual(SetupScreen.planScope(from: .group, setupMode: .group), .group)
        // In solo mode the chip is unreachable; the Plan scope is locked
        // to `.solo` regardless of what's held in state.
        XCTAssertEqual(SetupScreen.planScope(from: .duo,   setupMode: .solo),  .solo)
        XCTAssertEqual(SetupScreen.planScope(from: .group, setupMode: .solo),  .solo)
    }

    // MARK: - back-cancel persistence policy (workflow-overhaul Q11)

    /// `create` mode + name non-empty → auto-save the Plan.
    /// `create` mode + empty name → discard, no Plan minted.
    /// `edit` mode → always auto-save (name is non-empty by definition).
    func testShouldAutoSaveOnBack() {
        XCTAssertTrue(SetupScreen.shouldAutoSaveOnBack(mode: .create, name: "Friday"))
        XCTAssertFalse(SetupScreen.shouldAutoSaveOnBack(mode: .create, name: ""))
        XCTAssertFalse(SetupScreen.shouldAutoSaveOnBack(mode: .create, name: "   "))
        XCTAssertTrue(SetupScreen.shouldAutoSaveOnBack(mode: .edit,   name: "Already named"))
    }

    // MARK: - distance default → Plan column default (1609 m)

    /// The Plan column's default is `distance_meters int default 1609`
    /// (≈ 1.0 mi). SetupScreen's `defaultDistanceMiles` × 1609.344
    /// rounds to that same value, so a Setup → Plan write that the
    /// user never adjusted ships exactly the column default.
    func testDefaultDistanceMatchesPlanColumnDefault() {
        XCTAssertEqual(SetupScreen.metersFromMiles(SetupScreen.defaultDistanceMiles), 1609,
            "defaultDistanceMiles → meters must match plans.distance_meters default of 1609")
    }

    // MARK: - disabled-state CTA affordance (wfr-09)

    /// wfr-09 — when the dock CTAs are disabled (name empty), opacity
    /// alone fails low-vision + colorblind users. Both CTAs swap their
    /// label to a non-opacity affordance — a "name your plan" prompt
    /// that names exactly what is missing. Acceptance criterion #1:
    /// "Disabled CTA carries a visible label change or icon."
    ///
    /// Voice register: warm-friend, second-person imperative — never
    /// `"Name required"` (form-field register).

    func testPrimaryCTADisabledCopyIsDistinctFromEveryEnabledState() {
        let disabled = SetupScreen.primaryCTADisabledCopy()
        XCTAssertFalse(disabled.isEmpty, "disabled label must not be empty")
        XCTAssertNotEqual(disabled, SetupScreen.primaryCTACopy(for: .solo))
        XCTAssertNotEqual(disabled, SetupScreen.primaryCTACopy(for: .duo))
        XCTAssertNotEqual(disabled, SetupScreen.primaryCTACopy(for: .group))
    }

    func testSecondaryCTADisabledCopyIsDistinctFromEveryEnabledState() {
        let disabled = SetupScreen.secondaryCTADisabledCopy()
        XCTAssertFalse(disabled.isEmpty, "disabled label must not be empty")
        XCTAssertNotEqual(disabled, SetupScreen.secondaryCTACopy(for: .create))
        XCTAssertNotEqual(disabled, SetupScreen.secondaryCTACopy(for: .edit))
    }

    /// Voice register check — the disabled copy must read as the
    /// warm-friend, second-person directive the design system codifies
    /// (per `surfaces/01-setup.md` §"Copy register" + `README.md`
    /// product invariant #1). The required substring is the load-bearing
    /// word: the user must "name" their plan. Forbidden form-field
    /// register: `required` / `field` / `error`.
    func testDisabledCopyUsesWarmFriendRegister() {
        let primary = SetupScreen.primaryCTADisabledCopy().lowercased()
        let secondary = SetupScreen.secondaryCTADisabledCopy().lowercased()
        for copy in [primary, secondary] {
            XCTAssertTrue(copy.contains("name"),
                "disabled copy must name what's missing — got \(copy)")
            XCTAssertFalse(copy.contains("required"),
                "disabled copy must not use form-field register — got \(copy)")
            XCTAssertFalse(copy.contains("error"),
                "disabled copy must not use form-field register — got \(copy)")
        }
    }

    /// The label-to-display picker — chooses between the enabled and
    /// disabled label by the same `nameValid` gate the `.disabled(...)`
    /// modifier reads. This is the single source of truth the view body
    /// reads when rendering the dock label.
    func testPrimaryLabelToDisplaySwapsOnNameValid() {
        XCTAssertEqual(
            SetupScreen.primaryLabelToDisplay(nameValid: false, groupContext: .group),
            SetupScreen.primaryCTADisabledCopy(),
            "disabled state shows the affordance label, not the enabled label"
        )
        XCTAssertEqual(
            SetupScreen.primaryLabelToDisplay(nameValid: true, groupContext: .group),
            SetupScreen.primaryCTACopy(for: .group)
        )
        XCTAssertEqual(
            SetupScreen.primaryLabelToDisplay(nameValid: true, groupContext: .solo),
            SetupScreen.primaryCTACopy(for: .solo)
        )
        XCTAssertEqual(
            SetupScreen.primaryLabelToDisplay(nameValid: true, groupContext: .duo),
            SetupScreen.primaryCTACopy(for: .duo)
        )
    }

    func testSecondaryLabelToDisplaySwapsOnNameValid() {
        XCTAssertEqual(
            SetupScreen.secondaryLabelToDisplay(nameValid: false, mode: .create),
            SetupScreen.secondaryCTADisabledCopy()
        )
        XCTAssertEqual(
            SetupScreen.secondaryLabelToDisplay(nameValid: false, mode: .edit),
            SetupScreen.secondaryCTADisabledCopy()
        )
        XCTAssertEqual(
            SetupScreen.secondaryLabelToDisplay(nameValid: true, mode: .create),
            SetupScreen.secondaryCTACopy(for: .create)
        )
        XCTAssertEqual(
            SetupScreen.secondaryLabelToDisplay(nameValid: true, mode: .edit),
            SetupScreen.secondaryCTACopy(for: .edit)
        )
    }

    // MARK: - input hints (wfr-24)

    /// Name hint names the 40-char cap so users feel the limit before
    /// they hit it. The surface doc originally framed the cap as
    /// "users feel the limit by hitting it" — wfr-24 (2026-05-26)
    /// overrides that line per the Input Hints foundation gate.
    func testNameHintCopy() {
        let hint = SetupScreen.nameHintCopy()
        XCTAssertFalse(hint.isEmpty, "name hint must not be empty")
        XCTAssertTrue(hint.contains("40"),
            "name hint must name the 40-char cap — got \(hint)")
    }

    /// Voice register check — the name hint must read in the
    /// warm-friend, casual register the surface codifies, never the
    /// form-field register the workflow-review explicitly rejects.
    func testHintCopyUsesWarmFriendRegister() {
        let hints = [SetupScreen.nameHintCopy()]
        for hint in hints {
            let lower = hint.lowercased()
            XCTAssertFalse(lower.contains("required"),
                "hint copy must not use form-field register — got \(hint)")
            XCTAssertFalse(lower.contains("error"),
                "hint copy must not use form-field register — got \(hint)")
            XCTAssertFalse(lower.contains(" field"),
                "hint copy must not use form-field register — got \(hint)")
        }
    }

    // MARK: - field-level error routing (wfr-25)

    /// wfr-25 — errors are routed to the field that failed (name,
    /// distance) or kept at the top of the dock for cross-field /
    /// network failures per `patterns.md` §"Error Messages" + the
    /// run report finding #25. Routing is encoded as a pure
    /// classifier so the view body has a single source of truth and
    /// the routing is unit-testable independent of the network.

    /// PostgREST CHECK violations on the `name` column (1..40 char
    /// guard) route to the `.name` field. Match is case-insensitive
    /// substring so any error message mentioning "name" is bucketed
    /// to the field — the user's signal-to-noise is higher when an
    /// ambiguous name error sits at the name field than at top-of-dock.
    func testClassifyFailureRoutesNameErrorsToNameField() {
        let cases: [String] = [
            "value too long for type character varying(40)",
            "name must be 1..40 characters",
            "plans_name_check violated",
            "NAME cannot be empty",
        ]
        for raw in cases {
            let classified = SetupScreen.classifyPersistFailure(messageLike: raw)
            XCTAssertEqual(classified.field, .name,
                "expected .name routing for \(raw) — got \(classified.field)")
            XCTAssertFalse(classified.message.isEmpty,
                "field error message must not be empty")
        }
    }

    /// PostgREST CHECK violations on `distance_meters` (>= 0 / sane
    /// range) route to the `.distance` field. Substring match covers
    /// both the column name and the user-facing word.
    func testClassifyFailureRoutesDistanceErrorsToDistanceField() {
        let cases: [String] = [
            "distance_meters out of range",
            "Distance must be positive",
            "plans_distance_check violated",
        ]
        for raw in cases {
            let classified = SetupScreen.classifyPersistFailure(messageLike: raw)
            XCTAssertEqual(classified.field, .distance,
                "expected .distance routing for \(raw) — got \(classified.field)")
            XCTAssertFalse(classified.message.isEmpty,
                "field error message must not be empty")
        }
    }

    /// Errors that don't match a known field (network failure, RLS
    /// deny, unknown CHECK) route to the cross-field bucket — the
    /// top-of-dock fallback. This is the existing v1 behavior; wfr-25
    /// preserves it for cross-field + network failures explicitly.
    func testClassifyFailureRoutesUnknownErrorsToCrossField() {
        let cases: [String] = [
            "URLError: not connected to the internet",
            "PostgrestError: row-level security policy denied",
            "timeout while waiting for response",
            "",
        ]
        for raw in cases {
            let classified = SetupScreen.classifyPersistFailure(messageLike: raw)
            XCTAssertEqual(classified.field, .crossField,
                "expected .crossField routing for \(raw) — got \(classified.field)")
            XCTAssertFalse(classified.message.isEmpty,
                "cross-field error message must not be empty")
        }
    }

    /// Voice register — all three error copies (name / distance /
    /// cross-field) must stay in the warm-friend register the surface
    /// codifies. Never `"required"` / `" field"` (form-field register).
    /// The word `"error"` is allowed in the cross-field generic copy
    /// since it names the failure to the user.
    func testFieldErrorCopyUsesWarmFriendRegister() {
        let copies = [
            SetupScreen.classifyPersistFailure(messageLike: "name violates check").message,
            SetupScreen.classifyPersistFailure(messageLike: "distance out of range").message,
            SetupScreen.classifyPersistFailure(messageLike: "network down").message,
        ]
        for copy in copies {
            let lower = copy.lowercased()
            XCTAssertFalse(lower.contains("required"),
                "error copy must not use form-field register — got \(copy)")
            XCTAssertFalse(lower.contains(" field"),
                "error copy must not use form-field register — got \(copy)")
        }
    }

    /// Failure-to-route action — `classifyPersistFailure(_:)` takes a
    /// Swift `Error` and forwards to the substring matcher. Verifies the
    /// `Error` overload exists and matches the string overload for the
    /// same underlying message.
    func testClassifyPersistFailureErrorOverload() {
        struct FakeError: LocalizedError {
            var errorDescription: String? { "name must be 1..40 characters" }
        }
        let viaError = SetupScreen.classifyPersistFailure(FakeError())
        XCTAssertEqual(viaError.field, .name)
    }
}
