// GetToIt — ScreenFixtures (bug-11 quiz redesign).
//
// Test-target fixture factories for the verdict / check-in / locked
// display-model value types. Lives in `Tests/`, NOT in the app target,
// so the shipped app binary contains zero hardcoded fictitious venue
// names (bug-11 acceptance criterion).
//
// Before bug-11 these `fixture()` / `soloFixture()` / `noSurvivorFixture()`
// factories were declared inside the `*Screen` value types in
// `Sources/App/`. They are called only by snapshot / smoke tests — no
// production code path reaches them (the live `VerdictStore` populates
// `Verdict` from the database). bug-11 relocates them here so their
// fictitious sample place names (`Pico's Taqueria`, `Ren Soba`,
// `Café Lou`, `Halal Cart`) no longer compile into the production binary
// as dead code.
//
// `@testable import GetToIt` grants visibility into the app-target value
// types and their memberwise initializers, so each factory body is
// reproduced here unchanged. Call sites are unchanged
// (`VerdictScreen.Verdict.fixture()`, `LockedScreen.Plate.fixture()`,
// `CheckinScreen.Plate.fixture()`, etc.).

import Foundation
@testable import GetToIt

// MARK: - VerdictScreen.Verdict

extension VerdictScreen.Verdict {

    /// JSX-fixture-shaped verdict used by snapshot tests.
    /// `// placeholder: marketing-branding pass` applies to the strings.
    static func fixture() -> VerdictScreen.Verdict {
        // placeholder: marketing-branding pass
        VerdictScreen.Verdict(
            placeName: "Pico's Taqueria",
            metaLine: "Mexican · $$ · 8 min walk",
            timeBadge: VerdictScreen.TimeBadge(time: "7:00 PM", audience: "All four of you"),
            ruleText: "Budget cap cut Ren Soba. Pico's had the lowest regret-of-omission.",
            receipts: [
                VerdictScreen.Receipt(name: "you",  action: "wanted lively"),
                VerdictScreen.Receipt(name: "alex", action: "filtered shellfish"),
                VerdictScreen.Receipt(name: "maya", action: "capped at $30"),
                VerdictScreen.Receipt(name: "sam",  action: "capped at 15 min walk"),
            ],
            cuts: [
                VerdictScreen.Cut(name: "Ren Soba",   reason: "over budget cap"),
                VerdictScreen.Cut(name: "Café Lou",   reason: "shellfish veto"),
                VerdictScreen.Cut(name: "Halal Cart", reason: "outside walk range"),
            ]
        )
    }

    /// TB-13 — JSX-fixture-shaped solo verdict. Used by the `solo` mode
    /// snapshot tests. Empty receipts list (the surface suppresses the
    /// row anyway), empty cuts (the engine still produces them for a
    /// multi-candidate solo run, but the fixture keeps the minimal
    /// shape). bug-28 — time-badge audience is the empty string so the
    /// renderer drops the subtitle row entirely (communal `"All N of
    /// you"` frame doesn't apply to a single voice; `"You"` only
    /// restates what the solo voter already knows). Rule text names the
    /// rule that produced the verdict — no `"N of M"` framing.
    /// `// placeholder: marketing-branding pass` applies to the strings.
    static func soloFixture() -> VerdictScreen.Verdict {
        // placeholder: marketing-branding pass
        VerdictScreen.Verdict(
            placeName: "Pico's Taqueria",
            metaLine: "Mexican · $$ · 8 min walk",
            timeBadge: VerdictScreen.TimeBadge(time: "7:00 PM", audience: ""),
            ruleText: "Pico's was the only candidate that fit every constraint.",
            receipts: [],
            cuts: []
        )
    }

    /// JSX-fixture-shaped no-survivor verdict — drives the `noSurvivor`
    /// mode snapshot tests. The hero stacks as "NO SPOT / FITS" via the
    /// placeholder `placeName`; the engine writes the same load-bearing
    /// rule_text in aggregate-rule register. `"No spot fits"` is a
    /// genuine no-survivor UI string (also written by the live
    /// `VerdictStore` / `LateJoinerStore`), not fictitious venue
    /// content. `// placeholder: marketing-branding pass` applies to the
    /// strings.
    static func noSurvivorFixture() -> VerdictScreen.Verdict {
        // placeholder: marketing-branding pass
        VerdictScreen.Verdict(
            placeName: "No spot fits",
            metaLine: "Vegan options · $$ cap · 15 min walk",
            timeBadge: VerdictScreen.TimeBadge(time: "", audience: ""),
            ruleText: "Vegan options left no candidates within walking distance tonight.",
            receipts: [],
            cuts: []
        )
    }
}

// MARK: - CheckinScreen.Plate

extension CheckinScreen.Plate {

    /// JSX-fixture-shaped check-in plate used by snapshot tests.
    static func fixture() -> CheckinScreen.Plate {
        CheckinScreen.Plate(
            roomID: UUID(),
            verdictID: UUID(),
            placeName: "Pico's Taqueria",
            verdictAt: "Wed Apr 23 · 7:00 PM",
            metaLine: "4 in · 8 min walk"
        )
    }
}

// MARK: - LockedScreen.Plate

extension LockedScreen.Plate {

    /// JSX-fixture-shaped lock plate used by snapshot tests.
    static func fixture() -> LockedScreen.Plate {
        var dc = DateComponents()
        dc.year = 2026; dc.month = 5; dc.day = 14
        dc.hour = 18; dc.minute = 48; dc.second = 32
        let date = Calendar(identifier: .gregorian).date(from: dc)!
        return LockedScreen.Plate(
            placeName: "Pico's",
            time: "7:00",
            lockedAt: date,
            rerollsRemaining: 2,
            rerollsTotal: 3
        )
    }
}
