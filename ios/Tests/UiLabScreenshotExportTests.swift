// GetToIt - UI lab screenshot export.
//
// This test is an opt-in artifact producer for native SwiftUI surfaces.
// Normal test runs skip it. Set GTI_UI_LAB_SCREENSHOT_DIR to a writable
// directory on a macOS/iOS-simulator runner to export PNGs that the web
// UI lab can display beside the React surfaces.

import SwiftUI
import Supabase
import UIKit
import XCTest
@testable import GetToIt

@MainActor
final class UiLabScreenshotExportTests: XCTestCase {
    private let canvasSize = CGSize(width: 390, height: 844)

    func testExportUiLabScreenshots() async throws {
        guard let directory = ProcessInfo.processInfo.environment["GTI_UI_LAB_SCREENSHOT_DIR"],
              !directory.isEmpty
        else {
            throw XCTSkip("Set GTI_UI_LAB_SCREENSHOT_DIR to export UI lab screenshots.")
        }

        let outputDirectory = URL(fileURLWithPath: directory, isDirectory: true)
        try FileManager.default.createDirectory(
            at: outputDirectory,
            withIntermediateDirectories: true
        )

        try await export("signin", SignInScreen(auth: makeAuthCoordinator()), to: outputDirectory)
        try await export(
            "location",
            LocationPermissionScreen(onShareLocation: {}, onManualEntry: {}),
            to: outputDirectory
        )
        try await export("q1", QuizScreen(coordinator: quizCoordinator(at: .q1), onClose: {}), to: outputDirectory)
        try await export("q2", QuizScreen(coordinator: quizCoordinator(at: .q2), onClose: {}), to: outputDirectory)
        try await export("q3", QuizScreen(coordinator: quizCoordinator(at: .q3), onClose: {}), to: outputDirectory)
        try await export("q4", QuizScreen(coordinator: quizCoordinator(at: .q4), onClose: {}), to: outputDirectory)
        try await export("q5", QuizScreen(coordinator: quizCoordinator(at: .q5), onClose: {}), to: outputDirectory)
        try await export("q5-loading", QuizScreen(coordinator: loadingQ5Coordinator(), onClose: {}), to: outputDirectory)
        try await export("q5-empty", QuizScreen(coordinator: await noResultsQ5Coordinator(), onClose: {}), to: outputDirectory)
        try await export("waiting", waitingScreen(isInitiator: true, answeredCount: 2), to: outputDirectory)
        try await export("verdict", VerdictScreen(verdict: .fixture(), flavor: .default), to: outputDirectory)
        try await export("verdict-readonly", VerdictReadOnlyScreen(verdict: .fixture()), to: outputDirectory)
        try await export("no-survivor", NoSurvivorScreen(verdict: .noSurvivorFixture()), to: outputDirectory)
        try await export("locked", LockedScreen(plate: .fixture(), motion: .fade), to: outputDirectory)
        try await export(
            "reroll",
            RerollScreen(placeName: "Pico's", rerollsUsed: 0, onCancel: {}, onSubmit: { _, _, _, _ in }),
            to: outputDirectory
        )
        try await export(
            "checkin",
            CheckinScreen(plate: .fixture(), writer: NoopCheckinWriter(), onAdvance: {}),
            to: outputDirectory
        )
    }

    private func export<V: View>(_ name: String, _ view: V, to directory: URL) async throws {
        let image = try await render(view)
        let destination = directory.appendingPathComponent("\(name).png")
        guard let pngData = image.pngData() else {
            throw ScreenshotError.pngEncodingFailed(name)
        }
        try pngData.write(to: destination, options: .atomic)
    }

    private func render<V: View>(_ view: V) async throws -> UIImage {
        let root = view
            .environment(\.accessibilityReduceMotion, true)
            .frame(width: canvasSize.width, height: canvasSize.height)
        let host = UIHostingController(rootView: root)
        host.view.frame = CGRect(origin: .zero, size: canvasSize)
        host.view.bounds = CGRect(origin: .zero, size: canvasSize)
        host.view.backgroundColor = .clear

        let window = UIWindow(frame: CGRect(origin: .zero, size: canvasSize))
        window.rootViewController = host
        window.makeKeyAndVisible()

        host.view.setNeedsLayout()
        host.view.layoutIfNeeded()
        RunLoop.main.run(until: Date().addingTimeInterval(0.2))
        host.view.layoutIfNeeded()

        let renderer = UIGraphicsImageRenderer(size: canvasSize)
        return renderer.image { _ in
            host.view.drawHierarchy(in: host.view.bounds, afterScreenUpdates: true)
        }
    }

    private func quizCoordinator(at step: QuizCoordinator.Step) -> QuizCoordinator {
        let coordinator = seededQuizCoordinator()
        while coordinator.step != step {
            coordinator.advance()
        }
        return coordinator
    }

    private func seededQuizCoordinator() -> QuizCoordinator {
        QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            candidates: QuizCandidateFixtures.all,
            writer: { _ in }
        )
    }

    private func loadingQ5Coordinator() -> QuizCoordinator {
        let coordinator = QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            candidateFetch: SlowQuizCandidateFetch(),
            writer: { _ in }
        )
        while coordinator.step != .q5 {
            coordinator.advance()
        }
        return coordinator
    }

    private func noResultsQ5Coordinator() async -> QuizCoordinator {
        let coordinator = QuizCoordinator(
            roomID: UUID(),
            userID: UUID(),
            candidateFetch: NoResultsQuizCandidateFetch(),
            writer: { _ in }
        )
        while coordinator.step != .q5 {
            coordinator.advance()
        }
        await coordinator.awaitCandidateFetch()
        return coordinator
    }

    private func waitingScreen(isInitiator: Bool, answeredCount: Int) -> WaitingScreen {
        let userID = UUID()
        let store = WaitingStore(roomID: UUID(), currentUserID: userID, isInitiator: isInitiator)
        let members = [
            WaitingMember(id: userID, role: isInitiator ? "owner" : "participant"),
            WaitingMember(id: UUID(), role: "participant"),
            WaitingMember(id: UUID(), role: "participant"),
        ]
        let answered = Set(members.prefix(answeredCount).map(\.id))
        store.bootstrap(members: members, answered: answered, status: .open)

        let fireCoordinator = FireVerdictCoordinator(
            roomID: store.roomID,
            isInitiator: isInitiator,
            invoker: { _ in .firing }
        )

        return WaitingScreen(
            auth: makeAuthCoordinator(),
            promptStore: makePromptStore(),
            waitingStore: store,
            fireCoordinator: fireCoordinator,
            appleProvider: StubAppleProvider()
        )
    }

    private func makeAuthCoordinator() -> AuthCoordinator {
        AuthCoordinator(client: makeSupabaseClient(), claimRedeemer: StubClaimCodeRedeemer())
    }

    private func makePromptStore() -> AuthPromptStore {
        AuthPromptStore(client: makeSupabaseClient())
    }

    private func makeSupabaseClient() -> SupabaseClient {
        SupabaseClient(
            supabaseURL: URL(string: "https://example.invalid")!,
            supabaseKey: "stub"
        )
    }
}

private enum ScreenshotError: Error {
    case pngEncodingFailed(String)
}

private struct SlowQuizCandidateFetch: QuizCandidateFetch {
    func fetchCandidates(
        answers: QuizFetchAnswers,
        parameters: SessionParameters
    ) async -> QuizCandidateFetchResult {
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        return QuizCandidateFetchResult(candidates: [], source: .noResults)
    }
}

private final class NoopCheckinWriter: CheckinWriter, @unchecked Sendable {
    func record(outcome: CheckinScreen.Outcome, reason: CheckinScreen.SkipReason?) async throws {}
}

private struct StubAppleProvider: AppleSignInProviding {
    func requestAppleCredential() async throws -> AppleSignInCredential {
        AppleSignInCredential(idToken: "stub", nonce: nil)
    }
}
