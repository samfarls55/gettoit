// GetToIt — LocationPermissionScreen snapshot-style smoke tests (wfr-08).
//
// Same shape as `RerollScreenSnapshotTests` and other snapshot suites
// in this codebase: pixel snapshots aren't on the dependency graph;
// we verify the SwiftUI body materialises and that the spec-locked
// primary/secondary CTA treatment feeds through unchanged.
//
// The wfr-08 acceptance bar is that the two CTAs ("Share my location"
// vs "Pick a place manually") render with visibly distinct visual
// hierarchy — primary is a filled white pill, secondary is an eyebrow-
// token text link. Treatment is exposed as static spec data so a silent
// regression to "both render in the same pill style" trips the
// assertion here.

import XCTest
import SwiftUI
@testable import GetToIt

@MainActor
final class LocationPermissionScreenSnapshotTests: XCTestCase {

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
        render(
            LocationPermissionScreen(
                onShareLocation: {},
                onManualEntry: {}
            )
        )
    }

    // MARK: - copy locks (per 00b-location-permission.md)

    func testPrimaryCtaCopyMatchesSpec() {
        // Spec lock: voluntary verb ("Share"), not "Allow" / "Enable".
        XCTAssertEqual(LocationPermissionScreen.primaryCtaLabel, "SHARE MY LOCATION")
    }

    func testSecondaryCtaCopyMatchesSpec() {
        // Spec lock: second-person, signals user is in control of how
        // they tell us where they are.
        XCTAssertEqual(LocationPermissionScreen.secondaryCtaLabel, "PICK A PLACE MANUALLY")
    }

    func testEyebrowCopyMatchesSpec() {
        XCTAssertEqual(LocationPermissionScreen.eyebrowLabel, "BEFORE WE START")
    }

    // MARK: - wfr-08 acceptance — primary/secondary CTA distinction

    func testPrimaryCtaUsesFilledPillTreatment() {
        // wfr-08: primary CTA must be the filled white PillCTA per
        // 00b-location-permission.md "Visual" table row "Primary CTA".
        let treatment = LocationPermissionScreen.primaryCtaTreatment
        XCTAssertEqual(treatment.style, LocationPermissionScreen.CtaStyle.filledPill)
        XCTAssertEqual(treatment.fill, LocationPermissionScreen.CtaFill.paper)
        XCTAssertEqual(treatment.foreground, LocationPermissionScreen.CtaForeground.ink)
    }

    func testSecondaryCtaUsesEyebrowTextLinkTreatment() {
        // wfr-08: secondary CTA must be an eyebrow-token text link per
        // 00b-location-permission.md "Visual" table row "Secondary".
        let treatment = LocationPermissionScreen.secondaryCtaTreatment
        XCTAssertEqual(treatment.style, LocationPermissionScreen.CtaStyle.textLink)
        XCTAssertEqual(treatment.fill, LocationPermissionScreen.CtaFill.none)
        XCTAssertEqual(treatment.foreground, LocationPermissionScreen.CtaForeground.textOnGradientTertiary)
    }

    func testPrimaryAndSecondaryCtasUseDistinctTreatments() {
        // The whole point of wfr-08: a workflow-review finding flagged
        // that the two CTAs rendered with equal visual weight. This
        // assertion is the regression guard — if both ever resolve to
        // the same style enum, the screen has lost its hierarchy.
        let primary = LocationPermissionScreen.primaryCtaTreatment
        let secondary = LocationPermissionScreen.secondaryCtaTreatment
        XCTAssertNotEqual(primary.style, secondary.style)
        XCTAssertNotEqual(primary.fill, secondary.fill)
        XCTAssertNotEqual(primary.foreground, secondary.foreground)
    }
}
