// GetToIt — VerdictPoller (TB-19).
//
// The post-Q5 router's wait loop. After a participant submits Q5 the
// verdict fires server-side (the AFTER INSERT ON votes trigger — see
// tb-13 / FireVerdictIntegrationTests). The `verdicts` row lands a
// short, non-deterministic moment later. The poller bridges that gap:
// it calls `VerdictStore.fetchVerdict` on a few-second cadence until a
// row exists, then stops.
//
// Why polling rather than Realtime: a Realtime channel on `verdicts`
// is explicitly out of scope for tb-19 (it's a later slice). Polling
// is the simplest end-to-end mechanism that satisfies "the verdict
// appears within a few seconds of the engine firing" — the cadence is
// the upper bound on that latency.
//
// Design seams (both injected so the loop is unit-testable with no
// live Supabase client and no real wall-clock waits):
//   * `fetch`  — one verdict round-trip. Production wires this to
//                `VerdictStore.fetchVerdict`. Returns nil until the
//                engine has committed the row.
//   * `sleep`  — the inter-poll delay. Production wires this to
//                `Task.sleep`; tests pass a no-op (or a
//                cancellation-checking stub).
//
// Lifecycle contract:
//   * `run()` returns the verdict the instant the first non-nil fetch
//     lands — the loop stops there, no extra round-trips.
//   * `run()` is cancellation-aware: when the owning task is cancelled
//     (host teardown), the loop unwinds and `run()` rethrows
//     `CancellationError`. No leaked timer / task.
//   * A fetch error propagates out of `run()` so the host can move to
//     its failure phase.
//   * The loop is BOUNDED (bug-10). After `maxWait` seconds of total
//     wait with no verdict row, `run()` throws `PollExhausted` instead
//     of looping forever. The verdict-fire dispatch is fire-and-forget
//     (`pg_net`); a failed or never-invoked engine produces neither a
//     verdict row nor a fetch error, so without this bound the loop
//     would spin indefinitely and the post-Q5 "no spinners forever"
//     promise could not be honoured. `PollExhausted` is a distinct
//     sentinel — the host routes it to its failed phase exactly as it
//     does a fetch error, but the two are tellable apart by type.
//     The bound is expressed as wall-clock seconds (not a raw attempt
//     count) so it stays meaningful when `interval` changes; the loop
//     gives up once the next sleep would push total wait past `maxWait`.

import Foundation

/// One verdict round-trip. Returns nil while the engine hasn't yet
/// committed the `verdicts` row for the room.
public typealias VerdictFetch =
    @Sendable (UUID) async throws -> VerdictStore.VerdictView?

/// The inter-poll delay. Production: `Task.sleep`. Tests: a no-op or a
/// cancellation-checking stub.
public typealias VerdictPollSleep =
    @Sendable (TimeInterval) async throws -> Void

/// Polls `verdicts` for a room until the engine's row lands.
public struct VerdictPoller: Sendable {

    /// Thrown by `run()` when the poll's wall-clock bound is reached
    /// with no verdict row. A distinct sentinel — the post-Q5 host
    /// routes it to its failed (retry) phase exactly as it does a fetch
    /// error, while staying tellable apart from a transport error by
    /// type. NOT a verdict and NOT a crash.
    public struct PollExhausted: Error {
        /// The room whose verdict never landed inside the bound.
        public let roomID: UUID
        /// The wall-clock ceiling (seconds) that was reached.
        public let maxWait: TimeInterval
    }

    public let roomID: UUID
    /// Seconds between poll attempts. The upper bound on how long after
    /// the engine fires the verdict can take to surface.
    public let interval: TimeInterval
    /// Total wall-clock seconds the poll will wait before giving up.
    /// A healthy verdict resolves within a few seconds of the engine
    /// firing, so the default is generous (75s) — long enough never to
    /// truncate a slow-but-healthy resolve, short enough that a real
    /// silent failure surfaces as a retryable error, not an infinite
    /// spinner. See bug-10. A non-finite value (`.infinity`) disables
    /// the bound — the loop then ends only on a verdict or cancellation.
    public let maxWait: TimeInterval

    private let fetch: VerdictFetch
    private let sleep: VerdictPollSleep

    public init(
        roomID: UUID,
        interval: TimeInterval = 3,
        maxWait: TimeInterval = 75,
        fetch: @escaping VerdictFetch,
        sleep: @escaping VerdictPollSleep = { seconds in
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
        }
    ) {
        self.roomID = roomID
        self.interval = interval
        self.maxWait = maxWait
        self.fetch = fetch
        self.sleep = sleep
    }

    /// Poll until the verdict row lands, then return it.
    ///
    /// - Returns: the `VerdictView` for the room's verdict.
    /// - Throws: `CancellationError` if the owning task is cancelled
    ///   (host teardown — cancellation always wins over the timeout);
    ///   `PollExhausted` once `maxWait` seconds of total wait elapse
    ///   with no verdict row; or any error the `fetch` closure throws.
    public func run() async throws -> VerdictStore.VerdictView {
        // Accumulated wall-clock wait, advanced by `interval` on every
        // completed inter-poll sleep. The loop gives up before a sleep
        // that would push the total past `maxWait`, so a verdict that
        // lands on any attempt inside the bound still resolves normally.
        var elapsed: TimeInterval = 0
        var attempt = 0
        DebugTrace.mark(
            "poller.run.start",
            room: roomID,
            detail: "interval=\(interval) maxWait=\(maxWait)"
        )
        while true {
            try Task.checkCancellation()
            attempt += 1
            DebugTrace.mark(
                "poller.beforeFetch",
                room: roomID,
                detail: "attempt=\(attempt) elapsed=\(elapsed)"
            )
            let fetched: VerdictStore.VerdictView?
            do {
                fetched = try await fetch(roomID)
            } catch {
                DebugTrace.mark(
                    "poller.fetchThrew",
                    room: roomID,
                    detail: "attempt=\(attempt) error=\(error)"
                )
                throw error
            }
            DebugTrace.mark(
                "poller.afterFetch",
                room: roomID,
                detail: "attempt=\(attempt) verdict=\(fetched != nil)"
            )
            if let fetched {
                DebugTrace.mark("poller.returningVerdict", room: roomID)
                return fetched
            }
            // Cancellation is checked before the bound so host teardown
            // unwinds as CancellationError, never as PollExhausted.
            try Task.checkCancellation()
            // A non-finite `maxWait` means "unbounded" — the give-up
            // branch is skipped and only a verdict or cancellation ends
            // the loop. The default is finite (75s); `.infinity` is the
            // explicit opt-out used by cancellation-isolation tests.
            if maxWait.isFinite && elapsed + interval >= maxWait {
                DebugTrace.mark(
                    "poller.exhausted",
                    room: roomID,
                    detail: "attempt=\(attempt) elapsed=\(elapsed)"
                )
                throw PollExhausted(roomID: roomID, maxWait: maxWait)
            }
            DebugTrace.mark(
                "poller.beforeSleep",
                room: roomID,
                detail: "attempt=\(attempt)"
            )
            try await sleep(interval)
            elapsed += interval
        }
    }
}
