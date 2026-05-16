// GetToIt — S01b · Pre-quiz parameters setup (TB-05 v1.1).
//
// The *parameters* bucket of the v1.1 three-bucket input model
// (PRD module K — see `gti-vault/10_prds/v1.1-quiz-redesign-prd.md`).
// Shown to the session INITIATOR after the room is created on S01 and
// before the quiz starts. Captures the session settings that are
// CONSISTENT ACROSS EVERY PARTICIPANT:
//
//   * Geography     — read-only echo of the S01 LocationPicker pick
//                     (reused, never re-captured here per the issue).
//   * Meal time     — drives the Foursquare `open_at` filter.
//   * Group context — solo / duo / group; sizes the recommendation.
//   * Service shape — dine-in (indoor/outdoor) vs takeout
//                     (pickup/delivery).
//   * Transport mode — walk / drive; sets the default S01 radius.
//
// The four captured parameters persist on `rooms.session_params` via
// `RoomStore.updateSessionParameters`; every joiner reads them back
// (`fetchSessionParameters`) and the quiz applies them without
// re-prompting.
//
// Spec: `design-system/surfaces/01b-parameters.md` +
// `design-system/code/screens/ScreenParameters.jsx`. All color, type,
// spacing, motion comes from `GTITokens.swift` — per repo CLAUDE.md,
// never inline hex / px / easing. The single-select chip groups are
// the C-04 chip component (single-select variant); the geography row
// is the C-23 LocationPicker chip in its read-only echo treatment.

import SwiftUI

@MainActor
public struct ParametersScreen: View {
    /// The room the parameters attach to. Created on S01; S01b runs
    /// the parameter-persisting UPDATE against it.
    private let roomID: UUID
    private let roomStore: RoomStore
    /// Geography echo. The S01 LocationPicker already captured this;
    /// S01b shows it read-only so the initiator can confirm the
    /// where without re-entering it. Nil only on the (CTA-guarded)
    /// no-location path — the row then shows a neutral placeholder.
    private let locationName: String?
    /// Fires once the parameters have persisted. The host (RootView)
    /// takes this as the signal to start the quiz.
    private let onContinue: () -> Void

    @State private var mealTime: SessionParameters.MealTime
    @State private var groupContext: SessionParameters.GroupContext
    @State private var serviceShape: SessionParameters.ServiceShape
    @State private var transportMode: SessionParameters.TransportMode
    @State private var phase: Phase = .ready

    public enum Phase: Equatable {
        case ready
        case saving
        case error(String)
    }

    public init(
        roomID: UUID,
        roomStore: RoomStore,
        locationName: String? = nil,
        initialParameters: SessionParameters = .default,
        onContinue: @escaping () -> Void
    ) {
        self.roomID = roomID
        self.roomStore = roomStore
        self.locationName = locationName
        self.onContinue = onContinue
        _mealTime = State(initialValue: initialParameters.mealTime)
        _groupContext = State(initialValue: initialParameters.groupContext)
        _serviceShape = State(initialValue: initialParameters.serviceShape)
        _transportMode = State(initialValue: initialParameters.transportMode)
    }

    /// The parameter set currently reflected by the chip selections.
    /// Pure read of the four `@State` fields — exposed so a host /
    /// test can inspect what the CTA would persist.
    public var selectedParameters: SessionParameters {
        SessionParameters(
            mealTime: mealTime,
            groupContext: groupContext,
            serviceShape: serviceShape,
            transportMode: transportMode
        )
    }

    public var body: some View {
        ZStack {
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: GTISpacing.step6) {
                    header
                    geographyRow
                    mealTimeSection
                    groupContextSection
                    serviceShapeSection
                    transportModeSection
                    Spacer(minLength: GTISpacing.step6)
                    cta
                }
                .padding(.horizontal, GTISpacing.step6)
                .padding(.top, GTISpacing.step16)
                .padding(.bottom, GTISpacing.step6)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    // MARK: - header

    private var header: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step4) {
            Text("BEFORE THE QUIZ")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnBrightGradient.secondary)
                .accessibilityIdentifier("parameters.eyebrow")

            Text("Set the\nground rules")
                .font(.system(size: GTIFont.Size.displayM, weight: .black))
                .tracking(GTIFont.TrackingEm.displayM * GTIFont.Size.displayM)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .textCase(.uppercase)
                .lineSpacing(0)
                .multilineTextAlignment(.leading)
                .accessibilityIdentifier("parameters.headline")

            Text("These apply to everyone. Your friends skip straight to the quiz.")
                .font(.system(size: GTIFont.Size.body, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnBrightGradient.secondary)
                .frame(maxWidth: 300, alignment: .leading)
                .accessibilityIdentifier("parameters.subhead")
        }
    }

    // MARK: - geography (read-only echo)

    /// The geography is captured on S01 by the C-23 LocationPicker and
    /// is NOT re-entered here — S01b shows it read-only so the
    /// initiator can confirm it. A plain glass row, not the tappable
    /// chip, because the value is fixed on this surface (per the C-23
    /// "non-editable location reads as an info row" guidance).
    private var geographyRow: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2) {
            sectionEyebrow("WHERE", id: "parameters.geography.eyebrow")

            HStack(spacing: GTISpacing.step3) {
                Text("📍")
                    .font(.system(size: GTIFont.Size.body))
                    .accessibilityHidden(true)
                Text(locationName ?? "Location set on the previous screen")
                    .font(.system(size: GTIFont.Size.body, weight: .heavy))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                Spacer()
            }
            .padding(.horizontal, GTISpacing.step5)
            .padding(.vertical, GTISpacing.step3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: 48)
            .background(
                RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                    .fill(GTIColor.Glass.fillSoft)
            )
            .overlay(
                RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                    .stroke(GTIColor.Glass.stroke, lineWidth: 1)
            )
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("parameters.geography.row")
            .accessibilityLabel("Meeting location. \(locationName ?? "Set on the previous screen").")
        }
    }

    // MARK: - parameter sections

    private var mealTimeSection: some View {
        chipSection(
            eyebrow: "WHEN ARE YOU EATING",
            idPrefix: "parameters.mealTime",
            options: SessionParameters.MealTime.allCases,
            isSelected: { $0 == mealTime },
            label: { $0.label },
            select: { mealTime = $0 }
        )
    }

    private var groupContextSection: some View {
        chipSection(
            eyebrow: "WHO'S COMING",
            idPrefix: "parameters.groupContext",
            options: SessionParameters.GroupContext.allCases,
            isSelected: { $0 == groupContext },
            label: { $0.label },
            select: { groupContext = $0 }
        )
    }

    private var serviceShapeSection: some View {
        chipSection(
            eyebrow: "HOW YOU WANT TO EAT",
            idPrefix: "parameters.serviceShape",
            options: SessionParameters.ServiceShape.allCases,
            isSelected: { $0 == serviceShape },
            label: { $0.label },
            select: { serviceShape = $0 }
        )
    }

    private var transportModeSection: some View {
        chipSection(
            eyebrow: "HOW YOU'LL GET THERE",
            idPrefix: "parameters.transportMode",
            options: SessionParameters.TransportMode.allCases,
            isSelected: { $0 == transportMode },
            label: { $0.label },
            select: { transportMode = $0 }
        )
    }

    // MARK: - reusable section + chip

    /// A labelled single-select chip group. `Option` is one of the
    /// `SessionParameters` enums; the chips wrap to as many rows as the
    /// labels need (the four service shapes are wider than the two
    /// transport modes).
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

            // Flow layout: chips wrap so wide labels never clip.
            FlowChips(options: options, spacing: GTISpacing.step2) { option in
                paramChip(
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

    /// C-04 chip, single-select variant. Selected → sun fill, ink
    /// text, scale 1.02; default → glass row. Mirrors the S01 timer
    /// chip's token treatment.
    private func paramChip(
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

    // MARK: - CTA

    @ViewBuilder
    private var cta: some View {
        VStack(spacing: GTISpacing.step3) {
            if case .error(let message) = phase {
                Text(message)
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("parameters.error")
            }

            Button(action: persistAndContinue) {
                ZStack {
                    RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                        .fill(GTIColor.paper)
                        .frame(height: 60)
                    Group {
                        if phase == .saving {
                            ProgressView()
                                .tint(GTIColor.ink)
                        } else {
                            Text("START THE QUIZ")
                                .font(.system(size: GTIFont.Size.cta, weight: .black))
                                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                                .foregroundStyle(GTIColor.ink)
                        }
                    }
                }
            }
            .accessibilityIdentifier("parameters.cta")
            .disabled(phase == .saving)
        }
    }

    // MARK: - action

    /// Persist the four parameters onto the room, then hand control to
    /// the host so the quiz can start. On a persistence failure the
    /// surface shows the error and stays put — the initiator can
    /// retry; the parameters bucket must not be lost on the way to the
    /// quiz.
    private func persistAndContinue() {
        phase = .saving
        let parameters = selectedParameters
        Task {
            do {
                try await roomStore.updateSessionParameters(
                    roomID: roomID,
                    parameters: parameters
                )
                phase = .ready
                onContinue()
            } catch {
                phase = .error("Couldn't save the session settings. \(String(describing: error))")
            }
        }
    }
}

// MARK: - flow layout

/// A simple wrapping row for the parameter chips. SwiftUI's `Layout`
/// protocol (iOS 16+) places children left-to-right and wraps to a new
/// line when the next child would overflow — the four service-shape
/// chips need two rows, the two transport chips fit one.
@MainActor
private struct FlowChips<Option: Hashable, ChipView: View>: View {
    let options: [Option]
    let spacing: CGFloat
    let chip: (Option) -> ChipView

    var body: some View {
        FlowLayout(spacing: spacing) {
            ForEach(options, id: \.self) { option in
                chip(option)
            }
        }
    }
}

/// Greedy wrapping layout. Lifted into its own type so `FlowChips`
/// stays declarative. Honors the per-axis proposed width and wraps
/// rows when a child would exceed it.
private struct FlowLayout: Layout {
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
