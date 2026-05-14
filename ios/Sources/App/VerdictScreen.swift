// GetToIt — VerdictScreen (TB-06 + TB-09).
//
// SwiftUI port of `design-system/code/screens/ScreenVerdict.jsx`.
// The verdict surface is the hero — the screen this whole product
// exists to deliver. The choreography is canon: ms-exact timings
// from `motion.md` §"Verdict reveal — full choreography", sourced
// through `GTIMotion.ChoreoDelay` so a token bump catches via the
// design-system verify gate.
//
// Modes supported here:
//   * `.default` — clean run (TB-06). Standard reveal.
//   * `.noSurvivor` — TB-09 terminal. Eyebrow `"Tonight"`, hero
//     `"NO SPOT / FITS"` (one word per line per the standard rule),
//     meta line surfaces surviving hard-needs, rule chip carries the
//     load-bearing message, primary CTA `"Widen radius"` opens an
//     inline range slider (1–10 mi, current+1.0 mi default), commit
//     fires `onWidenRadius(meters:)`. Suppressed: time badge, voice
//     receipts, cuts drawer.
//   * `.cuts`, `.committed`, `.readOnly` — wired through the same
//     `mode` parameter; TB-08 / TB-11 will land the full
//     implementations.
//
// What the view does NOT do:
//   * Compute anything from `votes`. The engine in
//     `supabase/functions/_shared/verdict-engine.ts` is the single
//     canonical implementation; iOS surfaces the engine's output.
//   * Wire the "I'm in" CTA to the ratification path — TB-08.
//   * Spawn the widen-radius re-run network call — the view calls
//     `onWidenRadius(meters:)` and the caller wires the
//     `compute-verdict` re-invocation.
//
// Reduced motion: drops the choreographed reveal to instant per
// `motion.md` §"Reduced motion fallback". Receipts land simultaneously.

import SwiftUI

@MainActor
public struct VerdictScreen: View {
    public enum Mode: String, Sendable {
        case `default`
        case cuts
        case committed
        case readOnly
        case noSurvivor
    }

    /// Verdict + receipts + cuts payload, sourced from `verdicts` +
    /// `option_cuts` rows. Pure value type — no Supabase coupling.
    public struct Verdict: Equatable, Sendable {
        public var placeName: String
        public var metaLine: String
        public var timeBadge: TimeBadge
        public var ruleText: String
        public var receipts: [Receipt]
        public var cuts: [Cut]

        public init(
            placeName: String,
            metaLine: String,
            timeBadge: TimeBadge,
            ruleText: String,
            receipts: [Receipt],
            cuts: [Cut]
        ) {
            self.placeName = placeName
            self.metaLine = metaLine
            self.timeBadge = timeBadge
            self.ruleText = ruleText
            self.receipts = receipts
            self.cuts = cuts
        }

        /// JSX-fixture-shaped verdict used by snapshot tests and by the
        /// design-system parity preview. `// placeholder: marketing-branding pass`
        /// applies to the strings.
        public static func fixture() -> Verdict {
            // placeholder: marketing-branding pass
            Verdict(
                placeName: "Pico's Taqueria",
                metaLine: "Mexican · $$ · 8 min walk",
                timeBadge: TimeBadge(time: "7:00 PM", audience: "All four of you"),
                ruleText: "Budget cap cut Ren Soba. Pico's had the lowest regret-of-omission.",
                receipts: [
                    Receipt(name: "you",  action: "wanted lively"),
                    Receipt(name: "alex", action: "filtered shellfish"),
                    Receipt(name: "maya", action: "capped at $30"),
                    Receipt(name: "sam",  action: "capped at 15 min walk"),
                ],
                cuts: [
                    Cut(name: "Ren Soba",   reason: "over budget cap"),
                    Cut(name: "Café Lou",   reason: "shellfish veto"),
                    Cut(name: "Halal Cart", reason: "outside walk range"),
                ]
            )
        }

        /// JSX-fixture-shaped no-survivor verdict — drives the
        /// `noSurvivor` mode snapshot tests + the design-system
        /// parity preview. The hero stacks as "NO SPOT / FITS" via
        /// the placeholder `placeName`; the engine writes the same
        /// load-bearing rule_text in aggregate-rule register.
        /// `// placeholder: marketing-branding pass` applies to the
        /// strings.
        public static func noSurvivorFixture() -> Verdict {
            // placeholder: marketing-branding pass
            Verdict(
                placeName: "No spot fits",
                metaLine: "Vegan options · $$ cap · 15 min walk",
                timeBadge: TimeBadge(time: "", audience: ""),
                ruleText: "Vegan options left no candidates within walking distance tonight.",
                receipts: [],
                cuts: []
            )
        }
    }

    public struct TimeBadge: Equatable, Sendable {
        public var time: String
        public var audience: String

        public init(time: String, audience: String) {
            self.time = time
            self.audience = audience
        }
    }

    public struct Receipt: Equatable, Sendable, Identifiable {
        public var name: String
        public var action: String
        public var id: String { name }

        public init(name: String, action: String) {
            self.name = name
            self.action = action
        }
    }

    public struct Cut: Equatable, Sendable, Identifiable {
        public var name: String
        public var reason: String
        public var id: String { name }

        public init(name: String, reason: String) {
            self.name = name
            self.reason = reason
        }
    }

    /// Locked choreo timings — wrapped onto a per-screen namespace so
    /// the snapshot tests can assert against a single load-bearing
    /// constant set. Values are sourced from `GTIMotion.ChoreoDelay`
    /// (which is generated from `tokens.json`); the verify gate makes
    /// a silent token-bump catch via the snapshot suite.
    public enum Choreo {
        public static let eyebrowDelay   = GTIMotion.ChoreoDelay.eyebrow
        public static let nameDelay      = GTIMotion.ChoreoDelay.name
        public static let metaDelay      = GTIMotion.ChoreoDelay.meta
        public static let timeDelay      = GTIMotion.ChoreoDelay.time
        public static let ruleDelay      = GTIMotion.ChoreoDelay.rule
        public static let receiptsDelay  = GTIMotion.ChoreoDelay.receipts
        public static let ctaDelay       = GTIMotion.ChoreoDelay.cta
        public static let staggerReceipt = GTIMotion.ChoreoDelay.staggerReceipt
        // Per `motion.md` §"Verdict reveal — full choreography" the
        // animation durations are: eyebrow 500ms, hero 800ms, meta 500ms,
        // time pop 520ms, rule 500ms, receipts 480ms (entry),
        // CTA 500ms (fade-up).
        public static let eyebrowDuration: Double = 0.500
        public static let nameDuration: Double    = 0.800
        public static let metaDuration: Double    = 0.500
        public static let timeDuration: Double    = 0.520
        public static let ruleDuration: Double    = 0.500
        public static let receiptDuration: Double = 0.480
        public static let ctaDuration: Double     = 0.500
    }

    // MARK: - state

    @State private var revealStep: Int = 0
    @State private var receiptIndexShown: Int = -1
    @State private var cutsExpanded: Bool = false
    @State private var widenSliderOpen: Bool = false
    @State private var widenRadiusMiles: Double = 3.0
    /// TB-08 — local commit flag. Flipped by the "I'm in" tap, drives
    /// the sun-fill / "You're in · N of M" CTA per S05 §Modes.
    @State private var committedLocally: Bool = false
    /// TB-08 — wall-clock seconds remaining in the correctability
    /// window. The view ticks this on a 1-Hz Task while in committed
    /// mode. Null when no commitment exists yet.
    @State private var windowSecondsRemaining: Int? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let verdict: Verdict
    private let mode: Mode
    /// Whether the current viewer initiated the room. Drives the
    /// no-survivor "Widen radius" CTA visibility — initiator-only per
    /// `surfaces/05-verdict.md` §"no-survivor".
    private let isInitiator: Bool
    /// Current room radius in meters. Drives the widen slider's
    /// default suggestion (current + 1.0 mi) per
    /// `surfaces/05-verdict.md` §"no-survivor".
    private let currentRadiusMeters: Int
    /// CTA non-functional in TB-06; TB-08 wires this. Kept as a closure
    /// so the call sites compile through the ratification work later.
    private let onAdvance: () -> Void
    /// TB-08 — live ratification count. The hosting view binds this
    /// to a `RatificationStore`'s `count`. The CTA label reads
    /// `"You're in · {count} of {total}"` per S05 §Modes.
    private let ratifiedCount: Int
    /// TB-08 — total members in the room. Drives the CTA label
    /// denominator.
    private let ratifiedTotal: Int
    /// TB-08 — fires when the user taps "I'm in". The hosting view
    /// wires this to `RatificationStore.ratify(userID:)` AND to the
    /// `PushCoordinator.requestPermissionOncePerSession(userID:)` —
    /// the prompt fires AFTER the ratification row writes. Defaults
    /// to no-op so existing call sites compile through.
    private let onRatify: () -> Void
    /// Fires when the initiator commits the widen-radius slider value
    /// (passes the chosen radius in METERS). The caller wires the
    /// `compute-verdict` re-invocation. Defaults to no-op so existing
    /// `.default` call sites compile through.
    private let onWidenRadius: (Int) -> Void
    /// Fires when the user taps the no-survivor secondary "Start over"
    /// ghost button. Defaults to no-op.
    private let onStartOver: () -> Void
    /// TB-08 — correctability window in seconds. Defaults to 30 per
    /// `rooms.correctability_window_seconds`. The view drives a 1-Hz
    /// countdown from this value once the user commits.
    private let correctabilityWindowSeconds: Int
    /// TB-10 — number of rerolls already used on this room. Drives the
    /// reroll affordance gating: when `rerollsUsed >= 3` the surface
    /// hides the tertiary "Reroll" button. The S07 sheet enforces the
    /// cap server-side; this is the UI-side display gate.
    private let rerollsUsed: Int
    /// TB-10 — fires when the user taps the tertiary "Reroll" button.
    /// The host wires this to a sheet presentation of `RerollScreen`.
    /// Suppressed in `.readOnly` and `.noSurvivor` per S05 §Modes.
    /// Suppressed when `rerollsUsed >= 3` (the footer reads "No rerolls
    /// left" instead per S07 §"Edge cases").
    private let onReroll: () -> Void

    public init(
        verdict: Verdict,
        mode: Mode = .default,
        isInitiator: Bool = true,
        currentRadiusMeters: Int = 3219, // ~2.0 mi — S01 default
        ratifiedCount: Int = 0,
        ratifiedTotal: Int = 0,
        correctabilityWindowSeconds: Int = 30,
        rerollsUsed: Int = 0,
        onAdvance: @escaping () -> Void = {},
        onRatify: @escaping () -> Void = {},
        onWidenRadius: @escaping (Int) -> Void = { _ in },
        onStartOver: @escaping () -> Void = {},
        onReroll: @escaping () -> Void = {}
    ) {
        self.verdict = verdict
        self.mode = mode
        self.isInitiator = isInitiator
        self.currentRadiusMeters = currentRadiusMeters
        self.ratifiedCount = ratifiedCount
        self.ratifiedTotal = ratifiedTotal
        self.correctabilityWindowSeconds = correctabilityWindowSeconds
        self.rerollsUsed = rerollsUsed
        self.onAdvance = onAdvance
        self.onRatify = onRatify
        self.onWidenRadius = onWidenRadius
        self.onStartOver = onStartOver
        self.onReroll = onReroll
        self._widenRadiusMiles = State(
            initialValue: VerdictScreen.widenRadiusInitialMiles(
                currentRadiusMeters: currentRadiusMeters
            )
        )
        // Pre-load the commit flag when the mode is `.committed` (used
        // by snapshot tests + the TB-11 read-only late-joiner path).
        self._committedLocally = State(initialValue: mode == .committed)
        self._windowSecondsRemaining = State(
            initialValue: mode == .committed ? correctabilityWindowSeconds : nil
        )
    }

    // MARK: - body

    public var body: some View {
        ZStack {
            GTIGradient.surface(.verdict)
                .ignoresSafeArea()
                .accessibilityIdentifier("verdict.gradient")

            VStack(spacing: 0) {
                // Eyebrow
                eyebrow
                    .padding(.top, GTISpacing.step10)
                    .padding(.horizontal, GTISpacing.step6)

                // Hero — stacked one word per line, uppercase
                hero
                    .padding(.top, GTISpacing.step3)
                    .padding(.horizontal, GTISpacing.step6)

                // Meta line
                metaLine
                    .padding(.top, GTISpacing.step3)
                    .padding(.horizontal, GTISpacing.step6)

                // Time badge — pops at 820ms
                if modeSnapshot.showTimeBadge {
                    timeBadge
                        .padding(.top, GTISpacing.step6)
                }

                // Rule chip
                ruleChip
                    .padding(.top, GTISpacing.step6)
                    .padding(.horizontal, GTISpacing.step6)

                // Voice receipts — wrapped row of glass chips
                if modeSnapshot.showReceipts {
                    receiptsRow
                        .padding(.top, GTISpacing.step6)
                        .padding(.horizontal, GTISpacing.step6)
                }

                // Cuts drawer
                if modeSnapshot.showCutsDrawer {
                    cutsDrawer
                        .padding(.top, GTISpacing.step5)
                        .padding(.horizontal, GTISpacing.step6)
                }

                // No-survivor inline widen-radius expansion
                if mode == .noSurvivor && widenSliderOpen {
                    widenRadiusExpansion
                        .padding(.top, GTISpacing.step5)
                        .padding(.horizontal, GTISpacing.step6)
                }

                Spacer(minLength: 0)

                // CTA dock
                ctaDock
                    .padding(.bottom, GTISpacing.step5)
                    .padding(.horizontal, GTISpacing.step6)
            }
        }
        .task { await runChoreo() }
        // TB-08 — drive the 1-Hz countdown for the correctability
        // window. The Task is cheap; it re-runs whenever
        // `committedLocally` flips so the ticker starts immediately
        // after the user taps "I'm in." Cancellation propagates when
        // the view disappears.
        .task(id: committedLocally) {
            guard committedLocally else { return }
            if windowSecondsRemaining == nil {
                windowSecondsRemaining = correctabilityWindowSeconds
            }
            while !Task.isCancelled {
                let remaining = windowSecondsRemaining ?? 0
                if remaining <= 0 { return }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                if Task.isCancelled { return }
                if let cur = windowSecondsRemaining {
                    windowSecondsRemaining = max(0, cur - 1)
                }
            }
        }
    }

    // MARK: - subviews

    @ViewBuilder
    private var eyebrow: some View {
        Text(modeSnapshot.eyebrowCopy.uppercased())
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
        let lines = VerdictScreen.heroLinesForRender(placeName: verdict.placeName, mode: mode)
        VStack(spacing: 0) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
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

    /// Inline range-slider expansion shown when the no-survivor
    /// primary CTA is tapped. Mirrors the JSX expansion block (sun-
    /// filled track + ink value chip + 1..10 mi range with 0.5-mi
    /// step). Commit happens when the user taps the primary CTA a
    /// second time.
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
                in: VerdictScreen.widenRadiusMinMiles...VerdictScreen.widenRadiusMaxMiles,
                step: VerdictScreen.widenRadiusStepMiles
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
    private var timeBadge: some View {
        VStack(spacing: 4) {
            Text(verdict.timeBadge.time)
                .font(.system(size: 34, weight: .black))
                .tracking(GTIFont.TrackingEm.displayS * 34)
                .foregroundStyle(GTIColor.ink)
                .lineSpacing(0)
            Text(verdict.timeBadge.audience.uppercased())
                .font(.system(size: 9, weight: .black))
                .tracking(GTIFont.TrackingEm.eyebrow * 9)
                .foregroundStyle(GTIColor.ink)
        }
        .padding(.horizontal, 30)
        .padding(.vertical, 12)
        .background(GTIColor.sun, in: RoundedRectangle(cornerRadius: GTIRadii.card))
        .scaleEffect(revealStep >= 4 ? 1.0 : 0.6)
        .opacity(revealStep >= 4 ? 1 : 0)
        .accessibilityIdentifier("verdict.timeBadge")
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
    private var receiptsRow: some View {
        FlowLayout(spacing: 6) {
            ForEach(Array(verdict.receipts.enumerated()), id: \.element.id) { index, r in
                receiptChip(name: r.name, action: r.action, index: index)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("verdict.receipts")
    }

    @ViewBuilder
    private func receiptChip(name: String, action: String, index: Int) -> some View {
        HStack(spacing: 5) {
            Text(name)
                .font(.system(size: 12, weight: .heavy))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
            Text(action)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.82))
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 7)
        .background(
            GTIColor.Glass.fill,
            in: RoundedRectangle(cornerRadius: GTIRadii.chip)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.chip)
                .strokeBorder(GTIColor.Glass.stroke, lineWidth: 0.75)
        )
        .opacity(receiptOpacity(index: index))
        .scaleEffect(receiptScale(index: index))
        .offset(y: receiptOffsetY(index: index))
    }

    @ViewBuilder
    private var cutsDrawer: some View {
        if cutsExpanded {
            VStack(alignment: .leading, spacing: GTISpacing.step2) {
                HStack {
                    Text("WHAT GOT CUT")
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                        .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                        .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.7))
                    Spacer()
                    Button(action: { withAnimation { cutsExpanded = false } }) {
                        Text("HIDE")
                            .font(.system(size: 10, weight: .heavy))
                            .tracking(GTIFont.TrackingEm.eyebrow * 10)
                            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.7))
                    }
                    .accessibilityIdentifier("verdict.cuts.hide")
                }
                ForEach(verdict.cuts) { cut in
                    HStack(alignment: .firstTextBaseline) {
                        Text(cut.name)
                            .font(.system(size: GTIFont.Size.sm, weight: .heavy))
                            .foregroundStyle(GTIColor.TextOnGradient.primary)
                            .strikethrough(true, color: GTIColor.TextOnGradient.primary.opacity(0.6))
                        Spacer()
                        Text(cut.reason)
                            .font(.system(size: GTIFont.Size.eyebrow, weight: .semibold))
                            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.7))
                    }
                    .padding(.horizontal, GTISpacing.step3)
                    .padding(.vertical, GTISpacing.step2)
                    .background(
                        Color.black.opacity(0.18),
                        in: RoundedRectangle(cornerRadius: 10)
                    )
                }
            }
            .accessibilityIdentifier("verdict.cuts.expanded")
        } else {
            Button(action: { withAnimation { cutsExpanded = true } }) {
                Text("SEE WHAT GOT CUT →")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .heavy))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.85))
                    .frame(maxWidth: .infinity)
                    .padding(GTISpacing.step2)
            }
            .opacity(revealStep >= 6 ? 1 : 0)
            .accessibilityIdentifier("verdict.cuts.trigger")
        }
    }

    @ViewBuilder
    private var ctaDock: some View {
        VStack(spacing: 14) {
            if mode == .noSurvivor {
                noSurvivorPrimary
                noSurvivorSecondary
            } else if mode == .readOnly {
                // TB-11 — read-only late-joiner CTA. Re-invite the
                // caller to a fresh round as the new initiator;
                // ratification + reroll + "Start over" secondary are
                // ALL suppressed in this branch (they imply the
                // late-joiner can still influence the closed
                // verdict). The pre-permission line is also dropped
                // because there's no "I'm in" tap to chase with the
                // native push prompt.
                //
                // VO contract (locked in `design-system/accessibility.md`
                // §"Verdict (`read-only` mode)"): the absent
                // ratification path is announced as "Not available —
                // this verdict is closed." We surface it as the
                // accessibilityHint on the re-invite CTA so a VO
                // user reading the focus chain hears the closure
                // before they hear the CTA's action.
                Button(action: onAdvance) {
                    Text("START A NEW DECISION")
                        .font(.system(size: GTIFont.Size.cta, weight: .black))
                        .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                        .foregroundStyle(GTIColor.ink)
                        .frame(maxWidth: .infinity, minHeight: 60)
                        .background(
                            GTIColor.paper,
                            in: RoundedRectangle(cornerRadius: GTIRadii.pill)
                        )
                }
                .accessibilityIdentifier("verdict.cta.primary")
                .accessibilityLabel("Start a new decision")
                .accessibilityHint(VerdictScreen.readOnlyRatificationVOAnnouncement)
            } else if isCommittedFlavor {
                // Committed mode — sun-fill pill, ink check prefix,
                // "You're in · N of M" label. Window countdown lives
                // BELOW the CTA per S05 §Modes (`"Window closes in 47s"`).
                committedPill
                Text(VerdictScreen.windowCountdownCopy(seconds: windowSecondsRemaining))
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.65))
                    .padding(GTISpacing.step1)
                    .accessibilityIdentifier("verdict.cta.secondary")
                rerollTertiary
                preCheckInLine
            } else {
                // Default mode — "I'm in" white pill.
                Button(action: handleImInTap) {
                    Text("I'M IN")
                        .font(.system(size: GTIFont.Size.cta, weight: .black))
                        .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                        .foregroundStyle(GTIColor.ink)
                        .frame(maxWidth: .infinity, minHeight: 60)
                        .background(
                            GTIColor.paper,
                            in: RoundedRectangle(cornerRadius: GTIRadii.pill)
                        )
                }
                .accessibilityIdentifier("verdict.cta.primary")

                Button(action: onAdvance) {
                    Text("START OVER")
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                        .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                        .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.65))
                        .padding(GTISpacing.step1)
                }
                .accessibilityIdentifier("verdict.cta.secondary")
                rerollTertiary
                preCheckInLine
            }
        }
        .opacity(revealStep >= 7 ? 1 : 0)
        .offset(y: revealStep >= 7 ? 0 : 8)
    }

    /// TB-08 — sun-fill ratification pill with ink check prefix and
    /// `"You're in · N of M"` label per S05 §"committed" mode.
    @ViewBuilder
    private var committedPill: some View {
        HStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(GTIColor.ink)
                    .frame(width: 22, height: 22)
                Text("✓")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(GTIColor.sun)
            }
            Text(VerdictScreen.committedCtaLabel(count: ratifiedCount, total: ratifiedTotal).uppercased())
                .font(.system(size: GTIFont.Size.cta, weight: .black))
                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                .foregroundStyle(GTIColor.ink)
        }
        .frame(maxWidth: .infinity, minHeight: 60)
        .background(
            GTIColor.sun,
            in: RoundedRectangle(cornerRadius: GTIRadii.pill)
        )
        .accessibilityIdentifier("verdict.cta.primary")
        .accessibilityLabel(VerdictScreen.committedCtaLabel(count: ratifiedCount, total: ratifiedTotal))
    }

    /// TB-10 — tertiary "REROLL" button below the primary CTA on the
    /// `default` and `committed` flavors. When the room has already
    /// burned its 3-cap (`rerollsUsed >= 3`), the button is replaced
    /// with a non-tappable `"No rerolls left"` footer per S07's
    /// `"Edge cases"` register. Suppressed entirely in `.readOnly` and
    /// `.noSurvivor` (those branches don't render `rerollTertiary`).
    @ViewBuilder
    private var rerollTertiary: some View {
        if rerollsUsed >= 3 {
            Text("No rerolls left")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.55))
                .padding(GTISpacing.step1)
                .accessibilityIdentifier("verdict.cta.reroll.exhausted")
        } else {
            Button(action: onReroll) {
                Text("REROLL")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.65))
                    .padding(GTISpacing.step1)
            }
            .accessibilityIdentifier("verdict.cta.reroll")
        }
    }

    /// TB-08 — pre-permission line surfacing the upcoming check-in.
    /// Copy is locked by PRD user story 38 + the TB-08 ticket:
    /// `"We'll check in tomorrow — see if you went."` Voluntary
    /// register. NEVER `"Enable notifications"`, `"Allow alerts"`,
    /// `"Turn on push"`. Suppressed in `.readOnly` / `.noSurvivor`.
    @ViewBuilder
    private var preCheckInLine: some View {
        Text(VerdictScreen.preCheckInCopy)
            .font(.system(size: GTIFont.Size.eyebrow, weight: .semibold))
            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.55))
            .multilineTextAlignment(.center)
            .padding(.top, GTISpacing.step2)
            .accessibilityIdentifier("verdict.preCheckIn")
    }

    /// Tap handler for the white "I'm in" pill. Fires the host's
    /// `onRatify` (which writes the row AND requests the push
    /// permission) and flips to the committed local state so the CTA
    /// re-renders as the sun-fill while the live count round-trips.
    private func handleImInTap() {
        onRatify()
        committedLocally = true
        windowSecondsRemaining = correctabilityWindowSeconds
    }

    /// Test-readable: is the surface in the committed flavor (mode is
    /// `.committed` OR the local "I'm in" tap has fired)?
    public var isCommittedFlavor: Bool {
        mode == .committed || committedLocally
    }

    /// No-survivor primary CTA — sun-filled "Widen radius" (or
    /// "Re-run · N.N mi" once the slider is open). Initiator-only;
    /// invitees see the secondary "Start over" only.
    @ViewBuilder
    private var noSurvivorPrimary: some View {
        if isInitiator {
            Button {
                if widenSliderOpen {
                    onWidenRadius(VerdictScreen.metersForMiles(widenRadiusMiles))
                } else {
                    widenSliderOpen = true
                }
            } label: {
                Text(noSurvivorPrimaryLabel.uppercased())
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
        }
    }

    /// No-survivor secondary — ghost "Start over" returning to S01.
    /// Slightly louder than the default mode's "Start over" tertiary
    /// (12pt vs 11pt body weight 800) because in no-survivor it's
    /// the only path for non-initiators.
    @ViewBuilder
    private var noSurvivorSecondary: some View {
        Button(action: onStartOver) {
            Text("START OVER")
                .font(.system(size: 12, weight: .heavy))
                .tracking(GTIFont.TrackingEm.eyebrow * 12)
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.85))
                .frame(maxWidth: .infinity)
                .padding(GTISpacing.step3)
        }
        .accessibilityIdentifier("verdict.cta.secondary")
    }

    private var noSurvivorPrimaryLabel: String {
        if widenSliderOpen {
            return String(format: "Re-run · %.1f mi", widenRadiusMiles)
        }
        return "Widen radius"
    }

    // MARK: - choreography driver

    /// Drive the locked reveal sequence. Reduced motion collapses all
    /// steps to a single instant render per `motion.md` §"Reduced
    /// motion fallback".
    ///
    /// The reveal is encoded as a flat schedule of `(absolute-delay-ms,
    /// action)` tuples. The driver sleeps between absolute milestones
    /// and fires each action via `withAnimation`. The per-chip receipt
    /// stagger (80ms apart starting at receiptsDelay=1140) lands inline
    /// in the schedule alongside the CTA step at 1380ms — matching
    /// `motion.md` §"Verdict reveal" exactly.
    private func runChoreo() async {
        if reduceMotion {
            revealStep = 7
            receiptIndexShown = verdict.receipts.count - 1
            return
        }

        let easing = GTIMotion.Easing.outSoft
        let staggerMs = Int(Choreo.staggerReceipt * 1000)

        enum Action {
            case setStep(Int, Double)         // (step, duration)
            case showReceipt(Int, Double)     // (index, duration)
        }

        var schedule: [(delayMs: Int, action: Action)] = [
            (Int(Choreo.eyebrowDelay  * 1000), .setStep(1, Choreo.eyebrowDuration)),
            (Int(Choreo.nameDelay     * 1000), .setStep(2, Choreo.nameDuration)),
            (Int(Choreo.metaDelay     * 1000), .setStep(3, Choreo.metaDuration)),
            (Int(Choreo.timeDelay     * 1000), .setStep(4, Choreo.timeDuration)),
            (Int(Choreo.ruleDelay     * 1000), .setStep(5, Choreo.ruleDuration)),
            (Int(Choreo.receiptsDelay * 1000), .setStep(6, Choreo.receiptDuration)),
        ]
        for index in 0..<verdict.receipts.count {
            let delayMs = Int(Choreo.receiptsDelay * 1000) + index * staggerMs
            schedule.append((delayMs, .showReceipt(index, Choreo.receiptDuration)))
        }
        schedule.append((Int(Choreo.ctaDelay * 1000), .setStep(7, Choreo.ctaDuration)))

        // Sort by absolute delay so chips and steps interleave correctly.
        schedule.sort { $0.delayMs < $1.delayMs }

        var elapsedMs = 0
        for (delayMs, action) in schedule {
            let waitMs = delayMs - elapsedMs
            if waitMs > 0 {
                try? await Task.sleep(nanoseconds: UInt64(waitMs) * 1_000_000)
            }
            elapsedMs = delayMs
            switch action {
            case .setStep(let s, let dur):
                withAnimation(
                    .timingCurve(easing.0, easing.1, easing.2, easing.3, duration: dur)
                ) {
                    revealStep = s
                }
            case .showReceipt(let idx, let dur):
                withAnimation(
                    .timingCurve(easing.0, easing.1, easing.2, easing.3, duration: dur)
                ) {
                    receiptIndexShown = idx
                }
            }
        }
    }

    // MARK: - receipt stagger helpers

    /// Each receipt fades in 80ms after the previous, anchored at the
    /// receipts step (revealStep >= 6). The per-chip animation
    /// duration is 480ms per `motion.md` §"Utility motion · Receipt
    /// entry". The choreography driver advances `receiptIndexShown`
    /// one tick at a time at the locked 80ms cadence.
    private func receiptOpacity(index: Int) -> Double {
        receiptIndexShown >= index ? 1 : 0
    }

    private func receiptScale(index: Int) -> CGFloat {
        receiptIndexShown >= index ? 1 : 0.96
    }

    private func receiptOffsetY(index: Int) -> CGFloat {
        receiptIndexShown >= index ? 0 : 8
    }

    // MARK: - mode snapshot (test-readable)

    public struct ModeSnapshot {
        public let showTimeBadge: Bool
        public let showReceipts: Bool
        public let showCutsDrawer: Bool
        public let cutsExpanded: Bool
        public let eyebrowCopy: String
        public let primaryCtaLabel: String
        public let secondaryLabel: String
        /// True when the no-survivor inline range slider is expanded.
        /// Drives the primary CTA's `Re-run · N.N mi` label switch.
        public let widenSliderOpen: Bool
        /// True when the surface is in the committed flavor (TB-08).
        /// Either the caller passed `.committed` mode or the local
        /// "I'm in" tap has fired.
        public let isCommittedFlavor: Bool
        /// Pre-permission line copy surfaced under the CTA dock
        /// (TB-08). Empty in modes that suppress the line.
        public let preCheckInLine: String
    }

    /// Mode-shaped flags surfaced for the snapshot tests. Mirrors the
    /// flat flags at the top of `ScreenVerdict.jsx`'s body. Reads
    /// `cutsExpanded` state when the JSX would also be in `.cuts` mode.
    public var modeSnapshot: ModeSnapshot {
        let isReadOnly   = mode == .readOnly
        let isNoSurvivor = mode == .noSurvivor
        let isCommitted  = (mode == .committed || committedLocally)

        let eyebrow: String
        switch mode {
        case .noSurvivor: eyebrow = "Tonight"
        case .readOnly:   eyebrow = "Tonight's verdict"
        default:          eyebrow = "Tonight, the verdict is"
        }

        let primaryLabel: String
        if isReadOnly {
            primaryLabel = "Start a new decision"
        } else if isNoSurvivor {
            primaryLabel = widenSliderOpen
                ? String(format: "Re-run · %.1f mi", widenRadiusMiles)
                : "Widen radius"
        } else if isCommitted {
            primaryLabel = VerdictScreen.committedCtaLabel(
                count: ratifiedCount,
                total: ratifiedTotal
            )
        } else {
            primaryLabel = "I'm in"
        }

        let secondary: String
        if isReadOnly {
            secondary = ""
        } else if isCommitted {
            secondary = VerdictScreen.windowCountdownCopy(
                seconds: windowSecondsRemaining
            )
        } else {
            secondary = "Start over"
        }

        // Pre-permission line is suppressed in read-only + no-survivor
        // modes; everywhere else it surfaces.
        let preLine = (isReadOnly || isNoSurvivor) ? "" : VerdictScreen.preCheckInCopy

        return ModeSnapshot(
            showTimeBadge: !isNoSurvivor,
            showReceipts: !isNoSurvivor,
            showCutsDrawer: !isNoSurvivor,
            cutsExpanded: cutsExpanded || mode == .cuts,
            eyebrowCopy: eyebrow,
            primaryCtaLabel: primaryLabel,
            secondaryLabel: secondary,
            widenSliderOpen: widenSliderOpen,
            isCommittedFlavor: isCommitted,
            preCheckInLine: preLine
        )
    }

    // MARK: - TB-08 pure copy formatters

    /// PRD user story 38 + S05 spec lock: warm "We'll check in" line.
    /// NEVER paraphrase to "Enable notifications" / "Allow alerts" —
    /// the wording is voluntary register, the prompt is the call.
    public static let preCheckInCopy = "We'll check in tomorrow — see if you went."

    /// TB-11 — VO announcement for the suppressed ratification path in
    /// `.readOnly` mode. Locked by
    /// `design-system/accessibility.md` §"Verdict (`read-only` mode)" —
    /// VoiceOver users hear this when they would otherwise focus on
    /// the (absent) "I'm in" button. Surfaced as the `accessibilityHint`
    /// on the re-invite CTA.
    public static let readOnlyRatificationVOAnnouncement =
        "Not available — this verdict is closed."

    /// S05 §Modes — committed CTA reads `"You're in · N of M"`. We
    /// guard against `total = 0` (count snapshot hasn't loaded yet)
    /// by falling back to `"You're in"`.
    public static func committedCtaLabel(count: Int, total: Int) -> String {
        if total <= 0 { return "You're in" }
        let c = max(1, count)  // a self-ratification has already landed
        return "You're in · \(c) of \(total)"
    }

    /// S05 §Modes — `"Window closes in 47s"` for the active commitment.
    /// `seconds == 0` → "Window closing…"; `seconds == nil` → blank.
    public static func windowCountdownCopy(seconds: Int?) -> String {
        guard let s = seconds else { return "" }
        if s <= 0 { return "Window closing…" }
        return "Window closes in \(s)s"
    }

    // MARK: - widen-radius helpers (pure, test-readable)

    /// Min / max / step for the widen slider on S05 `noSurvivor`.
    /// Locked in `design-system/surfaces/05-verdict.md` §"no-survivor"
    /// ("range `1–10 mi`, step `0.5`"). Exposed as static so tests
    /// can assert against the canon without instantiating a view.
    public static let widenRadiusMinMiles: Double  = 1.0
    public static let widenRadiusMaxMiles: Double  = 10.0
    public static let widenRadiusStepMiles: Double = 0.5

    /// Initial slider value when the no-survivor "Widen radius" CTA
    /// opens the expansion — `current + 1.0 mi`, clamped to the
    /// 1..10 mi cap. The S01 default of 3219 m (~2.0 mi) suggests
    /// 3.0 mi on first widen; a 15289 m current (9.5 mi) clamps to
    /// 10.0 mi rather than overshooting.
    public static func widenRadiusInitialMiles(currentRadiusMeters: Int) -> Double {
        let currentMiles = milesForMeters(currentRadiusMeters)
        let bumped = currentMiles + 1.0
        return min(max(bumped, widenRadiusMinMiles), widenRadiusMaxMiles)
    }

    /// Conversion factor — exact international mile in meters.
    /// Keeps slider math precise enough that the engine's
    /// 805 m (0.5 mi) cascade step lines up with what the slider
    /// emits.
    public static let metersPerMile: Double = 1609.344

    /// Convert miles to meters. The engine talks meters end-to-end;
    /// the slider works in miles for the user-facing copy.
    public static func metersForMiles(_ miles: Double) -> Int {
        return Int(round(miles * metersPerMile))
    }

    /// Inverse of `metersForMiles` for default-suggestion math.
    public static func milesForMeters(_ meters: Int) -> Double {
        return Double(meters) / metersPerMile
    }

    // MARK: - hero stacking

    /// Split the place name into stacked uppercase lines per S05's
    /// "place name UPPERCASE stacked, one word per line" rule. Two-word
    /// names produce one word per line; longer names collapse the tail
    /// onto the second line so the verdict still reads as a hero.
    public static func heroLines(for name: String) -> [String] {
        let tokens = name.uppercased().split(separator: " ").map(String.init)
        switch tokens.count {
        case 0:  return [""]
        case 1:  return [tokens[0]]
        case 2:  return tokens
        default: return [tokens[0], tokens.dropFirst().joined(separator: " ")]
        }
    }

    /// Hero stacking that honours the mode-specific layout. The
    /// no-survivor hero always reads `NO SPOT / FITS` — the JSX
    /// fixture's three-word place name ("No spot fits") would
    /// otherwise collapse to `NO / SPOT FITS` under the generic
    /// splitter. All other modes defer to `heroLines(for:)`.
    public static func heroLinesForRender(placeName: String, mode: Mode) -> [String] {
        if mode == .noSurvivor {
            return ["NO SPOT", "FITS"]
        }
        return heroLines(for: placeName)
    }
}

// MARK: - choreo durations
//
// Per-step durations are wired inline in the choreography driver via
// the schedule's `.setStep(step, duration)` payloads. Kept on the public
// `Choreo` namespace so snapshot tests can assert against them.

// MARK: - FlowLayout (wrap-row used for receipts row)
//
// iOS 17 deployment target exposes the SwiftUI `Layout` protocol —
// using it gives a deterministic wrap row without the GeometryReader
// re-render flicker that the `alignmentGuide` trick is famous for.
// Mirrors the JSX `flexWrap: 'wrap'` behaviour for the receipts row.

private struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        let arrangement = layout(width: maxWidth, subviews: subviews)
        return arrangement.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let arrangement = layout(width: bounds.width, subviews: subviews)
        for (index, position) in arrangement.positions.enumerated() {
            let p = CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y)
            subviews[index].place(at: p, anchor: .topLeading, proposal: .unspecified)
        }
    }

    private func layout(width: CGFloat, subviews: Subviews) -> (positions: [CGPoint], size: CGSize) {
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var maxWidthUsed: CGFloat = 0

        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > width && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            maxWidthUsed = max(maxWidthUsed, x - spacing)
        }
        let totalHeight = y + rowHeight
        return (positions, CGSize(width: maxWidthUsed, height: totalHeight))
    }
}
