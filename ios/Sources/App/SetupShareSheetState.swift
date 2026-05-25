// GetToIt — SetupShareSheetState (bug-29).
//
// Closes the bug-29 "feature unplumbed" defect: in `.group` / `.duo`
// mode the SetupScreen primary CTA "DROP THE INVITE LINK" used to be
// a dead tap — Plan + Room were minted but no iOS share sheet was
// ever presented, so the initiator had no way to send the invite URL
// to invitees. The retired `InitiatorScreen.swift` (PR #180, commit
// 87e803a) owned the entire share-sheet wiring; the replacement
// `SetupScreen.swift` was wired without it.
//
// This file holds the two small types the re-port needs:
//
//   * `PendingShare` — `Identifiable, Equatable` value type bound to
//     `.sheet(item:)`. Carries the roomID (so the onDisappear closure
//     can route the right session into Waiting) and the canonical
//     `InviteLink.url(...)` Universal Link the share sheet's
//     `UIActivityViewController` ships to the user's pick.
//
//   * `SetupShareSheetState` — `@MainActor` observable owning the
//     open/close flag. Lifted off a bare `@State PendingShare?` so the
//     bug-29 "did the tap actually present the sheet" contract is
//     unit-testable without standing up a SwiftUI host. Mirrors the
//     bug-27 `RerollSheetState` pattern in `VerdictRerollHost.swift`
//     (sibling pattern called out in the issue brief).
//
// The `ShareSheet` `UIViewControllerRepresentable` itself stays inside
// `SetupScreen.swift` — it has no testable surface and lives next to
// its single mount site.

import Foundation

/// State the share sheet reads when present. Bound to `.sheet(item:)`
/// so SwiftUI cleanly tears down the share view after dismiss.
///
/// `id` is the roomID, which both identifies the sheet for SwiftUI
/// (`.sheet(item:)` requires `Identifiable`) and carries the session
/// id the host's `onLaunched` callback routes into Waiting on dismiss.
public struct PendingShare: Identifiable, Equatable, Sendable {
    public let id: UUID
    public let url: URL

    public init(id: UUID, url: URL) {
        self.id = id
        self.url = url
    }
}

/// Owns the SetupScreen share-sheet open/close flag. Lifted out of
/// SetupScreen as a small observable so the bug-29 contract — "the
/// primary CTA in group/duo mode actually presents the share sheet"
/// — is unit-testable. SwiftUI binds `.sheet(item: $...)` to
/// `pendingShare`; flipping it non-nil opens the sheet and clearing
/// it back to nil dismisses it.
@MainActor
public final class SetupShareSheetState: ObservableObject {
    /// Backs the `.sheet(item:)` modifier on SetupScreen. Non-nil
    /// means a share sheet is being presented for the carried URL.
    @Published public private(set) var pendingShare: PendingShare?

    public init() {
        self.pendingShare = nil
    }

    /// Open the share sheet for the freshly-minted Room. The bug-29
    /// fix in one line — before bug-29 the SetupScreen primary CTA
    /// fired `onLaunched` immediately and skipped the sheet, leaving
    /// the initiator with no way to send the invite URL.
    public func present(roomID: UUID, url: URL) {
        pendingShare = PendingShare(id: roomID, url: url)
    }

    /// Close the share sheet. Called from the `.sheet(item:)`
    /// modifier's `onDisappear` closure once the activity controller
    /// closes (share completed OR canceled — both paths route the
    /// initiator into Waiting, mirroring the retired InitiatorScreen
    /// behavior).
    public func dismiss() {
        pendingShare = nil
    }
}
