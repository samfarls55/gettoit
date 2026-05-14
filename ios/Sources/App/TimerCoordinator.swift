// GetToIt — TimerCoordinator (TB-07).
//
// Drives the live countdown on S04 Waiting + dispatches the
// initiator's "Decide now" tap. Pure logic with an injected clock so
// unit tests can advance time without spinning a real `Task.sleep`.
//
// Responsibilities:
//   * Compute `secondsRemaining` from a fixed `deadlineAt` reference.
//   * Provide a stable `formatCountdown` function that renders the
//     mono-tag label per `surfaces/04-waiting.md`
//     ("AUTO-FIRES IN 7:42").
//   * Trigger the manual fire path — calls the `fire_verdict(room_id)`
//     Postgres RPC with the room id; surfaces the quorum / not-initiator
//     errors the RPC returns so the view layer can react.
//
// What this coordinator does NOT own:
//   * Subscribing to the verdict-ready broadcast. That lives in
//     `WaitingStore` — this coordinator is single-room and stateless.
//   * Polling the deadline_at against the server. The trigger / cron
//     in `20260513224000000_verdict_fire_trigger_and_cron.sql` is the
//     authoritative auto-fire. iOS only computes the *display* of the
//     remaining time so the user knows when the cron will swing.
//
// Reduced-motion: the view consults `accessibilityReduceMotion` and
// renders a coarse "under N min" label instead of the per-second
// tick. The coordinator emits per-second updates regardless; the
// view filters them.

import Foundation

/// Source of "now" — injected so tests can advance time at will. The
/// production path simply uses `{ Date.now }`.
public typealias TimerClock = @Sendable () -> Date

/// Outcome of a "Decide now" tap. Mirrors the JSON shape the
/// `fire_verdict(room_id)` RPC returns. See migration 20260513223500000.
public enum FireVerdictOutcome: Equatable, Sendable {
    case firing
    case alreadyFiring
    case belowQuorum(voteCount: Int)
    case notInitiator
    case unauthenticated
    case roomNotFound
    /// Catch-all for an unexpected payload shape or RPC failure.
    case rpcError(String)
}

/// Seam between the coordinator and Supabase. Production wires this
/// to a real PostgREST RPC invocation; tests substitute a closure
/// that returns a canned outcome.
public typealias FireVerdictInvoker = @Sendable (UUID) async -> FireVerdictOutcome

@MainActor
@Observable
public final class TimerCoordinator {
    /// Wall-clock reference. Set once at construction; the coordinator
    /// derives `secondsRemaining` against the injected clock so the
    /// caller can advance time deterministically in tests.
    public let deadlineAt: Date

    /// Room id passed to the `fire_verdict` RPC. Forwarded to the
    /// invoker on each `tapDecideNow()` call.
    public let roomID: UUID

    /// True iff the current user is the room initiator. The view
    /// layer gates the "Decide now" CTA on this — invitees never see
    /// the affordance per `surfaces/04-waiting.md` §"`Decide now`
    /// CTA (initiator-only)".
    public let isInitiator: Bool

    private let clock: TimerClock
    private let invoker: FireVerdictInvoker

    /// Observable so the view re-renders when `tapDecideNow()` lands
    /// the result. The view can also display the outcome (e.g.
    /// "below quorum" if the user races against a peer's vote
    /// dropping).
    public private(set) var lastOutcome: FireVerdictOutcome?
    /// True while an RPC is in flight so the view can disable the
    /// CTA + show a progress indicator without firing twice.
    public private(set) var isFiring: Bool = false

    public init(
        roomID: UUID,
        deadlineAt: Date,
        isInitiator: Bool,
        clock: @escaping TimerClock = { Date.now },
        invoker: @escaping FireVerdictInvoker
    ) {
        self.roomID = roomID
        self.deadlineAt = deadlineAt
        self.isInitiator = isInitiator
        self.clock = clock
        self.invoker = invoker
    }

    // MARK: - countdown

    /// Whole-seconds remaining until the deadline. Clamps to 0 when
    /// the deadline has passed — never returns a negative.
    public var secondsRemaining: Int {
        let now = clock()
        let delta = deadlineAt.timeIntervalSince(now)
        if delta <= 0 { return 0 }
        return Int(delta.rounded(.down))
    }

    /// True when the deadline has elapsed. The cron job will pick the
    /// room up on its next sweep; the iOS surface uses this to swap
    /// the countdown label for the "waiting on engine" state.
    public var deadlineElapsed: Bool {
        secondsRemaining <= 0
    }

    /// `"AUTO-FIRES IN 7:42"` — locked copy register per
    /// `surfaces/04-waiting.md` §"Countdown timer (all members)".
    /// Single-digit minutes render with a leading zero on the seconds
    /// (`"AUTO-FIRES IN 0:42"`) per the surface spec; the minutes
    /// segment is not zero-padded.
    public static func formatCountdown(secondsRemaining: Int) -> String {
        // Clamp on the consumer side too — defensive against a
        // caller that hands us a negative.
        let clamped = max(0, secondsRemaining)
        let minutes = clamped / 60
        let seconds = clamped % 60
        let ss = String(format: "%02d", seconds)
        return "AUTO-FIRES IN \(minutes):\(ss)"
    }

    /// Reduced-motion variant — "AUTO-FIRES IN UNDER N MIN" with a
    /// 1-minute granularity. Per `motion.md` §"Utility motion" entry
    /// "Waiting countdown tick", reduced-motion users get a coarse
    /// label rather than a per-second tick.
    public static func formatCountdownReducedMotion(secondsRemaining: Int) -> String {
        let clamped = max(0, secondsRemaining)
        // Round UP to the next whole minute so "under 1 min" appears
        // only when < 60 seconds remain. A consumer can flatten the
        // line to a different label below 60s if desired.
        let minutes = Int((Double(clamped) / 60.0).rounded(.up))
        if minutes <= 0 { return "AUTO-FIRES NOW" }
        return "AUTO-FIRES IN UNDER \(minutes) MIN"
    }

    // MARK: - decide-now

    /// Fire-and-await the manual fire path. The view binds this to
    /// the "Decide now" CTA. Stores the outcome on `lastOutcome` so
    /// the view can react (`firing` → enter waiting-for-verdict
    /// state; `belowQuorum` → flash a copy line; etc.).
    @discardableResult
    public func tapDecideNow() async -> FireVerdictOutcome {
        guard isInitiator else {
            let outcome = FireVerdictOutcome.notInitiator
            self.lastOutcome = outcome
            return outcome
        }
        if isFiring {
            // Rapid double-tap — short-circuit. The first call is
            // still in flight; its `lastOutcome` will land shortly.
            return lastOutcome ?? .firing
        }
        isFiring = true
        let outcome = await invoker(roomID)
        isFiring = false
        self.lastOutcome = outcome
        return outcome
    }
}
