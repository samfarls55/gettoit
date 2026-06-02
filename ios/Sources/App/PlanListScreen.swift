// GetToIt — S00 · Plan list (tb-WF-5 → tb-WF-6 → tb-WF-7 → tb-WF-8, workflow-overhaul).
//
// The new app entry surface. Replaces the retired S00 Landing as the
// post-sign-in landing on iOS. A sectioned list of the user's Plans,
// in Reminders-app spirit, with the C-26 FAB on populated state and
// per-card three-dot menus that land later (tb-WF-9).
//
// Surface spec: `design-system/surfaces/00-plan-list.md`.
// JSX reference: `design-system/code/screens/ScreenPlanList.jsx`.
// Parent decisions doc: [[gti-vault/50_product/0.1.0-workflow-overhaul-plan-list]].
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
// repo AGENTS.md — no inline hex / px / easing.

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

/// bug-36 — small `@Observable` holder for the History `Jump to Item`
/// search query. Same reasoning as `HistoryCollapseState`: a class
/// instance held by `@State` lets the unit-test path mutate the value
/// on a struct PlanListScreen without driving the SwiftUI text-input
/// path; SwiftUI tracks the class reference and re-renders on change.
@MainActor
@Observable
final class HistorySearchState {
    /// Current trimmed-or-raw query bound to the inline `TextField`.
    /// Empty string means "no active filter" — the full list renders.
    var query: String = ""
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

    /// wfr-06 — accessibility identifier for the top-trailing settings
    /// chrome glyph. Stable contract — UI test harnesses + future a11y
    /// audits pin this string.
    public static let settingsGlyphAccessibilityIdentifier: String =
        "planList.settings.glyph"

    /// wfr-06 — VoiceOver label for the settings chrome glyph. Single
    /// noun — names the destination, not the icon. NEVER `"Open
    /// settings"`, `"Account"`, `"Gear"`.
    public static let settingsGlyphAccessibilityLabel: String = "Settings"

    /// wfr-06 — VoiceOver hint for the settings chrome glyph. Names the
    /// destination + the round-trip ("Done returns here").
    public static let settingsGlyphAccessibilityHint: String =
        "Opens the Settings screen."

    /// wfr-11 — eyebrow copy for the cold-load skeleton. Sentence-case in
    /// source; the surface renders uppercase via the eyebrow token.
    /// Neutral verb tense — `"Loading"` does not telegraph "you have
    /// nothing" the way the empty-state `"No plans yet"` would; the
    /// register matches the LocationPicker chip's `LOCATING…`
    /// loading mono-tag.
    public static let loadingEyebrow: String = "Loading"

    /// wfr-11 — VoiceOver label for the cold-load skeleton container.
    /// Plain English so a VoiceOver user knows the surface is mid-fetch,
    /// not empty.
    public static let loadingAccessibilityLabel: String = "Loading your plans"

    /// wfr-11 — stable accessibility identifier for the cold-load
    /// skeleton container. UI test harnesses + future audits pin this
    /// string.
    public static let loadingContainerAccessibilityIdentifier: String =
        "planList.loading.container"

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

    /// wfr-11 — cold-load detection. The skeleton branch renders only
    /// when (a) the host is mid-fetch AND (b) no rows are cached on
    /// screen yet. A hot reload (any bucket already populated) keeps
    /// showing the cached rows — per the pattern-hub guidance, the
    /// skeleton is for content "that has a known shape" and a known-
    /// shape miss is the empty-screen-during-fetch anti-pattern. Once
    /// rows are on screen the user already has the shape; swapping
    /// them for a skeleton would be a regression, not a fix.
    public static func isColdLoading(
        isLoading: Bool,
        pending: [PlansStore.Plan],
        joined: [PlansStore.JoinedPlanRow],
        decided: [PlansStore.DecidedPlanRow],
        history: [PlansStore.DecidedPlanRow]
    ) -> Bool {
        return isLoading
            && isEmpty(
                pending: pending,
                joined: joined,
                decided: decided,
                history: history
            )
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

    /// tb-WF-9 — labels for the C-25 Action Dot Menu items, derived
    /// from a card's (role, status). Pure helper so the iOS port can
    /// pin the role × status × menu items contract from
    /// `surfaces/00-plan-list.md §"Three-dot menu (locked Q4)"`:
    ///
    /// | Card               | Menu items (in order) |
    /// |--------------------|------------------------|
    /// | Created Pending    | Edit plan, Delete plan |
    /// | Created Decided    | Delete plan            |
    /// | Created History    | Delete plan            |
    /// | Joined (any)       | Leave plan             |
    ///
    /// HARD RULE — Joined cards NEVER show `Delete plan`. Only the
    /// Plan creator can delete (CONTEXT.md → `Plan delete`); joiners
    /// can only `Leave plan`.
    public static func menuItemLabels(
        role: PlansStore.DecidedPlanRow.Role,
        status: PlansStore.LifecycleState
    ) -> [String] {
        switch role {
        case .joined:
            // Joiner — Leave only, every status.
            return [Self.menuLabelLeavePlan]
        case .owner:
            switch status {
            case .pending:
                return [Self.menuLabelEditPlan, Self.menuLabelDeletePlan]
            case .decidedActive, .decidedExpired:
                return [Self.menuLabelDeletePlan]
            }
        }
    }

    /// tb-WF-9 — `Edit plan` menu item label. Sentence-case in source;
    /// the C-25 menu renders rows in Inter 700 / 14 (no `.uppercased()`
    /// transform). NEVER `"Edit"` or `"Modify plan"`.
    public static let menuLabelEditPlan: String = "Edit plan"

    /// tb-WF-9 — `Delete plan` menu item label. NEVER `"Cancel plan"`,
    /// `"Remove"`, or `"Delete"` — per CONTEXT.md the verb is
    /// "delete" and the noun is `plan`.
    public static let menuLabelDeletePlan: String = "Delete plan"

    /// tb-WF-9 — `Leave plan` menu item label. NEVER `"Exit"` or
    /// `"Abandon"`; the warm-friend register uses "leave."
    public static let menuLabelLeavePlan: String = "Leave plan"

    // MARK: - bug-36 — History `Jump to Item` search (threshold-gated)

    /// bug-36 — minimum History row count that earns an inline search
    /// input. Per `surfaces.md §"Threshold-gated affordances"`, the
    /// `Jump to Item` pattern is only worth its screen real estate
    /// once the list crosses a bounded-vs-unbounded gate; below this,
    /// scroll-and-tap is faster than typing (P-03 Satisficing).
    /// Default 10 per the surface addendum locked 2026-05-26 in
    /// workflow-review grill #4.
    public static let historySearchThreshold: Int = 10

    /// bug-36 — placeholder copy for the History search input. Locked
    /// per the workflow-design hub register. NEVER `"Find"`, `"Filter"`,
    /// `"Type to filter"`.
    public static let historySearchPlaceholder: String = "Search plans"

    /// bug-36 — body label shown in the History section content area
    /// when an active filter matches zero rows. Distinct from the
    /// global empty hero (`"No plans yet"`) — the user is filtering,
    /// not empty-state. Locked per vault spec §"Empty filter result
    /// state". NEVER `"No results"`, `"Nothing found"`.
    public static let historySearchEmptyResultLabel: String = "No matching plans"

    /// bug-36 — pure threshold + expand gate. Returns true iff the
    /// History section earns a search input on this render. Exposed
    /// statically so the unit-test lane pins the contract without
    /// walking the view tree.
    ///
    /// - Parameters:
    ///   - historyCount: number of rows in the History bucket.
    ///   - isOpen: whether the History section is currently expanded.
    /// - Returns: true when `historyCount >= historySearchThreshold`
    ///   AND `isOpen` is true. The search input lives between the
    ///   section header and the first row; it hides with the rest of
    ///   the section when collapsed (P-09 Spatial Memory — one home
    ///   for the field).
    public static func shouldShowHistorySearch(
        historyCount: Int,
        isOpen: Bool
    ) -> Bool {
        return isOpen && historyCount >= historySearchThreshold
    }

    /// bug-36 — pure substring-match filter over the History rows.
    /// Matches the query case-insensitively against `plan.name` OR
    /// `verdictPlaceName` — the two strings already shown on each
    /// row. A whitespace-only query is treated as empty and returns
    /// the full list. Input order is preserved so the host-supplied
    /// `sortedHistory` order survives the filter.
    ///
    /// - Parameters:
    ///   - rows: the History bucket, already sorted by the host.
    ///   - query: the raw search field text (whitespace tolerated).
    /// - Returns: rows whose Plan name or verdict place name contains
    ///   the trimmed query (case-insensitive). Whitespace-only /
    ///   empty query returns all rows.
    public static func filterHistory(
        _ rows: [PlansStore.DecidedPlanRow],
        query: String
    ) -> [PlansStore.DecidedPlanRow] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return rows }
        let needle = trimmed.lowercased()
        return rows.filter { row in
            if row.plan.name.lowercased().contains(needle) { return true }
            if let place = row.verdictPlaceName,
               place.lowercased().contains(needle) {
                return true
            }
            return false
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
        tapRoute(role: row.role, status: row.plan.status)
    }

    /// sg-WF-6 — the §"Tap behavior" destination computed from an
    /// explicit `role` + a *freshly resolved* lifecycle `status`,
    /// rather than the status carried on a possibly-stale list row.
    ///
    /// The S00 Plan list's Decided / History sections are a snapshot:
    /// a `decided-active` Plan can transition to `decided-expired` (its
    /// reroll window closing — ADR 0016's three-way close) after the
    /// list was last loaded. The Decided-card tap path re-fetches the
    /// Plan's current status (`PlansStore.fetchPlanStatus`) and routes
    /// through this overload so an expired Plan opens the read-only
    /// verdict screen — which renders no reroll affordance — instead of
    /// the full one.
    ///
    /// `tapRoute(for:)` delegates here with the row's snapshot status,
    /// preserving its behavior for call sites that have not (or cannot)
    /// re-fetch.
    public static func tapRoute(
        role: PlansStore.DecidedPlanRow.Role,
        status: PlansStore.LifecycleState
    ) -> DecidedHistoryTapDestination {
        switch (role, status) {
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
    /// wfr-11 — true while the host is mid-fetch on the four Plan-list
    /// queries (Pending / Joined / Decided / History). Cold-load (this
    /// flag set + every bucket empty) flips the body to a skeleton
    /// branch so the user sees motion-free placeholders instead of an
    /// empty screen. Hot reload (this flag set with cached rows
    /// already in state) is a no-op visually — the cached rows stay
    /// on screen, matching the pattern-hub guidance to avoid swapping
    /// already-painted content for a loader.
    private let isLoading: Bool
    private let onRequestDisambig: () -> Void
    private let onPickGroupMode: (SetupScreen.GroupMode) -> Void
    private let onTapPlan: (PlansStore.Plan) -> Void
    private let onTapJoined: (PlansStore.JoinedPlanRow) -> Void
    /// tb-WF-8 — Decided / History card tap dispatcher. The host
    /// pattern-matches the supplied `tapRoute(for:)` value and mounts
    /// the right screen (full or read-only VerdictScreen).
    private let onTapDecidedOrHistory: (PlansStore.DecidedPlanRow) -> Void
    /// tb-WF-9 — fires when the user confirms `Delete plan` on a
    /// Created card. The host runs the delete journey (look up linked
    /// room, expire it to broadcast session-ended, delete the Plan
    /// row) and refreshes the list. `status` is the card's current
    /// lifecycle state so the host can branch on Pending vs Decided.
    private let onDeletePlan: (PlansStore.Plan, PlansStore.LifecycleState) -> Void
    /// tb-WF-9 — fires when the user confirms `Leave plan` on a
    /// Joined card. The host runs the existing
    /// `MemberLeaveStore.leave(...)` path (matches `Plan exit` from
    /// tb-WF-2) and refreshes the list. `roomID` comes from the host
    /// (the iOS port stores it on the JoinedPlanRow), but the JSX
    /// only carries the Plan id — the host resolves the room via
    /// `PlansStore.roomIDForJoinedPlan` before invoking
    /// `MemberLeaveStore`.
    private let onLeavePlan: (PlansStore.JoinedPlanRow) -> Void
    /// wfr-06 — fires when the user taps the top-trailing settings
    /// chrome glyph. The host (RootView) flips `showingSettings = true`,
    /// at which point the existing precedence chain renders
    /// SettingsScreen. `SettingsScreen.onDone` flips the flag back to
    /// false, returning the user to this surface.
    private let onOpenSettings: () -> Void

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

    /// bug-36 — current History search query. Bound to the inline
    /// search input rendered only when `shouldShowHistorySearch(...)`
    /// returns true. A blank value means "no filter active" — the full
    /// History list renders. Surface-local state; never persisted
    /// across mounts (per surface §"Threshold-gated affordances" the
    /// search field is a transient affordance, not a saved query).
    ///
    /// Held inside a small `@Observable` class (same pattern as
    /// `historyState`) so the test-only hook
    /// `simulateHistorySearchQueryForTest(_:)` can mutate the value
    /// on a struct PlanListScreen value without mounting a
    /// UIHostingController.
    @State private var historySearchState: HistorySearchState = HistorySearchState()

    /// tb-WF-9 — which card has its C-25 popover open. Only one menu
    /// is ever open at a time; tapping another trigger replaces the
    /// open id. Nil means no menu is open. The popover is rendered as
    /// an overlay anchored to the card row that matches this id.
    @State private var openMenuPlanID: UUID? = nil

    /// tb-WF-9 — which destructive confirm sheet is up. Set when the
    /// user taps a `Delete plan` / `Leave plan` row in the C-25 menu.
    /// Drives the `.sheet` modifier; tapping the primary pill fires
    /// the host callback and clears this; tapping the dismiss eyebrow
    /// (`KEEP` / `STAY`) clears it without firing.
    @State private var confirmContext: ConfirmContext? = nil

    /// tb-WF-9 — minimal context payload for the destructive confirm
    /// sheet. Carries the resolved `Variant` (from the locked copy
    /// table) and either a Created Plan + status (for Delete) or a
    /// JoinedPlanRow (for Leave). Equatable so SwiftUI's `.sheet(item:)`
    /// re-presents on identity change.
    struct ConfirmContext: Identifiable, Equatable {
        let id: UUID
        let variant: PlanDestructiveConfirmSheet.Variant
        let createdPlan: PlansStore.Plan?
        let createdStatus: PlansStore.LifecycleState?
        let joinedRow: PlansStore.JoinedPlanRow?

        static func delete(plan: PlansStore.Plan) -> ConfirmContext {
            let variant = PlanDestructiveConfirmSheet.variantFor(
                role: .owner,
                status: plan.status,
                verb: .delete
            )
            return ConfirmContext(
                id: plan.id,
                variant: variant,
                createdPlan: plan,
                createdStatus: plan.status,
                joinedRow: nil
            )
        }

        static func leave(row: PlansStore.JoinedPlanRow) -> ConfirmContext {
            return ConfirmContext(
                id: row.plan.id,
                variant: .joinedLeave,
                createdPlan: nil,
                createdStatus: nil,
                joinedRow: row
            )
        }
    }

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
        isLoading: Bool = false,
        onRequestDisambig: @escaping () -> Void,
        onPickGroupMode: @escaping (SetupScreen.GroupMode) -> Void,
        onTapPlan: @escaping (PlansStore.Plan) -> Void,
        onTapJoined: @escaping (PlansStore.JoinedPlanRow) -> Void = { _ in },
        onTapDecidedOrHistory: @escaping (PlansStore.DecidedPlanRow) -> Void = { _ in },
        onDeletePlan: @escaping (PlansStore.Plan, PlansStore.LifecycleState) -> Void = { _, _ in },
        onLeavePlan: @escaping (PlansStore.JoinedPlanRow) -> Void = { _ in },
        onOpenSettings: @escaping () -> Void = { }
    ) {
        self.pending = pending
        self.joined = joined
        self.decided = decided
        self.history = history
        self.signedInUserID = signedInUserID
        self.isLoading = isLoading
        self.onRequestDisambig = onRequestDisambig
        self.onPickGroupMode = onPickGroupMode
        self.onTapPlan = onTapPlan
        self.onTapJoined = onTapJoined
        self.onTapDecidedOrHistory = onTapDecidedOrHistory
        self.onDeletePlan = onDeletePlan
        self.onLeavePlan = onLeavePlan
        self.onOpenSettings = onOpenSettings

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

            if Self.isColdLoading(
                isLoading: isLoading,
                pending: pending,
                joined: joined,
                decided: decided,
                history: history
            ) {
                // wfr-11 — cold load: rows haven't arrived yet on first
                // mount (or a refresh after a sign-out/sign-in). Render
                // skeleton placeholders in the Pending slot so the user
                // sees motion-free `glass` rows instead of an empty
                // screen. Suppress the FAB — there's nothing to act on
                // and an early tap would race the fetch.
                loadingState
            } else if Self.isEmpty(pending: pending, joined: joined, decided: decided, history: history) {
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
        // tb-WF-9 — destructive confirm sheet. C-16 register, sun-
        // yellow `KEEP` / `STAY` dismiss eyebrow, no red. Mounts on
        // top of the Plan list via SwiftUI's `.sheet(item:)`.
        .sheet(item: $confirmContext) { ctx in
            PlanDestructiveConfirmSheet(
                variant: ctx.variant,
                onConfirm: {
                    let context = ctx
                    confirmContext = nil
                    fireConfirmedAction(for: context)
                },
                onDismiss: { confirmContext = nil }
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

    // MARK: - loading state

    /// wfr-11 — cold-load skeleton. Renders the standard top chrome
    /// (GTI mark + settings glyph) so the user can still reach
    /// Settings during a slow fetch, then a `Pending` section header
    /// over three glass placeholder rows. The rows match the 1-line
    /// Pending card shape (`64pt minHeight`, `GTIRadii.card`,
    /// `GTIColor.Glass.fillSoft`) so the layout doesn't visibly jump
    /// when the real rows arrive. No animation — the surface honours
    /// motion.md's no-pulse register; the visual hierarchy (eyebrow
    /// label + glass rows) carries the "mid-fetch" moment without
    /// competing for attention.
    private var loadingState: some View {
        VStack(spacing: 0) {
            topBar

            VStack(alignment: .leading, spacing: 0) {
                Text(Self.loadingEyebrow.uppercased())
                    .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                    .tracking(GTIFont.TrackingEm.eyebrow * GTIFont.Size.eyebrow)
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                    .padding(.horizontal, GTISpacing.step6)
                    .padding(.top, GTISpacing.step5)
                    .accessibilityIdentifier("planList.loading.eyebrow")

                VStack(spacing: GTISpacing.step3 - GTISpacing.step1) { // 8pt — matches Pending row gap
                    ForEach(0..<3, id: \.self) { _ in
                        skeletonRow
                    }
                }
                .padding(.horizontal, GTISpacing.step6)
                .padding(.top, GTISpacing.step3)

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityIdentifier(Self.loadingContainerAccessibilityIdentifier)
        .accessibilityLabel(Self.loadingAccessibilityLabel)
        .accessibilityAddTraits(.updatesFrequently)
    }

    /// wfr-11 — single skeleton row matching the 1-line Pending card
    /// envelope (`GTIRadii.card`, `GTIColor.Glass.fillSoft`, 64pt
    /// min-height). No inner glyph or text — the shape itself is the
    /// placeholder; this keeps the load state visually quiet next to
    /// the empty hero, and avoids the "per-pixel skeleton that
    /// misleads the user about content shape" anti-pattern called out
    /// in the pattern-hub spec.
    private var skeletonRow: some View {
        RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
            .fill(GTIColor.Glass.fillSoft)
            .frame(minHeight: 64)
            .frame(height: 64)
            .overlay(
                RoundedRectangle(cornerRadius: GTIRadii.card, style: .continuous)
                    .stroke(Color.white.opacity(0.18), lineWidth: 1)
            )
            .accessibilityHidden(true)
    }

    // MARK: - empty state

    private var emptyState: some View {
        ZStack(alignment: .topLeading) {
            // Top chrome — GTI mark leading, settings glyph trailing.
            // The chrome row mirrors the populated-state `topBar` so a
            // first-launch user with zero plans can still reach
            // Settings (App Store 5.1.1(v) — account deletion must be
            // discoverable from a cold launch). wfr-06.
            HStack {
                gtiMark
                Spacer()
                settingsGlyph
            }
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

    /// Top bar — GTI mark on the leading edge, settings chrome glyph
    /// on the trailing edge (wfr-06). The create affordance moved to
    /// the C-26 FAB at the bottom-right (tb-WF-6); the trailing slot
    /// now hosts the `Sign-In Tools` settings entry per the workflow-
    /// design hub's pattern (top-right reserved for signed-in user
    /// tooling — settings / account / sign-out).
    private var topBar: some View {
        HStack(alignment: .center) {
            gtiMark
            Spacer()
            settingsGlyph
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
                    cardRowForCreated(plan)
                }
                ForEach(joinedPending) { row in
                    cardRowForJoined(row)
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
    ///
    /// bug-36 — when `history.count >= historySearchThreshold` AND
    /// the section is expanded, an inline `Jump to Item` search input
    /// renders between the section header and the first row. Below
    /// the threshold or when collapsed, the search input is absent
    /// (P-03 Satisficing). The search filter is purely client-side —
    /// the `history` array is already in memory.
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
                    if Self.shouldShowHistorySearch(
                        historyCount: history.count,
                        isOpen: historyState.isOpen
                    ) {
                        historySearchField
                    }

                    let filtered = Self.filterHistory(history, query: historySearchState.query)
                    if filtered.isEmpty {
                        historyEmptyFilterPlaceholder
                    } else {
                        ForEach(filtered) { row in
                            decidedHistoryButton(row: row)
                        }
                    }
                }
                .padding(.horizontal, GTISpacing.step6)
            }
        }
    }

    /// bug-36 — inline `Jump to Item` search input for the History
    /// section. Borderless `TextField` on the same glass row treatment
    /// as `SetupScreen.nameField` so no new design primitive is
    /// introduced. A clear glyph (`xmark.circle.fill`) appears inside
    /// the field when the query is non-empty; tapping it clears the
    /// query and re-shows the full History list.
    private var historySearchField: some View {
        HStack(spacing: GTISpacing.step3) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .accessibilityHidden(true)

            TextField(
                "",
                text: Binding(
                    get: { historySearchState.query },
                    set: { historySearchState.query = $0 }
                ),
                prompt: Text(Self.historySearchPlaceholder)
                    .foregroundStyle(GTIColor.TextOnGradient.tertiary)
            )
            .textFieldStyle(.plain)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(GTIColor.TextOnGradient.primary)
            .autocorrectionDisabled(true)
            .textInputAutocapitalization(.never)
            .submitLabel(.search)
            .accessibilityIdentifier("planList.history.search.field")
            .accessibilityLabel(Self.historySearchPlaceholder)

            if !historySearchState.query.isEmpty {
                Button(action: { historySearchState.query = "" }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16, weight: .regular))
                        .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("planList.history.search.clear")
                .accessibilityLabel("Clear search")
            }
        }
        .padding(.horizontal, GTISpacing.step4)
        .padding(.vertical, GTISpacing.step3)
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                .fill(GTIColor.Glass.fillSoft)
        )
        .overlay(
            RoundedRectangle(cornerRadius: GTIRadii.row, style: .continuous)
                .stroke(Color.white.opacity(0.18), lineWidth: 1)
        )
        .accessibilityIdentifier("planList.history.search.container")
    }

    /// bug-36 — placeholder shown in the History section content area
    /// when an active filter matches zero rows. Plain, centered body
    /// copy — no glass card / icon (the section header still tells
    /// the user where they are; the filter input is right above).
    private var historyEmptyFilterPlaceholder: some View {
        Text(Self.historySearchEmptyResultLabel)
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(GTIColor.TextOnGradient.secondary)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, GTISpacing.step5)
            .accessibilityIdentifier("planList.history.search.empty")
    }

    /// tb-WF-8 → tb-WF-9 — tappable Decided / History row with the C-25
    /// menu overlaid on the trailing edge. The trigger sits inside a
    /// ZStack on top of the card body so the C-25 tap area is excluded
    /// from the card's tap target. The host's `onTapDecidedOrHistory`
    /// callback still fires when the user taps the body itself.
    @ViewBuilder
    private func decidedHistoryButton(row: PlansStore.DecidedPlanRow) -> some View {
        ZStack(alignment: .topTrailing) {
            Button(action: { onTapDecidedOrHistory(row) }) {
                decidedHistoryCard(row: row)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("planList.decidedCard.\(row.plan.id.uuidString)")
            .accessibilityLabel(accessibilityLabelFor(row: row))
            .accessibilityHint(accessibilityHintFor(row: row))

            actionDotMenuOverlay(
                planID: row.plan.id,
                planName: row.plan.name,
                buildItems: {
                    if row.role == .joined {
                        return [
                            ActionDotMenu.Item(label: Self.menuLabelLeavePlan, destructive: true) {
                                openMenuPlanID = nil
                                // Joined Decided / History — wrap into a JoinedPlanRow stub.
                                // The host (RootView) resolves the room via PlansStore.
                                let stub = PlansStore.JoinedPlanRow(
                                    plan: row.plan,
                                    lastAnsweredQuestionIndex: 0,
                                    hasVoted: false
                                )
                                confirmContext = ConfirmContext.leave(row: stub)
                            }
                        ]
                    } else {
                        return menuItems(for: row.plan)
                    }
                }
            )
        }
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
        // tb-WF-9 — extra trailing inset so the verdict place name does
        // not run under the C-25 trigger overlaid on the trailing edge.
        .padding(.trailing, ActionDotMenu.triggerDiameter)
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

    /// tb-WF-9 — Created Pending card row. ZStack composing the
    /// tappable card body and the trailing C-25 trigger / popover. The
    /// trigger sits in a 36-wide trailing slot reserved by the card's
    /// internal padding so the body tap area never overlaps the menu.
    @ViewBuilder
    private func cardRowForCreated(_ plan: PlansStore.Plan) -> some View {
        ZStack(alignment: .topTrailing) {
            Button(action: { onTapPlan(plan) }) {
                planCard(plan)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("planList.card.\(plan.id.uuidString)")
            .accessibilityLabel(plan.name)
            .accessibilityHint("Edit this plan.")

            actionDotMenuOverlay(
                planID: plan.id,
                planName: plan.name,
                buildItems: { menuItems(for: plan) }
            )
        }
    }

    /// tb-WF-9 — Joined Pending card row. Same ZStack pattern as the
    /// Created variant; the menu builds the `Leave plan` item against
    /// the JoinedPlanRow.
    @ViewBuilder
    private func cardRowForJoined(_ row: PlansStore.JoinedPlanRow) -> some View {
        ZStack(alignment: .topTrailing) {
            Button(action: { onTapJoined(row) }) {
                joinedPlanCard(row)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("planList.joinedCard.\(row.plan.id.uuidString)")
            .accessibilityLabel(row.plan.name)
            .accessibilityHint("Joined plan. Resume where you left off.")

            actionDotMenuOverlay(
                planID: row.plan.id,
                planName: row.plan.name,
                buildItems: { menuItems(for: row) }
            )
        }
    }

    /// tb-WF-9 — C-25 Action Dot Menu overlay anchored to the trailing
    /// edge of a Plan card. Renders the trigger inset 14pt from the
    /// trailing edge (matches the card's 18pt horizontal padding —
    /// 4pt of trigger overlap sits cleanly inside the row); the
    /// popover anchors to the same slot with a small top-offset
    /// (`top: calc(100% + 6px)` from the JSX → 6pt top padding).
    @ViewBuilder
    private func actionDotMenuOverlay(
        planID: UUID,
        planName: String,
        buildItems: @escaping () -> [ActionDotMenu.Item]
    ) -> some View {
        let isOpen = openMenuPlanID == planID
        VStack(alignment: .trailing, spacing: GTISpacing.step2 - 2) { // 6pt
            ActionDotMenu.Trigger(
                isOpen: isOpen,
                onToggle: { toggleMenu(for: planID) },
                accessibilityLabel: "More actions for \(planName)"
            )

            if isOpen {
                ActionDotMenu.Popover(
                    items: buildItems(),
                    onDismiss: { openMenuPlanID = nil }
                )
                .transition(.opacity)
            }
        }
        .padding(.top, GTISpacing.step2)        // 8pt — pulls the trigger glyph
                                                 // down so it visually centers
                                                 // on the 1-line card body.
        .padding(.trailing, GTISpacing.step2)   // 8pt — visual nudge inside the
                                                 // card's 18pt horizontal padding.
        .accessibilityElement(children: .contain)
    }

    /// tb-WF-9 — toggle the C-25 popover for a given Plan id. If the
    /// menu is already open on this card, close it; otherwise close
    /// any other open menu and open this one. Only one menu is ever
    /// open at a time.
    private func toggleMenu(for planID: UUID) {
        if openMenuPlanID == planID {
            openMenuPlanID = nil
        } else {
            openMenuPlanID = planID
        }
    }

    /// 1-line Pending card. Name only, ellipsis on overflow, glass row
    /// treatment per surface §"Card content — Created Pending card
    /// (1-line)". The trailing slot is reserved for the C-25 trigger
    /// via the card's right-padding budget.
    private func planCard(_ plan: PlansStore.Plan) -> some View {
        HStack(spacing: GTISpacing.step3) {
            Text(plan.name)
                .font(.system(size: 17, weight: .bold))
                .foregroundStyle(GTIColor.TextOnGradient.primary)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            // tb-WF-9 — reserve a 36pt trailing slot for the C-25
            // Action Dot trigger. The trigger renders as an overlay
            // sibling on the row; this spacer keeps the Plan name
            // from running under it when the title is long enough
            // to ellipsis.
            Spacer(minLength: ActionDotMenu.triggerDiameter)
                .frame(width: ActionDotMenu.triggerDiameter)
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
        // tb-WF-9 — extra trailing inset so the Plan name does not
        // run under the C-25 trigger overlaid on the trailing edge.
        .padding(.trailing, ActionDotMenu.triggerDiameter)
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

    /// wfr-06 — top-trailing settings chrome glyph. Honours the
    /// workflow-design hub's `Sign-In Tools` convention (upper-right
    /// for signed-in user tooling) and keeps the chrome visually
    /// quiet — SF Symbol `gearshape`, paper @ 0.72 opacity to match
    /// the same secondary-on-gradient register the gtiMark uses. Tap
    /// fires `onOpenSettings`; the host (RootView) flips
    /// `showingSettings = true` and SettingsScreen renders via the
    /// existing precedence chain.
    private var settingsGlyph: some View {
        Button(action: onOpenSettings) {
            ZStack {
                // 22pt tap target — matches the gtiMark's visual
                // weight so the chrome row reads as balanced.
                RoundedRectangle(cornerRadius: GTISpacing.step1, style: .continuous)
                    .fill(Color.clear)
                    .frame(width: 22, height: 22)
                Image(systemName: "gearshape")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(GTIColor.TextOnGradient.secondary)
            }
            // Expand the hit area to 44pt — HIG minimum — without
            // disturbing the visible 22pt glyph footprint.
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(Self.settingsGlyphAccessibilityIdentifier)
        .accessibilityLabel(Self.settingsGlyphAccessibilityLabel)
        .accessibilityHint(Self.settingsGlyphAccessibilityHint)
        .accessibilityAddTraits(.isButton)
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

    /// tb-WF-9 — fire the host callback for a confirmed destructive
    /// action. Delete dispatches `onDeletePlan(plan, status)`; Leave
    /// dispatches `onLeavePlan(row)`. The C-25 menu is closed and the
    /// confirm sheet is dismissed by the caller; this helper only
    /// runs the side effect.
    private func fireConfirmedAction(for context: ConfirmContext) {
        // Close any open menu on the same card so the popover doesn't
        // re-render against a removed row.
        openMenuPlanID = nil
        if let plan = context.createdPlan, let status = context.createdStatus {
            onDeletePlan(plan, status)
            return
        }
        if let row = context.joinedRow {
            onLeavePlan(row)
            return
        }
    }

    /// tb-WF-9 — build the C-25 menu items for an owned Plan card.
    /// The closure wires each item to the right side effect:
    /// `Edit plan` → `onTapPlan(plan)` (same destination as the
    /// tap-card shortcut, per the issue's `Edit plan functionally
    /// equivalent to tap-pending-card` acceptance criterion);
    /// `Delete plan` → opens the confirm sheet via `confirmContext`.
    private func menuItems(for plan: PlansStore.Plan) -> [ActionDotMenu.Item] {
        let labels = Self.menuItemLabels(role: .owner, status: plan.status)
        return labels.map { label in
            switch label {
            case Self.menuLabelEditPlan:
                return ActionDotMenu.Item(label: label) {
                    openMenuPlanID = nil
                    onTapPlan(plan)
                }
            case Self.menuLabelDeletePlan:
                return ActionDotMenu.Item(label: label, destructive: true) {
                    openMenuPlanID = nil
                    confirmContext = ConfirmContext.delete(plan: plan)
                }
            default:
                // Unreachable — the helper only returns the three
                // canonical labels — but a defensive fallback keeps
                // the surface from crashing if a future status adds a
                // new label without wiring.
                return ActionDotMenu.Item(label: label) { openMenuPlanID = nil }
            }
        }
    }

    /// tb-WF-9 — build the C-25 menu items for a Joined Plan card.
    /// Joined cards only ever carry `Leave plan` — see the menu
    /// items table in `surfaces/00-plan-list.md §"Three-dot menu
    /// (locked Q4)"`. The label opens the confirm sheet seeded with
    /// the `.joinedLeave` variant.
    private func menuItems(for row: PlansStore.JoinedPlanRow) -> [ActionDotMenu.Item] {
        return [
            ActionDotMenu.Item(label: Self.menuLabelLeavePlan, destructive: true) {
                openMenuPlanID = nil
                confirmContext = ConfirmContext.leave(row: row)
            }
        ]
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

    /// Test-only hook (tb-WF-9) — drive a `Delete plan` confirmation
    /// for a Created Plan card. Invokes the same host-callback path
    /// the visible primary pill uses, without driving the @State sheet
    /// presentation. Production code goes through the SwiftUI .sheet
    /// presenter.
    @MainActor
    func simulateDeletePlanConfirm(_ plan: PlansStore.Plan) {
        let ctx = ConfirmContext.delete(plan: plan)
        fireConfirmedAction(for: ctx)
    }

    /// Test-only hook (wfr-06) — drive the top-trailing settings
    /// chrome glyph tap without walking the SwiftUI view tree. Invokes
    /// the same `onOpenSettings` callback the visible glyph fires;
    /// production code goes through the Button + SwiftUI dispatcher.
    @MainActor
    func simulateOpenSettings() {
        onOpenSettings()
    }

    /// Test-only hook (tb-WF-9) — drive a `Leave plan` confirmation
    /// for a Joined Plan card.
    @MainActor
    func simulateLeavePlanConfirm(_ row: PlansStore.JoinedPlanRow) {
        let ctx = ConfirmContext.leave(row: row)
        fireConfirmedAction(for: ctx)
    }

    /// Test-only hook (bug-36) — seed the History search query. Drives
    /// the same @State storage the visible TextField binds to, so a
    /// render-smoke test can mount the filtered shape (matching or
    /// zero-match) without walking the SwiftUI text-input path.
    @MainActor
    func simulateHistorySearchQueryForTest(_ query: String) {
        historySearchState.query = query
    }
}
