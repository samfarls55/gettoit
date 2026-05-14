// GetToIt — VerdictScreen `solo` mode tests (TB-13).
//
// Same SwiftUI "smoke + spec snapshot" pattern as
// `VerdictScreenSnapshotTests` and `VerdictScreenNoSurvivorTests` —
// materialise the view through a UIHostingController to verify it lays
// out without crashing, then assert against `ModeSnapshot` flags that
// lock the spec's visible / suppressed elements.
//
// The TB-13 contract on S05 `solo`:
//   * Eyebrow `"Tonight, the verdict is"` (same definite article as
//     `default` — the singular voice still produced a verdict).
//   * Hero + meta + time badge + rule chip + `"I'm in"` CTA + reroll
//     tertiary all PRESENT.
//   * Voice-receipt row SUPPRESSED — one voice doesn't need to be
//     receipted back to itself.
//   * Time badge audience reads `"You"` (not `"All N of you"`).
//   * Save-group affordance REPLACED with the C-22 save-taste-profile
//     chip (TB-12, copy `"Save this taste profile"`). The chip
//     surfaces under the primary CTA for anonymous users.
//   * Cuts drawer remains available (informational).
//   * Solo-path detection: `SoloPath.shouldSkipWaiting(memberCount:invitedShared:)`
//     skips S04 when memberCount == 1 AND invitedShared == false.
//
// See `design-system/surfaces/05-verdict.md` §"solo".

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class VerdictScreenSoloTests: XCTestCase {

    @discardableResult
    private func render<V: View>(_ view: V) -> UIView {
        let host = UIHostingController(rootView: view)
        host.view.bounds = CGRect(x: 0, y: 0, width: 390, height: 844)
        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        return host.view
    }

    // MARK: - solo-path detection (pure)

    func testSoloPathSkipsWaitingForLoneMemberWhoDidNotShare() {
        // The canonical solo path — one member, no invite shared. The
        // post-Q5 router skips S04 and jumps directly to verdict
        // computation + S05 in solo mode.
        XCTAssertTrue(
            SoloPath.shouldSkipWaiting(memberCount: 1, invitedShared: false),
            "lone member who did not share an invite → solo path"
        )
    }

    func testSoloPathDoesNotSkipWhenInviteWasShared() {
        // Even with one member currently in the room, if the initiator
        // dropped the share sheet (`invitedShared = true`), they
        // intended a group session — S04 Waiting must surface so
        // invitees have a chance to land.
        XCTAssertFalse(
            SoloPath.shouldSkipWaiting(memberCount: 1, invitedShared: true),
            "shared an invite → group flow, S04 Waiting surfaces"
        )
    }

    func testSoloPathDoesNotSkipWhenOtherMembersExist() {
        // Two or more members in the room → always group flow, even if
        // the share sheet wasn't opened from this device (e.g. the
        // invite arrived via a different channel).
        XCTAssertFalse(
            SoloPath.shouldSkipWaiting(memberCount: 2, invitedShared: false),
            "second member present → group flow"
        )
        XCTAssertFalse(
            SoloPath.shouldSkipWaiting(memberCount: 4, invitedShared: false),
            "full-quorum room → group flow"
        )
        XCTAssertFalse(
            SoloPath.shouldSkipWaiting(memberCount: 2, invitedShared: true),
            "shared + multi-member → group flow"
        )
    }

    // MARK: - body materialisation

    func testSoloModeRendersWithoutCrashing() {
        let verdict = VerdictScreen.Verdict.soloFixture()
        render(VerdictScreen(verdict: verdict, mode: .solo))
    }

    func testSoloModeRendersWithCommittedState() {
        let verdict = VerdictScreen.Verdict.soloFixture()
        render(VerdictScreen(verdict: verdict, mode: .solo, ratifiedCount: 1, ratifiedTotal: 1))
    }

    // MARK: - mode-flag contract

    func testSoloModeKeepsTimeBadgeAndCutsButSuppressesReceipts() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.soloFixture(),
            mode: .solo
        ).modeSnapshot

        XCTAssertTrue(snap.showTimeBadge,
            "solo keeps the time badge — there's still a when/where")
        XCTAssertFalse(snap.showReceipts,
            "solo suppresses the voice-receipt row — one voice doesn't need to be receipted to itself")
        XCTAssertTrue(snap.showCutsDrawer,
            "solo keeps the cuts drawer — informational; same affordance as default")
    }

    func testSoloEyebrowMatchesDefault() {
        // Same definite-article eyebrow as default — the singular voice
        // still produced a verdict.
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.soloFixture(),
            mode: .solo
        ).modeSnapshot
        XCTAssertEqual(snap.eyebrowCopy, "Tonight, the verdict is",
            "solo eyebrow is the same definite article as default")
    }

    func testSoloPrimaryCtaIsImInBeforeCommit() {
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.soloFixture(),
            mode: .solo
        ).modeSnapshot
        XCTAssertEqual(snap.primaryCtaLabel, "I'm in",
            "solo primary CTA reads 'I'm in' — same voluntary register as default")
        XCTAssertEqual(snap.secondaryLabel, "Start over",
            "solo secondary remains 'Start over' (tertiary register)")
    }

    func testSoloSurfacesSaveTasteProfileAffordance() {
        // The save-group affordance is REPLACED with the save-taste-
        // profile chip (C-22, TB-12). The modeSnapshot exposes the
        // affordance flag for the snapshot suite — drives the render
        // gate without coupling the test to chip-internal state.
        let snap = VerdictScreen(
            verdict: VerdictScreen.Verdict.soloFixture(),
            mode: .solo
        ).modeSnapshot
        XCTAssertTrue(snap.showSaveTasteProfileChip,
            "solo replaces the group-save affordance with the save-taste-profile chip")
    }

    func testNonSoloModesDoNotSurfaceTheSaveTasteProfileChip() {
        // Default, cuts, committed, no-survivor, read-only — none
        // surface the C-22 chip on S05 (it lives on S04 for those flows
        // per TB-12).
        for mode: VerdictScreen.Mode in [.default, .cuts, .committed, .noSurvivor, .readOnly] {
            let verdict: VerdictScreen.Verdict =
                (mode == .noSurvivor) ? .noSurvivorFixture() : .fixture()
            let snap = VerdictScreen(verdict: verdict, mode: mode).modeSnapshot
            XCTAssertFalse(snap.showSaveTasteProfileChip,
                "mode \(mode) must not surface the solo save-taste-profile chip")
        }
    }

    // MARK: - committed-flavor copy (no N-of-M denominator on solo)

    func testSoloCommittedPillHasNoNofMSuffix() {
        // The group `default` committed pill reads `"You're in · 3 of 4"`.
        // On solo there's no quorum to count to — the label collapses to
        // just `"You're in"`.
        let label = VerdictScreen.committedCtaLabel(count: 1, total: 1)
        XCTAssertFalse(label.contains(" of "),
            "solo committed label drops the N-of-M denominator (total == count == 1 → just 'You're in'): \(label)")
    }

    // MARK: - fixture contract

    func testSoloFixtureHasNoReceipts() {
        // The solo fixture must surface zero receipts — the engine
        // produces a receipts array on a solo run too (one entry), but
        // the surface contract is the row is suppressed, so the fixture
        // for the snapshot test ships an empty list.
        let fixture = VerdictScreen.Verdict.soloFixture()
        XCTAssertTrue(fixture.receipts.isEmpty,
            "solo fixture has no receipts — the row is suppressed on the surface")
    }

    func testSoloFixtureRuleTextHasNoCountFraming() {
        // The rule_text generator never references vote counts — but
        // the fixture is hand-rolled, so guard against marketing-pass
        // drift that might sneak `"3 of 4 wanted X"` into the copy.
        let fixture = VerdictScreen.Verdict.soloFixture()
        XCTAssertFalse(fixture.ruleText.contains(" of "),
            "solo fixture rule_text must not reference N-of-M counts: \(fixture.ruleText)")
        XCTAssertFalse(fixture.ruleText.contains("wanted"),
            "solo fixture rule_text must not reference voice counts (`wanted`): \(fixture.ruleText)")
    }

    func testSoloFixtureTimeBadgeAudienceIsYou() {
        let fixture = VerdictScreen.Verdict.soloFixture()
        XCTAssertEqual(fixture.timeBadge.audience, "You",
            "solo time badge reads 'You' (singular) — communal frame doesn't apply")
    }
}
