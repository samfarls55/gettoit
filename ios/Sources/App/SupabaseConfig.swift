// GetToIt — Supabase configuration.
//
// Reads SUPABASE_PROJECT_URL + SUPABASE_ANON_KEY from the app bundle's
// Info.plist. The values are injected at build time via Xcode build
// settings (sourced from `gh secret` / GitHub Actions in CI). Local
// builds source them from `.env` via the wrapper script in
// `ios/scripts/inject-supabase-config.sh`.

import Foundation

public struct SupabaseConfig: Sendable {
    public let url: URL
    public let anonKey: String

    /// Read configuration from the main bundle. Returns nil if either
    /// key is missing or empty so callers can decide how to surface the
    /// configuration failure (the app shows a "not configured" message;
    /// integration tests skip themselves).
    public static func fromBundle(_ bundle: Bundle = .main) -> SupabaseConfig? {
        guard
            let rawURL = bundle.object(forInfoDictionaryKey: "SUPABASE_PROJECT_URL") as? String,
            !rawURL.isEmpty,
            let url = URL(string: rawURL),
            let anonKey = bundle.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
            !anonKey.isEmpty
        else {
            return nil
        }
        return SupabaseConfig(url: url, anonKey: anonKey)
    }
}
