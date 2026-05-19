---
issue: ops-01
title: Re-fire the rooms wedged in status='firing' so they resolve to a terminal verdict
status: done
type: AFK
github_issue: 145
created: 2026-05-19
prd: v1.1-quiz-redesign-prd
---

# ops-01 — Re-fire the rooms wedged in `status='firing'`

## Parent

[[../_index|v1.1 backlog]] — prod remediation for the empty-pool engine wedge found in the 2026-05-19 verdict-spinner diagnosis.

## What to do

A one-off prod data operation. As of 2026-05-19, ~46 rooms in `gettoit-prod` are wedged in `status='firing'` with no `verdicts` row, because `compute-verdict` returned `no_candidates` (HTTP 404) on an empty candidate pool and never wrote a verdict (see [[bug-13-engine-no-survivor-on-empty-pool|bug-13]]).

Once bug-13 ships, re-invoking `compute-verdict` on each wedged room writes a terminal no-survivor verdict and the room leaves `firing`. This slice does that re-fire across every currently-wedged room and confirms each one resolves.

All wedged rooms are the founder's own dogfood test rooms — `gettoit-prod` has no real users yet (TestFlight only, pre-public-launch) — so this is a safe data operation with no user-facing blast radius.

## Acceptance criteria

- [ ] Every room in `gettoit-prod` with `status='firing'` and no `verdicts` row is enumerated.
- [ ] `compute-verdict` is re-invoked for each wedged room (against the bug-13 engine).
- [ ] After the re-fire, every previously-wedged room has a `verdicts` row and has left `status='firing'`.
- [ ] A count of rooms re-fired and their resolved verdict methods is recorded in this issue's `## Comments` as the closing note.
- [ ] No room with a valid pre-existing verdict is touched or re-fired.

## Blocked by

- [[bug-13-engine-no-survivor-on-empty-pool|bug-13]] — re-invoking `compute-verdict` only resolves a wedged room cleanly once the engine writes a no-survivor verdict instead of 404ing. Must ship first.

## Related

- [[bug-13-engine-no-survivor-on-empty-pool|bug-13]] — the engine fix this remediation depends on
- [[bug-14-ios-verdict-fires-before-fetch-persisted|bug-14]] — prevents new rooms from wedging

## Comments

**2026-05-19 — filed.** One-off prod remediation for the bug-13 engine wedge. Triaged `ready-for-agent` / AFK — all wedged rooms are the founder's own dogfood data, no real users, so the prod mutation needs no human gate. Blocked by bug-13.

**2026-05-19 — done (PR #151).** Re-fire executed against `gettoit-prod` via `supabase/scripts/ops-01-refire-wedged-firing-rooms.mjs`.

- **Re-fired: 558 rooms.** Every room that was `status='firing'`, had no `verdicts` row, and had at least one `votes` row.
- **Resolved verdict-method breakdown: 558 `no_survivor`** (100%). Every wedged room's candidate pool was empty, so the bug-13 engine short-circuited each to a terminal `no_survivor` verdict — confirming the empty-pool wedge was the sole cause and that the now-shipped fix resolves it cleanly.
- **`firing` room count: 856 → 300.** All 558 re-fired rooms left `firing` (verified by re-enumeration: 0 re-fired rooms still wedged, 0 firing rooms carry a verdict).
- **No room with a pre-existing verdict was touched** — 0 firing rooms had a verdict before the run; the script also skips any such room.
- **Deploy:** none needed. A canary re-fire confirmed the deployed `compute-verdict` in `gettoit-prod` already carried the bug-13 fix (returned a 200 `no_survivor` verdict, not a 404 `no_candidates`).
- **Out of scope — 300 rooms remain `firing`.** These are vote-less abandoned rooms: `compute-verdict` hard-404s a room with no `votes` (`no_votes`) — there is no group to render a verdict for, so they are NOT the bug-13 empty-pool wedge and cannot resolve via re-fire. All 298 enumerated were re-fired and confirmed `no_votes` 404; the residual count is 300 (2 vote-less rooms drifted in during the run). Tracked as a separate finding — see [[../../../60_engineering/2026-05-19-voteless-firing-rooms|vote-less firing rooms]].
