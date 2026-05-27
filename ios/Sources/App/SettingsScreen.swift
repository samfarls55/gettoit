// GetToIt — S09 · Settings.
//
// TB-16 — minimal account-management surface. The original release ships exactly one
// action: delete-my-data. Required by App Store guideline 5.1.1(v) +
// per ADR 0006. Surface spec lives at
// `design-system/surfaces/09-settings.md`; the JSX reference is
// `design-system/code/screens/ScreenSettings.jsx`.
//
// Visual: midnight gradient (reuses the registered `midnight` stop —
// no new tokens), top-leading `xmark` close glyph (wfr-29), eyebrow +
// smaller display headline + body paragraph + CTA dock.
//
// Surface escape (wfr-29, 2026-05-26): a top-leading `xmark` SF Symbol
// icon-button replaces the prior bottom-center DONE PillCTA. Matches
// the iOS sheet-dismissal convention (P-07 Habituation); the close
// glyph owns the dismiss verb so the bottom dock holds only the
// destructive action.
//
// CTA dock (wfr-07, 2026-05-26 → amended by wfr-29): DELETE MY DATA
// renders alone in the C-05 ghost destructive treatment (transparent
// fill, 1.5pt white-0.5 stroke, white text). The no-red contract from
// `tokens.md §1.3` governs — destructive weight lives in the outline +
// copy + the native two-step confirm alert, never in a colored fill.
//
// Behavior: tap "Delete my data" → native iOS confirm alert → on
// confirm: `AuthCoordinator.deleteAndReboot()` (calls the delete-user
// Edge function, bootstraps a fresh anonymous session) → host
// navigates back to S00. On failure: present a non-blocking error
// message on the surface; user can retry or tap the close glyph.
//
// All color, type, spacing, motion comes from `GTITokens.swift` — per
// repo CLAUDE.md, never inline hex/px/easing.

import SwiftUI

@MainActor
public struct SettingsScreen: View {
    @State private var phase: Phase = .ready
    @State private var showingConfirm = false

    private let auth: AuthCoordinator
    private let onDone: () -> Void
    /// Optional sink fired when the delete + re-bootstrap succeeds.
    /// The host (RootView) uses this to clear the Settings route so
    /// the next render lands back on S01 with the fresh anonymous
    /// identity. The state inside AuthCoordinator updates either way.
    private let onDeleted: (() -> Void)?

    public init(
        auth: AuthCoordinator,
        onDone: @escaping () -> Void,
        onDeleted: (() -> Void)? = nil
    ) {
        self.auth = auth
        self.onDone = onDone
        self.onDeleted = onDeleted
    }

    public enum Phase: Equatable {
        case ready
        case deleting
        case error(String)
    }

    /// Locked visual hierarchy contract for S09 (wfr-07, wfr-29).
    /// Encoded on the type so SettingsScreenTests can pin the surface
    /// register without walking the view tree. A regression that
    /// re-promotes DELETE to the white-pill register, drops the
    /// top-leading close glyph, or re-introduces a bottom DONE pill
    /// cannot ship without flipping these flags — at which point the
    /// tests fail and reviewers can challenge the change against
    /// `surfaces/09-settings.md`.
    public enum Style {
        /// C-05 PillCTA variants used on S09.
        public enum PillFill: Equatable { case white, ghost }

        /// wfr-29 — the close-affordance anchor on the surface. Encoded
        /// as a plain enum (not SwiftUI's `Alignment`) so the contract
        /// is testable without view-tree introspection.
        public enum CloseAnchor: Equatable { case topLeading, topTrailing }

        // MARK: wfr-29 — top-leading close affordance

        /// SF Symbol used for the top-leading close glyph. `xmark` is
        /// the iOS sheet-dismissal convention (P-07 Habituation).
        public static let closeSymbolName: String = "xmark"

        /// Anchor for the close affordance. Top-leading matches the
        /// iOS sheet-dismissal convention; a regression that flips it
        /// to top-trailing (Quiz `Exit` slot) must trip this contract.
        public static let closeAlignment: CloseAnchor = .topLeading

        /// Apple HIG minimum tap-target — 44pt. Matches the
        /// QuizChrome / VerdictReadOnly chrome convention.
        public static let closeMinTapTarget: CGFloat = 44

        /// wfr-29 retired the bottom-center DONE PillCTA. The
        /// top-leading close glyph owns the dismiss verb.
        public static let rendersBottomDonePill: Bool = false

        // MARK: wfr-07 — DELETE ghost destructive treatment

        /// DELETE MY DATA renders in the C-05 ghost destructive
        /// treatment — transparent fill, 1.5pt white-0.5 stroke, white
        /// text. Demoted from the white-pill register per wfr-07.
        public static let deletePillFill: PillFill = .ghost

        /// C-05 ghost variant stroke width — matches the registered
        /// PlanDisambigSheet ghost-pill register so all ghost pills in
        /// the system share one outline weight.
        public static let ghostStrokeWidth: CGFloat = 1.5

        /// C-05 ghost variant stroke opacity — white 0.5 on gradient.
        public static let ghostStrokeOpacity: Double = 0.5

        /// `tokens.md §1.3` no-red contract — destructive treatment on
        /// S09 is outline + copy, never a colored fill. Sun is the
        /// only state color in Sunset Pop.
        public static let usesRedDestructiveColor: Bool = false

        // MARK: copy register

        /// Two-step confirm alert copy preserved from the original
        /// surface spec — wfr-07 / wfr-29 change the visual register
        /// of the surface only, never the consent flow.
        public static let confirmAlertTitle: String = "Delete your data?"
        public static let confirmAlertMessage: String = "This can't be undone."
        public static let confirmAlertDestructiveLabel: String = "Delete forever"
        public static let confirmAlertCancelLabel: String = "Cancel"
    }

    public var body: some View {
        ZStack(alignment: .topLeading) {
            GTIGradient.surface(.midnight)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                Text("YOUR ACCOUNT")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .padding(.bottom, GTISpacing.step4)
                    .accessibilityIdentifier("settings.eyebrow")

                Text("Just one\nthing here\nfor now.")
                    .font(.system(size: GTIFont.Size.displayS, weight: .black))
                    .tracking(GTIFont.TrackingEm.displayS * GTIFont.Size.displayS)
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .textCase(.uppercase)
                    .lineSpacing(0)
                    .multilineTextAlignment(.leading)
                    .accessibilityIdentifier("settings.headline")

                Text(
                    "Deletes everything: your sessions, your votes, " +
                    "your taste profile. Rooms you joined keep going — " +
                    "your spot in them clears. Can't be undone."
                )
                    .font(.system(size: GTIFont.Size.body, weight: .semibold))
                    .lineSpacing(GTIFont.Size.body * 0.45)
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .frame(maxWidth: 320, alignment: .leading)
                    .padding(.top, GTISpacing.step6)
                    .accessibilityIdentifier("settings.body")

                Spacer(minLength: GTISpacing.step6)

                cta
            }
            .padding(.horizontal, GTISpacing.step6)
            .padding(.top, GTISpacing.step16)
            .padding(.bottom, GTISpacing.step6)
            .frame(maxWidth: .infinity, alignment: .leading)

            // wfr-29 — top-leading `xmark` close glyph owns the
            // surface dismiss. Replaces the prior bottom-center DONE
            // PillCTA so the iOS sheet-dismissal habit (P-07
            // Habituation) governs the escape verb on S09.
            closeButton
        }
        .alert(
            Style.confirmAlertTitle,
            isPresented: $showingConfirm
        ) {
            Button(Style.confirmAlertCancelLabel, role: .cancel) {}
            Button(Style.confirmAlertDestructiveLabel, role: .destructive) {
                runDelete()
            }
            .accessibilityIdentifier("settings.alert.delete")
        } message: {
            Text(Style.confirmAlertMessage)
        }
    }

    // MARK: - sub-views

    @ViewBuilder
    private var cta: some View {
        VStack(spacing: GTISpacing.step3) {
            if case .error(let message) = phase {
                Text(message)
                    .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("settings.error")
            }

            // DELETE MY DATA — C-05 ghost destructive treatment. The
            // outline + copy + native two-step confirm alert carry the
            // destructive weight per `tokens.md §1.3` (no red).
            // wfr-29: this is now the sole dock occupant; the dismiss
            // verb moved to the top-leading `xmark` close glyph.
            deletePill
        }
    }

    /// wfr-29 — top-leading `xmark` close glyph. Matches the iOS
    /// sheet-dismissal convention (P-07 Habituation). 44pt tap target;
    /// eyebrow-token white opacity so the glyph carries the same
    /// visual weight as the QuizChrome / VerdictReadOnly chrome
    /// affordances. Tap fires `onDone` — the same callback the retired
    /// bottom-center DONE pill used.
    @ViewBuilder
    private var closeButton: some View {
        Button(action: onDone) {
            Image(systemName: Style.closeSymbolName)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.86))
                .frame(
                    minWidth: Style.closeMinTapTarget,
                    minHeight: Style.closeMinTapTarget
                )
                .contentShape(Rectangle())
        }
        .padding(.leading, GTISpacing.step3)
        .padding(.top, GTISpacing.step6)
        .accessibilityIdentifier("settings.close")
        .accessibilityLabel("Close. Return to plans.")
        .disabled(phase == .deleting)
    }

    /// C-05 ghost PillCTA — transparent fill, 1.5pt white-0.5 stroke,
    /// 60pt tall, radius 999. The destructive treatment on S09 after
    /// wfr-07; mirrors the ghost-pill register PlanDisambigSheet uses
    /// for its Solo / Group affordances. The destructive weight rides
    /// the outline + copy + native confirm alert, not a colored fill.
    @ViewBuilder
    private var deletePill: some View {
        Button {
            showingConfirm = true
        } label: {
            ZStack {
                RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                    .fill(Color.clear)
                RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                    .strokeBorder(
                        Color.white.opacity(Style.ghostStrokeOpacity),
                        lineWidth: Style.ghostStrokeWidth
                    )
                Group {
                    if phase == .deleting {
                        ProgressView()
                            .tint(GTIColor.TextOnGradient.primary)
                    } else {
                        Text("DELETE MY DATA")
                            .font(.system(size: GTIFont.Size.cta, weight: .black))
                            .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                            .foregroundStyle(GTIColor.TextOnGradient.primary)
                    }
                }
            }
            .frame(height: 60)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("settings.cta.delete")
        .accessibilityLabel("Delete my data")
        .disabled(phase == .deleting)
    }

    // MARK: - actions

    private func runDelete() {
        phase = .deleting
        Task {
            do {
                _ = try await auth.deleteAndReboot()
                phase = .ready
                onDeleted?()
                onDone()
            } catch AuthCoordinator.DeleteError.notSignedIn {
                phase = .error("You're not signed in.")
            } catch {
                phase = .error("Couldn't delete right now. \(String(describing: error))")
            }
        }
    }
}
