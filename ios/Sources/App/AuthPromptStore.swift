// GetToIt — AuthPromptStore (TB-12).
//
// Reads + writes the per-user `auth_prompt_dismissed_at` timestamp
// that drives the 30-day suppression on the S04 auth-upgrade chip.
//
// Schema lives in `supabase/migrations/20260513213000000_user_preferences.sql`.
// RLS guarantees a user can only ever read / upsert their own row, so
// the iOS client doesn't filter explicitly — it sets `user_id` on the
// payload and Postgres rejects anything else.
//
// API surface is intentionally narrow:
//   * `shouldRenderAuthChip(for:now:)` — returns true iff the chip
//     should render. Encapsulates the 30-day rule so the view layer
//     stays declarative.
//   * `recordDismissal(for:now:)` — upserts the dismissal stamp.
//
// The render gate consults this store AND the auth state. The chip
// only renders when (a) user is anonymous (per AuthCoordinator) AND
// (b) the store says render-OK. Already-linked users skip the store
// query entirely.

import Foundation
import Supabase

@MainActor
public final class AuthPromptStore {

    /// 30 days. Lifted to a `static let` so the value is observable
    /// from tests + documented in one place. The PRD locks the
    /// re-prompt cadence at 30 days; any change here is a spec-level
    /// decision (ADR 0007 trigger §"acceptance rate below 20%").
    public static let suppressionWindow: TimeInterval = 30 * 24 * 60 * 60

    private let client: SupabaseClient

    public init(client: SupabaseClient) {
        self.client = client
    }

    /// Determine whether the S04 auth-upgrade chip should render for
    /// the given user. Returns `true` when no dismissal row exists
    /// OR when the existing dismissal is older than the 30-day
    /// suppression window. `now` is injected so tests can pin the
    /// clock without freezing the system date.
    public func shouldRenderAuthChip(for userID: UUID, now: Date = .now) async throws -> Bool {
        guard let dismissedAt = try await fetchDismissalDate(for: userID) else {
            return true
        }
        return now.timeIntervalSince(dismissedAt) >= Self.suppressionWindow
    }

    /// Persist the dismissal stamp. Idempotent on (user_id) — the
    /// upsert simply overwrites `auth_prompt_dismissed_at` so the
    /// 30-day clock restarts from the latest tap.
    public func recordDismissal(for userID: UUID, now: Date = .now) async throws {
        let payload = DismissUpsert(
            userID: userID,
            authPromptDismissedAt: Self.formatForPostgrest(now)
        )
        try await client
            .from("user_preferences")
            .upsert(payload, onConflict: "user_id")
            .execute()
    }

    /// Read the existing dismissal stamp. Returns nil when no row
    /// exists for this user (the canonical "never dismissed" state).
    /// Public so the chip's render gate + tests can both consult it.
    public func fetchDismissalDate(for userID: UUID) async throws -> Date? {
        let rows: [DismissRow] = try await client
            .from("user_preferences")
            .select("auth_prompt_dismissed_at")
            .eq("user_id", value: userID.uuidString.lowercased())
            .limit(1)
            .execute()
            .value

        guard let raw = rows.first?.authPromptDismissedAt else {
            return nil
        }
        return Self.parsePostgrestTimestamp(raw)
    }

    // MARK: - wire types

    /// Parse a `timestamptz` as PostgREST emits it. PostgREST renders
    /// Postgres `timestamptz` values in one of these shapes depending
    /// on whether sub-second precision is present:
    ///
    ///   * `2026-05-15T17:46:40+00:00`            (whole seconds)
    ///   * `2026-05-15T17:46:40.123+00:00`        (milliseconds)
    ///   * `2026-05-15T17:46:40.123456+00:00`     (microseconds — pg
    ///                                             default for now())
    ///
    /// `ISO8601DateFormatter` with `withFractionalSeconds` rejects the
    /// no-fraction form and only handles up to milliseconds (3 digits).
    /// Try the fractional formatter first, fall back to the plain one,
    /// and finally hand-truncate any microsecond tail before retrying.
    /// Returns nil for genuinely malformed input.
    static func parsePostgrestTimestamp(_ raw: String) -> Date? {
        if let d = Self.iso8601Fractional.date(from: raw) { return d }
        if let d = Self.iso8601Plain.date(from: raw) { return d }
        // Trim microseconds (6 digits) down to milliseconds (3 digits)
        // so the fractional formatter accepts the string. PostgREST's
        // default emits 6-digit fractional seconds; ISO8601DateFormatter
        // tops out at 3.
        if let truncated = Self.truncatedToMilliseconds(raw),
           let d = Self.iso8601Fractional.date(from: truncated) {
            return d
        }
        return nil
    }

    /// Drop digits past the third fractional-second digit so an
    /// `ISO8601DateFormatter` with `.withFractionalSeconds` can parse
    /// the result. Returns nil if the input has no fractional part
    /// (caller will have already tried the plain formatter).
    private static func truncatedToMilliseconds(_ raw: String) -> String? {
        guard let dotIdx = raw.firstIndex(of: ".") else { return nil }
        let afterDot = raw.index(after: dotIdx)
        // Find where the digits end (timezone offset or 'Z' starts).
        var endOfDigits = afterDot
        while endOfDigits < raw.endIndex, raw[endOfDigits].isNumber {
            endOfDigits = raw.index(after: endOfDigits)
        }
        let digitCount = raw.distance(from: afterDot, to: endOfDigits)
        guard digitCount > 3 else { return nil }
        let keepUpTo = raw.index(afterDot, offsetBy: 3)
        return String(raw[..<keepUpTo]) + String(raw[endOfDigits...])
    }

    /// ISO-8601 with fractional seconds. Used for writes (we emit
    /// `.000` millisecond precision) and for reads when PostgREST
    /// returns a millisecond-precision timestamp.
    private static let iso8601Fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// ISO-8601 without fractional seconds. PostgREST emits this shape
    /// when the stored `timestamptz` has whole-second precision (which
    /// is what we get back when we send `.000` and Postgres rounds it
    /// to the column's effective precision).
    private static let iso8601Plain: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    /// Format a Date for writing to `timestamptz`. Millisecond precision
    /// is plenty for the 30-day suppression window.
    static func formatForPostgrest(_ date: Date) -> String {
        Self.iso8601Fractional.string(from: date)
    }

    private struct DismissUpsert: Encodable {
        let userID: UUID
        let authPromptDismissedAt: String

        enum CodingKeys: String, CodingKey {
            case userID = "user_id"
            case authPromptDismissedAt = "auth_prompt_dismissed_at"
        }
    }

    private struct DismissRow: Decodable {
        let authPromptDismissedAt: String?

        enum CodingKeys: String, CodingKey {
            case authPromptDismissedAt = "auth_prompt_dismissed_at"
        }
    }
}
