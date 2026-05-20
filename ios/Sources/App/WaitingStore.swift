// GetToIt — WaitingStore (TB-07).
//
// Drives S04 Waiting:
//   * Observable list of members (avatar row).
//   * Observable set of `answered` user ids — flips when a peer's
//     vote lands via the room's Realtime channel.
//   * Observable `RoomStatus` — flips through `open → firing →
//     verdict_ready` (or `expired` on the no-quorum terminal path).
//   * Verdict-ready signal — sets `verdictReady = true` when the
//     trigger / cron / manual fire dispatches and the
//     `compute-verdict` Edge Function lands the row.
//   * Nudge rate-limit — at most one nudge per 2 minutes per session,
//     per `surfaces/04-waiting.md` §"Behavior". Pure state on the
//     coordinator; doesn't yet write to a `nudges` table (that's a
//     follow-up).
//
// Architecture seam:
//   * The store is decoupled from `supabase-swift` realtime. It
//     receives "events" via `apply(event:)`, and tests drive those
//     events directly. The production path wires the real Realtime
//     channel to call `apply(event:)` from the broadcast / postgres
//     change callbacks.
//   * The bootstrap fetch (members list + current votes) is also
//     pluggable — `WaitingStoreDataSource` carries the methods the
//     store needs. Production wires it to PostgREST; tests stub it.
//
// Out of scope for TB-07 (per spec scope guard):
//   * Presence channel for "currently in app" lights. The avatar row
//     uses `answered` (votes-row presence), not `online` (Presence).
//     Presence is a v2 polish layer once the basic Realtime wiring
//     is observable end-to-end.
//   * Writing nudge events to a server-side table. Local rate-limit
//     state only.

import Foundation

/// Source of "now" — injected so tests can advance time at will. The
/// production path simply uses `{ Date.now }`. Used by `WaitingStore`
/// to drive the nudge-rate-limit window.
public typealias WaitingClock = @Sendable () -> Date

/// Lifecycle of a room as the schema enumerates in
/// `20260513223000000_rooms_deadline_at_and_firing_status.sql`.
public enum RoomStatus: String, Equatable, Sendable, CaseIterable {
    case open            = "open"
    case firing          = "firing"
    case verdictReady    = "verdict_ready"
    case locked          = "locked"
    case expired         = "expired"
}

/// Minimal projection of a `members` row for the avatar row. The
/// store doesn't fetch display names yet — the S04 row uses an
/// initial-letter dot + a colored disk per `surfaces/04-waiting.md`.
public struct WaitingMember: Equatable, Sendable, Identifiable {
    public let id: UUID
    public let role: String
    public init(id: UUID, role: String) {
        self.id = id
        self.role = role
    }
    public var isOwner: Bool { role == "owner" }
}

/// External-input events the store reacts to. Tests fire these
/// directly; production wires them to the Supabase Realtime channel
/// callbacks.
public enum WaitingStoreEvent: Equatable, Sendable {
    /// A new member joined the room (someone tapped the invite link).
    case memberJoined(WaitingMember)
    /// A member submitted their quiz answers — vote row landed.
    case voteCast(userID: UUID)
    /// The room's status flipped server-side.
    case roomStatusChanged(RoomStatus)
    /// A `verdicts` row landed for the room. The verdict surface
    /// (S05) reads the actual row via `VerdictStore.fetchVerdict`;
    /// the store just flips the ready bit so the view can route.
    case verdictReady
}

@MainActor
@Observable
public final class WaitingStore {
    public let roomID: UUID
    public let currentUserID: UUID
    public let isInitiator: Bool

    /// Members of the room. Initially populated by the bootstrap
    /// fetch; mutated on `memberJoined` events.
    public private(set) var members: [WaitingMember] = []

    /// User ids that have already answered. Initially populated by
    /// the bootstrap fetch; mutated on `voteCast` events.
    public private(set) var answered: Set<UUID> = []

    /// Current server-side room status. Drives the surface mode:
    /// `open` / `firing` → the live coordination surface;
    /// `verdict_ready` → route to S05; `expired` → the no-quorum
    /// terminal.
    public private(set) var status: RoomStatus = .open

    /// True when a verdicts row has landed for this room. The view
    /// layer observes this and routes to S05.
    public private(set) var verdictReady: Bool = false

    /// Local rate-limit state for the Nudge CTA. Records the last
    /// `Date` we let a nudge through; the next press within the
    /// suppression window short-circuits as `.rateLimited`. Local
    /// only — server-side nudge writes are a follow-up.
    public private(set) var lastNudgeAt: Date?

    /// Two minutes per `surfaces/04-waiting.md` §"Behavior" —
    /// "Cap: 1 per 2min."
    public static let nudgeSuppressionWindow: TimeInterval = 120

    /// Public count of members. The avatar row size keys off this.
    public var memberCount: Int { members.count }
    /// Public count of answered members. The "N of M" headline reads
    /// this. The quorum predicate (≥2) compares against it directly.
    public var answeredCount: Int { answered.count }
    /// `surfaces/04-waiting.md` §"`Decide now` CTA" — initiator-only,
    /// disabled until `answered.length >= 2`.
    public var quorumMet: Bool { answered.count >= 2 }

    private let clock: WaitingClock

    public init(
        roomID: UUID,
        currentUserID: UUID,
        isInitiator: Bool,
        clock: @escaping WaitingClock = { Date.now }
    ) {
        self.roomID = roomID
        self.currentUserID = currentUserID
        self.isInitiator = isInitiator
        self.clock = clock
    }

    // MARK: - bootstrap

    /// Seed the store with the result of the initial PostgREST fetch.
    /// Idempotent — calling twice overwrites with the new snapshot.
    public func bootstrap(
        members: [WaitingMember],
        answered: Set<UUID>,
        status: RoomStatus
    ) {
        self.members = members
        self.answered = answered
        self.status = status
        self.verdictReady = (status == .verdictReady)
    }

    // MARK: - events

    /// Apply one Realtime event. Drives the surface forward.
    public func apply(event: WaitingStoreEvent) {
        switch event {
        case .memberJoined(let member):
            if members.contains(where: { $0.id == member.id }) { return }
            members.append(member)
        case .voteCast(let userID):
            answered.insert(userID)
        case .roomStatusChanged(let newStatus):
            status = newStatus
            if newStatus == .verdictReady { verdictReady = true }
        case .verdictReady:
            verdictReady = true
            if status != .verdictReady { status = .verdictReady }
        }
    }

    // MARK: - nudge

    /// Outcome of a Nudge CTA tap.
    public enum NudgeOutcome: Equatable, Sendable {
        case sent
        case rateLimited(secondsUntilNext: Int)
        case noOneToNudge
    }

    /// Returns true if a nudge would be admitted right now. The view
    /// layer reads this to enable/disable the Nudge CTA pre-tap.
    public var canNudge: Bool {
        guard pendingTargets().isEmpty == false else { return false }
        guard let last = lastNudgeAt else { return true }
        return clock().timeIntervalSince(last) >= Self.nudgeSuppressionWindow
    }

    /// Record a nudge if the rate-limit allows. The store doesn't
    /// dispatch an APNs send today — that's a follow-up. The local
    /// state still serves the surface's "1 per 2 min" defense.
    @discardableResult
    public func nudge() -> NudgeOutcome {
        if pendingTargets().isEmpty {
            return .noOneToNudge
        }
        let now = clock()
        if let last = lastNudgeAt,
           now.timeIntervalSince(last) < Self.nudgeSuppressionWindow {
            let elapsed = now.timeIntervalSince(last)
            let remaining = Int(ceil(Self.nudgeSuppressionWindow - elapsed))
            return .rateLimited(secondsUntilNext: max(1, remaining))
        }
        lastNudgeAt = now
        return .sent
    }

    /// Member ids who haven't answered yet. Excludes the current user
    /// because nudging yourself is silly.
    public func pendingTargets() -> [UUID] {
        members
            .map(\.id)
            .filter { $0 != currentUserID }
            .filter { answered.contains($0) == false }
    }
}
