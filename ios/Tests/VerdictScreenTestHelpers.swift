// GetToIt — VerdictScreen test-helper init (bug-27 + bug-34).
//
// Bug-27 dropped the `onReroll = {}` default from `VerdictScreen` so
// every production call site has to wire the reroll affordance
// explicitly — otherwise the compiler catches the missing wire-up the
// next time someone adds a `VerdictScreen(...)` call site.
//
// The architectural protection applies to production code. The
// existing smoke / mode-snapshot tests do not exercise the reroll
// wiring; they care about flavor flags, choreo timings, hero stacking,
// the Home chrome row, etc. Forcing every one of those tests to pass
// `onReroll: { }` would be churn for no diagnostic value.
//
// bug-34 / ADR 0018 renamed the prior 5-case `Mode` enum on
// `VerdictScreen` to a three-case `Flavor` enum (`.default` /
// `.committed` / `.solo`). The `.readOnly` and `.noSurvivor` cases
// moved to their own surfaces (`VerdictReadOnlyScreen`,
// `NoSurvivorScreen`). This helper takes a `flavor:` argument and
// supplies the empty `onReroll`.

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
        flavor: Flavor = .default,
        ratifiedCount: Int = 0,
        ratifiedTotal: Int = 0,
        correctabilityWindowSeconds: Int = 30,
        rerollsUsed: Int = 0,
        onAdvance: @escaping () -> Void = {},
        onRatify: @escaping () -> Void = {},
        onHome: @escaping () -> Void = {}
    ) {
        self.init(
            verdict: verdict,
            flavor: flavor,
            ratifiedCount: ratifiedCount,
            ratifiedTotal: ratifiedTotal,
            correctabilityWindowSeconds: correctabilityWindowSeconds,
            rerollsUsed: rerollsUsed,
            onAdvance: onAdvance,
            onRatify: onRatify,
            onHome: onHome,
            onReroll: { }
        )
    }
}
