---
issue: bug-17
title: Web verdict-read path still references retired v1 typed `votes` columns
status: needs-triage
type: HITL
github_issue: 207
created: 2026-05-21
---

# bug-17 — Web verdict-read path references retired v1 `votes` columns

## Symptom

The web invitee's read-only verdict view renders vote receipts from `votes`
table columns that no longer exist. tb-WF-10 migrated `votes` to generic
`q1`..`q5` jsonb slots and dropped the v1 typed-per-question columns; the web
**write** path was ported, but the **read** path was not.

## Detail

- `web/lib/verdict.ts` — `VoteSummaryRow` (and its consumers) still project the
  retired typed columns.
- `web/components/SessionRoom.tsx` — the verdict-load path reads the same
  dropped columns.
- tb-WF-10 ported only the write side (`web/lib/quiz.ts` → generic slots); the
  verdict-read receipts were explicitly flagged out of scope.

## Impact

Web verdict display shows missing or malformed receipts for any room whose
`votes` rows are in the new generic-slot shape — i.e. every room created after
the tb-WF-10 migration. The iOS verdict path is unaffected (it already reads the
generic slots).

## Suggested direction (triage to confirm)

Move the web verdict-read receipts onto the `verdict_for_room` RPC projection
rather than reading `votes` columns directly — the RPC already returns the
shaped verdict for a room and is the single source the read side should consume.

## Surfaced by

Flagged as an adjacency by the tb-WF-10 subagent during the 2026-05-21-1812 AFK
execution run. Documented in [[tb-wf-10-web-quiz-v11-port|tb-WF-10]] and PR #202.

## References

- `web/lib/verdict.ts`, `web/components/SessionRoom.tsx`
- `web/lib/votes-wire.ts` / `supabase/functions/_shared/votes-wire.ts` — the
  generic-slot wire contract.
- [[tb-wf-10-web-quiz-v11-port|tb-WF-10]] — the write-side port.
