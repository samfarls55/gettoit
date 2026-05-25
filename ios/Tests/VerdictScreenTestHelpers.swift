// GetToIt — VerdictScreen test-helper init (bug-27).
//
// Bug-27 dropped the `onReroll = {}` default from `VerdictScreen` so
// every production call site has to wire the reroll affordance
// explicitly — otherwise the compiler catches the missing wire-up the
// next time someone adds a `VerdictScreen(...)` call site (which is
// exactly the failure shape bug-27 documented).
//
// The architectural protection applies to production code. The
// existing smoke / mode-snapshot tests do not exercise the reroll
// wiring; they care about mode flags, choreo timings, hero stacking,
// the Home chrome row, etc. Forcing every one of those tests to pass
// `onReroll: { }` would be churn for no diagnostic value (a smoke
// test cannot fail in a way that reroll wiring would catch).
//
// This extension provides a test-target-only convenience init that
// supplies the empty `onReroll` so the existing test bodies compile
// unchanged. New tests that DO want to assert reroll behaviour should
// pass `onReroll:` explicitly (the canonical bug-27 test lives in
// `VerdictRerollHostTests.swift` and exercises the host wiring
// directly via `RerollSheetState`, not via the screen's init).
//
// The init delegates straight to the main one — no behaviour change.

import Foundation
@testable import GetToIt

@MainActor
extension VerdictScreen {

    /// Test-only convenience: build a `VerdictScreen` without the
    /// `onReroll` arg the production init now requires. Defaults the
    /// closure to a no-op — fine for smoke / snapshot tests that do
    /// not exercise the reroll affordance. Production code must keep
    /// passing `onReroll:` explicitly so bug-27 stays caught at the
    /// next missing wire-up.
    init(
        verdict: Verdict,
        mode: Mode = .default,
        isInitiator: Bool = true,
        currentRadiusMeters: Int = 3219,
        ratifiedCount: Int = 0,
        ratifiedTotal: Int = 0,
        correctabilityWindowSeconds: Int = 30,
        rerollsUsed: Int = 0,
        onAdvance: @escaping () -> Void = {},
        onRatify: @escaping () -> Void = {},
        onWidenRadius: @escaping (Int) -> Void = { _ in },
        onHome: @escaping () -> Void = {}
    ) {
        self.init(
            verdict: verdict,
            mode: mode,
            isInitiator: isInitiator,
            currentRadiusMeters: currentRadiusMeters,
            ratifiedCount: ratifiedCount,
            ratifiedTotal: ratifiedTotal,
            correctabilityWindowSeconds: correctabilityWindowSeconds,
            rerollsUsed: rerollsUsed,
            onAdvance: onAdvance,
            onRatify: onRatify,
            onWidenRadius: onWidenRadius,
            onHome: onHome,
            onReroll: { }
        )
    }
}
