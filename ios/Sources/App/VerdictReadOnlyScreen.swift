// GetToIt — VerdictReadOnlyScreen (bug-34 / ADR 0018).
//
// Closed-verdict Focus surface — the iOS render for a sealed Plan a
// viewer arrives at without a vote on the room. ADR 0018 split this
// out of the prior 5-mode `VerdictScreen` so the read-only intent has
// its own single-intent surface (per the Focus playbook in
// `surfaces.md §Focus`).
//
// Arrival vectors (and the chrome flag they pick):
//   * Account member from PlanList History  → `showHomeChrome = true`
//   * Account member from a Joined Decided card → `showHomeChrome = true`
//   * Account member deep-linking into their own decided-expired Plan → `showHomeChrome = true`
//   * Web invitee deep-linking into someone else's `decided-expired`
//     Plan → `showHomeChrome = false` (no Plan list to land on)
//
// Suppressed (relative to the live verdict):
//   * Ratify ("I'm in" / "You're in · N of M") — the verdict is sealed.
//   * Reroll tertiary — only the live verdict consumes a burn.
//   * Dock countdown — no correctability window on a closed verdict.
//   * Save-chip — solo replacement; only relevant during live ratify.
//   * Pre-permission line — no ratification means no check-in to chase.
//
// Primary CTA `"Start a new decision"` fires the caller-provided
// `onAdvance` closure. For Web invitees this lands on Solo Setup as
// the new initiator; for Account members it pops back to PlanList (the
// host wires the destination — this surface just signals the verb).
//
// Chrome verb is `Done` (not `Home`). The late-joiner has no Plan-list
// destination — `Done` is the honest verb for "close this read-only
// snapshot". Tap fires `onAdvance` (same re-invite path the primary
// CTA uses), giving every iOS-reachable verdict surface a top-leading
// escape slot.
//
// VO contract (locked in `design-system/accessibility.md`
// §"Verdict (read-only mode)"): the absent ratification path is
// announced as "Not available — this verdict is closed." Surfaced as
// the accessibilityHint on the re-invite CTA so a VO user reading the
// focus chain hears the closure before they hear the CTA's action.
//
// Reduced motion: drops the choreographed reveal to instant per
// `motion.md` §"Reduced motion fallback".

import SwiftUI

@MainActor
public struct VerdictReadOnlyScreen: View {

    // MARK: - state

    @State private var revealStep: Int = 0
    @State private var receiptIndexShown: Int = -1
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let verdict: VerdictScreen.Verdict
    /// True when the arrival vector has a Plan-list destination — the
    /// chrome row is rendered. False for Web-invitee deep links.
    public let showHomeChrome: Bool
    private let onAdvance: () -> Void

    public init(
        verdict: VerdictScreen.Verdict,
        showHomeChrome: Bool = true,
        onAdvance: @escaping () -> Void = {}
    ) {
        self.verdict = verdict
        self.showHomeChrome = showHomeChrome
        self.onAdvance = onAdvance
    }

    // MARK: - body

    public var body: some View {
        ZStack {
            GTIGradient.surface(.verdict)
                .ignoresSafeArea()
                .accessibilityIdentifier("verdict.gradient")

            VStack(spacing: 0) {
                if showHomeChrome {
                    homeChromeRow
                        .padding(.top, GTISpacing.step3)
                        .padding(.horizontal, GTISpacing.step5)
                }

                // Eyebrow — past-tense-implicit `"Tonight's verdict"`.
                eyebrow
                    .padding(.top, showHomeChrome ? GTISpacing.step4 : GTISpacing.step10)
                    .padding(.horizontal, GTISpacing.step6)

                hero
                    .padding(.top, GTISpacing.step3)
                    .padding(.horizontal, GTISpacing.step6)

                metaLine
                    .padding(.top, GTISpacing.step3)
                    .padding(.horizontal, GTISpacing.step6)

                timeBadge
                    .padding(.top, GTISpacing.step6)

                ruleChip
                    .padding(.top, GTISpacing.step6)
                    .padding(.horizontal, GTISpacing.step6)

                receiptsRow
                    .padding(.top, GTISpacing.step6)
                    .padding(.horizontal, GTISpacing.step6)

                Spacer(minLength: 0)

                ctaDock
                    .padding(.bottom, GTISpacing.step5)
                    .padding(.horizontal, GTISpacing.step6)
            }
        }
        .task { await runChoreo() }
    }

    // MARK: - subviews

    @ViewBuilder
    private var eyebrow: some View {
        Text(VerdictReadOnlyScreen.eyebrowCopy.uppercased())
            .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
            .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.86))
            .multilineTextAlignment(.center)
            .opacity(revealStep >= 1 ? 1 : 0)
            .offset(y: revealStep >= 1 ? 0 : 8)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("verdict.eyebrow")
    }

    /// wfr-16 / bug-34 — top-leading chrome verb `Done`. Same eyebrow-
    /// token treatment + 44pt hit row as the QuizChrome `Back` slot.
    /// Tap fires `onAdvance` (the same re-invite path the primary CTA
    /// uses). See `design-system/surfaces/05a-verdict-read-only.md`.
    @ViewBuilder
    private var homeChromeRow: some View {
        HStack(alignment: .center) {
            Button(action: onAdvance) {
                Text(VerdictReadOnlyScreen.chromeLabel.uppercased())
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.78))
                    .frame(minWidth: 44, minHeight: 44, alignment: .leading)
                    .padding(.horizontal, 4)
                    .contentShape(Rectangle())
            }
            .accessibilityIdentifier("verdict.chrome.home")
            .accessibilityLabel(VerdictReadOnlyScreen.chromeLabel)
            Spacer()
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
        .opacity(receiptIndexShown >= index ? 1 : 0)
        .scaleEffect(receiptIndexShown >= index ? 1 : 0.96)
        .offset(y: receiptIndexShown >= index ? 0 : 8)
    }

    @ViewBuilder
    private var ctaDock: some View {
        VStack(spacing: 14) {
            Button(action: onAdvance) {
                Text(VerdictReadOnlyScreen.primaryCtaLabel.uppercased())
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
            .accessibilityLabel(VerdictReadOnlyScreen.primaryCtaLabel)
            .accessibilityHint(VerdictReadOnlyScreen.ratificationVOAnnouncement)
        }
        .opacity(revealStep >= 7 ? 1 : 0)
        .offset(y: revealStep >= 7 ? 0 : 8)
    }

    // MARK: - choreography

    private func runChoreo() async {
        if reduceMotion {
            revealStep = 7
            receiptIndexShown = verdict.receipts.count - 1
            return
        }

        let easing = GTIMotion.Easing.outSoft
        let staggerMs = Int(VerdictScreen.Choreo.staggerReceipt * 1000)

        enum Action {
            case setStep(Int, Double)
            case showReceipt(Int, Double)
        }

        var schedule: [(delayMs: Int, action: Action)] = [
            (Int(VerdictScreen.Choreo.eyebrowDelay  * 1000), .setStep(1, VerdictScreen.Choreo.eyebrowDuration)),
            (Int(VerdictScreen.Choreo.nameDelay     * 1000), .setStep(2, VerdictScreen.Choreo.nameDuration)),
            (Int(VerdictScreen.Choreo.metaDelay     * 1000), .setStep(3, VerdictScreen.Choreo.metaDuration)),
            (Int(VerdictScreen.Choreo.timeDelay     * 1000), .setStep(4, VerdictScreen.Choreo.timeDuration)),
            (Int(VerdictScreen.Choreo.ruleDelay     * 1000), .setStep(5, VerdictScreen.Choreo.ruleDuration)),
            (Int(VerdictScreen.Choreo.receiptsDelay * 1000), .setStep(6, VerdictScreen.Choreo.receiptDuration)),
        ]
        for index in 0..<verdict.receipts.count {
            let delayMs = Int(VerdictScreen.Choreo.receiptsDelay * 1000) + index * staggerMs
            schedule.append((delayMs, .showReceipt(index, VerdictScreen.Choreo.receiptDuration)))
        }
        schedule.append((Int(VerdictScreen.Choreo.ctaDelay * 1000), .setStep(7, VerdictScreen.Choreo.ctaDuration)))

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

    // MARK: - locked copy

    /// `"Tonight's verdict"` — past-tense-implicit. The late-joiner
    /// sees the decision already happened. See
    /// `design-system/surfaces/05a-verdict-read-only.md` §"Copy".
    public static let eyebrowCopy = "Tonight's verdict"

    /// wfr-16 / bug-34 — text-only verb for the read-only chrome slot.
    /// The late-joiner has no Plan list to land on, so the chrome
    /// cannot honestly read `Home`. `Done` frames the chrome tap as
    /// "close this read-only snapshot"; it fires `onAdvance` (the same
    /// re-invite path the primary CTA uses).
    public static let chromeLabel = "Done"

    /// Locked primary CTA — voluntary register, frames a new round.
    /// NOT `"Re-do"` / `"Join late"`. See
    /// `design-system/surfaces/05a-verdict-read-only.md` §"Copy".
    public static let primaryCtaLabel = "Start a new decision"

    /// TB-11 / wfr-16 — VO announcement for the suppressed
    /// ratification path. Locked by
    /// `design-system/accessibility.md` §"Verdict (read-only mode)".
    /// VoiceOver users hear this when they focus the re-invite CTA.
    public static let ratificationVOAnnouncement =
        "Not available — this verdict is closed."
}
