// GetToIt — Auth Upgrade Chip (C-22, TB-12).
//
// SwiftUI port of the design-system component spec'd in
// `design-system/components.md` §C-22 and `code/components.jsx`
// (`AuthUpgradeChip`). The chip is the non-blocking
// Sign-in-with-Apple affordance on S04 Waiting. iOS-only — the web
// fallback never renders it per ADR 0007.
//
// Tokens consumed: `GTIColor.paper`, `GTIColor.ink`,
// `GTIColor.TextOnGradient.tertiary`, `GTIFont`, `GTISpacing`,
// `GTIRadii`, `GTIMotion`. No inline hex / px / easing.
//
// Copy register (LOCKED per ADR 0007 + PRD §"User Stories" 29 + 72):
//   * Primary: "Save this taste profile"
//   * Dismiss: "Maybe later"
//   * Success: "Saved."
//
// States — exactly the five from the JSX spec:
//   .defaultIdle / .inProgress / .success / .dismissed / .hidden

import SwiftUI

public struct AuthUpgradeChip: View {
    public enum State: Equatable, Sendable {
        case defaultIdle
        case inProgress
        case success
        case dismissed
        case hidden
    }

    private let state: State
    private let onSave: () -> Void
    private let onDismiss: () -> Void

    public init(
        state: State,
        onSave: @escaping () -> Void = {},
        onDismiss: @escaping () -> Void = {}
    ) {
        self.state = state
        self.onSave = onSave
        self.onDismiss = onDismiss
    }

    public var body: some View {
        switch state {
        case .hidden, .dismissed:
            EmptyView()
        case .success:
            successLabel
        case .defaultIdle, .inProgress:
            chip
        }
    }

    // MARK: - subviews

    /// The quiet `"Saved."` confirmation — mono-tag, tertiary
    /// on-gradient text, no celebration motion. Auto-dismisses on
    /// the next surface transition (caller's responsibility).
    private var successLabel: some View {
        Text("Saved.")
            .font(.system(size: GTIFont.Size.monoTag, weight: .medium, design: .monospaced))
            .tracking(GTIFont.TrackingEm.monoTag * GTIFont.Size.monoTag)
            .textCase(.uppercase)
            .foregroundStyle(GTIColor.TextOnGradient.tertiary)
            .frame(maxWidth: .infinity)
            .multilineTextAlignment(.center)
            .accessibilityIdentifier("authChip.saved")
            .accessibilityLabel(Text("Saved"))
            .accessibilityAddTraits(.isStaticText)
    }

    /// The full pill chip — `default` or `in-progress`.
    private var chip: some View {
        let inProgress = (state == .inProgress)

        return VStack(spacing: GTISpacing.step3) {
            Button(action: onSave) {
                HStack(spacing: GTISpacing.step2 + GTISpacing.step1 / 2) {
                    Image(systemName: "applelogo")
                        .font(.system(size: 18, weight: .heavy))
                        .foregroundStyle(GTIColor.TextOnSurface.primary)
                        .accessibilityHidden(true)
                    Text("Save this taste profile")
                        .font(.system(size: GTIFont.Size.cta, weight: .heavy))
                        .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                        .textCase(.uppercase)
                        .foregroundStyle(GTIColor.TextOnSurface.primary)
                }
                .frame(maxWidth: .infinity, minHeight: 60)
                .background(GTIColor.paper)
                .clipShape(RoundedRectangle(cornerRadius: GTIRadii.pill))
                .shadow(color: Color.black.opacity(0.18), radius: 32 / 2, x: 0, y: 12)
                .opacity(inProgress ? 0.45 : 1.0)
            }
            .buttonStyle(.plain)
            .disabled(inProgress)
            .accessibilityIdentifier("authChip.save")
            .accessibilityLabel(Text("Save this taste profile"))
            .accessibilityHint(Text("Links your Apple identity to this device's taste profile"))

            // Dismiss link is suppressed while the Apple sheet is up.
            if !inProgress {
                Button(action: onDismiss) {
                    Text("Maybe later")
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                        .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                        .textCase(.uppercase)
                        .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                        // 44pt min hit row clearing HIG; visible label is small.
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("authChip.dismiss")
                .accessibilityLabel(Text("Maybe later"))
                .accessibilityHint(Text("Dismisses for 30 days"))
            }
        }
    }
}
