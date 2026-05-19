// GetToIt — Root view.
//
// Boots the AuthCoordinator + RoomStore + LateJoinerStore, then
// routes between five surfaces:
//   * S00a SignInScreen — TB-02 (v1.1) forced first-launch sign-in
//     gate. Rendered when `AuthCoordinator.state` is `.idle` (fresh
//     install, no cached session) OR `.anonymous` (pre-v1.1 install
//     with a v1 anonymous session still in Keychain — bug-06). Both
//     branches route the same surface; the tap handler in
//     `SignInScreen` decides between `signInWithApple` (mint a fresh
//     Linked-Apple session) and `linkApple` (upgrade the existing
//     anonymous session, preserving `user_id`). Closes the iOS half
//     of ADR 0007's anonymous-default for v1.1.
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
// State precedence (inner-most wins): `activeQuiz` → `postQuizHost`
// → `readOnlyView` → `deepLink` → settings → S01 (when
// `showingInitiator` is true) → S00 Landing (the default for a
// signed-in idle session). The S00a gate sits outside this chain — it
// is the launch destination iff no session exists. Once the user
// signs in, the gate dismisses and the standard precedence chain
// takes over (idle landing on S00, not S01). Re-opening a deep link
// mid-quiz doesn't force-rejoin.
//
// TB-19 — `postQuizHost` is the post-Q5 router. A successful Q5
// submit clears `activeQuiz` and sets `postQuizHost`, so the chain
// hands the session to the verdict-resolving surface (S04 resolving →
// S05 verdict) rather than falling through to S00 Landing. Before
// TB-19 the chain dead-ended on S00 after a submit — that was bug-07.

import SwiftUI
import Supabase
import CoreLocation

public struct RootView: View {
    @State private var coordinators: Coordinators?
    @State private var configMissing = false
    @State private var deepLink: InviteLink.Payload?
    @State private var activeQuiz: QuizContext?
    /// TB-19 — set when the quiz reports a successful Q5 submit. Owns
    /// the post-Q5 session lifecycle (resolving → verdict → failed) and
    /// closes bug-07: before this, a Q5 submit just cleared `activeQuiz`
    /// and the precedence chain fell through to S00 Landing — the
    /// session dead-ended. The host polls the `verdicts` table until
    /// the engine's row lands, then renders `VerdictScreen`. Cleared
    /// when the user ends the session (→ S00 Landing, now the correct
    /// destination).
    @State private var postQuizHost: PostQuizHost?
    @State private var readOnlyView: ReadOnlyContext?
    /// TB-05 (v1.1) — set when the initiator finishes S01 (room
    /// created, link dropped or solo) and the pre-quiz S01b parameters
    /// surface should render before the quiz starts. Cleared when the
    /// initiator persists the parameters and `startQuiz` fires. A
    /// JOINER never gets a `ParametersContext` — joiners read the
    /// initiator's parameters off the room and skip straight to the
    /// quiz.
    @State private var pendingParameters: ParametersContext?
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
                // Apple identity blocks the iOS post-v1.1 invariant
                // ("every iOS session on screen is Linked-Apple").
                // Two starting states route here:
                //   * .idle      — fresh install, no cached session.
                //                  Tap mints a new Linked-Apple session
                //                  via `signInWithApple`.
                //   * .anonymous — bug-06: a pre-v1.1 install left a
                //                  v1 anonymous session in Keychain.
                //                  Tap upgrades it via `linkApple`,
                //                  preserving the existing `user_id`
                //                  and every owned row (rooms, votes,
                //                  members, events).
                // After a successful sign-in the coordinator flips to
                // `.linkedApple(userID)` and this branch falls through
                // to the regular precedence below. The gate also
                // re-renders after a sign-out from S09 Settings — the
                // coordinator's `signOut + signInAnonymously` post-
                // delete dance now lands on `.anonymous`, which this
                // widened gate also catches (the user is sent right
                // back through S00a).
                if shouldRenderSignInGate(coordinators.auth.state) {
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
                } else if let quiz = activeQuiz {
                    QuizScreen(
                        coordinator: quiz.coordinator,
                        onClose: { activeQuiz = nil },
                        // TB-19 — a successful Q5 submit no longer just
                        // clears the quiz (which dead-ended on S00
                        // Landing — bug-07). It hands the session to the
                        // post-Q5 router, which resolves the verdict and
                        // routes to S05.
                        onSubmitted: {
                            enterPostQuiz(quiz: quiz, client: coordinators.client)
                        }
                    )
                } else if let host = postQuizHost {
                    // TB-19 / TB-20 — the post-Q5 router. Owns the
                    // session from "Q5 submitted" to "verdict on
                    // screen". A solo session resolves straight to S05
                    // in `.solo` mode; a group session shows the S04
                    // Waiting surface (avatar row re-bootstrapped from
                    // a snapshot poll) and advances to S05 when the
                    // verdict fires. Ending the session returns to S00
                    // Landing. `auth` + `promptStore` back the C-22
                    // Auth Upgrade Chip the S04 surface hosts.
                    PostQuizHostScreen(
                        host: host,
                        auth: coordinators.auth,
                        promptStore: AuthPromptStore(client: coordinators.client),
                        onEndSession: {
                            host.teardown()
                            postQuizHost = nil
                        }
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
                } else if let parameters = pendingParameters {
                    // TB-05 (v1.1) — S01b pre-quiz parameters surface.
                    // The initiator just finished S01 (room created);
                    // S01b captures the session-wide parameters bucket
                    // and persists it onto the room before the quiz
                    // starts. On Continue the parameters are written
                    // and `startQuiz` fires.
                    ParametersScreen(
                        roomID: parameters.roomID,
                        roomStore: coordinators.roomStore,
                        locationName: coordinators.locationCoordinator.place?.name,
                        initialParameters: SessionParameters.default,
                        onContinue: {
                            self.pendingParameters = nil
                            startQuiz(
                                roomID: parameters.roomID,
                                userID: parameters.userID,
                                client: coordinators.client,
                                invitedShared: parameters.invitedShared,
                                // The S01b parameters surface is only
                                // reached by the initiator (joiners read
                                // the initiator's parameters off the
                                // room and skip S01b — see the
                                // `ParametersContext` doc comment).
                                isInitiator: true
                            )
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
                                // TB-05 (v1.1) — the initiator's S01
                                // CTA now routes into the S01b
                                // pre-quiz parameters surface rather
                                // than straight to the quiz. S01b
                                // persists the parameters bucket and
                                // its Continue handler fires
                                // `startQuiz`. `showingInitiator` /
                                // `reInvitePrefill` are torn down in
                                // `startQuiz` so the swap stays atomic.
                                self.pendingParameters = ParametersContext(
                                    roomID: roomID,
                                    userID: userID,
                                    invitedShared: true
                                )
                            },
                            onSoloRoom: { roomID in
                                self.pendingParameters = ParametersContext(
                                    roomID: roomID,
                                    userID: userID,
                                    invitedShared: false
                                )
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

    /// bug-06 (v1.1) — render gate for the S00a sign-in surface.
    /// Returns `true` for any state where the iOS post-v1.1 invariant
    /// is not yet satisfied: a fresh install with no session
    /// (`.idle`) OR a pre-v1.1 install whose v1 anonymous session is
    /// still in Keychain (`.anonymous`). Both flavors converge on
    /// S00a; the tap handler in `SignInScreen` picks `signInWithApple`
    /// vs `linkApple` from the same state at tap time.
    private func shouldRenderSignInGate(_ state: AuthCoordinator.State) -> Bool {
        switch state {
        case .idle, .anonymous:
            return true
        case .signingIn, .linking, .linkedApple, .error:
            return false
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
    ///
    /// TB-15 (v1.1) — startQuiz builds the QuizCoordinator with the
    /// session's resolved location and a live per-member Foursquare
    /// fetch. It does NOT fetch candidates here: before TB-15 the
    /// assembler ran the bug-03 bridge (`Q5CandidatesLoader` — one
    /// `PlacesService.fetchPlaces` with empty filters, before any quiz
    /// answer existed). That early fetch is gone. The coordinator's
    /// step machine now fires the answer-tailored N+1 calls when the
    /// member completes Q4, so Q5 renders venues that reflect the
    /// member's Q1 cuisines and Q2 spend cap.
    ///
    /// The session's location is read from the shared
    /// LocationCoordinator (hydrated for the joiner from
    /// `rooms.location_*` so a single source answers for both
    /// initiator and joiner).
    ///
    /// TB-19 — `isInitiator` records whether this device created the
    /// room. It is carried onto the `QuizContext` so the post-Q5 router
    /// can build a `PostQuizSessionContext`. Defaults to `false`: the
    /// only call site that omits it is the join flow, whose user is by
    /// definition a joiner, not the initiator.
    private func startQuiz(
        roomID: UUID,
        userID: UUID,
        client: SupabaseClient,
        invitedShared: Bool = true,
        isInitiator: Bool = false
    ) {
        guard let coordinators else { return }
        Task {
            let resolved = await resolvePlacesQuery(
                roomID: roomID,
                coordinators: coordinators
            )
            let proxy = SupabaseFunctionsPlacesProxyClient(client: client)
            let places = PlacesService(
                proxy: proxy,
                mapKitFallback: MapKitPlacesFallback(),
                // Cross-check Foursquare candidates against MapKit and
                // drop out-of-business venues — see VenueClosureVerifier.
                closureVerifier: MapKitClosureVerifier()
            )
            let assembled = QuizSessionAssembler.assembleCoordinator(
                roomID: roomID,
                userID: userID,
                coordinate: resolved?.coordinate,
                radiusMeters: resolved?.radiusMeters ?? RoomStore.defaultRadiusMeters,
                // The search area's timezone — drives the venue-local
                // `open_at` token in the per-member fetch planner.
                timeZone: resolved?.timeZone ?? .current,
                // TB-05 (v1.1) — hydrate the session parameters from
                // the room. On the joiner path this is the initiator's
                // S01b bucket read back off `rooms.session_params`, so
                // the joiner's quiz runs against the same parameters
                // without re-prompting. Falls back to the canonical
                // defaults when the column is NULL / room unreadable.
                sessionParameters: resolved?.sessionParameters ?? SessionParameters.default,
                places: places,
                // TB-21 — persist the member's full raw Foursquare
                // fetch into `member_fetches`; the compute-verdict Edge
                // Function unions every member's fetch into `options`
                // at verdict fire time.
                memberFetchWriter: MemberFetchSupabaseWriter.make(client: client),
                writer: QuizSupabaseWriter.make(client: client)
            )
            // Flip into the quiz and tear down S01 routing state in
            // the same scope so SwiftUI batches the updates and the
            // precedence chain never momentarily falls through to S00
            // Landing between InitiatorScreen and QuizScreen.
            self.reInvitePrefill = nil
            self.showingInitiator = false
            self.activeQuiz = QuizContext(
                coordinator: assembled.coordinator,
                roomID: roomID,
                userID: userID,
                isInitiator: isInitiator,
                invitedShared: invitedShared
            )
            // Clear the deep link so closing the quiz returns to S00
            // Landing rather than re-routing back into Join.
            self.deepLink = nil
        }
    }

    /// TB-19 — hand the just-submitted session to the post-Q5 router.
    /// Called from `QuizScreen`'s `onSubmitted` callback. Builds a
    /// `PostQuizHost` whose verdict poll is backed by a live
    /// `VerdictStore`, then swaps the precedence chain from the quiz
    /// onto the host in a single scope so SwiftUI batches the update
    /// and the chain never momentarily falls through to S00 Landing.
    ///
    /// Closes bug-07: the prior `onSubmitted` handler just cleared
    /// `activeQuiz`, and with nothing else set the precedence chain
    /// dead-ended on S00 Landing. Now the host owns the session through
    /// to the verdict.
    private func enterPostQuiz(quiz: QuizContext, client: SupabaseClient) {
        let store = VerdictStore(client: client)
        let snapshotStore = SessionSnapshotStore(client: client)
        let context = PostQuizSessionContext(
            roomID: quiz.roomID,
            userID: quiz.userID,
            isInitiator: quiz.isInitiator,
            invitedShared: quiz.invitedShared
        )
        let host = PostQuizHost(
            context: context,
            // The verdict fires server-side on the lone Q5-complete
            // vote (tb-13); the row lands a short moment later. The
            // poller calls `fetchVerdict` until it does.
            fetchVerdict: { roomID in
                try await store.fetchVerdict(roomID: roomID)
            },
            // TB-20 — the group path's snapshot read. The host
            // re-bootstraps its `WaitingStore` from this on each poll
            // cycle so the S04 avatar row stays live. A solo session's
            // `PostQuizHost` ignores this (it never enters `.waiting`).
            fetchSnapshot: { roomID in
                try await snapshotStore.fetchSnapshot(roomID: roomID)
            }
        )
        self.postQuizHost = host
        self.activeQuiz = nil
        DebugTrace.mark(
            "rootView.enterPostQuiz",
            room: quiz.roomID,
            detail: "isInitiator=\(quiz.isInitiator) invitedShared=\(quiz.invitedShared)"
        )
    }

    /// Resolve the `(coordinate, radiusMeters)` pair PlacesService
    /// needs for the session. Both paths funnel through the shared
    /// `LocationCoordinator` (one location source for both initiator
    /// and joiner, per the bug-03 hard rule):
    ///   * Initiator: `place` is already committed via the S01
    ///     LocationPicker; the CTA's `cannotAdvance` guard ensured a
    ///     non-nil value before the share fired.
    ///   * Joiner: arrives via deep link with no committed place, so
    ///     we fetch the room row and hydrate the coordinator from
    ///     `rooms.location_*`. The room's `radius_meters` is used in
    ///     both paths because the migration always echoes the value
    ///     the initiator picked.
    /// Returns nil only when the room row is missing or unreadable
    /// (RLS deny on a stale routing) - the caller falls back to dummy
    /// candidates rather than block the user mid-flow.
    ///
    /// TB-05 (v1.1) — also carries the room's `session_params` so the
    /// joiner path hydrates the initiator's parameters bucket off the
    /// same single room fetch (no extra round-trip). NULL column /
    /// unreadable room → `SessionParameters.default`.
    private func resolvePlacesQuery(
        roomID: UUID,
        coordinators: Coordinators
    ) async -> (coordinate: CLLocationCoordinate2D, radiusMeters: Int, sessionParameters: SessionParameters, timeZone: TimeZone)? {
        let room: RoomStore.Room?
        do {
            room = try await coordinators.roomStore.fetchRoom(id: roomID)
        } catch {
            room = nil
        }
        let radiusMeters = room?.radiusMeters ?? RoomStore.defaultRadiusMeters
        let sessionParameters = room?.sessionParameters ?? SessionParameters.default

        if let place = coordinators.locationCoordinator.place {
            return (place.coordinate, radiusMeters, sessionParameters, place.timeZone)
        }
        if let location = room?.location {
            // Joiner path: hydrate the coordinator from the initiator's
            // pick so downstream surfaces (and a future re-fetch) see
            // the same place — including the area timezone the
            // initiator resolved, so the joiner's `open_at` token is
            // planned against the SAME zone (an empty stored identifier,
            // from a pre-`location_tz` room, falls back to the device).
            let coordinate = CLLocationCoordinate2D(
                latitude: location.lat,
                longitude: location.lng
            )
            let timeZone = TimeZone(identifier: location.timeZoneIdentifier) ?? .current
            let resolved = ResolvedPlace(
                id: "room:\(roomID.uuidString)",
                name: location.name,
                sub: "",
                coordinate: coordinate,
                source: location.source == .gps ? .gps : .manual,
                timeZone: timeZone
            )
            coordinators.locationCoordinator.commit(place: resolved)
            return (coordinate, radiusMeters, sessionParameters, timeZone)
        }
        return nil
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

    /// TB-05 (v1.1) — carries the room + user from the S01 CTA into
    /// the S01b parameters surface, plus the `invitedShared` flag the
    /// post-Q5 router needs once the quiz starts.
    private struct ParametersContext {
        let roomID: UUID
        let userID: UUID
        let invitedShared: Bool
    }

    private struct QuizContext {
        let coordinator: QuizCoordinator
        /// The room this quiz is bound to. TB-19 — carried so the
        /// post-Q5 router can build a `PostQuizSessionContext` without
        /// reaching into the coordinator's private fields.
        let roomID: UUID
        /// The signed-in user submitting the quiz.
        let userID: UUID
        /// TB-19 — whether this device created the room (initiator) or
        /// joined it. Drives `VerdictScreen`'s `isInitiator` flag on the
        /// post-Q5 verdict surface.
        let isInitiator: Bool
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
