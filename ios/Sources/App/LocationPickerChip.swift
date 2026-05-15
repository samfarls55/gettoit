// GetToIt — C-23 LocationPickerChip (TB-03 v1.1).
//
// Persistent chip-style readout of the current location. Tap opens
// the LocationPickerSheet for editing. Visual port of
// `LocationPickerChip` in `design-system/code/components.jsx`.
//
// State table (mirrors C-23 spec):
//   loading — GPS resolving, no place yet → mono-tag "LOCATING…"
//   auto    — GPS-resolved → place name + paper-plane glyph
//   stale   — GPS > 30 min old → muted glyph + "· OUT OF DATE" suffix
//   manual  — user-committed pick → place name, no glyph
//   empty   — no place yet, denied/notDetermined → placeholder copy
//
// All visual values are tokens (`GTITokens.swift`); no raw hex/px/easing.

import SwiftUI

@MainActor
public struct LocationPickerChip: View {
    public let state: LocationPickerState
    public let place: ResolvedPlace?
    public let onOpen: () -> Void

    public init(
        state: LocationPickerState,
        place: ResolvedPlace?,
        onOpen: @escaping () -> Void
    ) {
        self.state = state
        self.place = place
        self.onOpen = onOpen
    }

    public var body: some View {
        Button(action: onOpen) {
            HStack(spacing: GTISpacing.step3) {
                if showsGPSGlyph {
                    // Sun-yellow paper-plane glyph, -45deg, matching
                    // Lumy's "Current Location" affordance per C-23
                    // Refero anchor. Decorative — hidden from VO.
                    Text("\u{27A4}") // ➤
                        .font(.system(size: 16, weight: .black))
                        .foregroundStyle(GTIColor.sun)
                        .opacity(isStale ? 0.45 : 1.0)
                        .rotationEffect(.degrees(-45))
                        .accessibilityHidden(true)
                }

                VStack(alignment: .leading, spacing: 2) {
                    if isLoading {
                        Text("LOCATING…")
                            .font(.system(size: GTIFont.Size.monoTag,
                                          weight: .medium,
                                          design: .monospaced))
                            .tracking(GTIFont.TrackingEm.monoTag * GTIFont.Size.monoTag)
                            .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                            .accessibilityIdentifier("location.chip.loading")
                    } else {
                        HStack(spacing: GTISpacing.step2) {
                            Text(displayName)
                                .font(.system(size: 17, weight: .heavy))
                                .foregroundStyle(
                                    place != nil
                                    ? GTIColor.TextOnGradient.primary
                                    : GTIColor.TextOnGradient.tertiary
                                )
                                .lineLimit(1)
                                .truncationMode(.tail)
                            if isStale {
                                Text("· OUT OF DATE")
                                    .font(.system(size: GTIFont.Size.monoTag,
                                                  weight: .medium,
                                                  design: .monospaced))
                                    .tracking(GTIFont.TrackingEm.monoTag * GTIFont.Size.monoTag)
                                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                            }
                        }
                        Text(subLabel)
                            .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                            .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                            .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                            .textCase(.uppercase)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if !isLoading {
                    Text("\u{203A}") // ›
                        .font(.system(size: 14, weight: .black))
                        .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                        .accessibilityHidden(true)
                }
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
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .accessibilityIdentifier("location.chip")
        .accessibilityLabel(accessibilityLabel)
        .accessibilityHint("Tap to change your location.")
    }

    // MARK: - state mapping

    private var isLoading: Bool {
        if case .loading = state { return true }
        return false
    }

    private var isStale: Bool {
        if case .stale = state { return true }
        return false
    }

    private var showsGPSGlyph: Bool {
        switch state {
        case .auto, .stale: return true
        case .loading, .manual, .empty: return false
        }
    }

    private var displayName: String {
        if let place { return place.name }
        return "Set your location"
    }

    private var subLabel: String {
        switch state {
        case .stale: return "Out of date — tap to refresh"
        case .empty: return "Tap to select"
        case .loading: return ""
        case .auto, .manual: return "Your location"
        }
    }

    private var accessibilityLabel: String {
        if isLoading { return "Locating your current position." }
        if place == nil { return "No location selected yet. Tap to choose one." }
        return "Current location: \(displayName)."
    }
}
