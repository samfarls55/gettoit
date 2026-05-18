// GetToIt — PostQuizHost (TB-19).
//
// The post-Q5 router. Closes bug-07: before this, a successful Q5
// submit cleared the active quiz and the RootView precedence chain
// fell through to S00 Landing — the session dead-ended. PostQuizHost
// is the surface that owns the session lifecycle from "Q5 submitted"
// to "verdict on screen".
//
// Phase machine:
//
//     resolving ──(verdict row landed)──▶ verdict
//          │
//          └──────(poll error)──────────▶ failed
//
//   * resolving — neutral hold surface. For a SOLO session this is
//     a transient pass-through (the host polls straight away). For a
//     GROUP session this is also where the host holds for tb-19 — the
//     full S04 Waiting surface (avatar row, countdown, nudge) is the
//     next slice, tb-20. Either way it is NOT S00 Landing, so the
//     session no longer dead-ends.
//   * verdict — `VerdictScreen` renders. Solo sessions render in
//     `.solo` mode; the mode is whatever `VerdictStore` resolved.
//   * failed — the verdict poll errored. A retry CTA re-enters
//     `resolving`.
//
// Solo detection is delegated to `SoloPath.shouldSkipWaiting` — the
// canonical detector (tb-13). The host does not re-implement the rule.
//
// Lifecycle / no-leak contract:
//   * `start()` runs the verdict poll to completion (used by tests and
//     by the SwiftUI `.task` driver — `.task` cancels the body on view
//     teardown, so the poll loop unwinds with it).
//   * `beginPolling()` / `teardown()` give an explicit handle on the
//     poll task for call sites that own the lifecycle directly. The
//     poll loop stops on verdict-found AND on `teardown()` — no leaked
//     timer / task.

import Foundation

/// The session snapshot captured at Q5 submit. Carried from `RootView`
/// into the post-Q5 router.
public struct PostQuizSessionContext: Equatable, Sendable {
    public let roomID: UUID
    public let userID: UUID
    /// Whether this device created the room (owner) vs joined it.
    public let isInitiator: Bool
    /// Whether the iOS share sheet was ever opened for this room from
    /// this device. The load-bearing input to solo detection — see
    /// `SoloPath`.
    public let invitedShared: Bool

    public init(
        roomID: UUID,
        userID: UUID,
        isInitiator: Bool,
        invitedShared: Bool
    ) {
        self.roomID = roomID
        self.userID = userID
        self.isInitiator = isInitiator
        self.invitedShared = invitedShared
    }

    /// True when the post-Q5 router should skip S04 Waiting and resolve
    /// the verdict directly. A solo session is a lone member who never
    /// shared an invite — `memberCount` is 1 by construction here (the
    /// lone initiator is the only `members` row), so the detector
    /// reduces to the `invitedShared` flag.
    public var isSolo: Bool {
        SoloPath.shouldSkipWaiting(memberCount: 1, invitedShared: invitedShared)
    }
}

@MainActor
@Observable
public final class PostQuizHost {

    /// The post-Q5 session lifecycle.
    public enum Phase {
        /// Neutral hold — the verdict poll is in flight. Not S00
        /// Landing; the session never dead-ends here.
        case resolving
        /// The verdict landed — `VerdictScreen` renders this.
        case verdict(VerdictStore.VerdictView)
        /// The verdict poll errored. A retry re-enters `resolving`.
        case failed
    }

    public let context: PostQuizSessionContext
    public private(set) var phase: Phase = .resolving

    private let fetchVerdict: VerdictFetch
    private let sleep: VerdictPollSleep
    private let pollInterval: TimeInterval

    /// The live poll task. Held so `teardown()` can cancel it — that's
    /// what guarantees no leaked timer / task on host teardown.
    private var pollTask: Task<Void, Never>?

    public init(
        context: PostQuizSessionContext,
        pollInterval: TimeInterval = 3,
        fetchVerdict: @escaping VerdictFetch,
        sleep: @escaping VerdictPollSleep = { seconds in
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
        }
    ) {
        self.context = context
        self.pollInterval = pollInterval
        self.fetchVerdict = fetchVerdict
        self.sleep = sleep
    }

    // MARK: - lifecycle

    /// Run the verdict poll to completion in-line. Used by the SwiftUI
    /// `.task` driver (which cancels on view teardown, unwinding the
    /// poll loop) and by the unit tests.
    public func start() async {
        await poll()
    }

    /// Spin the verdict poll off as a detached-from-the-caller task and
    /// retain a handle on it. Pair with `teardown()`.
    public func beginPolling() {
        guard pollTask == nil else { return }
        pollTask = Task { [weak self] in
            await self?.poll()
        }
    }

    /// Cancel the in-flight poll task. Idempotent. After teardown the
    /// poll loop is dead — no leaked timer / task.
    public func teardown() {
        pollTask?.cancel()
        pollTask = nil
    }

    /// Re-enter `resolving` and restart the poll. Wired to the failure
    /// surface's retry CTA.
    public func retry() {
        guard case .failed = phase else { return }
        phase = .resolving
        teardown()
        beginPolling()
    }

    // MARK: - poll

    private func poll() async {
        let poller = VerdictPoller(
            roomID: context.roomID,
            interval: pollInterval,
            fetch: fetchVerdict,
            sleep: sleep
        )
        do {
            let verdict = try await poller.run()
            phase = .verdict(verdict)
        } catch is CancellationError {
            // Host teardown — leave the phase as-is (resolving). The
            // surface is going away; there's nothing to render.
        } catch {
            phase = .failed
        }
    }
}
