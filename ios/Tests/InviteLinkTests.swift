// GetToIt — InviteLink unit tests (TB-02).
//
// Pure-function tests against the InviteLink module. No Supabase, no
// network — just URL round-trips. Verifies the contract documented in
// `gti-vault/60_engineering/stack-patterns.md` §"Invite flow":
// `https://gettoit.app/join/{roomId}?inviteToken={token}` with AASA
// claims `/join/*`.

import XCTest
@testable import GetToIt

final class InviteLinkTests: XCTestCase {

    // MARK: - generation

    func testGeneratedURLUsesCanonicalHostAndJoinPath() throws {
        let roomID = UUID(uuidString: "11111111-1111-1111-1111-111111111111")!
        let url = InviteLink.url(roomID: roomID, inviteToken: "abc123")
        XCTAssertEqual(url.scheme, "https")
        XCTAssertEqual(url.host, "gettoit.app")
        XCTAssertEqual(url.path, "/join/\(roomID.uuidString.lowercased())")
        XCTAssertTrue(
            url.absoluteString.hasPrefix("https://gettoit.app/join/"),
            "expected the generated URL to start with the AASA-claimed prefix, got \(url.absoluteString)"
        )
    }

    func testGeneratedURLCarriesTheInviteTokenAsAQueryItem() throws {
        let roomID = UUID()
        let url = InviteLink.url(roomID: roomID, inviteToken: "tok-42")
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let items = components?.queryItems ?? []
        XCTAssertEqual(items.count, 1)
        XCTAssertEqual(items.first?.name, "inviteToken")
        XCTAssertEqual(items.first?.value, "tok-42")
    }

    func testGeneratedURLEscapesTokensThatContainURLReservedCharacters() throws {
        let roomID = UUID()
        let url = InviteLink.url(roomID: roomID, inviteToken: "a b&c=d")
        // The query string carries the *encoded* form, but decoding it
        // through URLComponents yields the original token.
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        XCTAssertEqual(components?.queryItems?.first?.value, "a b&c=d")
    }

    // MARK: - parsing

    func testParsesAWellFormedDeepLinkIntoRoomIDAndToken() throws {
        let roomID = UUID(uuidString: "22222222-2222-2222-2222-222222222222")!
        let url = URL(string: "https://gettoit.app/join/\(roomID.uuidString.lowercased())?inviteToken=xyz")!
        let result = InviteLink.parse(url)
        XCTAssertEqual(result?.roomID, roomID)
        XCTAssertEqual(result?.inviteToken, "xyz")
    }

    func testParseRoundTripsThroughGeneratedURL() throws {
        let roomID = UUID()
        let token = "round-trip-token"
        let url = InviteLink.url(roomID: roomID, inviteToken: token)
        let result = InviteLink.parse(url)
        XCTAssertEqual(result?.roomID, roomID)
        XCTAssertEqual(result?.inviteToken, token)
    }

    func testParseAcceptsUpperOrLowerCaseRoomIDFormatting() throws {
        let roomID = UUID(uuidString: "33333333-3333-3333-3333-333333333333")!
        let upper = URL(string: "https://gettoit.app/join/\(roomID.uuidString)?inviteToken=t")!
        let lower = URL(string: "https://gettoit.app/join/\(roomID.uuidString.lowercased())?inviteToken=t")!
        XCTAssertEqual(InviteLink.parse(upper)?.roomID, roomID)
        XCTAssertEqual(InviteLink.parse(lower)?.roomID, roomID)
    }

    func testParseAllowsAMissingInviteToken() throws {
        // The token is optional in v1 — the AASA claim is on the room id
        // path. Future revisions may make the token mandatory; today a
        // missing token is parsed with an empty string so the join flow
        // can still proceed.
        let roomID = UUID()
        let url = URL(string: "https://gettoit.app/join/\(roomID.uuidString.lowercased())")!
        let result = InviteLink.parse(url)
        XCTAssertEqual(result?.roomID, roomID)
        XCTAssertEqual(result?.inviteToken, "")
    }

    func testParseRejectsTheWrongHost() {
        let roomID = UUID().uuidString.lowercased()
        let url = URL(string: "https://gettoit.example/join/\(roomID)?inviteToken=x")!
        XCTAssertNil(InviteLink.parse(url))
    }

    func testParseRejectsAnHTTPSchemeWithoutTLS() {
        let roomID = UUID().uuidString.lowercased()
        let url = URL(string: "http://gettoit.app/join/\(roomID)?inviteToken=x")!
        XCTAssertNil(InviteLink.parse(url))
    }

    func testParseRejectsANonJoinPath() {
        let roomID = UUID().uuidString.lowercased()
        let url = URL(string: "https://gettoit.app/share/\(roomID)?inviteToken=x")!
        XCTAssertNil(InviteLink.parse(url))
    }

    func testParseReturnsNilWhenTheRoomIDIsMalformed() {
        let url = URL(string: "https://gettoit.app/join/not-a-uuid?inviteToken=x")!
        XCTAssertNil(InviteLink.parse(url))
    }

    func testParseReturnsNilForALinkMissingTheRoomIDSegment() {
        let url = URL(string: "https://gettoit.app/join/?inviteToken=x")!
        XCTAssertNil(InviteLink.parse(url))
    }

    func testParseRejectsExtraPathSegmentsAfterTheRoomID() {
        // The AASA components claim `/join/*` — exactly one segment.
        // Reject anything else to keep parsing in sync with the AASA.
        let roomID = UUID().uuidString.lowercased()
        let url = URL(string: "https://gettoit.app/join/\(roomID)/extra?inviteToken=x")!
        XCTAssertNil(InviteLink.parse(url))
    }
}
