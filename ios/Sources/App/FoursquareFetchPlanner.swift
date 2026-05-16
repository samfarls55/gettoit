// GetToIt — FoursquareFetchPlanner (TB-07 v1.1, PRD module D).
//
// Pure planning, no I/O. Given one member's Q1 cuisines + Q2 spend cap,
// the shared SessionParameters, and the session geo / radius, the
// planner emits the N+1 `PlacesProxyRequest` specs the fetch executor
// (module F — `FoursquareFetchExecutor`) runs in parallel:
//
//   * N category-tagged calls — one per craved cuisine (N = 0…3). The
//     cuisine is carried on `PlacesFilters.cuisine` as an advisory tag,
//     NOT a strict filter (research-01 §3.2 — cuisine must never
//     strict-filter, or the Q5 factorial loses its pool variety).
//   * 1 mandatory general call — no cuisine tag. Supplies the
//     non-craved breadth the factorial needs. Always present, even
//     when the member answered "No preference" on Q1 (N = 0). This is
//     the planner-level guard against bug-03's zero-call failure mode.
//
// Hard filters applied to EVERY spec (research-01 §2 — the five strict
// fetch-time filters):
//   * geo      — `lat` / `lng`, the `ll` anchor.
//   * radius   — `radiusMeters`, the transport-radius circle.
//   * price    — Q2 spend cap → `PlacesFilters.priceTier` → `max_price`.
//   * open_at  — the session meal-time instant → `PlacesFilters.openAt`.
//
// Cuisine and reputation are deliberately NOT strict filters here —
// see research-01 §3.1 / §3.2. The planner never folds the craved
// cuisine into `dietary` (which IS a hard category filter); it stays
// on the advisory `cuisine` tag.

import Foundation
import CoreLocation

public enum FoursquareFetchPlanner {

    /// The planner's hard cap on craved-cuisine calls. Q1's surface
    /// already caps selection at 3 (`QuizCoordinator.cuisineCap`); the
    /// planner re-asserts the bound so a malformed input set can never
    /// fan out into an unbounded number of parallel calls.
    public static let maxCuisineCalls = 3

    /// Plan the N+1 call specs for one member's per-member fetch.
    ///
    /// - Parameters:
    ///   - cuisines: the member's Q1 craved cuisines (`QuizCuisine`
    ///     ids). De-duplicated and capped at `maxCuisineCalls`. Empty
    ///     (the "No preference" answer) yields just the general call.
    ///   - budgetTier: the Q2 spend cap, 1…4. Clamped into range.
    ///   - parameters: the shared `SessionParameters`; the meal-time
    ///     field drives the `open_at` instant.
    ///   - coordinate: the session geo anchor.
    ///   - radiusMeters: the transport-radius circle.
    ///   - now: the clock the meal-time instant is resolved against.
    ///     Injected so the `open_at` derivation is deterministic in
    ///     tests; defaults to the wall clock.
    /// - Returns: N+1 `PlacesProxyRequest` specs — N cuisine-tagged
    ///   plus exactly one general call. Order: cuisine calls (in the
    ///   de-duplicated input order) then the general call.
    public static func plan(
        cuisines: [String],
        budgetTier: Int,
        parameters: SessionParameters,
        coordinate: CLLocationCoordinate2D,
        radiusMeters: Double,
        now: Date = Date()
    ) -> [PlacesProxyRequest] {
        let cravedCuisines = dedupedCappedCuisines(cuisines)
        let priceCap = max(1, min(4, budgetTier))
        let openAt = openAtInstant(for: parameters.mealTime, now: now)

        // One category-tagged call per craved cuisine.
        var specs: [PlacesProxyRequest] = cravedCuisines.map { cuisine in
            request(
                coordinate: coordinate,
                radiusMeters: radiusMeters,
                priceCap: priceCap,
                openAt: openAt,
                cuisine: cuisine
            )
        }
        // The mandatory general call — always appended, no cuisine tag.
        specs.append(
            request(
                coordinate: coordinate,
                radiusMeters: radiusMeters,
                priceCap: priceCap,
                openAt: openAt,
                cuisine: nil
            )
        )
        return specs
    }

    // MARK: - Spec construction

    /// Build one `PlacesProxyRequest` with the hard filters applied.
    /// `cuisine` is the advisory tag — `nil` for the general call.
    private static func request(
        coordinate: CLLocationCoordinate2D,
        radiusMeters: Double,
        priceCap: Int,
        openAt: String,
        cuisine: String?
    ) -> PlacesProxyRequest {
        PlacesProxyRequest(
            lat: coordinate.latitude,
            lng: coordinate.longitude,
            radiusMeters: radiusMeters,
            filters: PlacesFilters(
                dietary: nil,        // profile dietary is layered in by
                                     // a later tracer bullet, not here;
                                     // crucially the craved cuisine is
                                     // NEVER placed here (research-01 §3.2).
                priceTier: priceCap,
                openAt: openAt,
                cuisine: cuisine
            )
        )
    }

    /// De-duplicate the craved-cuisine list (order-preserving) and cap
    /// it at `maxCuisineCalls`.
    private static func dedupedCappedCuisines(_ cuisines: [String]) -> [String] {
        var seen = Set<String>()
        var deduped: [String] = []
        for cuisine in cuisines {
            guard !cuisine.isEmpty, seen.insert(cuisine).inserted else { continue }
            deduped.append(cuisine)
            if deduped.count == maxCuisineCalls { break }
        }
        return deduped
    }

    // MARK: - Meal-time → open_at

    /// The local hour each meal-time resolves to. Foursquare's
    /// `open_at` filters to venues open at a specific instant; the
    /// planner picks a representative hour for the session's meal so
    /// only venues actually open at that meal are fetched.
    ///
    /// Hours chosen to sit comfortably inside each meal's service
    /// window (so a venue with a typical kitchen schedule reads as
    /// open): breakfast 09:00, lunch 12:30, dinner 19:00, late night
    /// 22:30.
    static func representativeHour(for mealTime: SessionParameters.MealTime) -> (hour: Int, minute: Int) {
        switch mealTime {
        case .breakfast: return (9, 0)
        case .lunch:     return (12, 30)
        case .dinner:    return (19, 0)
        case .lateNight: return (22, 30)
        }
    }

    /// Resolve the meal-time to a concrete ISO-8601 `open_at` instant.
    /// The instant is on the same calendar day as `now` (the session is
    /// being planned for the current day's meal) at the meal's
    /// representative hour, in the current calendar's local time zone —
    /// the PlacesProxy converts the ISO string to the unix-seconds
    /// `open_at` Foursquare expects.
    static func openAtInstant(for mealTime: SessionParameters.MealTime, now: Date) -> String {
        let calendar = Calendar.current
        let slot = representativeHour(for: mealTime)
        var components = calendar.dateComponents([.year, .month, .day], from: now)
        components.hour = slot.hour
        components.minute = slot.minute
        components.second = 0
        let instant = calendar.date(from: components) ?? now
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: instant)
    }
}
