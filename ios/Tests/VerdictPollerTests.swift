// GetToIt — VerdictPoller unit tests (TB-19).
//
// The poller is the post-Q5 router's wait loop: it calls a fetch
// closure on a few-second cadence until a verdict row lands, then
// stops. It must also stop cleanly on task cancellation (host
// teardown) — no leaked timer / task.
//
// Pure-seam tests: the network fetch and the inter-poll sleep are
// both injected closures, so the loop is driven deterministically
// without a live Supabase client and without real wall-clock waits.

import XCTest
@testable import GetToIt

@MainActor
final class VerdictPollerTests: XCTestCase {

    /// A `VerdictStore.VerdictView` fixture — the shape the poller
    /// surfaces once a row lands. Built off the production solo
    /// `Verdict` fixture so it stays in sync with the surface contract.
    private static func verdictView() -> VerdictStore.VerdictView {
        VerdictStore.VerdictView(
            verdict: VerdictScreen.Verdict.soloFixture(),
            mode: .solo
        )
    }

    // MARK: - verdict-found stops the loop

    func testPollerStopsOnceTheVerdictIsFound() async throws {
        let roomID = UUID()
        let attempts = Counter()
        let view = Self.verdictView()
        // The verdict lands on the 3rd poll attempt.
        let poller = VerdictPoller(
            roomID: roomID,
            interval: 2,
            fetch: { id in
                XCTAssertEqual(id, roomID)
                let n = await attempts.increment()
                return n >= 3 ? view : nil
            },
            sleep: { _ in /* no real wait */ }
        )

        let found = try await poller.run()

        XCTAssertEqual(found.mode, .solo,
            "the poller must surface the verdict once a row lands")
        let count = await attempts.value
        XCTAssertEqual(count, 3,
            "the loop must stop on the first non-nil fetch — exactly 3 attempts, no more")
    }

    func testPollerSurfacesTheVerdictOnTheFirstAttemptWhenAlreadyPresent() async throws {
        let attempts = Counter()
        let view = Self.verdictView()
        let poller = VerdictPoller(
            roomID: UUID(),
            interval: 2,
            fetch: { _ in
                _ = await attempts.increment()
                return view
            },
            sleep: { _ in }
        )

        _ = try await poller.run()

        let count = await attempts.value
        XCTAssertEqual(count, 1,
            "a verdict already present must be surfaced on the first poll — no extra round-trips")
    }

    // MARK: - teardown stops the loop (no leaked task)

    func testPollerStopsOnTaskCancellation() async throws {
        let attempts = Counter()
        // fetch never returns a verdict — only cancellation can end this.
        // `maxWait: .infinity` disables the bug-10 bound so this test
        // isolates the cancellation contract; the bound is covered
        // separately by the give-up tests above.
        let poller = VerdictPoller(
            roomID: UUID(),
            interval: 2,
            maxWait: .infinity,
            fetch: { _ in
                _ = await attempts.increment()
                return nil
            },
            sleep: { _ in
                // Yield + honour cancellation between polls — mirrors
                // `Task.sleep`'s cancellation behaviour.
                try Task.checkCancellation()
                await Task.yield()
            }
        )

        let task = Task { try await poller.run() }
        // Let a couple of polls happen, then tear the host down.
        try await Task.sleep(nanoseconds: 5_000_000)
        task.cancel()

        do {
            _ = try await task.value
            XCTFail("a cancelled poller must throw, not return a verdict")
        } catch is CancellationError {
            // expected — the loop unwound cleanly on teardown.
        }
        let count = await attempts.value
        XCTAssertGreaterThan(count, 0, "the poller should have polled at least once before teardown")
    }

    func testPollerPropagatesAFetchError() async throws {
        struct Boom: Error {}
        let poller = VerdictPoller(
            roomID: UUID(),
            interval: 2,
            fetch: { _ in throw Boom() },
            sleep: { _ in }
        )

        do {
            _ = try await poller.run()
            XCTFail("a fetch error must propagate so the host can surface a failure state")
        } catch is Boom {
            // expected
        }
    }

    // MARK: - bug-10: the poll is bounded — it gives up

    func testPollerGivesUpAfterTheBoundWhenNoVerdictEverLands() async throws {
        let attempts = Counter()
        // A 12s ceiling at a 3s cadence ⇒ 4 fetch attempts, then give up.
        let poller = VerdictPoller(
            roomID: UUID(),
            interval: 3,
            maxWait: 12,
            fetch: { _ in
                _ = await attempts.increment()
                return nil  // the verdict row never lands
            },
            sleep: { _ in /* no real wait */ }
        )

        do {
            _ = try await poller.run()
            XCTFail("an unbounded poll must not run forever — it must give up")
        } catch is VerdictPoller.PollExhausted {
            // expected — the loop bounded itself and signalled give-up.
        }

        let count = await attempts.value
        XCTAssertEqual(count, 4,
            "a 12s ceiling at a 3s cadence must give up after exactly 4 fetch attempts")
    }

    func testPollExhaustionIsDistinctFromAFetchError() async throws {
        // The give-up sentinel must be its own type so the host can tell
        // give-up from a transport error if it ever wants to — both route
        // to .failed today, but the contract is a distinct signal.
        let poller = VerdictPoller(
            roomID: UUID(),
            interval: 1,
            maxWait: 2,
            fetch: { _ in nil },
            sleep: { _ in }
        )

        do {
            _ = try await poller.run()
            XCTFail("the poller must give up")
        } catch is VerdictPoller.PollExhausted {
            // expected
        } catch {
            XCTFail("give-up must surface as PollExhausted, not \(type(of: error))")
        }
    }

    func testVerdictFoundBeforeTheBoundStillResolves() async throws {
        let attempts = Counter()
        let view = Self.verdictView()
        // The verdict lands on attempt 3 — well inside a 30s / 3s ⇒ 10
        // attempt ceiling. The bound must never truncate a healthy resolve.
        let poller = VerdictPoller(
            roomID: UUID(),
            interval: 3,
            maxWait: 30,
            fetch: { _ in
                let n = await attempts.increment()
                return n >= 3 ? view : nil
            },
            sleep: { _ in }
        )

        let found = try await poller.run()

        XCTAssertEqual(found.mode, .solo,
            "a verdict that lands inside the bound must still resolve normally")
        let count = await attempts.value
        XCTAssertEqual(count, 3,
            "the bound must not add round-trips to a healthy resolve")
    }

    func testCancellationWinsOverTheBoundCheck() async throws {
        // A timeout must not fight cancellation. The give-up branch is
        // preceded by `try Task.checkCancellation()`, so a cancelled
        // poller always unwinds as CancellationError, never as
        // PollExhausted. `maxWait: .infinity` keeps the bound from
        // racing the 5ms cancel window — this test isolates the
        // ordering guarantee; the bound itself is covered by the
        // give-up tests above.
        let attempts = Counter()
        let poller = VerdictPoller(
            roomID: UUID(),
            interval: 3,
            maxWait: .infinity,
            fetch: { _ in
                _ = await attempts.increment()
                return nil
            },
            sleep: { _ in
                try Task.checkCancellation()
                await Task.yield()
            }
        )

        let task = Task { try await poller.run() }
        try await Task.sleep(nanoseconds: 5_000_000)
        task.cancel()

        do {
            _ = try await task.value
            XCTFail("a cancelled poller must throw CancellationError")
        } catch is CancellationError {
            // expected — cancellation wins over the timeout.
        } catch is VerdictPoller.PollExhausted {
            XCTFail("teardown must unwind as CancellationError, not PollExhausted")
        }
    }

    func testDefaultBoundIsGenerousEnoughForASlowResolve() {
        // The production default must sit in the issue's 60–90s window so
        // a healthy slow resolve is never cut off.
        let poller = VerdictPoller(roomID: UUID(), fetch: { _ in nil })
        XCTAssertGreaterThanOrEqual(poller.maxWait, 60,
            "the default ceiling must be at least 60s — never truncate a slow resolve")
        XCTAssertLessThanOrEqual(poller.maxWait, 90,
            "the default ceiling must be at most 90s — a real failure surfaces promptly")
    }
}

/// Minimal actor counter so the injected `fetch` closure can tally
/// attempts without a data race under Swift concurrency checking.
private actor Counter {
    private(set) var value = 0
    @discardableResult
    func increment() -> Int {
        value += 1
        return value
    }
}
