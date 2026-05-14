// GetToIt — Root view.
//
// Boots the AuthCoordinator + RoomStore + LateJoinerStore, then
// routes between four surfaces:
//   * S01 InitiatorScreen — default landing for the device that
//     opens the app cold (or for the late-joiner's re-invite tap).
//   * JoinScreen — surfaced when a Universal Link delivers a deep
//     link payload (TB-02). Internally routes via
//     `LateJoinerStore.resolveRoute` to decide whether to insert
//     a `members` row (open / firing) or to surface the read-only
//     S05 branch (verdict_ready / locked / expired) — TB-11.
//   * QuizScreen — surfaced once the device is a member of a room,
//     either because the initiator just shared the link (PRD user
//     story 8) or the invitee just joined (TB-04).
//   * VerdictScreen `.readOnly` — surfaced when the late-joiner
//     tapped an invite link AFTER the verdict was sealed (TB-11).
//
// State precedence (inner-most wins): `activeQuiz` → `readOnlyView`
// → `deepLink` → cold-start initiator. Once the quiz is live,
// re-opening another deep link doesn't force-rejoin mid-quiz.

import SwiftUI
import Supabase

public struct RootView: View {
    @State private var coordinators: Coordinators?
    @State private var configMissing = false
    @State private var deepLink: InviteLink.Payload?
    @State private var activeQuiz: QuizContext?
    @State private var readOnlyView: ReadOnlyContext?
    /// TB-11 — re-invite prefill carried through from a read-only
    /// landing. When the late-joiner taps "Start a new decision",
    /// the InitiatorScreen opens with these values pre-populated
    /// (saves a tap; the late-joiner is likely planning a similar
    /// outing).
    @State private var reInvitePrefill: ReInvitePrefill?

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
                } else if let readOnly = readOnlyView {
                    // TB-11 — read-only late-joiner branch. The
                    // VerdictScreen renders the sealed verdict; the
                    // re-invite CTA hands the prior room's defaults
                    // up to RootView, which routes back to the
                    // initiator surface as a fresh round.
                    VerdictScreen(
                        verdict: readOnly.payload.verdict,
                        mode: .readOnly,
                        isInitiator: false,
                        onAdvance: {
                            reInvitePrefill = ReInvitePrefill(
                                timerMinutes: readOnly.payload.timerMinutes,
                                radiusMiles: LateJoinerStore.radiusMilesForMeters(readOnly.payload.radiusMeters)
                            )
                            readOnlyView = nil
                            deepLink = nil
                        }
                    )
                } else if let payload = deepLink {
                    JoinScreen(
                        payload: payload,
                        auth: coordinators.auth,
                        roomStore: coordinators.roomStore,
                        lateJoinerStore: coordinators.lateJoinerStore,
                        onJoined: { roomID, userID in
                            startQuiz(roomID: roomID, userID: userID, client: coordinators.client)
                        },
                        onLateJoiner: { route in
                            Task { await loadReadOnly(roomID: payload.roomID, route: route, store: coordinators.lateJoinerStore) }
                        }
                    )
                } else if case .anonymous(let userID) = coordinators.auth.state {
                    InitiatorScreen(
                        roomStore: coordinators.roomStore,
                        userID: userID,
                        prefilledTimerMinutes: reInvitePrefill?.timerMinutes,
                        prefilledRadiusMiles: reInvitePrefill?.radiusMiles,
                        onSharedRoom: { roomID in
                            // The prefill was a one-shot — after the
                            // re-invite path lands a new room, drop
                            // the carried defaults so the next cold
                            // S01 entry surfaces the canonical
                            // defaults.
                            reInvitePrefill = nil
                            startQuiz(roomID: roomID, userID: userID, client: coordinators.client, invitedShared: true)
                        },
                        onSoloRoom: { roomID in
                            // Solo path uses the same one-shot prefill
                            // semantics — once the new room lands, the
                            // carried defaults are spent.
                            reInvitePrefill = nil
                            startQuiz(roomID: roomID, userID: userID, client: coordinators.client, invitedShared: false)
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
        let lateJoinerStore = LateJoinerStore(client: client)
        await auth.ensureSignedIn()
        self.coordinators = Coordinators(
            auth: auth,
            roomStore: roomStore,
            lateJoinerStore: lateJoinerStore,
            client: client
        )
    }

    private func handle(url: URL) {
        guard let payload = InviteLink.parse(url) else { return }
        self.deepLink = payload
    }

    /// TB-11 — pull the read-only verdict payload from the server,
    /// build a `ReadOnlyContext`, and flip the view into the
    /// `.readOnly` branch. Called from `JoinScreen`'s
    /// `onLateJoiner` callback once the routing RPC returned the
    /// read-only verdict.
    private func loadReadOnly(
        roomID: UUID,
        route: LateJoinerStore.Route,
        store: LateJoinerStore
    ) async {
        // If for some reason the route already carried the read-only
        // payload (we passed it through the callback), we still
        // re-fetch — the routing RPC returns only the room status +
        // S01 defaults, not the verdict body.
        do {
            let payload = try await store.fetchReadOnlyPayload(roomID: roomID)
            self.readOnlyView = ReadOnlyContext(roomID: roomID, payload: payload)
            // The JoinScreen sat on the deepLink slot; clear it so
            // the read-only branch becomes the visible surface.
            self.deepLink = nil
        } catch {
            // Surface the failure into the JoinScreen by toggling
            // the deep link back through an error message. For v1
            // we just clear the deep link — the user can re-tap.
            self.deepLink = nil
        }
        _ = route // silence unused-arg in the cold path
    }

    /// Spin up a fresh `QuizCoordinator` bound to the current room +
    /// user, and route into `QuizScreen`. Called from the initiator
    /// flow (after the share sheet drops the link — PRD user story 8)
    /// and from the join flow (after the invitee's `members` row is
    /// written).
    ///
    /// `invitedShared` tracks whether the iOS share sheet was opened
    /// for this room from this device. Drives the TB-13 solo-path
    /// detection (`SoloPath.shouldSkipWaiting(memberCount:invitedShared:)`)
    /// once the post-Q5 router lands. Defaults to `true` for join-flow
    /// invitees — they wouldn't be here unless someone shared.
    private func startQuiz(
        roomID: UUID,
        userID: UUID,
        client: SupabaseClient,
        invitedShared: Bool = true
    ) {
        let coordinator = QuizCoordinator(
            roomID: roomID,
            userID: userID,
            writer: QuizSupabaseWriter.make(client: client)
        )
        self.activeQuiz = QuizContext(coordinator: coordinator, invitedShared: invitedShared)
        // Clear the deep link so closing the quiz returns to the
        // initiator surface rather than re-routing back into Join.
        self.deepLink = nil
    }

    // Group the live coordinators so the view body keeps a single
    // optional for "are we configured yet."
    private struct Coordinators {
        let auth: AuthCoordinator
        let roomStore: RoomStore
        let lateJoinerStore: LateJoinerStore
        let client: SupabaseClient
    }

    private struct QuizContext {
        let coordinator: QuizCoordinator
        /// TB-13 — whether the room was created via the share-and-invite
        /// path (`true`) or the solo tertiary (`false`). The post-Q5
        /// router consults `SoloPath.shouldSkipWaiting(memberCount:invitedShared:)`
        /// to decide whether to skip S04 Waiting and route directly to
        /// the S05 solo variant.
        let invitedShared: Bool
    }

    /// TB-11 — payload bundled with the room id so the read-only
    /// branch carries enough context to render the re-invite CTA.
    private struct ReadOnlyContext {
        let roomID: UUID
        let payload: LateJoinerStore.ReadOnlyPayload
    }

    /// TB-11 — one-shot prefill carried from the read-only S05
    /// re-invite CTA into the next cold InitiatorScreen entry.
    private struct ReInvitePrefill {
        let timerMinutes: Int
        let radiusMiles: Double
    }
}
