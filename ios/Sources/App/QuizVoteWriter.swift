// GetToIt — QuizVoteWriter (TB-04).
//
// Bridges the `QuizCoordinator.VoteRow` shape onto the live Supabase
// client. Lives in a separate file so unit tests can construct the
// coordinator with a synthetic in-memory writer (no Supabase imports
// needed in test).
//
// The wire call is a single insert. RLS gates the row to
// `auth.uid() = user_id`; the unique constraint on (room_id, user_id)
// surfaces idempotent retries as SQLSTATE 23505.

import Foundation
import Supabase

@MainActor
public enum QuizSupabaseWriter {
    /// Build a `QuizVoteWriter` closure that inserts the row through
    /// the supplied client. The closure is `@Sendable` so it can
    /// cross actor boundaries inside `QuizCoordinator.submit()`.
    public static func make(client: SupabaseClient) -> QuizVoteWriter {
        return { row in
            try await client
                .from("votes")
                .insert(row)
                .execute()
        }
    }
}
