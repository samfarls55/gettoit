---
issue: bug-14
title: iOS fires the verdict before the member's candidate fetch is persisted
status: ready-for-agent
type: AFK
github_issue: 144
created: 2026-05-19
prd: v1.1-quiz-redesign-prd
---

# bug-14 — iOS fires the verdict before the member's candidate fetch is persisted

## Parent

[[../_index|v1.1 backlog]] — found during the 2026-05-19 verdict-spinner diagnosis. The iOS-side cause of the empty candidate pools that [[bug-13-engine-no-survivor-on-empty-pool|bug-13]] resolves on the server side.

## What's broken

A member completes Q5 and fires the verdict while that member's raw Foursquare fetch has not yet been persisted to `member_fetches`. The server-side `options` union then assembles an empty (or partial) candidate pool — not because the member genuinely had no candidates, but because the write had not landed yet. The verdict fires against a pool that does not reflect the member.

## Root cause

Three compounding defects in the iOS quiz submit path (`QuizCoordinator`):

1. **The fire-before-persist race.** The per-member Foursquare fetch runs as a background task. `submit()` builds and writes the `votes` row — which triggers the verdict fire — **without awaiting that fetch/persist task**. If the fetch has not finished, the verdict fires before this member's `member_fetches` row exists.
2. **`persistRawFetch` skips the write on an empty `rawFetch`.** An empty raw fetch is guarded out entirely, so no `member_fetches` row is written at all — indistinguishable downstream from "the write never ran."
3. **Errors are silently swallowed.** A failed `member_fetches` write is caught and dropped, so a failed or slow persist is invisible — no telemetry, no retry, no signal.

## Desired behavior

A member's verdict never fires against an unpersisted fetch. `submit()` awaits the member's candidate fetch and its `member_fetches` persist before firing the verdict. `persistRawFetch` surfaces write failures (telemetry / propagation) instead of swallowing them. A genuinely empty fetch is recorded as such, not silently dropped — so the server can tell "no candidates" apart from "write never ran."

## Agent Brief

**Category:** bug
**Summary:** The iOS quiz submit fires the verdict without awaiting the per-member candidate fetch + persist, so the verdict can compute against a `member_fetches` table missing this member's row. Make submit await the persist and stop swallowing persist errors.

**Current behavior:** `QuizCoordinator` runs the per-member Foursquare fetch as a detached background task. `submit()` does not await it before writing the `votes` row that fires the verdict. `persistRawFetch` additionally guards out the write when the raw fetch is empty and catches-and-drops any write error.

**Desired behavior:** `submit()` awaits completion of the member's candidate fetch and its `member_fetches` persist before the verdict-firing write. `persistRawFetch` surfaces failures instead of swallowing them. The verdict never fires against a `member_fetches` table that is missing this member's row due to a race or a dropped error.

**Key interfaces:**
- `QuizCoordinator.submit()` — must await the in-flight member candidate-fetch / persist task before performing the verdict-firing `votes` write. Preserve the existing rapid-tap fold (`inflight`) and the `.submitting` / `.submitted` / `.failed` step transitions.
- `QuizCoordinator.persistRawFetch` — stop silently skipping the write and stop swallowing errors; surface failures via the existing telemetry path or propagate them so submit can react.
- The background fetch task handle — `submit()` needs a handle to await; today the task is fired and forgotten.

**Acceptance criteria:**
- [ ] `submit()` does not perform the verdict-firing write until the member's candidate fetch and `member_fetches` persist have completed.
- [ ] A failed `member_fetches` write is surfaced (telemetry and/or propagated) — never silently swallowed.
- [ ] An empty raw fetch is recorded distinguishably (not silently skipped) so the server can tell "no candidates" from "write never ran".
- [ ] Quiz submit still completes for a member whose fetch genuinely returns no candidates — it routes to the verdict, where [[bug-13-engine-no-survivor-on-empty-pool|bug-13]]'s no-survivor outcome handles the empty pool.
- [ ] The rapid-tap submit fold and the existing step machine (`submitting` / `submitted` / `failed`) are unregressed.
- [ ] iOS build succeeds and the `ios` test lane is green; new unit tests cover submit-awaits-persist and persist-error-surfacing.

**Out of scope:**
- The server-side handling of an empty pool — that is [[bug-13-engine-no-survivor-on-empty-pool|bug-13]].
- The post-Q5 router orphaned-host bug — that is [[bug-12-verdict-spinner-orphaned-host|bug-12]].
- Any change to the Foursquare fetch planner / category allowlist.

## Blocked by

None — self-contained iOS change. Independent of bug-13; either slice ships alone and helps.

## Related

- [[bug-13-engine-no-survivor-on-empty-pool|bug-13]] — the server-side empty-pool fix; parallel slice
- [[bug-12-verdict-spinner-orphaned-host|bug-12]] — the other defect from the same diagnosis
- [[tb-21-raw-fetch-to-options|tb-21]] — the `member_fetches` → `options` persistence path this protects

## Comments

**2026-05-19 — filed.** Found during the 2026-05-19 verdict-spinner diagnosis. Triaged `ready-for-agent` / AFK — self-contained iOS change, testable through the coordinator's existing seams, no design fork (an empty pool is handled by bug-13's no-survivor outcome).
