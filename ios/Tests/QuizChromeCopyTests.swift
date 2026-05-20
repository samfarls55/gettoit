// GetToIt — Quiz chrome locked-copy tests (tb-WF-2).
//
// The confirmation copy on the Quiz chrome's Exit/Leave alert is
// LOCKED VERBATIM — `design-system/surfaces/03-quiz.md` §"Confirmation
// copy (verbatim — do not paraphrase)". The three variants are:
//   * Exit (initiator, multi-member room)
//   * Leave (joiner)
//   * Exit (solo session — only one member)
//
// This test fixes the three strings against the spec so a paraphrase
// or a typo fails fast in CI rather than slipping into the iOS build.
// The role-conditional Back affordance and the alert button labels
// (Confirm/Cancel) live in the same enum.

import XCTest
@testable import GetToIt

final class QuizChromeCopyTests: XCTestCase {

    // MARK: - role-conditional verb label

    func testInitiatorChromeUsesExitLabel() {
        let copy = QuizChromeCopy.resolve(role: .initiator, isSolo: false)
        XCTAssertEqual(copy.verb, "Exit",
            "expected the initiator's top-trailing label to read Exit per surfaces/03-quiz.md §'Role-conditional labels'")
    }

    func testJoinerChromeUsesLeaveLabel() {
        let copy = QuizChromeCopy.resolve(role: .joiner, isSolo: false)
        XCTAssertEqual(copy.verb, "Leave",
            "expected the joiner's top-trailing label to read Leave per surfaces/03-quiz.md §'Role-conditional labels'")
    }

    func testSoloChromeUsesExitLabel() {
        // Solo is initiator-only (a joiner cannot be in a solo room).
        let copy = QuizChromeCopy.resolve(role: .initiator, isSolo: true)
        XCTAssertEqual(copy.verb, "Exit")
    }

    // MARK: - confirmation copy — initiator (multi-member)

    func testInitiatorConfirmationCopyMatchesSpec() {
        let copy = QuizChromeCopy.resolve(role: .initiator, isSolo: false)
        XCTAssertEqual(copy.alertTitle, "Exit this plan?")
        XCTAssertEqual(copy.alertBody,
            "Your answers will be discarded. Others can still finish without you.")
        XCTAssertEqual(copy.confirmLabel, "Exit")
        XCTAssertEqual(copy.cancelLabel, "Keep going")
    }

    // MARK: - confirmation copy — joiner

    func testJoinerConfirmationCopyMatchesSpec() {
        let copy = QuizChromeCopy.resolve(role: .joiner, isSolo: false)
        XCTAssertEqual(copy.alertTitle, "Leave this plan?")
        XCTAssertEqual(copy.alertBody,
            "Your answers will be discarded. The host and others can still finish.")
        XCTAssertEqual(copy.confirmLabel, "Leave")
        XCTAssertEqual(copy.cancelLabel, "Keep going")
    }

    // MARK: - confirmation copy — solo

    func testSoloConfirmationCopyMatchesSpec() {
        let copy = QuizChromeCopy.resolve(role: .initiator, isSolo: true)
        XCTAssertEqual(copy.alertTitle, "Exit this plan?")
        XCTAssertEqual(copy.alertBody,
            "Your answers will be discarded. Your plan will stay saved so you can start over.")
        XCTAssertEqual(copy.confirmLabel, "Exit")
        XCTAssertEqual(copy.cancelLabel, "Keep going")
    }

    // MARK: - cancel label is constant across every variant

    func testCancelLabelIsSpecLocked() {
        for role in [QuizChromeRole.initiator, .joiner] {
            for solo in [false, true] {
                let copy = QuizChromeCopy.resolve(role: role, isSolo: solo)
                XCTAssertEqual(copy.cancelLabel, "Keep going",
                    "expected the cancel button to always read 'Keep going' (role=\(role), solo=\(solo))")
            }
        }
    }
}
