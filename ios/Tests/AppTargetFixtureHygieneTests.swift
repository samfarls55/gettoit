// GetToIt — AppTargetFixtureHygieneTests (bug-11 quiz redesign).
//
// Guards the bug-11 acceptance criterion: no fictitious venue names
// remain compiled into the shipped `GetToIt` app target. The verdict /
// check-in / locked snapshot-test fixture factories used to live inside
// `Sources/App/`, so their hardcoded sample place names (`Pico's
// Taqueria`, `Ren Soba`, `Café Lou`, `Halal Cart`) were dead strings in
// the production binary. bug-11 relocated those factories into the test
// target (`ScreenFixtures.swift`).
//
// This test scans the app-target Swift sources directly and fails if any
// forbidden fictitious-venue string reappears — a regression guard so a
// future change cannot quietly reintroduce a sample venue name into the
// shipped binary.
//
// Note: `"No spot fits"` is intentionally NOT forbidden. It is a genuine
// no-survivor UI string the live `VerdictStore` / `LateJoinerStore`
// write, not fictitious venue content (see bug-11 "Out of scope").

import XCTest

final class AppTargetFixtureHygieneTests: XCTestCase {

    /// Fictitious sample venue names that must never appear in the
    /// shipped app target. These are snapshot-test fixture data only.
    private static let forbiddenVenueStrings = [
        "Pico's Taqueria",
        "Pico's",
        "Ren Soba",
        "Café Lou",
        "Halal Cart",
    ]

    /// Resolves the `ios/Sources/App` directory relative to this test
    /// file's on-disk location (`ios/Tests/AppTargetFixtureHygieneTests.swift`).
    private func appSourcesDirectory() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()   // ios/Tests
            .deletingLastPathComponent()   // ios
            .appendingPathComponent("Sources")
            .appendingPathComponent("App")
    }

    func testAppTargetCarriesNoFictitiousVenueStrings() throws {
        let appDir = appSourcesDirectory()
        let fm = FileManager.default

        var isDir: ObjCBool = false
        XCTAssertTrue(
            fm.fileExists(atPath: appDir.path, isDirectory: &isDir) && isDir.boolValue,
            "Expected app sources directory at \(appDir.path)"
        )

        let enumerator = fm.enumerator(
            at: appDir,
            includingPropertiesForKeys: nil
        )
        var swiftFileCount = 0
        var offenders: [String] = []

        while let url = enumerator?.nextObject() as? URL {
            guard url.pathExtension == "swift" else { continue }
            swiftFileCount += 1
            let contents = try String(contentsOf: url, encoding: .utf8)
            for needle in Self.forbiddenVenueStrings where contents.contains(needle) {
                offenders.append("\(url.lastPathComponent): \"\(needle)\"")
            }
        }

        XCTAssertGreaterThan(
            swiftFileCount, 0,
            "Sanity check: expected to scan at least one app-target Swift file"
        )
        XCTAssertTrue(
            offenders.isEmpty,
            "Fictitious venue strings found in the shipped app target — relocate them to the test target:\n"
                + offenders.joined(separator: "\n")
        )
    }
}
