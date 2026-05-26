// GetToIt — VerdictRerollHost (bug-27 + bug-34).
//
// bug-27: this host wraps the live `VerdictScreen` and owns the small
// surface of state the reroll feature needs (the `RerollStore` driving
// `rerollsUsed`, the `RerollSheetState` that opens the S07 sheet).
//
// bug-34 / ADR 0018: extended into a three-way dispatcher. The host
// takes a `Surface` value naming which of the three verdict-family
// screens to mount:
//
//   * `.live(flavor:)`     → `VerdictScreen` (with reroll wired)
//   * `.readOnly(showHomeChrome:)` → `VerdictReadOnlyScreen`
//   * `.noSurvivor`        → `NoSurvivorScreen`
//
// The dispatch lets the call sites keep the same single entry point
// while the underlying surface routing follows ADR 0018's three-intent
// decomposition. The `RerollStore` is only consulted on `.live` — the
// read-only and no-survivor branches never burn a reroll (read-only's
// verdict is sealed; no-survivor's widen action is free).
//
// On `.task` (live branch only) the host calls
// `await store.refreshUsedCount()` so the "N LEFT" stamp and the
// reroll-exhausted footer copy start accurate on first render.
//
// Surface resolution helper:
//   * `Surface.from(verdictView:isInitiator:)` translates a
//     `VerdictStore.VerdictView` (carrying `.default` / `.committed` /
//     `.solo` / `.noSurvivor`) into the matching `Surface` case. The
//     read-only branch is NOT inferred from a VerdictView — the
//     arrival vector (Account-member History vs Web invitee deep
//     link) is call-site knowledge and is signalled explicitly via
//     `.readOnly(showHomeChrome:)`.

import Foundation
import SwiftUI
import Supabase

@MainActor
public final class RerollSheetState: ObservableObject {
    /// Backs the `.sheet(isPresented:)` modifier on the host. Flipped
    /// to true by `present()` (the wired-up `onReroll` closure on
    /// `VerdictScreen`) and back to false by `dismiss()` (Cancel CTA
    /// on S07 + the `onSubmit` completion).
    @Published public private(set) var isShowingSheet: Bool = false
    public let store: RerollStore

    public init(store: RerollStore) {
        self.store = store
    }

    /// Open the S07 sheet. The bug-27 fix in one line — before bug-27
    /// the tertiary REROLL tap fired the default-`{}` `onReroll`
    /// closure on `VerdictScreen` and nothing happened. Now it fires
    /// this method.
    public func present() {
        isShowingSheet = true
    }

    /// Close the S07 sheet. Wired to S07's Cancel CTA and to the
    /// completion of a successful `applyReroll` call.
    public func dismiss() {
        isShowingSheet = false
    }
}

@MainActor
public struct VerdictRerollHost: View {

    /// Which of the three verdict-family surfaces this mount renders.
    /// Resolves from a combination of room state (`VerdictStore` mode)
    /// and call-site arrival-vector knowledge (the read-only chrome
    /// flag). See ADR 0018 §"VerdictRerollHost dispatch".
    public enum Surface: Equatable, Sendable {
        case live(flavor: VerdictScreen.Flavor)
        case readOnly(showHomeChrome: Bool)
        case noSurvivor

        /// Resolve a `Surface` from a `VerdictStore.VerdictView`. Used
        /// by the post-quiz path (where `VerdictStore` writes the
        /// mode) to drive the dispatch. Read-only is NOT inferred from
        /// the view — the call site signals it explicitly via
        /// `.readOnly(showHomeChrome:)` because the arrival vector
        /// (Account-member History vs Web invitee deep link) is
        /// call-site knowledge, not room state. A `.readOnly` mode on
        /// the view (set by `LateJoinerStore`) maps to the chrome-on
        /// default; callers with the Web-invitee arrival vector pass
        /// `.readOnly(showHomeChrome: false)` directly.
        public static func from(
            verdictView view: VerdictStore.VerdictView
        ) -> Surface {
            switch view.mode {
            case .noSurvivor:
                return .noSurvivor
            case .solo:
                return .live(flavor: .solo)
            case .committed:
                return .live(flavor: .committed)
            case .default:
                return .live(flavor: .default)
            case .readOnly:
                return .readOnly(showHomeChrome: true)
            }
        }
    }

    private let verdict: VerdictScreen.Verdict
    private let surface: Surface
    private let isInitiator: Bool
    private let currentRadiusMeters: Int
    private let onHome: () -> Void
    private let onAdvance: () -> Void
    private let onWidenRadius: (Int) -> Void

    @StateObject private var store: RerollStore
    @StateObject private var sheetState: RerollSheetState

    public init(
        verdict: VerdictScreen.Verdict,
        roomID: UUID,
        surface: Surface = .live(flavor: .default),
        isInitiator: Bool = true,
        currentRadiusMeters: Int = 3219, // ~2.0 mi S01 default
        client: SupabaseClient,
        onHome: @escaping () -> Void = {},
        onAdvance: @escaping () -> Void = {},
        onWidenRadius: @escaping (Int) -> Void = { _ in }
    ) {
        self.verdict = verdict
        self.surface = surface
        self.isInitiator = isInitiator
        self.currentRadiusMeters = currentRadiusMeters
        self.onHome = onHome
        self.onAdvance = onAdvance
        self.onWidenRadius = onWidenRadius
        let rerollStore = RerollStore(client: client, roomID: roomID)
        self._store = StateObject(wrappedValue: rerollStore)
        self._sheetState = StateObject(
            wrappedValue: RerollSheetState(store: rerollStore)
        )
    }

    public var body: some View {
        switch surface {
        case .live(let flavor):
            liveSurface(flavor: flavor)
        case .readOnly(let showHomeChrome):
            VerdictReadOnlyScreen(
                verdict: verdict,
                showHomeChrome: showHomeChrome,
                onAdvance: onAdvance
            )
        case .noSurvivor:
            NoSurvivorScreen(
                verdict: verdict,
                isInitiator: isInitiator,
                currentRadiusMeters: currentRadiusMeters,
                onHome: onHome,
                onWidenRadius: onWidenRadius
            )
        }
    }

    @ViewBuilder
    private func liveSurface(flavor: VerdictScreen.Flavor) -> some View {
        VerdictScreen(
            verdict: verdict,
            flavor: flavor,
            rerollsUsed: store.rerollsUsed,
            onAdvance: onAdvance,
            onHome: onHome,
            onReroll: { sheetState.present() }
        )
        .task {
            // Seed the live count so the S05 footer + S07 stamp start
            // accurate on first render — a returning user with 3 burns
            // already spent must NOT see the live REROLL tertiary, even
            // for the moment between mount and the first count round-trip.
            try? await store.refreshUsedCount()
        }
        .sheet(isPresented: Binding(
            get: { sheetState.isShowingSheet },
            set: { newValue in
                if newValue {
                    sheetState.present()
                } else {
                    sheetState.dismiss()
                }
            }
        )) {
            RerollScreen(
                placeName: verdict.placeName,
                rerollsUsed: store.rerollsUsed,
                onCancel: { sheetState.dismiss() },
                onSubmit: { reason, detail, newVibe, dietChip in
                    Task {
                        // Fire-and-forget: a thrown error lands in
                        // `store.lastError`; the surface choice for
                        // surfacing it is deferred per bug-27 spec
                        // (agent autonomy → minimum that doesn't
                        // regress S05 layout = nothing inline yet).
                        // The sheet still closes so the user is not
                        // stranded inside it on a failure.
                        try? await store.applyReroll(
                            reason: reason,
                            detail: detail,
                            newVibe: newVibe,
                            dietChip: dietChip
                        )
                        sheetState.dismiss()
                    }
                }
            )
        }
    }
}
