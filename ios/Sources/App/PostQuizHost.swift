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
//     waiting ──(verdict row landed)─────▶ verdict
//          │
//          └──────(poll error)──────────▶ failed
//
//   * resolving — neutral hold surface for a SOLO session. A transient
//     pass-through (the host polls the verdict straight away). It is
//     NOT S00 Landing, so the session no longer dead-ends.
//   * waiting — the full S04 Waiting surface for a GROUP session
//     (tb-20). The host bootstraps a `WaitingStore` from the room
//     snapshot and re-bootstraps it on a few-second cadence so the
//     avatar row reflects peers joining and answering. The same poll
//     watches for the verdict row and advances to `verdict`.
//   * verdict — `VerdictScreen` renders. Solo sessions render in
//     `.solo` mode; the mode is whatever `VerdictStore` resolved.
//   * failed — the poll errored. A retry CTA re-enters the session's
//     phase (`resolving` solo / `waiting` group).
//
// Solo detection is delegated to `SoloPath.shouldSkipWaiting` — the
// canonical detector (tb-13). The host does not re-implement the rule.
// `context.isSolo` picks the entry phase: solo → `resolving`,
// group → `waiting`.
//
// Lifecycle / no-leak contract:
//   * `start()` runs the appropriate poll to completion (used by tests
//     and by the SwiftUI `.task` driver — `.task` cancels the body on
//     view teardown, so the poll loop unwinds with it).
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
        /// Neutral hold for a SOLO session — the verdict poll is in
        /// flight. Not S00 Landing; the session never dead-ends here.
        case resolving
        /// The S04 Waiting surface for a GROUP session. The associated
        /// `WaitingStore` drives the avatar row + headline; the host
        /// re-bootstraps it on every snapshot poll.
        case waiting(WaitingStore)
        /// The verdict landed — `VerdictScreen` renders this.
        case verdict(VerdictStore.VerdictView)
        /// The poll errored. A retry re-enters the session's phase.
        case failed
    }

    public let context: PostQuizSessionContext
    public private(set) var phase: Phase

    private let fetchVerdict: VerdictFetch
    private let fetchSnapshot: SessionSnapshotFetch?
    private let sleep: VerdictPollSleep
    private let pollInterval: TimeInterval

    /// The live `WaitingStore` for a group session. Held so the
    /// snapshot poll can re-bootstrap the same instance every cycle
    /// (re-creating it each poll would drop the SwiftUI binding). Nil
    /// for a solo session.
    public private(set) var waitingStore: WaitingStore?

    /// The live poll task. Held so `teardown()` can cancel it — that's
    /// what guarantees no leaked timer / task on host teardown.
    private var pollTask: Task<Void, Never>?

    public init(
        context: PostQuizSessionContext,
        pollInterval: TimeInterval = 3,
        fetchVerdict: @escaping VerdictFetch,
        fetchSnapshot: SessionSnapshotFetch? = nil,
        sleep: @escaping VerdictPollSleep = { seconds in
            try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
        }
    ) {
        self.context = context
        self.pollInterval = pollInterval
        self.fetchVerdict = fetchVerdict
        self.fetchSnapshot = fetchSnapshot
        self.sleep = sleep
        // The entry phase is the routing decision: a solo session holds
        // on the neutral resolving surface; a group session opens the
        // S04 Waiting surface with a fresh, un-bootstrapped store. The
        // first snapshot poll seeds it.
        if context.isSolo {
            self.phase = .resolving
        } else {
            let store = WaitingStore(
                roomID: context.roomID,
                currentUserID: context.userID,
                isInitiator: context.isInitiator
            )
            self.waitingStore = store
            self.phase = .waiting(store)
        }
    }

    // MARK: - lifecycle

    /// Run the appropriate poll to completion in-line — the verdict
    /// poll for a solo session, the snapshot + verdict poll for a
    /// group session. Used by the SwiftUI `.task` driver (which
    /// cancels on view teardown, unwinding the poll loop) and by the
    /// unit tests.
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

    /// Re-enter the session's phase and restart the poll. Wired to the
    /// failure surface's retry CTA. A solo session re-enters
    /// `resolving`; a group session re-enters `waiting` on its
    /// existing `WaitingStore`.
    public func retry() {
        guard case .failed = phase else { return }
        if let store = waitingStore {
            phase = .waiting(store)
        } else {
            phase = .resolving
        }
        teardown()
        beginPolling()
    }

    // MARK: - poll

    private func poll() async {
        do {
            if let store = waitingStore, let fetchSnapshot {
                try await pollGroup(store: store, fetchSnapshot: fetchSnapshot)
            } else {
                try await pollSolo()
            }
        } catch is CancellationError {
            // Host teardown — leave the phase as-is. The surface is
            // going away; there's nothing to render.
        } catch {
            phase = .failed
        }
    }

    /// Solo path — poll `verdicts` straight to the verdict. No S04.
    private func pollSolo() async throws {
        let poller = VerdictPoller(
            roomID: context.roomID,
            interval: pollInterval,
            fetch: fetchVerdict,
            sleep: sleep
        )
        let verdict = try await poller.run()
        phase = .verdict(verdict)
    }

    /// Group path — on each cadence tick re-bootstrap the `WaitingStore`
    /// from a fresh room snapshot (so the avatar row reflects peers
    /// joining + answering) AND check whether the verdict row has
    /// landed. The verdict check happens after the snapshot so a
    /// snapshot that already reports `verdict_ready` is reconciled the
    /// same cycle the verdict row is fetched.
    ///
    /// `WaitingStore.bootstrap` is documented idempotent — re-applying
    /// a snapshot every cycle overwrites cleanly with no residue.
    private func pollGroup(
        store: WaitingStore,
        fetchSnapshot: @escaping SessionSnapshotFetch
    ) async throws {
        while true {
            try Task.checkCancellation()

            if let snapshot = try await fetchSnapshot(context.roomID) {
                store.bootstrap(
                    members: snapshot.members,
                    answered: snapshot.answered,
                    status: snapshot.status
                )
            }

            if let verdict = try await fetchVerdict(context.roomID) {
                phase = .verdict(verdict)
                return
            }

            try await sleep(pollInterval)
        }
    }
}
