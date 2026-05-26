// GetToIt — S00b · Location permission pre-prime (TB-03 quiz redesign).
//
// Soft prompt explaining why GetToIt wants location BEFORE iOS fires
// the native `CLLocationManager.requestWhenInUseAuthorization` dialog.
// Surface spec: `design-system/surfaces/00b-location-permission.md`.
// JSX reference: `design-system/code/screens/ScreenLocationPermission.jsx`.
//
// Visual: initiator gradient (same stop as S01 so the transition
// reads as one coral-to-sunset moment), GTI mark top-left, eyebrow
// + display headline + body, white PillCTA primary + eyebrow-token
// text-link secondary. Tokens only.
//
// Behavior:
//   * Primary CTA "Share my location" — fires
//     `LocationCoordinator.requestPermission()`. iOS dialog appears
//     on top. On resolve, the host transitions to S01.
//   * Secondary "Pick a place manually" — skips the iOS prompt
//     entirely; permission state stays `notDetermined`. Host
//     transitions to S01; the LocationPickerSheet renders with the
//     typeahead-only flow (no "Use current location" affordance).

import SwiftUI

@MainActor
public struct LocationPermissionScreen: View {
    private let onShareLocation: () -> Void
    private let onManualEntry: () -> Void

    public init(
        onShareLocation: @escaping () -> Void,
        onManualEntry: @escaping () -> Void
    ) {
        self.onShareLocation = onShareLocation
        self.onManualEntry = onManualEntry
    }

    // MARK: - spec-locked copy (00b-location-permission.md)

    /// Eyebrow tag above the headline.
    public static let eyebrowLabel = "BEFORE WE START"

    /// Primary CTA label — voluntary verb ("Share"), not "Allow" / "Enable".
    public static let primaryCtaLabel = "SHARE MY LOCATION"

    /// Secondary CTA label — second-person; signals the user controls
    /// how they tell us where they are.
    public static let secondaryCtaLabel = "PICK A PLACE MANUALLY"

    // MARK: - spec-locked CTA treatment (wfr-08)
    //
    // The workflow-review found the two CTAs were rendering with equal
    // visual weight. The treatments below are the regression guard: the
    // view body reads from these declarations and the snapshot test
    // asserts they remain distinct.

    /// Visual hierarchy for a CTA on the location-permission surface.
    public enum CtaStyle: Equatable { case filledPill, textLink }

    /// Background-fill token used by a CTA.
    public enum CtaFill: Equatable { case paper, none }

    /// Foreground-text token used by a CTA.
    public enum CtaForeground: Equatable { case ink, textOnGradientTertiary }

    /// Treatment of a single CTA on the surface — style + fill + foreground.
    public struct CtaTreatment: Equatable {
        public let style: CtaStyle
        public let fill: CtaFill
        public let foreground: CtaForeground
    }

    /// Primary CTA renders as the filled white PillCTA (C-05 `white`).
    public static let primaryCtaTreatment = CtaTreatment(
        style: .filledPill,
        fill: .paper,
        foreground: .ink
    )

    /// Secondary CTA renders as an eyebrow-token text link — same
    /// treatment as S01 "SETTINGS" and S04 "Maybe later".
    public static let secondaryCtaTreatment = CtaTreatment(
        style: .textLink,
        fill: .none,
        foreground: .textOnGradientTertiary
    )

    public var body: some View {
        ZStack {
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                gtiMark

                headline
                    .padding(.top, GTISpacing.step16)

                Spacer(minLength: GTISpacing.step6)

                ctaDock
            }
            .padding(.horizontal, GTISpacing.step6)
            .padding(.top, GTISpacing.step16)
            .padding(.bottom, GTISpacing.step6)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - sub-views

    /// GTI mark stand-in. Same 22pt tile as PlanListScreen — the
    /// pre-public-launch polish ticket will swap in the real wordmark.
    private var gtiMark: some View {
        ZStack {
            RoundedRectangle(cornerRadius: GTISpacing.step1, style: .continuous)
                .fill(GTIColor.paper.opacity(0.18))
                .frame(width: 22, height: 22)
            Text("g")
                .font(.system(size: 14, weight: .black))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
        }
        .accessibilityHidden(true)
    }

    private var headline: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(Self.eyebrowLabel)
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.secondary)
                .padding(.bottom, GTISpacing.step3 + 2)
                .accessibilityIdentifier("locationPermission.eyebrow")

            // 44pt display headline, hand-broken three-line — matches
            // JSX `"Where are\nyou eating\ntonight?"` verbatim.
            Text("Where are\nyou eating\ntonight?")
                .font(.system(size: GTIFont.Size.displayM, weight: .black))
                .tracking(GTIFont.TrackingEm.displayM * GTIFont.Size.displayM)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .textCase(.uppercase)
                .lineSpacing(0)
                .multilineTextAlignment(.leading)
                .accessibilityIdentifier("locationPermission.headline")

            Text("We'll line up restaurants close enough to walk to, instead of asking your neighborhood every time. Sharing your location is optional — type it in if you'd rather.")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.secondary)
                .lineSpacing(3)
                .padding(.top, GTISpacing.step5)
                .frame(maxWidth: 320, alignment: .leading)
                .accessibilityIdentifier("locationPermission.body")
        }
    }

    private var ctaDock: some View {
        VStack(spacing: GTISpacing.step1) {
            Button(action: onShareLocation) {
                ctaContent(label: Self.primaryCtaLabel, treatment: Self.primaryCtaTreatment)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("locationPermission.cta.share")
            .accessibilityLabel("Share my location")
            .accessibilityHint("Triggers the iOS location permission prompt.")

            Button(action: onManualEntry) {
                ctaContent(label: Self.secondaryCtaLabel, treatment: Self.secondaryCtaTreatment)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("locationPermission.cta.manual")
            .accessibilityLabel("Pick a place manually")
            .accessibilityHint("Skip the iOS prompt. Proceed to manually pick a place.")
        }
    }

    /// Renders a CTA per its `CtaTreatment`. The two surface CTAs read
    /// from `primaryCtaTreatment` / `secondaryCtaTreatment` so the
    /// snapshot test's distinction asserts (wfr-08) stay load-bearing.
    @ViewBuilder
    private func ctaContent(label: String, treatment: CtaTreatment) -> some View {
        switch treatment.style {
        case .filledPill:
            ZStack {
                RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                    .fill(fillColor(treatment.fill))
                    .frame(height: 60)
                Text(label)
                    .font(.system(size: GTIFont.Size.cta, weight: .black))
                    .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                    .foregroundStyle(foregroundColor(treatment.foreground))
            }
        case .textLink:
            Text(label)
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(foregroundColor(treatment.foreground))
                .frame(maxWidth: .infinity, minHeight: 44)
        }
    }

    private func fillColor(_ fill: CtaFill) -> Color {
        switch fill {
        case .paper: return GTIColor.paper
        case .none:  return Color.clear
        }
    }

    private func foregroundColor(_ foreground: CtaForeground) -> Color {
        switch foreground {
        case .ink:                      return GTIColor.ink
        case .textOnGradientTertiary:   return GTIColor.TextOnGradient.tertiary
        }
    }
}
