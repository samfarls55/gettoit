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
            authPromptDismissedAt: Self.iso8601.string(from: now)
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
        return Self.iso8601.date(from: raw)
    }

    // MARK: - wire types

    /// ISO-8601 with fractional seconds — what Postgres `timestamptz`
    /// values render as via PostgREST's default JSON shape.
    private static let iso8601: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

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
