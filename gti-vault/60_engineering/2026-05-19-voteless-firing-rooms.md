---
folder: 60_engineering
purpose: Finding â€” vote-less rooms stuck in status='firing' that the ops-01 re-fire cannot resolve
created: 2026-05-19
source: ops-01 (GitHub #145, PR #151)
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# Vote-less rooms stuck in `status='firing'`

## What was found

During the ops-01 remediation (re-firing the rooms wedged in
`status='firing'` by the bug-13 empty-pool engine bug), the enumeration
split the 856 firing rooms in `gettoit-prod` into two distinct
populations:

| Population | Count | Re-fireable? |
|---|---|---|
| Wedged, has `votes` rows | 558 | Yes â€” bug-13 wedge. All resolved to `no_survivor`. |
| Wedged, **no `votes` rows** | 298 (300 by run-end) | **No** â€” `compute-verdict` hard-404s with `no_votes`. |

ops-01 cleared the 558. The ~300 vote-less rooms are a **separate
failure mode** and are intentionally left `firing` â€” re-firing them is a
confirmed no-op (all 298 enumerated returned `no_votes` 404 and wrote
nothing).

## Why a vote-less room cannot resolve via re-fire

`compute-verdict` treats a room with zero `votes` rows as a hard 404
(`handler.ts`: "A room with no member votes can't yield a verdict at all
â€” there is no group to render the result for. That stays a hard 404.").
This is deliberate and correct: bug-13 only reclassified an **empty
candidate pool** as a terminal `no_survivor` verdict; it did not â€” and
should not â€” invent a verdict for a room that nobody ever voted in.

So a vote-less room has no path out of `firing` through the verdict
engine.

## Likely cause

A room reaches `firing` with no `votes` rows when it was created and
auto-fired (deadline / quorum path) before any member completed the
quiz and wrote a `votes` row. These are almost certainly abandoned
dogfood test rooms â€” the founder opened a room, never finished the
quiz, and the deadline cron fired it anyway. `gettoit-prod` has no real
users (TestFlight, pre-public-launch), so there is no user-facing blast
radius.

## Open question â€” not actioned by ops-01

ops-01 was scoped to the bug-13 re-fire only. The vote-less population
is left for a triage decision. Options a future issue could weigh:

- **Sweep them to `expired`.** A vote-less room past its deadline is
  semantically expired-no-quorum, not firing. A one-off `UPDATE` (or a
  pg_cron sweeper) could move `status='firing' AND no votes AND past
  deadline` to `expired`.
- **Fix the fire dispatch.** The deadline/quorum auto-fire arguably
  should not fire a room with zero votes at all â€” it should expire it.
  That would stop new vote-less rooms reaching `firing`.
- **Leave them.** They are inert dogfood noise; if nothing reads them,
  they cost nothing.

No decision made here â€” flagged for triage.
