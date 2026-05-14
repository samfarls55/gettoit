// GetToIt — RatificationStore unit tests (TB-08).
//
// Drives `RatificationStore.apply(event:)` deterministically so the
// mutual-state surface contract is locked without a live Supabase
// project. The integration test in `RatificationIntegrationTests`
// covers the round-trip through PostgREST.

import XCTest
import Supabase
@testable import GetToIt

@MainActor
final class RatificationStoreTests: XCTestCase {

    /// Build a store with a stub client. The store's apply-event seam
    /// doesn't touch the network, so the stub never sees a request.
    private func makeStore() -> RatificationStore {
        // The store's init only stores the client; apply-event paths
        // ignore it. Using a "real" SupabaseClient instance keeps the
        // type intact without exercising any HTTP.
        let url = URL(string: "https://example.supabase.co")!
        let client = SupabaseClient(supabaseURL: url, supabaseKey: "test-key")
        return RatificationStore(
            client: client,
            roomID: UUID(),
            verdictID: UUID()
        )
    }

    func testCountSnapshotEventReplacesCountAndTotal() {
        let store = makeStore()
        store.apply(event: .countSnapshot(count: 2, total: 4))
        XCTAssertEqual(store.count, 2)
        XCTAssertEqual(store.total, 4)
    }

    func testRatifiedEventIncrementsCountUpToTotal() {
        let store = makeStore()
        store.apply(event: .countSnapshot(count: 0, total: 3))

        store.apply(event: .ratified(userID: UUID()))
        XCTAssertEqual(store.count, 1)

        store.apply(event: .ratified(userID: UUID()))
        XCTAssertEqual(store.count, 2)
    }

    func testRatifiedEventCapsAtTotal() {
        let store = makeStore()
        store.apply(event: .countSnapshot(count: 0, total: 2))

        store.apply(event: .ratified(userID: UUID()))
        store.apply(event: .ratified(userID: UUID()))
        store.apply(event: .ratified(userID: UUID()))

        XCTAssertEqual(store.count, 2,
            "count must not exceed total — a duplicate broadcast can't push above the member count")
    }

    func testRatifiedEventFlipsHasRatifiedWhenItMatchesTheCurrentUserOverride() {
        let store = makeStore()
        let me = UUID()
        store.currentRatifierIDOverride.wrappedValue = me
        store.apply(event: .countSnapshot(count: 0, total: 2))

        store.apply(event: .ratified(userID: UUID()))
        XCTAssertFalse(store.hasRatified, "stranger's broadcast doesn't flip my flag")

        store.apply(event: .ratified(userID: me))
        XCTAssertTrue(store.hasRatified, "my own broadcast flips hasRatified")
    }
}
