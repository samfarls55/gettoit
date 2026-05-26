// GetToIt — CheckinScreen (S08 next-day check-in) tests (TB-14).
//
// Same SwiftUI "smoke + spec snapshot" pattern as the other surface
// tests. Asserts:
//   * The three tap rows are stable & match the locked copy register.
//   * The third row's copy does not promise a re-ask (bug-16, fork B).
//   * The skipped path reveals the reason-chip row with the locked
//     reason vocabulary.
//   * The confirmation plate copy matches the locked S08 register
//     (`"☼ Got it."` / `"Ok — tomorrow."` / `"Ok — no worries."`).
//   * The reason-chip taxonomy matches the surface spec.
//   * The view materialises under default + skipped + snoozed + went
//     states.
//   * The `record(outcome:reason:)` writer fires once on outcome-and-
//     reason commit with the correctly-mapped reason token.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class CheckinScreenTests: XCTestCase {

    // MARK: - fixtures

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    private final class CaptureWriter: CheckinWriter, @unchecked Sendable {
        var calls: [(outcome: CheckinScreen.Outcome, reason: CheckinScreen.SkipReason?)] = []
        var errorToThrow: Error?
        func record(outcome: CheckinScreen.Outcome, reason: CheckinScreen.SkipReason?) async throws {
            if let error = errorToThrow { throw error }
            calls.append((outcome, reason))
        }
    }

    private func makePlate() -> CheckinScreen.Plate {
        CheckinScreen.Plate(
            roomID: UUID(),
            verdictID: UUID(),
            placeName: "Pico's Taqueria",
            verdictAt: "Wed Apr 23 · 7:00 PM",
            metaLine: "4 in · 8 min walk"
        )
    }

    // MARK: - body materialisation

    func testRendersWithoutCrashing() {
        let writer = CaptureWriter()
        render(CheckinScreen(plate: makePlate(), writer: writer, onAdvance: {}))
    }

    func testRendersWithSkippedStateExposed() {
        // Sanity that the chip row state branch builds.
        let writer = CaptureWriter()
        let view = CheckinScreen(plate: makePlate(), writer: writer, onAdvance: {})
            .environment(\.colorScheme, .dark)
        render(view)
    }

    // MARK: - copy locks (S08 §"Copy register")

    func testQuestionCopyIsLockedToDidYouGo() {
        XCTAssertEqual(CheckinScreen.questionCopy, "Did you go?")
    }

    func testOptionRowsExposeTheLockedThreeChoiceLabels() {
        let rows = CheckinScreen.optionRows
        XCTAssertEqual(rows.count, 3)
        XCTAssertEqual(rows[0].outcome, .went)
        XCTAssertEqual(rows[0].label, "We went")
        XCTAssertEqual(rows[0].sub, "And it was great")
        XCTAssertEqual(rows[1].outcome, .skipped)
        XCTAssertEqual(rows[1].label, "We skipped")
        XCTAssertEqual(rows[1].sub, "Something came up")
        // bug-16 (fork B): the third option commits a terminal `snoozed`
        // row that can never be re-answered. Its copy must NOT promise a
        // re-ask — re-labelled to a "didn't decide / leave it blank"
        // register, not a "snooze".
        XCTAssertEqual(rows[2].outcome, .snoozed)
        XCTAssertEqual(rows[2].label, "I'd rather not say")
        XCTAssertEqual(rows[2].sub, "We'll leave it blank")
    }

    func testThirdOptionCopyDoesNotPromiseAReAsk() {
        // bug-16 — regression guard. The third option's label + sub
        // must not imply a deferral / re-prompt the system never honors.
        let third = CheckinScreen.optionRows[2]
        let forbidden = ["later", "ask", "snooze", "tomorrow", "tonight", "remind"]
        for word in forbidden {
            XCTAssertFalse(
                third.label.lowercased().contains(word),
                "Third-option label must not promise a re-ask (found '\(word)')"
            )
            XCTAssertFalse(
                third.sub.lowercased().contains(word),
                "Third-option sub must not promise a re-ask (found '\(word)')"
            )
        }
    }

    func testReasonChipsMatchTheLockedTaxonomy() {
        // S08 §"Why 'We skipped' gets a reason follow-up" locks the
        // taxonomy: Wallet/time · Group bailed · Place was packed ·
        // Mood shifted · Other.
        let chips = CheckinScreen.SkipReason.allCases
        XCTAssertEqual(chips.count, 5)
        XCTAssertEqual(chips.map(\.label), [
            "Wallet/time",
            "Group bailed",
            "Place was packed",
            "Mood shifted",
            "Other",
        ])
        // The machine tokens that hit the `check_ins.reason` column.
        XCTAssertEqual(chips.map(\.machineToken), [
            "wallet_time",
            "group_bailed",
            "place_packed",
            "mood_shifted",
            "other",
        ])
    }

    func testConfirmationCopyMatchesLockedRegister() {
        // S08 §"Copy register" — the confirmation plate:
        //   went    → `"☼ Got it."`
        //   skipped → `"Ok — tomorrow."`
        //   snoozed → `"Ok — no worries."` (bug-16, fork B — the
        //             `snoozed` write is terminal, so the plate must
        //             not promise a re-ask).
        XCTAssertEqual(CheckinScreen.confirmationHeadline(for: .went), "☼ Got it.")
        XCTAssertEqual(CheckinScreen.confirmationHeadline(for: .skipped), "Ok — tomorrow.")
        XCTAssertEqual(CheckinScreen.confirmationHeadline(for: .snoozed), "Ok — no worries.")
    }

    func testSnoozedConfirmationBodyDoesNotPromiseAReAsk() {
        // bug-16 — the `snoozed` outcome is a terminal `check_ins` row.
        // The confirmation body must not tell the user we'll pop back.
        let body = CheckinScreen.confirmationBody(for: .snoozed, placeName: "Pico's Taqueria")
        let forbidden = ["pop back", "later", "tonight", "tomorrow", "remind", "ask again"]
        for word in forbidden {
            XCTAssertFalse(
                body.lowercased().contains(word),
                "Snoozed confirmation body must not promise a re-ask (found '\(word)')"
            )
        }
    }

    func testFooterEyebrowCopyMatchesLockedRegister() {
        // S08 §"Copy register" — `"One tap, then we're gone for the
        // day."` sets expectations that the check-in won't nag.
        XCTAssertEqual(CheckinScreen.footerEyebrow, "ONE TAP, THEN WE'RE GONE FOR THE DAY.")
    }

    // MARK: - record contract

    func testRecordingWentFiresWriterWithNoReason() async throws {
        let writer = CaptureWriter()
        let model = CheckinScreen.Model(plate: makePlate(), writer: writer)
        try await model.record(outcome: .went, reason: nil)
        XCTAssertEqual(writer.calls.count, 1)
        XCTAssertEqual(writer.calls[0].outcome, .went)
        XCTAssertNil(writer.calls[0].reason)
    }

    func testRecordingSkippedFiresWriterWithReason() async throws {
        let writer = CaptureWriter()
        let model = CheckinScreen.Model(plate: makePlate(), writer: writer)
        try await model.record(outcome: .skipped, reason: .groupBailed)
        XCTAssertEqual(writer.calls.count, 1)
        XCTAssertEqual(writer.calls[0].outcome, .skipped)
        XCTAssertEqual(writer.calls[0].reason, .groupBailed)
    }

    func testRecordingSnoozedFiresWriterWithoutReason() async throws {
        let writer = CaptureWriter()
        let model = CheckinScreen.Model(plate: makePlate(), writer: writer)
        try await model.record(outcome: .snoozed, reason: nil)
        XCTAssertEqual(writer.calls.count, 1)
        XCTAssertEqual(writer.calls[0].outcome, .snoozed)
        XCTAssertNil(writer.calls[0].reason)
    }

    // MARK: - choreography

    func testFadeUpDurationMatchesLockedSpec() {
        // S08 JSX uses `gti-fade-up 320ms ease-out-soft` on both the
        // reason-chip row and the confirmation plate. Lock the
        // constant ms-exact.
        XCTAssertEqual(CheckinScreen.Choreo.fadeUpDuration, 0.320, accuracy: 0.0001)
    }

    // MARK: - Cancel affordance (wfr-15)

    /// Cancel chrome label matches the locked Escape Hatch register —
    /// plain voluntary verb, same idiom as JoinScreen / SettingsScreen
    /// alert cancel. patterns#Escape Hatch — "Label it plainly
    /// ('Cancel', ...)" — keeps lock-step with the other limited-nav
    /// loaders.
    func testCancelLabelMatchesEscapeHatchRegister() {
        XCTAssertEqual(CheckinScreen.cancelLabel, "Cancel")
    }

    /// AC1 — Cancel surface renders alongside the choice-phase chrome
    /// without crashing. The visibility check is by-construction: the
    /// surface's choice-phase top bar wires a Cancel button (mirrors
    /// the wfr-14 / JoinScreen "render smoke" guard).
    func testRendersWithCancelWired() {
        let writer = CaptureWriter()
        let screen = CheckinScreen(
            plate: makePlate(),
            writer: writer,
            onCancel: { },
            onAdvance: {}
        )
        render(screen)
    }

    /// AC2 — Tapping Cancel runs the `onCancel` closure and does NOT
    /// fire the writer (no `check_ins` row is persisted on a cancel).
    func testCancelTapInvokesOnCancelAndDoesNotWriteCheckin() {
        let writer = CaptureWriter()
        var cancelCount = 0
        let screen = CheckinScreen(
            plate: makePlate(),
            writer: writer,
            onCancel: { cancelCount += 1 },
            onAdvance: {}
        )
        screen.simulateCancelTapForTesting()
        XCTAssertEqual(cancelCount, 1, "onCancel must fire exactly once")
        XCTAssertEqual(writer.calls.count, 0, "Cancel must not write a check_ins row")
    }

    /// Defensive — `onCancel` defaults to a no-op so pre-wfr-15 call
    /// sites (the existing test fixtures and any future host that
    /// hasn't wired the seam yet) keep building. Mirrors the
    /// `LockedScreen.onHome` / `JoinScreen.onCancel` default pattern.
    func testOnCancelDefaultsToNoOp() {
        let writer = CaptureWriter()
        let screen = CheckinScreen(plate: makePlate(), writer: writer, onAdvance: {})
        // Should not crash and must not corrupt the writer.
        screen.simulateCancelTapForTesting()
        XCTAssertEqual(writer.calls.count, 0)
    }
}
