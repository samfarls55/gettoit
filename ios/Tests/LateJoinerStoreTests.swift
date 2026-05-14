// GetToIt — LateJoinerStore unit tests (TB-11).
//
// Deterministic tests against the pure response-parsing surface of
// `LateJoinerStore`. The integration test
// (`LateJoinerIntegrationTests`) covers the live PostgREST RPC. These
// tests lock the routing decision tree:
//
//   * `status="joined"`         → `.joinedToOpenRoom(role:)`
//   * `status="already_member"` → `.alreadyMember(role:)`
//   * `status="read_only"`      → `.readOnly(roomStatus:, timerMinutes:, radiusMeters:)`
//   * `error="room_not_found"`  → throws `.roomNotFound`
//   * `error="unauthenticated"` → throws `.unauthenticated`
//
// The Route enum is what the iOS RootView reads to decide which
// surface to push. The mapping is the load-bearing contract.

import XCTest
@testable import GetToIt

@MainActor
final class LateJoinerStoreTests: XCTestCase {

    // MARK: - response parsing

    func testRouteFromJoinedResponseSurfacesParticipantRole() throws {
        let json = #"{"status":"joined","role":"participant"}"#
        let route = try LateJoinerStore.parseRoute(jsonString: json)
        XCTAssertEqual(route, .joinedToOpenRoom(role: "participant"))
    }

    func testRouteFromAlreadyMemberResponsePreservesRole() throws {
        let owner    = try LateJoinerStore.parseRoute(jsonString: #"{"status":"already_member","role":"owner"}"#)
        let invitee  = try LateJoinerStore.parseRoute(jsonString: #"{"status":"already_member","role":"participant"}"#)
        XCTAssertEqual(owner,   .alreadyMember(role: "owner"))
        XCTAssertEqual(invitee, .alreadyMember(role: "participant"))
    }

    func testRouteFromReadOnlyResponseCarriesPriorRoomDefaults() throws {
        // verdict_ready / locked / expired all read as read-only.
        for roomStatus in ["verdict_ready", "locked", "expired"] {
            let json = #"""
            {
                "status": "read_only",
                "room_status": "\#(roomStatus)",
                "timer_minutes": 15,
                "radius_meters": 5000
            }
            """#
            let route = try LateJoinerStore.parseRoute(jsonString: json)
            XCTAssertEqual(
                route,
                .readOnly(roomStatus: roomStatus, timerMinutes: 15, radiusMeters: 5000)
            )
        }
    }

    func testRoomNotFoundErrorThrows() {
        let json = #"{"error":"room_not_found"}"#
        XCTAssertThrowsError(try LateJoinerStore.parseRoute(jsonString: json)) { error in
            XCTAssertEqual(error as? LateJoinerStore.RouteError, .roomNotFound)
        }
    }

    func testUnauthenticatedErrorThrows() {
        let json = #"{"error":"unauthenticated"}"#
        XCTAssertThrowsError(try LateJoinerStore.parseRoute(jsonString: json)) { error in
            XCTAssertEqual(error as? LateJoinerStore.RouteError, .unauthenticated)
        }
    }

    func testUnknownErrorIsSurfacedVerbatim() {
        let json = #"{"error":"weird_db_thing"}"#
        XCTAssertThrowsError(try LateJoinerStore.parseRoute(jsonString: json)) { error in
            XCTAssertEqual(error as? LateJoinerStore.RouteError, .unknown("weird_db_thing"))
        }
    }

    // MARK: - read-only verdict payload parsing

    func testParseReadOnlyVerdictPayloadShapesIntoVerdictAndMode() throws {
        // Mirrors the `fetch_read_only_verdict` RPC return shape. The
        // assembled VerdictScreen.Verdict drops the late-joiner from
        // the receipts (RPC doesn't list them — they aren't in votes).
        let json = #"""
        {
            "verdict": {
                "id": "00000000-0000-0000-0000-000000000001",
                "method": "eba",
                "rule_text": "Budget cap cut Ren Soba. Pico's had the lowest regret-of-omission.",
                "computed_at": "2026-05-14T17:42:13Z",
                "option": {
                    "id": "00000000-0000-0000-0000-0000000000aa",
                    "payload": {
                        "name": "Pico's Taqueria",
                        "price_tier": 2,
                        "walk_minutes_estimate": 8,
                        "categories": ["Mexican"]
                    }
                }
            },
            "cuts": [
                {
                    "option_id": "00000000-0000-0000-0000-0000000000bb",
                    "option_name": "Ren Soba",
                    "cut_reason": "budget",
                    "cut_text": "over budget cap"
                }
            ],
            "receipts": [
                {
                    "user_id": "00000000-0000-0000-0000-00000000aaaa",
                    "q1_vetoes": ["shellfish"],
                    "q2_budget": 2,
                    "q3_walk_minutes": 15,
                    "q4_vibe": 2,
                    "q5_regret": {}
                },
                {
                    "user_id": "00000000-0000-0000-0000-00000000bbbb",
                    "q1_vetoes": [],
                    "q2_budget": 4,
                    "q3_walk_minutes": 30,
                    "q4_vibe": 3,
                    "q5_regret": {}
                }
            ],
            "member_count": 4,
            "room": {
                "timer_minutes": 10,
                "radius_meters": 3219,
                "status": "locked"
            }
        }
        """#

        let payload = try LateJoinerStore.parseReadOnlyPayload(jsonString: json)

        XCTAssertEqual(payload.verdict.placeName, "Pico's Taqueria",
            "winning option name lands as the hero placeName")
        XCTAssertEqual(payload.verdict.ruleText,
                       "Budget cap cut Ren Soba. Pico's had the lowest regret-of-omission.")
        XCTAssertEqual(payload.verdict.cuts.count, 1)
        XCTAssertEqual(payload.verdict.cuts.first?.name, "Ren Soba")
        XCTAssertEqual(payload.verdict.cuts.first?.reason, "over budget cap")
        XCTAssertEqual(payload.verdict.receipts.count, 2,
            "receipts shape one row per vote — late-joiner NOT in the list (they didn't vote)")
        XCTAssertEqual(payload.mode, .readOnly,
            "the read-only payload is always rendered in `.readOnly` mode")
        XCTAssertEqual(payload.timerMinutes, 10)
        XCTAssertEqual(payload.radiusMeters, 3219)
    }

    func testReadOnlyPayloadHandlesNoSurvivorVerdict() throws {
        // A no-survivor verdict has `option == null` and an empty
        // cuts list. The late-joiner read-only render still works —
        // the engine's rule_text carries the aggregate explanation.
        let json = #"""
        {
            "verdict": {
                "id": "00000000-0000-0000-0000-000000000002",
                "method": "no_survivor",
                "rule_text": "Vegan options left no candidates within walking distance tonight.",
                "computed_at": "2026-05-14T17:42:13Z",
                "option": null
            },
            "cuts": [],
            "receipts": [],
            "member_count": 4,
            "room": {
                "timer_minutes": 10,
                "radius_meters": 3219,
                "status": "expired"
            }
        }
        """#
        let payload = try LateJoinerStore.parseReadOnlyPayload(jsonString: json)
        XCTAssertEqual(payload.verdict.placeName, "No spot fits",
            "no-survivor late-joiner still reads the locked NO SPOT / FITS hero")
        XCTAssertEqual(payload.mode, .readOnly,
            "TB-11 surfaces read-only even on a no_survivor terminal — the late-joiner can't widen radius")
        XCTAssertEqual(payload.verdict.receipts.count, 0)
        XCTAssertEqual(payload.verdict.cuts.count, 0)
    }

    func testReadOnlyPayloadVerdictNotFoundSurfacesAsThrow() {
        let json = #"{"error":"no_verdict"}"#
        XCTAssertThrowsError(try LateJoinerStore.parseReadOnlyPayload(jsonString: json)) { error in
            XCTAssertEqual(error as? LateJoinerStore.RouteError, .noVerdict)
        }
    }

    // MARK: - radius conversion

    func testRadiusMetersToMilesRoundTripsFor3219() {
        // The `RoomStore.defaultRadiusMeters` constant is 3219 — that's
        // ~2.0 mi. The re-invite CTA prefilled value must be 2.0 mi so
        // S01's slider lands on its canonical default.
        let miles = LateJoinerStore.radiusMilesForMeters(3219)
        XCTAssertEqual(miles, 2.0, accuracy: 0.05)
    }

    func testRadiusMetersToMilesClampsToS01Range() {
        // S01 slider range is `0.5 mi .. 5.0 mi`. A late-joiner from a
        // widened no-survivor room could carry, say, 9.5 mi. The
        // pre-fill must clamp to the legal S01 range.
        let clampedHigh = LateJoinerStore.radiusMilesForMeters(15289)  // ~9.5 mi
        let clampedLow  = LateJoinerStore.radiusMilesForMeters(500)    // ~0.3 mi
        XCTAssertEqual(clampedHigh, 5.0, accuracy: 0.05)
        XCTAssertEqual(clampedLow, 0.5, accuracy: 0.05)
    }

    // MARK: - timer clamp

    func testTimerMinutesClampedToLegalChipSet() {
        // S01 chip set is `{5, 10, 15, 30}`. The migration's CHECK
        // constraint enforces it server-side, but if a room with a
        // legacy value somehow surfaces (or a future column relax)
        // the chip pre-fill must collapse to the nearest legal value.
        XCTAssertEqual(LateJoinerStore.timerMinutesClampedToS01(5),  5)
        XCTAssertEqual(LateJoinerStore.timerMinutesClampedToS01(10), 10)
        XCTAssertEqual(LateJoinerStore.timerMinutesClampedToS01(15), 15)
        XCTAssertEqual(LateJoinerStore.timerMinutesClampedToS01(30), 30)
        // Out-of-set values collapse to nearest legal — defensive.
        XCTAssertEqual(LateJoinerStore.timerMinutesClampedToS01(7),  5,
            "7 minutes is closer to 5 than to 10")
        XCTAssertEqual(LateJoinerStore.timerMinutesClampedToS01(20), 15,
            "20 minutes is closer to 15 than to 30")
        XCTAssertEqual(LateJoinerStore.timerMinutesClampedToS01(60), 30,
            "60 minutes clamps to the max legal value")
        XCTAssertEqual(LateJoinerStore.timerMinutesClampedToS01(1),  5,
            "1 minute clamps to the min legal value")
    }
}
