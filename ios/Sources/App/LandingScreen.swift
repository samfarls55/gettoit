// GetToIt — S00 · Landing.
//
// Post-sign-in entry surface. v1.1 introduces a neutral router above
// the existing S01 Initiator: every cold launch with an active auth
// session lands here first, and the user picks between "Start a
// Decision" (routes to S01 / Pick a Vertical) and "Account Settings"
// (routes to S09 / delete-your-data).
//
// Surface spec: `design-system/surfaces/00-landing.md`.
// JSX reference: `design-system/code/screens/ScreenLanding.jsx`.
//
// Visual: initiator gradient (reuses the registered `initiator` stop —
// no new tokens), GTI mark stand-in top-left, eyebrow "WELCOME BACK"
// + 36pt display headline "WHAT'S NEXT?", white PillCTA primary +
// ghost PillCTA secondary. Visual / brand polish is deferred to the
// pre-public-launch milestone per the surface doc §"v1.1 scope" —
// this is the structural surface.
//
// Behavior: idle until tap. No state, no fields, no controls. Both
// callbacks are owned by the host (RootView) so the back-routing
// (Done on S09 returns here; existing S01 flow downstream) stays in
// one place.
//
// All color, type, spacing, motion comes from `GTITokens.swift` — per
// repo CLAUDE.md, never inline hex/px/easing.

import SwiftUI

@MainActor
public struct LandingScreen: View {
    private let onStartDecision: () -> Void
    private let onAccountSettings: () -> Void

    public init(
        onStartDecision: @escaping () -> Void,
        onAccountSettings: @escaping () -> Void
    ) {
        self.onStartDecision = onStartDecision
        self.onAccountSettings = onAccountSettings
    }

    public var body: some View {
        ZStack {
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                gtiMark

                headline
                    .padding(.top, GTISpacing.step12 + GTISpacing.step2) // 56pt — matches JSX `marginTop: 56`

                Spacer(minLength: GTISpacing.step6)

                ctaDock
            }
            .padding(.horizontal, GTISpacing.step6)
            .padding(.top, GTISpacing.step16)
            .padding(.bottom, GTISpacing.step6)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - sub-views

    /// GTI mark stand-in. Mirrors the small wordmark tile used on
    /// WaitingScreen — 22pt tile with a single-letter glyph. The
    /// real wordmark lands in the pre-public-launch polish ticket
    /// (see surfaces/00-landing.md §"v1.1 scope").
    private var gtiMark: some View {
        ZStack {
            RoundedRectangle(cornerRadius: GTISpacing.step1, style: .continuous)
                .fill(GTIColor.paper.opacity(0.18))
                .frame(width: 22, height: 22)
            Text("g")
                .font(.system(size: 14, weight: .black))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
        }
        .accessibilityHidden(true)
    }

    private var headline: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("WELCOME BACK")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.secondary)
                .padding(.bottom, GTISpacing.step3 + 2) // 14pt — matches JSX `marginBottom: 14`
                .accessibilityIdentifier("landing.eyebrow")

            // 36pt display headline — intentionally smaller than S01's
            // 44pt hero, per surface doc §"Copy register". Two-line
            // break renders `WHAT'S` over `NEXT?`. Display weight 900
            // (Inter `.black`) matches the `display-m` token family.
            Text("What's\nnext?")
                .font(.system(size: 36, weight: .black))
                .tracking(GTIFont.TrackingEm.displayM * 36)
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .textCase(.uppercase)
                .lineSpacing(0)
                .multilineTextAlignment(.leading)
                .accessibilityIdentifier("landing.headline")
        }
    }

    /// Two PillCTAs stacked with step3 vertical gap. Primary is the
    /// `white` variant (C-05 canonical); secondary is the `ghost`
    /// variant documented in components.md §C-05. Same primitive as
    /// the InitiatorScreen / SettingsScreen primary pill — height 60,
    /// radius 999, `cta` token rendered uppercase.
    private var ctaDock: some View {
        VStack(spacing: GTISpacing.step3) {
            Button(action: onStartDecision) {
                ZStack {
                    RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                        .fill(GTIColor.paper)
                        .frame(height: 60)
                    Text("START A DECISION")
                        .font(.system(size: GTIFont.Size.cta, weight: .black))
                        .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                        .foregroundStyle(GTIColor.ink)
                }
            }
            .accessibilityIdentifier("landing.cta.start")
            .accessibilityLabel("Start a decision")

            Button(action: onAccountSettings) {
                ZStack {
                    RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                        .fill(Color.clear)
                        .frame(height: 60)
                        .overlay(
                            RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                                .strokeBorder(Color.white.opacity(0.5), lineWidth: 1.5)
                        )
                    Text("ACCOUNT SETTINGS")
                        .font(.system(size: GTIFont.Size.cta, weight: .black))
                        .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                }
            }
            .accessibilityIdentifier("landing.cta.settings")
            .accessibilityLabel("Account settings")
        }
    }
}
