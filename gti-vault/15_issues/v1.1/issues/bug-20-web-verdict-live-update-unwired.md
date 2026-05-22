---
issue: bug-20
title: Web verdict surface does not live-update on a reroll (web-01 §C cross-fade unwired)
status: needs-triage
github_issue: 216
created: 2026-05-22
---

# bug-20 — Web verdict surface does not live-update on a reroll

## Symptom

`design-system/surfaces/web-01-invitee-shell.md` §C ("Read-only verdict card")
specs a **live update**: "During `decided-active` the card live-updates on the
existing Realtime rebroadcast — if a reroll changes the verdict while the
invitee has the card open, the venue name cross-fades to the new value
(`all 320ms var(--ease-out)`)."

It does not. A web invitee holding the §C verdict card open during an initiator
reroll sees the card stay frozen on the old venue.

## Root cause

- `SessionRoom`'s verdict-fetch effect runs once, when `roomStatus` first flips
  to `verdict_ready`, and is guarded against re-running.
- A reroll re-runs the verdict in place. The `verdict_ready` broadcast handler
  re-sets `roomStatus` to the same `verdict_ready` value — React bails on the
  unchanged state, the fetch effect never re-fires, and the rendered verdict is
  never refreshed.
- No venue-name cross-fade transition is wired on the web verdict surface.

## Impact

Low and narrow — it affects only a web invitee who has the verdict card open
during the brief initiator-only reroll window. Outside that window there is
nothing to live-update. No data is lost; the card is simply stale until reload.

## Suggested direction (triage to confirm)

Re-fetch the verdict when a reroll produces a new one — e.g. key the fetch on
the verdict id / `computed_at` rather than only on the room status — and
cross-fade the venue name per the §C timing (`all 320ms var(--ease-out)`).

## Blocked by

[[bug-17-web-verdict-surface-conformance|bug-17]] — bug-17 rewrites the same
web verdict surface (`SessionRoom` verdict fetch, `VerdictReadOnly`,
`web/lib/verdict.ts`) to conform to §C. This live-update work should land on top
of that conformed surface, not race it.

## Surfaced by

Flagged during the bug-17 `/grill-with-docs` session (2026-05-22, Q4) as a
separate realtime-behavior follow-up, deliberately kept out of bug-17's
static-conformance scope.

## References

- `design-system/surfaces/web-01-invitee-shell.md` §C "Live update".
- `web/components/SessionRoom.tsx` — the verdict-fetch effect.
- `web/components/VerdictReadOnly.tsx` — the web verdict surface.
- [[bug-17-web-verdict-surface-conformance|bug-17]] — the §C conformance fix
  this is blocked by.
