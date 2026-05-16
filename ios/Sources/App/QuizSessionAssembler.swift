// GetToIt - QuizSessionAssembler (bug-03 v1.1).
//
// Pulls the "fetch places, shape into candidates, build QuizCoordinator"
// logic out of `RootView.startQuiz` so the boundary assertion in
// QuizSessionAssemblerTests can drive the real wire-up without standing
// up the full SwiftUI host. The assembler is the single seam where
// `PlacesService.fetchPlaces` fires for a session - if a future
// regression removes the wire-up here, the boundary test fails loudly
// (zero recorded proxy invocations).
//
// Inputs are protocol-typed so tests can inject doubles for
// PlacesService and the room/location resolution step. RootView is the
// only production caller.

import Foundation
import CoreLocation

@MainActor
public enum QuizSessionAssembler {
    /// Result of assembling a session's QuizCoordinator. Carries the
    /// coordinator plus a note on where the Q5 candidates came from
    /// (Foursquare, MapKit fallback, or the dummy fixture). Callers
    /// can ignore `loadedSource`; the boundary test inspects it.
    public struct Assembled {
        public let coordinator: QuizCoordinator
        public let loadedSource: Q5CandidatesLoader.Source

        public init(coordinator: QuizCoordinator, loadedSource: Q5CandidatesLoader.Source) {
            self.coordinator = coordinator
            self.loadedSource = loadedSource
        }
    }

    /// Build a `QuizCoordinator` for a session, firing the
    /// `PlacesService.fetchPlaces` boundary call so Q5 renders real
    /// candidates. `coordinate` and `radiusMeters` come from the
    /// caller's location-resolution step (RootView pulls from the
    /// shared LocationCoordinator, hydrating from `rooms.location_*`
    /// on the joiner path). When `coordinate` is nil the assembler
    /// short-circuits to the dummy fixture - Q5 still renders three
    /// rows so the user isn't stranded mid-flow.
    public static func assembleCoordinator(
        roomID: UUID,
        userID: UUID,
        coordinate: CLLocationCoordinate2D?,
        radiusMeters: Int,
        sessionParameters: SessionParameters = .default,
        places: PlacesService,
        writer: @escaping QuizVoteWriter
    ) async -> Assembled {
        let loaded: Q5CandidatesLoader.Loaded
        if let coordinate {
            let loader = Q5CandidatesLoader(places: places)
            loaded = await loader.load(near: coordinate, radiusMeters: radiusMeters)
        } else {
            loaded = Q5CandidatesLoader.Loaded(
                candidates: QuizDummyCandidates.all,
                source: .fallbackDummy
            )
        }
        // TB-05 (v1.1) — the session parameters are carried onto the
        // coordinator so every member's quiz (initiator or joiner)
        // runs against the same initiator-set bucket.
        let coordinator = QuizCoordinator(
            roomID: roomID,
            userID: userID,
            candidates: loaded.candidates,
            sessionParameters: sessionParameters,
            writer: writer
        )
        return Assembled(coordinator: coordinator, loadedSource: loaded.source)
    }
}
