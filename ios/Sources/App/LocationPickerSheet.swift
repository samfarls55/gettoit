// GetToIt — C-23 LocationPickerSheet (TB-03 quiz redesign).
//
// Bottom-sheet editor for the location chip. Visual port of
// `LocationPickerSheet` in `design-system/code/components.jsx`.
//
// Composition (top-to-bottom, per spec):
//   1. Handle pill — same primitive as C-16 sheet
//   2. Header — dismiss × (left), "LOCATION" eyebrow (right)
//   3. Typeahead input — sun-yellow caret, leading search glyph
//   4. "Use current location" row — granted states only
//   5. Deny-state re-enable card — denied/restricted state only
//   6. Section header — "RECENT" or "RESULTS"
//   7. Suggestion / recents list — selectable rows
//   8. Empty state — when no query and no recents
//
// All token-driven; no raw hex / px / easing.

import SwiftUI

@MainActor
public struct LocationPickerSheet: View {
    /// Coordinator owning the typeahead state. Observed so the
    /// suggestion list updates as MKLocalSearchCompleter returns
    /// results.
    @Bindable public var coordinator: LocationCoordinator
    public let onDismiss: () -> Void

    public init(coordinator: LocationCoordinator, onDismiss: @escaping () -> Void) {
        self.coordinator = coordinator
        self.onDismiss = onDismiss
    }

    public var body: some View {
        ZStack {
            // Dark-tinted sheet background matches the JSX's
            // `rgba(20,20,30,0.92)` — bridged via GTIColor.ink2 with
            // a darken overlay so we stay token-driven.
            GTIColor.ink2.opacity(0.94)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                handle
                header
                    .padding(.horizontal, GTISpacing.step5)
                    .padding(.bottom, GTISpacing.step3)
                typeaheadInput
                    .padding(.horizontal, GTISpacing.step5)

                if showsCurrentLocationRow {
                    useCurrentLocationRow
                        .padding(.horizontal, GTISpacing.step5)
                        .padding(.top, GTISpacing.step2)
                }

                if showsDenyCard {
                    denyStateCard
                        .padding(.horizontal, GTISpacing.step5)
                        .padding(.top, GTISpacing.step3)
                }

                if shouldShowList {
                    listSectionHeader
                        .padding(.horizontal, GTISpacing.step5)
                        .padding(.top, GTISpacing.step4)
                    suggestionList
                        .padding(.horizontal, GTISpacing.step5)
                } else if showsEmptyState {
                    emptyState
                        .padding(.top, GTISpacing.step10)
                }

                Spacer(minLength: 0)
            }
            .padding(.top, GTISpacing.step3)
            .padding(.bottom, GTISpacing.step6)
        }
        .presentationDetents([.medium, .large])
        .presentationCornerRadius(GTIRadii.sheet)
        .accessibilityIdentifier("location.sheet")
    }

    // MARK: - state mapping

    /// Permission-derived sub-mode. `auto`/`stale` show the current-
    /// location row; `empty` shows the deny-state card. `loading` and
    /// `manual` sit in between — render the suggestion list only.
    private var subMode: SubMode {
        switch coordinator.authorization {
        case .authorizedAlways, .authorizedWhenInUse:
            return .granted
        case .denied, .restricted:
            return .denied
        case .notDetermined:
            return .undetermined
        @unknown default:
            return .undetermined
        }
    }

    private enum SubMode { case granted, denied, undetermined }

    private var showsCurrentLocationRow: Bool {
        subMode == .granted
    }
    private var showsDenyCard: Bool {
        subMode == .denied
    }

    private var hasQuery: Bool {
        !coordinator.query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var listItems: [PlaceSuggestion] {
        if hasQuery {
            return coordinator.suggestions
        }
        return coordinator.recents.map { resolved in
            PlaceSuggestion(id: resolved.id, name: resolved.name, sub: resolved.sub)
        }
    }

    private var listLabel: String {
        hasQuery ? "Results" : "Recent"
    }

    private var shouldShowList: Bool {
        !listItems.isEmpty
    }

    private var showsEmptyState: Bool {
        !hasQuery && coordinator.recents.isEmpty && subMode != .denied
    }

    // MARK: - sub-views

    private var handle: some View {
        RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
            .fill(Color.white.opacity(0.22))
            .frame(width: 38, height: 4)
            .frame(maxWidth: .infinity)
            .padding(.bottom, GTISpacing.step5)
            .accessibilityHidden(true)
    }

    private var header: some View {
        HStack(alignment: .center) {
            Button(action: onDismiss) {
                Text("\u{00D7}") // ×
                    .font(.system(size: 22, weight: .black))
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.85))
                    .frame(width: 44, height: 44, alignment: .leading)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("location.sheet.close")
            .accessibilityLabel("Close location picker")
            Spacer()
            Text("LOCATION")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
            Color.clear.frame(width: 44, height: 44)
        }
    }

    private var typeaheadInput: some View {
        HStack(spacing: GTISpacing.step3) {
            Text("\u{2315}") // ⌕
                .font(.system(size: 14, weight: .black))
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .accessibilityHidden(true)
            TextField("", text: $coordinator.query, prompt:
                Text("Search a city, neighborhood, or address")
                    .foregroundStyle(Color.white.opacity(0.45))
            )
            .textInputAutocapitalization(.words)
            .autocorrectionDisabled(true)
            .submitLabel(.search)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(GTIColor.TextOnGradient.primary)
            // Sun-yellow caret carries the focus signal — the only
            // state color per C-23 spec.
            .tint(GTIColor.sun)
            .accessibilityIdentifier("location.sheet.input")
            if hasQuery {
                Button(action: { coordinator.query = "" }) {
                    Text("\u{00D7}") // ×
                        .font(.system(size: 14, weight: .black))
                        .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("location.sheet.clear")
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, GTISpacing.step4)
        .padding(.vertical, GTISpacing.step3)
        .background(
            RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                .fill(GTIColor.Glass.fillSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                .stroke(Color.white.opacity(0.18), lineWidth: 1)
        )
    }

    private var useCurrentLocationRow: some View {
        Button(action: {
            coordinator.useCurrentLocation()
            onDismiss()
        }) {
            HStack(spacing: GTISpacing.step3) {
                Text("\u{27A4}") // ➤
                    .font(.system(size: 14, weight: .black))
                    .foregroundStyle(GTIColor.sun)
                    .rotationEffect(.degrees(-45))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Use current location")
                        .font(.system(size: 15, weight: .heavy))
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                    if case .stale(let minutes) = coordinator.pickerState {
                        Text("Last fix \(minutes) min ago")
                            .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                            .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                            .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                            .textCase(.uppercase)
                    }
                }
                Spacer()
            }
            .padding(.horizontal, GTISpacing.step4)
            .padding(.vertical, GTISpacing.step3)
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("location.sheet.useCurrent")
        .accessibilityLabel("Use current location")
    }

    private var denyStateCard: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step1) {
            Text("LOCATION OFF")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.sun)
                .textCase(.uppercase)
            Text("Type a place above to keep going.")
                .font(.system(size: 15, weight: .heavy))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .padding(.top, GTISpacing.step1 + 2)
            Text("Or turn on location in Settings if you'd rather we pick it up automatically.")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.7))
                .padding(.top, GTISpacing.step1)
            Button(action: { LocationCoordinator.openSettings() }) {
                Text("OPEN SETTINGS")
                    .font(.system(size: GTIFont.Size.cta, weight: .black))
                    .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .overlay(
                        RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                            .stroke(Color.white.opacity(0.55), lineWidth: 1.5)
                    )
            }
            .buttonStyle(.plain)
            .padding(.top, GTISpacing.step3)
            .accessibilityIdentifier("location.sheet.openSettings")
            .accessibilityLabel("Open Settings to enable location")
        }
        .padding(GTISpacing.step4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .fill(GTIColor.Glass.fillSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .stroke(Color.white.opacity(0.18), lineWidth: 1)
        )
    }

    private var listSectionHeader: some View {
        HStack {
            Text(listLabel.uppercased())
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
            Spacer()
        }
        .padding(.bottom, GTISpacing.step1 + 2)
    }

    private var suggestionList: some View {
        ScrollView {
            VStack(spacing: GTISpacing.step1) {
                ForEach(listItems) { item in
                    suggestionRow(item: item)
                }
            }
        }
        .frame(maxHeight: 280)
        .accessibilityIdentifier("location.sheet.list")
    }

    private func suggestionRow(item: PlaceSuggestion) -> some View {
        let selected = coordinator.place?.id == item.id
        return Button(action: {
            coordinator.select(suggestion: item) { ok in
                if ok { onDismiss() }
            }
        }) {
            HStack(spacing: GTISpacing.step3) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(.system(size: 15, weight: .heavy))
                        .foregroundStyle(selected ? GTIColor.ink : GTIColor.TextOnGradient.primary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                    Text(item.sub)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(
                            selected
                            ? GTIColor.TextOnSurface.secondary
                            : GTIColor.TextOnGradient.tertiary
                        )
                        .lineLimit(1)
                }
                Spacer()
                if selected {
                    Text("\u{2713}") // ✓
                        .font(.system(size: 12, weight: .black))
                        .foregroundStyle(GTIColor.ink)
                        .accessibilityHidden(true)
                }
            }
            .padding(.horizontal, GTISpacing.step4)
            .padding(.vertical, GTISpacing.step3)
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                    .fill(selected ? GTIColor.sun : Color.clear)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("location.sheet.row.\(item.id)")
        .accessibilityLabel("\(item.name). \(item.sub).")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    private var emptyState: some View {
        VStack(spacing: GTISpacing.step3) {
            Text("\u{25CE}") // ◎
                .font(.system(size: 32, weight: .black))
                .foregroundStyle(GTIColor.sun)
                .accessibilityHidden(true)
            Text("Type a place to get started.")
                .font(.system(size: 16, weight: .heavy))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .multilineTextAlignment(.center)
            Text("City, neighborhood, or street address — whatever lands quickest.")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.65))
                .multilineTextAlignment(.center)
                .frame(maxWidth: 260)
        }
        .padding(.horizontal, GTISpacing.step6)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("location.sheet.empty")
    }
}
