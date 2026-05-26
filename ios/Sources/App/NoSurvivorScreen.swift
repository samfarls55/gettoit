// GetToIt — NoSurvivorScreen (bug-34 / ADR 0018).
//
// Widen-and-retry Focus surface — the iOS render when VerdictEngine
// exits with `method = 'no_survivor'` after exhausting soft-pref relax
// (cuisine veto → vibe floor → radius widen). Not a verdict surface —
// no hero, no time badge, no receipts. ADR 0018 split this out of the
// prior 5-mode `VerdictScreen` so the no-survivor intent has its own
// single-intent surface (per the Focus playbook in
// `surfaces.md §Focus`).
//
// What renders:
//   * Home chrome row above the eyebrow (Plan list reachable).
//   * Eyebrow `"Tonight"` (bare — no verb, no "the verdict is" promise).
//   * Hero `"NO SPOT / FITS"` (stacked one word per line; the load-
//     bearing absence).
//   * Meta line — surfaces surviving hard-needs (`"Vegan options · $$
//     cap · 15 min walk"`).
//   * Rule chip — aggregate-rule register. Never names a person.
//   * Primary CTA `"Widen radius"` (initiator-only, sun-fill). Tapping
//     opens an inline range slider (1..10 mi, 0.5-mi step) with a
//     suggested value of `current + 1.0 mi`. The slider's commit
//     re-fires the CTA as `"Re-run · N.N mi"` and forwards the
//     selected meters to `onWidenRadius`.
//
// Reroll burns: the widen action does NOT consume a reroll burn. The
// engine failed, not the group; reroll burns are reroll-specific
// (`07-reroll.md` mechanics). The no-survivor recovery is a
// quiz-pool-fetch retry, not a verdict reroll.
//
// Non-initiators see only the chrome `Home` verb — the Widen CTA is
// suppressed (initiator-only per `surfaces/05b-no-survivor.md`).
//
// Reduced motion: drops the choreographed reveal to instant per
// `motion.md` §"Reduced motion fallback".

import SwiftUI

@MainActor
public struct NoSurvivorScreen: View {

    // MARK: - state

    @State private var revealStep: Int = 0
    @State private var widenSliderOpen: Bool = false
    @State private var widenRadiusMiles: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let verdict: VerdictScreen.Verdict
    /// Initiator-only Widen CTA. Non-initiators see only Home chrome.
    private let isInitiator: Bool
    private let currentRadiusMeters: Int
    private let onHome: () -> Void
    /// Fires when the initiator commits the widen-radius slider value
    /// (passes the chosen radius in METERS). The caller wires the
    /// `compute-verdict` re-invocation. The widen action is FREE — it
    /// does not consume a reroll burn (see file header).
    private let onWidenRadius: (Int) -> Void

    public init(
        verdict: VerdictScreen.Verdict,
        isInitiator: Bool = true,
        currentRadiusMeters: Int = 3219, // ~2.0 mi — S01 default
        onHome: @escaping () -> Void = {},
        onWidenRadius: @escaping (Int) -> Void = { _ in }
    ) {
        self.verdict = verdict
        self.isInitiator = isInitiator
        self.currentRadiusMeters = currentRadiusMeters
        self.onHome = onHome
        self.onWidenRadius = onWidenRadius
        self._widenRadiusMiles = State(
            initialValue: NoSurvivorScreen.widenRadiusInitialMiles(
                currentRadiusMeters: currentRadiusMeters
            )
        )
    }

    // MARK: - body

    public var body: some View {
        ZStack {
            GTIGradient.surface(.verdict)
                .ignoresSafeArea()
                .accessibilityIdentifier("verdict.gradient")

            VStack(spacing: 0) {
                homeChromeRow
                    .padding(.top, GTISpacing.step3)
                    .padding(.horizontal, GTISpacing.step5)

                eyebrow
                    .padding(.top, GTISpacing.step4)
                    .padding(.horizontal, GTISpacing.step6)

                hero
                    .padding(.top, GTISpacing.step3)
                    .padding(.horizontal, GTISpacing.step6)

                metaLine
                    .padding(.top, GTISpacing.step3)
                    .padding(.horizontal, GTISpacing.step6)

                ruleChip
                    .padding(.top, GTISpacing.step6)
                    .padding(.horizontal, GTISpacing.step6)

                if widenSliderOpen {
                    widenRadiusExpansion
                        .padding(.top, GTISpacing.step5)
                        .padding(.horizontal, GTISpacing.step6)
                }

                Spacer(minLength: 0)

                if isInitiator {
                    widenPrimaryCTA
                        .padding(.bottom, GTISpacing.step5)
                        .padding(.horizontal, GTISpacing.step6)
                }
            }
        }
        .task { await runChoreo() }
    }

    // MARK: - subviews

    @ViewBuilder
    private var homeChromeRow: some View {
        HStack(alignment: .center) {
            Button(action: onHome) {
                Text(VerdictScreen.homeChromeLabel.uppercased())
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.78))
                    .frame(minWidth: 44, minHeight: 44, alignment: .leading)
                    .padding(.horizontal, 4)
                    .contentShape(Rectangle())
            }
            .accessibilityIdentifier("verdict.chrome.home")
            .accessibilityLabel(VerdictScreen.homeChromeLabel)
            Spacer()
            Color.clear
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityHidden(true)
        }
        .frame(minHeight: 44)
    }

    @ViewBuilder
    private var eyebrow: some View {
        Text(NoSurvivorScreen.eyebrowCopy.uppercased())
            .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
            .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.86))
            .multilineTextAlignment(.center)
            .opacity(revealStep >= 1 ? 1 : 0)
            .offset(y: revealStep >= 1 ? 0 : 8)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("verdict.eyebrow")
    }

    @ViewBuilder
    private var hero: some View {
        VStack(spacing: 0) {
            ForEach(Array(NoSurvivorScreen.heroLines.enumerated()), id: \.offset) { _, line in
                Text(line)
                    .font(.system(size: 60, weight: .black))
                    .tracking(GTIFont.TrackingEm.displayL * 60)
                    .lineSpacing(0)
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .multilineTextAlignment(.center)
            }
        }
        .opacity(revealStep >= 2 ? 1 : 0)
        .offset(y: revealStep >= 2 ? 0 : 12)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("verdict.hero")
    }

    @ViewBuilder
    private var metaLine: some View {
        Text(verdict.metaLine.uppercased())
            .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
            .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.88))
            .multilineTextAlignment(.center)
            .opacity(revealStep >= 3 ? 1 : 0)
            .offset(y: revealStep >= 3 ? 0 : 8)
            .accessibilityIdentifier("verdict.meta")
    }

    @ViewBuilder
    private var ruleChip: some View {
        Text(verdict.ruleText)
            .font(.system(size: GTIFont.Size.sm, weight: .semibold))
            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.92))
            .multilineTextAlignment(.center)
            .lineSpacing(GTIFont.Size.sm * (GTIFont.LineHeight.sm - 1))
            .opacity(revealStep >= 5 ? 1 : 0)
            .offset(y: revealStep >= 5 ? 0 : 8)
            .accessibilityIdentifier("verdict.rule")
    }

    @ViewBuilder
    private var widenRadiusExpansion: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step1) {
            HStack(alignment: .firstTextBaseline) {
                Text("WIDEN TO")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.78))
                Spacer()
                Text(String(format: "%.1f MI", widenRadiusMiles))
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .medium, design: .monospaced))
                    .tracking(GTIFont.TrackingEm.monoTag * GTIFont.Size.monoTag)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.88))
            }
            Slider(
                value: $widenRadiusMiles,
                in: NoSurvivorScreen.widenRadiusMinMiles...NoSurvivorScreen.widenRadiusMaxMiles,
                step: NoSurvivorScreen.widenRadiusStepMiles
            )
            .tint(GTIColor.sun)
            .accessibilityLabel("Widen walk radius")
            .accessibilityValue(String(format: "%.1f miles", widenRadiusMiles))
        }
        .padding(.horizontal, GTISpacing.step4)
        .padding(.vertical, GTISpacing.step3)
        .background(
            GTIColor.Glass.fillSoft,
            in: RoundedRectangle(cornerRadius: GTIRadii.card)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.card)
                .strokeBorder(GTIColor.Glass.stroke.opacity(0.76), lineWidth: 0.75)
        )
        .accessibilityIdentifier("verdict.widenRadius.slider")
    }

    @ViewBuilder
    private var widenPrimaryCTA: some View {
        Button {
            if widenSliderOpen {
                // bug-34 — widen action does NOT consume a reroll burn.
                // The engine failed (not the group); reroll burns are
                // reroll-specific per `07-reroll.md` mechanics.
                onWidenRadius(NoSurvivorScreen.metersForMiles(widenRadiusMiles))
            } else {
                widenSliderOpen = true
            }
        } label: {
            Text(widenPrimaryLabel.uppercased())
                .font(.system(size: GTIFont.Size.cta, weight: .black))
                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                .foregroundStyle(GTIColor.ink)
                .frame(maxWidth: .infinity, minHeight: 60)
                .background(
                    GTIColor.sun,
                    in: RoundedRectangle(cornerRadius: GTIRadii.pill)
                )
        }
        .accessibilityIdentifier("verdict.cta.primary")
        .opacity(revealStep >= 7 ? 1 : 0)
        .offset(y: revealStep >= 7 ? 0 : 8)
    }

    private var widenPrimaryLabel: String {
        if widenSliderOpen {
            return String(format: "Re-run · %.1f mi", widenRadiusMiles)
        }
        return "Widen radius"
    }

    // MARK: - choreography

    /// Compressed reveal — no time-badge or receipts beats. Schedule:
    /// eyebrow (80ms) → hero (280ms) → meta (700ms) → rule (1020ms)
    /// → CTA (1380ms). See `motion.md` §"Verdict reveal" no-survivor
    /// block.
    private func runChoreo() async {
        if reduceMotion {
            revealStep = 7
            return
        }

        let easing = GTIMotion.Easing.outSoft
        let schedule: [(delayMs: Int, step: Int, duration: Double)] = [
            (Int(VerdictScreen.Choreo.eyebrowDelay * 1000), 1, VerdictScreen.Choreo.eyebrowDuration),
            (Int(VerdictScreen.Choreo.nameDelay    * 1000), 2, VerdictScreen.Choreo.nameDuration),
            (Int(VerdictScreen.Choreo.metaDelay    * 1000), 3, VerdictScreen.Choreo.metaDuration),
            (Int(VerdictScreen.Choreo.ruleDelay    * 1000), 5, VerdictScreen.Choreo.ruleDuration),
            (Int(VerdictScreen.Choreo.ctaDelay     * 1000), 7, VerdictScreen.Choreo.ctaDuration),
        ]

        var elapsedMs = 0
        for (delayMs, step, duration) in schedule {
            let waitMs = delayMs - elapsedMs
            if waitMs > 0 {
                try? await Task.sleep(nanoseconds: UInt64(waitMs) * 1_000_000)
            }
            elapsedMs = delayMs
            withAnimation(
                .timingCurve(easing.0, easing.1, easing.2, easing.3, duration: duration)
            ) {
                revealStep = step
            }
        }
    }

    // MARK: - locked copy & helpers

    /// Bare `"Tonight"` — no verb, no promise of a verdict. See
    /// `design-system/surfaces/05b-no-survivor.md` §"Copy".
    public static let eyebrowCopy = "Tonight"

    /// The no-survivor hero always reads `NO SPOT / FITS` — one word
    /// per line per S05b. Static (the input `Verdict.placeName` is
    /// `"No spot fits"`; we render the locked uppercase stack
    /// regardless to keep the hero canonical even if engine copy
    /// drifts).
    public static let heroLines = ["NO SPOT", "FITS"]

    /// Min / max / step for the widen slider. Locked in
    /// `design-system/surfaces/05b-no-survivor.md` ("range `1–10 mi`,
    /// step `0.5`"). Exposed as static so tests can assert against the
    /// canon without instantiating a view.
    public static let widenRadiusMinMiles: Double  = 1.0
    public static let widenRadiusMaxMiles: Double  = 10.0
    public static let widenRadiusStepMiles: Double = 0.5

    /// Initial slider value when the no-survivor `"Widen radius"` CTA
    /// opens the expansion — `current + 1.0 mi`, clamped to the
    /// 1..10 mi cap.
    public static func widenRadiusInitialMiles(currentRadiusMeters: Int) -> Double {
        let currentMiles = milesForMeters(currentRadiusMeters)
        let bumped = currentMiles + 1.0
        return min(max(bumped, widenRadiusMinMiles), widenRadiusMaxMiles)
    }

    /// Conversion factor — exact international mile in meters. Keeps
    /// slider math precise enough that the engine's 805 m (0.5 mi)
    /// cascade step lines up with what the slider emits.
    public static let metersPerMile: Double = 1609.344

    public static func metersForMiles(_ miles: Double) -> Int {
        Int(round(miles * metersPerMile))
    }

    public static func milesForMeters(_ meters: Int) -> Double {
        Double(meters) / metersPerMile
    }
}
