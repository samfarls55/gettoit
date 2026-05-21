// GetToIt — LockedScreen (TB-08, S06 hard-close).
//
// SwiftUI port of `design-system/code/screens/ScreenLocked.jsx`. The
// verdict closes visibly after the correctability window expires —
// this surface converts agreement into commitment. The motion is
// canon per `design-system/motion.md` §"Hard-close shutter":
//
//   0ms      Veil fades in 0 → 0.62 black                      (200ms)
//   100ms    Top shutter slides DOWN -100% → 0  (700ms ease-out-soft)
//   100ms    Bottom shutter slides UP +100% → 0 (700ms ease-out-soft)
//   200ms    "VERDICT LOCKED" stamp pops 0.6 → 1.08 → 1        (480ms)
//   1000ms   Headline fades up                                  (600ms)
//   1200ms   Body fades up                                      (600ms)
//   1400ms   Timestamp footer fades up                          (600ms)
//
// (S06 doc lists the stamp at 800ms; canon in `motion.md` §"Hard-close
// shutter" is 200ms, which matches `ScreenLocked.jsx`'s 800ms delay on
// the badge — the difference is the badge animation's `delay` vs.
// "wall-clock start". We follow the JSX delay constants directly:
// veil 0ms, shutter 100ms, stamp 800ms, headline 1000ms, body 1200ms,
// footer 1400ms.)
//
// Sun-yellow hairline edges on the shutters — NOT red. This is the
// load-bearing design defense against the surface feeling punitive
// (per `surfaces/06-hard-close.md` §"Why this surface exists").
//
// Reduced motion: force the `fade` variant (no shutter slides, no
// stamp pop) per `motion.md` §"Reduced motion fallback". The veil +
// plate still appear, just instantly.

import SwiftUI

@MainActor
public struct LockedScreen: View {
    /// Lock-plate inputs sourced from `verdicts` + `rooms`. Pure value
    /// type so snapshot tests can construct fixtures.
    public struct Plate: Equatable, Sendable {
        public var placeName: String
        public var time: String
        public var lockedAt: Date
        /// `"2 of 3 rerolls remain"` / `"No rerolls left. Tonight is
        /// locked."` per S06 §"Edge cases". TB-08 hardcodes the
        /// 3-cap formatter; TB-10 swaps for real counts.
        public var rerollsRemaining: Int
        public var rerollsTotal: Int

        public init(
            placeName: String,
            time: String,
            lockedAt: Date,
            rerollsRemaining: Int = 3,
            rerollsTotal: Int = 3
        ) {
            self.placeName = placeName
            self.time = time
            self.lockedAt = lockedAt
            self.rerollsRemaining = rerollsRemaining
            self.rerollsTotal = rerollsTotal
        }

        // The `fixture()` factory was relocated to the test target
        // (`Tests/ScreenFixtures.swift`) by bug-11 so the shipped binary
        // carries no fictitious venue strings.
    }

    public enum CloseMotion: String, Sendable {
        case shutter
        case fade
        case stamp
    }

    /// Canonical timings — keyed off `motion.md` §"Hard-close shutter"
    /// and `ScreenLocked.jsx` so the snapshot tests can assert a single
    /// load-bearing constant set.
    public enum Choreo {
        public static let veilDelay: Double          = 0.000
        public static let veilDuration: Double       = 0.200
        public static let shutterDelay: Double       = 0.100
        public static let shutterDuration: Double    = 0.700
        public static let stampDelay: Double         = 0.800
        public static let stampDuration: Double      = 0.480
        public static let headlineDelay: Double      = 1.000
        public static let headlineDuration: Double   = 0.600
        public static let bodyDelay: Double          = 1.200
        public static let bodyDuration: Double       = 0.600
        public static let timestampDelay: Double     = 1.400
        public static let timestampDuration: Double  = 0.600
    }

    // MARK: - state

    @State private var veilOn: Bool = false
    @State private var shuttersOn: Bool = false
    @State private var stampOn: Bool = false
    @State private var headlineOn: Bool = false
    @State private var bodyOn: Bool = false
    @State private var timestampOn: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let plate: Plate
    private let motionOverride: CloseMotion?

    public init(plate: Plate, motion: CloseMotion? = nil) {
        self.plate = plate
        self.motionOverride = motion
    }

    /// Resolve which motion variant we play. `reduceMotion` forces
    /// `.fade` per the spec.
    private var effectiveMotion: CloseMotion {
        if reduceMotion { return .fade }
        return motionOverride ?? .shutter
    }

    // MARK: - body

    public var body: some View {
        ZStack {
            // Underlying verdict gradient stays visible behind the
            // veil — same `surface(.verdict)` as S05.
            GTIGradient.surface(.verdict)
                .ignoresSafeArea()
                .accessibilityIdentifier("locked.gradient")

            // Veil — 0.62 black over the verdict gradient.
            Color.black
                .opacity(veilOn ? 0.62 : 0)
                .ignoresSafeArea()
                .accessibilityIdentifier("locked.veil")

            // Shutters — only rendered for the shutter motion. Fade
            // variant skips them entirely; stamp variant skips them.
            if effectiveMotion == .shutter {
                GeometryReader { geo in
                    let h = geo.size.height * 0.34
                    ZStack(alignment: .top) {
                        topShutter
                            .frame(height: h)
                            .offset(y: shuttersOn ? 0 : -h)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    ZStack(alignment: .bottom) {
                        bottomShutter
                            .frame(height: h)
                            .offset(y: shuttersOn ? 0 : h)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
                }
                .ignoresSafeArea()
                .zIndex(4)
                .accessibilityIdentifier("locked.shutters")
            }

            // Plate — stamp + headline + body + mono footer.
            VStack(spacing: 0) {
                Spacer(minLength: 0)
                stamp
                    .padding(.bottom, GTISpacing.step6)
                headline
                    .padding(.horizontal, GTISpacing.step6)
                bodyCopy
                    .padding(.top, GTISpacing.step6)
                    .padding(.horizontal, GTISpacing.step6)
                Spacer(minLength: 0)
                timestampFooter
                    .padding(.bottom, GTISpacing.step12)
                    .padding(.horizontal, GTISpacing.step6)
            }
            .zIndex(5)
        }
        .task {
            await runChoreo()
        }
    }

    // MARK: - subviews

    private var topShutter: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(GTIColor.ink3)
                .overlay(alignment: .bottom) {
                    // Sun-yellow hairline edge — defense against the
                    // close reading as punitive.
                    Rectangle()
                        .fill(GTIColor.sun.opacity(0.18))
                        .frame(height: 1)
                }
        }
    }

    private var bottomShutter: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(GTIColor.ink3)
                .overlay(alignment: .top) {
                    Rectangle()
                        .fill(GTIColor.sun.opacity(0.18))
                        .frame(height: 1)
                }
        }
    }

    private var stamp: some View {
        HStack(spacing: GTISpacing.step1) {
            Circle()
                .fill(GTIColor.sun)
                .frame(width: 6, height: 6)
            Text("VERDICT LOCKED")
                .font(.system(size: 10, weight: .heavy))
                .tracking(GTIFont.TrackingEm.eyebrow * 10)
                .foregroundStyle(GTIColor.sun)
        }
        .padding(.horizontal, GTISpacing.step4)
        .padding(.vertical, GTISpacing.step3)
        .background(
            GTIColor.sun.opacity(0.18),
            in: RoundedRectangle(cornerRadius: GTIRadii.tag)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.tag)
                .strokeBorder(GTIColor.sun.opacity(0.5), lineWidth: 1)
        )
        .scaleEffect(stampOn ? 1.0 : 0.6)
        .opacity(stampOn ? 1 : 0)
        .accessibilityIdentifier("locked.stamp")
    }

    private var headline: some View {
        VStack(spacing: 0) {
            Text(plate.placeName)
                .font(.system(size: 52, weight: .black))
                .tracking(GTIFont.TrackingEm.displayL * 52)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .multilineTextAlignment(.center)
            Text("at \(plate.time)")
                .font(.system(size: 52, weight: .black))
                .tracking(GTIFont.TrackingEm.displayL * 52)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .multilineTextAlignment(.center)
        }
        .opacity(headlineOn ? 1 : 0)
        .offset(y: headlineOn ? 0 : 12)
        .accessibilityIdentifier("locked.headline")
    }

    private var bodyCopy: some View {
        // Copy locked in `surfaces/06-hard-close.md` §"Copy register".
        // The exact wording is canonical — don't paraphrase.
        Text("The correctability window closed \(LockedScreen.formatElapsed(plate.lockedAt)) ago. Re-opening takes a reroll — and reroll needs a reason the group reads.")
            .font(.system(size: GTIFont.Size.sm, weight: .semibold))
            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.7))
            .multilineTextAlignment(.center)
            .lineSpacing(GTIFont.Size.sm * (GTIFont.LineHeight.sm - 1))
            .frame(maxWidth: 280)
            .opacity(bodyOn ? 1 : 0)
            .offset(y: bodyOn ? 0 : 12)
            .accessibilityIdentifier("locked.body")
    }

    private var timestampFooter: some View {
        Text(LockedScreen.formatFooter(plate))
            .font(.system(size: 10, weight: .semibold, design: .monospaced))
            .tracking(GTIFont.TrackingEm.monoTag * 10)
            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.45))
            .multilineTextAlignment(.center)
            .opacity(timestampOn ? 1 : 0)
            .offset(y: timestampOn ? 0 : 8)
            .accessibilityIdentifier("locked.footer")
    }

    // MARK: - motion driver

    /// Run the hard-close choreography. Reduced-motion collapses every
    /// step to "instant" — the veil + plate still appear so the
    /// surface conveys "locked," but the shutter slides + stamp pop
    /// drop per `motion.md` §"Reduced motion fallback".
    private func runChoreo() async {
        if reduceMotion {
            self.veilOn = true
            self.shuttersOn = true
            self.stampOn = true
            self.headlineOn = true
            self.bodyOn = true
            self.timestampOn = true
            return
        }
        let easing = GTIMotion.Easing.outSoft

        await sleepMs(Int(Choreo.veilDelay * 1000))
        withAnimation(.easeInOut(duration: Choreo.veilDuration)) {
            veilOn = true
        }

        await sleepMs(Int((Choreo.shutterDelay - Choreo.veilDelay) * 1000))
        withAnimation(
            .timingCurve(easing.0, easing.1, easing.2, easing.3, duration: Choreo.shutterDuration)
        ) {
            shuttersOn = true
        }

        await sleepMs(Int((Choreo.stampDelay - Choreo.shutterDelay) * 1000))
        withAnimation(
            .timingCurve(easing.0, easing.1, easing.2, easing.3, duration: Choreo.stampDuration)
        ) {
            stampOn = true
        }

        await sleepMs(Int((Choreo.headlineDelay - Choreo.stampDelay) * 1000))
        withAnimation(
            .timingCurve(easing.0, easing.1, easing.2, easing.3, duration: Choreo.headlineDuration)
        ) {
            headlineOn = true
        }

        await sleepMs(Int((Choreo.bodyDelay - Choreo.headlineDelay) * 1000))
        withAnimation(
            .timingCurve(easing.0, easing.1, easing.2, easing.3, duration: Choreo.bodyDuration)
        ) {
            bodyOn = true
        }

        await sleepMs(Int((Choreo.timestampDelay - Choreo.bodyDelay) * 1000))
        withAnimation(
            .timingCurve(easing.0, easing.1, easing.2, easing.3, duration: Choreo.timestampDuration)
        ) {
            timestampOn = true
        }
    }

    private func sleepMs(_ ms: Int) async {
        guard ms > 0 else { return }
        try? await Task.sleep(nanoseconds: UInt64(ms) * 1_000_000)
    }

    // MARK: - formatters (pure)

    /// `"Locked 6:48:32 PM · 2 of 3 rerolls remain"`. The mono register
    /// is the system speaking matter-of-factly per the surface spec.
    public static func formatFooter(_ plate: Plate) -> String {
        let timeFmt = DateFormatter()
        timeFmt.dateFormat = "h:mm:ss a"
        timeFmt.locale = Locale(identifier: "en_US_POSIX")
        let locked = timeFmt.string(from: plate.lockedAt)
        let rerolls = plate.rerollsRemaining > 0
            ? "\(plate.rerollsRemaining) of \(plate.rerollsTotal) rerolls remain"
            : "No rerolls left. Tonight is locked."
        return "Locked \(locked) · \(rerolls)"
    }

    /// `"12 seconds"` / `"3 minutes"` — same shape as the JSX hint.
    /// Pure for testability.
    public static func formatElapsed(_ lockedAt: Date, relativeTo now: Date = Date()) -> String {
        let secs = max(0, Int(now.timeIntervalSince(lockedAt)))
        if secs < 60 { return "\(secs) seconds" }
        let mins = secs / 60
        if mins < 60 { return mins == 1 ? "1 minute" : "\(mins) minutes" }
        let hrs = mins / 60
        return hrs == 1 ? "1 hour" : "\(hrs) hours"
    }
}
