// GetToIt — VerdictRerollHost (bug-27).
//
// Closes the bug-27 "feature unplumbed" defect: the S05 tertiary
// "REROLL" CTA was a dead tap on the two live VerdictScreen sites
// because `onReroll` defaulted to `{}` and no caller wired it. This
// view is the host wrapper both live call sites now mount instead of
// a bare `VerdictScreen(...)`. It owns the small surface of state
// the reroll feature needs:
//
//   * `@StateObject store: RerollStore` — drives the live `rerollsUsed`
//     count that flows back into both `VerdictScreen.rerollsUsed` (so
//     the tertiary collapses to "No rerolls left" at the 3-cap) and
//     `RerollScreen.rerollsUsed` (the S07 sheet's "N LEFT" stamp +
//     "Reroll · last one" copy on the 3rd burn).
//   * `@StateObject sheetState: RerollSheetState` — the open/close
//     flag for the S07 sheet, plus the test seam. Lifted off a bare
//     `@State Bool` so the bug-27 "did the tap actually plumb through"
//     contract is unit-testable without standing up a SwiftUI host.
//
// On `.task` the host calls `await store.refreshUsedCount()` so the
// "N LEFT" stamp and the reroll-exhausted footer copy start accurate
// on first render — without this a returning user with 3 burns already
// spent would briefly see the live REROLL button.
//
// onSubmit closure: calls `store.applyReroll(...)` then dismisses the
// sheet. On success the existing Realtime verdict subscriber picks up
// the new verdict and S05 re-renders. On error the store publishes
// `lastError`; the bare error surfacing is left for a follow-up (no
// toast/inline-banner introduced here — the spec's "agent has autonomy
// on choice" branch resolves to "skip the optional surface" given
// `RerollStore.lastError` is already published for a future surface to
// observe).
//
// Two live mount sites:
//   * `RootView.swift` (createdDecidedVerdict block) — `.default` mode,
//     `isInitiator: true`. Plan list → tap a Decided-active Plan.
//   * `PostQuizHostScreen.swift` (`.verdict` phase) — `.solo` mode for
//     a solo session, `.default` for a group session; `isInitiator`
//     comes from the post-Q5 session context.
//
// The three other VerdictScreen sites stay bare — they pass
// `mode: .readOnly` which suppresses the reroll affordance entirely
// (`rerollTertiary` only renders on `.default` / `.committed` / `.solo`).
// Those call sites now pass `onReroll: { }` explicitly because bug-27
// dropped the default value from `VerdictScreen.onReroll` so the
// compiler catches the next bug-27-class wire-up miss at the call site.

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

    private let verdict: VerdictScreen.Verdict
    private let mode: VerdictScreen.Mode
    private let isInitiator: Bool
    private let onHome: () -> Void
    private let onAdvance: () -> Void

    @StateObject private var store: RerollStore
    @StateObject private var sheetState: RerollSheetState

    public init(
        verdict: VerdictScreen.Verdict,
        roomID: UUID,
        mode: VerdictScreen.Mode = .default,
        isInitiator: Bool = true,
        client: SupabaseClient,
        onHome: @escaping () -> Void = {},
        onAdvance: @escaping () -> Void = {}
    ) {
        self.verdict = verdict
        self.mode = mode
        self.isInitiator = isInitiator
        self.onHome = onHome
        self.onAdvance = onAdvance
        let rerollStore = RerollStore(client: client, roomID: roomID)
        self._store = StateObject(wrappedValue: rerollStore)
        self._sheetState = StateObject(
            wrappedValue: RerollSheetState(store: rerollStore)
        )
    }

    public var body: some View {
        VerdictScreen(
            verdict: verdict,
            mode: mode,
            isInitiator: isInitiator,
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
