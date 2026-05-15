---
issue: bug-03
title: Q5 (Regret?) shows placeholder options — diagnose why PlacesService never calls Foursquare
github_issue: 43
status: ready-for-human
type: AFK
created: 2026-05-14
prd: v1-prd
---

# bug-03 — Q5 placeholder, no Foursquare calls

## Parent

[[../_index|v1.1 backlog]] candidate #3.

## What's broken

Q5 ("Regret?") in the quiz flow renders placeholder / generic option strings instead of real candidate restaurants from `PlacesService` (Foursquare). Final-question fidelity is broken — verdict ends up keyed on hardcoded sample data, not real places.

**Key diagnostic clue:** the Foursquare API dashboard logs show **zero API calls** during a complete quiz pass. The data layer is not just returning wrong data — it is never being asked.

## Why HITL — diagnose first

Two flavors of root cause and they want different fixes:

1. **Stub never replaced.** Q5 was scaffolded with hardcoded sample options during tracer-bullet work, real wiring deferred, and nobody re-connected it to `PlacesService`. Small fix.
2. **Wiring exists but breaks upstream.** A guard short-circuits before `PlacesService.fetch()` fires — location permission denied / not yet granted, `PlacesService` not instantiated for the quiz code path, feature flag off, race between session start and places fetch.

The zero-calls observation strengthens (1) or a degenerate (2). Run `diagnose` skill before writing a fix. After diagnosis the fix is likely AFK and can be re-triaged.

## Diagnosis pointers

Start trace at `ios/Sources/App/` and walk up from the Q5 view-model toward `PlacesService.fetch()`. Key files to inspect:

- `VerdictEngine` (whatever module owns the quiz state machine) — does the Q5-options getter consult `PlacesService` results at all, or is it returning a hardcoded list?
- `PlacesService` / `MapKitPlacesFallback` — is `fetch()` reachable from the Q5 code path? Is the call site behind any feature flag, permission check, or async-race condition?
- Session initialization — when in the session lifecycle is `PlacesService.fetch()` supposed to fire? Compare to when Q5 actually renders.

## Fix scope (post-diagnose)

Wire `PlacesService` output into the Q5 options view-model. Concrete shape depends on diagnosis; do not pre-commit.

## Acceptance criteria

- [ ] Foursquare API dashboard shows a non-zero call count during a session that reaches Q5. *(founder check post-deploy)*
- [x] Q5 renders option strings sourced from `PlacesService` results filtered by prior answers — no hardcoded sample strings.
- [x] **Unit test** on the Q5 view-model: feed canned `PlacesService` output, assert rendered options match the canned data; placeholder strings absent. *(`ios/Tests/Q5CandidatesLoaderTests.swift`)*
- [x] **Boundary assertion** in a session-level integration test: `PlacesService.fetch()` is invoked at least once during a session that reaches the quiz. (Silent no-call is the exact failure mode here; this test would have caught it.) *(`ios/Tests/QuizSessionAssemblerTests.swift`)*
- [ ] Manual TestFlight smoke check: complete a session on real device, confirm Q5 lists real nearby restaurants. *(founder manual step)*

## Blocked by

None — can start immediately.

## Adjacencies

- The same code path also surfaces results to the verdict engine. If Q5 was unwired, the verdict may also be using placeholder data. Confirm during diagnosis whether the verdict surface is affected; if yes, expand fix scope or file a follow-on.

## Resolution (2026-05-14)

**Diagnosis:** root cause was option (1) — stub never replaced. `PlacesService` had zero production call sites; `QuizCoordinator` was always constructed with the hardcoded `QuizDummyCandidates.all` fixture. The Foursquare API was never called because no code path called `fetchPlaces`.

**Call-graph trace (pre-fix):**
- `RootView.startQuiz` → `QuizCoordinator(roomID:, userID:, writer:)` (no `candidates:` arg, defaulted to dummy fixture)
- `QuizCoordinator.allCandidates` → `QuizDummyCandidates.all`
- `QuizQ5Regret.body` → iterates `coordinator.allCandidates` → renders three hardcoded placeholder rows.
- `PlacesService.fetchPlaces` was never on the path.

**Fix shape:**
- New `Q5CandidatesLoader` (Swift): wraps `PlacesService.fetchPlaces`, shapes `[ShapedPlace]` → `[QuizCandidate]` (truncated to 3, meta `Category - $$ - N min`), falls back to dummy fixture if both proxy + MapKit return empty.
- New `QuizSessionAssembler.assembleCoordinator`: the static seam that fires the loader and constructs the `QuizCoordinator` with the resulting candidates. Pulled out of `RootView.startQuiz` so the boundary assertion can test the real wire-up without mounting the SwiftUI host.
- `RootView.startQuiz` now: resolves the session's location (initiator via `LocationCoordinator.place`, joiner hydrated from `rooms.location_*`) → builds the `PlacesService` graph → awaits `QuizSessionAssembler` → routes to `QuizScreen`.

**Location source:** single — `LocationCoordinator.place`. Joiner path hydrates the coordinator with `commit(place:)` from the room's `location_*` columns before fetch, so both initiator and joiner consult the same coordinator. No dual-path on location.

**Tests:**
- `ios/Tests/Q5CandidatesLoaderTests.swift` — feeds canned PlacesService output through the loader, asserts the rendered `[QuizCandidate]` matches; asserts placeholder fixture names never leak.
- `ios/Tests/QuizSessionAssemblerTests.swift` — the boundary assertion. A recording `PlacesProxyClient` records every call to `search`; the test asserts `observed.count >= 1` for the happy path (would fail loudly on a revert of the wire-up) and asserts the assembler forwards the coordinate / radius intact.
