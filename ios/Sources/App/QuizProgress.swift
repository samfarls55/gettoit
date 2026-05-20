// GetToIt — Quiz resume payload (tb-WF-7, workflow-overhaul).
//
// The S00 Plan list (sg-WF-4) routes a Joined-card tap on a Pending+
// mid-quiz Plan back into the QuizScreen at the joiner's last-answered
// question with prior answers intact (§Q8 in surfaces/00-plan-list.md).
// That requires a server-persisted resume payload — the `votes` row is
// write-once at Q5 submit, so the pre-submit working copy lives on
// `members.quiz_progress` and the iOS port packs/unpacks via this type.
//
// Wire shape — what the server stores in `members.quiz_progress`:
//
//   {
//     "last_index": 0..5,
//     "answers": {
//       "q1": { "cuisines": ["mexican", "japanese"], "noPreference": false },
//       "q2": { "tier": 2 },
//       "q3": { "reputation": "popular" },
//       "q4": { "level": 3 }
//     }
//   }
//
// `last_index` is the 1-based index of the last-answered question
// (0 when the joiner hasn't started). Per-question slots mirror the
// scalar shape of each Q's answer; they are NOT the full
// `{ meta, answer }` envelope that `votes.qN` carries — that
// envelope's `meta` is server-owned at submit time (the prompt copy
// the session showed), and the iOS port re-builds it on submit from
// the live coordinator state. Carrying only the answer scalars here
// keeps the working-copy payload small.
//
// Q5 (regret) is NOT persisted as a per-question slot: the Q5 step
// only renders ONCE the per-member Foursquare fetch resolves, which
// itself only fires on the Q4 -> Q5 advance. A user who reaches Q5
// has not yet "answered" anything Q5-specific until they tap submit;
// resuming "on Q5" means the coordinator lands on `.q5` and the
// fetch fires anew. The Q5 ratings only persist when the final
// `votes` row writes.

import Foundation

// MARK: - QuizProgress

/// Snapshot of an in-flight quiz, mirrors the jsonb shape stored on
/// `members.quiz_progress`. Decodes tolerantly: an empty object
/// (`{}`) is the server-side default for a freshly-inserted
/// `members` row and decodes as `lastIndex = 0` + every per-question
/// slot nil. The iOS read path can therefore decode the column from
/// every joiner — even one who never tapped a Joined card.
public struct QuizProgress: Codable, Equatable, Sendable {
    /// 1-based index of the last-answered question. 0 means the
    /// joiner hasn't started; 1 means Q1 is answered (next step is
    /// Q2); 4 means Q4 is answered (next step is Q5); 5 means the
    /// joiner reached Q5 (the votes row may or may not have landed).
    public let lastIndex: Int

    /// Q1 — cuisine craving + "No preference" toggle.
    public let q1: Q1Answer?
    /// Q2 — spend cap tier (1..4 = $..$$$$).
    public let q2: Q2Answer?
    /// Q3 — reputation / discovery chip.
    public let q3: Q3Answer?
    /// Q4 — vibe energy (0..4 = Quiet..Rowdy).
    public let q4: Q4Answer?

    public init(
        lastIndex: Int = 0,
        q1: Q1Answer? = nil,
        q2: Q2Answer? = nil,
        q3: Q3Answer? = nil,
        q4: Q4Answer? = nil
    ) {
        self.lastIndex = lastIndex
        self.q1 = q1
        self.q2 = q2
        self.q3 = q3
        self.q4 = q4
    }

    public struct Q1Answer: Codable, Equatable, Sendable {
        public let cuisines: [String]
        public let noPreference: Bool
        public init(cuisines: [String], noPreference: Bool) {
            self.cuisines = cuisines
            self.noPreference = noPreference
        }
    }

    public struct Q2Answer: Codable, Equatable, Sendable {
        public let tier: Int
        public init(tier: Int) { self.tier = tier }
    }

    public struct Q3Answer: Codable, Equatable, Sendable {
        public let reputation: String
        public init(reputation: String) { self.reputation = reputation }
    }

    public struct Q4Answer: Codable, Equatable, Sendable {
        public let level: Int
        public init(level: Int) { self.level = level }
    }

    enum CodingKeys: String, CodingKey {
        case lastIndex = "last_index"
        case answers
    }

    private enum AnswerKeys: String, CodingKey {
        case q1, q2, q3, q4
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Tolerant decode — an empty object yields `lastIndex = 0`,
        // every slot nil. That is the canonical "never touched" state
        // and matches the server-side `default '{}'::jsonb`.
        self.lastIndex = try c.decodeIfPresent(Int.self, forKey: .lastIndex) ?? 0
        if let answers = try? c.nestedContainer(keyedBy: AnswerKeys.self, forKey: .answers) {
            self.q1 = try answers.decodeIfPresent(Q1Answer.self, forKey: .q1)
            self.q2 = try answers.decodeIfPresent(Q2Answer.self, forKey: .q2)
            self.q3 = try answers.decodeIfPresent(Q3Answer.self, forKey: .q3)
            self.q4 = try answers.decodeIfPresent(Q4Answer.self, forKey: .q4)
        } else {
            self.q1 = nil
            self.q2 = nil
            self.q3 = nil
            self.q4 = nil
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(lastIndex, forKey: .lastIndex)
        // Only emit `answers` when at least one slot is non-nil; an
        // empty `{}` is then preserved by the server's `default` and
        // re-decoded as untouched on the next read.
        if q1 != nil || q2 != nil || q3 != nil || q4 != nil {
            var answers = c.nestedContainer(keyedBy: AnswerKeys.self, forKey: .answers)
            try answers.encodeIfPresent(q1, forKey: .q1)
            try answers.encodeIfPresent(q2, forKey: .q2)
            try answers.encodeIfPresent(q3, forKey: .q3)
            try answers.encodeIfPresent(q4, forKey: .q4)
        }
    }
}

// MARK: - MemberProgressWriter typealias

/// The network seam the QuizCoordinator uses to persist progress on
/// every Q1..Q4 -> next-Q advance. Indirected through a closure so
/// the live coordinator can call `members_progress_upsert(roomID,
/// payload)` and unit tests can drive the coordinator without a
/// Supabase client.
///
/// Best-effort semantics: the closure may throw — the coordinator
/// catches and drops the error so a transient write failure never
/// strands the quiz on a step transition. The column is a resume-
/// from-state convenience; the verdict-engine input still flows
/// through the `votes` write at Q5 submit.
///
/// `@Sendable` so the coordinator can fire it from inside a Task
/// that crosses actor boundaries.
public typealias MemberProgressWriter = @Sendable (QuizProgress) async throws -> Void
