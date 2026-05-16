// GetToIt — QuizCoordinator (TB-04).
//
// Holds the user's Q1–Q4 answers locally as they advance through the
// quiz. Writes a single `votes` row on Q5 submit. One round-trip per
// room per user.
//
// Why a single submit rather than per-question writes:
//   * The quiz has no back arrow (PRD user story 26 + S03 cross-quiz
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
// below. TB-06 wires the real survivor set from the VerdictEngine /
// `options` table — the coordinator's `submit(...)` interface stays the
// same; only the source of `Candidate.id` strings changes.
//
// All visual code lives in `QuizQ{1..5}Screen.swift`. The coordinator
// is intentionally view-free so it can be tested without SwiftUI.

import Foundation
import Supabase

/// A Q5 candidate (place the user can rate). TB-04 ships dummy ids
/// from a local fixture; TB-06 wires real `options.id` values.
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

/// Default Q5 candidates the iOS app uses until TB-06 wires real
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

    /// Captured answers. Defaults match the JSX defaults so the visual
    /// port stays 1:1 with the locked spec.
    public private(set) var q1Vetoes: Set<String> = []
    public private(set) var q2Budget: Int = 1            // tier 1 (== "$")
    public private(set) var q3WalkMinutes: Int = 15      // JSX default
    public private(set) var q4Vibe: Int = 2              // JSX default mid-stop (BUZZY)
    public private(set) var q5Ratings: [String: Int] = [:]

    private let roomID: UUID
    private let userID: UUID
    private let candidates: [QuizCandidate]
    private let writer: QuizVoteWriter

    /// In-flight submit task so a rapid-tap on "Drop the verdict" can
    /// fold into the already-running write instead of issuing a second
    /// one. Without this, the rapid-tap case fires a second insert that
    /// the unique constraint rejects with a 23505 — surface-correct,
    /// but a wasted round-trip we can avoid cheaply.
    private var inflight: Task<QuizSubmitOutcome, Error>?

    public init(
        roomID: UUID,
        userID: UUID,
        candidates: [QuizCandidate] = QuizDummyCandidates.all,
        writer: @escaping QuizVoteWriter
    ) {
        self.roomID = roomID
        self.userID = userID
        self.candidates = candidates
        self.writer = writer
        // Seed Q5 ratings at the spec'd default (3 — middle of the
        // 1–5 scale) so the surface renders with a chosen state per
        // card and the user can submit without touching every card.
        var seed: [String: Int] = [:]
        for c in candidates { seed[c.id] = 3 }
        self.q5Ratings = seed
    }

    public var allCandidates: [QuizCandidate] { candidates }

    // MARK: - Q1

    /// Toggle a Q1 chip. `"nothing_tonight"` is mutually exclusive with
    /// all other vetoes — selecting it clears the set; selecting any
    /// other clears it. Matches the JSX `toggle` logic in
    /// `ScreenQ1Vetoes.jsx`.
    public func toggleVeto(_ id: String) {
        let nothing = QuizVeto.nothingTonight
        if id == nothing {
            if q1Vetoes.contains(nothing) {
                q1Vetoes.removeAll()
            } else {
                q1Vetoes = [nothing]
            }
            return
        }
        q1Vetoes.remove(nothing)
        if q1Vetoes.contains(id) {
            q1Vetoes.remove(id)
        } else {
            q1Vetoes.insert(id)
        }
    }

    // MARK: - Q2/Q3/Q4

    public func setBudget(_ tier: Int) {
        precondition((1...4).contains(tier), "q2_budget must be 1...4")
        q2Budget = tier
    }

    public func setWalkMinutes(_ minutes: Int) {
        precondition(QuizConstants.walkStops.contains(minutes),
                     "q3_walk_minutes must be one of \(QuizConstants.walkStops)")
        q3WalkMinutes = minutes
    }

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
    public func advance() {
        switch step {
        case .q1: step = .q2
        case .q2: step = .q3
        case .q3: step = .q4
        case .q4: step = .q5
        case .q5, .submitting, .submitted, .failed:
            break  // submit is a separate explicit call
        }
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
    /// The typed Swift properties below remain the in-memory shape the
    /// coordinator and the unit tests work with; only the encoded wire
    /// JSON is the generic envelope. `Encodable` only — the row is
    /// write-only (reads go through a separate `Decodable` readback
    /// shape).
    public struct VoteRow: Encodable, Equatable, Sendable {
        public let roomID: UUID
        public let userID: UUID
        public let q1Vetoes: [String]
        public let q2Budget: Int
        public let q3WalkMinutes: Int
        public let q4Vibe: Int
        public let q5Regret: [String: Int]

        public init(
            roomID: UUID,
            userID: UUID,
            q1Vetoes: [String],
            q2Budget: Int,
            q3WalkMinutes: Int,
            q4Vibe: Int,
            q5Regret: [String: Int]
        ) {
            self.roomID = roomID
            self.userID = userID
            self.q1Vetoes = q1Vetoes
            self.q2Budget = q2Budget
            self.q3WalkMinutes = q3WalkMinutes
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
        /// strings are the v1 quiz copy — carried for audit, never
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

        public func encode(to encoder: Encoder) throws {
            var container = encoder.container(keyedBy: RowKey.self)
            try container.encode(roomID, forKey: .roomID)
            try container.encode(userID, forKey: .userID)

            try encodeSlot(
                into: &container, key: .q1,
                questionKind: "dietary_veto",
                prompt: "Anything off the menu tonight?",
                answer: ["vetoes": q1Vetoes]
            )
            try encodeSlot(
                into: &container, key: .q2,
                questionKind: "budget_cap",
                prompt: "Where's the ceiling tonight?",
                answer: ["tier": q2Budget]
            )
            try encodeSlot(
                into: &container, key: .q3,
                questionKind: "walk_minutes",
                prompt: "How far are you willing to walk?",
                answer: ["minutes": q3WalkMinutes]
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
                prompt: "Which would you most regret missing?",
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
            q1Vetoes: q1Vetoes.sorted(),
            q2Budget: q2Budget,
            q3WalkMinutes: q3WalkMinutes,
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

/// Constants for chip identifiers / scale stops. Plain strings live
/// here so they're greppable from both the SwiftUI surfaces and tests.
public enum QuizVeto {
    public static let gluten = "gluten"
    public static let dairy = "dairy"
    public static let shellfish = "shellfish"
    public static let veganOptions = "vegan_options"
    public static let halalOnly = "halal_only"
    public static let nothingTonight = "nothing_tonight"

    /// Display order matches the JSX option array.
    public static let displayOrder: [(id: String, label: String)] = [
        // placeholder: marketing-branding pass
        (gluten,        "Gluten"),
        (dairy,         "Dairy"),
        (shellfish,     "Shellfish"),
        (veganOptions,  "Needs vegan options"),
        (halalOnly,     "Halal-only"),
        (nothingTonight,"Nothing tonight"),
    ]
}

public enum QuizConstants {
    /// Q3 stop set — JSX `ticks` array. Migration check constraint
    /// matches.
    public static let walkStops: [Int] = [5, 10, 15, 20, 30]

    /// Q2 tiers — display label + sub copy. `// placeholder: marketing-branding pass`.
    public static let budgetTiers: [(label: String, sub: String)] = [
        // placeholder: marketing-branding pass
        ("$",    "Under $15"),
        ("$$",   "$15 – $30"),
        ("$$$",  "$30 – $60"),
        ("$$$$", "No cap"),
    ]
}
