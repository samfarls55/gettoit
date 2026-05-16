// GetToIt — QuizCoordinator (TB-04 schema, TB-06 question rework).
//
// Holds the user's Q1–Q4 answers locally as they advance through the
// quiz. Writes a single `votes` row on Q5 submit. One round-trip per
// room per user.
//
// v1.1 question rework (PRD module J, part 1 — issue tb-06):
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
// Q5 candidates: TB-04 ships dummy candidates from `dummyCandidates`
// below. TB-08 wires the real factorial-probe set from the per-member
// Foursquare fetch — the coordinator's `submit(...)` interface stays
// the same; only the source of `Candidate.id` strings changes.
//
// TB-15 (v1.1) — the per-member Foursquare fetch now fires from the
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

/// A Q5 candidate (place the user can rate). TB-04 ships dummy ids
/// from a local fixture; TB-08 wires real `options.id` values.
public struct QuizCandidate: Equatable, Sendable, Identifiable {
    public let id: String
    public let name: String
    public let meta: String   // e.g. "Mexican · $$ · 8 min"

    public init(id: String, name: String, meta: String) {
        self.id = id
        self.name = name
        self.meta = meta
    }
}

/// Default Q5 candidates the iOS app uses until TB-08 wires real
/// survivors. Three places — matches the JSX fixture in
/// `design-system/code/screens/ScreenQ5Regret.jsx`.
///
/// `// placeholder: marketing-branding pass` applies to the names and
/// meta strings, not the engine contract.
public enum QuizDummyCandidates {
    // placeholder: marketing-branding pass
    public static let all: [QuizCandidate] = [
        QuizCandidate(id: "dummy-pico",     name: "Pico's Taqueria", meta: "Mexican · $$ · 8 min"),
        QuizCandidate(id: "dummy-ren",      name: "Ren Soba House",  meta: "Japanese · $$ · 12 min"),
        QuizCandidate(id: "dummy-pastoral", name: "Bar Pastoral",    meta: "Italian · $$ · 5 min"),
    ]
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

    /// TB-15 (v1.1) — the per-member candidate fetch lifecycle. The
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
        /// The fetch resolved to the dummy fixture — genuine pool
        /// starvation, or no session coordinate. Q5 still renders three
        /// rateable rows; the member is never stranded.
        case fallbackDummy
    }

    public private(set) var q5CandidatesState: Q5CandidatesState = .idle

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

    /// TB-15 (v1.1) — the per-member Foursquare fetch. Non-nil on the
    /// live quiz path (`QuizSessionAssembler` injects a
    /// `FoursquareQuizCandidateFetch`); nil on the legacy explicit-
    /// `candidates:` path so the unit tests stay fetch-free.
    private let candidateFetch: QuizCandidateFetch?

    /// In-flight per-member fetch task, so a re-entrant Q4 -> Q5
    /// transition (or a defensive double-`advance()`) folds into the
    /// already-running fetch instead of firing the N+1 calls twice.
    private var fetchTask: Task<Void, Never>?

    /// TB-05 (v1.1) — the session-wide *parameters* bucket (meal time,
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

    /// Legacy init — Q5 candidates are supplied up front. Used by the
    /// unit tests and the snapshot harness; the per-member fetch never
    /// fires on this path (`candidateFetch` is nil).
    public init(
        roomID: UUID,
        userID: UUID,
        candidates: [QuizCandidate] = QuizDummyCandidates.all,
        sessionParameters: SessionParameters = .default,
        writer: @escaping QuizVoteWriter
    ) {
        self.roomID = roomID
        self.userID = userID
        self.candidates = candidates
        self.sessionParameters = sessionParameters
        self.candidateFetch = nil
        self.writer = writer
        // Seed Q5 ratings at the spec'd default (3 — middle of the
        // 1–5 scale) so the surface renders with a chosen state per
        // card and the user can submit without touching every card.
        self.q5Ratings = QuizCoordinator.seededRatings(for: candidates)
    }

    /// TB-15 (v1.1) — the live-quiz init. Q5 candidates are NOT supplied
    /// up front; the candidate list starts empty and the per-member
    /// Foursquare fetch (`candidateFetch`) fires on the Q4 -> Q5
    /// transition with the member's real Q1-Q4 answers. This is the
    /// init `QuizSessionAssembler` uses for the running quiz — no
    /// PlacesProxy / Foursquare call fires before Q1-Q4 are answered.
    public init(
        roomID: UUID,
        userID: UUID,
        candidateFetch: QuizCandidateFetch,
        sessionParameters: SessionParameters = .default,
        writer: @escaping QuizVoteWriter
    ) {
        self.roomID = roomID
        self.userID = userID
        self.candidates = []
        self.sessionParameters = sessionParameters
        self.candidateFetch = candidateFetch
        self.writer = writer
        self.q5Ratings = [:]
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
    public func advance() {
        switch step {
        case .q1: step = .q2
        case .q2: step = .q3
        case .q3: step = .q4
        case .q4:
            step = .q5
            // TB-15 (v1.1) — completing Q4 is the trigger for the
            // per-member Foursquare fetch. The member has now answered
            // Q1 (cuisines) and Q2 (spend cap); fire the answer-tailored
            // N+1 calls. No PlacesProxy / Foursquare call fires before
            // this point.
            startCandidateFetchIfNeeded()
        case .q5, .submitting, .submitted, .failed:
            break  // submit is a separate explicit call
        }
    }

    // MARK: - Q5 candidate fetch (TB-15)

    /// Fire the per-member Foursquare fetch, once, on the Q4 -> Q5
    /// transition. No-op when the coordinator was built via the legacy
    /// explicit-`candidates:` init (`candidateFetch` is nil) or when a
    /// fetch is already in flight / complete.
    ///
    /// The fetch forwards the member's REAL Q1 craved cuisines + Q2
    /// spend cap + the shared session parameters through
    /// `FoursquareFetchExecutor` — never an empty `PlacesFilters()`.
    private func startCandidateFetchIfNeeded() {
        guard let candidateFetch else { return }
        guard q5CandidatesState == .idle, fetchTask == nil else { return }

        q5CandidatesState = .loading
        let cuisines = q1NoPreference ? [] : q1Cuisines.sorted()
        let budgetTier = q2Budget
        let parameters = sessionParameters

        fetchTask = Task { [weak self] in
            let result = await candidateFetch.fetchCandidates(
                cuisines: cuisines,
                budgetTier: budgetTier,
                parameters: parameters
            )
            guard let self else { return }
            self.applyFetchResult(result)
        }
    }

    /// Fold a resolved per-member fetch into the coordinator: install
    /// the candidate list, seed the Q5 ratings, and flip
    /// `q5CandidatesState` so Q5 swaps the loading state for the cards.
    private func applyFetchResult(_ result: QuizCandidateFetchResult) {
        candidates = result.candidates
        q5Ratings = QuizCoordinator.seededRatings(for: result.candidates)
        switch result.source {
        case .fetched:        q5CandidatesState = .ready
        case .fallbackDummy:  q5CandidatesState = .fallbackDummy
        }
        fetchTask = nil
    }

    /// Await the in-flight per-member fetch, if any. Exposed so the
    /// boundary tests can deterministically observe the post-fetch
    /// candidate list without polling. A no-op when no fetch is running.
    public func awaitCandidateFetch() async {
        await fetchTask?.value
    }

    /// Submit the assembled vote row. Idempotent on retry — a unique-
    /// constraint reject from a prior successful write resolves as
    /// `.idempotent`.
    @discardableResult
    public func submit() async -> Result<QuizSubmitOutcome, Error> {
        // Fold rapid-tap submits into a single write.
        if let inflight {
            do { return .success(try await inflight.value) }
            catch { return .failure(error) }
        }

        step = .submitting
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
    /// TB-04 (v1.1): the `votes` table stores answers in five generic
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
    public struct VoteRow: Encodable, Equatable, Sendable {
        public let roomID: UUID
        public let userID: UUID
        public let q1Cuisines: [String]
        public let q1NoPreference: Bool
        public let q2Budget: Int
        public let q3Reputation: String
        public let q4Vibe: Int
        public let q5Regret: [String: Int]

        public init(
            roomID: UUID,
            userID: UUID,
            q1Cuisines: [String],
            q1NoPreference: Bool,
            q2Budget: Int,
            q3Reputation: String,
            q4Vibe: Int,
            q5Regret: [String: Int]
        ) {
            self.roomID = roomID
            self.userID = userID
            self.q1Cuisines = q1Cuisines
            self.q1NoPreference = q1NoPreference
            self.q2Budget = q2Budget
            self.q3Reputation = q3Reputation
            self.q4Vibe = q4Vibe
            self.q5Regret = q5Regret
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
        /// strings are the v1.1 quiz copy — carried for audit, never
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
            try encodeSlot(
                into: &container, key: .q5,
                questionKind: "regret",
                prompt: "How excited does each of these make you?",
                answer: ["scores": q5Regret]
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
            q5Regret: q5Ratings
        )
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
