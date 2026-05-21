// GetToIt — Root view.
//
// Boots the AuthCoordinator + RoomStore + PlansStore + LateJoinerStore,
// then routes between the surfaces below:
//   * S00a SignInScreen — TB-02 (v1.1) forced first-launch sign-in
//     gate. Rendered when `AuthCoordinator.state` is `.idle` (fresh
//     install, no cached session) OR `.anonymous` (pre-v1.1 install
//     with a v1 anonymous session still in Keychain — bug-06). Both
//     branches route the same surface; the tap handler in
//     `SignInScreen` decides between `signInWithApple` (mint a fresh
//     Linked-Apple session) and `linkApple` (upgrade the existing
//     anonymous session, preserving `user_id`). Closes the iOS half
//     of ADR 0007's anonymous-default for v1.1.
//   * S00 PlanListScreen — post-sign-in entry surface (tb-WF-5,
//     workflow-overhaul). Every cold launch with an active auth
//     session lands here. Empty state renders a hero pill that
//     opens Solo Setup; populated state renders 1-line Pending cards
//     + a temp top-trailing `+` chrome glyph (replaced by the C-26
//     FAB in tb-WF-6). Replaces the retired `LandingScreen.swift`.
//     See surfaces/00-plan-list.md.
//   * S01 SetupScreen — tb-WF-4 (workflow-overhaul). The canonical
//     Plan creation + Plan edit surface — collapses the retired S01
//     Initiator + S01b Parameters screens into one. Two lifecycle
//     modes (`.create` / `.edit`); two group modes (`.solo` / `.group`)
//     drive 5- vs 6-control rendering per the 2026-05-20 amendment.
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
// → `readOnlyView` → `deepLink` → settings → S01 Setup (when
// `setupContext` is non-nil) → S00 Plan list (the default for a
// signed-in idle session). The S00a gate sits outside this chain — it
// is the launch destination iff no session exists. Once the user
// signs in, the gate dismisses and the standard precedence chain
// takes over (idle landing on the Plan list, not Setup). Re-opening
// a deep link mid-quiz doesn't force-rejoin.
//
// TB-19 — `postQuizHost` is the post-Q5 router. A successful Q5
// submit clears `activeQuiz` and sets `postQuizHost`, so the chain
// hands the session to the verdict-resolving surface (S04 resolving →
// S05 verdict) rather than falling through to the Plan list. Before
// TB-19 the chain dead-ended on the post-sign-in surface after a
// submit — that was bug-07.

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
    /// and the precedence chain fell through to the post-sign-in
    /// idle surface — the session dead-ended. The host polls the
    /// `verdicts` table until the engine's row lands, then renders
    /// `VerdictScreen`. Cleared when the user ends the session (→
    /// S00 Plan list, now the correct destination).
    @State private var postQuizHost: PostQuizHost?
    @State private var readOnlyView: ReadOnlyContext?
    /// TB-16 — set when the user taps a "Settings" affordance. tb-WF-5
    /// retired the legacy `LandingScreen.swift` entry point ("Account
    /// Settings" CTA); the Plan list surface doc carries no top-level
    /// Settings affordance, so until a follow-up wires a new entry
    /// (Plan list chrome menu or settings sheet from inside Setup),
    /// this state slot is reachable only when an external caller flips
    /// it true. Renders the S09 Settings surface; the route clears on
    /// Done or after a successful delete + re-bootstrap.
    @State private var showingSettings = false
    /// tb-WF-4 → tb-WF-5 — set when the user opens the Plan setup
    /// surface. While non-nil, the host renders the S01 SetupScreen
    /// in the carried lifecycle + group mode. Defaults to nil so a
    /// cold, signed-in launch lands on the Plan list per
    /// surfaces/00-plan-list.md.
    ///
    /// Mode-picking entry point: tb-WF-6 wires the Plan list's
    /// disambig sheet (FAB or empty-state hero pill → Solo / Group)
    /// to `.create` with the user's picked group mode. The TB-11
    /// read-only verdict re-invite still lands on `.create + .solo`
    /// via the legacy `openSoloSetup()` thin wrapper.
    @State private var setupContext: SetupContext?
    /// tb-WF-5 — Pending plans backing the S00 Plan list surface.
    /// Hydrated from PlansStore on appear and after a successful
    /// Plan write. Empty by default → the list renders the empty
    /// hero state.
    @State private var planListPending: [PlansStore.Plan] = []
    /// tb-WF-7 — Joined plans backing the S00 Plan list surface.
    /// Hydrated from `PlansStore.joinedPlansForList` on appear; the
    /// rows carry per-joiner resume signals (`lastAnsweredQuestionIndex`,
    /// `hasVoted`) so the Joined-card tap router can dispatch
    /// directly to QuizScreen/Waiting/Verdict without an extra
    /// round-trip per card. Empty by default — a fresh signed-in
    /// session that has not joined anyone's Plan stays empty.
    @State private var planListJoined: [PlansStore.JoinedPlanRow] = []
    /// tb-WF-8 — Decided-active rows backing the S00 Plan list's
    /// Decided section. Hydrated by `refreshPlanList` from the
    /// `plans_decided_for_user` RPC. Pre-sorted server-side
    /// (`verdict_fired_at DESC`); the iOS surface re-sorts defensively
    /// via the pure `sortedDecided` helper.
    @State private var planListDecided: [PlansStore.DecidedPlanRow] = []
    /// tb-WF-8 — Decided-expired rows backing the S00 Plan list's
    /// History section.
    @State private var planListHistory: [PlansStore.DecidedPlanRow] = []
    /// tb-WF-8 — when set, the host mounts the full VerdictScreen (with
    /// reroll affordance per surface §"Tap behavior") for a Created
    /// Decided-active Plan tapped from the list. Cleared when the user
    /// dismisses back to the Plan list.
    @State private var createdDecidedVerdict: ReadOnlyContext?
    /// tb-WF-8 — when set, the host mounts the read-only VerdictScreen
    /// for a Created History (decided-expired) tap. Same payload shape
    /// as `joinedReadOnly`; separate slot so the tap-target precedence
    /// is unambiguous.
    @State private var createdHistoryVerdict: ReadOnlyContext?
    /// tb-WF-7 — when set, the host owns a resume context for the
    /// joiner who tapped a Joined Pending card. The context carries
    /// the room id, the saved progress payload, and the destination
    /// step (Q1..Q5 or Waiting). The body branches into the live
    /// QuizScreen / WaitingScreen mounted against this context.
    @State private var joinedResume: JoinedResumeContext?
    /// tb-WF-7 — when set, the host renders the read-only Verdict
    /// for a Joined card whose Plan is decided. Different from
    /// `readOnlyView` (which is the late-joiner deep-link branch);
    /// the resume path is a tap on the Plan list, not a fresh
    /// invite-link landing.
    @State private var joinedReadOnly: ReadOnlyContext?
    /// TB-03 (v1.1) → tb-WF-5 → tb-WF-6 — set when the user picks a
    /// Solo/Group from the Plan list's disambig sheet AND iOS location
    /// permission is still `notDetermined`. While true, the host
    /// renders the S00b LocationPermissionScreen (pre-prime). On
    /// either CTA tap the flag clears and `setupContext` populates so
    /// S01 Setup takes over in the previously-disambig'd group mode.
    /// Permission outcomes are observed via the shared
    /// LocationCoordinator on `coordinators` — we don't gate the
    /// transition on grant vs deny because the picker on Setup handles
    /// both states.
    @State private var showingLocationPermission = false

    /// tb-WF-6 — carries the disambig'd group mode while the location
    /// pre-prime is on screen. The disambig sheet sets this when the
    /// user picks Solo or Group, then the pre-prime resumes Setup in
    /// the carried mode after either CTA tap. Nil when no pre-prime is
    /// pending, or in flows that skip the pre-prime (permission
    /// already determined). The disambig itself does not mount the
    /// pre-prime — the Plan list closes its sheet first and the
    /// pending group mode bridges the two.
    @State private var pendingDisambigGroupMode: SetupScreen.GroupMode?

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
                    // TB-16 — Settings sits inside the post-auth
                    // precedence chain. While it's up, the host
                    // suppresses every other surface; on Done or after
                    // a successful delete, control returns to the Plan
                    // list (which may itself defer to a deep-link or
                    // read-only landing if those arrived in the
                    // meantime). tb-WF-5: the legacy LandingScreen
                    // entry point is gone — see `@State showingSettings`
                    // doc for the entry-point follow-up.
                    SettingsScreen(
                        auth: coordinators.auth,
                        onDone: { showingSettings = false }
                    )
                } else if let quiz = activeQuiz {
                    QuizScreen(
                        coordinator: quiz.coordinator,
                        // tb-WF-2 — role + isSolo drive the Quiz chrome's
                        // Exit/Leave verb + alert copy. isInitiator
                        // comes from QuizContext (S01 sets it true for
                        // the creator path, false on the join-flow
                        // invitee path); isSolo follows the same
                        // SoloPath signal the post-Q5 router consults
                        // (`!invitedShared` for a single-member room).
                        role: quiz.isInitiator ? .initiator : .joiner,
                        isSolo: !quiz.invitedShared,
                        onClose: { activeQuiz = nil },
                        // tb-WF-2 → tb-WF-5 — Exit/Leave confirm. The
                        // host runs the member-drop write (and, on a
                        // solo initiator, the room-expire UPDATE) and
                        // routes to the post-exit destination (now S00
                        // Plan list — `QuizChromePostExitDestination.current`).
                        onExit: {
                            leaveQuizThenRoute(
                                quiz: quiz,
                                client: coordinators.client
                            )
                        },
                        // TB-19 — a successful Q5 submit no longer just
                        // clears the quiz (which dead-ended on the
                        // post-sign-in idle surface — bug-07). It hands
                        // the session to the post-Q5 router, which
                        // resolves the verdict and routes to S05.
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
                    // Plan list. `auth` + `promptStore` back the C-22
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
                    // re-invite CTA opens a fresh Setup surface so
                    // the user can start a brand-new Plan. The
                    // legacy timer + radius prefill (TB-11) is dropped
                    // by tb-WF-4 — Setup uses the distance slider, not
                    // the retired timer chip group, and lifts the
                    // radius onto a per-Plan column. Reading those
                    // values back into the Setup defaults would re-
                    // introduce the contract the workflow-overhaul
                    // phase deliberately retired.
                    VerdictScreen(
                        verdict: readOnly.payload.verdict,
                        mode: .readOnly,
                        isInitiator: false,
                        onAdvance: {
                            openSoloSetup()
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
                    // tb-WF-5 → tb-WF-6 — S00 Plan list is the default
                    // signed-in surface. The host populates
                    // `setupContext` when the Plan list invokes
                    // `onPickGroupMode` (after the user picks Solo or
                    // Group on the disambig sheet) or `onTapPlan`
                    // (existing pending Plan, re-opens in `.edit`
                    // mode).
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
                        // the Plan list and S01 on first launch.
                        // Either CTA clears the flag and flips into S01
                        // Setup; the primary CTA additionally fires
                        // `requestPermission()` so the iOS dialog
                        // appears on top of this surface and resolves
                        // before Setup mounts.
                        LocationPermissionScreen(
                            onShareLocation: {
                                coordinators.locationCoordinator.requestPermission()
                                let mode = pendingDisambigGroupMode ?? .solo
                                pendingDisambigGroupMode = nil
                                showingLocationPermission = false
                                openSetup(groupMode: mode)
                            },
                            onManualEntry: {
                                let mode = pendingDisambigGroupMode ?? .solo
                                pendingDisambigGroupMode = nil
                                showingLocationPermission = false
                                openSetup(groupMode: mode)
                            }
                        )
                    } else if let context = setupContext {
                        // tb-WF-4 — S01 SetupScreen is the canonical
                        // Plan creation + edit surface. Mode is carried
                        // by `SetupContext`. tb-WF-5 wires the
                        // create-from-Plan-list path to `.create +
                        // .solo`; tb-WF-6 will land the disambig sheet
                        // so Group gets its own entry point.
                        SetupScreen(
                            mode: context.mode,
                            groupMode: context.groupMode,
                            plansStore: coordinators.plansStore,
                            roomStore: coordinators.roomStore,
                            userID: userID,
                            locationCoordinator: coordinators.locationCoordinator,
                            editingPlan: context.editingPlan,
                            onLaunched: { roomID, _ in
                                // Primary CTA — the Plan was minted +
                                // the Room was minted linked to it.
                                // Hand the session off to the existing
                                // invite / quiz path. `invitedShared`
                                // mirrors the live group context — solo
                                // skips Waiting, group runs the share-
                                // sheet flow via `pendingSetupShare`.
                                self.setupContext = nil
                                let invitedShared = context.groupMode == .group
                                startQuiz(
                                    roomID: roomID,
                                    userID: userID,
                                    client: coordinators.client,
                                    invitedShared: invitedShared,
                                    isInitiator: true
                                )
                            },
                            onSaved: { _ in
                                // tb-WF-5 — Save lands the user back
                                // on the Plan list. Refresh the Pending
                                // rows so the newly-minted Plan shows up
                                // at the top of the section.
                                self.setupContext = nil
                                Task { await refreshPlanList(userID: userID) }
                            },
                            onDiscarded: {
                                self.setupContext = nil
                            }
                        )
                    } else if let resume = joinedResume {
                        // tb-WF-7 — Joined-card resume routing. The
                        // joiner tapped a Pending Plan they had not
                        // yet finished the quiz on; the host owns a
                        // `JoinedResumeContext` that mounts either
                        // QuizScreen (resumed at the saved step with
                        // prior answers hydrated) or WaitingScreen
                        // (joiner already wrote the votes row).
                        joinedResumeView(resume: resume, userID: userID, client: coordinators.client, auth: coordinators.auth, plansStore: coordinators.plansStore)
                    } else if let readOnly = joinedReadOnly {
                        // tb-WF-7 — Joined-card decided routing. Tap on
                        // a Decided-active / Decided-expired Joined
                        // card lands here. Read-only Verdict, no
                        // reroll (initiator-only per parent Q9). The
                        // "Done" callback returns the user to the Plan
                        // list rather than starting a fresh Plan (the
                        // re-invite CTA path is the late-joiner
                        // deep-link branch, owned by `readOnlyView`).
                        VerdictScreen(
                            verdict: readOnly.payload.verdict,
                            mode: .readOnly,
                            isInitiator: false,
                            onAdvance: {
                                joinedReadOnly = nil
                            }
                        )
                    } else if let context = createdDecidedVerdict {
                        // tb-WF-8 — Created Decided-active tap from the
                        // S00 Plan list lands here. Full VerdictScreen
                        // with the reroll affordance visible (the
                        // `.default` mode + `isInitiator=true` render
                        // the tertiary "Reroll" button per S05).
                        // `onAdvance` returns the user to the Plan list
                        // — the Setup re-invite path is the late-joiner
                        // deep-link branch only.
                        VerdictScreen(
                            verdict: context.payload.verdict,
                            mode: .default,
                            isInitiator: true,
                            onAdvance: {
                                createdDecidedVerdict = nil
                            }
                        )
                    } else if let context = createdHistoryVerdict {
                        // tb-WF-8 — Created History (decided-expired)
                        // tap. Read-only Verdict — the Plan is sealed;
                        // reroll is suppressed by `.readOnly` mode.
                        VerdictScreen(
                            verdict: context.payload.verdict,
                            mode: .readOnly,
                            isInitiator: false,
                            onAdvance: {
                                createdHistoryVerdict = nil
                            }
                        )
                    } else {
                        // tb-WF-5 → tb-WF-6 → tb-WF-7 — S00 Plan list.
                        // Hero pill (empty state) + C-26 FAB (populated
                        // state) both open the disambig sheet (unified
                        // entry per Q6); the sheet's pick callback
                        // routes to Setup in the chosen `.solo` /
                        // `.group` mode. Pending Created card tap
                        // re-opens Setup in `.edit` mode for the tapped
                        // Plan. tb-WF-7 — Joined card tap dispatches
                        // via `PlanListScreen.routeFor(joinedRow:)`,
                        // resuming the joiner into QuizScreen,
                        // WaitingScreen, or read-only Verdict per the
                        // §Q8 table.
                        //
                        // Disambig is presented inside `PlanListScreen`
                        // via SwiftUI's `.sheet` modifier. When the user
                        // picks Solo or Group, `onPickGroupMode` fires —
                        // and at that point we branch on iOS location
                        // permission: undetermined → carry the chosen
                        // mode in `pendingDisambigGroupMode` and route
                        // through S00b pre-prime; determined → open
                        // Setup in the chosen mode directly. The
                        // pre-prime resume preserves the user's
                        // disambig choice rather than forcing them
                        // back through the sheet.
                        PlanListScreen(
                            pending: planListPending,
                            joined: planListJoined,
                            decided: PlanListScreen.sortedDecided(planListDecided),
                            history: PlanListScreen.sortedHistory(planListHistory),
                            signedInUserID: userID,
                            onRequestDisambig: {},
                            onPickGroupMode: { mode in
                                if coordinators.locationCoordinator.authorization == .notDetermined {
                                    pendingDisambigGroupMode = mode
                                    showingLocationPermission = true
                                } else {
                                    openSetup(groupMode: mode)
                                }
                            },
                            onTapPlan: { plan in
                                openEditSetup(plan: plan)
                            },
                            onTapJoined: { row in
                                handleJoinedTap(
                                    row: row,
                                    userID: userID,
                                    coordinators: coordinators
                                )
                            },
                            onTapDecidedOrHistory: { row in
                                handleDecidedOrHistoryTap(
                                    row: row,
                                    userID: userID,
                                    coordinators: coordinators
                                )
                            },
                            // tb-WF-9 — Created card `Delete plan`
                            // confirmation. The host runs the delete
                            // journey via `PlanDeleteCoordinator` (look
                            // up linked room, flip it to expired so
                            // joiners see session-ended, delete the
                            // Plan) and refreshes the list.
                            onDeletePlan: { plan, status in
                                handleDeletePlan(
                                    plan: plan,
                                    status: status,
                                    userID: userID,
                                    coordinators: coordinators
                                )
                            },
                            // tb-WF-9 — Joined card `Leave plan`
                            // confirmation. The host reuses the
                            // existing `MemberLeaveStore.leave(...)`
                            // path from tb-WF-2 (drop the membership;
                            // keep the room alive for the remaining
                            // members) and refreshes the list.
                            onLeavePlan: { row in
                                handleLeavePlan(
                                    row: row,
                                    userID: userID,
                                    coordinators: coordinators
                                )
                            }
                        )
                        .task { await refreshPlanList(userID: userID) }
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
        let plansStore = PlansStore(client: client)
        let lateJoinerStore = LateJoinerStore(client: client)
        // TB-03 (v1.1) — one LocationCoordinator per session. Built
        // here so S00b pre-prime and S01 chip both observe the same
        // CLLocationManager. The coordinator reads the live
        // authorization status on init, so by the time the S00 Plan
        // list mounts we already know whether to short-circuit the
        // pre-prime on subsequent launches.
        let locationCoordinator = LocationCoordinator()
        // TB-02 v1.1 — restore cached session if any, otherwise leave
        // `.idle` so the S00a sign-in gate renders. Replaces the v1
        // `ensureSignedIn` call which would have minted an anonymous
        // session on a fresh install.
        await auth.restoreSessionIfPresent()
        self.coordinators = Coordinators(
            auth: auth,
            roomStore: roomStore,
            plansStore: plansStore,
            lateJoinerStore: lateJoinerStore,
            client: client,
            locationCoordinator: locationCoordinator
        )
    }

    /// tb-WF-5 → tb-WF-6 — open Setup in `.create` mode with the
    /// supplied group mode. Wraps the legacy `openSoloSetup()` call
    /// site (TB-11 read-only verdict re-invite, which always lands in
    /// Solo) and the new disambig pick site (which carries either
    /// Solo or Group). The disambig sheet (tb-WF-6) routes here with
    /// the user's chosen mode; the read-only re-invite path retains
    /// the previous Solo default.
    private func openSetup(groupMode: SetupScreen.GroupMode) {
        setupContext = SetupContext(mode: .create, groupMode: groupMode, editingPlan: nil)
    }

    /// Legacy thin wrapper — preserves the call site shape from
    /// tb-WF-5 (TB-11 read-only verdict `onAdvance` re-invite always
    /// lands on Solo Setup). The disambig sheet bypasses this by
    /// calling `openSetup(groupMode:)` directly with the user's pick.
    private func openSoloSetup() {
        openSetup(groupMode: .solo)
    }

    /// tb-WF-5 — open Setup in `.edit` mode for an existing pending
    /// Plan tapped on the Plan list. The carried `groupMode` is
    /// derived from the Plan's `scope` (`.solo` → `.solo`, `.duo` /
    /// `.group` → `.group`).
    private func openEditSetup(plan: PlansStore.Plan) {
        setupContext = SetupContext(
            mode: .edit,
            groupMode: SetupScreen.setupMode(for: plan.scope),
            editingPlan: plan
        )
    }

    /// tb-WF-5 / tb-WF-7 / tb-WF-8 — hydrate `planListPending` +
    /// `planListJoined` + `planListDecided` + `planListHistory` from
    /// PlansStore. Called on Plan list mount + after a successful
    /// `onSaved` write. A best-effort read per bucket: a transient
    /// fetch failure leaves the prior cached rows in place rather
    /// than wiping the list to empty.
    @MainActor
    private func refreshPlanList(userID: UUID) async {
        guard let coordinators else { return }
        async let pendingTask  = coordinators.plansStore.plansForList(userID: userID)
        async let joinedTask   = coordinators.plansStore.joinedPlansForList(userID: userID)
        async let decidedTask  = coordinators.plansStore.plansDecidedForList(userID: userID)
        async let historyTask  = coordinators.plansStore.plansHistoryForList(userID: userID)
        if let rows = try? await pendingTask {
            self.planListPending = rows
        }
        if let rows = try? await joinedTask {
            self.planListJoined = rows
        }
        if let rows = try? await decidedTask {
            self.planListDecided = rows
        }
        if let rows = try? await historyTask {
            self.planListHistory = rows
        }
    }

    /// tb-WF-8 — dispatch a Decided / History card tap. Each
    /// destination flips a different `@State` slot so the precedence
    /// chain renders the right surface on the next SwiftUI tick.
    ///
    /// Created (`role=owner`) cards route to either the full or
    /// read-only VerdictScreen depending on Decided-active vs
    /// Decided-expired. Joined (`role=joined`) cards route to the
    /// existing `joinedReadOnly` slot (read-only Verdict, no reroll).
    /// In both cases the verdict payload is fetched via the existing
    /// `LateJoinerStore.fetchReadOnlyPayload(roomID:)` — the API is
    /// shape-compatible (returns the same `Verdict` value the
    /// VerdictScreen consumes).
    ///
    /// sg-WF-6 — the destination is resolved against the Plan's
    /// *current* `status` fetched at tap time, not the snapshot status
    /// on the (possibly-stale) list row. A Plan whose reroll window
    /// closed since the list was last loaded must route to the
    /// read-only verdict screen (no reroll affordance), not the full
    /// one. See `openDecidedOrHistoryVerdict`.
    @MainActor
    private func handleDecidedOrHistoryTap(
        row: PlansStore.DecidedPlanRow,
        userID: UUID,
        coordinators: Coordinators
    ) {
        Task {
            await openDecidedOrHistoryVerdict(
                row: row,
                userID: userID,
                coordinators: coordinators
            )
        }
    }

    /// tb-WF-8 / sg-WF-6 — resolve the Plan's current lifecycle status,
    /// derive the §"Tap behavior" destination from it, look up the
    /// linked room id, fetch the read-only verdict payload, and flip
    /// the right `@State` slot for the precedence chain to mount the
    /// right surface. Best-effort — a transient failure leaves the
    /// user on the Plan list.
    ///
    /// sg-WF-6 — the routing status comes from
    /// `PlansStore.fetchPlanStatus` (a fresh single-row read), not the
    /// snapshot `row.plan.status`. If that re-fetch fails the snapshot
    /// status is used as a fallback; the server-side `apply_reroll`
    /// guard (ADR 0016 §3) is the authoritative backstop, so a stale
    /// fallback is at worst a cosmetically-stale full verdict screen
    /// whose reroll tap the server rejects.
    private func openDecidedOrHistoryVerdict(
        row: PlansStore.DecidedPlanRow,
        userID: UUID,
        coordinators: Coordinators
    ) async {
        let plan = row.plan
        // Re-resolve the Plan's status at tap time. fetchPlanStatus
        // is best-effort — fall back to the snapshot on a nil result.
        let liveStatus = await coordinators.plansStore
            .fetchPlanStatus(planID: plan.id) ?? plan.status
        let destination = PlanListScreen.tapRoute(
            role: row.role,
            status: liveStatus
        )
        await openDecidedOrHistoryVerdict(
            plan: plan,
            destination: destination,
            userID: userID,
            coordinators: coordinators
        )
    }

    /// tb-WF-8 — look up the room id linked to a Decided / History
    /// Plan, fetch the read-only verdict payload, and flip the right
    /// `@State` slot for the precedence chain to mount the right
    /// surface. Best-effort — a transient failure leaves the user on
    /// the Plan list.
    private func openDecidedOrHistoryVerdict(
        plan: PlansStore.Plan,
        destination: DecidedHistoryTapDestination,
        userID: UUID,
        coordinators: Coordinators
    ) async {
        // Both Decided and History plans have a non-null `plan_id`
        // backing room — the verdict landed against that room. One
        // round-trip resolves the room id via the role-agnostic
        // `roomIDForPlan` helper (the tb-WF-7 `roomIDForJoinedPlan`
        // joins through `members.role <> 'owner'`, which excludes
        // Created plans where the caller IS the owner).
        guard let roomID = await coordinators.plansStore.roomIDForPlan(
            planID: plan.id
        ) else {
            return
        }
        do {
            let payload = try await coordinators.lateJoinerStore
                .fetchReadOnlyPayload(roomID: roomID)
            let context = ReadOnlyContext(roomID: roomID, payload: payload)
            switch destination {
            case .createdVerdictFull:
                self.createdDecidedVerdict = context
            case .createdVerdictReadOnly:
                self.createdHistoryVerdict = context
            case .joinedVerdictReadOnlyActive,
                 .joinedVerdictReadOnlyHistory:
                // Joined cards route through the existing
                // `joinedReadOnly` slot — same view shape as the
                // tb-WF-7 Joined-card decided routing.
                self.joinedReadOnly = context
            }
        } catch {
            // Best-effort — leave the user on the Plan list. They can
            // re-tap once the network recovers.
        }
    }

    /// tb-WF-7 — dispatch a Joined-card tap via the pure `routeFor`
    /// helper. Each destination flips a different `@State` slot so
    /// the precedence chain renders the right surface on the next
    /// SwiftUI tick.
    ///
    /// `quizAtStart` + `quizAtQuestion` build a `JoinedResumeContext`
    /// carrying the saved progress payload + the destination step.
    /// `waiting` builds the same context with a `.waiting` step (the
    /// joiner already wrote the votes row; we mount Waiting directly).
    /// `verdictReadOnly*` builds a `ReadOnlyContext` from a fresh
    /// `fetchReadOnlyPayload` round-trip — the Plan is decided so the
    /// payload is sealed and the late-joiner store's payload shape is
    /// exactly what the read-only Verdict consumes.
    @MainActor
    private func handleJoinedTap(
        row: PlansStore.JoinedPlanRow,
        userID: UUID,
        coordinators: Coordinators
    ) {
        let destination = PlanListScreen.routeFor(joinedRow: row)
        switch destination {
        case .quizAtStart, .quizAtQuestion, .waiting:
            // Look up the room id linked to this Plan, hydrate the
            // saved progress payload, and mount the resume context.
            // The lookup is best-effort: a transient failure leaves
            // the user on the Plan list rather than dropping them
            // into a stale resume.
            Task {
                await openJoinedResume(
                    row: row,
                    userID: userID,
                    destination: destination,
                    coordinators: coordinators
                )
            }
        case .verdictReadOnlyActive, .verdictReadOnlyHistory:
            Task {
                await openJoinedReadOnly(
                    plan: row.plan,
                    userID: userID,
                    coordinators: coordinators
                )
            }
        }
    }

    /// tb-WF-7 — look up the room linked to a Joined Plan, then read
    /// the joiner's saved `members.quiz_progress` so the resumed
    /// QuizCoordinator can hydrate its step + answers. Mounts the
    /// `JoinedResumeContext` once both reads return.
    private func openJoinedResume(
        row: PlansStore.JoinedPlanRow,
        userID: UUID,
        destination: JoinedTapDestination,
        coordinators: Coordinators
    ) async {
        guard let resume = await coordinators.plansStore.fetchJoinedResumePayload(
            planID: row.plan.id,
            userID: userID
        ) else {
            return  // best-effort — leave the user on the Plan list
        }
        let step: JoinedResumeContext.Step
        switch destination {
        case .waiting:
            step = .waiting
        case .quizAtStart:
            step = .quizAtQuestion(index: 0)
        case .quizAtQuestion(let index):
            step = .quizAtQuestion(index: index)
        case .verdictReadOnlyActive, .verdictReadOnlyHistory:
            return  // unreachable — guarded above
        }
        self.joinedResume = JoinedResumeContext(
            plan: row.plan,
            roomID: resume.roomID,
            progress: resume.progress,
            step: step
        )
    }

    /// tb-WF-7 — fetch the read-only Verdict payload for a Joined
    /// Plan that is decided (active or expired). Reuses the
    /// `LateJoinerStore.fetchReadOnlyPayload` shape so the
    /// VerdictScreen `.readOnly` mode renders the same body the
    /// deep-link path uses.
    private func openJoinedReadOnly(
        plan: PlansStore.Plan,
        userID: UUID,
        coordinators: Coordinators
    ) async {
        // The Joined-Plan read-only flow needs the room id behind
        // the Plan; the `joined_plans_for_user` RPC doesn't carry
        // it inline, so we resolve it here. For Decided plans the
        // room is by definition non-null on `plan_id`, so the
        // lookup is one round-trip.
        guard let roomID = await coordinators.plansStore.roomIDForJoinedPlan(
            planID: plan.id,
            userID: userID
        ) else {
            return
        }
        do {
            let payload = try await coordinators.lateJoinerStore
                .fetchReadOnlyPayload(roomID: roomID)
            self.joinedReadOnly = ReadOnlyContext(roomID: roomID, payload: payload)
        } catch {
            // Best-effort — leave the user on the Plan list. They
            // can re-tap once the network recovers.
        }
    }

    /// tb-WF-9 — handle a Created card `Delete plan` confirmation.
    /// Runs the delete journey via `PlanDeleteCoordinator` (look up the
    /// linked room, flip it to expired so any joiner mid-quiz observes
    /// the session-ended broadcast via the existing realtime channel,
    /// delete the Plan row) and refreshes the Plan list to drop the
    /// row from the surface.
    ///
    /// Authorization is server-enforced via the `plans_delete_creator`
    /// + `rooms_update_creator` RLS policies. A `403` here would
    /// surface as a thrown error from the coordinator; the catch
    /// branch refreshes the list anyway so the surface reconciles.
    @MainActor
    private func handleDeletePlan(
        plan: PlansStore.Plan,
        status: PlansStore.LifecycleState,
        userID: UUID,
        coordinators: Coordinators
    ) {
        let coordinator = PlanDeleteCoordinator.live(
            plansStore: coordinators.plansStore,
            client: coordinators.client
        )
        Task {
            do {
                try await coordinator.deletePlan(planID: plan.id, status: status)
            } catch {
                // Best-effort — the Plan list refresh below will
                // reconcile. A persistent failure (RLS deny) leaves
                // the Plan visible; the user can retry.
            }
            await refreshPlanList(userID: userID)
        }
    }

    /// tb-WF-9 — handle a Joined card `Leave plan` confirmation.
    /// Reuses the existing `MemberLeaveStore.leave(...)` semantic from
    /// tb-WF-2 — the same path the Quiz chrome's `Leave` uses to drop
    /// the joiner's `members` row. Per `Plan exit` in CONTEXT.md the
    /// room stays alive for the remaining members; the cron sweeper
    /// expires it if the rest of the group never finishes the quiz.
    @MainActor
    private func handleLeavePlan(
        row: PlansStore.JoinedPlanRow,
        userID: UUID,
        coordinators: Coordinators
    ) {
        Task {
            guard let roomID = await coordinators.plansStore.roomIDForJoinedPlan(
                planID: row.plan.id,
                userID: userID
            ) else {
                // No room linked — the joiner cannot leave a room that
                // does not exist. Refresh anyway to reconcile.
                await refreshPlanList(userID: userID)
                return
            }
            let store = MemberLeaveStore.live(client: coordinators.client)
            do {
                // Joiner — never the room creator, never solo. The
                // store hard-suppresses the rooms write on the joiner
                // branch regardless of `isSolo`, so passing the
                // canonical values here is a no-op safety belt.
                try await store.leave(
                    roomID: roomID,
                    userID: userID,
                    role: .joiner,
                    isSolo: false
                )
            } catch {
                // Best-effort — the list refresh below will reconcile.
            }
            await refreshPlanList(userID: userID)
        }
    }

    /// tb-WF-7 — render the joined-resume context. Mounts QuizScreen
    /// (resumed at the saved step with hydrated answers) for the
    /// quiz cases, or WaitingScreen for the finished-quiz case.
    @ViewBuilder
    private func joinedResumeView(
        resume: JoinedResumeContext,
        userID: UUID,
        client: SupabaseClient,
        auth: AuthCoordinator,
        plansStore: PlansStore
    ) -> some View {
        switch resume.step {
        case .quizAtQuestion:
            JoinedResumeQuizHost(
                resume: resume,
                userID: userID,
                client: client,
                plansStore: plansStore,
                onClose: { joinedResume = nil },
                onSubmitted: {
                    // Q5 submit on the resume path hands off to the
                    // standard post-Q5 router so the verdict
                    // surfaces the same way as the live-join path.
                    let quiz = QuizContext(
                        coordinator: $0,
                        roomID: resume.roomID,
                        userID: userID,
                        isInitiator: false,
                        invitedShared: true
                    )
                    enterPostQuiz(quiz: quiz, client: client)
                    self.joinedResume = nil
                }
            )
        case .waiting:
            // The joiner's votes row is already in. Mount
            // PostQuizHostScreen directly so it polls the verdict
            // and renders S04 Waiting until the verdict lands.
            let context = PostQuizSessionContext(
                roomID: resume.roomID,
                userID: userID,
                isInitiator: false,
                invitedShared: true
            )
            let verdictStore = VerdictStore(client: client)
            let snapshotStore = SessionSnapshotStore(client: client)
            let host = PostQuizHost(
                context: context,
                fetchVerdict: { rid in
                    try await verdictStore.fetchVerdict(roomID: rid)
                },
                fetchSnapshot: { rid in
                    try await snapshotStore.fetchSnapshot(roomID: rid)
                }
            )
            PostQuizHostScreen(
                host: host,
                auth: auth,
                promptStore: AuthPromptStore(client: client),
                onEndSession: {
                    host.teardown()
                    joinedResume = nil
                }
            )
        }
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
                // bug-14 — a failed `member_fetches` write is no longer
                // swallowed: emit a `member_fetch_persist_failed`
                // telemetry event so a dropped persist is visible (the
                // verdict could otherwise fire against a pool missing
                // this member's fetch with nothing recording why).
                memberFetchFailureSink: Self.makeMemberFetchFailureSink(
                    client: client,
                    roomID: roomID,
                    userID: userID
                ),
                writer: QuizSupabaseWriter.make(client: client),
                // tb-WF-7 — persist the joiner's in-flight quiz answers
                // on each Q1..Q4 -> next-Q advance so a backgrounded
                // session can be resumed via the Joined card on S00.
                // The initiator path benefits too — a re-tap on a
                // self-created Plan keeps the user's draft answers if
                // the join flow ever turns into a multi-device path.
                progressWriter: coordinators.plansStore.memberProgressWriter(roomID: roomID)
            )
            // Flip into the quiz and tear down S01 Setup routing
            // state in the same scope so SwiftUI batches the updates
            // and the precedence chain never momentarily falls through
            // to S00 Plan list between SetupScreen and QuizScreen.
            self.setupContext = nil
            self.activeQuiz = QuizContext(
                coordinator: assembled.coordinator,
                roomID: roomID,
                userID: userID,
                isInitiator: isInitiator,
                invitedShared: invitedShared
            )
            // Clear the deep link so closing the quiz returns to S00
            // Plan list rather than re-routing back into Join.
            self.deepLink = nil
        }
    }

    /// bug-14 — build the `MemberFetchPersistFailureSink` the quiz
    /// coordinator invokes when a `member_fetches` write fails.
    ///
    /// Before bug-14 a failed `member_fetches` persist was caught and
    /// dropped, so a dropped persist was invisible — and the verdict
    /// could fire against an `options` union missing this member's
    /// fetch with nothing recording why. This sink emits a
    /// `member_fetch_persist_failed` row into the `events` table
    /// (`SupabaseTelemetrySink`, the documented telemetry seam per ADR
    /// 0005) so the failure is observable in the Supabase telemetry the
    /// runtime diagnosis relies on.
    ///
    /// `member_fetch_persist_failed` is outside the documented
    /// `TelemetryWriter` event vocabulary; it is emitted through the
    /// raw sink rather than a typed helper, which keeps the new event
    /// confined to this failure path until it earns a first-class
    /// helper. The emission is best-effort — a telemetry write that
    /// itself fails is dropped, exactly as the other client-side
    /// telemetry emissions are.
    private static func makeMemberFetchFailureSink(
        client: SupabaseClient,
        roomID: UUID,
        userID: UUID
    ) -> MemberFetchPersistFailureSink {
        let sink = SupabaseTelemetrySink(client: client)
        return { error in
            let row = TelemetryRow(
                eventType: "member_fetch_persist_failed",
                roomID: roomID,
                userID: userID,
                properties: ["error": .string(String(describing: error))]
            )
            Task { try? await sink.write(row) }
        }
    }

    /// tb-WF-2 → tb-WF-5 — confirm-Exit handler. Drops the user's
    /// `members` row from the active room (and, on a solo initiator,
    /// also expires the room) via `MemberLeaveStore`, then clears
    /// the `activeQuiz` route. The precedence chain hands an idle,
    /// signed-in session back to the S00 Plan list — the post-exit
    /// destination on `QuizChromePostExitDestination.current`.
    ///
    /// Why the route flip is synchronous: the user has tapped Exit
    /// and explicitly confirmed; they expect to land on the Plan
    /// list immediately, not after the round-trip resolves. The
    /// member-drop write is fire-and-forget — a failed DELETE leaves
    /// a stuck membership row that the verdict cron's no-signal
    /// sweeper expires anyway (and that the user can re-trigger
    /// from their next session). Landing on the Plan list even on a
    /// failed write is the boundary contract from the acceptance
    /// criteria ("post-confirm exit always lands the user on the
    /// same destination — no flaky path that dead-ends").
    ///
    /// Failure shape: the Task swallows thrown errors and emits
    /// telemetry. The user is never stranded on the quiz waiting for
    /// a network round-trip to resolve.
    private func leaveQuizThenRoute(
        quiz: QuizContext,
        client: SupabaseClient
    ) {
        let store = MemberLeaveStore.live(client: client)
        let role: MemberLeaveRole = quiz.isInitiator ? .initiator : .joiner
        let isSolo = !quiz.invitedShared
        Task {
            do {
                try await store.leave(
                    roomID: quiz.roomID,
                    userID: quiz.userID,
                    role: role,
                    isSolo: isSolo
                )
            } catch {
                // Best-effort: a failed member-drop leaves a stuck
                // membership row the verdict cron's no-signal sweeper
                // expires anyway. The post-exit route still fires
                // (`activeQuiz = nil` already ran below) so the
                // user is never stranded on the quiz.
            }
        }
        // Route flip fires synchronously regardless of the write — see
        // method doc-comment. tb-WF-5 flipped this from S00 Landing
        // to the Plan list surface; the destination is one-source-of-
        // truth on `QuizChromePostExitDestination.current`.
        switch QuizChromePostExitDestination.current {
        case .planList:
            activeQuiz = nil
            // Clear any sticky surface that would shadow the Plan
            // list (a half-open SetupScreen, a deep-link / read-only
            // landing).
            setupContext = nil
            deepLink = nil
            readOnlyView = nil
            // Refresh the Plan list rows so a Plan minted in the
            // session shows up the moment the user lands back here.
            if let userID = coordinators?.auth.state.userID {
                Task { await refreshPlanList(userID: userID) }
            }
        }
    }

    /// TB-19 — hand the just-submitted session to the post-Q5 router.
    /// Called from `QuizScreen`'s `onSubmitted` callback. Builds a
    /// `PostQuizHost` whose verdict poll is backed by a live
    /// `VerdictStore`, then swaps the precedence chain from the quiz
    /// onto the host in a single scope so SwiftUI batches the update
    /// and the chain never momentarily falls through to S00 Plan list.
    ///
    /// Closes bug-07: the prior `onSubmitted` handler just cleared
    /// `activeQuiz`, and with nothing else set the precedence chain
    /// dead-ended on the post-sign-in idle surface. Now the host owns
    /// the session through to the verdict.
    ///
    /// bug-12 — idempotent per room. A successful Q5 submit delivers
    /// `onSubmitted` twice (the Q5 CTA path and the `.submitted` step's
    /// `.task`). Without this guard the second call replaced the live,
    /// polling host with a fresh one whose SwiftUI `.task` never re-ran
    /// — the verdict resolved on the orphaned first host and the
    /// resolving spinner span forever. `PostQuizRouter.shouldEnterPostQuiz`
    /// returns `false` for a duplicate entry into a room already held in
    /// `postQuizHost`; a genuinely new room still routes.
    private func enterPostQuiz(quiz: QuizContext, client: SupabaseClient) {
        guard PostQuizRouter.shouldEnterPostQuiz(
            currentRoomID: postQuizHost?.context.roomID,
            incomingRoomID: quiz.roomID
        ) else {
            // Duplicate `onSubmitted` for the room already routed —
            // ignore it. Replacing the live host is the bug-12 defect.
            return
        }
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
        /// tb-WF-4 — durable Plan store. Backs the SetupScreen Plan
        /// create + edit writes. PlansStore is `@Observable` so future
        /// list-surface consumers (tb-WF-5) can share the same instance.
        let plansStore: PlansStore
        let lateJoinerStore: LateJoinerStore
        let client: SupabaseClient
        /// TB-03 (v1.1) — shared LocationCoordinator instance. The
        /// S00b pre-prime CTA fires `requestPermission()` on this
        /// instance; the SetupScreen LocationPickerChip + LocationPickerSheet
        /// observe the same instance so the permission state and the
        /// resolved place flow from the pre-prime into the setup
        /// surface without re-instantiating CLLocationManager.
        let locationCoordinator: LocationCoordinator
    }

    /// tb-WF-4 → tb-WF-5 — carries the lifecycle + group mode (and the
    /// editing Plan, in edit mode) the SetupScreen needs to mount. The
    /// Plan list's hero pill + temp `+` glyph both wire this to
    /// `.create + .solo`; a Pending card tap wires it to `.edit +
    /// <Plan.scope-derived mode>`. tb-WF-6 will wire the disambig
    /// sheet's Group route.
    private struct SetupContext: Equatable {
        let mode: SetupScreen.Mode
        let groupMode: SetupScreen.GroupMode
        let editingPlan: PlansStore.Plan?
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

    /// tb-WF-7 — context for a Joined-card resume tap. Carries the
    /// Plan + the linked room id + the saved progress payload + the
    /// destination step (which question to land on, or `.waiting` for
    /// a joiner who already voted). The body mounts QuizScreen or
    /// WaitingScreen against this context.
    fileprivate struct JoinedResumeContext: Equatable {
        let plan: PlansStore.Plan
        let roomID: UUID
        let progress: QuizProgress
        let step: Step

        enum Step: Equatable {
            /// Resume into QuizScreen at the given 0..5 question
            /// index. 0 means Q1 (joiner never started); 1..4 means
            /// the next-unanswered question; 5 means Q5 (the joiner
            /// reached Q5 but did not submit).
            case quizAtQuestion(index: Int)
            /// Resume into WaitingScreen — the joiner already wrote
            /// a votes row and is waiting for the verdict to fire.
            case waiting
        }
    }
}

// MARK: - tb-WF-7 JoinedResumeQuizHost

/// tb-WF-7 — the host SwiftUI view that owns the QuizCoordinator
/// for a Joined-card resume tap. Mounts a fresh coordinator hydrated
/// from the saved `members.quiz_progress` payload and pinned to the
/// resumed step. The coordinator does NOT carry a `candidateFetch`
/// — the Q5 candidate set comes from the live `QuizSessionAssembler`
/// path; rebuilding the assembler stack inside a resume is out of
/// scope for this slice (the assembler reads location + session
/// params from the room, which we hand it once the resume mount
/// completes). For now the resume into Q5 lands the user on Q5
/// with prior answers preserved; the per-member Foursquare fetch
/// fires anew on the next Q5 render.
///
/// Why a dedicated host rather than reusing the existing QuizScreen
/// path: the live path's `startQuiz` runs through `QuizSessionAssembler`,
/// which assumes a fresh session and emits a coordinator pinned to
/// Q1. Reusing it would require a parallel "resume" code path in the
/// assembler — that's a bigger refactor than this slice can absorb.
/// The resume host wraps QuizScreen with the resumed coordinator;
/// production behavior on Q5 submit is identical (the same Q5 vote
/// row + the same verdict-fire path).
@MainActor
private struct JoinedResumeQuizHost: View {
    let resume: RootView.JoinedResumeContext
    let userID: UUID
    let client: SupabaseClient
    let plansStore: PlansStore
    let onClose: () -> Void
    let onSubmitted: (QuizCoordinator) -> Void

    @State private var coordinator: QuizCoordinator?

    var body: some View {
        Group {
            if let coordinator {
                QuizScreen(
                    coordinator: coordinator,
                    role: .joiner,
                    isSolo: false,
                    onClose: onClose,
                    onExit: onClose,
                    onSubmitted: { onSubmitted(coordinator) }
                )
            } else {
                // Mount one-shot: build the QuizCoordinator from the
                // resume payload. `applyInitialProgress` consumes
                // the progress in its init and lands the step.
                ProgressView()
                    .tint(GTIColor.TextOnGradient.primary)
                    .onAppear { mount() }
            }
        }
    }

    private func mount() {
        // Build a fresh coordinator on the legacy `candidates:` init —
        // the live Foursquare fetch path is owned by the assembler
        // and a resume re-runs the fetch on the next Q5 advance. The
        // progress payload hydrates Q1..Q4 answers AND lands the step
        // at the right question (§Q8 row-mapping per `QuizCoordinator.
        // applyInitialProgress`).
        let writer = QuizSupabaseWriter.make(client: client)
        let progressWriter = plansStore.memberProgressWriter(roomID: resume.roomID)
        self.coordinator = QuizCoordinator(
            roomID: resume.roomID,
            userID: userID,
            candidates: [],
            sessionParameters: resume.plan.sessionParameters ?? .default,
            writer: writer,
            initialProgress: resume.progress,
            progressWriter: progressWriter
        )
    }
}
