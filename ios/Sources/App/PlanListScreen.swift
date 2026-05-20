// GetToIt — S00 · Plan list (tb-WF-5 → tb-WF-6 → tb-WF-7 → tb-WF-8, workflow-overhaul).
//
// The new app entry surface. Replaces the retired S00 Landing as the
// post-sign-in landing on iOS. A sectioned list of the user's Plans,
// in Reminders-app spirit, with the C-26 FAB on populated state and
// per-card three-dot menus that land later (tb-WF-9).
//
// Surface spec: `design-system/surfaces/00-plan-list.md`.
// JSX reference: `design-system/code/screens/ScreenPlanList.jsx`.
// Parent decisions doc: [[gti-vault/50_product/workflow-overhaul-plan-list]].
//
// Slice history:
//   * tb-WF-5: foundation Plan list shell + 1-line Pending cards +
//     temp top-trailing `+` chrome glyph.
//   * tb-WF-6: C-26 FAB replaces the temp `+`; Group creation path
//     via the `PlanDisambigSheet` (both the FAB and the empty-state
//     hero pill open the same sheet).
//   * tb-WF-7: Joiner journey end-to-end — JOINED eyebrow chip on
//     Joined cards (in `GTIColor.sun`), `routeFor(joinedRow:)`
//     resume-from-state helper per §Q8, `onTapJoined` callback so
//     the host can dispatch to QuizScreen / WaitingScreen /
//     read-only Verdict.
//   * tb-WF-8: Decided + History sections light up end-to-end.
//     2-line cards (Plan name + verdict place name), History
//     collapsible with per-user UserDefaults persistence,
//     `DecidedHistoryTapDestination` router, `onTapDecidedOrHistory`
//     callback so the host mounts the right VerdictScreen variant
//     (full vs read-only).
//
// In the current state:
//   * Three sections render: Pending, Decided, History. Each section
//     hides when empty (surface §"Surface structure (locked Q1)").
//   * Pending — 1-line cards. Created tap → Setup `.edit`; Joined tap
//     → §Q8 router → QuizScreen / Waiting / read-only Verdict.
//   * Decided — 2-line cards (Plan name + verdict place name).
//     Created tap → full VerdictScreen; Joined tap → read-only Verdict.
//   * History — same 2-line cards; collapsible (iOS-native disclosure
//     pattern, default expanded on first viewing, persisted per user
//     across launches within a session via UserDefaults).
//   * No three-dot menu yet (tb-WF-9).
//   * Empty state: centered hero pill `Create your first plan` — the
//     only create affordance when ALL four buckets are empty
//     (Pending Created + Pending Joined + Decided + History). The
//     pill opens the disambig sheet (unified entry, per Q6) — same
//     path as the FAB.
//   * Populated state: C-26 FloatingActionButton on the bottom-right
//     edge. Both the FAB and the empty-state hero pill open the same
//     disambig sheet (`PlanDisambigSheet`); the sheet's pick callback
//     routes to `SetupScreen(mode: .solo)` or `SetupScreen(mode: .group)`.
//
// All color / type / spacing / radii come from `GTITokens.swift` per
// repo CLAUDE.md — no inline hex / px / easing.

import SwiftUI

/// tb-WF-8 — the destination a Decided / History card tap dispatches
/// into. Created cards land on full or read-only Verdict; Joined
/// cards always land on read-only Verdict (reroll is initiator-only
/// per parent Q9 of the surface decisions doc).
///
/// The router is a pure value the host consumes — `PlanListScreen`
/// stays Supabase-free; the host (RootView) mounts the right view.
public enum DecidedHistoryTapDestination: Equatable, Sendable {
    /// Created Decided-active Plan → full VerdictScreen with the
    /// reroll affordance.
    case createdVerdictFull
    /// Created Decided-expired Plan (History) → read-only Verdict.
    case createdVerdictReadOnly
    /// Joined Decided-active Plan → read-only VerdictScreen
    /// (reroll suppressed — initiator-only per parent Q9).
    case joinedVerdictReadOnlyActive
    /// Joined Decided-expired Plan (History) → read-only Verdict.
    case joinedVerdictReadOnlyHistory
}

/// tb-WF-7 — the §Q8 resume-from-state destinations a Joined-card
/// tap dispatches into. The host (RootView) listens for these via
/// the `onTapJoined` closure and mounts the corresponding screen.
///
/// The router does NOT navigate itself — it is a pure value the
/// host consumes. That keeps `PlanListScreen` view-free of
/// Supabase calls (the resume hydration of `QuizCoordinator`
/// lives in `RootView`).
public enum JoinedTapDestination: Equatable, Sendable {
    /// Pending Plan + joiner hasn't started the quiz → QuizScreen
    /// from Q1.
    case quizAtStart
    /// Pending Plan + joiner is mid-quiz → QuizScreen at the
    /// last-answered question. `index` is the 1-based 1..5 index;
    /// the host maps it onto `QuizCoordinator.Step.qN`.
    case quizAtQuestion(index: Int)
    /// Pending Plan + joiner already wrote the votes row →
    /// WaitingScreen.
    case waiting
    /// Decided-active Plan → read-only VerdictScreen (no reroll —
    /// initiator-only per parent Q9).
    case verdictReadOnlyActive
    /// Decided-expired Plan → read-only VerdictScreen history.
    case verdictReadOnlyHistory
}

/// tb-WF-8 — small `@Observable` holder for the History section's
/// expand / collapse state. Lives in a class so the unit-test path can
/// mutate it on a struct PlanListScreen value without needing a
/// `UIHostingController` mount; SwiftUI tracks the class reference and
/// re-renders the View on every change.
@MainActor
@Observable
final class HistoryCollapseState {
    /// True when the History section is expanded. Defaults to `true`
    /// per surface §"Surface structure (locked Q1)" — `expanded on
    /// first viewing`.
    var isOpen: Bool = true
}

@MainActor
public struct PlanListScreen: View {

    // MARK: - locked copy + glyphs

    /// Empty-state eyebrow. Telegraphs "label, not headline." NEVER
    /// `"Welcome back"` here — the populated state owns that label;
    /// the empty state replaces it with the moment-specific phrase.
    public static let emptyHeroEyebrow: String = "No plans yet"

    /// Empty-state body copy. Locked verbatim from the JSX — Sunset
    /// Pop voice (`warm friend`), em-dash sentence shape, sentence
    /// case. NEVER paraphrase.
    public static let emptyHeroBody: String =
        "This is where your Plans live — solo nights, group dinners, anything you'd rather decide once and forget."

    /// Empty-state hero pill label. Verb-first, sentence-case in
    /// source — the pill renders uppercase via `cta` token. Locked
    /// per surface doc §"Copy register" (parent Q3). NEVER
    /// `"Get started"` / `"Begin"` / `"New plan"`.
    public static let emptyHeroPillLabel: String = "Create your first plan"

    /// Populated-state top eyebrow. NEVER `"Your plans"` (label-as-
    /// title is procedural). Hidden on the empty-state hero — the
    /// empty-state eyebrow `"No plans yet"` carries the moment.
    public static let populatedEyebrow: String = "Welcome back"

    /// Pending section header label. Title-case, single word, eyebrow
    /// token. NEVER `"In progress"`.
    public static let pendingSectionLabel: String = "Pending"

    /// tb-WF-8 — Decided section header label. Title-case, single word,
    /// eyebrow token. NEVER `"Resolved"`, never `"Done"`.
    public static let decidedSectionLabel: String = "Decided"

    /// tb-WF-8 — History section header label. NEVER `"Past"`, never
    /// `"Archive"`.
    public static let historySectionLabel: String = "History"

    /// tb-WF-8 — namespace prefix for the per-user History-open
    /// `@AppStorage` key. The full key appends the lowercase UUID of
    /// the signed-in user so two users sharing a device do not see
    /// each other's collapsed state.
    public static let historyOpenStorageKeyPrefix: String = "planList.historyOpen."

    /// tb-WF-8 — compute the `@AppStorage` key carrying the History
    /// section's expand / collapse state for a given signed-in user.
    /// Keyed on the user's UUID so a sign-out + sign-in-as-someone-
    /// else resets the state cleanly.
    public static func historyOpenStorageKey(for userID: UUID) -> String {
        return historyOpenStorageKeyPrefix + userID.uuidString.lowercased()
    }

    // (tb-WF-6) The `tempCreateGlyph` constant from tb-WF-5 has been
    // retired. The populated-state create affordance is now the C-26
    // FloatingActionButton; see `FloatingActionButton.swift`.

    /// tb-WF-7 — the JOINED eyebrow chip label. UPPERCASE in source so
    /// the iOS render does NOT need to `.uppercased()` it — the chip
    /// is the label, not a heading; the eyebrow token's
    /// `letterSpacing` carries the visual lift. NEVER `"Invited"`,
    /// `"From <name>"`, or `"You joined"` (surface §"Copy register",
    /// parent Q3).
    public static let joinedChipLabel: String = "JOINED"

    // MARK: - pure helpers

    /// Empty-state detection (pre-tb-WF-8 shape). Retained for the
    /// existing call sites + tests that only know about Pending and
    /// Joined-Pending rows. tb-WF-8 widens the contract to include
    /// Decided + History rows — the live host calls the four-bucket
    /// overload below.
    public static func isEmpty(
        pending: [PlansStore.Plan],
        joined: [PlansStore.JoinedPlanRow]
    ) -> Bool {
        isEmpty(pending: pending, joined: joined, decided: [], history: [])
    }

    /// tb-WF-8 — widened empty-state detection. The Plan list is empty
    /// iff ALL four buckets are empty. A user with only Decided rows
    /// (mid-lifecycle) or only History rows (post-lifecycle) still has
    /// Plans on their list and must see the populated state — the
    /// empty hero is for first-launch / all-Plans-deleted only.
    public static func isEmpty(
        pending: [PlansStore.Plan],
        joined: [PlansStore.JoinedPlanRow],
        decided: [PlansStore.DecidedPlanRow],
        history: [PlansStore.DecidedPlanRow]
    ) -> Bool {
        pending.isEmpty
            && joined.isEmpty
            && decided.isEmpty
            && history.isEmpty
    }

    /// tb-WF-7 — pure helper that derives the §Q8 destination from a
    /// `JoinedPlanRow`. Exposed as a static so the host can reuse the
    /// router decision without re-rendering the view; the
    /// `onTapJoined` callback hands the destination through.
    ///
    /// Precedence:
    ///   * Decided-active → `verdictReadOnlyActive` (regardless of
    ///     whether the joiner voted — see issue body "Decided-active
    ///     Plan where joiner never voted" edge case).
    ///   * Decided-expired → `verdictReadOnlyHistory`.
    ///   * Pending + `hasVoted` → `waiting` (votes row is the ground
    ///     truth for "past the quiz" — beats a stale progress index).
    ///   * Pending + `lastAnsweredQuestionIndex <= 0` → `quizAtStart`.
    ///   * Pending + otherwise → `quizAtQuestion(index: clamped)`.
    public static func routeFor(joinedRow: PlansStore.JoinedPlanRow) -> JoinedTapDestination {
        switch joinedRow.plan.status {
        case .decidedActive:
            return .verdictReadOnlyActive
        case .decidedExpired:
            return .verdictReadOnlyHistory
        case .pending:
            if joinedRow.hasVoted { return .waiting }
            let clamped = max(0, min(5, joinedRow.lastAnsweredQuestionIndex))
            if clamped <= 0 { return .quizAtStart }
            return .quizAtQuestion(index: clamped)
        }
    }

    /// Pending section sort — `created_at DESC` per surface §"Ordering
    /// within sections" (Q7). The store query writes the same order
    /// server-side; a defensive client sort guards against drift if
    /// the server-side order ever changes shape (e.g. a future
    /// re-pin to `updated_at` for some other call site).
    ///
    /// A nil `createdAt` sorts last — defensive against a server row
    /// missing the column. Shouldn't happen because the migration
    /// has `default now()`, but the Codable `String?` shape admits it.
    public static func sortedPending(_ plans: [PlansStore.Plan]) -> [PlansStore.Plan] {
        plans.sorted { lhs, rhs in
            switch (lhs.createdAt, rhs.createdAt) {
            case let (l?, r?):     return l > r            // newest first
            case (_?, nil):        return true             // stamped first
            case (nil, _?):        return false            // unstamped last
            case (nil, nil):       return false            // stable
            }
        }
    }

    /// tb-WF-8 — Decided section sort per surface §"Ordering within
    /// sections" (Q7): `verdict_fired_at DESC`, tiebreaker
    /// `created_at DESC`. A defensive nil-handling pass keeps a stale
    /// row (no `verdict_fired_at`) sorted last so the visible Decided
    /// section never leads with a row that has no verdict timestamp
    /// to telegraph "this just happened."
    public static func sortedDecided(
        _ rows: [PlansStore.DecidedPlanRow]
    ) -> [PlansStore.DecidedPlanRow] {
        rows.sorted { lhs, rhs in
            // Primary: verdict_fired_at DESC.
            switch (lhs.plan.verdictFiredAt, rhs.plan.verdictFiredAt) {
            case let (l?, r?):
                if l != r { return l > r }
            case (_?, nil):
                return true
            case (nil, _?):
                return false
            case (nil, nil):
                break // fall through to tiebreaker
            }
            // Tiebreaker: created_at DESC.
            switch (lhs.plan.createdAt, rhs.plan.createdAt) {
            case let (l?, r?):     return l > r
            case (_?, nil):        return true
            case (nil, _?):        return false
            case (nil, nil):       return false
            }
        }
    }

    /// tb-WF-8 — History section sort per surface §"Ordering within
    /// sections" (Q7): `expired_at DESC`, tiebreaker `created_at DESC`.
    public static func sortedHistory(
        _ rows: [PlansStore.DecidedPlanRow]
    ) -> [PlansStore.DecidedPlanRow] {
        rows.sorted { lhs, rhs in
            switch (lhs.plan.expiredAt, rhs.plan.expiredAt) {
            case let (l?, r?):
                if l != r { return l > r }
            case (_?, nil):
                return true
            case (nil, _?):
                return false
            case (nil, nil):
                break
            }
            switch (lhs.plan.createdAt, rhs.plan.createdAt) {
            case let (l?, r?):     return l > r
            case (_?, nil):        return true
            case (nil, _?):        return false
            case (nil, nil):       return false
            }
        }
    }

    /// tb-WF-8 — derive the §"Tap behavior" destination for a
    /// Decided / History card tap. Pure value — the host (RootView)
    /// pattern-matches and mounts the right view.
    ///
    /// Created Decided-active → full VerdictScreen with reroll
    /// affordance. Created Decided-expired → read-only Verdict.
    /// Joined cards (any status) → read-only Verdict; the
    /// `*Active` vs `*History` variant is preserved for the host
    /// so any future behavioral differentiation (e.g. expired-only
    /// affordances) has a place to land.
    public static func tapRoute(
        for row: PlansStore.DecidedPlanRow
    ) -> DecidedHistoryTapDestination {
        switch (row.role, row.plan.status) {
        case (.owner, .decidedActive):       return .createdVerdictFull
        case (.owner, .decidedExpired):      return .createdVerdictReadOnly
        case (.joined, .decidedActive):      return .joinedVerdictReadOnlyActive
        case (.joined, .decidedExpired):     return .joinedVerdictReadOnlyHistory
        case (_, .pending):
            // A Decided-section row whose status is .pending would be
            // a server-side bug — the RPC gates on
            // status='decided-active'. Defensive fall-through to the
            // read-only branch keeps the surface from crashing.
            return .createdVerdictReadOnly
        }
    }

    // MARK: - dependencies (host-supplied)

    private let pending: [PlansStore.Plan]
    private let joined: [PlansStore.JoinedPlanRow]
    /// tb-WF-8 — Decided section rows (`status=decided-active`),
    /// pre-sorted by the host via the `sortedDecided` helper. The view
    /// does NOT re-sort — that keeps the test contract explicit (the
    /// pure helper is what tests pin).
    private let decided: [PlansStore.DecidedPlanRow]
    /// tb-WF-8 — History section rows (`status=decided-expired`),
    /// pre-sorted via the `sortedHistory` helper.
    private let history: [PlansStore.DecidedPlanRow]
    /// tb-WF-8 — signed-in user id, used to key the History-collapse
    /// state in `@AppStorage`. Optional so test render harnesses that
    /// don't have a real user id can still mount the view (they fall
    /// back to a stable test key).
    private let signedInUserID: UUID?
    private let onRequestDisambig: () -> Void
    private let onPickGroupMode: (SetupScreen.GroupMode) -> Void
    private let onTapPlan: (PlansStore.Plan) -> Void
    private let onTapJoined: (PlansStore.JoinedPlanRow) -> Void
    /// tb-WF-8 — Decided / History card tap dispatcher. The host
    /// pattern-matches the supplied `tapRoute(for:)` value and mounts
    /// the right screen (full or read-only VerdictScreen).
    private let onTapDecidedOrHistory: (PlansStore.DecidedPlanRow) -> Void

    // MARK: - state

    /// Local presentation state for the disambig sheet. Both the FAB
    /// and the empty-state hero pill flip this true, which mounts
    /// `PlanDisambigSheet` via SwiftUI's `.sheet` modifier. Surface-
    /// local UI state — the host doesn't need to own this.
    @State private var disambigOpen: Bool = false

    /// tb-WF-8 — History section expand / collapse state, held in a
    /// small `@Observable` class so SwiftUI re-renders on toggle AND
    /// the unit-test path can mutate the value without installing the
    /// View in a hosting controller. (A bare `@State Bool` would
    /// re-render fine, but its underlying storage box only updates
    /// through SwiftUI's tracking — making it awkward to test the
    /// persistence path in a struct value not in any view tree.)
    ///
    /// Default `true` per surface §"Surface structure (locked Q1)":
    /// `expanded on first viewing, sticky-collapsed thereafter per
    /// session`. The init hydrates from `UserDefaults` under the
    /// per-user key; the toggle path writes back through the same key.
    @State private var historyState: HistoryCollapseState = HistoryCollapseState()

    // MARK: - init

    /// In this slice the host supplies the Pending + Joined rows
    /// directly. When tb-WF-8 lights up Decided + History, the API
    /// widens to take all three arrays. Keeping the entry tight here
    /// means the downstream tracer-bullets get a single, narrow
    /// surface to add to — no speculative parameters to retire.
    ///
    /// `onRequestDisambig` fires when the user invokes the create
    /// affordance (FAB or empty-state hero pill). The host can use
    /// this to log telemetry or run side effects (e.g. iOS location
    /// pre-prime) before / instead of letting the sheet open. The
    /// screen's own `.sheet` still mounts to drive the disambig UI;
    /// the `onPickGroupMode` callback is the load-bearing route — it
    /// carries the user's Solo/Group choice up to the host so Setup
    /// can be presented in the correct mode.
    ///
    /// tb-WF-7 — `joined` defaults to `[]` and `onTapJoined` defaults
    /// to a no-op so the existing tb-WF-6 call sites compile
    /// unchanged; the live host always supplies a non-trivial
    /// dispatcher.
    public init(
        pending: [PlansStore.Plan],
        joined: [PlansStore.JoinedPlanRow] = [],
        decided: [PlansStore.DecidedPlanRow] = [],
        history: [PlansStore.DecidedPlanRow] = [],
        signedInUserID: UUID? = nil,
        onRequestDisambig: @escaping () -> Void,
        onPickGroupMode: @escaping (SetupScreen.GroupMode) -> Void,
        onTapPlan: @escaping (PlansStore.Plan) -> Void,
        onTapJoined: @escaping (PlansStore.JoinedPlanRow) -> Void = { _ in },
        onTapDecidedOrHistory: @escaping (PlansStore.DecidedPlanRow) -> Void = { _ in }
    ) {
        self.pending = pending
        self.joined = joined
        self.decided = decided
        self.history = history
        self.signedInUserID = signedInUserID
        self.onRequestDisambig = onRequestDisambig
        self.onPickGroupMode = onPickGroupMode
        self.onTapPlan = onTapPlan
        self.onTapJoined = onTapJoined
        self.onTapDecidedOrHistory = onTapDecidedOrHistory

        // Hydrate the History collapse state from UserDefaults using
        // the per-user key. `@AppStorage`'s declarative form wants a
        // compile-time-known key string, but the iOS port keys on
        // the runtime userID. We bridge that by reading UserDefaults
        // directly here, seeding a small `@Observable` class
        // (`HistoryCollapseState`), and writing back through the same
        // key on every toggle.
        let key = Self.storageKey(for: signedInUserID)
        let initial = HistoryCollapseState()
        if UserDefaults.standard.object(forKey: key) != nil {
            initial.isOpen = UserDefaults.standard.bool(forKey: key)
        }
        // No stored value → leave the default (true) — matches surface
        // §"Surface structure (locked Q1)": expanded on first viewing.
        self._historyState = State(initialValue: initial)
    }

    /// tb-WF-8 — internal storage-key resolver. Maps a (possibly nil)
    /// signed-in user id to the `UserDefaults` key used by the
    /// History collapse state. Nil-user falls back to a stable test
    /// key so the surface still works in render harnesses + previews.
    private static func storageKey(for userID: UUID?) -> String {
        if let userID {
            return historyOpenStorageKey(for: userID)
        }
        return historyOpenStorageKeyPrefix + "anonymous"
    }

    // MARK: - body

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            if Self.isEmpty(pending: pending, joined: joined, decided: decided, history: history) {
                emptyState
            } else {
                populatedState
                // C-26 FAB — bottom-right create affordance on the
                // populated state only. Suppressed in the empty state
                // by branch composition (the `if` above only renders
                // it on populated). Tap opens the disambig sheet —
                // same path as the empty-state hero pill, per Q6
                // unified entry.
                FloatingActionButton(
                    onTap: { openDisambig() }
                )
            }
        }
        .sheet(isPresented: $disambigOpen) {
            PlanDisambigSheet(
                onPick: { choice in
                    disambigOpen = false
                    onPickGroupMode(PlanDisambigSheet.setupMode(for: choice))
                },
                onDismiss: { disambigOpen = false }
            )
        }
    }

    /// tb-WF-7 — Joined Pending plans rendered inline alongside the
    /// Created Pending plans. The surface §"Card content (locked Q2)"
    /// table sections by status, not by ownership; Joined cards live
    /// in the Pending section and the JOINED chip carries the
    /// "joined, not created" distinction. Decided / History Joined
    /// cards land when tb-WF-8 lights up those sections; until then
    /// only Pending Joined cards may render.
    ///
    /// Sort: same `created_at DESC` Created Pending cards use, so the
    /// row order is mechanically driven by recency — newest Plan
    /// (created OR joined) on top.
    private var joinedPendingRows: [PlansStore.JoinedPlanRow] {
        joined.filter { $0.plan.status == .pending }
              .sorted { lhs, rhs in
                  switch (lhs.plan.createdAt, rhs.plan.createdAt) {
                  case let (l?, r?):     return l > r
                  case (_?, nil):        return true
                  case (nil, _?):        return false
                  case (nil, nil):       return false
                  }
              }
    }

    // MARK: - empty state

    private var emptyState: some View {
        ZStack(alignment: .topLeading) {
            // Top-leading GTI mark — present on both states so the
            // user sees consistent chrome between empty + populated.
            gtiMark
                .padding(.horizontal, GTISpacing.step6)
                .padding(.top, GTISpacing.step16)

            VStack(spacing: GTISpacing.step4) {
                Text(Self.emptyHeroEyebrow.uppercased())
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("planList.empty.eyebrow")

                Text(Self.emptyHeroBody)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .lineSpacing(3)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 260)
                    .accessibilityIdentifier("planList.empty.body")

                Button(action: { openDisambig() }) {
                    ZStack {
                        RoundedRectangle(cornerRadius: GTIRadii.pill, style: .continuous)
                            .fill(GTIColor.paper)
                            .frame(height: 60)
                        Text(Self.emptyHeroPillLabel.uppercased())
                            .font(.system(size: GTIFont.Size.cta, weight: .black))
                            .tracking(GTIFont.TrackingEm.cta * GTIFont.Size.cta)
                            .foregroundStyle(GTIColor.ink)
                    }
                }
                .padding(.top, GTISpacing.step2)
                .accessibilityIdentifier("planList.empty.cta")
                .accessibilityLabel(Self.emptyHeroPillLabel)
            }
            .padding(.horizontal, GTISpacing.step6)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        }
    }

    // MARK: - populated state

    private var populatedState: some View {
        VStack(spacing: 0) {
            topBar

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(Self.populatedEyebrow.uppercased())
                        .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                        .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                        .foregroundStyle(GTIColor.TextOnGradient.secondary)
                        .padding(.horizontal, GTISpacing.step6)
                        .padding(.top, GTISpacing.step3)
                        .accessibilityIdentifier("planList.populated.eyebrow")

                    // Pending — surface §"Surface structure (locked Q1)"
                    // hides the section header entirely when empty.
                    if !pending.isEmpty || !joinedPendingRows.isEmpty {
                        pendingSection
                            .padding(.top, GTISpacing.step5)
                    }

                    // tb-WF-8 — Decided + History land below Pending.
                    if !decided.isEmpty {
                        decidedSection
                            .padding(.top, GTISpacing.step5)
                    }
                    if !history.isEmpty {
                        historySection
                            .padding(.top, GTISpacing.step5)
                    }

                    // Bottom padding — clears the C-26 FAB's 56pt body
                    // + 18pt bottom inset + breathing room so the last
                    // card in the section isn't covered by the FAB on
                    // a long list. ~96pt matches the JSX's
                    // `padding: '64px 0 96px'`.
                    Spacer(minLength: GTISpacing.step6 * 4) // ~96pt
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    /// Top bar — GTI mark on the leading edge. The trailing slot is
    /// empty in this slice; the create affordance moved to the C-26
    /// FAB at the bottom-right (tb-WF-6).
    private var topBar: some View {
        HStack(alignment: .center) {
            gtiMark
            Spacer()
        }
        .padding(.horizontal, GTISpacing.step6)
        .padding(.top, GTISpacing.step16)
    }

    private var pendingSection: some View {
        let joinedPending = joinedPendingRows
        let totalCount = pending.count + joinedPending.count
        return VStack(alignment: .leading, spacing: GTISpacing.step3) {
            sectionHeader(label: Self.pendingSectionLabel, count: totalCount)

            VStack(spacing: GTISpacing.step3 - GTISpacing.step1) { // 8pt between rows (close to JSX gap 10)
                // Created Pending cards first — preserves the
                // tb-WF-5 baseline render. Joined Pending cards
                // follow below; the surface spec puts both in the
                // same Pending section with the JOINED chip carrying
                // the distinction.
                ForEach(Self.sortedPending(pending)) { plan in
                    Button(action: { onTapPlan(plan) }) {
                        planCard(plan)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("planList.card.\(plan.id.uuidString)")
                    .accessibilityLabel(plan.name)
                    .accessibilityHint("Edit this plan.")
                }
                ForEach(joinedPending) { row in
                    Button(action: { onTapJoined(row) }) {
                        joinedPlanCard(row)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("planList.joinedCard.\(row.plan.id.uuidString)")
                    .accessibilityLabel(row.plan.name)
                    .accessibilityHint("Joined plan. Resume where you left off.")
                }
            }
            .padding(.horizontal, GTISpacing.step6)
        }
    }

    private func sectionHeader(label: String, count: Int) -> some View {
        HStack(spacing: GTISpacing.step2 - 2) { // 6pt — matches JSX gap 6
            Text(label.uppercased())
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.78))
                .accessibilityIdentifier("planList.section.\(label.lowercased()).label")

            Text("(\(count))")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .accessibilityIdentifier("planList.section.\(label.lowercased()).count")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, GTISpacing.step6)
        .padding(.top, GTISpacing.step3)
        .padding(.bottom, GTISpacing.step2)
        .frame(minHeight: 44, alignment: .leading)
    }

    /// tb-WF-8 — collapsible section header for History. The tap target
    /// covers the full row (matches HIG 44pt minimum); the trailing
    /// chevron rotates 0° → 180° on expand using the surface's
    /// `var(--ease-out)` 200ms timing. Per surface §"Section header
    /// treatment": Inter 900 / 14, white 0.55.
    private func collapsibleSectionHeader(
        label: String,
        count: Int,
        isOpen: Bool,
        onToggle: @escaping () -> Void
    ) -> some View {
        Button(action: onToggle) {
            HStack(spacing: GTISpacing.step2 - 2) { // 6pt gap to match JSX
                Text(label.uppercased())
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.primary.opacity(0.78))
                    .accessibilityIdentifier("planList.section.\(label.lowercased()).label")

                Text("(\(count))")
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                    .accessibilityIdentifier("planList.section.\(label.lowercased()).count")

                Spacer(minLength: 0)

                // Chevron — Inter 900 / 14 / white 0.55. Rotation
                // 0° → 180° on expand, 200ms ease-out per the surface
                // doc. Using SF Symbols' chevron.right keeps the iOS-
                // native disclosure feel the surface spec calls for.
                Image(systemName: "chevron.right")
                    .font(.system(size: 14, weight: .black))
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                    .rotationEffect(.degrees(isOpen ? 90 : 0))
                    .animation(.easeOut(duration: 0.2), value: isOpen)
                    .accessibilityHidden(true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, GTISpacing.step6)
            .padding(.top, GTISpacing.step3)
            .padding(.bottom, GTISpacing.step2)
            .frame(minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("planList.section.\(label.lowercased()).toggle")
        .accessibilityLabel("\(label) section")
        .accessibilityHint(isOpen ? "Collapse \(label) section." : "Expand \(label) section.")
        .accessibilityAddTraits(.isButton)
    }

    /// tb-WF-8 — Decided section. 2-line cards (Plan name + verdict
    /// place name), both Created and Joined rows inline. Sort key is
    /// `verdict_fired_at DESC` (host pre-sorts via the
    /// `sortedDecided` helper). Always expanded — no collapse on
    /// Decided per surface §"Surface structure (locked Q1)".
    private var decidedSection: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step3) {
            sectionHeader(label: Self.decidedSectionLabel, count: decided.count)

            VStack(spacing: GTISpacing.step3 - GTISpacing.step1) { // 8pt
                ForEach(decided) { row in
                    decidedHistoryButton(row: row)
                }
            }
            .padding(.horizontal, GTISpacing.step6)
        }
    }

    /// tb-WF-8 — History section. Same 2-line card shape as Decided.
    /// Collapsible — default expanded on first viewing, persisted
    /// per-user via `UserDefaults` (see `historyState` doc).
    private var historySection: some View {
        VStack(alignment: .leading, spacing: GTISpacing.step3) {
            collapsibleSectionHeader(
                label: Self.historySectionLabel,
                count: history.count,
                isOpen: historyState.isOpen,
                onToggle: { toggleHistoryOpen() }
            )

            if historyState.isOpen {
                VStack(spacing: GTISpacing.step3 - GTISpacing.step1) { // 8pt
                    ForEach(history) { row in
                        decidedHistoryButton(row: row)
                    }
                }
                .padding(.horizontal, GTISpacing.step6)
            }
        }
    }

    /// tb-WF-8 — tappable card for a Decided or History row. The host's
    /// `onTapDecidedOrHistory` callback fires with the full row so the
    /// host can pattern-match on `tapRoute(for:)` and mount the right
    /// VerdictScreen variant.
    private func decidedHistoryButton(row: PlansStore.DecidedPlanRow) -> some View {
        Button(action: { onTapDecidedOrHistory(row) }) {
            decidedHistoryCard(row: row)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("planList.decidedCard.\(row.plan.id.uuidString)")
        .accessibilityLabel(accessibilityLabelFor(row: row))
        .accessibilityHint(accessibilityHintFor(row: row))
    }

    /// tb-WF-8 — 2-line card for Decided / History. Renders:
    ///   1. JOINED eyebrow chip (Joined rows only),
    ///   2. Plan name — Inter 700 / 17, white, 1 line, ellipsis on
    ///      overflow,
    ///   3. Verdict place name — Inter 500 / 13, white 0.7, 1 line,
    ///      ellipsis on overflow (per surface §"Card content").
    ///
    /// The verdict place name truncates with the default tail-ellipsis
    /// on long Foursquare names per the surface spec.
    private func decidedHistoryCard(row: PlansStore.DecidedPlanRow) -> some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2 - 2) { // 6pt
            if row.role == .joined {
                Text(Self.joinedChipLabel)
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.sun)
                    .accessibilityIdentifier("planList.decidedCard.chip.\(row.plan.id.uuidString)")
                    .accessibilityLabel("Joined")
            }

            Text(row.plan.name)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Verdict place name — secondary line. Present only when
            // the row carries a non-nil `verdictPlaceName` (a
            // no-survivor verdict decodes with nil; the card still
            // renders the Plan name and skips the secondary line).
            if let place = row.verdictPlaceName, !place.isEmpty {
                Text(place)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 2) // matches JSX `marginTop: 4`-ish (after 6pt gap above name)
                    .accessibilityIdentifier("planList.decidedCard.verdictPlace.\(row.plan.id.uuidString)")
            }
        }
        .padding(.horizontal, GTISpacing.step5 - 2) // 18pt — matches JSX `14px 18px`
        .padding(.vertical, GTISpacing.step3 + 2)   // 14pt — matches JSX `14px 18px`
        .frame(minHeight: 76) // 2-line card per spec
        .background(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .fill(GTIColor.Glass.fillSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .stroke(Color.white.opacity(0.18), lineWidth: 1)
        )
    }

    /// Accessibility label for a Decided / History card. Reads the
    /// Plan name + verdict place name aloud when present, so the
    /// VoiceOver user gets the full 2-line context.
    private func accessibilityLabelFor(row: PlansStore.DecidedPlanRow) -> String {
        if let place = row.verdictPlaceName, !place.isEmpty {
            return "\(row.plan.name), \(place)"
        }
        return row.plan.name
    }

    /// Accessibility hint for a Decided / History card — telegraphs
    /// the destination per surface §"Tap behavior".
    private func accessibilityHintFor(row: PlansStore.DecidedPlanRow) -> String {
        switch Self.tapRoute(for: row) {
        case .createdVerdictFull:
            return "Open the verdict. Reroll is available."
        case .createdVerdictReadOnly,
             .joinedVerdictReadOnlyActive,
             .joinedVerdictReadOnlyHistory:
            return "Open the verdict."
        }
    }

    /// tb-WF-8 — toggle the History section open / collapsed and
    /// persist the new value to `UserDefaults` under the per-user key.
    private func toggleHistoryOpen() {
        historyState.isOpen.toggle()
        let key = Self.storageKey(for: signedInUserID)
        UserDefaults.standard.set(historyState.isOpen, forKey: key)
    }

    /// 1-line Pending card. Name only, ellipsis on overflow, glass row
    /// treatment per surface §"Card content — Created Pending card
    /// (1-line)". No trailing `⋯` menu in this slice (tb-WF-9).
    private func planCard(_ plan: PlansStore.Plan) -> some View {
        HStack(spacing: GTISpacing.step3) {
            Text(plan.name)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, GTISpacing.step5 - 2) // 18pt — matches JSX `14px 18px`
        .padding(.vertical, GTISpacing.step3 + 2)   // 14pt — matches JSX `14px 18px`
        .frame(minHeight: 64) // 1-line card per spec
        .background(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .fill(GTIColor.Glass.fillSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .stroke(Color.white.opacity(0.18), lineWidth: 1)
        )
    }

    /// tb-WF-7 — Joined Pending card. JOINED eyebrow chip
    /// top-leading in `GTIColor.sun` per the surface §"Joined card
    /// (any status)" spec; the chip uses the eyebrow token (Inter
    /// 700 / 11pt / `letterSpacing = 0.18em` UPPERCASE) so the chip
    /// is the label, not a headline. Plan name below — same Inter
    /// 700 / 17 line as the Created Pending card.
    ///
    /// No three-dot menu in this slice (tb-WF-9). Tap routing flows
    /// through the host-supplied `onTapJoined` closure (see
    /// `pendingSection`); this view is render-only.
    private func joinedPlanCard(_ row: PlansStore.JoinedPlanRow) -> some View {
        VStack(alignment: .leading, spacing: GTISpacing.step2 - 2) { // 6pt gap below chip (matches JSX `marginBottom: 6`)
            Text(Self.joinedChipLabel)
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                .foregroundStyle(GTIColor.sun)
                .accessibilityIdentifier("planList.joinedCard.chip.\(row.plan.id.uuidString)")
                .accessibilityLabel("Joined")

            Text(row.plan.name)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, GTISpacing.step5 - 2) // 18pt — matches JSX `14px 18px`
        .padding(.vertical, GTISpacing.step3 + 2)   // 14pt — matches JSX `14px 18px`
        .frame(minHeight: 64)
        .background(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .fill(GTIColor.Glass.fillSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                .stroke(Color.white.opacity(0.18), lineWidth: 1)
        )
    }

    /// 22pt GTI mark stand-in. Same tile as `LocationPermissionScreen`
    /// + the retired `LandingScreen` — the real wordmark lands with
    /// the pre-public-launch polish ticket.
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

    // MARK: - actions

    /// Open the disambig sheet. Both the empty-state hero pill and the
    /// C-26 FAB call this; the unified entry per Q6 of the parent
    /// grill. The host's `onRequestDisambig` fires first so the host
    /// can log telemetry or run a side effect (e.g. location pre-
    /// prime) before the sheet mounts; the sheet still opens via the
    /// `@State` flag — the side effect is pre-roll, not a gate.
    private func openDisambig() {
        onRequestDisambig()
        disambigOpen = true
    }
}

// MARK: - test affordance

extension PlanListScreen {
    /// Test-only hook — drives the empty-state hero pill tap without
    /// walking the SwiftUI view tree.
    @MainActor
    func simulateEmptyHeroTap() {
        openDisambig()
    }

    /// Test-only hook — drives the C-26 FAB tap.
    @MainActor
    func simulateFABTap() {
        openDisambig()
    }

    /// Test-only hook — drives the disambig sheet's pick callback
    /// without mounting the sheet. The host's `onPickGroupMode` is the
    /// outward contract under test; this shortcut lets us exercise it
    /// without a UI-test harness.
    @MainActor
    func simulateDisambigPick(_ mode: SetupScreen.GroupMode) {
        onPickGroupMode(mode)
    }

    /// Test-only hook (tb-WF-8) — read the current History-collapse
    /// state. Lets tests assert the default state without walking the
    /// view tree.
    @MainActor
    func currentHistoryOpenForTest() -> Bool {
        historyState.isOpen
    }

    /// Test-only hook (tb-WF-8) — drive the History-collapse toggle.
    /// Wires through the same persistence path the visible chevron
    /// uses, so a test can assert the `UserDefaults` write lands.
    @MainActor
    func simulateHistoryToggle() {
        toggleHistoryOpen()
    }
}
