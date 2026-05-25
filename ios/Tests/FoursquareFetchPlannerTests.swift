// GetToIt — FoursquareFetchPlanner pure unit tests (TB-07 quiz redesign).
//
// The planner (PRD module D) is pure: it takes a member's Q1 cuisines +
// Q2 spend cap, the shared SessionParameters, plus the session geo /
// radius, and emits N+1 `PlacesProxyRequest` specs — one
// category-tagged call per craved cuisine (N = 1…3) plus one mandatory
// general call. No I/O. These tests assert call count, the per-cuisine
// cuisine tag, the mandatory general call, and that the hard filters
// (geo, meal-time, radius, price) are applied — and that cuisine /
// reputation never strict-filter (the general call must carry no
// cuisine tag so it supplies non-craved breadth).
//
// Filter-surface source: research-01
// (gti-vault/60_engineering/research/foursquare-filter-surface-2026-05).

import XCTest
import CoreLocation
@testable import GetToIt

final class FoursquareFetchPlannerTests: XCTestCase {

    // A fixed instant so the meal-time → open_at derivation is
    // deterministic: 2026-05-05 16:53:20 UTC, a Tuesday.
    private let fixedNow = Date(timeIntervalSince1970: 1_778_000_000)

    private let coordinate = CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194)

    // MARK: - call count (N+1)

    func testThreeCuisinesProduceFourCallSpecs() {
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [QuizCuisine.mexican, QuizCuisine.italian, QuizCuisine.thai],
            budgetTier: 3,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        // N=3 cuisines → 3 category-tagged calls + 1 general = 4.
        XCTAssertEqual(specs.count, 4)
    }

    func testOneCuisineProducesTwoCallSpecs() {
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [QuizCuisine.japanese],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        // N=1 → 1 category-tagged + 1 general = 2.
        XCTAssertEqual(specs.count, 2)
    }

    func testNoCuisinesStillProducesOneGeneralCall() {
        // "No preference" on Q1 → zero craved cuisines. The mandatory
        // general call still fires so the fetch is never zero calls
        // (the explicit bug-03 no-call guard at the planner level).
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [],
            budgetTier: 1,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        XCTAssertEqual(specs.count, 1)
        XCTAssertNil(specs[0].filters?.cuisine,
                     "the lone spec must be the general call — no cuisine tag")
    }

    // MARK: - per-cuisine category tag

    func testEachCravedCuisineGetsItsOwnTaggedCall() {
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [QuizCuisine.mexican, QuizCuisine.indian],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        let cuisineTags = specs.compactMap { $0.filters?.cuisine }.sorted()
        XCTAssertEqual(cuisineTags, [QuizCuisine.indian, QuizCuisine.mexican])
    }

    func testExactlyOneGeneralCallCarriesNoCuisineTag() {
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [QuizCuisine.mexican, QuizCuisine.italian],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        let generalCalls = specs.filter { $0.filters?.cuisine == nil }
        XCTAssertEqual(generalCalls.count, 1,
                       "exactly one mandatory general call, carrying no cuisine tag")
    }

    // MARK: - cuisine cap (research-01: N is 1…3)

    func testMoreThanThreeCuisinesAreCappedAtThree() {
        // Q1 caps selection at 3, but the planner defends the bound too.
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [
                QuizCuisine.mexican, QuizCuisine.italian,
                QuizCuisine.thai, QuizCuisine.chinese,
            ],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        // 3 cuisine calls (capped) + 1 general = 4.
        XCTAssertEqual(specs.count, 4)
        XCTAssertEqual(specs.filter { $0.filters?.cuisine != nil }.count, 3)
    }

    func testDuplicateCuisinesAreDeduped() {
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [QuizCuisine.thai, QuizCuisine.thai],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        // 1 unique cuisine + 1 general = 2.
        XCTAssertEqual(specs.count, 2)
    }

    // MARK: - hard filters applied to every spec

    func testGeoAndRadiusAreAppliedToEverySpec() {
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [QuizCuisine.mexican, QuizCuisine.italian],
            budgetTier: 2,
            parameters: .default,
            coordinate: CLLocationCoordinate2D(latitude: 12.34, longitude: 56.78),
            radiusMeters: 3217,
            now: fixedNow
        )
        XCTAssertEqual(specs.count, 3)
        for spec in specs {
            XCTAssertEqual(spec.lat, 12.34, accuracy: 1e-9)
            XCTAssertEqual(spec.lng, 56.78, accuracy: 1e-9)
            XCTAssertEqual(spec.radiusMeters, 3217, accuracy: 1e-9)
        }
    }

    func testPriceCapIsAppliedToEverySpec() {
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [QuizCuisine.mexican],
            budgetTier: 3,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        for spec in specs {
            XCTAssertEqual(spec.filters?.priceTier, 3,
                           "Q2 spend cap is a hard filter — applied to the general call and every cuisine call")
        }
    }

    func testMealTimeIsAppliedAsOpenAtOnEverySpec() {
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [QuizCuisine.mexican],
            budgetTier: 2,
            parameters: .default,   // .default meal time is .dinner
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        // Every spec carries open_at as a Foursquare `[1-7]THHMM` token
        // — weekday 1-7, then a 24h HHMM wall-clock time. Foursquare
        // 400s on any other shape (it expects `[1-7]T[00-24][00-59]`);
        // sending an ISO-8601 instant or a unix epoch is exactly the
        // bug this regression guard locks out.
        let tokenPattern = try! NSRegularExpression(
            pattern: "^[1-7]T(2[0-4]|[01][0-9])[0-5][0-9]$"
        )
        for spec in specs {
            let token = spec.filters?.openAt ?? ""
            let range = NSRange(token.startIndex..., in: token)
            XCTAssertNotNil(
                tokenPattern.firstMatch(in: token, range: range),
                "open_at must be a Foursquare [1-7]THHMM token, got: \(token)"
            )
        }
    }

    func testOpenAtTokenUsesTheProvidedAreaTimeZone() {
        // fixedNow is 2026-05-05 16:53 UTC — a Tuesday. In New York
        // (UTC-4) it is still Tuesday 12:53; in Tokyo (UTC+9) it has
        // already rolled to Wednesday 01:53. open_at is venue-local, so
        // the planner must compute the weekday in the SEARCH AREA's
        // timezone — the token's day digit differs accordingly.
        let newYork = FoursquareFetchPlanner.plan(
            cuisines: [], budgetTier: 2, parameters: .default,
            coordinate: coordinate, radiusMeters: 2400, now: fixedNow,
            timeZone: TimeZone(identifier: "America/New_York")!
        )
        let tokyo = FoursquareFetchPlanner.plan(
            cuisines: [], budgetTier: 2, parameters: .default,
            coordinate: coordinate, radiusMeters: 2400, now: fixedNow,
            timeZone: TimeZone(identifier: "Asia/Tokyo")!
        )
        // `.default` meal time is dinner → representative hour 19:00.
        // Foursquare weekday (1=Mon … 7=Sun): Tuesday = 2, Wednesday = 3.
        XCTAssertEqual(newYork[0].filters?.openAt, "2T1900")
        XCTAssertEqual(tokyo[0].filters?.openAt, "3T1900")
    }

    func testMealTimeOpenAtTracksTheSelectedMeal() {
        // Breakfast and dinner must resolve to different open_at hours.
        let breakfast = FoursquareFetchPlanner.plan(
            cuisines: [],
            budgetTier: 2,
            parameters: SessionParameters(
                mealTime: .breakfast, groupContext: .group,
                serviceShape: .dineInIndoor, transportMode: .walk
            ),
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        let dinner = FoursquareFetchPlanner.plan(
            cuisines: [],
            budgetTier: 2,
            parameters: SessionParameters(
                mealTime: .dinner, groupContext: .group,
                serviceShape: .dineInIndoor, transportMode: .walk
            ),
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        XCTAssertNotEqual(breakfast[0].filters?.openAt, dinner[0].filters?.openAt,
                          "different meal times must resolve to different open_at tokens")
    }

    // MARK: - cuisine / reputation never strict-filter (research-01 §3)

    func testCuisineTagIsAdvisoryOnlyAndNeverEntersTheDietaryHardFilter() {
        // research-01 §3.2: cuisine must NOT strict-filter the fetch.
        // The planner carries the craved cuisine as the advisory
        // `cuisine` tag, never folded into `dietary` (which IS a hard
        // category filter). If it leaked into `dietary` the pool would
        // collapse and the Q5 factorial would lose its variety.
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [QuizCuisine.mexican, QuizCuisine.thai],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        for spec in specs {
            let dietary = spec.filters?.dietary ?? []
            XCTAssertFalse(dietary.contains(QuizCuisine.mexican))
            XCTAssertFalse(dietary.contains(QuizCuisine.thai))
        }
    }

    func testGeneralCallSuppliesNonCravedBreadthWithNoCuisineTag() {
        // research-01: the general call is what keeps non-craved
        // cuisines (and reputation variety) in the pool.
        let specs = FoursquareFetchPlanner.plan(
            cuisines: [QuizCuisine.mexican, QuizCuisine.italian, QuizCuisine.thai],
            budgetTier: 2,
            parameters: .default,
            coordinate: coordinate,
            radiusMeters: 2400,
            now: fixedNow
        )
        guard let general = specs.first(where: { $0.filters?.cuisine == nil }) else {
            return XCTFail("expected one general call")
        }
        XCTAssertNil(general.filters?.cuisine)
        // The general call still carries the hard filters.
        XCTAssertEqual(general.filters?.priceTier, 2)
        XCTAssertNotNil(general.filters?.openAt)
    }
}
