// GetToIt — Join screen (TB-02 baseline, TB-11 late-joiner routing).
//
// Lands here when the app handles a Universal Link of the form
// `https://gettoit.app/join/{roomId}?inviteToken={token}`. The screen
// ensures the device is signed in anonymously (if not already), then
// hands the room id to `LateJoinerStore.resolveRoute` — the
// server-side router decides whether to insert the `members` row
// (open / firing path) or to surface the read-only branch
// (verdict_ready / locked / expired). The late-joiner is NEVER
// added to `members` of a closed room (TB-11 AC).
//
// Subsequent tracer bullets (TB-04, TB-07) wired the quiz / waiting
// flow into the `onJoined` callback. TB-11 adds the read-only
// callback `onLateJoiner(payload:)` so RootView can mount the S05
// surface in `.readOnly` mode with the verdict + cuts + receipts
// payload pre-fetched.
//
// All visual values come from `GTITokens.swift`.

import SwiftUI

@MainActor
public struct JoinScreen: View {
    public enum Phase: Equatable {
        case joining
        case joined(roomID: UUID)
        case error(String)
    }

    @State public var phase: Phase

    private let payload: InviteLink.Payload
    private let auth: AuthCoordinator
    private let roomStore: RoomStore
    private let lateJoinerStore: LateJoinerStore?
    private let onJoined: ((UUID, UUID) -> Void)?
    /// TB-11 — fires when the late-joiner taps an invite link AFTER
    /// the verdict has been sealed. The closure receives the prior
    /// room's S01 defaults so the re-invite CTA on the read-only S05
    /// surface can pre-populate them.
    private let onLateJoiner: ((LateJoinerStore.Route) -> Void)?
    /// wfr-14 — fires when the user abandons the join flow, either
    /// via the Cancel chrome during `.joining` or the "Try another
    /// link" tertiary on `.error`. RootView clears `deepLink` in the
    /// wired handler so the user returns to the S00 Plan list. Same
    /// closure for both paths per the Escape Hatch pattern: one
    /// surface, one escape destination.
    private let onCancel: () -> Void

    public init(
        payload: InviteLink.Payload,
        auth: AuthCoordinator,
        roomStore: RoomStore,
        lateJoinerStore: LateJoinerStore? = nil,
        phase: Phase = .joining,
        onJoined: ((UUID, UUID) -> Void)? = nil,
        onLateJoiner: ((LateJoinerStore.Route) -> Void)? = nil,
        onCancel: @escaping () -> Void = {}
    ) {
        self.payload = payload
        self.auth = auth
        self.roomStore = roomStore
        self.lateJoinerStore = lateJoinerStore
        self._phase = State(initialValue: phase)
        self.onJoined = onJoined
        self.onLateJoiner = onLateJoiner
        self.onCancel = onCancel
    }

    public var body: some View {
        ZStack {
            GTIGradient.surface(.waiting)
                .ignoresSafeArea()

            VStack(spacing: GTISpacing.step4) {
                Text("YOU'RE IN")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)

                content
                    .padding(.top, GTISpacing.step2)

                escapeAffordance
                    .padding(.top, GTISpacing.step2)
            }
            .padding(GTISpacing.step6)
        }
        .task {
            await joinIfNeeded()
        }
    }

    @ViewBuilder
    private var content: some View {
        switch phase {
        case .joining:
            ProgressView()
                .tint(GTIColor.TextOnGradient.primary)
                .accessibilityIdentifier("join.progress")
        case .joined(let roomID):
            VStack(spacing: GTISpacing.step2) {
                Text("Joined room")
                    .font(.system(size: GTIFont.Size.heading, weight: .heavy))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                Text(roomID.uuidString)
                    .font(.system(size: GTIFont.Size.sm, design: .monospaced))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("join.roomID")
            }
        case .error(let message):
            Text(message)
                .font(.system(size: GTIFont.Size.body, weight: .semibold))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .multilineTextAlignment(.center)
                .accessibilityIdentifier("join.error")
        }
    }

    /// wfr-14 — Escape Hatch + Error Messages patterns. Renders a
    /// "Cancel" tertiary during `.joining` (the user can abort the
    /// load) and a "Try another link" tertiary during `.error` (the
    /// user can recover from a dead invite). The `.joined` phase
    /// intentionally has no escape here — the host transitions
    /// straight into the quiz on the `onJoined` callback, so the
    /// JoinScreen unmounts on its own.
    @ViewBuilder
    private var escapeAffordance: some View {
        switch phase {
        case .joining:
            Button(action: onCancel) {
                Text(JoinScreen.cancelLabel.uppercased())
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(GTIFont.TrackingEm.eyebrow * 11)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.55))
                    .padding(GTISpacing.step1)
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("join.cta.cancel")
            .accessibilityLabel(JoinScreen.cancelLabel)
        case .error:
            Button(action: onCancel) {
                Text(JoinScreen.backLabel.uppercased())
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.78))
                    .padding(GTISpacing.step1)
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("join.cta.back")
            .accessibilityLabel(JoinScreen.backLabel)
        case .joined:
            EmptyView()
        }
    }

    // MARK: - copy labels (wfr-14)

    /// Cancel chrome label during `.joining`. Plain voluntary verb per
    /// the Escape Hatch pattern. Matches the dialog/loader Cancel
    /// idiom used elsewhere (SettingsScreen confirm-alert cancel,
    /// RerollScreen cancel CTA).
    public static let cancelLabel = "Cancel"

    /// Recovery label during `.error`. Names the fix (re-invite) per
    /// the Error Messages pattern instead of a sterile "Back" /
    /// "Retry," and keeps the warm-friend register (AGENTS.md product
    /// invariant #1).
    public static let backLabel = "Try another link"

    // MARK: - test seams (wfr-14)

    /// Drives the Cancel tertiary's closure directly. SwiftUI's
    /// `Button` doesn't expose an easy programmatic-tap path in unit
    /// tests, and the closure is the load-bearing contract. Mirrors
    /// `LockedScreen.simulateHomeTapForTesting`.
    public func simulateCancelTapForTesting() {
        onCancel()
    }

    /// Drives the "Try another link" tertiary's closure directly.
    /// Currently the same closure as Cancel — both paths share the
    /// "abandon this deep-link" host destination. Kept as a separate
    /// seam so the AC mapping is one-to-one with the test suite.
    public func simulateBackTapForTesting() {
        onCancel()
    }

    private func joinIfNeeded() async {
        // Make sure we have a session before we attempt the membership
        // insert — RLS rejects an unauthenticated client. Either flavor
        // is acceptable: anonymous pre-S00a invitees can still come through
        // here on web→iOS upgrades, and Apple-linked users (the post-S00a
        // norm) carry a real identity that's already valid
        // against the same RLS policy.
        await auth.ensureSignedIn()

        guard let userID = auth.state.userID else {
            phase = .error("Couldn't sign in.")
            return
        }

        // TB-11 — route via the server-side `join_room_smart` RPC
        // when a LateJoinerStore was wired in. Falls back to the
        // legacy direct insert for older call sites + tests that
        // haven't been updated (the design-system parity preview,
        // some unit tests). Either path arrives at the quiz hand-off
        // when the room is still open.
        guard let lateJoinerStore else {
            await joinDirectly(userID: userID)
            return
        }

        do {
            let route = try await lateJoinerStore.resolveRoute(roomID: payload.roomID)
            switch route {
            case .joinedToOpenRoom, .alreadyMember:
                phase = .joined(roomID: payload.roomID)
                onJoined?(payload.roomID, userID)
            case .readOnly:
                // The read-only branch is rendered by RootView via
                // `onLateJoiner`. Don't write a `joined` phase — the
                // late-joiner never became a member.
                onLateJoiner?(route)
            }
        } catch LateJoinerStore.RouteError.roomNotFound {
            phase = .error("This invite link is no longer valid.")
        } catch LateJoinerStore.RouteError.unauthenticated {
            phase = .error("Couldn't sign in anonymously.")
        } catch {
            phase = .error("Couldn't join the room. \(String(describing: error))")
        }
    }

    /// Legacy path — direct `members` insert without server-side
    /// status routing. Retained so design-system parity previews +
    /// any pre-TB-11 test surfaces continue to compile and behave
    /// identically. New surfaces should pass a LateJoinerStore.
    private func joinDirectly(userID: UUID) async {
        do {
            try await roomStore.joinRoom(id: payload.roomID, as: userID)
            phase = .joined(roomID: payload.roomID)
            onJoined?(payload.roomID, userID)
        } catch {
            phase = .error("Couldn't join the room. \(String(describing: error))")
        }
    }
}
