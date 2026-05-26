// GetToIt — S09 · Settings.
//
// TB-16 — minimal account-management surface. The original release ships exactly one
// action: delete-my-data. Required by App Store guideline 5.1.1(v) +
// per ADR 0006. Surface spec lives at
// `design-system/surfaces/09-settings.md`; the JSX reference is
// `design-system/code/screens/ScreenSettings.jsx`.
//
// Visual: midnight gradient (reuses the registered `midnight` stop —
// no new tokens), GTI mark top-left, eyebrow + smaller display
// headline + body paragraph + CTA dock.
//
// CTA dock (wfr-07, 2026-05-26): DONE is the visually dominant white
// PillCTA (C-05 white variant); DELETE MY DATA renders below it in the
// C-05 ghost destructive treatment (transparent fill, 1.5pt white-0.5
// stroke, white text). The no-red contract from `tokens.md §1.3`
// governs — destructive weight lives in the outline + copy + the
// native two-step confirm alert, never in a colored fill.
//
// Behavior: tap "Delete my data" → native iOS confirm alert → on
// confirm: `AuthCoordinator.deleteAndReboot()` (calls the delete-user
// Edge function, bootstraps a fresh anonymous session) → host
// navigates back to S01. On failure: present a non-blocking error
// message on the surface; user can retry or tap Done.
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

    /// Locked visual hierarchy contract for S09 (wfr-07). Encoded on
    /// the type so SettingsScreenTests can pin the post-wfr-07 register
    /// without walking the view tree. A regression that re-promotes
    /// DELETE to the white-pill register cannot ship without flipping
    /// these flags — at which point the tests fail and reviewers can
    /// challenge the change against `surfaces/09-settings.md`.
    public enum Style {
        /// C-05 PillCTA variants used on S09 after wfr-07.
        public enum PillFill: Equatable { case white, ghost }

        /// DONE renders as the C-05 white PillCTA — the visually
        /// dominant primary that returns the user to S01.
        public static let donePillFill: PillFill = .white

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

        /// CTA dock render order — lower = closer to the top of the
        /// dock. DONE (primary) renders above DELETE (secondary) so
        /// the dominant action sits closest to the thumb dock.
        public static let donePrimaryOrder: Int = 0
        public static let deleteSecondaryOrder: Int = 1

        /// Two-step confirm alert copy preserved from the original
        /// surface spec — wfr-07 changes the visual register of the
        /// trigger only, never the consent flow.
        public static let confirmAlertTitle: String = "Delete your data?"
        public static let confirmAlertMessage: String = "This can't be undone."
        public static let confirmAlertDestructiveLabel: String = "Delete forever"
        public static let confirmAlertCancelLabel: String = "Cancel"
    }

    public var body: some View {
        ZStack {
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

            // DONE — C-05 white PillCTA, the visually dominant primary.
            // wfr-07 promoted this from the mono-tag footer link to the
            // canonical white pill so the user's exit verb is the most
            // prominent action on the surface.
            donePill

            // DELETE MY DATA — C-05 ghost destructive treatment. The
            // outline + copy + native two-step confirm alert carry the
            // destructive weight per `tokens.md §1.3` (no red).
            deletePill
        }
    }

    /// C-05 white PillCTA — `var(--paper)` fill, ink text, 60pt tall,
    /// radius 999. The visually dominant primary on S09 after wfr-07.
    @ViewBuilder
    private var donePill: some View {
        Button(action: onDone) {
            ZStack {
                RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                    .fill(GTIColor.paper)
                    .frame(height: 60)
                Text("DONE")
                    .font(.system(size: GTIFont.Size.cta, weight: .black))
                    .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                    .foregroundStyle(GTIColor.ink)
            }
        }
        .accessibilityIdentifier("settings.done")
        .accessibilityLabel("Done. Return to start.")
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
