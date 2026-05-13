// GetToIt — Anonymous auth integration test.
//
// Hits the real Supabase project configured in the app bundle's
// Info.plist (SUPABASE_PROJECT_URL + SUPABASE_ANON_KEY, set from
// GitHub secrets in CI). Skips itself when those values are absent
// so design-system-only PRs aren't blocked.
//
// Acceptance: a fresh anon sign-in returns a session whose `user.id`
// is a UUID and whose `access_token` decodes to claims containing
// `role = authenticated` and `is_anonymous = true`.

import XCTest
import Supabase
@testable import GetToIt

final class AnonAuthIntegrationTests: XCTestCase {

    func testAnonymousSignInReturnsAuthenticatedUserWithExpectedJWTClaims() async throws {
        // Mirror the app's Info.plist lookup so the integration test
        // observes the same configuration path the app uses at launch.
        let bundle = Bundle(for: type(of: self))
        // Tests run inside an .xctest bundle; the Info.plist keys are
        // injected into the host app bundle, so fall back to the app's
        // main bundle when the test bundle doesn't carry them.
        let config = SupabaseConfig.fromBundle(bundle)
            ?? SupabaseConfig.fromBundle(.main)
        guard let config else {
            throw XCTSkip("SUPABASE_PROJECT_URL / SUPABASE_ANON_KEY not configured for this build; skipping integration test.")
        }

        let client = SupabaseClient(supabaseURL: config.url, supabaseKey: config.anonKey)
        // Sign out any cached session so the test is order-independent.
        try? await client.auth.signOut()

        let session = try await client.auth.signInAnonymously()

        // 1. Session carries a UUID user id.
        XCTAssertNotNil(UUID(uuidString: session.user.id.uuidString),
                        "expected session.user.id to be a UUID, got \(session.user.id)")

        // 2. Access-token JWT claims include role + is_anonymous.
        let claims = try Self.decodeJWTClaims(session.accessToken)
        XCTAssertEqual(claims["role"] as? String, "authenticated",
                       "expected role=authenticated in JWT, got \(String(describing: claims["role"]))")
        XCTAssertEqual(claims["is_anonymous"] as? Bool, true,
                       "expected is_anonymous=true in JWT, got \(String(describing: claims["is_anonymous"]))")

        // Clean up so the test project doesn't accumulate orphan rows.
        try? await client.auth.signOut()
    }

    // MARK: - helpers

    private static func decodeJWTClaims(_ jwt: String) throws -> [String: Any] {
        let parts = jwt.split(separator: ".")
        guard parts.count == 3 else {
            throw NSError(domain: "AnonAuthIntegrationTests", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "JWT must have 3 segments"])
        }
        let payload = String(parts[1])
        guard let data = Self.base64URLDecode(payload) else {
            throw NSError(domain: "AnonAuthIntegrationTests", code: 2,
                          userInfo: [NSLocalizedDescriptionKey: "JWT payload is not base64url"])
        }
        let json = try JSONSerialization.jsonObject(with: data, options: [])
        guard let dict = json as? [String: Any] else {
            throw NSError(domain: "AnonAuthIntegrationTests", code: 3,
                          userInfo: [NSLocalizedDescriptionKey: "JWT payload is not a JSON object"])
        }
        return dict
    }

    private static func base64URLDecode(_ s: String) -> Data? {
        var t = s.replacingOccurrences(of: "-", with: "+")
                 .replacingOccurrences(of: "_", with: "/")
        // pad to a multiple of 4
        let pad = 4 - (t.count % 4)
        if pad < 4 { t.append(String(repeating: "=", count: pad)) }
        return Data(base64Encoded: t)
    }
}
