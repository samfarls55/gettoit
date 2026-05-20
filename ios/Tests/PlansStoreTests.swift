// GetToIt — PlansStore unit tests (tb-WF-1).
//
// Pure unit tests against the value types and JSON-shape helpers
// `PlansStore` exposes. The live PostgREST round-trip is covered
// by a separate integration test once we wire the worktree to
// actual Supabase secrets — the secrets are not propagated to
// the AFK worktrees, so for the AFK run we lean on TDD-grade
// unit coverage of:
//
//   * `Plan` Codable round-trip (snake_case ↔ camelCase wire shape).
//   * The `LifecycleState` enum is exhaustive for the three values
//     the migration's CHECK constraint admits.
//   * The `CreateInsert` payload is the minimum row shape — never
//     writes `status` / `id` (server defaults / pk).
//   * `PlanUpdate` honours partial updates (an unset field is
//     omitted, not encoded as `null` which would overwrite).
//   * The `LifecycleState` raw values match the SQL CHECK exactly
//     (`pending`, `decided-active`, `decided-expired`).
//
// The integration tests live next to RoomStoreIntegrationTests
// and gate on `SUPABASE_PROJECT_URL` — that pattern is what the
// `ios` CI lane runs and the secrets stay out of AFK worktrees.

import XCTest
@testable import GetToIt

@MainActor
final class PlansStoreTests: XCTestCase {

    // MARK: - LifecycleState enum

    func testLifecycleStateRawValuesMatchTheSQLCheckConstraint() {
        // The migration's check clause is:
        //   status in ('pending', 'decided-active', 'decided-expired')
        // The enum is what the iOS client writes; a drift between
        // the two would surface as a write rejected by Postgres.
        XCTAssertEqual(PlansStore.LifecycleState.pending.rawValue, "pending")
        XCTAssertEqual(PlansStore.LifecycleState.decidedActive.rawValue, "decided-active")
        XCTAssertEqual(PlansStore.LifecycleState.decidedExpired.rawValue, "decided-expired")
    }

    func testLifecycleStateDecodesAllThreeWireValues() throws {
        // Every value the server may write must round-trip via the
        // Decodable path. A new server-side value would surface here
        // as a thrown decode error, prompting the migration adder
        // to update the enum.
        for raw in ["pending", "decided-active", "decided-expired"] {
            let json = #""\#(raw)""#.data(using: .utf8)!
            let state = try JSONDecoder().decode(PlansStore.LifecycleState.self, from: json)
            XCTAssertEqual(state.rawValue, raw)
        }
    }

    func testLifecycleStateRejectsAnUnknownWireValue() {
        // A response that carries an unknown status (a v2+ value we
        // haven't shipped yet) must surface as a decode error, not
        // silently coerce to `.pending`.
        let json = #""archived""#.data(using: .utf8)!
        XCTAssertThrowsError(
            try JSONDecoder().decode(PlansStore.LifecycleState.self, from: json)
        )
    }

    // MARK: - Plan struct round-trip

    func testPlanDecodesACanonicalServerResponse() throws {
        // A row as PostgREST would return it. Snake-case columns,
        // jsonb `location` and `session_params` payloads, status
        // raw value, default distance.
        let json = """
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "creator_id": "22222222-2222-2222-2222-222222222222",
            "name": "Friday dinner",
            "category": "food",
            "scope": "group",
            "location": {
                "name": "Greenpoint",
                "lat": 40.7,
                "lng": -73.95,
                "source": "manual",
                "timeZoneIdentifier": "America/New_York"
            },
            "session_params": {
                "meal_time": "dinner",
                "group_context": "group",
                "service_shape": "dine_in_indoor",
                "transport_mode": "walk"
            },
            "distance_meters": 1609,
            "status": "pending",
            "reroll_window_closes_at": null,
            "created_at": "2026-05-19T12:00:00Z",
            "updated_at": "2026-05-19T12:00:00Z"
        }
        """.data(using: .utf8)!

        let plan = try JSONDecoder().decode(PlansStore.Plan.self, from: json)
        XCTAssertEqual(plan.id, UUID(uuidString: "11111111-1111-1111-1111-111111111111"))
        XCTAssertEqual(plan.creatorID, UUID(uuidString: "22222222-2222-2222-2222-222222222222"))
        XCTAssertEqual(plan.name, "Friday dinner")
        XCTAssertEqual(plan.category, "food")
        XCTAssertEqual(plan.scope, .group)
        XCTAssertEqual(plan.distanceMeters, 1609)
        XCTAssertEqual(plan.status, .pending)
        XCTAssertNil(plan.rerollWindowClosesAt,
                     "reroll_window_closes_at is null while pending")
        XCTAssertEqual(plan.location?.name, "Greenpoint")
        // XCTAssertEqual's accuracy overload is non-optional; unwrap
        // explicitly so the type matches.
        XCTAssertEqual(plan.location?.lat ?? .nan, 40.7, accuracy: 0.0001)
        XCTAssertNotNil(plan.sessionParameters,
                        "session_params should decode into a SessionParameters value")
    }

    func testPlanDecodesADecidedActiveRowWithRerollWindow() throws {
        // Post-verdict shape: status is `decided-active` and the
        // reroll window is stamped. The iOS list surface reads both
        // to render the reroll-window countdown.
        let json = """
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "creator_id": "22222222-2222-2222-2222-222222222222",
            "name": "Friday dinner",
            "category": "food",
            "scope": "duo",
            "location": null,
            "session_params": {},
            "distance_meters": 1609,
            "status": "decided-active",
            "reroll_window_closes_at": "2026-05-21T23:59:59Z",
            "created_at": "2026-05-19T12:00:00Z",
            "updated_at": "2026-05-19T13:00:00Z"
        }
        """.data(using: .utf8)!

        let plan = try JSONDecoder().decode(PlansStore.Plan.self, from: json)
        XCTAssertEqual(plan.status, .decidedActive)
        XCTAssertEqual(plan.scope, .duo)
        XCTAssertNotNil(plan.rerollWindowClosesAt,
                        "reroll_window_closes_at must decode into a non-nil String once stamped")
        XCTAssertNil(plan.location,
                     "a Plan with NULL location must surface a nil location, not a default")
    }

    // MARK: - Scope enum

    func testScopeRawValuesMatchSQLCheck() {
        // CHECK: scope in ('solo', 'duo', 'group')
        XCTAssertEqual(PlansStore.Scope.solo.rawValue, "solo")
        XCTAssertEqual(PlansStore.Scope.duo.rawValue, "duo")
        XCTAssertEqual(PlansStore.Scope.group.rawValue, "group")
    }

    // MARK: - CreateInsert payload

    func testCreateInsertOmitsServerOwnedFields() throws {
        // The insert payload must NOT carry `id`, `status`,
        // `reroll_window_closes_at`, `created_at`, or `updated_at`
        // — the column defaults / triggers own those.
        let insert = PlansStore.CreateInsert(
            creatorID: UUID(uuidString: "22222222-2222-2222-2222-222222222222")!,
            name: "Friday dinner",
            scope: .group,
            location: PlansStore.Location(
                name: "Greenpoint",
                lat: 40.7,
                lng: -73.95,
                source: "manual",
                timeZoneIdentifier: "America/New_York"
            ),
            sessionParameters: SessionParameters.default,
            distanceMeters: 1609
        )

        let encoder = JSONEncoder()
        let data = try encoder.encode(insert)
        let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertNotNil(dict)

        XCTAssertNotNil(dict?["creator_id"], "creator_id is required by the schema")
        XCTAssertNotNil(dict?["name"])
        XCTAssertNotNil(dict?["scope"])
        XCTAssertNotNil(dict?["session_params"])
        XCTAssertEqual(dict?["distance_meters"] as? Int, 1609)
        XCTAssertNotNil(dict?["location"], "location is a single jsonb object")

        XCTAssertNil(dict?["id"],
                     "id must be server-allocated (gen_random_uuid())")
        XCTAssertNil(dict?["status"],
                     "status must default to 'pending' via the column default")
        XCTAssertNil(dict?["reroll_window_closes_at"],
                     "reroll_window_closes_at is set by set_plan_decided_active, not the client")
        XCTAssertNil(dict?["created_at"])
        XCTAssertNil(dict?["updated_at"])
    }

    func testCreateInsertOmitsNilLocation() throws {
        // A Plan can be drafted without a location yet (the Setup CTA
        // requires it pre-fire, but the column is nullable). When the
        // caller passes `nil`, the encoder must drop the key — not
        // emit `"location": null`. That difference matters because
        // an explicit null wipes a previously-set value on UPSERT
        // semantics; an omitted key falls through to the column
        // default (NULL on insert).
        let insert = PlansStore.CreateInsert(
            creatorID: UUID(uuidString: "22222222-2222-2222-2222-222222222222")!,
            name: "Draft",
            scope: .solo,
            location: nil,
            sessionParameters: SessionParameters.default,
            distanceMeters: 1609
        )

        let data = try JSONEncoder().encode(insert)
        let raw = String(data: data, encoding: .utf8) ?? ""
        XCTAssertFalse(
            raw.contains("\"location\""),
            "location key must be OMITTED when nil, not encoded as null"
        )
    }

    // MARK: - PlanUpdate (partial update)

    func testPlanUpdateOmitsUnsetFields() throws {
        // The update payload is a partial — only the fields the
        // caller supplies must land in the JSON. An unset field is
        // skipped entirely so the corresponding column stays at
        // its current value.
        let update = PlansStore.PlanUpdate(name: "Renamed")
        let data = try JSONEncoder().encode(update)
        let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertEqual(dict?.count, 1, "only the supplied field should encode")
        XCTAssertEqual(dict?["name"] as? String, "Renamed")
    }

    func testPlanUpdateCarriesAllFields() throws {
        let update = PlansStore.PlanUpdate(
            name: "Renamed",
            scope: .duo,
            location: PlansStore.Location(
                name: "BK",
                lat: 40.7,
                lng: -73.95,
                source: "gps",
                timeZoneIdentifier: "America/New_York"
            ),
            sessionParameters: SessionParameters(
                mealTime: .lunch,
                groupContext: .duo,
                serviceShape: .takeoutPickup,
                transportMode: .walk
            ),
            distanceMeters: 805
        )
        let data = try JSONEncoder().encode(update)
        let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        XCTAssertEqual(dict?["name"] as? String, "Renamed")
        XCTAssertEqual(dict?["scope"] as? String, "duo")
        XCTAssertEqual(dict?["distance_meters"] as? Int, 805)
        XCTAssertNotNil(dict?["location"])
        XCTAssertNotNil(dict?["session_params"])
    }

    // MARK: - name validation (client side, mirrors SQL CHECK)

    func testNameValidationMatchesSQLCheck() {
        // name CHECK is char_length(name) between 1 and 40. The
        // store exposes a pure validator so the Setup CTA can
        // disable the submit button without a round trip.
        XCTAssertTrue(PlansStore.isValidName("a"))
        XCTAssertTrue(PlansStore.isValidName(String(repeating: "x", count: 40)))
        XCTAssertFalse(PlansStore.isValidName(""), "empty must be rejected (1-char minimum)")
        XCTAssertFalse(
            PlansStore.isValidName(String(repeating: "x", count: 41)),
            "41-char must be rejected (40-char cap)"
        )
    }
}
