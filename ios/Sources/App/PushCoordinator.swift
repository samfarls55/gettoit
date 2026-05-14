// GetToIt — PushCoordinator (TB-08).
//
// Owns the iOS native push-permission prompt and APNs device-token
// registration. Wraps `UNUserNotificationCenter` +
// `UIApplication.registerForRemoteNotifications`. The actual delivery
// side (signing JWTs, posting to APNs HTTP/2) lives in the
// `apns-sender` Edge Function — this file is purely the iOS-side
// owner of the permission prompt and the device-token write.
//
// Surface contract (driven by S05 — `surfaces/05-verdict.md`):
//
//   * The native UNUserNotificationCenter prompt fires exactly once
//     per session AFTER the user's first "I'm in" tap. The PRD locks
//     this — user story 39 says "after my first 'I'm in' tap (per
//     session, not per verdict)." Subsequent "I'm in" taps in the
//     same session do NOT re-prompt.
//
//   * The pre-permission copy line on S05 reads
//     `"We'll check in tomorrow — see if you went."` It is in the
//     voluntary register; the words "Enable notifications" / "Allow
//     alerts" / "Turn on push" are forbidden by PRD lock.
//
//   * On `denied` the coordinator writes the denial flag so the next
//     app launch can surface an in-app banner fallback (PRD user
//     story 40). This is read by `AuthPromptStore` / future banner
//     work; we just persist it.
//
//   * On `authorized` the coordinator registers for remote
//     notifications. The APNs device token returned by
//     `application(_:didRegisterForRemoteNotificationsWithDeviceToken:)`
//     is forwarded to `recordToken(_:)` which upserts a row into
//     `push_tokens`.
//
// Testability:
//   * The center side is abstracted through `PushPermissionCenter`
//     and the registration side through `PushRegistrationDriver`.
//     Tests inject stubs to drive the state machine deterministically.
//   * `PushTokenWriter` abstracts the Supabase write so unit tests
//     don't need a real client. The integration test exercises the
//     real write against the live Supabase project.

import Foundation
#if canImport(UIKit)
import UIKit
#endif
import UserNotifications
import Supabase

// MARK: - permission states

public enum PushPermissionStatus: Equatable, Sendable {
    case notDetermined
    case denied
    case authorized
    /// Provisional auth is the silent-grant tier UNAuthorizationOption
    /// .provisional admits. Treated as authorized for our purposes —
    /// the OS will deliver to the Notification Center quietly.
    case provisional
    case ephemeral
}

// MARK: - seams (testable)

/// Abstracts `UNUserNotificationCenter` so unit tests can drive the
/// "requested -> granted / denied" branch deterministically.
@MainActor
public protocol PushPermissionCenter: AnyObject {
    func getAuthorizationStatus() async -> PushPermissionStatus
    /// Request the standard `[.alert, .badge, .sound]` set. Returns
    /// the user's response. Throws on unexpected system error.
    func requestAuthorization() async throws -> PushPermissionStatus
}

/// Abstracts `UIApplication.registerForRemoteNotifications`. The real
/// driver lives on UIApplication; tests stub it.
@MainActor
public protocol PushRegistrationDriver: AnyObject {
    /// Kick off `registerForRemoteNotifications`. The APNs device token
    /// is delivered asynchronously to the AppDelegate; the coordinator
    /// surfaces it back via `recordToken(_:)`.
    func register()
}

/// Persists a device token. Production wires to PostgREST against the
/// `push_tokens` table; tests use an in-memory shim.
public protocol PushTokenWriter: Sendable {
    func record(deviceToken: String, userID: UUID) async throws
}

/// Persists the denied flag so the next app launch's banner work can
/// surface a fallback. Production wires to `user_preferences`; tests
/// use a UserDefaults-backed shim.
public protocol PushDenialFlagStore: Sendable {
    func setDenied(userID: UUID, at: Date) async throws
    func wasDenied(userID: UUID) async throws -> Bool
}

// MARK: - coordinator

/// Drives the once-per-session permission ask and the APNs registration.
///
/// Session scoping is in-memory: the coordinator is created once at
/// app boot. The "already requested this session" flag lives on the
/// instance and is dropped at process exit.
@MainActor
public final class PushCoordinator: ObservableObject {
    @Published public private(set) var status: PushPermissionStatus = .notDetermined
    @Published public private(set) var requestedThisSession: Bool = false
    @Published public private(set) var lastRegisteredDeviceToken: String? = nil

    private let center: PushPermissionCenter
    private let driver: PushRegistrationDriver
    private let writer: PushTokenWriter
    private let flagStore: PushDenialFlagStore
    /// Source of "now" — overridable for tests so the persisted
    /// denial timestamp is deterministic.
    private let clock: () -> Date

    public init(
        center: PushPermissionCenter,
        driver: PushRegistrationDriver,
        writer: PushTokenWriter,
        flagStore: PushDenialFlagStore,
        clock: @escaping () -> Date = Date.init
    ) {
        self.center = center
        self.driver = driver
        self.writer = writer
        self.flagStore = flagStore
        self.clock = clock
    }

    /// Idempotent boot-time read of the current OS permission status.
    /// Called once before the verdict surface materialises so the
    /// state machine starts from the right node.
    public func loadCurrentStatus() async {
        self.status = await center.getAuthorizationStatus()
        if status == .authorized || status == .provisional {
            // Already authorized from a prior session — kick the
            // re-registration so the APNs token refreshes on every
            // launch (PRD ADR — tokens can rotate; APNs accepts a
            // stale token for ~7 days but re-register on launch is
            // the canonical pattern).
            driver.register()
        }
    }

    /// Fire the native permission prompt — at most once per session.
    /// Subsequent calls are no-ops and return the cached status.
    ///
    /// Use site: the S05 "I'm in" tap calls this AFTER the
    /// ratification row is written. If the user denies, the next
    /// launch surfaces the in-app banner fallback.
    @discardableResult
    public func requestPermissionOncePerSession(userID: UUID) async -> PushPermissionStatus {
        if requestedThisSession {
            return status
        }
        requestedThisSession = true

        // Snapshot current state — if the user already authorized in
        // a prior session, we don't re-prompt (UN.requestAuthorization
        // would no-op anyway, but we keep the contract explicit).
        let snapshot = await center.getAuthorizationStatus()
        self.status = snapshot
        if snapshot == .authorized || snapshot == .provisional {
            driver.register()
            return snapshot
        }
        if snapshot == .denied {
            // The system won't show another prompt once denied; the
            // user must visit Settings. Persist the flag so the next
            // launch can surface the in-app banner.
            try? await flagStore.setDenied(userID: userID, at: clock())
            return snapshot
        }

        do {
            let result = try await center.requestAuthorization()
            self.status = result
            switch result {
            case .authorized, .provisional:
                driver.register()
            case .denied:
                try? await flagStore.setDenied(userID: userID, at: clock())
            default:
                break
            }
            return result
        } catch {
            // The system rarely throws here, but if it does we treat it
            // as a no-op: don't persist a denial (we don't know what the
            // user would have chosen), don't register.
            return self.status
        }
    }

    /// Forward the APNs device token from AppDelegate's
    /// `didRegisterForRemoteNotificationsWithDeviceToken` callback into
    /// the upsert path. The argument is `Data`; we encode as a lowercase
    /// hex string (the standard APNs `apns-id` shape).
    public func recordToken(_ token: Data, userID: UUID) async {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        self.lastRegisteredDeviceToken = hex
        do {
            try await writer.record(deviceToken: hex, userID: userID)
        } catch {
            // Token persistence is best-effort. APNs will accept the
            // device-token round-trip even if our row is missing; the
            // next launch will re-register and re-write.
        }
    }

    /// Has the user denied push in any prior session? Drives the
    /// in-app banner fallback at app launch (PRD user story 40).
    public func wasPreviouslyDenied(userID: UUID) async -> Bool {
        (try? await flagStore.wasDenied(userID: userID)) ?? false
    }
}

// MARK: - production wiring

#if canImport(UIKit)

/// `UNUserNotificationCenter` adapter for the real iOS center.
@MainActor
public final class SystemPushPermissionCenter: PushPermissionCenter {
    private let center = UNUserNotificationCenter.current()

    public init() {}

    public func getAuthorizationStatus() async -> PushPermissionStatus {
        await withCheckedContinuation { cont in
            center.getNotificationSettings { settings in
                cont.resume(returning: PushCoordinator.map(settings.authorizationStatus))
            }
        }
    }

    public func requestAuthorization() async throws -> PushPermissionStatus {
        let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        // After requestAuthorization resolves, re-read settings to get
        // the actual final status (`.provisional`, `.ephemeral`, etc.).
        return await getAuthorizationStatus().withFallbackGranted(granted)
    }
}

private extension PushPermissionStatus {
    func withFallbackGranted(_ granted: Bool) -> PushPermissionStatus {
        if self == .notDetermined { return granted ? .authorized : .denied }
        return self
    }
}

/// Default registration driver — calls into `UIApplication.shared`.
@MainActor
public final class SystemPushRegistrationDriver: PushRegistrationDriver {
    public init() {}
    public func register() {
        UIApplication.shared.registerForRemoteNotifications()
    }
}

#endif

// MARK: - status mapping

public extension PushCoordinator {
    /// Map UN's `UNAuthorizationStatus` enum into our domain type.
    static func map(_ status: UNAuthorizationStatus) -> PushPermissionStatus {
        switch status {
        case .notDetermined: return .notDetermined
        case .denied:        return .denied
        case .authorized:    return .authorized
        case .provisional:   return .provisional
        case .ephemeral:     return .ephemeral
        @unknown default:    return .notDetermined
        }
    }
}

// MARK: - PostgREST-backed writers

/// Inserts into `push_tokens`. Idempotent on the (user_id, device_token)
/// PK — a duplicate insert raises a 23505 unique_violation which we
/// swallow as "already registered."
public struct SupabasePushTokenWriter: PushTokenWriter {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func record(deviceToken: String, userID: UUID) async throws {
        struct Row: Encodable {
            let user_id: String
            let device_token: String
            let platform: String
        }
        do {
            try await client
                .from("push_tokens")
                .insert(Row(
                    user_id: userID.uuidString.lowercased(),
                    device_token: deviceToken,
                    platform: "ios"
                ))
                .execute()
        } catch {
            // 23505 unique_violation = already registered; that's the
            // happy path on a relaunch. Surface anything else.
            let message = "\(error)".lowercased()
            if message.contains("23505") || message.contains("unique") {
                return
            }
            throw error
        }
    }
}

/// Persists the denial flag into `user_preferences.push_denied_at`.
/// The migration adds that column in the same TB-08 migration set.
public struct SupabasePushDenialFlagStore: PushDenialFlagStore {
    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    public func setDenied(userID: UUID, at: Date) async throws {
        struct Row: Encodable {
            let user_id: String
            let push_denied_at: String
        }
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let stamp = iso.string(from: at)
        try await client
            .from("user_preferences")
            .upsert(
                Row(user_id: userID.uuidString.lowercased(), push_denied_at: stamp),
                onConflict: "user_id"
            )
            .execute()
    }

    public func wasDenied(userID: UUID) async throws -> Bool {
        struct Row: Decodable {
            let push_denied_at: String?
        }
        let rows: [Row] = try await client
            .from("user_preferences")
            .select("push_denied_at")
            .eq("user_id", value: userID.uuidString.lowercased())
            .limit(1)
            .execute()
            .value
        return rows.first?.push_denied_at != nil
    }
}
