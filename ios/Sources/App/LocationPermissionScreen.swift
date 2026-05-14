// GetToIt — S00b · Location permission pre-prime (TB-03 v1.1).
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

    /// GTI mark stand-in. Same 22pt tile as LandingScreen — the
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
            Text("BEFORE WE START")
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
                ZStack {
                    RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                        .fill(GTIColor.paper)
                        .frame(height: 60)
                    Text("SHARE MY LOCATION")
                        .font(.system(size: GTIFont.Size.cta, weight: .black))
                        .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                        .foregroundStyle(GTIColor.ink)
                }
            }
            .accessibilityIdentifier("locationPermission.cta.share")
            .accessibilityLabel("Share my location")
            .accessibilityHint("Triggers the iOS location permission prompt.")

            Button(action: onManualEntry) {
                Text("PICK A PLACE MANUALLY")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("locationPermission.cta.manual")
            .accessibilityLabel("Pick a place manually")
            .accessibilityHint("Skip the iOS prompt. Proceed to manually pick a place.")
        }
    }
}
