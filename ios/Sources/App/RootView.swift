// GetToIt — Root view.
//
// Boots the AuthCoordinator + RoomStore + LateJoinerStore, then
// routes between five surfaces:
//   * S00a SignInScreen — TB-02 (v1.1) forced first-launch sign-in
//     gate. Rendered when `AuthCoordinator.state == .idle` after
//     `restoreSessionIfPresent` returns (no cached session). Closes
//     the iOS half of ADR 0007's anonymous-default for v1.1.
//   * S00 LandingScreen — post-sign-in entry surface (v1.1, TB-01).
//     Every cold launch with an active auth session lands here first;
//     the user picks Start a Decision (→ S01) or Account Settings
//     (→ S09). Idle until tap. See surfaces/00-landing.md.
//   * S01 InitiatorScreen — the "Pick a Vertical" / timer + radius
//     surface. Reached via the landing "Start a Decision" CTA, or
//     directly for the late-joiner re-invite tap.
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
// → `deepLink` → settings → S01 (when `showingInitiator` is true) →
// S00 Landing (the default for a signed-in idle session). The S00a
// gate sits outside this chain — it is the launch destination iff no
// session exists. Once the user signs in, the gate dismisses and the
// standard precedence chain takes over (idle landing on S00, not S01).
// Re-opening a deep link mid-quiz doesn't force-rejoin.

import SwiftUI
import Supabase
import CoreLocation

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
    /// TB-16 — set when the user taps "Settings" on S01 or the S00
    /// landing surface's "Account Settings" CTA. Renders the S09
    /// Settings surface; the route clears on Done or after a successful
    /// delete + re-bootstrap.
    @State private var showingSettings = false
    /// TB-01 (v1.1) — set when the user taps "Start a Decision" on the
    /// S00 landing surface. While true, the host renders the S01
    /// InitiatorScreen; the late-joiner re-invite path also flips this
    /// on so the prefilled InitiatorScreen surfaces without a detour
    /// through the landing screen. Defaults to false so a cold,
    /// signed-in launch lands on S00 per surfaces/00-landing.md.
    @State private var showingInitiator = false
    /// TB-03 (v1.1) — set when the user taps "Start a Decision" on the
    /// S00 landing surface AND iOS location permission is still
    /// `notDetermined`. While true, the host renders the S00b
    /// LocationPermissionScreen (pre-prime). On either CTA tap the
    /// flag clears and `showingInitiator` flips to true so S01 takes
    /// over. Permission outcomes are observed via the shared
    /// LocationCoordinator on `coordinators` — we don't gate the
    /// transition on grant vs deny because the picker on S01 handles
    /// both states.
    @State private var showingLocationPermission = false

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
                // TB-02 v1.1 — S00a forced sign-in gate. Sits ABOVE the
                // standard state precedence chain because a missing
                // session blocks every other route (RLS will reject
                // any data read). After a successful sign-in the
                // coordinator flips to `.linkedApple(userID)` and this
                // branch falls through to the regular precedence
                // below. The gate also re-renders after a sign-out
                // from S09 Settings — the coordinator's `signOut +
                // signInAnonymously` post-delete dance is the legacy
                // path; a future cleanup may swap that for a true
                // sign-out that re-routes back through S00a.
                if case .idle = coordinators.auth.state {
                    SignInScreen(
                        auth: coordinators.auth,
                        onSignedIn: { }
                    )
                } else if showingSettings {
                    // TB-16 — Settings is the inner-most route in
                    // the state precedence chain. While it's up, the
                    // host suppresses every other surface; on Done or
                    // after a successful delete, control returns to
                    // S01 (which may itself defer to a deep-link or
                    // read-only landing if those arrived in the
                    // meantime).
                    SettingsScreen(
                        auth: coordinators.auth,
                        onDone: { showingSettings = false }
                    )
                } else if let quizCoordinator = activeQuiz?.coordinator {
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
                } else if let userID = coordinators.auth.state.userID {
                    // TB-01 (v1.1) — S00 Landing is the default
                    // signed-in surface. The host flips
                    // `showingInitiator` to true on the Start a
                    // Decision tap (or when a late-joiner re-invite
                    // prefill is carried in, so the user lands on
                    // S01 with prefill instead of being asked
                    // "what's next?" again).
                    //
                    // After TB-02 v1.1, the canonical iOS user is
                    // `.linkedApple` (post-S00a). Legacy v1 installs
                    // that hadn't yet upgraded land as `.anonymous`
                    // until the user signs out / deletes and re-
                    // bootstraps through S00a. Both flavors route the
                    // same way at this layer; the chip rendering on
                    // S04 still consults `state.isAnonymous` to gate
                    // the C-22 upgrade prompt.
                    if showingLocationPermission {
                        // TB-03 (v1.1) — S00b pre-prime sits between
                        // landing and S01 on first launch. Either CTA
                        // clears the flag and flips into S01; the
                        // primary CTA additionally fires
                        // `requestPermission()` so the iOS dialog
                        // appears on top of this surface and resolves
                        // before S01 mounts.
                        LocationPermissionScreen(
                            onShareLocation: {
                                coordinators.locationCoordinator.requestPermission()
                                showingLocationPermission = false
                                showingInitiator = true
                            },
                            onManualEntry: {
                                showingLocationPermission = false
                                showingInitiator = true
                            }
                        )
                    } else if showingInitiator || reInvitePrefill != nil {
                        InitiatorScreen(
                            roomStore: coordinators.roomStore,
                            userID: userID,
                            locationCoordinator: coordinators.locationCoordinator,
                            prefilledTimerMinutes: reInvitePrefill?.timerMinutes,
                            prefilledRadiusMiles: reInvitePrefill?.radiusMiles,
                            onSharedRoom: { roomID in
                                // The prefill was a one-shot — after the
                                // re-invite path lands a new room, drop
                                // the carried defaults so the next cold
                                // S01 entry surfaces the canonical
                                // defaults. `showingInitiator` is also
                                // cleared because `startQuiz` flips
                                // `activeQuiz`, which sits inner-most in
                                // the precedence chain; closing the quiz
                                // returns to S00 Landing, not S01.
                                reInvitePrefill = nil
                                showingInitiator = false
                                startQuiz(roomID: roomID, userID: userID, client: coordinators.client, invitedShared: true)
                            },
                            onSoloRoom: { roomID in
                                // Solo path uses the same one-shot prefill
                                // semantics — once the new room lands, the
                                // carried defaults are spent.
                                reInvitePrefill = nil
                                showingInitiator = false
                                startQuiz(roomID: roomID, userID: userID, client: coordinators.client, invitedShared: false)
                            },
                            onSettings: {
                                showingSettings = true
                            }
                        )
                    } else {
                        LandingScreen(
                            onStartDecision: {
                                // TB-03 (v1.1) — only surface the S00b
                                // pre-prime when the user hasn't yet
                                // answered the iOS dialog. On subsequent
                                // launches (granted or denied) we route
                                // straight to S01; the picker on S01
                                // handles both states.
                                if coordinators.locationCoordinator.authorization == .notDetermined {
                                    showingLocationPermission = true
                                } else {
                                    showingInitiator = true
                                }
                            },
                            onAccountSettings: {
                                showingSettings = true
                            }
                        )
                    }
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
        // TB-03 (v1.1) — one LocationCoordinator per session. Built
        // here so S00b pre-prime and S01 chip both observe the same
        // CLLocationManager. The coordinator reads the live
        // authorization status on init, so by the time the S00
        // landing surface mounts we already know whether to short-
        // circuit the pre-prime on subsequent launches.
        let locationCoordinator = LocationCoordinator()
        // TB-02 v1.1 — restore cached session if any, otherwise leave
        // `.idle` so the S00a sign-in gate renders. Replaces the v1
        // `ensureSignedIn` call which would have minted an anonymous
        // session on a fresh install.
        await auth.restoreSessionIfPresent()
        self.coordinators = Coordinators(
            auth: auth,
            roomStore: roomStore,
            lateJoinerStore: lateJoinerStore,
            client: client,
            locationCoordinator: locationCoordinator
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
        /// TB-03 (v1.1) — shared LocationCoordinator instance. The
        /// S00b pre-prime CTA fires `requestPermission()` on this
        /// instance; the S01 LocationPickerChip + LocationPickerSheet
        /// observe the same instance so the permission state and the
        /// resolved place flow from the pre-prime into the initiator
        /// surface without re-instantiating CLLocationManager.
        let locationCoordinator: LocationCoordinator
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
