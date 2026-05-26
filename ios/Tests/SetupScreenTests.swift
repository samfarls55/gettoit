// GetToIt — SetupScreen pure-logic tests (tb-WF-4).
//
// Coverage:
//   * Distance slider — non-uniform snap-list per workflow-overhaul Q8
//     (`design-system/surfaces/01-setup.md` § "Distance slider").
//   * Mode-conditional rendering count — solo path omits the `Who's
//     coming` chip row entirely (5 controls); group path renders all
//     6 with `Just me` removed from the chip options.
//   * Name validation — empty trims → CTAs disabled, non-empty → enabled.
//   * Primary CTA copy swaps on the group scope (solo → "Start the
//     quiz", duo/group → "Drop the invite link") — same JSX contract.
//   * Headline + secondary-CTA copy swap on `.create` vs `.edit` mode.
//   * Edit-mode entry path — a `solo` Plan re-opens in `.solo` mode;
//     `duo` / `group` re-open in `.group` mode (per Amendment 2026-05-20
//     in the issue body).
//
// Integration coverage for the Plan + Room mint is in
// `RoomStoreIntegrationTests` (room linking to plan via `plan_id`) and
// `PlansStoreTests` (already cover the insert payload shape).

import XCTest
@testable import GetToIt

@MainActor
final class SetupScreenTests: XCTestCase {

    // MARK: - distance slider — snap-list (workflow-overhaul Q8)

    /// The 17-stop schedule locked in `surfaces/01-setup.md` §"Distance
    /// slider". Mirrors the JSX `DISTANCE_STEPS` constant. Order
    /// matters — the slider snaps onChange to the nearest entry.
    func testDistanceStepsMatchTheLockedSchedule() {
        XCTAssertEqual(
            SetupScreen.distanceSteps,
            [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]
        )
    }

    /// Default lands on `1.0 mi` per the spec (tick anchor).
    func testDistanceDefaultIsOneMile() {
        XCTAssertEqual(SetupScreen.defaultDistanceMiles, 1.0, accuracy: 0.001)
        XCTAssertTrue(SetupScreen.distanceSteps.contains(SetupScreen.defaultDistanceMiles))
    }

    /// The native slider slides through the smallest step (0.25 mi); the
    /// `snap` helper maps any continuous value to the nearest entry
    /// in `distanceSteps`. End-positions clamp inside the schedule.
    func testSnapDistanceMaps_endpoints_andInterior() {
        XCTAssertEqual(SetupScreen.snapDistance(0.0), 0.25, accuracy: 0.001,
            "below-range value clamps to the smallest stop")
        XCTAssertEqual(SetupScreen.snapDistance(0.25), 0.25, accuracy: 0.001)
        XCTAssertEqual(SetupScreen.snapDistance(0.4), 0.5, accuracy: 0.001,
            "0.4 mi snaps to 0.5 (nearer than 0.25 by 0.05)")
        XCTAssertEqual(SetupScreen.snapDistance(1.0), 1.0, accuracy: 0.001)
        XCTAssertEqual(SetupScreen.snapDistance(1.2), 1.0, accuracy: 0.001,
            "1.2 snaps down to 1.0 (closer than 1.5)")
        XCTAssertEqual(SetupScreen.snapDistance(1.3), 1.5, accuracy: 0.001,
            "1.3 snaps up to 1.5")
        XCTAssertEqual(SetupScreen.snapDistance(5.5), 5.0, accuracy: 0.001,
            "5.5 snaps to 5.0 (tied with 6.0 — lower-index wins on tie)")
        XCTAssertEqual(SetupScreen.snapDistance(5.6), 6.0, accuracy: 0.001,
            "5.6 snaps to 6.0")
        XCTAssertEqual(SetupScreen.snapDistance(10.0), 10.0, accuracy: 0.001)
        XCTAssertEqual(SetupScreen.snapDistance(15.0), 10.0, accuracy: 0.001,
            "above-range value clamps to the top stop")
    }

    /// bug-30 — `snapDistance` originally force-unwrapped `distanceSteps.first!`
    /// / `distanceSteps.last!`. The fix replaces both with `??` fallbacks
    /// (`0` floor, `Self.maxDistanceMiles` ceiling) per CODING_STANDARDS.md
    /// rule OPT-001. Behavior is observably identical because
    /// `distanceSteps` is a static-let literal, but the three acceptance
    /// criteria from the bug-30 spec are pinned here so a future
    /// regression that breaks the clamp / passthrough contract fails
    /// loud — and so the snap helper is exercised at the exact endpoints
    /// the spec named.
    func testSnapDistance_bug30AcceptanceCriteria() {
        guard
            let first = SetupScreen.distanceSteps.first,
            let last = SetupScreen.distanceSteps.last
        else {
            return XCTFail("distanceSteps must be non-empty")
        }
        XCTAssertEqual(SetupScreen.snapDistance(-1), first, accuracy: 0.001,
            "negative input clamps to the first stop")
        XCTAssertEqual(SetupScreen.snapDistance(100), last, accuracy: 0.001,
            "far-above-range input clamps to the last stop")
        let interior = SetupScreen.distanceSteps[2]
        XCTAssertEqual(SetupScreen.snapDistance(interior), interior, accuracy: 0.001,
            "an exact stop passes through unchanged")
    }

    /// The mono-tag value label format. `String(format:)` mirrors the
    /// JSX `distance.toFixed(1)` so the slider label reads `"1.0 MI"`
    /// (never `"1 MI"` or `"1.00 MI"`).
    ///
    /// Note: `String(format: "%.1f", 0.25)` uses banker's rounding and
    /// resolves to `"0.2"` (round-half-to-even — 2 is even, so the tie
    /// breaks down). `toFixed(1)` in JS rounds 0.25 to `"0.3"` on most
    /// engines (V8 / SpiderMonkey) — but the small mismatch on the
    /// 0.25-stop is acceptable because the live slider label always
    /// hits the legal snap-list values (0.25 / 0.5 / 0.75 / ...).
    /// Users see `0.2 MI` on iOS at the 0.25-stop; the canonical
    /// integer-mile stops (1.0 / 2.0 / 5.0 / 10.0) are stable across
    /// both engines and that is what users actually move between.
    func testFormatDistanceLabel() {
        XCTAssertEqual(SetupScreen.formatDistanceLabel(0.5), "0.5 MI")
        XCTAssertEqual(SetupScreen.formatDistanceLabel(0.75), "0.8 MI")
        XCTAssertEqual(SetupScreen.formatDistanceLabel(1.0), "1.0 MI")
        XCTAssertEqual(SetupScreen.formatDistanceLabel(2.0), "2.0 MI")
        XCTAssertEqual(SetupScreen.formatDistanceLabel(5.0), "5.0 MI")
        XCTAssertEqual(SetupScreen.formatDistanceLabel(10.0), "10.0 MI")
    }

    /// `metersFromMiles` — uses the same canonical conversion as the
    /// existing radius column writer (1609.344). The Plan column is
    /// `distance_meters`, default 1609 (≈ 1.0 mi).
    func testMetersFromMilesMatchesPlanColumnDefault() {
        XCTAssertEqual(SetupScreen.metersFromMiles(1.0), 1609,
            "1.0 mi → 1609 m matches plans.distance_meters default")
        XCTAssertEqual(SetupScreen.metersFromMiles(0.25), 402)
        XCTAssertEqual(SetupScreen.metersFromMiles(10.0), 16093)
    }

    /// Tick anchor lives at 1.0 mi per the spec ("anchors the implicit
    /// walk/drive cognitive boundary").
    func testTickAnchorIsOneMile() {
        XCTAssertEqual(SetupScreen.tickAtMiles, 1.0, accuracy: 0.001)
        XCTAssertTrue(SetupScreen.distanceSteps.contains(SetupScreen.tickAtMiles))
    }

    // MARK: - mode-conditional rendering

    /// Per the Amendment 2026-05-20 in the issue body: solo path
    /// omits the `Who's coming` row → 5 controls; group path renders
    /// 6 with `Just me` removed.
    func testControlsRenderedSoloOmitsWhosComing() {
        XCTAssertEqual(SetupScreen.controlsRendered(for: .solo), 5,
            "solo path omits Who's coming → 5 controls")
        XCTAssertEqual(SetupScreen.controlsRendered(for: .group), 6,
            "group path renders all 6 controls")
    }

    /// `Who's coming` chip options on the group path drop `Just me`
    /// (the user already disambiguated upstream via the create-Plan
    /// affordance — disambig sheet lives in tb-WF-6).
    func testWhosComingOptionsGroupModeOmitsJustMe() {
        let solo = SetupScreen.whosComingOptions(for: .solo)
        XCTAssertTrue(solo.isEmpty, "solo path renders no Who's coming chips")

        let group = SetupScreen.whosComingOptions(for: .group)
        XCTAssertEqual(group, [.duo, .group],
            "group path keeps Two of us / A group, drops Just me")
    }

    // MARK: - name validation

    /// Both dock CTAs gate on `name.trim().length > 0` per
    /// `surfaces/01-setup.md` §Validation.
    func testNameValidation() {
        XCTAssertFalse(SetupScreen.isNameValid(""))
        XCTAssertFalse(SetupScreen.isNameValid("   "))
        XCTAssertFalse(SetupScreen.isNameValid("\n\t"))
        XCTAssertTrue(SetupScreen.isNameValid("a"))
        XCTAssertTrue(SetupScreen.isNameValid("Friday dinner"))
        // 40-char cap is enforced by `maxLength` on the TextField; the
        // pure validator just confirms non-empty. PlansStore.isValidName
        // owns the 1..40 contract via the SQL CHECK constraint.
    }

    // MARK: - primary CTA copy (group context swap)

    /// Primary CTA copy swaps on the live `groupContext` selection per
    /// the surface doc §Modes. Solo gets `Start the quiz`; the two
    /// group options get `Drop the invite link`.
    func testPrimaryCTACopyForGroupContext() {
        XCTAssertEqual(SetupScreen.primaryCTACopy(for: .solo), "Start the quiz")
        XCTAssertEqual(SetupScreen.primaryCTACopy(for: .duo), "Drop the invite link")
        XCTAssertEqual(SetupScreen.primaryCTACopy(for: .group), "Drop the invite link")
    }

    // MARK: - mode-driven headline + secondary copy

    func testHeadlineCopyForCreateAndEditModes() {
        XCTAssertEqual(SetupScreen.headlineCopy(for: .create), "Start a new plan")
        XCTAssertEqual(SetupScreen.headlineCopy(for: .edit),   "Edit your plan")
    }

    func testSecondaryCTACopyForCreateAndEditModes() {
        XCTAssertEqual(SetupScreen.secondaryCTACopy(for: .create), "SAVE FOR LATER")
        XCTAssertEqual(SetupScreen.secondaryCTACopy(for: .edit),   "SAVE CHANGES")
    }

    // MARK: - edit-mode entry path (Plan.scope → SetupScreen.mode)

    /// Amendment 2026-05-20: a `solo` Plan re-opens in Solo Setup;
    /// `duo` / `group` re-open in Group Setup.
    func testSetupModeForPlanScope() {
        XCTAssertEqual(SetupScreen.setupMode(for: .solo),  .solo)
        XCTAssertEqual(SetupScreen.setupMode(for: .duo),   .group)
        XCTAssertEqual(SetupScreen.setupMode(for: .group), .group)
    }

    // MARK: - PlansStore.Scope mapping for the chip selection

    /// On the group path, picking the `Two of us` chip writes
    /// `Plan.scope = .duo`; picking `A group` writes `.group`. The
    /// solo path never asks — the upstream disambig (tb-WF-6) wrote
    /// `.solo` and the chip row is hidden.
    func testPlanScopeFromChipSelection() {
        XCTAssertEqual(SetupScreen.planScope(from: .duo,   setupMode: .group), .duo)
        XCTAssertEqual(SetupScreen.planScope(from: .group, setupMode: .group), .group)
        // In solo mode the chip is unreachable; the Plan scope is locked
        // to `.solo` regardless of what's held in state.
        XCTAssertEqual(SetupScreen.planScope(from: .duo,   setupMode: .solo),  .solo)
        XCTAssertEqual(SetupScreen.planScope(from: .group, setupMode: .solo),  .solo)
    }

    // MARK: - back-cancel persistence policy (workflow-overhaul Q11)

    /// `create` mode + name non-empty → auto-save the Plan.
    /// `create` mode + empty name → discard, no Plan minted.
    /// `edit` mode → always auto-save (name is non-empty by definition).
    func testShouldAutoSaveOnBack() {
        XCTAssertTrue(SetupScreen.shouldAutoSaveOnBack(mode: .create, name: "Friday"))
        XCTAssertFalse(SetupScreen.shouldAutoSaveOnBack(mode: .create, name: ""))
        XCTAssertFalse(SetupScreen.shouldAutoSaveOnBack(mode: .create, name: "   "))
        XCTAssertTrue(SetupScreen.shouldAutoSaveOnBack(mode: .edit,   name: "Already named"))
    }

    // MARK: - distance default → Plan column default (1609 m)

    /// The Plan column's default is `distance_meters int default 1609`
    /// (≈ 1.0 mi). SetupScreen's `defaultDistanceMiles` × 1609.344
    /// rounds to that same value, so a Setup → Plan write that the
    /// user never adjusted ships exactly the column default.
    func testDefaultDistanceMatchesPlanColumnDefault() {
        XCTAssertEqual(SetupScreen.metersFromMiles(SetupScreen.defaultDistanceMiles), 1609,
            "defaultDistanceMiles → meters must match plans.distance_meters default of 1609")
    }

    // MARK: - disabled-state CTA affordance (wfr-09)

    /// wfr-09 — when the dock CTAs are disabled (name empty), opacity
    /// alone fails low-vision + colorblind users. Both CTAs swap their
    /// label to a non-opacity affordance — a "name your plan" prompt
    /// that names exactly what is missing. Acceptance criterion #1:
    /// "Disabled CTA carries a visible label change or icon."
    ///
    /// Voice register: warm-friend, second-person imperative — never
    /// `"Name required"` (form-field register).

    func testPrimaryCTADisabledCopyIsDistinctFromEveryEnabledState() {
        let disabled = SetupScreen.primaryCTADisabledCopy()
        XCTAssertFalse(disabled.isEmpty, "disabled label must not be empty")
        XCTAssertNotEqual(disabled, SetupScreen.primaryCTACopy(for: .solo))
        XCTAssertNotEqual(disabled, SetupScreen.primaryCTACopy(for: .duo))
        XCTAssertNotEqual(disabled, SetupScreen.primaryCTACopy(for: .group))
    }

    func testSecondaryCTADisabledCopyIsDistinctFromEveryEnabledState() {
        let disabled = SetupScreen.secondaryCTADisabledCopy()
        XCTAssertFalse(disabled.isEmpty, "disabled label must not be empty")
        XCTAssertNotEqual(disabled, SetupScreen.secondaryCTACopy(for: .create))
        XCTAssertNotEqual(disabled, SetupScreen.secondaryCTACopy(for: .edit))
    }

    /// Voice register check — the disabled copy must read as the
    /// warm-friend, second-person directive the design system codifies
    /// (per `surfaces/01-setup.md` §"Copy register" + `README.md`
    /// product invariant #1). The required substring is the load-bearing
    /// word: the user must "name" their plan. Forbidden form-field
    /// register: `required` / `field` / `error`.
    func testDisabledCopyUsesWarmFriendRegister() {
        let primary = SetupScreen.primaryCTADisabledCopy().lowercased()
        let secondary = SetupScreen.secondaryCTADisabledCopy().lowercased()
        for copy in [primary, secondary] {
            XCTAssertTrue(copy.contains("name"),
                "disabled copy must name what's missing — got \(copy)")
            XCTAssertFalse(copy.contains("required"),
                "disabled copy must not use form-field register — got \(copy)")
            XCTAssertFalse(copy.contains("error"),
                "disabled copy must not use form-field register — got \(copy)")
        }
    }

    /// The label-to-display picker — chooses between the enabled and
    /// disabled label by the same `nameValid` gate the `.disabled(...)`
    /// modifier reads. This is the single source of truth the view body
    /// reads when rendering the dock label.
    func testPrimaryLabelToDisplaySwapsOnNameValid() {
        XCTAssertEqual(
            SetupScreen.primaryLabelToDisplay(nameValid: false, groupContext: .group),
            SetupScreen.primaryCTADisabledCopy(),
            "disabled state shows the affordance label, not the enabled label"
        )
        XCTAssertEqual(
            SetupScreen.primaryLabelToDisplay(nameValid: true, groupContext: .group),
            SetupScreen.primaryCTACopy(for: .group)
        )
        XCTAssertEqual(
            SetupScreen.primaryLabelToDisplay(nameValid: true, groupContext: .solo),
            SetupScreen.primaryCTACopy(for: .solo)
        )
        XCTAssertEqual(
            SetupScreen.primaryLabelToDisplay(nameValid: true, groupContext: .duo),
            SetupScreen.primaryCTACopy(for: .duo)
        )
    }

    func testSecondaryLabelToDisplaySwapsOnNameValid() {
        XCTAssertEqual(
            SetupScreen.secondaryLabelToDisplay(nameValid: false, mode: .create),
            SetupScreen.secondaryCTADisabledCopy()
        )
        XCTAssertEqual(
            SetupScreen.secondaryLabelToDisplay(nameValid: false, mode: .edit),
            SetupScreen.secondaryCTADisabledCopy()
        )
        XCTAssertEqual(
            SetupScreen.secondaryLabelToDisplay(nameValid: true, mode: .create),
            SetupScreen.secondaryCTACopy(for: .create)
        )
        XCTAssertEqual(
            SetupScreen.secondaryLabelToDisplay(nameValid: true, mode: .edit),
            SetupScreen.secondaryCTACopy(for: .edit)
        )
    }

    // MARK: - input hints (wfr-24)

    /// wfr-24 — Input Hints pattern. Each of name / distance / location
    /// carries a visible hint adjacent to the control (per
    /// `patterns.md` §"Input Hints" — outside the field, smaller +
    /// lighter than the label, persists with and without focus).
    ///
    /// The hint copy is exposed as pure static helpers so the
    /// canonical strings can be pinned by unit tests and reused by the
    /// view body. Voice register matches the surface doc §"Copy register":
    /// warm-friend, second-person, casual — never form-field register
    /// ("required" / "error" / "field").

    /// Name hint names the 40-char cap so users feel the limit before
    /// they hit it. The surface doc originally framed the cap as
    /// "users feel the limit by hitting it" — wfr-24 (2026-05-26)
    /// overrides that line per the Input Hints foundation gate.
    func testNameHintCopy() {
        let hint = SetupScreen.nameHintCopy()
        XCTAssertFalse(hint.isEmpty, "name hint must not be empty")
        XCTAssertTrue(hint.contains("40"),
            "name hint must name the 40-char cap — got \(hint)")
    }

    /// Distance hint clarifies the unit (miles) for users who can't
    /// see the mono-tag value or who read past it. The mono-tag itself
    /// reads "1.0 MI"; the adjacent hint spells out the unit in plain
    /// language so the slider's purpose is unambiguous before the user
    /// drags it.
    func testDistanceHintCopy() {
        let hint = SetupScreen.distanceHintCopy()
        XCTAssertFalse(hint.isEmpty, "distance hint must not be empty")
        let lower = hint.lowercased()
        XCTAssertTrue(lower.contains("mile") || lower.contains("mi"),
            "distance hint must name the unit — got \(hint)")
    }

    /// Location hint marks the field optional and tells the user the
    /// app will prompt later — matches the workflow-overhaul Q10
    /// validation rule (Plan can ship with NULL location).
    func testWhereToHintCopy() {
        let hint = SetupScreen.whereToHintCopy()
        XCTAssertFalse(hint.isEmpty, "location hint must not be empty")
        let lower = hint.lowercased()
        XCTAssertTrue(lower.contains("optional"),
            "location hint must mark the field optional — got \(hint)")
    }

    /// Voice register check — all three hints must read in the
    /// warm-friend, casual register the surface codifies, never the
    /// form-field register the workflow-review explicitly rejects.
    func testHintCopyUsesWarmFriendRegister() {
        let hints = [
            SetupScreen.nameHintCopy(),
            SetupScreen.distanceHintCopy(),
            SetupScreen.whereToHintCopy(),
        ]
        for hint in hints {
            let lower = hint.lowercased()
            XCTAssertFalse(lower.contains("required"),
                "hint copy must not use form-field register — got \(hint)")
            XCTAssertFalse(lower.contains("error"),
                "hint copy must not use form-field register — got \(hint)")
            XCTAssertFalse(lower.contains(" field"),
                "hint copy must not use form-field register — got \(hint)")
        }
    }
}
