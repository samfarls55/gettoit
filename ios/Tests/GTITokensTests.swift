// GetToIt — GTITokens smoke tests.
//
// Walking-skeleton coverage: the generated `GTITokens.swift` compiles
// and exposes the surface gradients, motion timings, and vibe labels
// the rest of the app will lean on. Catches regressions in the
// generator's emit format without needing a Supabase round-trip.

import XCTest
import SwiftUI
@testable import GetToIt

final class GTITokensTests: XCTestCase {

    func testAllSurfaceGradientsHaveFourStops() {
        for surface in GTIGradient.Surface.allCases {
            XCTAssertEqual(GTIGradient.colorStops(surface).count, 4,
                           "expected 4 color stops for surface \(surface.rawValue)")
        }
        XCTAssertEqual(GTIGradient.stopPositions.count, 4)
    }

    func testVibeLabelsMatchLockedVocabulary() {
        // Quiz redesign: the Q4 energy vocabulary is
        // Quiet -> Chill -> Social -> Lively -> Rowdy (one axis:
        // energy / loudness). See 50_product/0.1.0-quiz-amendments §2.
        XCTAssertEqual(GTIVibeLabels.all, ["QUIET", "CHILL", "SOCIAL", "LIVELY", "ROWDY"])
    }

    func testMotionDurationsInSeconds() {
        // tokens.json carries durations in ms; the generator divides by 1000.
        XCTAssertEqual(GTIMotion.Duration.gradTween, 1.100, accuracy: 0.001)
        XCTAssertEqual(GTIMotion.Duration.shutter, 0.700, accuracy: 0.001)
    }
}
