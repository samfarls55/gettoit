// GetToIt — Root view.
//
// Boots the AuthCoordinator + RoomStore, then routes between three
// surfaces:
//   * S01 InitiatorScreen — default landing for the device that
//     opens the app cold.
//   * JoinScreen — surfaced when a Universal Link delivers a deep
//     link payload (TB-02).
//   * QuizScreen — surfaced once the device is a member of a room,
//     either because the initiator just shared the link (PRD user
//     story 8) or the invitee just joined (TB-04).
//
// `activeQuiz` is consulted before `deepLink`: once the quiz is live,
// re-opening another deep link doesn't force-rejoin mid-quiz.

import SwiftUI
import Supabase

public struct RootView: View {
    @State private var coordinators: Coordinators?
    @State private var configMissing = false
    @State private var deepLink: InviteLink.Payload?
    @State private var activeQuiz: QuizContext?

    public init() {}

    public var body: some View {
        ZStack {
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            if configMissing {
                Text("Supabase is not configured for this build.")
                    .font(.system(size: GTIFont.Size.body, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.primary)
                    .multilineTextAlignment(.center)
                    .padding(GTISpacing.step6)
            } else if let coordinators {
                if let quizCoordinator = activeQuiz?.coordinator {
                    QuizScreen(
                        coordinator: quizCoordinator,
                        onClose: { activeQuiz = nil },
                        onSubmitted: { activeQuiz = nil }
                    )
                } else if let payload = deepLink {
                    JoinScreen(
                        payload: payload,
                        auth: coordinators.auth,
                        roomStore: coordinators.roomStore,
                        onJoined: { roomID, userID in
                            startQuiz(roomID: roomID, userID: userID, client: coordinators.client)
                        }
                    )
                } else if case .anonymous(let userID) = coordinators.auth.state {
                    InitiatorScreen(
                        roomStore: coordinators.roomStore,
                        userID: userID,
                        onSharedRoom: { roomID in
                            startQuiz(roomID: roomID, userID: userID, client: coordinators.client)
                        }
                    )
                } else {
                    Text("Sign-in failed. Pull to retry.")
                        .font(.system(size: GTIFont.Size.body, weight: .semibold))
                        .foregroundStyle(GTIColor.TextOnGradient.primary)
                        .multilineTextAlignment(.center)
                        .padding(GTISpacing.step6)
                }
            } else {
                ProgressView()
                    .tint(GTIColor.TextOnGradient.primary)
            }
        }
        .task {
            await bootstrap()
        }
        // Custom URL scheme path. SwiftUI also routes Universal Link
        // openings through here on iOS 17+, but historically the
        // canonical hook was `.onContinueUserActivity`; we wire both so
        // either delivery path produces the same routing.
        .onOpenURL { url in
            handle(url: url)
        }
        .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
            if let url = activity.webpageURL {
                handle(url: url)
            }
        }
    }

    private func bootstrap() async {
        guard coordinators == nil else { return }
        guard let config = SupabaseConfig.fromBundle() else {
            self.configMissing = true
            return
        }
        let client = SupabaseClient(supabaseURL: config.url, supabaseKey: config.anonKey)
        let auth = AuthCoordinator(client: client)
        let roomStore = RoomStore(client: client)
        await auth.ensureSignedIn()
        self.coordinators = Coordinators(auth: auth, roomStore: roomStore, client: client)
    }

    private func handle(url: URL) {
        guard let payload = InviteLink.parse(url) else { return }
        self.deepLink = payload
    }

    /// Spin up a fresh `QuizCoordinator` bound to the current room +
    /// user, and route into `QuizScreen`. Called from the initiator
    /// flow (after the share sheet drops the link — PRD user story 8)
    /// and from the join flow (after the invitee's `members` row is
    /// written).
    private func startQuiz(roomID: UUID, userID: UUID, client: SupabaseClient) {
        let coordinator = QuizCoordinator(
            roomID: roomID,
            userID: userID,
            writer: QuizSupabaseWriter.make(client: client)
        )
        self.activeQuiz = QuizContext(coordinator: coordinator)
        // Clear the deep link so closing the quiz returns to the
        // initiator surface rather than re-routing back into Join.
        self.deepLink = nil
    }

    // Group the live coordinators so the view body keeps a single
    // optional for "are we configured yet."
    private struct Coordinators {
        let auth: AuthCoordinator
        let roomStore: RoomStore
        let client: SupabaseClient
    }

    private struct QuizContext {
        let coordinator: QuizCoordinator
    }
}
