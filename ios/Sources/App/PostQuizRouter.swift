// GetToIt — Post-Q5 routing idempotency (bug-12).
//
// `RootView.enterPostQuiz` builds a `PostQuizHost` and assigns it to
// `postQuizHost` on a successful Q5 submit. The defect bug-12 fixes: a
// single successful submit delivers `onSubmitted` TWICE — once from the
// Q5 CTA path (`submitFromQ5`) and once from the `.submitted` step's
// `Color.clear` `.task`. Each call built and assigned a fresh host.
// SwiftUI keeps `PostQuizHostScreen`'s view identity across the swap, so
// the replacement host's `.task` never re-runs and it is never polled.
// The verdict resolves on the orphaned first host while the screen
// renders the second — spinner forever.
//
// This pure helper is the idempotency guard. `enterPostQuiz` consults it
// before touching `postQuizHost`: a duplicate entry for the room already
// held is a no-op; a genuinely new room (a fresh decision in the same
// app launch) still routes.
//
// Why a separate pure helper (mirrors `SoloPath`): `RootView` has no
// test seam — it is ~700 lines of SwiftUI routing state and
// `enterPostQuiz` is private. Extracting the decision keeps the
// load-bearing rule deterministically testable without standing up a
// SwiftUI host or driving the `.task` double-fire.

import Foundation

/// Pure routing-idempotency helper for the post-Q5 transition.
public enum PostQuizRouter {

    /// Whether `RootView.enterPostQuiz` should build and assign a new
    /// `PostQuizHost`.
    ///
    /// - Parameters:
    ///   - currentRoomID: The room of the host currently held in
    ///     `postQuizHost`, or `nil` when no post-Q5 host exists yet.
    ///   - incomingRoomID: The room of the just-submitted quiz the
    ///     `onSubmitted` callback is routing.
    /// - Returns: `true` when a host should be built — no host is held,
    ///   or the held host is for a different room (a genuinely new
    ///   decision). `false` when the held host is already for this room:
    ///   the call is a duplicate `onSubmitted` and replacing the live,
    ///   polling host would orphan it.
    public static func shouldEnterPostQuiz(
        currentRoomID: UUID?,
        incomingRoomID: UUID
    ) -> Bool {
        return currentRoomID != incomingRoomID
    }
}
