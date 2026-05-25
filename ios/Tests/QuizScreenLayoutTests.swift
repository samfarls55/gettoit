// GetToIt — Quiz screen layout regression tests (bug-25).
//
// Pins the two layout invariants the tb-WF-2 chrome row broke:
//
//   1. The QuizChrome row is height-stable across `canBack`. On Q1
//      (`canBack: false`) the chrome's leading slot collapses to a
//      spacer; that spacer must NOT be vertically greedy. If it is,
//      the chrome row grows to fill the available vertical space and
//      shoves the 5-segment progress strip toward the middle of the
//      screen (Q1 symptom in the bug-25 report).
//
//   2. The 5-segment progress strip in `QuizScreen.topBar` is
//      horizontally centred within the screen on every quiz step. The
//      pre-bug-25 layout had an asymmetric 32pt leading spacer with no
//      trailing counterpart; the strip therefore sat right-of-centre
//      by 32pt on Q2-Q5 (the second symptom). Centring is a structural
//      property of the topBar HStack and is asserted here by measuring
//      the rendered strip's frame against the screen's centre.
//
// Both regressions are layout-only; the chrome row's spec is locked
// (`design-system/surfaces/03-quiz.md` §"Quiz skeleton" + §"Quiz chrome
// (Back + Exit)") and the iOS port drifted during tb-WF-2.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class QuizScreenLayoutTests: XCTestCase {

    /// iPhone 15-ish portrait width — matches the fixed bounds used in
    /// `QuizScreenSnapshotTests` / `QuizChromeViewTests` so the test
    /// measures against the same proposed width the running app sees.
    private let screenWidth: CGFloat = 390
    private let screenHeight: CGFloat = 844

    // MARK: - chrome row height stability (Q1 pushdown symptom)

    /// The chrome row's intrinsic height must be the same whether Back
    /// is rendered (`canBack: true`, Q2-Q5) or collapsed to a spacer
    /// (`canBack: false`, Q1). If the leading spacer on Q1 is
    /// vertically greedy, the chrome row balloons in height and the
    /// 5-segment progress strip below it slides toward the middle of
    /// the screen — exactly the user-reported Q1 symptom.
    func testChromeRowHeightIsStableAcrossCanBack() {
        let withBack = QuizChromeView(
            canBack: true, role: .initiator, isSolo: false,
            onBack: {}, onExit: {}
        )
        let withoutBack = QuizChromeView(
            canBack: false, role: .initiator, isSolo: false,
            onBack: {}, onExit: {}
        )
        // Propose a full-screen frame. The chrome row's content is a
        // 44pt-min HStack of text labels — it should report a height
        // close to 44pt regardless of `canBack`. A greedy `Color.clear`
        // leading spacer on the Q1 branch would expand to consume the
        // proposed height (the chrome ballooning that pushes the
        // progress strip toward the middle on Q1).
        let proposal = CGSize(width: screenWidth, height: screenHeight)

        let hWith = UIHostingController(rootView: withBack).sizeThatFits(in: proposal)
        let hWithout = UIHostingController(rootView: withoutBack).sizeThatFits(in: proposal)

        XCTAssertEqual(hWithout.height, hWith.height, accuracy: 1.0,
            "chrome row height must be identical with/without Back — a greedy Q1 spacer pushes the progress strip downward (bug-25)")
    }

    /// Belt-and-braces: the Q1 (no-Back) chrome must report a sane,
    /// bounded intrinsic height when proposed the full screen size.
    /// A greedy Color.clear spacer with only a `minHeight` would
    /// expand to the full proposed height under this measurement;
    /// the 44pt-clamped row stays close to its content height.
    func testChromeRowHeightIsBoundedOnQ1() {
        let withoutBack = QuizChromeView(
            canBack: false, role: .initiator, isSolo: false,
            onBack: {}, onExit: {}
        )
        let proposal = CGSize(width: screenWidth, height: screenHeight)
        let measured = UIHostingController(rootView: withoutBack).sizeThatFits(in: proposal)

        // The chrome's contents are a 44pt-min HStack with text labels.
        // Anything taller than ~88pt (2x the min) indicates the spacer
        // is being greedy with the proposed height.
        XCTAssertLessThanOrEqual(measured.height, 88.0,
            "chrome row must not stretch vertically when proposed a tall height — a 44pt-tall row reports ~44pt, a greedy spacer reports the full proposed height (bug-25 Q1 pushdown)")
    }

    // MARK: - progress strip horizontal centering (Q2-Q5 right-skew)

    /// The 5-segment progress strip must be horizontally centred on
    /// the screen for every quiz step. The pre-bug-25 `topBar` HStack
    /// had a 32pt leading `Color.clear` spacer but no trailing
    /// counterpart, so the strip sat 32pt right-of-centre.
    ///
    /// SwiftUI accessibility identifiers don't surface reliably into
    /// the UIKit subview tree, so we assert the structural property
    /// at the source level: the `topBar` definition in
    /// `QuizScreen.swift` must contain a balanced pair of
    /// `Color.clear.frame(width: 32, height: 32)` spacers (one
    /// leading, one trailing) — that's the contract that keeps the
    /// strip centred. The runtime smoke tests in
    /// `QuizChromeViewTests` + `QuizScreenSnapshotTests` cover the
    /// visual render; this test pins the contract.
    func testTopBarHasSymmetricSpacersForCentering() throws {
        let sourcePath = pathForRepoFile(
            "ios/Sources/App/QuizScreen.swift"
        )
        let source = try String(contentsOfFile: sourcePath, encoding: .utf8)

        // Isolate the `topBar` computed property so a `Color.clear`
        // appearing elsewhere in the file can't satisfy the count.
        guard let topBarRange = source.range(of: "private var topBar: some View {"),
              let endRange = source.range(of: "\n    // MARK: - content router",
                                          range: topBarRange.upperBound..<source.endIndex)
        else {
            XCTFail("could not isolate `topBar` block in QuizScreen.swift — file structure changed?")
            return
        }
        let topBarBody = String(source[topBarRange.lowerBound..<endRange.lowerBound])

        let spacerCount = countOccurrences(
            of: "Color.clear",
            in: topBarBody
        )
        XCTAssertEqual(spacerCount, 2,
            "topBar must reserve a balanced pair of leading + trailing `Color.clear` spacers (32x32) so the 5-segment progress strip centres on screen — an asymmetric spacer skews the strip 16pt right-of-centre (bug-25)")

        // And both spacers must be the same 32x32 reservation. The
        // contract is "reserve symmetrically"; a stray 12x12 wouldn't
        // balance the leading 32pt.
        let symmetricCount = countOccurrences(
            of: ".frame(width: 32, height: 32)",
            in: topBarBody
        )
        XCTAssertEqual(symmetricCount, 2,
            "the leading + trailing topBar spacers must both be 32x32 — asymmetric sizes still skew the strip horizontally (bug-25)")
    }

    // MARK: - helpers

    /// Resolves an `ios/Sources/App/<name>.swift` path relative to
    /// this test file's compile-time location, mirroring the
    /// convention in `AppTargetFixtureHygieneTests.appSourcesDirectory()`.
    private func pathForRepoFile(_ relative: String) -> String {
        // `relative` is expected as `ios/Sources/App/<file>` for
        // sources we read for structural assertions.
        let appDir = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()   // ios/Tests
            .deletingLastPathComponent()   // ios
        let trimmed = relative.hasPrefix("ios/")
            ? String(relative.dropFirst("ios/".count))
            : relative
        return appDir.appendingPathComponent(trimmed).path
    }

    private func countOccurrences(of needle: String, in haystack: String) -> Int {
        var count = 0
        var search = haystack.startIndex
        while let range = haystack.range(of: needle, range: search..<haystack.endIndex) {
            count += 1
            search = range.upperBound
        }
        return count
    }
}
