---
issue: ops-01
title: Re-fire the rooms wedged in status='firing' so they resolve to a terminal verdict
status: ready-for-agent
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
