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
// headline + body paragraph + white PillCTA + mono-tag "Done" footer.
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
            "Delete your data?",
            isPresented: $showingConfirm
        ) {
            Button("Cancel", role: .cancel) {}
            Button("Delete forever", role: .destructive) {
                runDelete()
            }
            .accessibilityIdentifier("settings.alert.delete")
        } message: {
            Text("This can't be undone.")
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

            Button {
                showingConfirm = true
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                        .fill(GTIColor.paper)
                        .frame(height: 60)
                    Group {
                        if phase == .deleting {
                            ProgressView()
                                .tint(GTIColor.ink)
                        } else {
                            Text("DELETE MY DATA")
                                .font(.system(size: GTIFont.Size.cta, weight: .black))
                                .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                                .foregroundStyle(GTIColor.ink)
                        }
                    }
                }
            }
            .accessibilityIdentifier("settings.cta.delete")
            .accessibilityLabel("Delete my data")
            .disabled(phase == .deleting)

            Button(action: onDone) {
                Text("DONE")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("settings.done")
            .accessibilityLabel("Done. Return to start.")
            .disabled(phase == .deleting)
        }
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
