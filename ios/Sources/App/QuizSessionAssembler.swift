// GetToIt - QuizSessionAssembler (bug-03 v1.1, rewired TB-15 v1.1).
//
// Pulls the "build the QuizCoordinator for a session" logic out of
// `RootView.startQuiz` so the boundary tests can drive the real
// wire-up without standing up the full SwiftUI host.
//
// TB-15 (v1.1) — the assembler no longer fetches candidates. Before
// TB-15 it ran the bug-03 tracer-bullet bridge: it called
// `Q5CandidatesLoader.load` (one `PlacesService.fetchPlaces` with an
// empty `PlacesFilters()`) here, BEFORE the member answered anything,
// and handed the truncated result to the coordinator's init. That
// pre-quiz, empty-filter fetch is gone. The assembler now builds the
// coordinator with a `FoursquareQuizCandidateFetch` — the real tb-07
// per-member fetch — and the coordinator's step machine fires the
// answer-tailored N+1 calls when the member completes Q4. No
// PlacesProxy / Foursquare call fires before Q1-Q4 are answered.
//
// When `coordinate` is nil (a stale routing where the room row
// vanished) the assembler builds the coordinator with a
// `DummyQuizCandidateFetch` so Q5 still renders three rateable rows -
// the member is never stranded mid-flow.
//
// Inputs are protocol-typed so tests can inject doubles for
// PlacesService and the room/location resolution step. RootView is the
// only production caller.

import Foundation
import CoreLocation

@MainActor
public enum QuizSessionAssembler {
    /// Result of assembling a session's QuizCoordinator. Carries the
    /// coordinator plus a note on whether the session has a coordinate
    /// to run the per-member fetch against. Callers can ignore
    /// `candidateSource`; the boundary test inspects it.
    public struct Assembled {
        public let coordinator: QuizCoordinator
        public let candidateSource: CandidateSource

        public init(coordinator: QuizCoordinator, candidateSource: CandidateSource) {
            self.coordinator = coordinator
            self.candidateSource = candidateSource
        }
    }

    /// Where the assembled coordinator's Q5 candidates will come from.
    public enum CandidateSource: Equatable, Sendable {
        /// A session coordinate is present — the coordinator carries a
        /// live `FoursquareQuizCandidateFetch` and the per-member fetch
        /// fires when the member completes Q4.
        case perMemberFetch
        /// No session coordinate — the coordinator carries a
        /// dummy-fixture fetch so Q5 still renders three rows.
        case fallbackDummy
    }

    /// Build a `QuizCoordinator` for a session.
    ///
    /// TB-15: the assembler does NOT call `PlacesService` here. It wires
    /// a `FoursquareQuizCandidateFetch` onto the coordinator; the
    /// coordinator's step machine fires the per-member fetch on the
    /// Q4 -> Q5 transition with the member's real Q1-Q4 answers.
    ///
    /// `coordinate` and `radiusMeters` come from the caller's
    /// location-resolution step (RootView pulls from the shared
    /// LocationCoordinator, hydrating from `rooms.location_*` on the
    /// joiner path). When `coordinate` is nil the assembler wires a
    /// dummy-fixture fetch so Q5 still renders three rows.
    /// TB-21 (v1.1) — `memberFetchWriter` persists each member's full
    /// raw Foursquare fetch into the server-readable `member_fetches`
    /// table when the per-member fetch resolves. The `compute-verdict`
    /// Edge Function unions every member's persisted fetch into
    /// `options` at verdict fire time. Optional — when nil (or when the
    /// session has no coordinate, so there is no live fetch) the
    /// coordinator simply skips the persistence step.
    public static func assembleCoordinator(
        roomID: UUID,
        userID: UUID,
        coordinate: CLLocationCoordinate2D?,
        radiusMeters: Int,
        timeZone: TimeZone = .current,
        sessionParameters: SessionParameters = .default,
        places: PlacesService,
        memberFetchWriter: MemberFetchWriter? = nil,
        writer: @escaping QuizVoteWriter
    ) -> Assembled {
        let candidateFetch: QuizCandidateFetch
        let candidateSource: CandidateSource
        if let coordinate {
            // The live per-member fetch — the real tb-07 executor. The
            // coordinator fires it on the Q4 -> Q5 transition.
            candidateFetch = FoursquareQuizCandidateFetch(
                executor: FoursquareFetchExecutor(places: places),
                coordinate: coordinate,
                radiusMeters: Double(radiusMeters),
                timeZone: timeZone
            )
            candidateSource = .perMemberFetch
        } else {
            // No coordinate (stale routing) — Q5 still needs three rows.
            candidateFetch = DummyQuizCandidateFetch()
            candidateSource = .fallbackDummy
        }
        // TB-05 (v1.1) — the session parameters are carried onto the
        // coordinator so every member's quiz (initiator or joiner)
        // runs against the same initiator-set bucket.
        let coordinator = QuizCoordinator(
            roomID: roomID,
            userID: userID,
            candidateFetch: candidateFetch,
            // TB-21 — the writer that persists the member's raw fetch
            // into `member_fetches`. Carried through so the per-member
            // fetch result flows to the server-side `options` union.
            memberFetchWriter: memberFetchWriter,
            sessionParameters: sessionParameters,
            writer: writer
        )
        return Assembled(coordinator: coordinator, candidateSource: candidateSource)
    }
}
