// GetToIt — SessionParameters pure-logic tests (TB-05 v1.1).
//
// Covers the *parameters* bucket of the v1.1 three-bucket input model
// (PRD module K). These tests need neither SwiftUI nor Supabase — they
// pin the wire shape of `rooms.session_params` and the joiner-side
// hydration contract:
//
//   * Parameter CAPTURE — the initiator's S01b selections encode into
//     the stable snake_case jsonb shape the `rooms` column stores.
//   * Joiner HYDRATION — that same jsonb decodes back to the exact
//     parameters the initiator set, so a joiner never re-prompts.
//   * Tolerant decode — a column written by a newer client (an
//     option this build does not know) still hydrates a usable
//     session instead of throwing mid-quiz.
//
// Live-Supabase round-trip coverage (the column actually persists and
// reads back across two users) lives in `RoomStoreIntegrationTests`.

import XCTest
@testable import GetToIt

final class SessionParametersTests: XCTestCase {

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    // MARK: - capture: encode

    /// The four parameters encode to the canonical snake_case keys the
    /// `rooms.session_params` jsonb column stores. If a key name drifts
    /// the joiner hydration silently breaks, so the shape is pinned.
    func testEncodesToCanonicalSnakeCaseShape() throws {
        let params = SessionParameters(
            mealTime: .lunch,
            groupContext: .duo,
            serviceShape: .takeoutPickup,
            transportMode: .drive
        )
        let data = try encoder.encode(params)
        let object = try XCTUnwrap(
            JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        XCTAssertEqual(object["meal_time"] as? String, "lunch")
        XCTAssertEqual(object["group_context"] as? String, "duo")
        XCTAssertEqual(object["service_shape"] as? String, "takeout_pickup")
        XCTAssertEqual(object["transport_mode"] as? String, "drive")
        XCTAssertEqual(object.count, 4, "no stray keys on the wire payload")
    }

    // MARK: - joiner hydration: round-trip

    /// Every combination the S01b surface can produce must survive an
    /// encode → decode round-trip unchanged. This IS the joiner
    /// hydration contract: the initiator captures, the column stores,
    /// the joiner reads back the exact same parameters.
    func testRoundTripsEveryParameterCombination() throws {
        for meal in SessionParameters.MealTime.allCases {
            for group in SessionParameters.GroupContext.allCases {
                for shape in SessionParameters.ServiceShape.allCases {
                    for transport in SessionParameters.TransportMode.allCases {
                        let original = SessionParameters(
                            mealTime: meal,
                            groupContext: group,
                            serviceShape: shape,
                            transportMode: transport
                        )
                        let data = try encoder.encode(original)
                        let hydrated = try decoder.decode(SessionParameters.self, from: data)
                        XCTAssertEqual(hydrated, original,
                            "joiner must hydrate the exact parameters the initiator set")
                    }
                }
            }
        }
    }

    /// A joiner decoding the canonical jsonb gets the initiator's
    /// selections back field-for-field.
    func testJoinerHydratesInitiatorSelectionsFromStoredJSON() throws {
        let stored = """
        {
          "meal_time": "late_night",
          "group_context": "solo",
          "service_shape": "dine_in_outdoor",
          "transport_mode": "walk"
        }
        """.data(using: .utf8)!
        let hydrated = try decoder.decode(SessionParameters.self, from: stored)
        XCTAssertEqual(hydrated.mealTime, .lateNight)
        XCTAssertEqual(hydrated.groupContext, .solo)
        XCTAssertEqual(hydrated.serviceShape, .dineInOutdoor)
        XCTAssertEqual(hydrated.transportMode, .walk)
    }

    // MARK: - tolerant decode

    /// A column written by a newer client carries an option this build
    /// does not know. The joiner must still land in a usable session:
    /// the unknown field falls back to its default, the known fields
    /// hydrate normally.
    func testUnknownEnumValueFallsBackToDefaultRatherThanThrowing() throws {
        let stored = """
        {
          "meal_time": "brunch",
          "group_context": "duo",
          "service_shape": "dine_in_indoor",
          "transport_mode": "teleport"
        }
        """.data(using: .utf8)!
        let hydrated = try decoder.decode(SessionParameters.self, from: stored)
        // Unknown values → that field's default.
        XCTAssertEqual(hydrated.mealTime, SessionParameters.default.mealTime)
        XCTAssertEqual(hydrated.transportMode, SessionParameters.default.transportMode)
        // Known values still hydrate.
        XCTAssertEqual(hydrated.groupContext, .duo)
        XCTAssertEqual(hydrated.serviceShape, .dineInIndoor)
    }

    /// A missing field hydrates to its default — a partially-written
    /// column never strands the joiner.
    func testMissingFieldHydratesToDefault() throws {
        let stored = """
        { "meal_time": "breakfast" }
        """.data(using: .utf8)!
        let hydrated = try decoder.decode(SessionParameters.self, from: stored)
        XCTAssertEqual(hydrated.mealTime, .breakfast)
        XCTAssertEqual(hydrated.groupContext, SessionParameters.default.groupContext)
        XCTAssertEqual(hydrated.serviceShape, SessionParameters.default.serviceShape)
        XCTAssertEqual(hydrated.transportMode, SessionParameters.default.transportMode)
    }

    // MARK: - zero-tap defaults

    /// The S01b surface opens on these values so a skim-and-tap
    /// initiator still ships a valid session.
    func testDefaultIsAValidDinnerGroupSession() {
        let d = SessionParameters.default
        XCTAssertEqual(d.mealTime, .dinner)
        XCTAssertEqual(d.groupContext, .group)
        XCTAssertEqual(d.serviceShape, .dineInIndoor)
        XCTAssertEqual(d.transportMode, .walk)
    }

    // MARK: - transport mode → radius default

    /// The transport mode supplies the default S01 radius. Walking
    /// pins the canonical 2.0 mi; driving widens to 5.0 mi. Both stay
    /// inside the S01 slider's legal `0.5…5.0 mi` range.
    func testTransportModeSuppliesRadiusDefaultInsideSliderRange() {
        XCTAssertEqual(SessionParameters.TransportMode.walk.defaultRadiusMiles, 2.0, accuracy: 0.001)
        XCTAssertEqual(SessionParameters.TransportMode.drive.defaultRadiusMiles, 5.0, accuracy: 0.001)
        for mode in SessionParameters.TransportMode.allCases {
            XCTAssertGreaterThanOrEqual(mode.defaultRadiusMiles, InitiatorScreen.radiusMinMiles)
            XCTAssertLessThanOrEqual(mode.defaultRadiusMiles, InitiatorScreen.radiusMaxMiles)
        }
    }

    /// The walking default lines up with the canonical S01 radius
    /// default, so the zero-tap parameters → zero-tap radius story is
    /// consistent end to end.
    func testWalkRadiusDefaultMatchesCanonicalS01Default() {
        XCTAssertEqual(
            SessionParameters.TransportMode.walk.defaultRadiusMiles,
            InitiatorScreen.defaultRadiusMiles,
            accuracy: 0.001
        )
    }

    // MARK: - service shape grouping

    /// The S01b surface groups the four service shapes under a
    /// Dine-in / Takeout header pair; `isDineIn` is the partition.
    func testServiceShapeDineInPartition() {
        XCTAssertTrue(SessionParameters.ServiceShape.dineInIndoor.isDineIn)
        XCTAssertTrue(SessionParameters.ServiceShape.dineInOutdoor.isDineIn)
        XCTAssertFalse(SessionParameters.ServiceShape.takeoutPickup.isDineIn)
        XCTAssertFalse(SessionParameters.ServiceShape.takeoutDelivery.isDineIn)
    }
}
