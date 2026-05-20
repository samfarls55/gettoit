// GetToIt — Quiz chrome post-exit destination tests (tb-WF-2).
//
// Acceptance: "After Exit/Leave, the user lands on the Plan list (or
// S00 Landing if Plans aren't yet user-visible at the time of this
// issue landing)." Until tb-WF-4 lands the visible Plan list surface,
// the iOS post-exit destination is S00 Landing. This test pins that
// invariant so the chrome's `onExit` callback always lands the user
// on the same surface — no flaky path that dead-ends.
//
// The actual route is in RootView (the `activeQuiz = nil` clear, which
// the precedence chain hands back to S00 Landing for a signed-in idle
// session). The test here pins the destination via the
// `QuizChromePostExitDestination` enum that the chrome callback hands
// up to the host. If a future tb-WF-4 PR flips the destination to
// `planList`, the test for the current value catches the change in
// review rather than silently routing somewhere else.

import XCTest
@testable import GetToIt

final class QuizChromePostExitTests: XCTestCase {

    func testPostExitDestinationIsLandingUntilPlansAreUserVisible() {
        // Acceptance: "until tb-WF-4 lands, exits punt to S00 Landing."
        XCTAssertEqual(
            QuizChromePostExitDestination.current,
            .landing,
            "expected the post-exit destination to be S00 Landing while the Plan list surface is not yet user-visible (tb-WF-4)"
        )
    }
}
