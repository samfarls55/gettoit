// GetToIt — Join screen (TB-02 minimal).
//
// Lands here when the app handles a Universal Link of the form
// `https://gettoit.app/join/{roomId}?inviteToken={token}`. The screen
// ensures the device is signed in anonymously (if not already), inserts
// a `members` row with `role='participant'`, and renders
// "Joined room <id>" once that succeeds. Subsequent tracer bullets
// (TB-04, TB-07) replace this with the quiz / waiting flow.
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
    private let onJoined: ((UUID, UUID) -> Void)?

    public init(
        payload: InviteLink.Payload,
        auth: AuthCoordinator,
        roomStore: RoomStore,
        phase: Phase = .joining,
        onJoined: ((UUID, UUID) -> Void)? = nil
    ) {
        self.payload = payload
        self.auth = auth
        self.roomStore = roomStore
        self._phase = State(initialValue: phase)
        self.onJoined = onJoined
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

    private func joinIfNeeded() async {
        // Make sure we have an anonymous session before we attempt the
        // membership insert — RLS rejects an unauthenticated client.
        await auth.ensureSignedIn()

        guard case .anonymous(let userID) = auth.state else {
            phase = .error("Couldn't sign in anonymously.")
            return
        }

        do {
            try await roomStore.joinRoom(id: payload.roomID, as: userID)
            phase = .joined(roomID: payload.roomID)
            // TB-04: after the membership row lands, transition the
            // invitee into Q1. The callback is optional so test
            // surfaces that don't want the auto-transition can omit
            // it.
            onJoined?(payload.roomID, userID)
        } catch {
            phase = .error("Couldn't join the room. \(String(describing: error))")
        }
    }
}
