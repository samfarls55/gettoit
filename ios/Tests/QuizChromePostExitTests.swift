// GetToIt — Quiz chrome post-exit destination tests (tb-WF-2 → tb-WF-5).
//
// Acceptance: "After Exit/Leave, the user lands on the Plan list."
// tb-WF-5 retires `LandingScreen.swift` and routes the post-sign-in
// idle session through `PlanListScreen`. The post-exit destination
// flips with it: a confirmed Exit from the quiz now lands the user
// on the Plan list (which renders the empty-state hero on first
// launch, then the populated list once they have a Plan).
//
// The actual route is in RootView (the `activeQuiz = nil` clear, which
// the precedence chain hands back to the Plan list for a signed-in
// idle session). The test here pins the destination via the
// `QuizChromePostExitDestination` enum that the chrome callback hands
// up to the host. If a future PR flips the destination again, the
// test for the current value catches the change in review rather than
// silently routing somewhere else.

import XCTest
@testable import GetToIt

final class QuizChromePostExitTests: XCTestCase {

    func testPostExitDestinationIsPlanList() {
        // tb-WF-5 — post-exit lands the user on the iOS Plan list now
        // that `LandingScreen.swift` is gone. The precedence chain in
        // RootView resolves an idle, signed-in session to PlanListScreen.
        XCTAssertEqual(
            QuizChromePostExitDestination.current,
            .planList,
            "expected the post-exit destination to be the Plan list — tb-WF-5 retired S00 Landing"
        )
    }
}
