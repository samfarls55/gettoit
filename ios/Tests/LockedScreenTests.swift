// GetToIt — LockedScreen (S06 hard-close) tests (TB-08).
//
// Same SwiftUI "smoke + spec snapshot" pattern as the other surface
// tests. Asserts:
//   * The choreography timings are locked ms-exact to motion.md
//     §"Hard-close shutter".
//   * The mono-tagged timestamp footer formats `"Locked 6:48:32 PM · 2
//     of 3 rerolls remain"` per the locked S06 copy spec.
//   * The footer flips to `"No rerolls left. Tonight is locked."` when
//     rerollsRemaining = 0 per S06 §"Edge cases".
//   * The view materialises without crashing under default + reduced
//     motion + the alternate `.fade` motion variant.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class LockedScreenTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - body materialisation

    func testRendersWithoutCrashing() {
        render(LockedScreen(plate: .fixture()))
    }

    func testRendersUnderTheFadeMotionVariant() {
        // Defense against the reduced-motion branch panicking when
        // the shutter is suppressed.
        render(LockedScreen(plate: .fixture(), motion: .fade))
    }

    // MARK: - choreo timings (motion.md §"Hard-close shutter")

    func testHardCloseChoreoTimingsMatchTheLockedSpec() {
        // motion.md §"Hard-close shutter":
        //   0ms    Veil fades in 0 → 0.62 black     (200ms)
        //   100ms  Top + bottom shutters slide       (700ms ease-out-soft)
        //   200ms  Stamp pops 0.6 → 1.08 → 1        (480ms)
        //   1000ms Headline fades up                 (600ms)
        //   1200ms Body copy fades up                (600ms)
        //   1400ms Timestamp footer fades up         (600ms)
        XCTAssertEqual(LockedScreen.Choreo.veilDelay,         0.000, accuracy: 0.0001)
        XCTAssertEqual(LockedScreen.Choreo.veilDuration,      0.200, accuracy: 0.0001)
        XCTAssertEqual(LockedScreen.Choreo.shutterDelay,      0.100, accuracy: 0.0001)
        XCTAssertEqual(LockedScreen.Choreo.shutterDuration,   0.700, accuracy: 0.0001)
        // ScreenLocked.jsx schedules the stamp pop with an 800ms
        // animation delay; the canonical "wall-clock start" lands at
        // 800ms after the veil — the docs in motion.md show 200ms
        // which is when the animation is set to fire; we follow the
        // JSX (the authoritative implementation) at 800ms.
        XCTAssertEqual(LockedScreen.Choreo.stampDelay,        0.800, accuracy: 0.0001)
        XCTAssertEqual(LockedScreen.Choreo.stampDuration,     0.480, accuracy: 0.0001)
        XCTAssertEqual(LockedScreen.Choreo.headlineDelay,     1.000, accuracy: 0.0001)
        XCTAssertEqual(LockedScreen.Choreo.headlineDuration,  0.600, accuracy: 0.0001)
        XCTAssertEqual(LockedScreen.Choreo.bodyDelay,         1.200, accuracy: 0.0001)
        XCTAssertEqual(LockedScreen.Choreo.bodyDuration,      0.600, accuracy: 0.0001)
        XCTAssertEqual(LockedScreen.Choreo.timestampDelay,    1.400, accuracy: 0.0001)
        XCTAssertEqual(LockedScreen.Choreo.timestampDuration, 0.600, accuracy: 0.0001)
    }

    // MARK: - timestamp footer formatting

    func testTimestampFooterFormatMatchesLockedCopy() {
        // S06 spec example: `"Locked 6:48:32 PM · 2 of 3 rerolls remain"`.
        var dc = DateComponents()
        dc.year = 2026; dc.month = 5; dc.day = 14
        dc.hour = 18; dc.minute = 48; dc.second = 32
        let date = Calendar(identifier: .gregorian).date(from: dc)!
        let plate = LockedScreen.Plate(
            placeName: "Pico's",
            time: "7:00",
            lockedAt: date,
            rerollsRemaining: 2,
            rerollsTotal: 3
        )
        XCTAssertEqual(
            LockedScreen.formatFooter(plate),
            "Locked 6:48:32 PM · 2 of 3 rerolls remain"
        )
    }

    func testFooterFlatStatementWhenNoRerollsRemain() {
        // S06 §"Edge cases": footer becomes `"No rerolls left. Tonight
        // is locked."` — flat statement, no re-opening path.
        var dc = DateComponents()
        dc.year = 2026; dc.month = 5; dc.day = 14
        dc.hour = 18; dc.minute = 48; dc.second = 32
        let date = Calendar(identifier: .gregorian).date(from: dc)!
        let plate = LockedScreen.Plate(
            placeName: "Pico's",
            time: "7:00",
            lockedAt: date,
            rerollsRemaining: 0,
            rerollsTotal: 3
        )
        XCTAssertEqual(
            LockedScreen.formatFooter(plate),
            "Locked 6:48:32 PM · No rerolls left. Tonight is locked."
        )
    }

    // MARK: - elapsed formatter

    func testFormatElapsedReturnsHumanReadableDuration() {
        let now = Date()
        XCTAssertEqual(
            LockedScreen.formatElapsed(now.addingTimeInterval(-12), relativeTo: now),
            "12 seconds"
        )
        XCTAssertEqual(
            LockedScreen.formatElapsed(now.addingTimeInterval(-60), relativeTo: now),
            "1 minute"
        )
        XCTAssertEqual(
            LockedScreen.formatElapsed(now.addingTimeInterval(-300), relativeTo: now),
            "5 minutes"
        )
        XCTAssertEqual(
            LockedScreen.formatElapsed(now.addingTimeInterval(-3600), relativeTo: now),
            "1 hour"
        )
    }
}
