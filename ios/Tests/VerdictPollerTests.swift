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
        let poller = VerdictPoller(
            roomID: UUID(),
            interval: 2,
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
