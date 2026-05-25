// GetToIt — QuizCoordinator (TB-04 schema, TB-06 question rework).
//
// Holds the user's Q1–Q4 answers locally as they advance through the
// quiz. Writes a single `votes` row on Q5 submit. One round-trip per
// room per user.
//
// Quiz-redesign question rework (PRD module J, part 1 — issue tb-06):
//   * Q1 — cuisine craving. Multi-select cuisine chips, capped at 3,
//     with a mutually-exclusive "No preference" toggle. A soft scoring
//     signal, not a hard veto (dietary vetoes moved to the profile).
//   * Q2 — spend cap. A hard ceiling on spend. Unchanged 4-tier shape.
//   * Q3 — reputation / discovery. A single-select chip picker
//     (Popular / Hidden gem / Classic / New / No preference).
//   * Q4 — vibe energy. A 5-point cardinal scale (Quiet…Rowdy).
//
// Why a single submit rather than per-question writes:
//   * The quiz has no back arrow (PRD user story 21 + S03 cross-quiz
//     invariants). Partial answers don't have observers — there's no
//     reason to surface them in the DB.
//   * Partial-quiz exits via `×` must NOT write a partial row.
//   * The (room_id, user_id) unique constraint makes per-question
//     writes awkward — they'd require UPDATE semantics, but the RLS
//     contract is "no UPDATE policy → no updates."
//   * One round-trip simplifies the failure-mode story. A retry on
//     transient network errors hits the same unique-constraint reject
//     the second time, which the coordinator treats as success.
//
// Q5 candidates: TB-08 wires the real factorial-probe set from the
// per-member Foursquare fetch. TB-26 removed the legacy fictitious
// fixture fallback entirely — when the fetch produces no factorial-usable pool
// the candidate list is empty and Q5 renders the no-results screen
// (sg-05's `no-results` mode); the app never surfaces a fictitious
// venue. The coordinator's `submit(...)` interface is unchanged.
//
// TB-15 (quiz redesign) — the per-member Foursquare fetch now fires from the
// coordinator's quiz step machine: when the member advances Q4 -> Q5,
// `advance()` kicks off `QuizCandidateFetch.fetchCandidates(...)` with
// the member's REAL Q1 cuisines + Q2 spend cap + session parameters.
// The candidate list starts empty and is populated when the fetch
// resolves; `q5CandidatesState` tracks the in-flight / ready / fallback
// status so Q5 can render a loading state until the answer-tailored
// pool lands. The pre-quiz empty-filter fetch (the bug-03 bridge) is
// gone — no PlacesProxy / Foursquare call fires before Q1-Q4 are
// answered.
//
// All visual code lives in `QuizQ{1..5}*.swift`. The coordinator is
// intentionally view-free so it can be tested without SwiftUI.

import Foundation
import Supabase

/// A Q5 candidate (place the user can rate). Always a real venue —
/// TB-08 wires real `options.id` values from the per-member Foursquare
/// fetch. TB-26 removed the fictitious-fixture path; an empty candidate
/// list now means the no-results screen renders.
public struct QuizCandidate: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let meta: String   // e.g. "Mexican · $$ · 8 min"
    /// TB-24: the factorial axis this card deviates on. Set when the
    /// candidate is a `Q5FactorialCardGenerator` card — each of the
    /// three factorial cards drops exactly one distinct axis. `nil` on
    /// candidates that did not come from the factorial (a test fixture);
    /// the vote write then assigns axes positionally so the
    /// `votes.q5.answer.ratings` array is still well-formed (one entry
    /// per axis). Carried for the verdict's per-member preference
    /// re-weight — `compute-verdict` reads each axis's weight from its
    /// drop-card-vs-keep-card rating spread. The Q5 surface ignores it.
    public let droppedAxis: Q5FactorialCard.Axis?

    public init(
        id: String,
        name: String,
        meta: String,
        droppedAxis: Q5FactorialCard.Axis? = nil
    ) {
        self.id = id
        self.name = name
        self.meta = meta
        self.droppedAxis = droppedAxis
    }
}

/// Outcome of a Q5 submit. `idempotent` lets callers treat a unique-
/// constraint reject as success (the row already exists for this
/// (room, user) — the user already submitted, so we land on Waiting).
public enum QuizSubmitOutcome: Equatable, Sendable {
    case written
    case idempotent
}

/// Reusable shape for the network write. Indirected through a closure
/// so unit tests can drive the coordinator without a live Supabase
/// client and so the integration test can swap the closure for one
/// that exercises a recorded fixture.
public typealias QuizVoteWriter = @Sendable (QuizCoordinator.VoteRow) async throws -> Void

/// bug-14 (quiz redesign) — the failure-surfacing seam for the `member_fetches`
/// persist. Before bug-14 a failed `member_fetches` write was caught
/// and dropped inside `persistRawFetch`, so a failed or slow persist
/// was invisible: no telemetry, no retry, no signal — and the verdict
/// could fire against a `member_fetches` table missing the member's
/// row with nothing recording why.
///
/// The coordinator invokes this closure with the thrown error whenever
/// the `member_fetches` write fails. Production binds it to a
/// telemetry emission (`member_fetch_persist_failed`); the unit tests
/// bind a capture spy. Optional — when nil the failure is still
/// observable via `QuizCoordinator.lastMemberFetchPersist`.
///
/// `@Sendable` so it can be invoked from inside the coordinator's
/// fetch task, which crosses an actor hop.
public typealias MemberFetchPersistFailureSink = @Sendable (Error) -> Void

@MainActor
@Observable
public final class QuizCoordinator {

    /// Active question the user is on. Advances forward only — there's
    /// no back arrow per S03 invariants.
    ///
    /// `Hashable` so SwiftUI can use the step as a stable `.id(...)` on
    /// the content router in `QuizScreen` (drives the bug-04 card
    /// cross-fade — see `motion.md` §"Question card cross-fade").
    public enum Step: Hashable, Sendable {
        case q1, q2, q3, q4, q5
        case submitting
        case submitted    // user landed past Q5
        case failed(String)
    }

    public private(set) var step: Step = .q1

    /// TB-15 (quiz redesign) — the per-member candidate fetch lifecycle. The
    /// fetch fires once, on the Q4 -> Q5 transition; Q5 reads this to
    /// decide between a loading state and the rendered card list.
    public enum Q5CandidatesState: Equatable, Sendable {
        /// The member has not yet reached Q5 — no fetch attempted.
        case idle
        /// The per-member fetch is in flight (Q4 -> Q5 transition fired
        /// it). Q5 renders a loading state.
        case loading
        /// The fetch resolved with real venues from the executor's
        /// unioned pool.
        case ready
        /// The fetch produced no factorial-usable pool — an empty
        /// union, a `nil` factorial, a thrown fetch, or no session
        /// coordinate. Q5 renders the no-results screen (sg-05's
        /// `no-results` mode); the member is never stranded. TB-26
        /// replaced the prior `fallbackDummy` fixture state — the app
        /// never surfaces a fictitious venue.
        case noResults
    }

    public private(set) var q5CandidatesState: Q5CandidatesState = .idle

    /// bug-14 (quiz redesign) — the outcome of the member's `member_fetches`
    /// persist. The verdict must never fire against a `member_fetches`
    /// table missing this member's row because of a race or a dropped
    /// error; this makes the persist's result observable so `submit()`
    /// (which now awaits the persist) and the tests can reason about it.
    ///
    /// `notAttempted` — no `memberFetchWriter` injected (legacy init /
    /// unit tests), or the per-member fetch never ran.
    /// `written` — the `member_fetches` row landed. The payload may be
    /// empty: bug-14 records a genuinely empty fetch as a real row so
    /// the server can tell "no candidates" from "write never ran".
    /// `failed` — the write threw. Surfaced, never swallowed: the
    /// `MemberFetchPersistFailureSink` (if injected) also fired.
    public enum MemberFetchPersist: Equatable, Sendable {
        case notAttempted
        case written
        case failed(String)
    }

    public private(set) var lastMemberFetchPersist: MemberFetchPersist = .notAttempted

    /// The cuisine-craving cap. Q1 allows at most this many cuisine
    /// picks before further selections are prevented (PRD user story
    /// 13 — "be prevented from selecting more than 3 cuisines").
    public static let cuisineCap = 3

    /// Captured answers.
    ///
    /// Q1 — cuisine craving. `q1Cuisines` is the multi-select set (max
    /// `cuisineCap`); `q1NoPreference` is the mutually-exclusive "No
    /// preference" flag. The two are never both non-empty.
    public private(set) var q1Cuisines: Set<String> = []
    public private(set) var q1NoPreference: Bool = false
    /// Q2 — spend cap. Tier 1…4 ($, $$, $$$, $$$$). Defaults to tier 1.
    public private(set) var q2Budget: Int = 1
    /// Q3 — reputation / discovery chip. Defaults to "No preference" —
    /// the neutral, non-pruning answer.
    public private(set) var q3Reputation: String = QuizReputation.noPreference
    /// Q4 — vibe energy. 0…4 on the Quiet…Rowdy scale. Defaults mid.
    public private(set) var q4Vibe: Int = 2
    public private(set) var q5Ratings: [String: Int] = [:]

    private let roomID: UUID
    private let userID: UUID
    /// Q5 candidate list. TB-15: mutable — when a `candidateFetch` is
    /// supplied this starts empty and is populated by the per-member
    /// fetch on the Q4 -> Q5 transition. The legacy `candidates:` init
    /// path (unit tests, snapshot harness) seeds this directly and
    /// leaves `candidateFetch` nil, so the fetch never fires.
    private var candidates: [QuizCandidate]
    private let writer: QuizVoteWriter

    /// TB-15 (quiz redesign) — the per-member Foursquare fetch. Non-nil on the
    /// live quiz path (`QuizSessionAssembler` injects a
    /// `FoursquareQuizCandidateFetch`); nil on the legacy explicit-
    /// `candidates:` path so the unit tests stay fetch-free.
    private let candidateFetch: QuizCandidateFetch?

    /// TB-21 (quiz redesign) — the writer that persists the member's full raw
    /// Foursquare fetch into the server-readable `member_fetches`
    /// table. Fired once, when the per-member fetch resolves on the
    /// Q4 -> Q5 transition.
    ///
    /// Parent bug-08: before TB-21 the fetched venue union was used to
    /// pick the three Q5 factorial cards and then discarded — nothing
    /// ever populated the server-side `options` table, so the verdict
    /// engine had no candidate pool. This writer persists the raw
    /// union so `compute-verdict` can union every member's fetch into
    /// `options` at verdict fire time.
    ///
    /// Nil on the legacy explicit-`candidates:` init and whenever the
    /// caller does not supply one (no session coordinate / unit
    /// tests); the persistence step is then simply skipped.
    private let memberFetchWriter: MemberFetchWriter?

    /// bug-14 (quiz redesign) — the failure-surfacing seam for the
    /// `member_fetches` persist. Invoked with the thrown error when the
    /// write fails. Optional: the live quiz path binds it to a
    /// telemetry emission; unit / boundary tests omit it (the failure
    /// is still observable via `lastMemberFetchPersist`).
    private let memberFetchFailureSink: MemberFetchPersistFailureSink?

    /// In-flight per-member fetch task, so a re-entrant Q4 -> Q5
    /// transition (or a defensive double-`advance()`) folds into the
    /// already-running fetch instead of firing the N+1 calls twice.
    private var fetchTask: Task<Void, Never>?

    /// TB-05 (quiz redesign) — the session-wide *parameters* bucket (meal time,
    /// group context, service shape, transport mode). Set once by the
    /// initiator on the S01b surface and persisted on the room; the
    /// joiner path hydrates it off `rooms.session_params` so every
    /// member's quiz runs against the SAME parameters without the
    /// joiner re-prompting. Carried on the coordinator so the
    /// downstream Foursquare fetch planner and verdict engine
    /// (later tracer bullets — PRD modules D / B) can consume it
    /// without re-fetching the room.
    public let sessionParameters: SessionParameters

    /// In-flight submit task so a rapid-tap on "Drop the verdict" can
    /// fold into the already-running write instead of issuing a second
    /// one. Without this, the rapid-tap case fires a second insert that
    /// the unique constraint rejects with a 23505 — surface-correct,
    /// but a wasted round-trip we can avoid cheaply.
    private var inflight: Task<QuizSubmitOutcome, Error>?

    /// tb-WF-7 — the seam that persists in-flight quiz progress to
    /// `members.quiz_progress` on every Q1..Q4 -> next-Q advance. Nil
    /// on every init path that does not opt in (legacy unit tests,
    /// snapshot harness, the create-flow initiator who is never going
    /// to resume on their own list — the resume contract is joiner-
    /// side per §Q8). When non-nil, `advance()` fires it from a
    /// detached Task with the post-advance progress payload.
    /// Best-effort: a thrown error is caught and dropped so a
    /// transient network failure never strands the quiz on a step
    /// transition. See `QuizProgress.swift` for the wire shape.
    private let progressWriter: MemberProgressWriter?

    /// Legacy init — Q5 candidates are supplied up front. Used by the
    /// unit tests and the snapshot harness; the per-member fetch never
    /// fires on this path (`candidateFetch` is nil). `candidates`
    /// defaults to empty — tests that exercise Q5 rating pass an
    /// explicit test fixture (`QuizCandidateFixtures.all`). Production
    /// always uses the `candidateFetch` init below.
    ///
    /// tb-WF-7 — `initialProgress` hydrates the coordinator from a
    /// saved snapshot of Q1..Q4 answers + a `lastIndex` that decides
    /// the starting step (e.g. lastIndex=3 -> Q4 with Q1/Q2/Q3 pre-
    /// loaded). `progressWriter` persists the progress payload on
    /// every subsequent advance. Both are nil-default so existing
    /// call sites compile unchanged.
    public init(
        roomID: UUID,
        userID: UUID,
        candidates: [QuizCandidate] = [],
        sessionParameters: SessionParameters = .default,
        writer: @escaping QuizVoteWriter,
        initialProgress: QuizProgress? = nil,
        progressWriter: MemberProgressWriter? = nil
    ) {
        self.roomID = roomID
        self.userID = userID
        self.candidates = candidates
        self.sessionParameters = sessionParameters
        self.candidateFetch = nil
        self.memberFetchWriter = nil
        self.memberFetchFailureSink = nil
        self.writer = writer
        self.progressWriter = progressWriter
        // Seed Q5 ratings at the spec'd default (3 — middle of the
        // 1–5 scale) so the surface renders with a chosen state per
        // card and the user can submit without touching every card.
        self.q5Ratings = QuizCoordinator.seededRatings(for: candidates)
        // Hydrate from saved progress AFTER the @State defaults land —
        // `applyInitialProgress` rewrites step + answers in place.
        if let initialProgress { applyInitialProgress(initialProgress) }
    }

    /// TB-15 (quiz redesign) — the live-quiz init. Q5 candidates are NOT supplied
    /// up front; the candidate list starts empty and the per-member
    /// Foursquare fetch (`candidateFetch`) fires on the Q4 -> Q5
    /// transition with the member's real Q1-Q4 answers. This is the
    /// init `QuizSessionAssembler` uses for the running quiz — no
    /// PlacesProxy / Foursquare call fires before Q1-Q4 are answered.
    ///
    /// TB-21 (quiz redesign) — `memberFetchWriter` persists the member's full
    /// raw Foursquare fetch into the server-readable `member_fetches`
    /// table when the per-member fetch resolves. Optional: the live
    /// quiz path supplies one (`QuizSessionAssembler` injects a
    /// `MemberFetchSupabaseWriter`); the boundary tests omit it and the
    /// persistence step is skipped.
    ///
    /// bug-14 (quiz redesign) — `memberFetchFailureSink` surfaces a failed
    /// `member_fetches` write (the live quiz path binds it to a
    /// telemetry emission). Optional: unit / boundary tests omit it and
    /// the failure stays observable via `lastMemberFetchPersist`.
    ///
    /// tb-WF-7 — `initialProgress` + `progressWriter` work identically
    /// to the legacy init. The live joiner path uses this init with
    /// both args populated so a backgrounded mid-quiz resumes correctly
    /// AND the in-flight answers continue to persist as the joiner
    /// advances.
    public init(
        roomID: UUID,
        userID: UUID,
        candidateFetch: QuizCandidateFetch,
        memberFetchWriter: MemberFetchWriter? = nil,
        memberFetchFailureSink: MemberFetchPersistFailureSink? = nil,
        sessionParameters: SessionParameters = .default,
        writer: @escaping QuizVoteWriter,
        initialProgress: QuizProgress? = nil,
        progressWriter: MemberProgressWriter? = nil
    ) {
        self.roomID = roomID
        self.userID = userID
        self.candidates = []
        self.sessionParameters = sessionParameters
        self.candidateFetch = candidateFetch
        self.memberFetchWriter = memberFetchWriter
        self.memberFetchFailureSink = memberFetchFailureSink
        self.writer = writer
        self.progressWriter = progressWriter
        self.q5Ratings = [:]
        if let initialProgress { applyInitialProgress(initialProgress) }
    }

    /// tb-WF-7 — hydrate the coordinator's step + per-question state
    /// from a saved `QuizProgress`. Called from both init paths after
    /// the `self.*` defaults land, so the rewrite is unconditional.
    ///
    /// Step mapping (1-based — `lastIndex` is the question the joiner
    /// is currently on, NOT the next-unanswered question per
    /// surfaces/00-plan-list.md §Q8 "resumes the quiz at Q3 (their
    /// last-answered question, NOT Q1)"):
    ///   * `0` → Q1 (joiner never started; the surface lands on Q1
    ///     anyway, this is the "not touched" sentinel).
    ///   * `1` → Q1, `2` → Q2, `3` → Q3, `4` → Q4, `5` → Q5.
    ///   * `>=5` clamps to Q5 — the `votes` row is the canonical
    ///     "past Q5" signal, not the progress index. A stale
    ///     progress payload must never land the user on `.submitted`
    ///     and skip the explicit submit.
    private func applyInitialProgress(_ progress: QuizProgress) {
        if let q1 = progress.q1 {
            self.q1Cuisines = Set(q1.cuisines)
            self.q1NoPreference = q1.noPreference
        }
        if let q2 = progress.q2 {
            self.q2Budget = q2.tier
        }
        if let q3 = progress.q3 {
            self.q3Reputation = q3.reputation
        }
        if let q4 = progress.q4 {
            self.q4Vibe = q4.level
        }
        switch progress.lastIndex {
        case ..<1: self.step = .q1
        case 1:    self.step = .q1
        case 2:    self.step = .q2
        case 3:    self.step = .q3
        case 4:    self.step = .q4
        default:   self.step = .q5  // lastIndex >= 5 lands on Q5
        }
    }

    /// tb-WF-7 — pack the live coordinator state into a `QuizProgress`
    /// snapshot. Used internally to fire the progress writer after
    /// each advance and exposed publicly so tests can inspect the
    /// shape without poking @Observable fields.
    ///
    /// `lastIndex` is the 1-based current-step number — Q1 stamps 1,
    /// Q2 stamps 2, … Q5 stamps 5. The "user backgrounded at Q3"
    /// resume contract reads this directly: a row carrying
    /// `last_index = 3` re-lands the joiner on Q3.
    public var quizProgressSnapshot: QuizProgress {
        QuizProgress(
            lastIndex: currentStepIndex,
            q1: QuizProgress.Q1Answer(
                cuisines: q1Cuisines.sorted(),
                noPreference: q1NoPreference
            ),
            q2: QuizProgress.Q2Answer(tier: q2Budget),
            q3: QuizProgress.Q3Answer(reputation: q3Reputation),
            q4: QuizProgress.Q4Answer(level: q4Vibe)
        )
    }

    /// The `last_index` value to stamp in the post-advance progress
    /// payload — the 1-based current-step number. `submitting` /
    /// `submitted` / `failed` are post-Q5 terminal states; they
    /// stamp 5 (the `votes` row is the ground truth past that).
    private var currentStepIndex: Int {
        switch step {
        case .q1: return 1
        case .q2: return 2
        case .q3: return 3
        case .q4: return 4
        case .q5: return 5
        case .submitting, .submitted, .failed: return 5
        }
    }

    /// Seed Q5 ratings at the spec'd default (3 — middle of the 1…5
    /// scale) so every card renders with a chosen state and the user
    /// can submit without touching every card.
    private static func seededRatings(for candidates: [QuizCandidate]) -> [String: Int] {
        var seed: [String: Int] = [:]
        for c in candidates { seed[c.id] = 3 }
        return seed
    }

    public var allCandidates: [QuizCandidate] { candidates }

    // MARK: - Q1 — cuisine craving

    /// True while the cuisine set has room for another pick. The Q1
    /// surface dims unselected chips when this is false.
    public var q1HasFreeCuisineSlot: Bool {
        q1Cuisines.count < QuizCoordinator.cuisineCap
    }

    /// Toggle a Q1 cuisine chip.
    ///
    /// Rules (PRD user stories 11–13 + `surfaces/03-quiz.md` §Q1):
    ///   * Selecting a cuisine clears the "No preference" flag — the
    ///     two are mutually exclusive.
    ///   * The set is capped at `cuisineCap` (3). A pick that would
    ///     exceed the cap is prevented (no-op). Deselecting a cuisine
    ///     always works — it frees a slot.
    public func toggleCuisine(_ id: String) {
        if q1Cuisines.contains(id) {
            q1Cuisines.remove(id)
            return
        }
        // A new selection — cap-gated.
        guard q1HasFreeCuisineSlot else { return }
        q1NoPreference = false
        q1Cuisines.insert(id)
    }

    /// Toggle the mutually-exclusive "No preference" cuisine option.
    /// Selecting it clears every cuisine pick; re-tapping clears it.
    public func toggleCuisineNoPreference() {
        if q1NoPreference {
            q1NoPreference = false
        } else {
            q1NoPreference = true
            q1Cuisines.removeAll()
        }
    }

    // MARK: - Q2 — spend cap

    public func setBudget(_ tier: Int) {
        precondition((1...4).contains(tier), "q2_budget must be 1...4")
        q2Budget = tier
    }

    // MARK: - Q3 — reputation / discovery

    public func setReputation(_ reputation: String) {
        precondition(QuizReputation.all.contains(where: { $0.id == reputation }),
                     "q3_reputation must be one of \(QuizReputation.all.map(\.id))")
        q3Reputation = reputation
    }

    // MARK: - Q4 — vibe energy

    public func setVibe(_ index: Int) {
        precondition((0..<GTIVibeLabels.all.count).contains(index),
                     "q4_vibe must be 0..<\(GTIVibeLabels.all.count)")
        q4Vibe = index
    }

    // MARK: - Q5

    public func setRegret(candidateID: String, score: Int) {
        precondition((1...5).contains(score), "q5 score must be 1...5")
        guard candidates.contains(where: { $0.id == candidateID }) else { return }
        q5Ratings[candidateID] = score
    }

    // MARK: - Step navigation

    /// Advance from a question to the next one. No-ops if we're
    /// already past Q5 or in the middle of a submit. Forward-only.
    ///
    /// No answer is required to advance — `advance()` always moves
    /// forward, so the flow never stalls on a Q1-Q4 step (PRD user
    /// story 21).
    ///
    /// tb-WF-7 — every Q1..Q4 -> next-Q advance fires the optional
    /// `progressWriter` with the post-advance snapshot so a joiner
    /// who backgrounds the app mid-quiz can resume from the saved
    /// state on next launch (see §Q8 in surfaces/00-plan-list.md).
    /// Best-effort: a thrown error inside the writer is caught and
    /// dropped so a transient network failure never strands the
    /// quiz on a step transition. The Q5 -> submit transition is
    /// owned by `submit()`, not `advance()`, so the writer never
    /// fires for the final hop — the `votes` row is the canonical
    /// "past Q5" signal.
    public func advance() {
        let advanced: Bool
        switch step {
        case .q1: step = .q2; advanced = true
        case .q2: step = .q3; advanced = true
        case .q3: step = .q4; advanced = true
        case .q4:
            step = .q5
            advanced = true
            // TB-15 (quiz redesign) — completing Q4 is the trigger for the
            // per-member Foursquare fetch. The member has now answered
            // Q1 (cuisines) and Q2 (spend cap); fire the answer-tailored
            // N+1 calls. No PlacesProxy / Foursquare call fires before
            // this point.
            startCandidateFetchIfNeeded()
        case .q5, .submitting, .submitted, .failed:
            advanced = false  // submit is a separate explicit call
        }
        if advanced { fireProgressWriterIfNeeded() }
    }

    /// tb-WF-7 — fire the optional progress writer with the current
    /// snapshot. Best-effort: the call runs in a detached Task so a
    /// slow network round-trip never blocks the step transition, and
    /// a thrown error is caught and dropped (the column is a resume-
    /// from-state convenience, not a verdict-engine input).
    private func fireProgressWriterIfNeeded() {
        guard let progressWriter else { return }
        let snapshot = quizProgressSnapshot
        Task {
            do { try await progressWriter(snapshot) }
            catch { /* best-effort — degrade silently */ }
        }
    }

    /// tb-WF-2 — step one question backward. Wired to the `Back`
    /// affordance on the QuizChrome row (sg-WF-2 spec). Per-member;
    /// no room mutation, no server call. The prior answer is already
    /// held in the coordinator's @Observable state (`q1Cuisines`,
    /// `q2Budget`, `q3Reputation`, `q4Vibe`, `q5Ratings`), so the
    /// stepped-to surface re-renders pre-selected and re-editable
    /// automatically — `back()` only flips `step`.
    ///
    /// Q1 has no prior question. Calling `back()` on Q1 is a safe
    /// no-op rather than an underflow: the chrome guards the
    /// affordance via `canBack: false`, but defending the coordinator
    /// belt-and-braces means a stray invocation can never corrupt the
    /// step machine.
    ///
    /// Stepping back from Q5 lands on Q4 with the already-resolved
    /// Q5 candidate list preserved — we do NOT re-fire the per-member
    /// Foursquare fetch on the next Q4 -> Q5 advance (the
    /// `q5CandidatesState` guard in `startCandidateFetchIfNeeded`
    /// drops re-entrant calls, so a forward step that follows a
    /// Back step re-uses the existing candidates rather than
    /// double-billing Foursquare and stacking duplicate
    /// `member_fetches` rows).
    ///
    /// `submitting` / `submitted` / `failed` are post-submit terminal
    /// states; Back is unreachable from them (no quiz chrome on the
    /// submitting / submitted views) and the call is a no-op.
    public func back() {
        switch step {
        case .q1:
            break  // unreachable from UI (canBack: false); defensive no-op
        case .q2: step = .q1
        case .q3: step = .q2
        case .q4: step = .q3
        case .q5: step = .q4
        case .submitting, .submitted, .failed:
            break
        }
    }

    // MARK: - Q5 candidate fetch (TB-15)

    /// Fire the per-member Foursquare fetch, once, on the Q4 -> Q5
    /// transition. No-op when the coordinator was built via the legacy
    /// explicit-`candidates:` init (`candidateFetch` is nil) or when a
    /// fetch is already in flight / complete.
    ///
    /// The fetch forwards the member's REAL Q1-Q4 answers + the shared
    /// session parameters. Q1 cuisines + Q2 spend cap drive the N+1
    /// `FoursquareFetchExecutor` calls (never an empty `PlacesFilters()`);
    /// TB-16 additionally forwards Q3 reputation + Q4 vibe so the
    /// downstream factorial probe (`Q5FactorialCardGenerator`) can build
    /// the member's `Q5MemberProfile`.
    private func startCandidateFetchIfNeeded() {
        guard let candidateFetch else { return }
        guard q5CandidatesState == .idle, fetchTask == nil else { return }

        q5CandidatesState = .loading
        let answers = QuizFetchAnswers(
            cuisines: q1NoPreference ? [] : q1Cuisines.sorted(),
            budgetTier: q2Budget,
            reputation: q3Reputation,
            vibe: q4Vibe
        )
        let parameters = sessionParameters

        fetchTask = Task { [weak self] in
            let result = await candidateFetch.fetchCandidates(
                answers: answers,
                parameters: parameters
            )
            guard let self else { return }
            self.applyFetchResult(result)
            // TB-21 — persist the member's full raw fetched union into
            // `member_fetches` so the server can union it into
            // `options` at verdict fire time. Awaited inside the fetch
            // task so `awaitCandidateFetch()` covers the persistence
            // too; best-effort, so a write failure never strands Q5.
            //
            // bug-14: the persist is awaited as the LAST step of the
            // task body and `fetchTask` is cleared only here, after the
            // persist resolves — never inside `applyFetchResult`. A
            // `submit()` that calls `awaitCandidateFetch()` must wait
            // for the persist, not just the fetch; clearing the handle
            // mid-task would let `submit()` race past an in-flight
            // `member_fetches` write and fire the verdict early.
            await self.persistRawFetch(result.rawFetch)
            self.fetchTask = nil
        }
    }

    /// TB-21 — persist the member's full raw Foursquare fetch into the
    /// server-readable `member_fetches` table.
    ///
    /// Parent bug-08: the fetched venue union was discarded after the
    /// Q5 factorial picked its three cards, so the verdict engine had
    /// no candidate pool. This write closes that gap — the
    /// `compute-verdict` Edge Function unions every member's persisted
    /// fetch into `options` at verdict fire time.
    ///
    /// bug-14 (quiz redesign) — two changes to the pre-bug-14 behavior:
    ///
    ///   * **An empty raw fetch is now recorded, not skipped.** Before
    ///     bug-14 an empty `rawFetch` was guarded out entirely, so no
    ///     `member_fetches` row was written — indistinguishable
    ///     downstream from "the write never ran." A genuinely empty
    ///     fetch (every call came back empty / the fetch threw) is now
    ///     persisted as a real row with an empty `payload`, so the
    ///     server can tell "this member has no candidates" apart from
    ///     "this member's write never landed."
    ///   * **A write failure is surfaced, not swallowed.** The thrown
    ///     error is recorded on `lastMemberFetchPersist` and forwarded
    ///     to the `memberFetchFailureSink` (telemetry on the live
    ///     path). The persist stays best-effort — the member is never
    ///     stranded — but the failure is no longer invisible.
    ///
    /// Skipped only when no `memberFetchWriter` was injected (legacy
    /// init / unit tests); `lastMemberFetchPersist` then stays
    /// `.notAttempted`.
    private func persistRawFetch(_ rawFetch: [ShapedPlace]) async {
        guard let memberFetchWriter else { return }
        // bug-14: the row is written even when `rawFetch` is empty. An
        // empty `payload` is a deliberate "this member fetched nothing"
        // record — the server reads the row's presence to distinguish a
        // genuinely empty fetch from a write that never ran.
        let row = MemberFetchRow(
            roomID: roomID,
            userID: userID,
            payload: rawFetch
        )
        do {
            try await memberFetchWriter(row)
            lastMemberFetchPersist = .written
        } catch {
            // bug-14: the failure is surfaced — recorded for callers to
            // observe and forwarded to the failure sink (telemetry on
            // the live path) — never silently swallowed. The persist
            // stays best-effort: the member still reaches Q5 and can
            // submit even though their fetch missed `options`.
            lastMemberFetchPersist = .failed(String(describing: error))
            memberFetchFailureSink?(error)
        }
    }

    /// Fold a resolved per-member fetch into the coordinator: install
    /// the candidate list, seed the Q5 ratings, and flip
    /// `q5CandidatesState` so Q5 swaps the loading state for the cards.
    ///
    /// bug-14: this no longer clears `fetchTask`. The handle is cleared
    /// only after `persistRawFetch` resolves (see
    /// `startCandidateFetchIfNeeded`) so `awaitCandidateFetch()` — and
    /// therefore `submit()` — waits for the `member_fetches` persist,
    /// not just the fetch.
    private func applyFetchResult(_ result: QuizCandidateFetchResult) {
        candidates = result.candidates
        q5Ratings = QuizCoordinator.seededRatings(for: result.candidates)
        switch result.source {
        case .fetched:    q5CandidatesState = .ready
        case .noResults:  q5CandidatesState = .noResults
        }
    }

    /// Await the in-flight per-member fetch AND its `member_fetches`
    /// persist, if any. Exposed so the boundary tests can
    /// deterministically observe the post-fetch candidate list without
    /// polling. A no-op when no fetch is running.
    ///
    /// bug-14: `submit()` calls this before the verdict-firing `votes`
    /// write, so the verdict never fires against a `member_fetches`
    /// table missing this member's row. The awaited task body runs the
    /// fetch, applies the result, then awaits `persistRawFetch` — so a
    /// single await here covers both phases.
    public func awaitCandidateFetch() async {
        await fetchTask?.value
    }

    /// Submit the assembled vote row. Idempotent on retry — a unique-
    /// constraint reject from a prior successful write resolves as
    /// `.idempotent`.
    ///
    /// bug-14 (quiz redesign) — the verdict-firing `votes` write is gated behind
    /// the member's candidate fetch AND its `member_fetches` persist.
    /// The `votes` insert triggers the server-side verdict fire; before
    /// bug-14 `submit()` did not await the per-member fetch task, so a
    /// member who completed Q5 faster than their background fetch could
    /// fire the verdict before their `member_fetches` row existed — the
    /// `options` union then assembled a pool that did not reflect that
    /// member. Awaiting `fetchTask` here closes that race: the fetch
    /// task awaits `persistRawFetch` internally, so a single
    /// `awaitCandidateFetch()` covers both the fetch and the persist.
    @discardableResult
    public func submit() async -> Result<QuizSubmitOutcome, Error> {
        // Fold rapid-tap submits into a single write.
        if let inflight {
            do { return .success(try await inflight.value) }
            catch { return .failure(error) }
        }

        step = .submitting
        // bug-14: gate the verdict-firing write on the member's
        // candidate fetch + `member_fetches` persist. A no-op when no
        // fetch is in flight (legacy explicit-`candidates:` init, or
        // the fetch already resolved before Q5 submit) — the rapid-tap
        // fold above and the step machine below are untouched.
        await awaitCandidateFetch()
        let row = buildRow()
        let task = Task<QuizSubmitOutcome, Error> { [writer] in
            do {
                try await writer(row)
                return .written
            } catch {
                if QuizCoordinator.isUniqueViolation(error) {
                    // The row already exists for this (room, user) — a
                    // prior submit succeeded. From the user's POV, we
                    // are done; surface the Waiting state.
                    return .idempotent
                }
                throw error
            }
        }
        inflight = task
        defer { inflight = nil }

        do {
            let outcome = try await task.value
            step = .submitted
            return .success(outcome)
        } catch {
            step = .failed(String(describing: error))
            return .failure(error)
        }
    }

    /// The wire shape for the `votes` row.
    ///
    /// TB-04 (quiz redesign): the `votes` table stores answers in five generic
    /// jsonb slots (`q1`..`q5`), each a `{ meta, answer }` envelope.
    /// `meta.question_kind` is the discriminator the verdict-engine
    /// mapping layer (`supabase/functions/_shared/votes-schema.ts`)
    /// dispatches on — so quiz content can change without a migration.
    ///
    /// TB-06: Q1's kind is `cuisine_craving` (a positive soft signal)
    /// and Q3's kind is `reputation` — both new with the question
    /// rework. Q2 (`budget_cap`) and Q4 (`vibe`) keep their existing
    /// kinds; their semantics are unchanged. The verdict-engine
    /// rewrite (PRD module B / tb-11) widens the engine's kind
    /// taxonomy to consume the two new kinds.
    ///
    /// The typed Swift properties below remain the in-memory shape the
    /// coordinator and the unit tests work with; only the encoded wire
    /// JSON is the generic envelope. `Encodable` only — the row is
    /// write-only (reads go through a separate `Decodable` readback
    /// shape).
    /// One Q5 factorial card's rating on the wire — the card's
    /// `droppedAxis` paired with the member's 1…5 excitement score.
    ///
    /// TB-24: this is the canonical quiz-redesign Q5 probe shape. The vote write
    /// emits `votes.q5.answer.ratings` as `[Q5RatingEntry]` — one entry
    /// per factorial card — so `compute-verdict` (`readQ5Ratings` /
    /// `mapVotesRowToPreferenceInputs`, merged in tb-23) builds a real
    /// per-member weight-hierarchy probe instead of falling back to the
    /// equal-weight 1/3 prior. It replaces the pre-tb-23 per-venue score
    /// map (`votes.q5.answer.scores`), which the server no longer reads
    /// as the live verdict signal.
    public struct Q5RatingEntry: Equatable, Sendable {
        /// The factorial axis the rated card deviates on.
        public let droppedAxis: Q5FactorialCard.Axis
        /// The member's 1…5 excitement rating for that card.
        public let score: Int

        public init(droppedAxis: Q5FactorialCard.Axis, score: Int) {
            self.droppedAxis = droppedAxis
            self.score = score
        }
    }

    public struct VoteRow: Encodable, Equatable, Sendable {
        public let roomID: UUID
        public let userID: UUID
        public let q1Cuisines: [String]
        public let q1NoPreference: Bool
        public let q2Budget: Int
        public let q3Reputation: String
        public let q4Vibe: Int
        /// TB-24: the Q5 factorial probe — one `{ droppedAxis, score }`
        /// entry per factorial card. Encoded into
        /// `votes.q5.answer.ratings`.
        public let q5Ratings: [Q5RatingEntry]

        public init(
            roomID: UUID,
            userID: UUID,
            q1Cuisines: [String],
            q1NoPreference: Bool,
            q2Budget: Int,
            q3Reputation: String,
            q4Vibe: Int,
            q5Ratings: [Q5RatingEntry]
        ) {
            self.roomID = roomID
            self.userID = userID
            self.q1Cuisines = q1Cuisines
            self.q1NoPreference = q1NoPreference
            self.q2Budget = q2Budget
            self.q3Reputation = q3Reputation
            self.q4Vibe = q4Vibe
            self.q5Ratings = q5Ratings
        }

        private enum RowKey: String, CodingKey {
            case roomID = "room_id"
            case userID = "user_id"
            case q1, q2, q3, q4, q5
        }

        private enum SlotKey: String, CodingKey {
            case meta, answer
        }

        private enum MetaKey: String, CodingKey {
            case questionKind = "question_kind"
            case prompt
        }

        /// Encode one generic `{ meta, answer }` slot. The `prompt`
        /// strings are the quiz-redesign quiz copy — carried for audit, never
        /// read by the engine's mapping layer.
        private func encodeSlot<A: Encodable>(
            into container: inout KeyedEncodingContainer<RowKey>,
            key: RowKey,
            questionKind: String,
            prompt: String,
            answer: A
        ) throws {
            var slot = container.nestedContainer(keyedBy: SlotKey.self, forKey: key)
            var meta = slot.nestedContainer(keyedBy: MetaKey.self, forKey: .meta)
            try meta.encode(questionKind, forKey: .questionKind)
            try meta.encode(prompt, forKey: .prompt)
            try slot.encode(answer, forKey: .answer)
        }

        /// The Q1 cuisine-craving answer payload. `cuisines` is the
        /// (possibly empty) selected set; `no_preference` is the
        /// mutually-exclusive flag the engine reads to zero the
        /// cuisine axis weight.
        private struct CuisineAnswer: Encodable {
            let cuisines: [String]
            let noPreference: Bool
            enum CodingKeys: String, CodingKey {
                case cuisines
                case noPreference = "no_preference"
            }
        }

        /// One `{ droppedAxis, score }` entry of the Q5 `regret` slot's
        /// `answer.ratings` array. `droppedAxis` encodes to the axis's
        /// raw string (`"cuisine"` / `"reputation"` / `"vibe"`) — the
        /// shape `compute-verdict`'s `readQ5Ratings` consumes. The key
        /// is intentionally camel-case (`droppedAxis`, not
        /// `dropped_axis`) to match the canonical server-side reader.
        private struct RatingAnswerEntry: Encodable {
            let droppedAxis: String
            let score: Int
        }

        /// The Q5 `regret` slot's answer payload — the factorial probe.
        private struct RegretAnswer: Encodable {
            let ratings: [RatingAnswerEntry]
        }

        public func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: RowKey.self)
            try container.encode(roomID, forKey: .roomID)
            try container.encode(userID, forKey: .userID)

            try encodeSlot(
                into: &container, key: .q1,
                questionKind: "cuisine_craving",
                prompt: "What are you craving tonight?",
                answer: CuisineAnswer(cuisines: q1Cuisines, noPreference: q1NoPreference)
            )
            try encodeSlot(
                into: &container, key: .q2,
                questionKind: "budget_cap",
                prompt: "What's the ceiling tonight?",
                answer: ["tier": q2Budget]
            )
            try encodeSlot(
                into: &container, key: .q3,
                questionKind: "reputation",
                prompt: "What kind of place are you after?",
                answer: ["reputation": q3Reputation]
            )
            try encodeSlot(
                into: &container, key: .q4,
                questionKind: "vibe",
                prompt: "What's the energy you're after?",
                answer: ["level": q4Vibe]
            )
            // TB-24: the Q5 probe writes `answer.ratings` — the
            // factorial `[{ droppedAxis, score }]` array — not the
            // pre-tb-23 per-venue `answer.scores` map. Each entry is one
            // factorial card, tagged with the axis that card deviates
            // on, so `compute-verdict` can re-weight the member's
            // preference function per axis.
            try encodeSlot(
                into: &container, key: .q5,
                questionKind: "regret",
                prompt: "How excited does each of these make you?",
                answer: RegretAnswer(
                    ratings: q5Ratings.map {
                        RatingAnswerEntry(
                            droppedAxis: $0.droppedAxis.rawValue,
                            score: $0.score
                        )
                    }
                )
            )
        }
    }

    /// Build the wire row from current state. Sorted for determinism
    /// in tests; the server cares about set semantics.
    public func buildRow() -> VoteRow {
        VoteRow(
            roomID: roomID,
            userID: userID,
            q1Cuisines: q1Cuisines.sorted(),
            q1NoPreference: q1NoPreference,
            q2Budget: q2Budget,
            q3Reputation: q3Reputation,
            q4Vibe: q4Vibe,
            q5Ratings: buildQ5Ratings()
        )
    }

    /// Assemble the Q5 factorial probe — one `{ droppedAxis, score }`
    /// entry per candidate — from the per-venue `q5Ratings` score map
    /// and each candidate's `droppedAxis`.
    ///
    /// TB-24: `q5Ratings` is captured per venue id (the surface rates
    /// venues, not axes); the wire shape `compute-verdict` reads is the
    /// factorial `[{ droppedAxis, score }]`. The join happens here, at
    /// the write boundary, so the surface and the in-memory capture
    /// state stay venue-keyed.
    ///
    /// Axis source: the factorial path tags each `QuizCandidate` with
    /// its card's `droppedAxis`. A candidate that did not go through the
    /// factorial (a test fixture) leaves it `nil`; the three axes are
    /// then assigned positionally — `cuisine`, `reputation`, `vibe` — so
    /// the write is still a well-formed one-entry-per-axis probe. Order
    /// follows the candidate list, which is the factorial's emit order
    /// (cuisine-drop, reputation-drop, vibe-drop) on the real path.
    ///
    /// TB-26: on the no-results path the candidate list is empty, so
    /// this returns an empty `ratings` array — `compute-verdict`'s Q5
    /// reader tolerates it and degrades to the equal-weight prior.
    private func buildQ5Ratings() -> [Q5RatingEntry] {
        let fallbackAxes = Q5FactorialCard.Axis.allCases
        var entries: [Q5RatingEntry] = []
        for (index, candidate) in candidates.enumerated() {
            let score = q5Ratings[candidate.id] ?? 3
            let axis = candidate.droppedAxis
                ?? fallbackAxes[index % fallbackAxes.count]
            entries.append(
                Q5RatingEntry(droppedAxis: axis, score: score)
            )
        }
        return entries
    }

    // MARK: - retry classification

    /// Unique-violation detection.
    ///
    /// supabase-swift surfaces Postgres SQLSTATE codes through its
    /// PostgREST error type (whose name has shifted across the v2 SDK
    /// minor versions — `PostgrestError` in some, `PostgrestError`
    /// nested inside `Supabase.*` in others). To stay version-tolerant,
    /// we string-sniff the canonical SQLSTATE token (`23505`) and the
    /// PostgREST-emitted phrase (`duplicate key value`) from the
    /// error's description. The unit tests drive this path with a
    /// synthetic error whose description carries the same markers.
    static func isUniqueViolation(_ error: Error) -> Bool {
        let desc = String(describing: error)
        if desc.contains("23505") { return true }
        if desc.contains("duplicate key value") { return true }
        return false
    }
}

// MARK: - identifiers

/// Q1 cuisine-craving options. Plain string ids live here so they're
/// greppable from both the SwiftUI surface and tests. The id is the
/// stable wire value; the label is the displayed copy.
///
/// `// placeholder: marketing-branding pass` applies to the label
/// copy; the id strings are the engine contract.
public enum QuizCuisine {
    public static let mexican = "mexican"
    public static let italian = "italian"
    public static let japanese = "japanese"
    public static let chinese = "chinese"
    public static let thai = "thai"
    public static let indian = "indian"
    public static let american = "american"
    public static let mediterranean = "mediterranean"

    /// Display order matches the JSX option array.
    public static let displayOrder: [(id: String, label: String)] = [
        // placeholder: marketing-branding pass
        (mexican,       "Mexican"),
        (italian,       "Italian"),
        (japanese,      "Japanese"),
        (chinese,       "Chinese"),
        (thai,          "Thai"),
        (indian,        "Indian"),
        (american,      "American"),
        (mediterranean, "Mediterranean"),
    ]
}

/// Q3 reputation / discovery chip options. Single-select. The
/// `noPreference` chip is the neutral, non-pruning answer and is the
/// Q3 default.
public enum QuizReputation {
    public static let popular = "popular"
    public static let hiddenGem = "hidden_gem"
    public static let classic = "classic"
    public static let new = "new"
    public static let noPreference = "no_preference"

    /// Display order matches the JSX option array.
    public static let all: [(id: String, label: String)] = [
        // placeholder: marketing-branding pass
        (popular,      "Popular"),
        (hiddenGem,    "Hidden gem"),
        (classic,      "Classic"),
        (new,          "New"),
        (noPreference, "No preference"),
    ]
}

public enum QuizConstants {
    /// Q2 tiers — display label + sub copy. `// placeholder: marketing-branding pass`.
    public static let budgetTiers: [(label: String, sub: String)] = [
        // placeholder: marketing-branding pass
        ("$",    "Under $15"),
        ("$$",   "$15 – $30"),
        ("$$$",  "$30 – $60"),
        ("$$$$", "No cap"),
    ]
}
