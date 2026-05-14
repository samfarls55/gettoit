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

    public init(
        payload: InviteLink.Payload,
        auth: AuthCoordinator,
        roomStore: RoomStore,
        lateJoinerStore: LateJoinerStore? = nil,
        phase: Phase = .joining,
        onJoined: ((UUID, UUID) -> Void)? = nil,
        onLateJoiner: ((LateJoinerStore.Route) -> Void)? = nil
    ) {
        self.payload = payload
        self.auth = auth
        self.roomStore = roomStore
        self.lateJoinerStore = lateJoinerStore
        self._phase = State(initialValue: phase)
        self.onJoined = onJoined
        self.onLateJoiner = onLateJoiner
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
