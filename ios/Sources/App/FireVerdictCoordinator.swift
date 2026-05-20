// GetToIt — FireVerdictCoordinator (tb-WF-3).
//
// Owns the initiator's manual "Decide now" tap. Pure logic with an
// injected RPC seam so unit tests can drive the outcomes without
// touching Supabase.
//
// History: this file replaces the manual-fire half of the deleted
// `TimerCoordinator` (TB-07). The countdown / deadline / cron-aware
// half was retired by sg-WF-3 — v1.1 has no session timer; the only
// verdict triggers are (a) all-Q5-complete (engine-side auto-fire,
// `rooms.fire_trigger = 'quorum'`) and (b) initiator-tap manual fire
// here (`rooms.fire_trigger = 'manual'`). See `surfaces/04-waiting.md`
// §"Verdict fire trigger" for the canonical definition.
//
// Responsibilities:
//   * Trigger the manual fire path — calls the `fire_verdict(room_id)`
//     Postgres RPC with the room id; surfaces the RPC outcomes so the
//     view layer can react.
//   * Track the in-flight `isFiring` flag so the view can disable the
//     CTA + render a progress indicator without firing twice on a
//     rapid double-tap.
//
// What this coordinator does NOT own:
//   * Subscribing to the verdict-ready broadcast. That lives in
//     `WaitingStore.apply(event:)` — this coordinator is single-room
//     and stateless beyond the fire-in-flight bit.
//   * Any timing logic. The v1.1 spec retired the timer; no countdown,
//     no deadline, no cron. The "Decide now" CTA is always tappable
//     for the initiator (minimum quorum is one member, which the
//     initiator always satisfies).

import Foundation

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
public final class FireVerdictCoordinator {
    /// Room id passed to the `fire_verdict` RPC. Forwarded to the
    /// invoker on each `tapDecideNow()` call.
    public let roomID: UUID

    /// True iff the current user is the room initiator. The view
    /// layer gates the "Decide now" CTA on this — invitees never see
    /// the affordance per `surfaces/04-waiting.md` §"`Decide now`
    /// CTA (initiator-only)".
    public let isInitiator: Bool

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
        isInitiator: Bool,
        invoker: @escaping FireVerdictInvoker
    ) {
        self.roomID = roomID
        self.isInitiator = isInitiator
        self.invoker = invoker
    }

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
