// GetToIt — SetupShareSheetState tests (bug-29).
//
// bug-29 (2026-05-25): the SetupScreen primary CTA "DROP THE INVITE
// LINK" in `.group` / `.duo` mode used to be a dead tap that minted
// Plan + Room and routed straight to Waiting with no share sheet ever
// appearing. The retired `InitiatorScreen.swift` (PR #180, commit
// 87e803a) owned the entire share-sheet wiring; the replacement
// `SetupScreen.swift` was wired without it.
//
// The fix re-ports the deleted `PendingShare` + `ShareSheet` and adds
// a small `@MainActor` observable — `SetupShareSheetState` — that owns
// the open/close state so the bug-29 "did the tap actually present
// the sheet" contract is unit-testable without standing up a SwiftUI
// host. Mirrors the bug-27 `RerollSheetState` pattern from
// `VerdictRerollHost.swift` (sibling pattern called out in the issue
// brief).
//
// The two-line contract this seam encodes:
//
//   * `present(roomID:url:)` — the wired-up primary-CTA Task closure
//     calls this once Plan + Room are minted. The state flips
//     `pendingShare` from nil to a non-nil `PendingShare` carrying the
//     Universal Link URL.
//   * `dismiss()` — the `.sheet(item:)` modifier's `onDisappear` calls
//     this. The state clears `pendingShare` back to nil so SwiftUI
//     cleanly tears down the share view. The host's `onLaunched`
//     callback also fires from `onDisappear`, mirroring the retired
//     InitiatorScreen behavior where share-completed AND share-
//     canceled both advance to Waiting.

import XCTest
@testable import GetToIt

@MainActor
final class SetupShareSheetStateTests: XCTestCase {

    // MARK: - default state

    func testDefaultsToNotPresenting() {
        // A freshly-built state holds the share sheet closed. The only
        // path that opens it is the primary-CTA Task closure calling
        // `present(roomID:url:)` after Plan + Room are minted.
        let state = SetupShareSheetState()
        XCTAssertNil(state.pendingShare,
            "state starts with the share sheet hidden (pendingShare == nil)")
    }

    // MARK: - present opens the sheet (bug-29 fix in one line)

    func testPresentFlipsTheSheetOpenWithTheCanonicalURL() {
        // The wired-up primary-CTA closure calls
        // `state.present(roomID: room.id, url: InviteLink.url(...))`
        // once Plan + Room are minted. The state's `pendingShare` flips
        // to a non-nil value carrying the canonical Universal Link
        // URL. This is the bug-29 fix in one line — before the fix the
        // closure fired `onLaunched` immediately and skipped the sheet.
        let state = SetupShareSheetState()
        let roomID = UUID()
        let token = "test-token-abc123"
        let url = InviteLink.url(roomID: roomID, inviteToken: token)

        state.present(roomID: roomID, url: url)

        guard let pending = state.pendingShare else {
            XCTFail("present() must flip pendingShare to non-nil — this is the bug-29 fix")
            return
        }
        XCTAssertEqual(pending.id, roomID,
            "PendingShare.id must carry the roomID so onDisappear routes the right session into Waiting")
        XCTAssertEqual(pending.url, url,
            "PendingShare.url must be byte-equal to the InviteLink.url(...) output per ADR 0015")
        XCTAssertEqual(pending.url.host, "gettoit.app",
            "host must be gettoit.app (AASA contract)")
        XCTAssertTrue(pending.url.path.hasPrefix("/join/"),
            "path must use /join/ prefix (AASA pattern)")
    }

    // MARK: - dismiss clears the sheet

    func testDismissClearsThePendingShare() {
        // The `.sheet(item:)` modifier's `onDisappear` closure calls
        // `state.dismiss()` so SwiftUI cleanly tears down the share
        // view after the share completes / cancels.
        let state = SetupShareSheetState()
        let roomID = UUID()
        let url = InviteLink.url(roomID: roomID, inviteToken: "tok")
        state.present(roomID: roomID, url: url)

        state.dismiss()

        XCTAssertNil(state.pendingShare,
            "dismiss() must clear pendingShare back to nil")
    }

    // MARK: - PendingShare value type contract

    func testPendingShareIsIdentifiableByRoomID() {
        // `.sheet(item:)` requires the bound item to conform to
        // Identifiable. The `id` is the roomID so two simultaneous
        // sheet presentations on the same room are coalesced (would
        // never happen in production, but the contract matters).
        let roomID = UUID()
        let url = InviteLink.url(roomID: roomID, inviteToken: "tok")
        let pending = PendingShare(id: roomID, url: url)
        XCTAssertEqual(pending.id, roomID)
        XCTAssertEqual(pending.url, url)
    }

    // MARK: - canonical URL shape (acceptance criterion)

    func testPresentBuildsTheCanonicalUniversalLinkShape() {
        // Acceptance: the share item must be byte-equal to
        // `https://gettoit.app/join/<lowercase-uuid>?inviteToken=<token>`
        // per ADR 0015 + `InviteLink.swift`. This guards the user
        // story: picking Messages / Mail / Copy / AirDrop sends the
        // URL with no app-side modification.
        let state = SetupShareSheetState()
        let roomID = UUID()
        let token = "raw-token-value-42"
        let canonical = InviteLink.url(roomID: roomID, inviteToken: token)
        state.present(roomID: roomID, url: canonical)

        guard let pending = state.pendingShare else {
            XCTFail("present must populate pendingShare")
            return
        }
        XCTAssertEqual(pending.url.absoluteString,
                       "https://gettoit.app/join/\(roomID.uuidString.lowercased())?inviteToken=\(token)",
                       "share URL must be byte-equal to InviteLink.url(...) output — that is what the share sheet ships to the user's pick")
    }

    // MARK: - dismiss-then-present cycle (re-share path)

    func testDismissThenPresentReopensTheSheetCleanly() {
        // Acceptance: in `.edit + .group` mode against a Plan that has
        // already minted a Room, tapping primary re-uses the same
        // rooms.id + invite_token and presents a share sheet with the
        // original URL — no duplicate Room is minted. The sheet host
        // must therefore tolerate a present → dismiss → present cycle
        // on the same roomID without ending up wedged.
        let state = SetupShareSheetState()
        let roomID = UUID()
        let url = InviteLink.url(roomID: roomID, inviteToken: "stable")

        state.present(roomID: roomID, url: url)
        XCTAssertNotNil(state.pendingShare)

        state.dismiss()
        XCTAssertNil(state.pendingShare)

        state.present(roomID: roomID, url: url)
        XCTAssertEqual(state.pendingShare?.url, url,
            "re-sharing the same Room must reopen the sheet with the original URL")
    }
}
