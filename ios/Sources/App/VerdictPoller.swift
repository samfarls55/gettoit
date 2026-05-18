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

    public let roomID: UUID
    /// Seconds between poll attempts. The upper bound on how long after
    /// the engine fires the verdict can take to surface.
    public let interval: TimeInterval

    private let fetch: VerdictFetch
    private let sleep: VerdictPollSleep

    public init(
        roomID: UUID,
        interval: TimeInterval = 3,
        fetch: @escaping VerdictFetch,
        sleep: @escaping VerdictPollSleep = { seconds in
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
        }
    ) {
        self.roomID = roomID
        self.interval = interval
        self.fetch = fetch
        self.sleep = sleep
    }

    /// Poll until the verdict row lands, then return it.
    ///
    /// - Returns: the `VerdictView` for the room's verdict.
    /// - Throws: `CancellationError` if the owning task is cancelled
    ///   (host teardown), or any error the `fetch` closure throws.
    public func run() async throws -> VerdictStore.VerdictView {
        while true {
            try Task.checkCancellation()
            if let verdict = try await fetch(roomID) {
                return verdict
            }
            try await sleep(interval)
        }
    }
}
