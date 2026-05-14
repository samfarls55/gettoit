// GetToIt — Walking-skeleton root view.
//
// Single screen for TB-01. Boots the AuthCoordinator, kicks off
// anonymous sign-in, and renders the resulting `user_id`. Uses the
// generated `GTITokens.swift` for color / type — no hand-coded hex.

import SwiftUI
import Supabase

public struct RootView: View {
    @State private var auth: AuthCoordinator?
    @State private var configMissing = false

    public init() {}

    public var body: some View {
        ZStack {
            // Sunset Pop initiator gradient as the canvas, per design-system.
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            VStack(spacing: GTISpacing.step4) {
                Text("GETTOIT")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)

                Text("walking skeleton")
                    .font(.system(size: GTIFont.Size.title, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)

                content
                    .padding(.top, GTISpacing.step6)
            }
            .padding(GTISpacing.step6)
        }
        .task {
            await bootstrap()
        }
    }

    @ViewBuilder
    private var content: some View {
        if configMissing {
            Text("Supabase is not configured for this build.")
                .font(.system(size: GTIFont.Size.body, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .multilineTextAlignment(.center)
        } else if let auth {
            switch auth.state {
            case .idle, .signingIn:
                ProgressView()
                    .tint(GTIColor.TextOnGradient.primary)
            case .anonymous(let userID):
                VStack(spacing: GTISpacing.step2) {
                    Text("User ID")
                        .font(.system(size: GTIFont.Size.sm, weight: .semibold))
                        .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    Text(userID.uuidString)
                        .font(.system(size: GTIFont.Size.body, design: .monospaced))
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                        .multilineTextAlignment(.center)
                        .accessibilityIdentifier("anon.user.id")
                }
            case .error(let message):
                Text("Sign-in failed: \(message)")
                    .font(.system(size: GTIFont.Size.body))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private func bootstrap() async {
        guard let config = SupabaseConfig.fromBundle() else {
            self.configMissing = true
            return
        }
        let client = SupabaseClient(supabaseURL: config.url, supabaseKey: config.anonKey)
        let coordinator = AuthCoordinator(client: client)
        self.auth = coordinator
        await coordinator.ensureSignedIn()
    }
}
