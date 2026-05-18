// GetToIt — S01 · Initiator landing.
//
// TB-02 baseline: food vertical visibly selected; Drinks + Movie
// rendered as disabled future-plan rows; primary CTA creates a room
// and triggers the iOS share sheet with the generated Universal Link.
//
// TB-03 adds the two initiator-set controls above the vertical picker:
//   * Timer chip group — `5 · 10 · 15 · 30` minutes (single-select,
//     default 10), drives `rooms.timer_minutes`.
//   * Radius slider — `0.5 mi – 5.0 mi` (step 0.5, default 2.0 mi),
//     drives `rooms.radius_meters` after a miles→meters conversion.
//
// Both controls are documented as a spec exception against S01's
// "no optional fields" defense in
// `design-system/surfaces/01-initiator.md` § "Timer + radius controls".
// Framing: setting expectations, not configuring options — both have
// sensible defaults that ship the zero-tap session.
//
// All color, type, spacing, motion comes from `GTITokens.swift` — per
// repo CLAUDE.md, never inline hex/px/easing.

import SwiftUI
import UIKit

@MainActor
public struct InitiatorScreen: View {
    @State private var phase: Phase = .ready
    @State private var pendingShare: PendingShare?
    @State private var timerMinutes: Int
    @State private var radiusMiles: Double
    /// TB-03 (v1.1) — flips `true` when the user taps the
    /// LocationPickerChip. Drives a `.sheet` presentation of the
    /// LocationPickerSheet.
    @State private var locationSheetOpen: Bool = false

    private let roomStore: RoomStore
    private let userID: UUID
    /// TB-03 (v1.1) — coordinator owning the GPS / typeahead /
    /// permission state for the C-23 LocationPicker. Host-supplied
    /// so the same instance is reused across the S00b pre-prime,
    /// S01 chip, and S01 sheet — they all share one observable.
    private let locationCoordinator: LocationCoordinator
    private let onSharedRoom: ((UUID) -> Void)?
    /// TB-13 — fires when the user opts into solo mode by tapping
    /// "Go solo" instead of the share-and-invite primary CTA. The
    /// host (RootView) takes the resulting `roomID` and routes
    /// directly into Q1 with the local `invitedShared` flag set to
    /// false so the post-Q5 router can skip S04 Waiting. Optional —
    /// callers that don't surface a solo CTA pass nil.
    private let onSoloRoom: ((UUID) -> Void)?
    /// TB-16 — fires when the user taps the "Settings" footer link
    /// on the CTA dock. Host routes to the S09 Settings surface.
    /// Optional — callers that don't surface settings pass nil
    /// (e.g. unit-test surfaces).
    private let onSettings: (() -> Void)?

    public init(
        roomStore: RoomStore,
        userID: UUID,
        locationCoordinator: LocationCoordinator? = nil,
        prefilledTimerMinutes: Int? = nil,
        prefilledRadiusMiles: Double? = nil,
        onSharedRoom: ((UUID) -> Void)? = nil,
        onSoloRoom: ((UUID) -> Void)? = nil,
        onSettings: (() -> Void)? = nil
    ) {
        self.roomStore = roomStore
        self.userID = userID
        // Tests + the unit-test surfaces that don't care about
        // location can omit the coordinator; we construct a no-op
        // default that stays in `.empty` (the surface still renders
        // the chip but the CTA disables — matches denied-and-no-pick).
        self.locationCoordinator = locationCoordinator ?? LocationCoordinator()
        self.onSharedRoom = onSharedRoom
        self.onSoloRoom = onSoloRoom
        self.onSettings = onSettings
        let resolved = InitiatorScreen.resolvedPrefill(
            timerMinutes: prefilledTimerMinutes,
            radiusMiles: prefilledRadiusMiles
        )
        self._timerMinutes = State(initialValue: resolved.timer)
        self._radiusMiles = State(initialValue: resolved.miles)
    }

    /// Resolve a pair of optional prefill values to the actual
    /// initial controls. Used by TB-11's read-only re-invite path —
    /// the late-joiner taps `"Start a new decision"`, and the new
    /// S01 surface opens with the prior room's `timer_minutes` +
    /// `radius_meters` pre-populated (saves a tap). Out-of-range
    /// values clamp to the S01 legal set.
    public static func resolvedPrefill(
        timerMinutes: Int?,
        radiusMiles: Double?
    ) -> (timer: Int, miles: Double) {
        let timer: Int
        if let raw = timerMinutes {
            timer = clampTimerToS01(raw)
        } else {
            timer = defaultTimerMinutes
        }
        let miles: Double
        if let raw = radiusMiles {
            miles = min(max(raw, radiusMinMiles), radiusMaxMiles)
        } else {
            miles = defaultRadiusMiles
        }
        return (timer, miles)
    }

    /// Snap a candidate timer value to the S01 chip set `{5, 10, 15, 30}`.
    /// Mirrors `LateJoinerStore.timerMinutesClampedToS01` — the two
    /// paths agree so the surface always renders one of the four
    /// canonical chips.
    public static func clampTimerToS01(_ minutes: Int) -> Int {
        var best = timerOptions[0]
        var bestDistance = abs(minutes - best)
        for option in timerOptions.dropFirst() {
            let distance = abs(minutes - option)
            if distance < bestDistance {
                best = option
                bestDistance = distance
            }
        }
        return best
    }

    public enum Phase: Equatable {
        case ready
        case creating
        case shared(roomID: UUID)
        case error(String)
    }

    /// Canonical S01 timer chip options. Source of truth is
    /// `design-system/surfaces/01-initiator.md` § "Timer chip group".
    /// The legal set is mirrored on the server by the
    /// `rooms.timer_minutes` CHECK constraint (TB-03 migration).
    public static let timerOptions: [Int] = [5, 10, 15, 30]
    public static let defaultTimerMinutes: Int = 10

    /// Canonical S01 radius slider range — `0.5 mi … 5.0 mi`, step
    /// `0.5 mi`, default `2.0 mi`. Source of truth is the surface doc.
    public static let radiusMinMiles: Double = 0.5
    public static let radiusMaxMiles: Double = 5.0
    public static let radiusStepMiles: Double = 0.5
    public static let defaultRadiusMiles: Double = 2.0

    /// Conversion factor used by the candidate-pool fetch (TB-05's
    /// PlacesProxy speaks meters to Foursquare). The migration stores
    /// `radius_meters` as integer meters; we round on conversion.
    public static let metersPerMile: Double = 1609.344

    public static func metersFromMiles(_ miles: Double) -> Int {
        Int((miles * metersPerMile).rounded())
    }

    /// `String(format:)` mirrors the JSX's `radius.toFixed(1)` so the
    /// slider label reads `"2.0 MI"` (never `"2 MI"` or `"2.00 MI"`).
    public static func formatRadiusLabel(_ miles: Double) -> String {
        String(format: "%.1f MI", miles)
    }

    public var body: some View {
        ZStack {
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: GTISpacing.step6) {
                    header

                    // TB-03 (v1.1) — C-23 LocationPicker chip. Sits
                    // between the headline block and the timer +
                    // radius controls per
                    // `surfaces/01-initiator.md` §"Layout".
                    LocationPickerChip(
                        state: locationCoordinator.pickerState,
                        place: locationCoordinator.place,
                        onOpen: { locationSheetOpen = true }
                    )

                    timerChipRow

                    radiusSliderRow

                    verticalPicker

                    Spacer(minLength: GTISpacing.step6)

                    cta
                }
                .padding(.horizontal, GTISpacing.step6)
                .padding(.top, GTISpacing.step16)
                .padding(.bottom, GTISpacing.step6)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .sheet(item: $pendingShare) { share in
            ShareSheet(items: [share.url])
                .onDisappear {
                    // PRD user story 8: after the initiator drops the
                    // link, transition them into their own Q1 rather
                    // than leaving them on the idle initiator surface.
                    // The callback is optional so existing test surfaces
                    // that don't want the auto-transition can omit it.
                    onSharedRoom?(share.id)
                }
        }
        .sheet(isPresented: $locationSheetOpen) {
            LocationPickerSheet(
                coordinator: locationCoordinator,
                onDismiss: { locationSheetOpen = false }
            )
        }
    }

    // MARK: - sub-views

    private var header: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step4) {
            Text("TONIGHT'S SESSION")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                // sg-01: initiator gradient runs coral→yellow; tinted-ink
                // secondary clears WCAG AA across the full vertical extent
                // where white-on-yellow fails (7.74:1 against #FFD23F).
                .foregroundStyle(GTIColor.TextOnBrightGradient.secondary)
                .accessibilityIdentifier("initiator.eyebrow")

            Text("Figure\nit out\ntogether")
                // Display weight is locked at 900 in tokens.json; SwiftUI's
                // `.black` weight maps to 900 in the Inter family. `display-m`
                // is the token tokens.md §2 maps to the initiator headline.
                .font(.system(size: GTIFont.Size.displayM, weight: .black))
                .tracking(GTIFont.TrackingEm.displayM * GTIFont.Size.displayM)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .textCase(.uppercase)
                .lineSpacing(0)
                .multilineTextAlignment(.leading)
                .accessibilityIdentifier("initiator.headline")

            Text("Five quick taps each. One verdict. Sixty seconds.")
                .font(.system(size: GTIFont.Size.body, weight: .semibold))
                // sg-01 subhead — the body-text role that triggered the issue
                // on real device. Tinted ink reads against the yellow band.
                .foregroundStyle(GTIColor.TextOnBrightGradient.secondary)
                .frame(maxWidth: 280, alignment: .leading)
                .accessibilityIdentifier("initiator.subhead")
        }
    }

    /// Single-select chip group. C-04 variant per surface spec —
    /// `5 · 10 · 15 · 30` minute chips, equal-flex row, default 10.
    private var timerChipRow: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2) {
            Text("HOW LONG")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .accessibilityIdentifier("initiator.timer.eyebrow")

            HStack(spacing: GTISpacing.step2) {
                ForEach(Self.timerOptions, id: \.self) { minutes in
                    timerChip(minutes: minutes)
                }
            }
            .accessibilityIdentifier("initiator.timer.row")
        }
    }

    @ViewBuilder
    private func timerChip(minutes: Int) -> some View {
        let selected = timerMinutes == minutes
        Button {
            timerMinutes = minutes
        } label: {
            Text("\(minutes) MIN")
                .font(.system(size: GTIFont.Size.cta, weight: .heavy))
                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                .foregroundStyle(selected ? GTIColor.ink : GTIColor.TextOnGradient.primary)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 44)
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
        .accessibilityIdentifier("initiator.timer.chip.\(minutes)")
        .accessibilityLabel("\(minutes) minute timer")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    /// C-21 Range Slider row — `0.5 … 5.0 mi`, step `0.5`, default
    /// `2.0`. The live value label sits in the same row as the
    /// `"HOW FAR"` eyebrow (right-aligned), mirroring the JSX.
    private var radiusSliderRow: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step1) {
            HStack(alignment: .firstTextBaseline) {
                Text("HOW FAR")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                Spacer()
                Text(Self.formatRadiusLabel(radiusMiles))
                    .font(.system(size: GTIFont.Size.monoTag, weight: .medium, design: .monospaced))
                    .tracking(GTIFont.TrackingEm.monoTag * GTIFont.Size.monoTag)
                    // sg-01: live mono-tag value sits mid-gradient where the
                    // yellow band starts to take over. Migrate to tinted ink.
                    .foregroundStyle(GTIColor.TextOnBrightGradient.secondary)
                    .accessibilityIdentifier("initiator.radius.value")
            }
            .accessibilityIdentifier("initiator.radius.eyebrow")

            // SwiftUI's `Slider` keeps drag latency in the framework
            // (no per-frame onChange storm). `.tint(GTIColor.sun)` paints
            // the filled-left-of-thumb track per the C-21 spec; the
            // thumb is the platform default disk.
            Slider(
                value: $radiusMiles,
                in: Self.radiusMinMiles...Self.radiusMaxMiles,
                step: Self.radiusStepMiles
            )
            .tint(GTIColor.sun)
            .frame(minHeight: 44)
            .accessibilityIdentifier("initiator.radius.slider")
            .accessibilityLabel("Walk radius")
            .accessibilityValue("\(String(format: "%.1f", radiusMiles)) miles")
        }
    }

    private var verticalPicker: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2) {
            Text("PICK A VERTICAL")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .padding(.bottom, GTISpacing.step1)

            verticalRow(label: "Food", meta: "Where to eat", selected: true, enabled: true)
            verticalRow(label: "Drinks", meta: "Coming v2", selected: false, enabled: false)
            verticalRow(label: "Movie", meta: "Coming v2", selected: false, enabled: false)
        }
    }

    private func verticalRow(label: String, meta: String, selected: Bool, enabled: Bool) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: GTIFont.Size.body, weight: .heavy))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                Text(meta.uppercased())
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .semibold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    // sg-01: vertical-row meta sits in the lower half of the
                    // initiator gradient — well into the yellow band.
                    .foregroundStyle(GTIColor.TextOnBrightGradient.secondary)
            }
            Spacer()
            if selected {
                ZStack {
                    Circle().fill(GTIColor.sun)
                    Text("✓")
                        .font(.system(size: GTIFont.Size.eyebrow + 1, weight: .black))
                        .foregroundStyle(GTIColor.ink)
                }
                .frame(width: 22, height: 22)
                .accessibilityHidden(true)
            }
        }
        .padding(.horizontal, GTISpacing.step5)
        .padding(.vertical, GTISpacing.step3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .fill(selected ? GTIColor.Glass.fillStrong : GTIColor.Glass.fillSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .stroke(selected ? GTIColor.Glass.stroke : Color.white.opacity(0.18), lineWidth: 1)
        )
        .opacity(enabled ? 1.0 : 0.55)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label). \(meta)")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    @ViewBuilder
    private var cta: some View {
        VStack(spacing: GTISpacing.step3) {
            if case .error(let message) = phase {
                Text(message)
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("initiator.error")
            }

            Button(action: shareInviteLink) {
                ZStack {
                    RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                        .fill(GTIColor.paper)
                        .opacity(locationCoordinator.cannotAdvance ? 0.55 : 1.0)
                        .frame(height: 60)
                    Group {
                        if phase == .creating {
                            ProgressView()
                                .tint(GTIColor.ink)
                        } else {
                            Text("DROP THE INVITE LINK")
                                .font(.system(size: GTIFont.Size.cta, weight: .black))
                                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                                .foregroundStyle(GTIColor.ink)
                        }
                    }
                }
            }
            .accessibilityIdentifier("initiator.cta")
            // TB-03 (v1.1) — CTA disables when LocationPicker is in
            // `.empty` (permission denied AND no manual pick yet). The
            // session can't fire without a location per the C-23 spec.
            .disabled(phase == .creating || locationCoordinator.cannotAdvance)

            // TB-13 — solo tertiary. Voluntary register: "Go solo —
            // figure it out for myself." Quiet weight so the primary
            // group-share path remains the obvious move. Hidden when
            // the host didn't wire the `onSoloRoom` callback (e.g.
            // unit-test surfaces that don't care about the solo path).
            if onSoloRoom != nil {
                Button(action: startSoloRoom) {
                    Text("GO SOLO")
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .heavy))
                        .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                        .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.65))
                        .padding(GTISpacing.step2)
                }
                .accessibilityIdentifier("initiator.cta.solo")
                .accessibilityLabel("Go solo. Figure it out for yourself.")
                .disabled(phase == .creating)
            }

            // TB-16 — Settings footer link. Spec exception per
            // design-system/surfaces/01-initiator.md §"Settings footer
            // link". Eyebrow-token mono-tag treatment; 44pt tap row.
            // Hidden when the host didn't wire the callback (e.g.
            // unit-test surfaces).
            if onSettings != nil {
                Button(action: { onSettings?() }) {
                    Text("SETTINGS")
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                        .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                        .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("initiator.cta.settings")
                .accessibilityLabel("Settings — manage your data")
                .disabled(phase == .creating)
            }
        }
    }

    // MARK: - actions

    /// TB-13 — solo tertiary action. Creates the room with the same
    /// timer + radius selections as the share path, but routes directly
    /// into the quiz without opening the share sheet. The host's
    /// `onSoloRoom` callback receives the new `roomID` so the post-Q5
    /// router can pass `invitedShared=false` and trigger the solo
    /// S05 variant.
    private func startSoloRoom() {
        guard let onSoloRoom else { return }
        phase = .creating
        let chosenTimer = timerMinutes
        let chosenRadiusMeters = Self.metersFromMiles(radiusMiles)
        let chosenLocation = roomLocationFromCoordinator()
        Task {
            do {
                let room = try await roomStore.createRoom(
                    as: userID,
                    timerMinutes: chosenTimer,
                    radiusMeters: chosenRadiusMeters,
                    location: chosenLocation
                )
                phase = .shared(roomID: room.id)
                onSoloRoom(room.id)
            } catch {
                phase = .error("Couldn't create the session. \(String(describing: error))")
            }
        }
    }

    /// TB-03 (v1.1) — pull the resolved place off the
    /// LocationCoordinator and shape it into a `RoomStore.RoomLocation`
    /// payload. Returns nil if no place is committed (the CTA's
    /// `cannotAdvance` guard normally prevents this path from firing,
    /// but the safe default keeps the column NULL — the migration
    /// allows NULL so a partial row still inserts cleanly).
    private func roomLocationFromCoordinator() -> RoomStore.RoomLocation? {
        guard let place = locationCoordinator.place else { return nil }
        let source: RoomStore.RoomLocation.Source = place.source == .gps ? .gps : .manual
        return RoomStore.RoomLocation(
            name: place.name,
            lat: place.coordinate.latitude,
            lng: place.coordinate.longitude,
            source: source,
            timeZoneIdentifier: place.timeZone.identifier
        )
    }

    private func shareInviteLink() {
        phase = .creating
        let chosenTimer = timerMinutes
        let chosenRadiusMeters = Self.metersFromMiles(radiusMiles)
        let chosenLocation = roomLocationFromCoordinator()
        Task {
            do {
                let room = try await roomStore.createRoom(
                    as: userID,
                    timerMinutes: chosenTimer,
                    radiusMeters: chosenRadiusMeters,
                    location: chosenLocation
                )
                // Token is a placeholder for v1 — TB-02 just needs the
                // round-trip-able shape. Signed/expiring tokens land in a
                // later tracer bullet once the abuse surface materializes.
                let token = UUID().uuidString
                let url = InviteLink.url(roomID: room.id, inviteToken: token)
                UIPasteboard.general.string = url.absoluteString
                phase = .shared(roomID: room.id)
                pendingShare = PendingShare(id: room.id, url: url)
            } catch {
                phase = .error("Couldn't create the session. \(String(describing: error))")
            }
        }
    }

    /// State the share sheet reads when present. Driven into a sheet
    /// item so SwiftUI cleanly tears down the share view after dismiss.
    public struct PendingShare: Identifiable, Equatable {
        public let id: UUID
        public let url: URL
    }
}

// MARK: - share sheet bridge

/// Bridges `UIActivityViewController` into SwiftUI so we can present
/// the iOS share sheet from `.sheet(item:)`. The auto-transition into
/// Q1 after sharing (PRD user story 8) is wired in TB-04 — for TB-02
/// we just drop the link and stay on S01.
private struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
