// GetToIt — S01 · Plan setup (tb-WF-4, workflow-overhaul).
//
// The canonical Plan creation + Plan edit surface — one screen that
// collapses today's S01 (Initiator landing) + S01b (Pre-quiz
// parameters) into a single Setup screen. Lands the iOS port of the
// design-system spec at `design-system/surfaces/01-setup.md` +
// `design-system/code/screens/ScreenSetup.jsx`.
//
// Two orthogonal modes drive the surface:
//   * Lifecycle mode (`Mode`) — `.create` (new Plan) vs `.edit`
//     (existing pending Plan). Drives headline + secondary CTA copy.
//   * Group mode (`GroupMode`) — `.solo` vs `.group`. Amendment
//     2026-05-20 lifted the `Who's coming` choice out of Setup into a
//     pre-Setup disambig sheet (tb-WF-6). The solo path renders 4
//     controls (no `Who's coming` row at all); the group path renders
//     5 controls with the `Just me` chip option dropped.
//
// Persistence + behavior (per `surfaces/01-setup.md` §"Persistence +
// behavior"):
//   * Primary CTA — mints a `plans` row as `pending` (PlansStore)
//     AND immediately mints a `rooms` row linked to that Plan via
//     `rooms.plan_id`, then fires the existing invite / quiz flow.
//   * Secondary CTA (`SAVE FOR LATER` / `SAVE CHANGES`) — mints (or
//     updates) the Plan only. No Room is minted. Returns to the
//     Plan list (or S00 Landing until tb-WF-5 lands the iOS list).
//   * Top-bar back/cancel — same as the secondary CTA when the name
//     is non-empty; an empty name in `.create` mode discards and
//     returns. Edit mode is name-non-empty by definition (existing
//     Plan), so the empty-discard branch is impossible from edit.
//
// All visual values come from `GTITokens.swift`. No inline hex / px /
// easing per repo AGENTS.md. The chip primitive matches today's S01b
// chips (sun fill / ink text on selected, glass row default), the
// Search area is the C-28 chip + full-screen editor shell. It persists
// through the existing Plan location + distance columns; the full map
// pan/pinch behavior lands in tb-SA-2.
//
import SwiftUI
import UIKit

@MainActor
public struct SetupScreen: View {

    // MARK: - mode types

    /// Lifecycle mode — drives headline + secondary CTA copy. The user
    /// state machine is the same in both branches.
    public enum Mode: Equatable, Sendable {
        /// Brand-new Plan. Defaults populate every control.
        case create
        /// Existing pending Plan being re-opened from the list.
        case edit
    }

    /// Group mode — Amendment 2026-05-20. Pre-Setup disambig (tb-WF-6
    /// owns the FAB sheet wiring) supplies this; in solo mode the
    /// `Who's coming` row is omitted, in group mode the `Just me`
    /// chip is omitted from the chip set.
    public enum GroupMode: Equatable, Sendable {
        case solo
        case group
    }

    /// C-28 committed Search area value. The storage stays on the
    /// existing Plan/Room fields: `location` carries center metadata
    /// and `distance_meters` carries radius.
    public struct SearchArea: Equatable, Sendable {
        public let centerLabel: String
        public let lat: Double
        public let lng: Double
        public let source: String
        public let timeZoneIdentifier: String
        public let radiusMeters: Int

        public init(
            centerLabel: String,
            lat: Double,
            lng: Double,
            source: String,
            timeZoneIdentifier: String,
            radiusMeters: Int
        ) {
            self.centerLabel = centerLabel
            self.lat = lat
            self.lng = lng
            self.source = source
            self.timeZoneIdentifier = timeZoneIdentifier
            self.radiusMeters = radiusMeters
        }
    }

    // MARK: - locked schedule + helpers (workflow-overhaul Q8)

    /// Composed non-uniform snap-list — 17 stops. Mirrors the JSX's
    /// `DISTANCE_STEPS`. The native slider slides through the smallest
    /// step (0.25 mi); on commit we snap to the nearest entry here.
    public static let distanceSteps: [Double] = [
        0.25, 0.5, 0.75,
        1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
        6.0, 7.0, 8.0, 9.0, 10.0,
    ]

    /// Default lands on `1.0 mi` per the spec — the same value that
    /// hosts the visual tick. Plan.distance_meters column default is
    /// `1609` (≈ 1.0 mi).
    public static let defaultDistanceMiles: Double = 1.0

    /// Radius min / max. Min/max match the schedule's endpoints; the
    /// snap helper handles out-of-range values defensively.
    public static let minDistanceMiles: Double = 0.25
    public static let maxDistanceMiles: Double = 10.0

    /// Snap a continuous radius value to the nearest stop in
    /// `distanceSteps`. Out-of-range values clamp to
    /// the nearest endpoint. On a tie (equidistant from two stops),
    /// the lower-index (smaller) stop wins — same behavior as the JSX
    /// reduce (`Math.abs(stop - v) <` is strict).
    public static func snapDistance(_ value: Double) -> Double {
        // `distanceSteps` is a static-let literal, so `first` / `last` are
        // never nil in practice — but per CODING_STANDARDS rule OPT-001
        // (bug-30) we still avoid the force-unwrap. Defensive fallbacks:
        // 0 for the floor, `Self.maxDistanceMiles` for the ceiling. Both
        // are already declared adjacent and bracket the legal range.
        let firstStop = distanceSteps.first ?? 0
        let lastStop = distanceSteps.last ?? Self.maxDistanceMiles
        if value <= firstStop { return firstStop }
        if value >= lastStop { return lastStop }
        var best = distanceSteps[0]
        var bestDistance = abs(value - best)
        for stop in distanceSteps.dropFirst() {
            let d = abs(value - stop)
            if d < bestDistance {
                best = stop
                bestDistance = d
            }
        }
        return best
    }

    /// Canonical miles → meters conversion. Same factor `RoomStore` /
    /// `InitiatorScreen` historically used (1609.344). The Plan
    /// column is `distance_meters int default 1609`.
    public static let metersPerMile: Double = 1609.344
    public static func metersFromMiles(_ miles: Double) -> Int {
        Int((miles * metersPerMile).rounded())
    }

    public static func milesFromMeters(_ meters: Int) -> Double {
        Double(meters) / metersPerMile
    }

    public static func emptySearchAreaMainCopy() -> String {
        "Set search area"
    }

    public static func emptySearchAreaSupportCopy() -> String {
        "Tap to choose on map"
    }

    public static func searchAreaSupportCopy(radiusMeters: Int) -> String {
        String(format: "Search area - %.1f mi", milesFromMeters(radiusMeters))
    }

    public static func searchAreaRadiusBadgeCopy(radiusMeters: Int) -> String {
        String(format: "%.1f MI RADIUS", milesFromMeters(radiusMeters))
    }

    public static func shouldOpenSearchAreaEditorOnLaunch(
        nameValid: Bool,
        hasCommittedSearchArea: Bool
    ) -> Bool {
        nameValid && !hasCommittedSearchArea
    }

    public static func searchArea(from plan: PlansStore.Plan) -> SearchArea? {
        guard let location = plan.location else { return nil }
        return SearchArea(
            centerLabel: location.name,
            lat: location.lat,
            lng: location.lng,
            source: location.source,
            timeZoneIdentifier: location.timeZoneIdentifier,
            radiusMeters: plan.distanceMeters
        )
    }

    public static func searchArea(
        from place: ResolvedPlace,
        radiusMeters: Int
    ) -> SearchArea {
        SearchArea(
            centerLabel: place.name,
            lat: place.coordinate.latitude,
            lng: place.coordinate.longitude,
            source: place.source.rawValue,
            timeZoneIdentifier: place.timeZone.identifier,
            radiusMeters: radiusMeters
        )
    }

    /// Build a `PlansStore.Location` from the committed Search area.
    /// Returns nil when no area is committed: Save for later may write
    /// a pending Plan without Search area, but launch is gated.
    static func planLocation(fromCommittedSearchArea searchArea: SearchArea?) -> PlansStore.Location? {
        guard let searchArea else { return nil }
        return PlansStore.Location(
            name: searchArea.centerLabel,
            lat: searchArea.lat,
            lng: searchArea.lng,
            source: searchArea.source,
            timeZoneIdentifier: searchArea.timeZoneIdentifier
        )
    }

    /// Build the matching `RoomStore.RoomLocation` for the room mint
    /// from the committed Search area.
    static func roomLocation(fromCommittedSearchArea searchArea: SearchArea?) -> RoomStore.RoomLocation? {
        guard let searchArea else { return nil }
        let source = RoomStore.RoomLocation.Source(rawValue: searchArea.source) ?? .manual
        return RoomStore.RoomLocation(
            name: searchArea.centerLabel,
            lat: searchArea.lat,
            lng: searchArea.lng,
            source: source,
            timeZoneIdentifier: searchArea.timeZoneIdentifier
        )
    }

    /// Choose the radius value to write to existing `distance_meters`
    /// storage: committed Search area radius when present, otherwise
    /// the fallback Setup default for pending-save without Search area.
    static func payloadDistanceMeters(
        committedSearchArea: SearchArea?,
        fallbackDistanceMiles: Double
    ) -> Int {
        committedSearchArea?.radiusMeters ?? metersFromMiles(fallbackDistanceMiles)
    }

    // MARK: - pure mode helpers

    /// How many controls render for a given group mode. Used by tests
    /// to encode the Amendment 2026-05-20 rule. Production code reads
    /// this implicitly by branching on the GroupMode in the body.
    public static func controlsRendered(for mode: GroupMode) -> Int {
        switch mode {
        case .solo:  return 4
        case .group: return 5
        }
    }

    /// `Who's coming` chip options. Solo path renders no chips at all
    /// (the row is omitted entirely). Group path keeps `Two of us`
    /// and `A group` — `Just me` is dropped because the user
    /// disambiguated upstream.
    public static func whosComingOptions(for mode: GroupMode) -> [SessionParameters.GroupContext] {
        switch mode {
        case .solo:  return []
        case .group: return [.duo, .group]
        }
    }

    /// Primary CTA copy — swaps on the live group context. Solo gets
    /// `Start the quiz` (no one to invite); duo / group gets `Drop
    /// the invite link`.
    public static func primaryCTACopy(for context: SessionParameters.GroupContext) -> String {
        switch context {
        case .solo:           return "Start the quiz"
        case .duo, .group:    return "Drop the invite link"
        }
    }

    public static func headlineCopy(for mode: Mode) -> String {
        switch mode {
        case .create: return "Start a new plan"
        case .edit:   return "Edit your plan"
        }
    }

    public static func secondaryCTACopy(for mode: Mode) -> String {
        switch mode {
        case .create: return "SAVE FOR LATER"
        case .edit:   return "SAVE CHANGES"
        }
    }

    /// wfr-09 — disabled-state label for the **primary** dock CTA. When
    /// `nameValid` is false both dock CTAs are `.disabled(...)`; opacity
    /// alone (0.55 on the pill, 0.45 on the eyebrow link) fails low-vision
    /// + colorblind users per `design-system/accessibility.md` §1 + §8 and
    /// the workflow-review finding wfr-09 (2026-05-26). The disabled
    /// label swap names what's missing in warm-friend register — same
    /// voice as every other CTA on the surface (`README.md` invariant
    /// #1), never `"Name required"` (form-field register).
    public static func primaryCTADisabledCopy() -> String {
        "Name your plan"
    }

    /// wfr-09 — disabled-state label for the **secondary** dock link.
    /// Mirrors the primary disabled copy so VO and visual readers see a
    /// consistent missing-input signal on both affordances. Rendered in
    /// the same `eyebrow`-token UPPERCASE treatment as the enabled
    /// secondary copy so the swap is a copy change, not a treatment
    /// change.
    public static func secondaryCTADisabledCopy() -> String {
        "NAME YOUR PLAN"
    }

    /// Label-to-display picker for the primary CTA. The single source
    /// of truth the view body reads when rendering the dock — gates on
    /// the same `nameValid` predicate the `.disabled(...)` modifier
    /// reads, so the disabled state and the disabled label never drift.
    public static func primaryLabelToDisplay(
        nameValid: Bool,
        groupContext: SessionParameters.GroupContext
    ) -> String {
        nameValid ? primaryCTACopy(for: groupContext) : primaryCTADisabledCopy()
    }

    /// Label-to-display picker for the secondary dock link. Same
    /// `nameValid` gate as the primary; rendered in `eyebrow` treatment.
    public static func secondaryLabelToDisplay(
        nameValid: Bool,
        mode: Mode
    ) -> String {
        nameValid ? secondaryCTACopy(for: mode) : secondaryCTADisabledCopy()
    }

    /// Map an existing Plan's `scope` to the group mode the Edit
    /// surface renders. Amendment 2026-05-20: a `solo` Plan re-opens
    /// in Solo Setup; `duo` / `group` re-open in Group Setup.
    public static func setupMode(for scope: PlansStore.Scope) -> GroupMode {
        switch scope {
        case .solo:           return .solo
        case .duo, .group:    return .group
        }
    }

    /// Compile the Plan's `scope` from the chip selection. In solo
    /// mode the chip is hidden — the Plan scope is locked to `.solo`
    /// regardless of any state value. In group mode the chip choice
    /// drives the column.
    public static func planScope(
        from context: SessionParameters.GroupContext,
        setupMode: GroupMode
    ) -> PlansStore.Scope {
        switch setupMode {
        case .solo:
            return .solo
        case .group:
            switch context {
            case .solo:  return .solo   // unreachable in normal flow
            case .duo:   return .duo
            case .group: return .group
            }
        }
    }

    /// Pure validator — mirrors the JSX's `name.trim().length > 0`.
    /// The 40-char cap is enforced by the input itself; this is the
    /// non-empty gate.
    public static func isNameValid(_ raw: String) -> Bool {
        !raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // MARK: - persistent name label (wfr-26)

    /// wfr-26 — persistent field label above the name input. Replaces
    /// the section eyebrow that previously sat above the row
    /// (`NAME THIS PLAN`, eyebrow-token UPPERCASE treatment). The
    /// eyebrow read as a section heading; the audit (workflow-review
    /// 2026-05-26, finding #26) flagged the in-field placeholder as
    /// the only label because the eyebrow's visual register doesn't
    /// declare "this is the field's name". Pairs with the existing
    /// in-field Input Prompt placeholder (`Name this plan` inside the
    /// empty field) per `patterns.md` §"Input Prompt": "If you need
    /// both label + format hint, use a floating label with a separate
    /// Input Hints" — the label persists during and after typing while
    /// the placeholder disappears on type. Voice register matches the
    /// placeholder + the hint so the three layers read as one Input
    /// Prompt + Label + Hint group.
    public static func nameLabelCopy() -> String {
        "Name this plan"
    }

    // MARK: - input hints (wfr-24)

    /// wfr-24 — adjacent hint copy under the name input. Names the
    /// 40-char cap so users feel the limit before they hit it. This
    /// override against `surfaces/01-setup.md` §"Name input treatment"
    /// (which originally said "no truncation indicator — users feel
    /// the limit by hitting it") lands per the workflow-review
    /// Input Hints foundation gate (`patterns.md` §"Input Hints").
    public static func nameHintCopy() -> String {
        "Up to 40 characters"
    }

    // MARK: - field-level error routing (wfr-25)

    /// wfr-25 — which form field the failure should render against.
    /// `crossField` keeps the historical top-of-dock placement for
    /// network / RLS / unknown failures; `name` + `distance` route the
    /// message inline under the offending control per `patterns.md`
    /// §"Error Messages" + the run report finding #25.
    public enum FieldErrorField: Equatable, Sendable {
        case name
        case distance
        case crossField
    }

    /// wfr-25 — a routed error payload. The view body branches on
    /// `field` to position the `message`. Voice register is the same
    /// warm-friend / second-person treatment the rest of the surface
    /// uses (`patterns.md` §"Error Messages": "name the field, name
    /// the problem, suggest the fix" + the surface doc's §"Copy
    /// register"). Never form-field register.
    public struct FieldError: Equatable, Sendable {
        public let field: FieldErrorField
        public let message: String

        public init(field: FieldErrorField, message: String) {
            self.field = field
            self.message = message
        }
    }

    /// wfr-25 — classify a raw error message into the routing bucket
    /// the view should use. Pure substring matcher — covers the known
    /// PostgREST CHECK shapes (`plans_name_check`, `plans_distance_check`),
    /// the user-facing column names (`name`, `distance`), and the
    /// Postgres typed-overflow shape for the name column
    /// (`character varying(40)` — the SQL type of `plans.name`).
    /// Anything else falls through to `.crossField` so the historical
    /// top-of-dock fallback is preserved for network / RLS / unknown
    /// failures.
    public static func classifyPersistFailure(messageLike raw: String) -> FieldError {
        let lower = raw.lowercased()
        // Distance check first — `distance_meters` contains the
        // substring `meter` but not `name`, so order matters only
        // against accidental matches. The two field signals are
        // orthogonal in practice (the column names share no tokens).
        if lower.contains("distance") || lower.contains("distance_meters") {
            return FieldError(field: .distance, message: distanceErrorCopy())
        }
        // Name signals: the literal word `name`, the CHECK constraint
        // identifier, or the Postgres typed-overflow shape for the
        // 40-char `character varying(40)` column.
        if lower.contains("name")
            || lower.contains("character varying(40)")
            || lower.contains("character varying (40)") {
            return FieldError(field: .name, message: nameErrorCopy())
        }
        return FieldError(field: .crossField, message: crossFieldErrorCopy())
    }

    /// `Error`-overload that forwards to the substring matcher. Uses
    /// `String(describing:)` to capture both `LocalizedError`
    /// descriptions and the raw type-name fallback PostgREST returns.
    public static func classifyPersistFailure(_ error: Error) -> FieldError {
        let raw: String
        if let localized = error as? LocalizedError, let description = localized.errorDescription {
            raw = description
        } else {
            raw = String(describing: error)
        }
        return classifyPersistFailure(messageLike: raw)
    }

    /// Name-field error copy. Names the field + names the problem +
    /// suggests the fix, per `patterns.md` §"Error Messages". The
    /// 1..40 cap is the only constraint the SQL CHECK enforces.
    public static func nameErrorCopy() -> String {
        "Name needs to be 1 to 40 characters."
    }

    /// Distance-field error copy. The slider's snap-list keeps the
    /// user inside 0.25..10 mi by construction; this error fires only
    /// if a server-side CHECK rejects the value (e.g., a future
    /// tightening of `plans_distance_check`). Polite, plain-language,
    /// no computerese.
    public static func distanceErrorCopy() -> String {
        "Search area radius is out of range — pick a value between 0.25 and 10 miles."
    }

    /// Cross-field / network fallback. Stays at top-of-dock per the
    /// finding #25 routing rule. Polite, names the failure, suggests
    /// the next step (try again).
    public static func crossFieldErrorCopy() -> String {
        "Something went wrong saving the plan. Try again in a moment."
    }

    /// Should the back/cancel gesture mint (or update) the Plan?
    /// Per workflow-overhaul Q11:
    ///   * `.create` with name non-empty → auto-save.
    ///   * `.create` with name empty → discard; no Plan minted.
    ///   * `.edit` → always auto-save (name is non-empty by definition).
    public static func shouldAutoSaveOnBack(mode: Mode, name: String) -> Bool {
        switch mode {
        case .edit:   return true
        case .create: return Self.isNameValid(name)
        }
    }

    // MARK: - dependencies (host-supplied)

    private let mode: Mode
    private let groupMode: GroupMode
    private let plansStore: PlansStore
    private let roomStore: RoomStore
    private let userID: UUID
    private let locationCoordinator: LocationCoordinator
    private let editingPlan: PlansStore.Plan?
    /// Optional telemetry writer. Production wires the `Supabase`-backed
    /// writer from `RootView`; render-only tests + the rare host that
    /// doesn't care about telemetry pass nil. The `invite_shared`
    /// event (PRD user story 8) fires from the share-sheet dismiss
    /// closure when this is non-nil — bug-29 re-enables an event that
    /// last fired 2026-05-20 when PR #180 retired InitiatorScreen.
    private let telemetry: TelemetryWriter?

    /// Fires after a successful primary-CTA tap on a Plan that minted
    /// a Room. Carries the `(roomID, planID)` pair so the host can
    /// route into the existing invite / quiz path.
    private let onLaunched: ((UUID, UUID) -> Void)?

    /// Fires after a successful secondary-CTA tap or a name-non-empty
    /// back-out. Carries the persisted Plan so the host can navigate
    /// to the Plan list (or stub destination).
    private let onSaved: ((PlansStore.Plan) -> Void)?

    /// Fires for the empty-name back-out path in `.create` mode.
    /// Nothing is persisted; the host just navigates back.
    private let onDiscarded: (() -> Void)?

    // MARK: - state

    @State private var name: String
    @State private var groupContext: SessionParameters.GroupContext
    @State private var mealTime: SessionParameters.MealTime
    @State private var serviceShape: SessionParameters.ServiceShape
    @State private var distanceMiles: Double
    @State private var committedSearchArea: SearchArea?
    @State private var draftSearchArea: SearchArea?
    @State private var phase: Phase = .ready
    @State private var searchAreaEditorOpen: Bool = false
    /// bug-29 — owns the open/close flag for the iOS share sheet
    /// presented in group/duo mode after Plan + Room mint. Lifted off
    /// a bare `@State` so the bug-29 contract is unit-testable. See
    /// `SetupShareSheetState` + its tests in
    /// `ios/Tests/SetupShareSheetStateTests.swift`.
    @StateObject private var shareSheetState = SetupShareSheetState()
    /// bug-29 — buffer the planID for the `onLaunched` callback so the
    /// share-sheet `onDisappear` closure can fire it once the user
    /// finishes (or cancels) the share. Mirrors the retired
    /// InitiatorScreen's deferred-launch shape.
    @State private var pendingPlanIDForShare: UUID?

    public enum Phase: Equatable, Sendable {
        case ready
        case savingPlan
        case launchingRoom
        /// wfr-25 — carries a routed `FieldError` so the view body can
        /// place the message under the offending control (`.name` /
        /// `.distance`) or at the top of the dock (`.crossField`) per
        /// `patterns.md` §"Error Messages". Replaces the previous
        /// `.error(String)` shape that funnelled every failure to the
        /// top-of-dock.
        case error(FieldError)
    }

    // MARK: - init

    public init(
        mode: Mode,
        groupMode: GroupMode,
        plansStore: PlansStore,
        roomStore: RoomStore,
        userID: UUID,
        locationCoordinator: LocationCoordinator,
        editingPlan: PlansStore.Plan? = nil,
        telemetry: TelemetryWriter? = nil,
        onLaunched: ((UUID, UUID) -> Void)? = nil,
        onSaved: ((PlansStore.Plan) -> Void)? = nil,
        onDiscarded: (() -> Void)? = nil,
        initialPhase: Phase = .ready
    ) {
        self.mode = mode
        self.groupMode = groupMode
        self.plansStore = plansStore
        self.roomStore = roomStore
        self.userID = userID
        self.locationCoordinator = locationCoordinator
        self.editingPlan = editingPlan
        self.telemetry = telemetry
        self.onLaunched = onLaunched
        self.onSaved = onSaved
        self.onDiscarded = onDiscarded

        // Initial values — for `.edit`, prefill from the editing Plan.
        // For `.create`, use the locked workflow-overhaul defaults.
        let session = editingPlan?.sessionParameters ?? SessionParameters.default
        // In group mode the default group context lives on the row
        // (`Two of us` / `A group`). The session parameters bucket may
        // have a `.solo` value if a pre-amendment Plan was saved; if
        // we're rendering group mode and the bucket says solo, fall
        // forward to the canonical group default.
        let initialGroupContext: SessionParameters.GroupContext
        switch groupMode {
        case .solo:
            initialGroupContext = .solo
        case .group:
            initialGroupContext = session.groupContext == .solo ? .group : session.groupContext
        }
        _name = State(initialValue: editingPlan?.name ?? "")
        _groupContext = State(initialValue: initialGroupContext)
        _mealTime = State(initialValue: session.mealTime)
        _serviceShape = State(initialValue: session.serviceShape)
        let initialMeters = editingPlan?.distanceMeters ?? Int((SetupScreen.defaultDistanceMiles * SetupScreen.metersPerMile).rounded())
        let initialMiles = SetupScreen.snapDistance(Double(initialMeters) / SetupScreen.metersPerMile)
        _distanceMiles = State(initialValue: initialMiles)
        _committedSearchArea = State(initialValue: editingPlan.flatMap(SetupScreen.searchArea(from:)))
        _draftSearchArea = State(initialValue: nil)
        _phase = State(initialValue: initialPhase)
    }

    /// wfr-25 — test seam. Returns a copy of the screen with the
    /// initial `phase` pre-set to `.error(...)` so render-only tests
    /// can exercise the field-local + cross-field placement paths
    /// without driving the network. `internal` so production hosts
    /// can't reach for it.
    @MainActor
    func injectingError(_ fieldError: FieldError) -> SetupScreen {
        SetupScreen(
            mode: mode,
            groupMode: groupMode,
            plansStore: plansStore,
            roomStore: roomStore,
            userID: userID,
            locationCoordinator: locationCoordinator,
            editingPlan: editingPlan,
            telemetry: telemetry,
            onLaunched: onLaunched,
            onSaved: onSaved,
            onDiscarded: onDiscarded,
            initialPhase: .error(fieldError)
        )
    }

    // MARK: - derived state

    private var nameValid: Bool {
        SetupScreen.isNameValid(name)
    }

    private var headline: String {
        SetupScreen.headlineCopy(for: mode)
    }

    private var secondaryLabel: String {
        SetupScreen.secondaryLabelToDisplay(nameValid: nameValid, mode: mode)
    }

    private var primaryLabel: String {
        SetupScreen.primaryLabelToDisplay(nameValid: nameValid, groupContext: groupContext)
    }

    private var resolvedPlanScope: PlansStore.Scope {
        SetupScreen.planScope(from: groupContext, setupMode: groupMode)
    }

    // MARK: - view body

    public var body: some View {
        ZStack {
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: GTISpacing.step6) {
                    header

                    // 1. Name this plan — required text input
                    nameField

                    // 2. Who's coming — single-select chips (omitted in solo)
                    if groupMode == .group {
                        whosComingSection
                    }

                    // 3. Search area — C-28 chip + editor shell
                    searchAreaSection

                    // 4. When are you eating — single-select chips
                    mealTimeSection

                    // 5. How you want to eat — single-select chips
                    serviceShapeSection

                    Spacer(minLength: GTISpacing.step6)

                    dock
                }
                .padding(.horizontal, GTISpacing.step6)
                .padding(.top, GTISpacing.step16)
                .padding(.bottom, GTISpacing.step6)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .fullScreenCover(isPresented: $searchAreaEditorOpen) {
            SearchAreaEditor(
                draft: $draftSearchArea,
                currentPlace: locationCoordinator.place,
                onUseCurrentLocation: seedDraftFromCurrentLocation,
                onCommit: { area in
                    committedSearchArea = area
                    distanceMiles = SetupScreen.snapDistance(SetupScreen.milesFromMeters(area.radiusMeters))
                    searchAreaEditorOpen = false
                },
                onDismiss: { searchAreaEditorOpen = false }
            )
        }
        // bug-29 — re-ports the share-sheet wiring deleted with
        // `InitiatorScreen.swift` (PR #180, commit 87e803a). In
        // `.group` / `.duo` mode the primary CTA mints Plan + Room,
        // builds the canonical `InviteLink.url(...)`, and assigns
        // `shareSheetState.pendingShare` to open this sheet. The
        // `onDisappear` closure mirrors the retired InitiatorScreen
        // behavior: share completed AND share canceled both fire
        // `onLaunched` so the host routes the initiator into Waiting
        // (the Plan + Room are already minted; backing out via Setup
        // back/exit is a separate path), and both fire
        // `TelemetryWriter.inviteShared(...)` to re-enable the
        // `invite_shared` event (PRD user story 8) that has not fired
        // in prod since 2026-05-20.
        .sheet(item: Binding(
            get: { shareSheetState.pendingShare },
            set: { newValue in
                if newValue == nil {
                    shareSheetState.dismiss()
                }
            }
        )) { share in
            ShareSheet(items: [share.url])
                .accessibilityIdentifier("setup.share.sheet")
                .onDisappear {
                    let planID = pendingPlanIDForShare
                    pendingPlanIDForShare = nil
                    shareSheetState.dismiss()
                    // Best-effort telemetry — the network round-trip
                    // must never block the route into Waiting. Same
                    // fire-and-forget shape every other client-side
                    // telemetry call uses.
                    if let telemetry {
                        Task { try? await telemetry.inviteShared(roomID: share.id, userID: userID) }
                    }
                    if let planID {
                        onLaunched?(share.id, planID)
                    }
                }
        }
    }

    // MARK: - header

    private var header: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step4) {
            Text(headline.uppercased())
                .font(.system(size: GTIFont.Size.displayM, weight: .black))
                .tracking(GTIFont.TrackingEm.displayM * GTIFont.Size.displayM)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .textCase(.uppercase)
                .lineSpacing(0)
                .multilineTextAlignment(.leading)
                .accessibilityIdentifier("setup.headline")

            Text("One screen. Set it once. Share when you're ready.")
                .font(.system(size: GTIFont.Size.body, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnBrightGradient.secondary)
                .frame(maxWidth: 300, alignment: .leading)
                .accessibilityIdentifier("setup.subhead")
        }
    }

    // MARK: - name input

    private var nameField: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2) {
            // wfr-26 — persistent field label. Replaces the section
            // eyebrow that previously sat here (`NAME THIS PLAN`,
            // eyebrow token UPPERCASE). The new treatment reads as a
            // field label (sentence case, body size, semibold,
            // white-secondary) so it can't be mistaken for a section
            // heading and so it visually pairs with the in-field
            // placeholder + the hint below. Persists during and after
            // typing — the placeholder disappears, this label stays.
            // VO is unaffected: the field carries its own
            // `accessibilityLabel("Name this plan")`, and this view is
            // hidden from a11y so the label isn't double-announced.
            fieldLabel(SetupScreen.nameLabelCopy(), id: "setup.name.label")

            // Glass row hosting a borderless `TextField`. Matches the
            // C-23 picker treatment per surface doc §"Name input
            // treatment". 40-char cap enforced via `onChange`.
            HStack(spacing: 0) {
                TextField(
                    "",
                    text: Binding(
                        get: { name },
                        set: { raw in
                            if raw.count > 40 {
                                name = String(raw.prefix(40))
                            } else {
                                name = raw
                            }
                        }
                    ),
                    prompt: Text("Name this plan").foregroundStyle(GTIColor.TextOnGradient.tertiary)
                )
                .textFieldStyle(.plain)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .accessibilityIdentifier("setup.name.field")
                .accessibilityLabel("Name this plan")
            }
            .padding(.horizontal, GTISpacing.step4)
            .padding(.vertical, GTISpacing.step3)
            .frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                    .fill(GTIColor.Glass.fillSoft)
            )
            .overlay(
                RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                    .stroke(Color.white.opacity(0.18), lineWidth: 1)
            )

            // wfr-24 — visible character-limit hint. Sits adjacent
            // (not inside) the field per `patterns.md` §"Input Hints",
            // smaller + lighter than the eyebrow, persists with and
            // without focus. Overrides the surface doc's original
            // "no truncation indicator" line.
            sectionHint(SetupScreen.nameHintCopy(), id: "setup.name.hint")

            // wfr-25 — field-local error placement. Renders only when
            // the active phase is `.error(FieldError)` and the routed
            // field is `.name`. Treatment pairs an SF Symbol warning
            // glyph (sun-tinted) with the message so the signal is not
            // color-alone (per `patterns.md` §"Error Messages": "color,
            // icon, inline message — not color alone").
            if case .error(let fieldError) = phase, fieldError.field == .name {
                fieldErrorLabel(fieldError.message, id: "setup.name.error")
            }
        }
    }

    // MARK: - chip sections

    private var whosComingSection: some View {
        chipSection(
            eyebrow: "WHO'S COMING",
            idPrefix: "setup.whosComing",
            options: SetupScreen.whosComingOptions(for: groupMode),
            isSelected: { $0 == groupContext },
            label: { $0.label },
            select: { groupContext = $0 }
        )
    }

    private var searchAreaSection: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2) {
            sectionEyebrow("SEARCH AREA", id: "setup.searchArea.eyebrow")
            SearchAreaPickerChip(
                searchArea: committedSearchArea,
                onOpen: openSearchAreaEditor
            )
            .accessibilityIdentifier("setup.searchArea.chip")

            if case .error(let fieldError) = phase, fieldError.field == .distance {
                fieldErrorLabel(fieldError.message, id: "setup.searchArea.error")
            }
        }
    }

    private var mealTimeSection: some View {
        chipSection(
            eyebrow: "WHEN ARE YOU EATING",
            idPrefix: "setup.mealTime",
            options: SessionParameters.MealTime.allCases,
            isSelected: { $0 == mealTime },
            label: { $0.label },
            select: { mealTime = $0 }
        )
    }

    private var serviceShapeSection: some View {
        chipSection(
            eyebrow: "HOW YOU WANT TO EAT",
            idPrefix: "setup.serviceShape",
            options: SessionParameters.ServiceShape.allCases,
            isSelected: { $0 == serviceShape },
            label: { $0.label },
            select: { serviceShape = $0 }
        )
    }

    // MARK: - dock

    @ViewBuilder
    private var dock: some View {
        VStack(spacing: GTISpacing.step3) {
            // wfr-25 — only cross-field / network failures render at
            // top-of-dock now. `.name` + `.distance` errors render
            // inline under their respective controls so the user can
            // read the problem next to the input that needs fixing
            // (per `patterns.md` §"Error Messages").
            if case .error(let fieldError) = phase, fieldError.field == .crossField {
                fieldErrorLabel(fieldError.message, id: "setup.error")
                    .multilineTextAlignment(.center)
            }

            Button(action: tapPrimary) {
                ZStack {
                    RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                        .fill(GTIColor.paper)
                        .opacity(nameValid ? 1.0 : 0.55)
                        .frame(height: 60)
                    Group {
                        if phase == .launchingRoom {
                            ProgressView()
                                .tint(GTIColor.ink)
                        } else {
                            Text(primaryLabel.uppercased())
                                .font(.system(size: GTIFont.Size.cta, weight: .black))
                                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                                .foregroundStyle(GTIColor.ink)
                        }
                    }
                }
            }
            .accessibilityIdentifier("setup.cta.primary")
            .disabled(!nameValid || phase == .launchingRoom || phase == .savingPlan)

            Button(action: tapSecondary) {
                Group {
                    if phase == .savingPlan {
                        ProgressView()
                            .tint(GTIColor.TextOnGradient.tertiary)
                    } else {
                        Text(secondaryLabel)
                            .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                            .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                            .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                            .opacity(nameValid ? 1.0 : 0.45)
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .padding(.top, GTISpacing.step1)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("setup.cta.secondary")
            .disabled(!nameValid || phase == .launchingRoom || phase == .savingPlan)
        }
    }

    // MARK: - reusable chip section

    @ViewBuilder
    private func chipSection<Option: Hashable>(
        eyebrow: String,
        idPrefix: String,
        options: [Option],
        isSelected: @escaping (Option) -> Bool,
        label: @escaping (Option) -> String,
        select: @escaping (Option) -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2) {
            sectionEyebrow(eyebrow, id: "\(idPrefix).eyebrow")
            SetupFlowChips(options: options, spacing: GTISpacing.step2) { option in
                setupChip(
                    label: label(option),
                    selected: isSelected(option),
                    id: "\(idPrefix).chip.\(label(option))",
                    action: { select(option) }
                )
            }
            .accessibilityIdentifier("\(idPrefix).row")
        }
    }

    private func sectionEyebrow(_ text: String, id: String) -> some View {
        Text(text)
            .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
            .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
            .foregroundStyle(GTIColor.TextOnGradient.tertiary)
            .accessibilityIdentifier(id)
    }

    /// wfr-26 — persistent field-label treatment used above text-input
    /// fields (currently just the name field). Distinct from
    /// `sectionEyebrow`: sentence case + body-sm semibold + white-
    /// secondary so the label reads as a field name, not a section
    /// heading. Marked `accessibilityHidden` so the field's own
    /// `accessibilityLabel` is the single VO announcement — no
    /// double-read.
    private func fieldLabel(_ text: String, id: String) -> some View {
        Text(text)
            .font(.system(size: GTIFont.Size.sm, weight: .semibold))
            .foregroundStyle(GTIColor.TextOnGradient.secondary)
            .accessibilityIdentifier(id)
            .accessibilityHidden(true)
    }

    /// wfr-24 — adjacent field-hint treatment. Smaller + lighter than
    /// the eyebrow (sentence-case body register, white-tertiary), sits
    /// directly below the control, persists with and without focus.
    /// Matches `patterns.md` §"Input Hints" — outside the field, plain
    /// language, second-person casual register.
    private func sectionHint(_ text: String, id: String) -> some View {
        Text(text)
            .font(.system(size: GTIFont.Size.sm, weight: .regular))
            .foregroundStyle(GTIColor.TextOnGradient.tertiary)
            .accessibilityIdentifier(id)
    }

    /// wfr-25 — field-level error label. Pairs an SF Symbol warning
    /// glyph with the message so the signal is icon + text + brand
    /// color, never color alone. Uses the brand `sun` token (already
    /// the surface's accent) for the glyph and `TextOnGradient.primary`
    /// for the body — no new design tokens required. Treatment is
    /// `sm` semibold to read louder than the adjacent hint while
    /// staying inside the existing type scale.
    private func fieldErrorLabel(_ text: String, id: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: GTISpacing.step2) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: GTIFont.Size.sm, weight: .bold))
                .foregroundStyle(GTIColor.sun)
                .accessibilityHidden(true)
            Text(text)
                .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier(id)
    }

    private func setupChip(
        label: String,
        selected: Bool,
        id: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(label.uppercased())
                .font(.system(size: GTIFont.Size.cta, weight: .heavy))
                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                .foregroundStyle(selected ? GTIColor.ink : GTIColor.TextOnGradient.primary)
                .padding(.horizontal, GTISpacing.step5)
                .frame(minHeight: 48)
                .background(
                    Capsule(style: .continuous)
                        .fill(selected ? GTIColor.sun : GTIColor.Glass.fillSoft)
                )
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(selected ? Color.clear : GTIColor.Glass.stroke, lineWidth: 1.5)
                )
                .scaleEffect(selected ? 1.02 : 1.0)
                .animation(
                    .timingCurve(
                        GTIMotion.Easing.out.0,
                        GTIMotion.Easing.out.1,
                        GTIMotion.Easing.out.2,
                        GTIMotion.Easing.out.3,
                        duration: GTIMotion.Duration.chip
                    ),
                    value: selected
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    // MARK: - actions

    private func openSearchAreaEditor() {
        if committedSearchArea == nil {
            draftSearchArea = nil
            seedDraftFromCurrentLocation()
        } else {
            draftSearchArea = committedSearchArea
        }
        searchAreaEditorOpen = true
    }

    private func seedDraftFromCurrentLocation() {
        guard let place = locationCoordinator.place else { return }
        let radius = committedSearchArea?.radiusMeters ?? SetupScreen.metersFromMiles(2.0)
        draftSearchArea = SetupScreen.searchArea(from: place, radiusMeters: radius)
    }

    /// Compile the current state into a value type carrying everything
    /// PlansStore needs to insert or update. Exposed as `internal` so
    /// unit tests can assert the compile is correct without driving
    /// the network.
    func snapshotPayload() -> PlanPayload {
        let session = SessionParameters(
            mealTime: mealTime,
            // Persist the canonical resolved scope on session_params so
            // the joiner's tolerant decode still gets a sensible value
            // even though the column is now also on plans.scope.
            groupContext: groupContextForSession(),
            serviceShape: serviceShape,
            // Transport mode is no longer surfaced on Setup; the
            // Search area radius replaces the walk/drive binary. Persist
            // the canonical default so legacy readers stay coherent.
            transportMode: SessionParameters.default.transportMode
        )
        let planLocation = SetupScreen.planLocation(fromCommittedSearchArea: committedSearchArea)
        return PlanPayload(
            name: name,
            scope: resolvedPlanScope,
            location: planLocation,
            sessionParameters: session,
            distanceMeters: SetupScreen.payloadDistanceMeters(
                committedSearchArea: committedSearchArea,
                fallbackDistanceMiles: distanceMiles
            )
        )
    }

    /// Internal value type carrying a fully-compiled Plan write.
    /// Stays inside the file so the API stays narrow; PlansStore
    /// consumes the matching fields directly.
    struct PlanPayload: Equatable, Sendable {
        let name: String
        let scope: PlansStore.Scope
        let location: PlansStore.Location?
        let sessionParameters: SessionParameters
        let distanceMeters: Int
    }

    /// The scope the session_params bucket carries — mirrors the plan
    /// scope but encoded in SessionParameters.GroupContext to keep the
    /// joiner-side decode happy.
    private func groupContextForSession() -> SessionParameters.GroupContext {
        switch resolvedPlanScope {
        case .solo:  return .solo
        case .duo:   return .duo
        case .group: return .group
        }
    }

    /// Primary CTA — mints (or updates) the Plan AND mints the Room
    /// linked to it.
    ///
    /// Solo path (`primaryLabel == "Start the quiz"`): fires
    /// `onLaunched` immediately so the host routes into Quiz Q1 — the
    /// existing tb-WF-4 behavior.
    ///
    /// Group / duo path (`primaryLabel == "Drop the invite link"`)
    /// — bug-29: builds the canonical `InviteLink.url(...)` from the
    /// freshly-minted room id + a placeholder token (matches the
    /// retired InitiatorScreen pattern — signed/expiring tokens land
    /// in a later tracer bullet) and assigns
    /// `shareSheetState.pendingShare` to open the iOS share sheet.
    /// `onLaunched` fires from the sheet's `onDisappear` closure so
    /// the host routes the initiator into Waiting only after the
    /// share completes / cancels.
    private func tapPrimary() {
        guard nameValid else { return }
        if SetupScreen.shouldOpenSearchAreaEditorOnLaunch(
            nameValid: nameValid,
            hasCommittedSearchArea: committedSearchArea != nil
        ) {
            openSearchAreaEditor()
            return
        }
        let payload = snapshotPayload()
        phase = .launchingRoom
        let presentsShareSheet = (resolvedPlanScope != .solo)
        Task {
            do {
                let plan = try await persistPlan(payload: payload)
                // Mint the room with the resolved location + session
                // parameters. Link via `plan_id` so the server-side
                // verdict transition fires `set_plan_decided_active`.
                let room = try await roomStore.createRoom(
                    as: userID,
                    radiusMeters: payload.distanceMeters,
                    location: SetupScreen.roomLocation(fromCommittedSearchArea: committedSearchArea),
                    sessionParameters: payload.sessionParameters,
                    planID: plan.id
                )
                phase = .ready
                if presentsShareSheet {
                    // Token is a placeholder — the v1 contract just
                    // needs the round-trip-able shape per
                    // `InviteLink.url(...)`. Signed/expiring tokens
                    // land in a later tracer bullet. This mirrors the
                    // retired InitiatorScreen pattern verbatim.
                    let token = UUID().uuidString
                    let url = InviteLink.url(roomID: room.id, inviteToken: token)
                    pendingPlanIDForShare = plan.id
                    shareSheetState.present(roomID: room.id, url: url)
                } else {
                    onLaunched?(room.id, plan.id)
                }
            } catch {
                phase = .error(SetupScreen.classifyPersistFailure(error))
            }
        }
    }

    /// Secondary CTA — mints (or updates) the Plan only. Returns to
    /// the host's chosen destination (Plan list or S00 Landing).
    private func tapSecondary() {
        guard nameValid else { return }
        let payload = snapshotPayload()
        phase = .savingPlan
        Task {
            do {
                let plan = try await persistPlan(payload: payload)
                phase = .ready
                onSaved?(plan)
            } catch {
                phase = .error(SetupScreen.classifyPersistFailure(error))
            }
        }
    }

    /// Persist the payload — INSERT on `.create`, UPDATE on `.edit`.
    private func persistPlan(payload: PlanPayload) async throws -> PlansStore.Plan {
        switch mode {
        case .create:
            return try await plansStore.create(
                as: userID,
                name: payload.name,
                scope: payload.scope,
                location: payload.location,
                sessionParameters: payload.sessionParameters,
                distanceMeters: payload.distanceMeters
            )
        case .edit:
            guard let editingPlan else {
                // Edit mode without a Plan is a programming error.
                // Fall back to a create so the user's work isn't lost
                // — this branch is unreachable from the public init.
                return try await plansStore.create(
                    as: userID,
                    name: payload.name,
                    scope: payload.scope,
                    location: payload.location,
                    sessionParameters: payload.sessionParameters,
                    distanceMeters: payload.distanceMeters
                )
            }
            let update = PlansStore.PlanUpdate(
                name: payload.name,
                scope: payload.scope,
                location: payload.location,
                sessionParameters: payload.sessionParameters,
                distanceMeters: payload.distanceMeters
            )
            return try await plansStore.update(planID: editingPlan.id, fields: update)
        }
    }

    /// Externally-triggered back/cancel handler. Hosts (RootView /
    /// future Plan list push transition) call this when the navigation
    /// chrome's Back button fires. The empty-name discard branch is
    /// the only path that skips persistence — every other case ends
    /// in a Plan write.
    public func handleBackOut() {
        if SetupScreen.shouldAutoSaveOnBack(mode: mode, name: name) {
            tapSecondary()
        } else {
            onDiscarded?()
        }
    }
}

// MARK: - C-28 SearchAreaPicker shell

private struct SearchAreaPickerChip: View {
    let searchArea: SetupScreen.SearchArea?
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            HStack(spacing: GTISpacing.step3) {
                ZStack {
                    Circle()
                        .fill(GTIColor.sun)
                    Image(systemName: "scope")
                        .font(.system(size: 16, weight: .black))
                        .foregroundStyle(GTIColor.ink)
                        .accessibilityHidden(true)
                }
                .frame(width: 34, height: 34)
                .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: GTISpacing.step1) {
                    Text(searchArea?.centerLabel ?? SetupScreen.emptySearchAreaMainCopy())
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Text(supportCopy)
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                        .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                        .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                        .lineLimit(1)
                }

                Spacer(minLength: GTISpacing.step2)

                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, GTISpacing.step4)
            .padding(.vertical, GTISpacing.step3)
            .frame(maxWidth: .infinity, minHeight: GTISpacing.step16, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                    .fill(GTIColor.Glass.fillSoft)
            )
            .overlay(
                RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                    .stroke(Color.white.opacity(0.18), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityCopy)
    }

    private var supportCopy: String {
        guard let searchArea else { return SetupScreen.emptySearchAreaSupportCopy() }
        return SetupScreen.searchAreaSupportCopy(radiusMeters: searchArea.radiusMeters)
    }

    private var accessibilityCopy: String {
        guard let searchArea else { return SetupScreen.emptySearchAreaMainCopy() }
        return "Search area, \(searchArea.centerLabel), \(String(format: "%.1f", SetupScreen.milesFromMeters(searchArea.radiusMeters))) miles"
    }
}

private struct SearchAreaEditor: View {
    @Binding var draft: SetupScreen.SearchArea?
    let currentPlace: ResolvedPlace?
    let onUseCurrentLocation: () -> Void
    let onCommit: (SetupScreen.SearchArea) -> Void
    let onDismiss: () -> Void

    var body: some View {
        ZStack {
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            VStack(spacing: GTISpacing.step4) {
                topChrome

                Spacer()

                selectedAreaReadout

                Spacer()

                radiusControls
                commitButton
            }
            .padding(.horizontal, GTISpacing.step6)
            .padding(.top, GTISpacing.step8)
            .padding(.bottom, GTISpacing.step6)
        }
        .accessibilityIdentifier("setup.searchArea.editor")
    }

    private var topChrome: some View {
        HStack(spacing: GTISpacing.step3) {
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")

            Text("Search city, neighborhood, or address")
                .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .padding(.horizontal, GTISpacing.step3)
                .background(
                    RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                        .fill(GTIColor.Glass.fillSoft)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                        .stroke(Color.white.opacity(0.18), lineWidth: 1)
                )

            Button(action: onUseCurrentLocation) {
                Image(systemName: "location.fill")
                    .font(.system(size: 17, weight: .black))
                    .foregroundStyle(currentPlace == nil ? GTIColor.TextOnGradient.tertiary : GTIColor.ink)
                    .frame(width: 44, height: 44)
                    .background(
                        Circle()
                            .fill(currentPlace == nil ? GTIColor.Glass.fillSoft : GTIColor.sun)
                    )
            }
            .buttonStyle(.plain)
            .disabled(currentPlace == nil)
            .accessibilityLabel("Use current location")
        }
    }

    private var selectedAreaReadout: some View {
        VStack(spacing: GTISpacing.step3) {
            ZStack {
                Circle()
                    .fill(GTIColor.sun.opacity(0.16))
                    .overlay(Circle().stroke(GTIColor.sun, lineWidth: 2))
                Image(systemName: "mappin.and.ellipse")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(GTIColor.sun)
                    .accessibilityHidden(true)
            }
            .frame(width: 190, height: 190)
            .accessibilityHidden(true)

            Text(draft?.centerLabel ?? "Set search area")
                .font(.system(size: GTIFont.Size.displayM, weight: .black))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .multilineTextAlignment(.center)
                .lineLimit(2)

            Text(draft == nil ? "Search or use current location to choose the center." : "Adjust the radius, then use this area.")
                .font(.system(size: GTIFont.Size.body, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)
        }
    }

    private var radiusControls: some View {
        HStack(spacing: GTISpacing.step3) {
            radiusButton(systemName: "minus", label: "Decrease Search area radius") {
                adjustRadius(by: -1)
            }
            .disabled(draft == nil)

            Text(draft.map { SetupScreen.searchAreaRadiusBadgeCopy(radiusMeters: $0.radiusMeters) } ?? "SET AREA")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .black))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.ink)
                .frame(maxWidth: .infinity, minHeight: 44)
                .background(
                    Capsule(style: .continuous)
                        .fill(GTIColor.sun)
                )
                .accessibilityLabel(radiusAccessibility)

            radiusButton(systemName: "plus", label: "Increase Search area radius") {
                adjustRadius(by: 1)
            }
            .disabled(draft == nil)
        }
    }

    private var commitButton: some View {
        Button {
            guard let draft else { return }
            onCommit(draft)
        } label: {
            Text("USE THIS AREA")
                .font(.system(size: GTIFont.Size.cta, weight: .black))
                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                .foregroundStyle(GTIColor.ink)
                .frame(maxWidth: .infinity, minHeight: 60)
                .background(
                    Capsule(style: .continuous)
                        .fill(GTIColor.paper)
                        .opacity(draft == nil ? 0.55 : 1.0)
                )
        }
        .buttonStyle(.plain)
        .disabled(draft == nil)
        .accessibilityIdentifier("setup.searchArea.useThisArea")
    }

    private var radiusAccessibility: String {
        guard let draft else { return "Search area radius not set" }
        return "\(String(format: "%.1f", SetupScreen.milesFromMeters(draft.radiusMeters))) miles"
    }

    private func radiusButton(
        systemName: String,
        label: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 17, weight: .black))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .frame(width: 44, height: 44)
                .background(
                    Circle()
                        .fill(GTIColor.Glass.fillSoft)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private func adjustRadius(by offset: Int) {
        guard let current = draft else { return }
        let currentMiles = SetupScreen.snapDistance(SetupScreen.milesFromMeters(current.radiusMeters))
        let index = SetupScreen.distanceSteps.firstIndex(of: currentMiles) ?? 0
        let nextIndex = min(max(index + offset, 0), SetupScreen.distanceSteps.count - 1)
        let nextRadius = SetupScreen.metersFromMiles(SetupScreen.distanceSteps[nextIndex])
        draft = SetupScreen.SearchArea(
            centerLabel: current.centerLabel,
            lat: current.lat,
            lng: current.lng,
            source: current.source,
            timeZoneIdentifier: current.timeZoneIdentifier,
            radiusMeters: nextRadius
        )
    }
}

// MARK: - share sheet bridge (bug-29)

/// Bridges `UIActivityViewController` into SwiftUI so SetupScreen can
/// present the iOS share sheet from `.sheet(item:)`. Verbatim port of
/// the type retired from `InitiatorScreen.swift` (commit 87e803a) —
/// no behavior change. SwiftUI's `ShareLink` would suit a single
/// `URL`, but the retired type is what bug-29 closes against so we
/// keep the surface byte-equal.
private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

// MARK: - flow layout (reused from ParametersScreen)

/// A simple wrapping row for the Setup chip groups. Same shape as the
/// existing S01b chip layout — declared inline here so SetupScreen
/// does not have to import a private type from another file.
@MainActor
private struct SetupFlowChips<Option: Hashable, ChipView: View>: View {
    let options: [Option]
    let spacing: CGFloat
    let chip: (Option) -> ChipView

    var body: some View {
        SetupFlowLayout(spacing: spacing) {
            ForEach(options, id: \.self) { option in
                chip(option)
            }
        }
    }
}

private struct SetupFlowLayout: Layout {
    var spacing: CGFloat

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if rowWidth > 0, rowWidth + spacing + size.width > maxWidth {
                totalHeight += rowHeight + spacing
                totalWidth = max(totalWidth, rowWidth)
                rowWidth = size.width
                rowHeight = size.height
            } else {
                rowWidth += (rowWidth > 0 ? spacing : 0) + size.width
                rowHeight = max(rowHeight, size.height)
            }
        }
        totalHeight += rowHeight
        totalWidth = max(totalWidth, rowWidth)
        return CGSize(width: totalWidth, height: totalHeight)
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let maxWidth = bounds.width
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > bounds.minX, x + size.width > bounds.minX + maxWidth {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(
                at: CGPoint(x: x, y: y),
                proposal: ProposedViewSize(width: size.width, height: size.height)
            )
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
