---
note: ios-integration-tests-flaky-on-shared-db
status: needs-triage
created: 2026-05-16
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# Adjacency â€” iOS integration tests flake on the shared live Supabase DB

Surfaced 2026-05-16 during the tb-14 AFK run. Flagged, not fixed â€” out of tb-14's scope (tb-14 touched no Swift code).

## The smell

The `ios` CI lane's integration tests â€” `RoomStoreIntegrationTests`, `VerdictIntegrationTests`, `VotesIntegrationTests` (10 tests) â€” run against the **live, shared** Supabase project (the `ios` lane `needs: supabase-db` and points at the prod project so it sees the latest schema). They are not hermetic: they create anonymous users and rows in the same database every CI run uses.

Observed across four back-to-back `main` runs on 2026-05-16 (the rapid tb-14 / tb-14-followup PR cadence pushed several builds within ~15 minutes):

| run | commit | `ios` result |
|---|---|---|
| 25965035716 | 0087a997 | pass |
| 25965169802 | 2539cee0 | fail (10 integration tests) |
| 25965268922 | 4a792f97 | fail â†’ **pass on re-run** |

Same commit, same code, different result on re-run = a flake, not a regression. The failures are all RLS / row-state assertions (`testRLSHidesARoomFromANonMember`, `testFullQuizHappyPathAndIdempotentResubmit`, etc.) â€” exactly what you'd expect when concurrent CI runs collide on shared DB state or hit the anonymous-signup rate limit.

## Why it is not tb-14

tb-14 added the `edge-deploy` CI lane (`supabase functions deploy` + `supabase secrets set`). That lane touches no DB tables and no RLS policies, and tb-14 changed zero Swift. The `ios` flake is pre-existing â€” it was simply *exposed* by running several CI builds in quick succession against one shared project.

## Open question / next step

Triage as a CI-hardening bug. Options:

1. **Isolate test data per run** â€” namespace every row the integration tests create with the `$GITHUB_RUN_ID`, and tear down in `tearDown`. Removes cross-run collisions.
2. **Serialize the `ios` lane** â€” a `concurrency` group keyed to the project so only one `ios` job hits the live DB at a time. Cheaper, but slower CI.
3. **Local Supabase for integration tests** â€” `supabase start` in the lane (Docker) so each run gets a fresh DB. Heaviest change; most correct.

Until then, a failed `ios` lane on `main` should be re-run once before being treated as a real break.
