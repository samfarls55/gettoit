// GetToIt — InitiatorScreen pure-logic tests (TB-03).
//
// These cover the static helpers on `InitiatorScreen` that don't
// require booting SwiftUI or Supabase:
//   * `metersFromMiles` — the miles→meters conversion used when
//     writing `rooms.radius_meters`.
//   * `formatRadiusLabel` — the `"2.0 MI"` label format used by the
//     C-21 slider row.
//
// Integration coverage (defaults persist, non-defaults persist, CHECK
// constraint rejects) lives in `RoomStoreIntegrationTests`.

import XCTest
@testable import GetToIt

@MainActor
final class InitiatorScreenTests: XCTestCase {

    /// Spec defaults (10 min / 2.0 mi) line up with the migration
    /// defaults (10 / 3219 m). Both `InitiatorScreen` and `RoomStore`
    /// mirror the canonical S01 surface doc, so they have to agree.
    func testStaticDefaultsMatchMigrationDefaults() {
        XCTAssertEqual(InitiatorScreen.defaultTimerMinutes, 10)
        XCTAssertEqual(InitiatorScreen.defaultRadiusMiles, 2.0)
        XCTAssertEqual(RoomStore.defaultTimerMinutes, 10)
        XCTAssertEqual(RoomStore.defaultRadiusMeters, 3219)
        // 2.0 mi rounded to integer meters via the canonical
        // conversion factor — verifies the migration default lines up
        // with what the slider's "2.0 mi" position writes.
        XCTAssertEqual(InitiatorScreen.metersFromMiles(2.0), 3219)
    }

    /// Slider end-positions must convert to the values the CHECK
    /// constraint admits (805..16093 m). The S01 range is 805..8047 —
    /// the upper window is widened in the migration so the S05
    /// "Widen radius" path (TB-09) can push past 5 mi later without a
    /// follow-up migration.
    func testMetersFromMilesCoversSliderRange() {
        XCTAssertEqual(InitiatorScreen.metersFromMiles(0.5), 805)
        XCTAssertEqual(InitiatorScreen.metersFromMiles(1.0), 1609)
        XCTAssertEqual(InitiatorScreen.metersFromMiles(1.5), 2414)
        XCTAssertEqual(InitiatorScreen.metersFromMiles(2.0), 3219)
        XCTAssertEqual(InitiatorScreen.metersFromMiles(2.5), 4023)
        XCTAssertEqual(InitiatorScreen.metersFromMiles(3.0), 4828)
        XCTAssertEqual(InitiatorScreen.metersFromMiles(3.5), 5633)
        XCTAssertEqual(InitiatorScreen.metersFromMiles(4.0), 6437)
        XCTAssertEqual(InitiatorScreen.metersFromMiles(4.5), 7242)
        XCTAssertEqual(InitiatorScreen.metersFromMiles(5.0), 8047)
    }

    /// Label is uppercase, fixed-decimal, single decimal place — never
    /// `"2 MI"` or `"2.00 MI"`. Mirrors the JSX's `radius.toFixed(1)`.
    func testFormatRadiusLabel() {
        XCTAssertEqual(InitiatorScreen.formatRadiusLabel(0.5), "0.5 MI")
        XCTAssertEqual(InitiatorScreen.formatRadiusLabel(2.0), "2.0 MI")
        XCTAssertEqual(InitiatorScreen.formatRadiusLabel(5.0), "5.0 MI")
    }

    /// The legal-set for `timer_minutes` is locked at four values; if
    /// this ever changes (S01 spec or migration) both have to change
    /// together.
    func testTimerOptionsMatchSpecAndMigrationCheckSet() {
        XCTAssertEqual(InitiatorScreen.timerOptions, [5, 10, 15, 30])
    }

    // MARK: - TB-11 — re-invite prefill defaults

    /// The TB-11 re-invite CTA on the read-only S05 surface returns
    /// the late-joiner to S01 with the prior room's timer + radius
    /// pre-populated as defaults. The InitiatorScreen accepts those
    /// values via its `prefilledTimerMinutes` / `prefilledRadiusMiles`
    /// init parameters; absent the parameters, the canonical S01
    /// defaults (10 min / 2.0 mi) still apply.
    func testPrefilledDefaultsFallBackToCanonicalS01ValuesWhenNotProvided() {
        let resolved = InitiatorScreen.resolvedPrefill(
            timerMinutes: nil,
            radiusMiles: nil
        )
        XCTAssertEqual(resolved.timer, InitiatorScreen.defaultTimerMinutes,
            "no prefill → 10 min default per S01 spec")
        XCTAssertEqual(resolved.miles, InitiatorScreen.defaultRadiusMiles, accuracy: 0.001,
            "no prefill → 2.0 mi default per S01 spec")
    }

    func testPrefilledDefaultsPassThroughTimerAndRadiusWhenProvided() {
        let resolved = InitiatorScreen.resolvedPrefill(
            timerMinutes: 15,
            radiusMiles: 3.0
        )
        XCTAssertEqual(resolved.timer, 15)
        XCTAssertEqual(resolved.miles, 3.0, accuracy: 0.001)
    }

    func testPrefilledDefaultsClampOutOfRangeRadius() {
        // A prefill from a widened no-survivor room could carry, say,
        // 9.5 mi. The S01 slider range is `0.5 mi .. 5.0 mi` — the
        // prefill must clamp to the legal range.
        XCTAssertEqual(InitiatorScreen.resolvedPrefill(timerMinutes: nil, radiusMiles: 9.5).miles, 5.0, accuracy: 0.001)
        XCTAssertEqual(InitiatorScreen.resolvedPrefill(timerMinutes: nil, radiusMiles: 0.1).miles, 0.5, accuracy: 0.001)
    }

    func testPrefilledTimerClampsToLegalSet() {
        // 20 min isn't in the {5,10,15,30} set. Clamp to nearest legal.
        XCTAssertEqual(InitiatorScreen.resolvedPrefill(timerMinutes: 20, radiusMiles: nil).timer, 15)
        XCTAssertEqual(InitiatorScreen.resolvedPrefill(timerMinutes: 60, radiusMiles: nil).timer, 30)
        XCTAssertEqual(InitiatorScreen.resolvedPrefill(timerMinutes: 1,  radiusMiles: nil).timer, 5)
    }
}
