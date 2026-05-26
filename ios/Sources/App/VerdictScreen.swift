// GetToIt — VerdictScreen (live verdict, post-bug-34).
//
// The hero — the screen this whole product exists to deliver. Per
// ADR 0018 (accepted 2026-05-26, implemented by bug-34) the prior
// 5-mode unified struct was decomposed into three surfaces: this
// `VerdictScreen` (live), `VerdictReadOnlyScreen` (closed), and
// `NoSurvivorScreen` (widen-and-retry). What stayed here is the live
// verdict shell — eyebrow + hero + time-badge + receipts + reroll
// + Home chrome — driven by a three-case `Flavor` enum.
//
// Flavors:
//   * `.default` — clean run pre-ratify.
//   * `.committed` — post-`I'm in` group view with sun-fill pill,
//     `You're in · N of M` label, and the dock countdown.
//   * `.solo` — single-member surface. Eyebrow + hero + time-badge +
//     rule chip + I'm in + reroll all present; suppresses the
//     voice-receipt row (one voice doesn't need to be receipted
//     back to itself) and the time-badge audience subtitle (the
//     communal frame self-cancels with N = 1). Replaces the group
//     save affordance with the C-22 save-taste-profile chip.
//
// bug-26 (2026-05-24) — the `.cuts` mode and its expanded "See what
// got cut" drawer were retired in full. The drawer offered a friction-
// free change-of-mind path that re-litigated the verdict without paying
// the reroll's 3-burn / stated-reason friction; reroll is now the only
// re-decide channel. The `Verdict.cuts` data field stays on the value
// type because the engine still writes `option_cuts` rows for receipts
// / analytics use, but the surface never renders them.
//
// What the view does NOT do:
//   * Compute anything from `votes`. The engine in
//     `supabase/functions/_shared/verdict-engine.ts` is the single
//     canonical implementation; iOS surfaces the engine's output.
//   * Render closed verdicts — that's `VerdictReadOnlyScreen`.
//   * Render no-survivor terminals — that's `NoSurvivorScreen`.
//
// Reduced motion: drops the choreographed reveal to instant per
// `motion.md` §"Reduced motion fallback". Receipts land simultaneously.

import SwiftUI

@MainActor
public struct VerdictScreen: View {
    /// Three-case flavor enum for the live verdict surface. ADR 0018
    /// renamed the prior 5-case `Mode` to `Flavor` to mark the scope
    /// contraction; `.readOnly` and `.noSurvivor` moved to their own
    /// surfaces.
    public enum Flavor: String, Sendable {
        case `default`
        case committed
        /// TB-13 — single-member solo flow. See file header for the
        /// surface contract. `design-system/surfaces/05-verdict.md`
        /// §"solo" carries the locked rules.
        case solo
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

        // Snapshot/smoke-test fixture factories — `fixture()`,
        // `soloFixture()`, `noSurvivorFixture()` — were relocated to the
        // test target (`Tests/ScreenFixtures.swift`) by bug-11 so the
        // shipped binary carries no fictitious venue strings.
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
    /// TB-08 — local commit flag. Flipped by the "I'm in" tap, drives
    /// the sun-fill / "You're in · N of M" CTA per S05 §Modes.
    @State private var committedLocally: Bool = false
    /// TB-08 — wall-clock seconds remaining in the correctability
    /// window. The view ticks this on a 1-Hz Task while in committed
    /// flavor. Null when no commitment exists yet.
    @State private var windowSecondsRemaining: Int? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let verdict: Verdict
    private let flavor: Flavor
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
    /// bug-22 — fires when the user taps the top-leading `Home` text
    /// verb in the verdict chrome row. Pure navigation — pops to S00
    /// Plan list. No session teardown, no membership mutation. See
    /// `design-system/surfaces/05-verdict.md` §"Verdict chrome (Home)".
    private let onHome: () -> Void
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
    /// Suppressed when `rerollsUsed >= 3` (the footer reads "No rerolls
    /// left" instead per S07 §"Edge cases").
    private let onReroll: () -> Void

    public init(
        verdict: Verdict,
        flavor: Flavor = .default,
        ratifiedCount: Int = 0,
        ratifiedTotal: Int = 0,
        correctabilityWindowSeconds: Int = 30,
        rerollsUsed: Int = 0,
        onAdvance: @escaping () -> Void = {},
        onRatify: @escaping () -> Void = {},
        onHome: @escaping () -> Void = {},
        onReroll: @escaping () -> Void
    ) {
        self.verdict = verdict
        self.flavor = flavor
        self.ratifiedCount = ratifiedCount
        self.ratifiedTotal = ratifiedTotal
        self.correctabilityWindowSeconds = correctabilityWindowSeconds
        self.rerollsUsed = rerollsUsed
        self.onAdvance = onAdvance
        self.onRatify = onRatify
        self.onHome = onHome
        self.onReroll = onReroll
        // Pre-load the commit flag when the flavor is `.committed` (used
        // by snapshot tests + the TB-11 read-only late-joiner path).
        self._committedLocally = State(initialValue: flavor == .committed)
        self._windowSecondsRemaining = State(
            initialValue: flavor == .committed ? correctabilityWindowSeconds : nil
        )
    }

    // MARK: - body

    public var body: some View {
        ZStack {
            GTIGradient.surface(.verdict)
                .ignoresSafeArea()
                .accessibilityIdentifier("verdict.gradient")

            VStack(spacing: 0) {
                // bug-22 — Home chrome row. Top-leading text verb
                // mirroring the QuizChrome `Back` slot. Always rendered
                // on the live verdict surface (every flavor has a Plan-
                // list destination). See
                // `design-system/surfaces/05-verdict.md` §"Verdict
                // chrome (Home)".
                homeChromeRow
                    .padding(.top, GTISpacing.step3)
                    .padding(.horizontal, GTISpacing.step5)

                // Eyebrow
                eyebrow
                    .padding(.top, GTISpacing.step4)
                    .padding(.horizontal, GTISpacing.step6)

                // Hero — stacked one word per line, uppercase
                hero
                    .padding(.top, GTISpacing.step3)
                    .padding(.horizontal, GTISpacing.step6)

                // Meta line
                metaLine
                    .padding(.top, GTISpacing.step3)
                    .padding(.horizontal, GTISpacing.step6)

                // Time badge — pops at 820ms. Always rendered on the
                // live verdict surface (no flavor suppresses it).
                timeBadge
                    .padding(.top, GTISpacing.step6)

                // Rule chip
                ruleChip
                    .padding(.top, GTISpacing.step6)
                    .padding(.horizontal, GTISpacing.step6)

                // Voice receipts — wrapped row of glass chips. Solo
                // suppresses the row (one voice doesn't need to be
                // receipted back to itself).
                if modeSnapshot.showReceipts {
                    receiptsRow
                        .padding(.top, GTISpacing.step6)
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

    /// bug-22 + wfr-16 — top-leading chrome verb. Same eyebrow-token
    /// treatment + 44pt hit row as the QuizChrome `Back` slot. Pure
    /// navigation: tap fires `onHome` (pops to S00 Plan list). Top-
    /// trailing slot is intentionally empty (S05 has no `Exit`
    /// counterpart). See `design-system/surfaces/05-verdict.md`
    /// §"Verdict chrome (Home)".
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
            // Trailing slot empty — S05 has no `Exit` counterpart. The
            // 44pt-square reserved frame preserves vertical rhythm on
            // surfaces that might later acquire a trailing affordance.
            Color.clear
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityHidden(true)
        }
        .frame(minHeight: 44)
    }

    @ViewBuilder
    private var hero: some View {
        let lines = VerdictScreen.heroLines(for: verdict.placeName)
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
            // bug-28 — solo flavor (and any caller) signals "suppress
            // the audience subtitle" by passing an empty audience
            // string. The subtitle Text is dropped entirely so the
            // VStack collapses to one child — no empty placeholder row.
            // Group flavors still surface `"ALL N OF YOU"`.
            if !verdict.timeBadge.audience.isEmpty {
                Text(verdict.timeBadge.audience.uppercased())
                    .font(.system(size: 9, weight: .black))
                    .tracking(GTIFont.TrackingEm.eyebrow * 9)
                    .foregroundStyle(GTIColor.ink)
            }
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
    private var ctaDock: some View {
        VStack(spacing: 14) {
            if flavor == .solo {
                soloCTADock
            } else if isCommittedFlavor {
                // Committed flavor — sun-fill pill, ink check prefix,
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
                // Default flavor — "I'm in" white pill. bug-22 removed
                // the `"Start over"` tertiary that previously sat under
                // the primary; the Home verb now lives in the chrome
                // row above the eyebrow (see `homeChromeRow`).
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
    /// `"Edge cases"` register.
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
    /// `"Turn on push"`.
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

    /// Test-readable: is the surface in the committed flavor (flavor is
    /// `.committed` OR the local "I'm in" tap has fired)?
    public var isCommittedFlavor: Bool {
        flavor == .committed || committedLocally
    }

    /// TB-13 — solo CTA dock. Renders the same warm primary as
    /// `default` ("I'm in" → committed "You're in"), the reroll tertiary,
    /// the C-22 save-taste-profile chip in place of the group save
    /// affordance, and the pre-permission line. bug-22 removed the
    /// quiet "Start over" secondary that previously sat below the
    /// primary; the Home verb now lives on the chrome row above the
    /// eyebrow. The chip's surfaced state comes from the host's
    /// `AuthPromptStore`; this view renders a default-idle placeholder
    /// chip so the surface still demos in the design-system preview.
    @ViewBuilder
    private var soloCTADock: some View {
        if isCommittedFlavor {
            committedPill
            Text(VerdictScreen.windowCountdownCopy(seconds: windowSecondsRemaining))
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.65))
                .padding(GTISpacing.step1)
                .accessibilityIdentifier("verdict.cta.secondary")
            rerollTertiary
            soloSaveTasteProfileChip
            preCheckInLine
        } else {
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

            rerollTertiary
            soloSaveTasteProfileChip
            preCheckInLine
        }
    }

    /// TB-13 — render gate for the C-22 save-taste-profile chip in the
    /// solo CTA dock. Renders the chip in `.defaultIdle` state by
    /// default; the host (RootView) wires the live state from
    /// `AuthPromptStore` via the upcoming TB-13 plumbing. The view
    /// renders an inert chip here so the design-system parity preview
    /// and the snapshot suite have something to render.
    @ViewBuilder
    private var soloSaveTasteProfileChip: some View {
        AuthUpgradeChip(state: .defaultIdle)
            .padding(.top, GTISpacing.step1)
            .accessibilityIdentifier("verdict.solo.saveTasteProfile")
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
        public let eyebrowCopy: String
        public let primaryCtaLabel: String
        public let secondaryLabel: String
        /// True when the surface is in the committed flavor (TB-08).
        /// Either the caller passed `.committed` flavor or the local
        /// "I'm in" tap has fired.
        public let isCommittedFlavor: Bool
        /// Pre-permission line copy surfaced under the CTA dock
        /// (TB-08). Empty when suppressed (no flavor suppresses it on
        /// the live verdict).
        public let preCheckInLine: String
        /// TB-13 — solo flavor surfaces the C-22 save-taste-profile
        /// chip in place of the group-save affordance.
        public let showSaveTasteProfileChip: Bool
        /// bug-22 / wfr-16 — render gate for the top-leading chrome row.
        /// Always true on the live verdict surface (Home is always
        /// reachable). Retained on the snapshot for backward-compatible
        /// test reads.
        public let showHomeChrome: Bool
        /// bug-22 — chrome verb. Always `Home` on the live verdict
        /// surface. (The `Done` verb belongs to `VerdictReadOnlyScreen`,
        /// not this snapshot.)
        public let homeChromeLabel: String
    }

    /// Mode-shaped flags surfaced for the snapshot tests. Mirrors the
    /// flat flags at the top of `ScreenVerdict.jsx`'s body.
    public var modeSnapshot: ModeSnapshot {
        let isSolo      = flavor == .solo
        let isCommitted = (flavor == .committed || committedLocally)

        let eyebrow = "Tonight, the verdict is"

        let primaryLabel: String
        if isCommitted {
            primaryLabel = VerdictScreen.committedCtaLabel(
                count: ratifiedCount,
                total: ratifiedTotal
            )
        } else {
            primaryLabel = "I'm in"
        }

        // bug-22 — the dock secondary now only carries the committed
        // status line (`"Window closes in 47s"`). The retired
        // `"Start over"` tertiary was lifted into the chrome row.
        let secondary: String
        if isCommitted {
            secondary = VerdictScreen.windowCountdownCopy(
                seconds: windowSecondsRemaining
            )
        } else {
            secondary = ""
        }

        return ModeSnapshot(
            showTimeBadge: true,
            // Solo suppresses receipts — one voice doesn't need to be
            // receipted back to itself. Otherwise the row surfaces.
            showReceipts: !isSolo,
            eyebrowCopy: eyebrow,
            primaryCtaLabel: primaryLabel,
            secondaryLabel: secondary,
            isCommittedFlavor: isCommitted,
            preCheckInLine: VerdictScreen.preCheckInCopy,
            showSaveTasteProfileChip: isSolo,
            showHomeChrome: true,
            homeChromeLabel: VerdictScreen.homeChromeLabel
        )
    }

    // MARK: - TB-08 pure copy formatters

    /// PRD user story 38 + S05 spec lock: warm "We'll check in" line.
    /// NEVER paraphrase to "Enable notifications" / "Allow alerts" —
    /// the wording is voluntary register, the prompt is the call.
    public static let preCheckInCopy = "We'll check in tomorrow — see if you went."

    /// bug-22 — text-only verb on the top-leading chrome slot. Resolved
    /// by the spec grill (2026-05-24) over alternatives (`Done`,
    /// SF Symbol house, icon+label). The Sunset Pop chrome-row idiom is
    /// text-only — matches the `QuizChrome` `Back` / `Exit` / `Leave`
    /// pattern. NEVER paraphrase. See
    /// `design-system/surfaces/05-verdict.md` §"Verdict chrome (Home)".
    public static let homeChromeLabel = "Home"

    /// S05 §Modes — committed CTA reads `"You're in · N of M"`. We
    /// guard against `total = 0` (count snapshot hasn't loaded yet)
    /// by falling back to `"You're in"`. TB-13 — for solo runs
    /// (`total == 1`) the N-of-M denominator collapses; there's no
    /// quorum to count to, so the label is simply `"You're in"`.
    public static func committedCtaLabel(count: Int, total: Int) -> String {
        if total <= 0 { return "You're in" }
        if total == 1 { return "You're in" }  // solo — no denominator
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
}

// MARK: - FlowLayout (wrap-row used for receipts row)
//
// iOS 17 deployment target exposes the SwiftUI `Layout` protocol —
// using it gives a deterministic wrap row without the GeometryReader
// re-render flicker that the `alignmentGuide` trick is famous for.
// Mirrors the JSX `flexWrap: 'wrap'` behaviour for the receipts row.

struct FlowLayout: Layout {
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
