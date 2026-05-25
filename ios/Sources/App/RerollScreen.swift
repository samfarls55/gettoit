// GetToIt — RerollScreen (TB-10, S07).
//
// SwiftUI port of `design-system/code/screens/ScreenReroll.jsx`. The
// reroll surface is friction-bearing: capped at 3 per session, each
// reroll requires a stated reason from the locked 5-token taxonomy
// (`cost · dist · mood · diet · avail`), and the reason becomes a
// real new constraint on the next engine run.
//
// What the view does:
//   * Renders the locked S07 sheet over a darkened midnight gradient
//     surface (per `surfaces/07-reroll.md` + JSX). Sheet opens with a
//     380ms ease-out-soft fade-up (motion.md §"Utility motion").
//   * Surfaces the 2-col reason grid + glyph + label. Selecting a
//     reason gates the primary CTA from `"Pick a reason first"` to
//     `"Reroll · burns N of 3"` (or `"Reroll · last one"` on the
//     3rd attempt).
//   * Surfaces the "N LEFT" stamp in the sun-tinted register. Decrements
//     as rerolls burn.
//   * Surfaces the optional one-line detail input under the selected
//     tile. Submitted to the apply_reroll RPC alongside the reason.
//   * On `mood`-reason selection, surfaces an inline 5-position vibe
//     scalar (QUIET·CHILL·SOCIAL·LIVELY·ROWDY — `GTIVibeLabels.all`)
//     so the caller can pick their new vibe value; the RPC writes
//     that into their `votes` row.
//   * On `diet`-reason selection, surfaces an inline dietary chip
//     picker so the caller can pick the additional EBA veto.
//   * Cancel CTA reads `"Cancel · keep <Place>"` (named alternative,
//     not sterile "Cancel").
//   * On 3rd / last reroll: the stamp reads `"1 left"`, the primary
//     CTA reads `"Reroll · last one"`, and an additional body line
//     surfaces `"After this, tonight is committed."`.
//
// What the view does NOT do:
//   * Make the network call. The view's `onSubmit` closure is wired
//     by the caller to a `RerollStore.applyReroll(...)` invocation,
//     which writes the rerolls row, mutates state, deletes the prior
//     verdict, and then invokes `compute-verdict` for the re-run.
//   * Enforce the 3-cap client-side. The cap is server-authoritative
//     via the apply_reroll RPC + the trg_rerolls_cap trigger; the
//     surface only renders the "N left" stamp + the "last one" copy
//     to make the cost vivid.
//   * Decide which member can reroll. The original release ships with the initiator-only
//     UI gate enforced at the caller's routing layer (per S07 §
//     "Edge cases · Group veto of reroll").
//
// Reduced motion: per `motion.md` §"Reduced motion fallback",
// "sheet open · drop the translateY rise; opacity fade only." The
// view honours `accessibilityReduceMotion` and skips the rise.

import SwiftUI

@MainActor
public struct RerollScreen: View {
    public enum Reason: String, CaseIterable, Identifiable, Sendable {
        case cost
        case dist
        case mood
        case diet
        case avail

        public var id: String { rawValue }

        /// Display label per S07 + the JSX fixture. These are
        /// load-bearing UI copy — don't paraphrase.
        public var label: String {
            switch self {
            case .cost:  return "Too pricey"
            case .dist:  return "Too far"
            case .mood:  return "Mood shifted"
            case .diet:  return "Diet missed"
            case .avail: return "Not open"
            }
        }

        /// Glyph rendered above the label in the reason tile, per the
        /// JSX fixture.
        public var glyph: String {
            switch self {
            case .cost:  return "$"
            case .dist:  return "→"
            case .mood:  return "~"
            case .diet:  return "✕"
            case .avail: return "○"
            }
        }
    }

    /// Dietary chip presented to the caller on a `diet`-reason reroll.
    /// Mirrors the Q1 chip taxonomy in
    /// `supabase/functions/_shared/verdict-engine.ts` §`DIETARY_REQUIREMENTS`.
    public enum DietaryChip: String, CaseIterable, Identifiable, Sendable {
        case shellfish
        case dairy
        case gluten
        case nuts
        case vegan
        case vegetarian
        case halal
        case kosher

        public var id: String { rawValue }

        public var label: String {
            switch self {
            case .shellfish:  return "Shellfish-safe"
            case .dairy:      return "Dairy-safe"
            case .gluten:     return "Gluten-free"
            case .nuts:       return "Nut-safe"
            case .vegan:      return "Vegan options"
            case .vegetarian: return "Vegetarian options"
            case .halal:      return "Halal options"
            case .kosher:     return "Kosher options"
            }
        }
    }

    /// Submit payload — the caller wires this to the apply_reroll RPC.
    /// Carries the reason + optional detail + optional per-reason
    /// extras (new vibe for `mood`, new dietary chip for `diet`).
    public typealias Submit = (
        _ reason: Reason,
        _ detail: String?,
        _ newVibe: Int?,
        _ dietChip: String?
    ) -> Void

    // MARK: - choreo + motion

    public enum Motion {
        /// `motion.md` §"Utility motion": sheet open = 380ms ease-out-soft.
        public static let sheetOpenDuration: Double = 0.380
    }

    // MARK: - state

    @State private var selectedReason: Reason?
    @State private var detail: String = ""
    @State private var newVibe: Int = 2
    @State private var selectedDietChip: DietaryChip = .vegan
    @State private var revealed: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let placeName: String
    private let rerollsUsed: Int
    private let onCancel: () -> Void
    private let onSubmit: Submit

    public init(
        placeName: String,
        rerollsUsed: Int = 0,
        onCancel: @escaping () -> Void = {},
        onSubmit: @escaping Submit = { _, _, _, _ in }
    ) {
        self.placeName = placeName
        self.rerollsUsed = rerollsUsed
        self.onCancel = onCancel
        self.onSubmit = onSubmit
    }

    // MARK: - body

    public var body: some View {
        ZStack {
            GTIGradient.surface(.midnight)
                .ignoresSafeArea()

            // Veil — 0.32 opacity over the midnight surface per the JSX
            // fixture's `background: 'rgba(0,0,0,0.32)'`.
            Color.black
                .opacity(0.32)
                .ignoresSafeArea()
                .accessibilityIdentifier("reroll.veil")

            sheetCard
                .opacity(revealed ? 1 : 0)
                .offset(y: revealed || reduceMotion ? 0 : 24)
                .padding(.horizontal, GTISpacing.step3)
                .padding(.bottom, GTISpacing.step3)
                .frame(maxHeight: .infinity, alignment: .bottom)
        }
        .task {
            await runReveal()
        }
    }

    @ViewBuilder
    private var sheetCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            handle
                .padding(.top, GTISpacing.step3)
                .padding(.bottom, GTISpacing.step5)
            header
                .padding(.horizontal, GTISpacing.step5)
            disclosureLine
                .padding(.horizontal, GTISpacing.step5)
                .padding(.top, GTISpacing.step3)
                .padding(.bottom, GTISpacing.step5)
            reasonGrid
                .padding(.horizontal, GTISpacing.step5)
                .padding(.bottom, GTISpacing.step3)
            if let reason = selectedReason {
                detailSection(reason: reason)
                    .padding(.horizontal, GTISpacing.step5)
                    .padding(.bottom, GTISpacing.step3)
            }
            if let lastNote = RerollScreen.lastRerollNotice(rerollsUsed: rerollsUsed) {
                Text(lastNote)
                    .font(.system(size: GTIFont.Size.sm, weight: .heavy))
                    .foregroundStyle(GTIColor.sun)
                    .padding(.horizontal, GTISpacing.step5)
                    .padding(.bottom, GTISpacing.step3)
                    .accessibilityIdentifier("reroll.lastNotice")
            }
            ctaDock
                .padding(.horizontal, GTISpacing.step5)
                .padding(.bottom, GTISpacing.step4)
        }
        .background(
            GTIColor.ink2.opacity(0.92),
            in: RoundedRectangle(cornerRadius: GTIRadii.sheet)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.sheet)
                .strokeBorder(Color.white.opacity(0.10), lineWidth: 1)
        )
        .accessibilityIdentifier("reroll.sheet")
    }

    private var handle: some View {
        RoundedRectangle(cornerRadius: 999)
            .fill(Color.white.opacity(0.22))
            .frame(width: 38, height: 4)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("reroll.handle")
    }

    @ViewBuilder
    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: GTISpacing.step1) {
                Text("REROLL THE VERDICT")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.6))
                    .accessibilityIdentifier("reroll.eyebrow")
                Text("WHAT CHANGED?")
                    .font(.system(size: GTIFont.Size.displayS, weight: .black))
                    .tracking(GTIFont.TrackingEm.displayS * GTIFont.Size.displayS)
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .accessibilityIdentifier("reroll.title")
            }
            Spacer(minLength: GTISpacing.step3)
            stampBadge
        }
    }

    private var stampBadge: some View {
        Text(RerollScreen.stampCopy(rerollsUsed: rerollsUsed).uppercased())
            .font(.system(size: 10, weight: .black))
            .tracking(GTIFont.TrackingEm.eyebrow * 10)
            .foregroundStyle(GTIColor.sun)
            .padding(.horizontal, GTISpacing.step3)
            .padding(.vertical, GTISpacing.step2)
            .background(
                GTIColor.sun.opacity(0.16),
                in: RoundedRectangle(cornerRadius: GTIRadii.tag)
            )
            .overlay(
                RoundedRectangle(cornerRadius: GTIRadii.tag)
                    .strokeBorder(GTIColor.sun.opacity(0.45), lineWidth: 1)
            )
            .accessibilityIdentifier("reroll.stamp")
    }

    @ViewBuilder
    private var disclosureLine: some View {
        Text("Your reason becomes a new constraint. The group sees it. Pick the one that's actually true.")
            .font(.system(size: GTIFont.Size.sm, weight: .semibold))
            .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.65))
            .lineSpacing(GTIFont.Size.sm * (GTIFont.LineHeight.sm - 1))
            .frame(maxWidth: 320, alignment: .leading)
            .accessibilityIdentifier("reroll.disclosure")
    }

    @ViewBuilder
    private var reasonGrid: some View {
        let columns = [
            GridItem(.flexible(), spacing: GTISpacing.step2),
            GridItem(.flexible(), spacing: GTISpacing.step2),
        ]
        LazyVGrid(columns: columns, spacing: GTISpacing.step2) {
            ForEach(Reason.allCases) { reason in
                reasonTile(reason: reason)
            }
        }
        .accessibilityIdentifier("reroll.reasonGrid")
    }

    @ViewBuilder
    private func reasonTile(reason: Reason) -> some View {
        let isSelected = selectedReason == reason
        Button {
            withAnimation(.easeOut(duration: GTIMotion.Duration.chip)) {
                selectedReason = reason
            }
        } label: {
            VStack(alignment: .leading, spacing: GTISpacing.step1) {
                Text(reason.glyph)
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(
                        isSelected
                            ? GTIColor.ink
                            : GTIColor.TextOnGradient.primary.opacity(0.85)
                    )
                Text(reason.label)
                    .font(.system(size: 13, weight: .heavy))
                    .tracking(0.05 * 13)
                    .foregroundStyle(
                        isSelected
                            ? GTIColor.ink
                            : GTIColor.TextOnGradient.primary
                    )
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(GTISpacing.step3)
            .background(
                isSelected ? GTIColor.sun : Color.white.opacity(0.04),
                in: RoundedRectangle(cornerRadius: GTIRadii.tag + 4) // ~12 per JSX
            )
            .overlay(
                RoundedRectangle(cornerRadius: GTIRadii.tag + 4)
                    .strokeBorder(
                        isSelected ? Color.clear : Color.white.opacity(0.14),
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("reroll.reason.\(reason.rawValue)")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    @ViewBuilder
    private func detailSection(reason: Reason) -> some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2) {
            Text("ONE LINE FOR THE GROUP (OPTIONAL)")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.6))

            TextField("", text: $detail, prompt: Text("e.g. just realized I left my wallet")
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.4)))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .padding(GTISpacing.step3)
                .background(
                    Color.white.opacity(0.05),
                    in: RoundedRectangle(cornerRadius: 10)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .strokeBorder(Color.white.opacity(0.14), lineWidth: 1)
                )
                .accessibilityIdentifier("reroll.detailInput")

            if reason == .mood {
                vibePicker
            }
            if reason == .diet {
                dietPicker
            }
        }
        .accessibilityIdentifier("reroll.detailSection")
    }

    /// Inline vibe scalar — surfaces when the caller picks `mood` as
    /// the reroll reason so they can pick the new vibe value the RPC
    /// writes into their votes row.
    @ViewBuilder
    private var vibePicker: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2) {
            Text("NEW VIBE")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.6))
            HStack(spacing: GTISpacing.step1) {
                ForEach(0..<GTIVibeLabels.all.count, id: \.self) { idx in
                    let label = GTIVibeLabels.all[idx]
                    Button {
                        newVibe = idx
                    } label: {
                        Text(label)
                            .font(.system(size: 10, weight: .black))
                            .tracking(GTIFont.TrackingEm.eyebrow * 10)
                            .foregroundStyle(
                                newVibe == idx
                                    ? GTIColor.ink
                                    : GTIColor.TextOnGradient.primary.opacity(0.85)
                            )
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, GTISpacing.step2)
                            .background(
                                newVibe == idx ? GTIColor.sun : Color.white.opacity(0.04),
                                in: RoundedRectangle(cornerRadius: GTIRadii.tag)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("reroll.vibe.\(idx)")
                }
            }
        }
    }

    /// Inline dietary chip picker — surfaces when the caller picks
    /// `diet` as the reroll reason so they can pick the additional
    /// EBA veto.
    @ViewBuilder
    private var dietPicker: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2) {
            Text("WHICH CHIP")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.6))
            let columns = [
                GridItem(.flexible(), spacing: GTISpacing.step1),
                GridItem(.flexible(), spacing: GTISpacing.step1),
            ]
            LazyVGrid(columns: columns, spacing: GTISpacing.step1) {
                ForEach(DietaryChip.allCases) { chip in
                    Button {
                        selectedDietChip = chip
                    } label: {
                        Text(chip.label)
                            .font(.system(size: 12, weight: .heavy))
                            .foregroundStyle(
                                selectedDietChip == chip
                                    ? GTIColor.ink
                                    : GTIColor.TextOnGradient.primary
                            )
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, GTISpacing.step3)
                            .padding(.vertical, GTISpacing.step2)
                            .background(
                                selectedDietChip == chip ? GTIColor.sun : Color.white.opacity(0.04),
                                in: RoundedRectangle(cornerRadius: GTIRadii.tag)
                            )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("reroll.diet.\(chip.rawValue)")
                }
            }
        }
    }

    @ViewBuilder
    private var ctaDock: some View {
        VStack(spacing: GTISpacing.step2) {
            Button(action: handleSubmit) {
                Text(RerollScreen.primaryCtaLabel(
                    rerollsUsed: rerollsUsed,
                    hasReason: selectedReason != nil
                ))
                .font(.system(size: GTIFont.Size.cta, weight: .black))
                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                .foregroundStyle(
                    selectedReason != nil
                        ? GTIColor.ink
                        : GTIColor.TextOnGradient.primary.opacity(0.7)
                )
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(
                    selectedReason != nil ? GTIColor.sun : GTIColor.ink2,
                    in: RoundedRectangle(cornerRadius: GTIRadii.pill)
                )
            }
            .buttonStyle(.plain)
            .disabled(selectedReason == nil)
            .accessibilityIdentifier("reroll.cta.primary")

            Button(action: onCancel) {
                Text(RerollScreen.cancelCtaLabel(placeName: placeName).uppercased())
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(GTIFont.TrackingEm.eyebrow * 11)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.55))
                    .padding(GTISpacing.step1)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("reroll.cta.cancel")
        }
    }

    private func handleSubmit() {
        guard let reason = selectedReason else { return }
        let trimmedDetail = detail.trimmingCharacters(in: .whitespacesAndNewlines)
        let detailOrNil: String? = trimmedDetail.isEmpty ? nil : trimmedDetail
        let vibeOrNil: Int?
        let chipOrNil: String?
        switch reason {
        case .mood:
            vibeOrNil = newVibe
            chipOrNil = nil
        case .diet:
            vibeOrNil = nil
            chipOrNil = selectedDietChip.rawValue
        default:
            vibeOrNil = nil
            chipOrNil = nil
        }
        onSubmit(reason, detailOrNil, vibeOrNil, chipOrNil)
    }

    /// Drive the sheet's fade-up reveal. Reduced motion drops the
    /// translateY rise; opacity fade only per `motion.md` §"Reduced
    /// motion fallback · Sheet open."
    private func runReveal() async {
        if reduceMotion {
            self.revealed = true
            return
        }
        // 380ms ease-out-soft per motion.md §"Utility motion · Sheet open".
        let easing = GTIMotion.Easing.outSoft
        withAnimation(
            .timingCurve(easing.0, easing.1, easing.2, easing.3, duration: Motion.sheetOpenDuration)
        ) {
            self.revealed = true
        }
    }

    // MARK: - pure formatters (test-readable)

    /// `"3 left"` / `"2 left"` / `"1 left"`. Floors at zero — the
    /// surface itself is not reachable when no rerolls remain (S06's
    /// footer reads "No rerolls left" instead, per S07 §"Edge cases").
    public static func stampCopy(rerollsUsed: Int) -> String {
        let remaining = max(0, 3 - rerollsUsed)
        return "\(remaining) left"
    }

    /// Primary CTA label. Switches to `"Reroll · last one"` on the 3rd
    /// reroll (`rerollsUsed == 2`), to `"Pick a reason first"` when no
    /// reason is selected, and to `"Reroll · burns N of 3"` otherwise.
    public static func primaryCtaLabel(rerollsUsed: Int, hasReason: Bool) -> String {
        if !hasReason { return "Pick a reason first" }
        if rerollsUsed >= 2 { return "Reroll · last one" }
        return "Reroll · burns \(rerollsUsed + 1) of 3"
    }

    /// Cancel CTA — names the alternative explicitly so the user
    /// reads it as "keep the prior pick," not as "abort the flow."
    public static func cancelCtaLabel(placeName: String) -> String {
        return "Cancel · keep \(placeName)"
    }

    /// Locked extra body line on the 3rd reroll per S07 §"Edge cases":
    /// `"After this, tonight is committed."` Returns nil on
    /// non-last-reroll states so the surface doesn't render the line.
    public static func lastRerollNotice(rerollsUsed: Int) -> String? {
        guard rerollsUsed >= 2 else { return nil }
        return "After this, tonight is committed."
    }
}
