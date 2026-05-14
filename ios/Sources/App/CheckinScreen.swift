// GetToIt — CheckinScreen (TB-14, S08 next-day check-in).
//
// SwiftUI port of `design-system/code/screens/ScreenCheckin.jsx`. The
// surface feeds the north-star metric (% of verdicts followed-through).
// Designed to be tappable in 2 seconds from a lock-screen tap:
//
//   * Three big rows — `We went` / `We skipped` / `Ask me later`.
//   * On `We skipped` → reveal a single-row chip taxonomy and a
//     `Done` CTA. On `We went` / `Ask me later` → confirmation plate
//     fades up immediately.
//   * One tap commits the outcome; the surface routes onward.
//
// Why this surface defends against (per `surfaces/08-checkin.md`):
//   * Survey-induced abandonment — no multi-question form.
//   * Coercion — snooze is first-class.
//   * Algorithm framing — footer eyebrow names the contract.
//   * Notification fatigue — one tap, no follow-up nag.
//
// Motion canon:
//   * Reason-chip row fades up in 320ms ease-out-soft.
//   * Confirmation plate fades up in 320ms ease-out-soft.
//
// What this view does NOT do:
//   * Fetch the verdict / room state. The push notification's payload
//     carries `room_id` + `verdict_id`; the host wires the plate.
//   * Read or write `checkin_dispatches`. That table is service-role
//     only. The surface tap inserts into `check_ins` via the writer.
//   * Compute the metric. That's a SQL view over `check_ins`.

import Foundation
import Supabase
import SwiftUI

// MARK: - Writer seam

/// Injectable seam — production binds to `SupabaseCheckinWriter`,
/// tests bind to a capture spy.
public protocol CheckinWriter: AnyObject, Sendable {
    func record(outcome: CheckinScreen.Outcome, reason: CheckinScreen.SkipReason?) async throws
}

// MARK: - Screen

@MainActor
public struct CheckinScreen: View {

    // MARK: - inputs

    public struct Plate: Equatable, Sendable {
        public var roomID: UUID
        public var verdictID: UUID
        public var placeName: String
        public var verdictAt: String
        public var metaLine: String

        public init(
            roomID: UUID,
            verdictID: UUID,
            placeName: String,
            verdictAt: String,
            metaLine: String
        ) {
            self.roomID = roomID
            self.verdictID = verdictID
            self.placeName = placeName
            self.verdictAt = verdictAt
            self.metaLine = metaLine
        }

        public static func fixture() -> Plate {
            Plate(
                roomID: UUID(),
                verdictID: UUID(),
                placeName: "Pico's Taqueria",
                verdictAt: "Wed Apr 23 · 7:00 PM",
                metaLine: "4 in · 8 min walk"
            )
        }
    }

    public enum Outcome: String, Equatable, Sendable, CaseIterable {
        case went
        case skipped
        case snoozed
    }

    /// Reason chip taxonomy. Order is the locked S08 order.
    public enum SkipReason: String, CaseIterable, Equatable, Sendable {
        case walletTime
        case groupBailed
        case placePacked
        case moodShifted
        case other

        /// Surface copy — matches the locked chip labels.
        public var label: String {
            switch self {
            case .walletTime:  return "Wallet/time"
            case .groupBailed: return "Group bailed"
            case .placePacked: return "Place was packed"
            case .moodShifted: return "Mood shifted"
            case .other:       return "Other"
            }
        }

        /// Machine token — what lands in `check_ins.reason`. Snake
        /// case keeps it grep-friendly for the SQL diagnostic side.
        public var machineToken: String {
            switch self {
            case .walletTime:  return "wallet_time"
            case .groupBailed: return "group_bailed"
            case .placePacked: return "place_packed"
            case .moodShifted: return "mood_shifted"
            case .other:       return "other"
            }
        }
    }

    /// Pure description of one option row. Exposed publicly so tests
    /// can assert on the locked vocabulary.
    public struct OptionRow: Equatable, Sendable {
        public let outcome: Outcome
        public let label: String
        public let sub: String
        public let fill: Fill

        public enum Fill: String, Sendable {
            case sun, white, ghost
        }
    }

    /// Locked copy register from `surfaces/08-checkin.md` §"Copy
    /// register" + the canonical JSX in `ScreenCheckin.jsx`.
    public static let optionRows: [OptionRow] = [
        OptionRow(outcome: .went,    label: "We went",      sub: "And it was great",  fill: .sun),
        OptionRow(outcome: .skipped, label: "We skipped",   sub: "Something came up", fill: .white),
        OptionRow(outcome: .snoozed, label: "Ask me later", sub: "Not sure yet",      fill: .ghost),
    ]

    public static let questionCopy = "Did you go?"
    public static let footerEyebrow = "ONE TAP, THEN WE'RE GONE FOR THE DAY."

    /// `"☼ Got it."` for went; `"Ok — tomorrow."` for skipped + snoozed.
    public static func confirmationHeadline(for outcome: Outcome) -> String {
        switch outcome {
        case .went:    return "☼ Got it."
        case .skipped: return "Ok — tomorrow."
        case .snoozed: return "Ok — tomorrow."
        }
    }

    public static func confirmationBody(for outcome: Outcome, placeName: String) -> String {
        switch outcome {
        case .went:
            // S08 §"Copy register" — the truth-naming footer line.
            // The implicature is that the system remembers.
            return "Your follow-through is the only metric that matters. We'll remember \(placeName) worked."
        case .skipped, .snoozed:
            return "We'll pop back tonight before your usual session window."
        }
    }

    public enum Choreo {
        /// JSX uses `gti-fade-up 320ms ease-out-soft`. Mirror exactly.
        public static let fadeUpDuration: Double = 0.320
    }

    // MARK: - Model

    /// Pure observable so unit tests can drive record() without
    /// rendering the SwiftUI body.
    @MainActor
    public final class Model: ObservableObject {
        @Published public var selectedOutcome: Outcome?
        @Published public var selectedReason: SkipReason?
        @Published public var committed: Bool = false
        @Published public var pending: Bool = false
        @Published public var lastError: String?

        public let plate: Plate
        private let writer: CheckinWriter

        public init(plate: Plate, writer: CheckinWriter) {
            self.plate = plate
            self.writer = writer
        }

        /// One-shot record. Returns once the writer call resolves.
        public func record(outcome: Outcome, reason: SkipReason?) async throws {
            pending = true
            defer { pending = false }
            do {
                try await writer.record(outcome: outcome, reason: reason)
                self.committed = true
            } catch {
                self.lastError = "\(error)"
                throw error
            }
        }
    }

    // MARK: - View

    @StateObject private var model: Model
    private let onAdvance: () -> Void

    public init(plate: Plate, writer: CheckinWriter, onAdvance: @escaping () -> Void) {
        _model = StateObject(wrappedValue: Model(plate: plate, writer: writer))
        self.onAdvance = onAdvance
    }

    public var body: some View {
        ZStack {
            GTIGradient.surface(.checkin)
                .ignoresSafeArea()
                .accessibilityIdentifier("checkin.gradient")

            VStack(alignment: .leading, spacing: 0) {
                topBar
                    .padding(.horizontal, GTISpacing.step5)
                    .padding(.top, GTISpacing.step6)

                miniatureRecall
                    .padding(.top, GTISpacing.step8)

                questionBlock
                    .padding(.top, GTISpacing.step8)

                Spacer(minLength: GTISpacing.step6)

                content
                    .padding(.horizontal, GTISpacing.step5)

                Spacer(minLength: 0)

                ctaDock
                    .padding(.horizontal, GTISpacing.step5)
                    .padding(.bottom, GTISpacing.step12)
            }
        }
    }

    // MARK: - sub-views

    private var topBar: some View {
        HStack {
            Circle()
                .fill(GTIColor.paper)
                .frame(width: 16, height: 16)
                .accessibilityHidden(true)
            Spacer()
            Text("YESTERDAY'S VERDICT")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .heavy))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .accessibilityIdentifier("checkin.eyebrow")
        }
    }

    private var miniatureRecall: some View {
        VStack(spacing: GTISpacing.step2) {
            Text(model.plate.verdictAt.uppercased())
                .font(.system(size: GTIFont.Size.eyebrow, weight: .heavy))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
            Text(model.plate.placeName)
                .font(.system(size: GTIFont.Size.displayM, weight: .black))
                .tracking(GTIFont.TrackingEm.displayM * GTIFont.Size.displayM)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .multilineTextAlignment(.center)
            Text(model.plate.metaLine.uppercased())
                .font(.system(size: GTIFont.Size.eyebrow, weight: .heavy))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("checkin.recall")
    }

    private var questionBlock: some View {
        Text(CheckinScreen.questionCopy)
            .font(.system(size: GTIFont.Size.displayS, weight: .black))
            .tracking(GTIFont.TrackingEm.displayS * GTIFont.Size.displayS)
            .foregroundStyle(GTIColor.TextOnGradient.primary)
            .frame(maxWidth: .infinity)
            .accessibilityIdentifier("checkin.question")
    }

    @ViewBuilder
    private var content: some View {
        if model.committed, let outcome = model.selectedOutcome {
            confirmationPlate(for: outcome)
                .transition(.opacity)
        } else if model.selectedOutcome == .skipped {
            reasonChipRow
                .transition(.opacity)
        } else {
            optionList
        }
    }

    private var optionList: some View {
        VStack(spacing: GTISpacing.step3) {
            ForEach(CheckinScreen.optionRows, id: \.outcome) { row in
                optionButton(row)
            }
        }
        .accessibilityIdentifier("checkin.options")
    }

    private func optionButton(_ row: OptionRow) -> some View {
        Button(action: { handleTap(row.outcome) }) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(row.label)
                        .font(.system(size: GTIFont.Size.body, weight: .black))
                        .foregroundStyle(textColor(for: row.fill))
                    Text(row.sub)
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .semibold))
                        .foregroundStyle(textColor(for: row.fill).opacity(0.7))
                }
                Spacer()
                Text("→")
                    .font(.system(size: 18, weight: .black))
                    .foregroundStyle(textColor(for: row.fill).opacity(0.7))
            }
            .padding(.horizontal, GTISpacing.step5)
            .padding(.vertical, GTISpacing.step4)
            .frame(maxWidth: .infinity)
            .background(backgroundFill(for: row.fill), in: RoundedRectangle(cornerRadius: GTIRadii.card))
            .overlay(
                RoundedRectangle(cornerRadius: GTIRadii.card)
                    .strokeBorder(row.fill == .ghost ? Color.white.opacity(0.5) : .clear, lineWidth: 1.5)
            )
        }
        .accessibilityIdentifier("checkin.option.\(row.outcome.rawValue)")
        .accessibilityLabel("\(row.label). \(row.sub).")
    }

    private func textColor(for fill: OptionRow.Fill) -> Color {
        fill == .ghost ? GTIColor.TextOnGradient.primary : GTIColor.ink
    }

    private func backgroundFill(for fill: OptionRow.Fill) -> Color {
        switch fill {
        case .sun:   return GTIColor.sun
        case .white: return GTIColor.paper
        case .ghost: return .clear
        }
    }

    private var reasonChipRow: some View {
        VStack(spacing: GTISpacing.step3) {
            Text("WHAT GOT IN THE WAY?")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .heavy))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
            VStack(spacing: GTISpacing.step2) {
                ForEach(SkipReason.allCases, id: \.rawValue) { reason in
                    chipButton(reason)
                }
            }
        }
        .accessibilityIdentifier("checkin.reasons")
    }

    private func chipButton(_ reason: SkipReason) -> some View {
        let isSelected = model.selectedReason == reason
        return Button(action: { model.selectedReason = reason }) {
            Text(reason.label)
                .font(.system(size: GTIFont.Size.sm, weight: .heavy))
                .foregroundStyle(isSelected ? GTIColor.ink : GTIColor.TextOnGradient.primary)
                .padding(.horizontal, GTISpacing.step4)
                .padding(.vertical, GTISpacing.step3)
                .frame(maxWidth: .infinity)
                .background(
                    isSelected ? GTIColor.paper : Color.white.opacity(0.12),
                    in: RoundedRectangle(cornerRadius: GTIRadii.chip)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: GTIRadii.chip)
                        .strokeBorder(
                            isSelected ? Color.clear : Color.white.opacity(0.32),
                            lineWidth: 1
                        )
                )
        }
        .accessibilityIdentifier("checkin.reason.\(reason.machineToken)")
    }

    private func confirmationPlate(for outcome: Outcome) -> some View {
        VStack(spacing: GTISpacing.step4) {
            Text(CheckinScreen.confirmationHeadline(for: outcome))
                .font(.system(size: GTIFont.Size.displayS, weight: .black))
                .tracking(GTIFont.TrackingEm.displayS * GTIFont.Size.displayS)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .multilineTextAlignment(.center)
            Text(CheckinScreen.confirmationBody(for: outcome, placeName: model.plate.placeName))
                .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
                .lineSpacing(GTIFont.Size.sm * (GTIFont.LineHeight.sm - 1))
        }
        .accessibilityIdentifier("checkin.confirmation")
    }

    @ViewBuilder
    private var ctaDock: some View {
        if model.committed {
            Button(action: onAdvance) {
                Text("DONE")
                    .font(.system(size: GTIFont.Size.cta, weight: .black))
                    .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                    .foregroundStyle(GTIColor.ink)
                    .frame(maxWidth: .infinity, minHeight: 60)
                    .background(GTIColor.paper, in: RoundedRectangle(cornerRadius: GTIRadii.pill))
            }
            .accessibilityIdentifier("checkin.done")
        } else if model.selectedOutcome == .skipped {
            // Skipped path needs a Done after a reason is chosen.
            Button(action: { Task { await commitSkippedReason() } }) {
                Text("DONE")
                    .font(.system(size: GTIFont.Size.cta, weight: .black))
                    .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                    .foregroundStyle(GTIColor.ink)
                    .frame(maxWidth: .infinity, minHeight: 60)
                    .background(
                        (model.selectedReason == nil ? GTIColor.paper.opacity(0.5) : GTIColor.paper),
                        in: RoundedRectangle(cornerRadius: GTIRadii.pill)
                    )
            }
            .disabled(model.selectedReason == nil || model.pending)
            .accessibilityIdentifier("checkin.skip.done")
        } else {
            Text(CheckinScreen.footerEyebrow)
                .font(.system(size: 10, weight: .heavy))
                .tracking(GTIFont.TrackingEm.eyebrow * 10)
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .frame(maxWidth: .infinity)
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("checkin.footer")
        }
    }

    // MARK: - actions

    private func handleTap(_ outcome: Outcome) {
        withAnimation(animation()) {
            model.selectedOutcome = outcome
        }
        // Skipped routes through the reason picker first.
        guard outcome != .skipped else { return }
        Task { await commit(outcome: outcome, reason: nil) }
    }

    private func commitSkippedReason() async {
        guard let reason = model.selectedReason else { return }
        await commit(outcome: .skipped, reason: reason)
    }

    private func commit(outcome: Outcome, reason: SkipReason?) async {
        do {
            try await model.record(outcome: outcome, reason: reason)
            withAnimation(animation()) {
                // Confirmation plate fade-up.
            }
        } catch {
            // Surface error inline — the model.lastError is set; the
            // surface stays on the option list / chip row so the user
            // can retry on next tap.
        }
    }

    private func animation() -> Animation {
        let e = GTIMotion.Easing.outSoft
        return .timingCurve(e.0, e.1, e.2, e.3, duration: Choreo.fadeUpDuration)
    }
}

// MARK: - SupabaseCheckinWriter

/// Production adapter — POSTs into the `check_ins` table via
/// PostgREST. The PK on `(room_id, user_id)` swallows duplicate
/// commits as no-ops so a double-tap can't corrupt the metric.
public final class SupabaseCheckinWriter: CheckinWriter, @unchecked Sendable {
    private let client: SupabaseClient
    private let roomID: UUID
    private let userID: UUID

    public init(client: SupabaseClient, roomID: UUID, userID: UUID) {
        self.client = client
        self.roomID = roomID
        self.userID = userID
    }

    public func record(
        outcome: CheckinScreen.Outcome,
        reason: CheckinScreen.SkipReason?
    ) async throws {
        struct Row: Encodable {
            let room_id: String
            let user_id: String
            let outcome: String
            let reason: String?
        }
        let row = Row(
            room_id: roomID.uuidString.lowercased(),
            user_id: userID.uuidString.lowercased(),
            outcome: outcome.rawValue,
            reason: reason?.machineToken
        )
        do {
            try await client
                .from("check_ins")
                .insert(row)
                .execute()
        } catch {
            // 23505 unique_violation = already answered; swallow.
            let message = "\(error)".lowercased()
            if !(message.contains("23505") || message.contains("unique")) {
                throw error
            }
        }
    }
}
