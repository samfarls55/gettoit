---
issue: bug-03
title: Q5 (Regret?) shows placeholder options — diagnose why PlacesService never calls Foursquare
github_issue: 43
status: ready-for-agent
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

- [ ] Foursquare API dashboard shows a non-zero call count during a session that reaches Q5.
- [ ] Q5 renders option strings sourced from `PlacesService` results filtered by prior answers — no hardcoded sample strings.
- [ ] **Unit test** on the Q5 view-model: feed canned `PlacesService` output, assert rendered options match the canned data; placeholder strings absent.
- [ ] **Boundary assertion** in a session-level integration test: `PlacesService.fetch()` is invoked at least once during a session that reaches the quiz. (Silent no-call is the exact failure mode here; this test would have caught it.)
- [ ] Manual TestFlight smoke check: complete a session on real device, confirm Q5 lists real nearby restaurants.

## Blocked by

None — can start immediately.

## Adjacencies

- The same code path also surfaces results to the verdict engine. If Q5 was unwired, the verdict may also be using placeholder data. Confirm during diagnosis whether the verdict surface is affected; if yes, expand fix scope or file a follow-on.
