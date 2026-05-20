// GetToIt — S00 · Plan list (tb-WF-5 → tb-WF-6 → tb-WF-7, workflow-overhaul).
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
//
// In the current state:
//   * Only the Pending section ever has rows — Decided + History
//     are wired through the API shape but always empty until tb-WF-8.
//     Pending cards may be either Created (no chip, tap → Setup
//     `.edit`) or Joined (JOINED eyebrow chip in `var(--sun)`, tap
//     routed through the §Q8 resume-from-state table).
//   * 1-line Pending cards, glass row treatment per C-19 lineage.
//     No three-dot menu (tb-WF-9).
//   * Empty state: centered hero pill `Create your first plan` — the
//     only create affordance when the user has zero Plans (joined
//     OR created). The pill opens the disambig sheet (unified entry,
//     per Q6) — same path as the FAB.
//   * Populated state: C-26 FloatingActionButton on the bottom-right
//     edge. Both the FAB and the empty-state hero pill open the same
//     disambig sheet (`PlanDisambigSheet`); the sheet's pick callback
//     routes to `SetupScreen(mode: .solo)` or `SetupScreen(mode: .group)`.
//   * Pending Created card tap → `SetupScreen` in `.edit` mode for
//     the tapped Plan.
//   * Pending Joined card tap → host dispatches via `JoinedTapDestination`
//     to QuizScreen (resumed at the saved step) / WaitingScreen /
//     read-only Verdict.
//
// All color / type / spacing / radii come from `GTITokens.swift` per
// repo CLAUDE.md — no inline hex / px / easing.

import SwiftUI

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

    /// Empty-state detection. In this slice only `pending` and
    /// `joined` ever have rows (Decided + History always-empty until
    /// tb-WF-8). A Plan list is empty iff BOTH arrays are empty —
    /// a user with only Joined Plans still has plans on their list,
    /// and the empty hero must not flash in their face.
    public static func isEmpty(
        pending: [PlansStore.Plan],
        joined: [PlansStore.JoinedPlanRow]
    ) -> Bool {
        pending.isEmpty && joined.isEmpty
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

    // MARK: - dependencies (host-supplied)

    private let pending: [PlansStore.Plan]
    private let joined: [PlansStore.JoinedPlanRow]
    private let onRequestDisambig: () -> Void
    private let onPickGroupMode: (SetupScreen.GroupMode) -> Void
    private let onTapPlan: (PlansStore.Plan) -> Void
    private let onTapJoined: (PlansStore.JoinedPlanRow) -> Void

    // MARK: - state

    /// Local presentation state for the disambig sheet. Both the FAB
    /// and the empty-state hero pill flip this true, which mounts
    /// `PlanDisambigSheet` via SwiftUI's `.sheet` modifier. Surface-
    /// local UI state — the host doesn't need to own this.
    @State private var disambigOpen: Bool = false

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
        onRequestDisambig: @escaping () -> Void,
        onPickGroupMode: @escaping (SetupScreen.GroupMode) -> Void,
        onTapPlan: @escaping (PlansStore.Plan) -> Void,
        onTapJoined: @escaping (PlansStore.JoinedPlanRow) -> Void = { _ in }
    ) {
        self.pending = pending
        self.joined = joined
        self.onRequestDisambig = onRequestDisambig
        self.onPickGroupMode = onPickGroupMode
        self.onTapPlan = onTapPlan
        self.onTapJoined = onTapJoined
    }

    // MARK: - body

    public var body: some View {
        ZStack(alignment: .bottomTrailing) {
            GTIGradient.surface(.initiator)
                .ignoresSafeArea()

            if Self.isEmpty(pending: pending, joined: joined) {
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

                    pendingSection
                        .padding(.top, GTISpacing.step5)

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
                .accessibilityIdentifier("planList.section.pending.label")

            Text("(\(count))")
                .font(.system(size: GTIFont.Size.eyebrow, weight: .bold))
                .foregroundStyle(GTIColor.TextOnGradient.tertiary)
                .accessibilityIdentifier("planList.section.pending.count")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, GTISpacing.step6)
        .padding(.top, GTISpacing.step3)
        .padding(.bottom, GTISpacing.step2)
        .frame(minHeight: 44, alignment: .leading)
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
}
