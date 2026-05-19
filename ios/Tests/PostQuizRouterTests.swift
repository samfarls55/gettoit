// GetToIt — PostQuizRouter unit tests (bug-12).
//
// `RootView.enterPostQuiz` used to build a fresh `PostQuizHost` on every
// call. A successful Q5 submit delivers `onSubmitted` twice (the Q5 CTA
// path and the `.submitted` step's `.task`), so the second call replaced
// the live, polling host with a brand-new one whose SwiftUI `.task` never
// re-ran — the verdict resolved on the orphaned first host and the
// "LINING UP THE VERDICT" spinner span forever.
//
// `PostQuizRouter.shouldEnterPostQuiz` is the pure idempotency guard the
// fix extracts: given the room currently held by `postQuizHost` (if any)
// and the incoming room, it answers whether `enterPostQuiz` should build
// and assign a new host. A duplicate entry for the same room is a no-op;
// a genuinely new room still routes.

import XCTest
@testable import GetToIt

final class PostQuizRouterTests: XCTestCase {

    // MARK: - cold entry

    func testEntersWhenNoHostHeld() {
        // No post-Q5 host yet — the first onSubmitted must route.
        XCTAssertTrue(
            PostQuizRouter.shouldEnterPostQuiz(
                currentRoomID: nil,
                incomingRoomID: UUID()
            ),
            "the first onSubmitted for a session must build the host"
        )
    }

    // MARK: - duplicate entry (the bug-12 defect)

    func testIgnoresDuplicateEntryForSameRoom() {
        // The second onSubmitted for the SAME room must not replace the
        // live polling host — that orphaning is the actual defect.
        let room = UUID()
        XCTAssertFalse(
            PostQuizRouter.shouldEnterPostQuiz(
                currentRoomID: room,
                incomingRoomID: room
            ),
            "a duplicate onSubmitted for a room already routed must be ignored"
        )
    }

    // MARK: - genuinely new session

    func testEntersForADifferentRoom() {
        // A new decision (different room) in the same app launch must
        // still route into a fresh host.
        XCTAssertTrue(
            PostQuizRouter.shouldEnterPostQuiz(
                currentRoomID: UUID(),
                incomingRoomID: UUID()
            ),
            "a genuinely new room must route into a fresh PostQuizHost"
        )
    }
}
