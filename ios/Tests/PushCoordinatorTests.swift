// GetToIt — PushCoordinator tests (TB-08).
//
// Drives the once-per-session permission state machine against stub
// seams (PushPermissionCenter / PushRegistrationDriver / PushTokenWriter
// / PushDenialFlagStore). No UNUserNotificationCenter touched — that
// API requires entitlements + a code-signed binary in CI.
//
// What this exercises:
//   * Permission request fires exactly once per session even when
//     the caller invokes `requestPermissionOncePerSession` twice.
//   * Granted state writes the APNs device token through
//     `recordToken` and starts remote-notification registration.
//   * Denied state writes the denial flag for the in-app banner
//     fallback (PRD user story 40).
//   * Re-launching (a fresh PushCoordinator) and seeing the user is
//     already authorized re-registers immediately without re-prompting.

import XCTest
@testable import GetToIt
import UserNotifications

@MainActor
final class PushCoordinatorTests: XCTestCase {

    // MARK: - stubs

    private final class StubCenter: PushPermissionCenter {
        var initialStatus: PushPermissionStatus
        var requestResult: PushPermissionStatus
        var requestCallCount = 0
        var statusReadCount = 0

        init(initial: PushPermissionStatus, request: PushPermissionStatus) {
            self.initialStatus = initial
            self.requestResult = request
        }

        func getAuthorizationStatus() async -> PushPermissionStatus {
            statusReadCount += 1
            return initialStatus
        }

        func requestAuthorization() async throws -> PushPermissionStatus {
            requestCallCount += 1
            // Once the request fires the OS state changes to the
            // requested result for subsequent reads.
            initialStatus = requestResult
            return requestResult
        }
    }

    private final class StubDriver: PushRegistrationDriver {
        var registerCallCount = 0
        func register() { registerCallCount += 1 }
    }

    private final class StubWriter: PushTokenWriter, @unchecked Sendable {
        var calls: [(token: String, userID: UUID)] = []
        func record(deviceToken: String, userID: UUID) async throws {
            calls.append((deviceToken, userID))
        }
    }

    private final class StubFlagStore: PushDenialFlagStore, @unchecked Sendable {
        var denials: [UUID: Date] = [:]
        func setDenied(userID: UUID, at: Date) async throws {
            denials[userID] = at
        }
        func wasDenied(userID: UUID) async throws -> Bool {
            return denials[userID] != nil
        }
    }

    // MARK: - once-per-session

    func testGrantedFlowRegistersForRemoteNotificationsAndDoesNotFlagDenial() async {
        let center = StubCenter(initial: .notDetermined, request: .authorized)
        let driver = StubDriver()
        let writer = StubWriter()
        let flag = StubFlagStore()
        let coordinator = PushCoordinator(
            center: center, driver: driver, writer: writer, flagStore: flag
        )
        let user = UUID()

        let status = await coordinator.requestPermissionOncePerSession(userID: user)

        XCTAssertEqual(status, .authorized)
        XCTAssertEqual(center.requestCallCount, 1, "must request exactly once")
        XCTAssertEqual(driver.registerCallCount, 1, "granted state kicks remote-notification registration")
        XCTAssertNil(flag.denials[user], "granted state must not flag denial")
    }

    func testDeniedFlowWritesTheDenialFlagAndDoesNotRegister() async {
        let center = StubCenter(initial: .notDetermined, request: .denied)
        let driver = StubDriver()
        let writer = StubWriter()
        let flag = StubFlagStore()
        let now = Date(timeIntervalSince1970: 1_747_000_000)
        let coordinator = PushCoordinator(
            center: center, driver: driver, writer: writer, flagStore: flag,
            clock: { now }
        )
        let user = UUID()

        let status = await coordinator.requestPermissionOncePerSession(userID: user)

        XCTAssertEqual(status, .denied)
        XCTAssertEqual(driver.registerCallCount, 0, "denied state must not register")
        XCTAssertEqual(flag.denials[user], now,
            "denied state must persist the denial timestamp for the banner fallback")
    }

    func testSecondRequestPerSessionIsANoOp() async {
        let center = StubCenter(initial: .notDetermined, request: .authorized)
        let driver = StubDriver()
        let writer = StubWriter()
        let flag = StubFlagStore()
        let coordinator = PushCoordinator(
            center: center, driver: driver, writer: writer, flagStore: flag
        )
        let user = UUID()

        _ = await coordinator.requestPermissionOncePerSession(userID: user)
        _ = await coordinator.requestPermissionOncePerSession(userID: user)
        _ = await coordinator.requestPermissionOncePerSession(userID: user)

        XCTAssertEqual(center.requestCallCount, 1,
            "OS prompt fires exactly once per session even on repeated taps")
    }

    func testRequestWhenAlreadyAuthorizedRegistersWithoutPrompting() async {
        // Boot-time state: a prior session already granted permission.
        // The next request is a no-op for the prompt and re-fires the
        // registration so the APNs token can refresh.
        let center = StubCenter(initial: .authorized, request: .authorized)
        let driver = StubDriver()
        let writer = StubWriter()
        let flag = StubFlagStore()
        let coordinator = PushCoordinator(
            center: center, driver: driver, writer: writer, flagStore: flag
        )

        _ = await coordinator.requestPermissionOncePerSession(userID: UUID())

        XCTAssertEqual(center.requestCallCount, 0,
            "already-authorized state must not re-prompt — the OS rejects re-prompting anyway")
        XCTAssertEqual(driver.registerCallCount, 1, "must re-register so the APNs token refreshes")
    }

    func testRequestWhenAlreadyDeniedFlagsAndDoesNotRegister() async {
        // The system won't show the prompt a second time — the user
        // must visit Settings. Record the flag so the next launch's
        // banner work can surface the fallback.
        let center = StubCenter(initial: .denied, request: .denied)
        let driver = StubDriver()
        let writer = StubWriter()
        let flag = StubFlagStore()
        let coordinator = PushCoordinator(
            center: center, driver: driver, writer: writer, flagStore: flag
        )
        let user = UUID()

        _ = await coordinator.requestPermissionOncePerSession(userID: user)

        XCTAssertEqual(driver.registerCallCount, 0)
        XCTAssertNotNil(flag.denials[user],
            "already-denied launches must write the flag so the banner can surface")
    }

    // MARK: - device token recording

    func testRecordTokenForwardsHexEncodedTokenToTheWriter() async {
        let center = StubCenter(initial: .authorized, request: .authorized)
        let driver = StubDriver()
        let writer = StubWriter()
        let flag = StubFlagStore()
        let coordinator = PushCoordinator(
            center: center, driver: driver, writer: writer, flagStore: flag
        )
        let user = UUID()
        // 32-byte APNs token (size depends on iOS version; just check
        // we round-trip whatever the OS hands us as lowercase hex).
        let bytes: [UInt8] = (0..<32).map { UInt8($0) }
        let data = Data(bytes)

        await coordinator.recordToken(data, userID: user)

        XCTAssertEqual(writer.calls.count, 1)
        XCTAssertEqual(writer.calls.first?.userID, user)
        let hex = writer.calls.first?.token ?? ""
        XCTAssertEqual(hex.count, 64, "32-byte token encodes to 64 hex chars")
        XCTAssertEqual(hex, hex.lowercased(), "APNs hex is conventionally lowercase")
        XCTAssertEqual(hex.prefix(4), "0001", "first two bytes 0x00, 0x01 → '0001'")
    }

    // MARK: - denial flag lookup

    func testWasPreviouslyDeniedReadsFlagStore() async {
        let center = StubCenter(initial: .denied, request: .denied)
        let driver = StubDriver()
        let writer = StubWriter()
        let flag = StubFlagStore()
        let user = UUID()
        flag.denials[user] = Date(timeIntervalSince1970: 1_700_000_000)
        let coordinator = PushCoordinator(
            center: center, driver: driver, writer: writer, flagStore: flag
        )

        let was = await coordinator.wasPreviouslyDenied(userID: user)
        XCTAssertTrue(was)
        let unflagged = await coordinator.wasPreviouslyDenied(userID: UUID())
        XCTAssertFalse(unflagged)
    }

    // MARK: - status mapping

    func testStatusMappingCoversEveryUNAuthorizationStatusCase() {
        XCTAssertEqual(PushCoordinator.map(.notDetermined), .notDetermined)
        XCTAssertEqual(PushCoordinator.map(.denied),        .denied)
        XCTAssertEqual(PushCoordinator.map(.authorized),    .authorized)
        XCTAssertEqual(PushCoordinator.map(.provisional),   .provisional)
        XCTAssertEqual(PushCoordinator.map(.ephemeral),     .ephemeral)
    }
}
