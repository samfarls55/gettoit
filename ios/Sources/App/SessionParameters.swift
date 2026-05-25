// GetToIt — SessionParameters (TB-05 quiz redesign).
//
// The *parameters* bucket of the quiz-redesign three-bucket input model (see
// `gti-vault/10_prds/0.1.0-quiz-redesign-prd.md` §"Three-bucket model"
// and module (K)). Parameters are the session settings that are
// CONSISTENT ACROSS EVERY PARTICIPANT — the initiator sets them once
// on the pre-quiz S01b surface, they persist on the `rooms` record,
// and every joiner reads them back without re-prompting.
//
// Three of the five PRD parameters are carried by this type:
//   * meal time      — drives the Foursquare `open_at` filter.
//   * group context  — solo / duo / group; sizes the recommendation.
//   * service shape   — dine-in (indoor/outdoor) vs takeout
//                       (pickup/delivery); matches how the group eats.
//   * transport mode  — walk / drive; sets the default search radius.
//
// The remaining two PRD parameters are NOT in this type, by design:
//   * geography — already captured + persisted via the quiz-redesign
//                 C-23 LocationPicker on S01 (`rooms.location_*`),
//                 reused per the issue ("location already exists …
//                 reuse it"). The S01b surface shows it read-only.
//   * radius    — `rooms.radius_meters` already exists (TB-03). The
//                 S01b transport-mode pick supplies a *default* radius
//                 the initiator can still override on S01's slider;
//                 the transport mode itself is stored here for the
//                 verdict engine's record, the resolved radius stays
//                 on its own column.
//
// Wire shape: a single generic `session_params` jsonb column on
// `rooms`, mirroring the TB-04 generic-jsonb decision (ADR 0010) —
// parameter content can change without a migration. The column stores
// a flat `{ meal_time, group_context, service_shape, transport_mode }`
// object of string enum raw values. A NULL column means a room created
// by a client that predates S01b (or a debug RPC); callers fall back
// to `SessionParameters.default`.

import Foundation

/// The session-wide parameters the initiator sets on the pre-quiz
/// S01b surface. Value type — encoded into `rooms.session_params`
/// and decoded back on the joiner path.
public struct SessionParameters: Codable, Equatable, Sendable {

    // MARK: - Meal time

    /// When the group is eating. Drives the Foursquare `open_at`
    /// filter so only venues open at that time are considered.
    public enum MealTime: String, Codable, CaseIterable, Sendable {
        case breakfast
        case lunch
        case dinner
        case lateNight = "late_night"

        /// Surface-copy label for the S01b chip.
        public var label: String {
            switch self {
            case .breakfast: return "Breakfast"
            case .lunch:     return "Lunch"
            case .dinner:    return "Dinner"
            case .lateNight: return "Late night"
            }
        }
    }

    // MARK: - Group context

    /// The social context of the session — sizes the recommendation
    /// to the occasion. Named "context" rather than a raw integer
    /// count because the signal the engine wants is the *occasion*
    /// (a solo bite vs a group night out), not a precise headcount —
    /// actual group size is inferred from who accepts the invite.
    public enum GroupContext: String, Codable, CaseIterable, Sendable {
        case solo
        case duo
        case group

        public var label: String {
            switch self {
            case .solo:  return "Just me"
            case .duo:   return "Two of us"
            case .group: return "A group"
            }
        }
    }

    // MARK: - Service shape

    /// How the group wants to eat. Dine-in vs takeout, each with the
    /// two real-world sub-shapes. Filters candidates to venues that
    /// actually offer that service.
    public enum ServiceShape: String, Codable, CaseIterable, Sendable {
        case dineInIndoor  = "dine_in_indoor"
        case dineInOutdoor = "dine_in_outdoor"
        case takeoutPickup = "takeout_pickup"
        case takeoutDelivery = "takeout_delivery"

        public var label: String {
            switch self {
            case .dineInIndoor:    return "Dine in"
            case .dineInOutdoor:   return "Outdoor seating"
            case .takeoutPickup:   return "Takeout"
            case .takeoutDelivery: return "Delivery"
            }
        }

        /// True for the two dine-in shapes. The S01b surface groups
        /// the four shapes under a Dine-in / Takeout header pair.
        public var isDineIn: Bool {
            self == .dineInIndoor || self == .dineInOutdoor
        }
    }

    // MARK: - Transport mode

    /// How the group will travel to the venue. Sets the *default*
    /// search radius on S01 (the initiator can still override with
    /// the slider). Walking keeps the pool tight; driving widens it.
    public enum TransportMode: String, Codable, CaseIterable, Sendable {
        case walk
        case drive

        public var label: String {
            switch self {
            case .walk:  return "Walking"
            case .drive: return "Driving"
            }
        }

        /// The radius (in miles) S01's slider pre-selects for this
        /// transport mode. Walking → the canonical 2.0 mi default;
        /// driving → a wider 5.0 mi so a car-bound group is not
        /// boxed into a walkable pool. Both land inside the S01
        /// slider's `0.5…5.0 mi` range so the value is always
        /// re-adjustable.
        public var defaultRadiusMiles: Double {
            switch self {
            case .walk:  return 2.0
            case .drive: return 5.0
            }
        }
    }

    // MARK: - Stored fields

    public var mealTime: MealTime
    public var groupContext: GroupContext
    public var serviceShape: ServiceShape
    public var transportMode: TransportMode

    public init(
        mealTime: MealTime,
        groupContext: GroupContext,
        serviceShape: ServiceShape,
        transportMode: TransportMode
    ) {
        self.mealTime = mealTime
        self.groupContext = groupContext
        self.serviceShape = serviceShape
        self.transportMode = transportMode
    }

    /// The zero-tap defaults. The S01b surface opens with every chip
    /// already on these values, so an initiator who skims the screen
    /// and taps the CTA still ships a valid session — the same
    /// "sensible default" contract S01's timer + radius controls
    /// follow (see `design-system/surfaces/01-initiator.md`).
    ///
    /// `dinner` is the modal meal a group coordinates around;
    /// `group` matches the product's group-decision premise;
    /// `dineInIndoor` is the default sit-down shape; `walk` keeps the
    /// candidate pool tight and matches the 2.0 mi S01 radius default.
    public static let `default` = SessionParameters(
        mealTime: .dinner,
        groupContext: .group,
        serviceShape: .dineInIndoor,
        transportMode: .walk
    )

    // MARK: - Codec

    enum CodingKeys: String, CodingKey {
        case mealTime = "meal_time"
        case groupContext = "group_context"
        case serviceShape = "service_shape"
        case transportMode = "transport_mode"
    }

    /// Decode tolerantly: an unknown / missing enum value on any field
    /// falls back to that field's default rather than throwing. A
    /// `rooms.session_params` column written by a newer client (a
    /// parameter option this build does not know) must still hydrate
    /// the joiner into a usable session instead of crashing the quiz.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let fallback = SessionParameters.default
        self.mealTime = (try? c.decode(MealTime.self, forKey: .mealTime)) ?? fallback.mealTime
        self.groupContext = (try? c.decode(GroupContext.self, forKey: .groupContext)) ?? fallback.groupContext
        self.serviceShape = (try? c.decode(ServiceShape.self, forKey: .serviceShape)) ?? fallback.serviceShape
        self.transportMode = (try? c.decode(TransportMode.self, forKey: .transportMode)) ?? fallback.transportMode
    }
}
