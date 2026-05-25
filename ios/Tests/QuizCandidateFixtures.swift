// GetToIt — QuizCandidateFixtures (TB-26 quiz redesign).
//
// Test-target Q5 candidate fixture. Lives in `Tests/`, NOT in the app
// target, so the shipped app binary contains zero hardcoded fictitious
// venues (TB-26 acceptance criterion).
//
// Before TB-26 the app target shipped `QuizDummyCandidates` — three
// hardcoded fictitious restaurants the live quiz rendered on Q5 when
// the per-member fetch produced no factorial-usable pool. That was a
// tb-04-era build scaffold. TB-26 removes it: the app must never
// surface a made-up place to a user. The Q5 no-results screen
// (sg-05's `no-results` mode) is rendered instead.
//
// The unit / snapshot tests still need a small candidate list to drive
// the legacy explicit-`candidates:` `QuizCoordinator` init and to
// exercise `setRegret` / the Q5 vote-row build. That fixture moved
// here, into the test target — it is fictitious test data and never
// reaches a production code path.

import Foundation
@testable import GetToIt

/// Three test-only Q5 candidates. Names are obviously synthetic so a
/// stray leak into a shipped surface would be caught in review; they
/// exist only to drive the coordinator's legacy `candidates:` init in
/// tests. Production never references this type.
enum QuizCandidateFixtures {
    static let all: [QuizCandidate] = [
        QuizCandidate(id: "fixture-1", name: "Test Spot One",   meta: "Mexican · $$ · 8 min"),
        QuizCandidate(id: "fixture-2", name: "Test Spot Two",   meta: "Japanese · $$ · 12 min"),
        QuizCandidate(id: "fixture-3", name: "Test Spot Three", meta: "Italian · $$ · 5 min"),
    ]
}
