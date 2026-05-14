// GetToIt — InviteLink (TB-02).
//
// Pure functions on `URLComponents`. The contract:
//
//   * Canonical shape:
//       https://gettoit.app/join/{roomId}?inviteToken={token}
//
//   * Host: `gettoit.app` only. Other hosts are not valid Universal
//     Links for this app (the AASA file claims `gettoit.app` exclusively).
//
//   * Scheme: `https` only. Universal Links never resolve over HTTP.
//
//   * Path: `/join/{roomId}` — matches the AASA `components` array's
//     `/join/*` glob.
//
//   * `inviteToken` is optional in v1. Future tracer bullets may make
//     it required; today the parser tolerates a missing token so a
//     malformed share doesn't crash the join surface.
//
// References:
//   * `gti-vault/60_engineering/stack-patterns.md` §"Invite flow"
//   * `web/public/.well-known/apple-app-site-association`
//   * AASA Team ID `WXTMNYM34A` + Bundle ID `app.gettoit.GetToIt`

import Foundation

public enum InviteLink {

    /// The host the AASA claims. All other hosts are rejected.
    public static let host = "gettoit.app"

    /// The path prefix the AASA's `components` array claims.
    public static let pathPrefix = "/join/"

    /// A parsed invite link.
    public struct Payload: Equatable, Sendable {
        public let roomID: UUID
        public let inviteToken: String

        public init(roomID: UUID, inviteToken: String) {
            self.roomID = roomID
            self.inviteToken = inviteToken
        }
    }

    /// Build the canonical Universal Link for a room.
    ///
    /// The roomId path component is lowercase so the AASA pattern
    /// matches consistently and so two devices generating the same
    /// link agree on byte-for-byte equality.
    public static func url(roomID: UUID, inviteToken: String) -> URL {
        var components = URLComponents()
        components.scheme = "https"
        components.host = host
        components.path = pathPrefix + roomID.uuidString.lowercased()
        components.queryItems = [URLQueryItem(name: "inviteToken", value: inviteToken)]
        guard let url = components.url else {
            // URLComponents only fails to materialize a URL when the
            // pieces produce an invalid string. With a UUID in the path
            // and a fixed host/scheme that can't happen, so a precondition
            // here is safer than returning an optional callers must unwrap.
            preconditionFailure("InviteLink.url failed to materialize a URL from a well-formed UUID")
        }
        return url
    }

    /// Parse an incoming Universal Link into a (roomID, inviteToken)
    /// pair. Returns nil for any link that doesn't match the canonical
    /// shape — wrong scheme, wrong host, wrong path prefix, or a
    /// malformed UUID.
    public static func parse(_ url: URL) -> Payload? {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }
        guard components.scheme?.lowercased() == "https" else { return nil }
        guard components.host?.lowercased() == host else { return nil }

        let path = components.path
        guard path.hasPrefix(pathPrefix) else { return nil }
        let tail = String(path.dropFirst(pathPrefix.count))
        // The next segment is the room id. The AASA glob `/join/*` matches
        // exactly one path segment, so reject extras (or a trailing
        // slash) to keep our parsing in sync with the AASA contract.
        let segments = tail.split(separator: "/", omittingEmptySubsequences: false)
        guard segments.count == 1, let first = segments.first, !first.isEmpty else { return nil }
        guard let roomID = UUID(uuidString: String(first)) else { return nil }

        // Token is optional. URLComponents.queryItems returns nil for
        // an absent query string; a present-but-empty token resolves
        // to "" which is the same shape we return for a missing one.
        let token = components.queryItems?.first(where: { $0.name == "inviteToken" })?.value ?? ""

        return Payload(roomID: roomID, inviteToken: token)
    }
}
