---
issue: bug-19
title: Retire dead code web/components/InviteWebCard.tsx
status: needs-triage
type: HITL
github_issue: 209
created: 2026-05-21
---

# bug-19 — Dead component: web/components/InviteWebCard.tsx

## Symptom

`web/components/InviteWebCard.tsx` is unreferenced production code — its only
importer is its own test, `web/components/InviteWebCard.test.tsx`. No live route
or component renders it.

## Detail

- The web invitee shell work (tb-WF-11 / tb-WF-12) replaced the old invite-card
  surface; `InviteWebCard` was left behind.
- tb-WF-11 initially flagged both `InviteWebCard` and the `/s/[sessionId]` route
  as dead. tb-WF-12 corrected that — the `/s/[sessionId]` route is **live** (it
  still hosts `SessionRoom`). Only `InviteWebCard` is genuinely dead.

## Suggested direction (triage to confirm)

Delete `web/components/InviteWebCard.tsx` and its test
`web/components/InviteWebCard.test.tsx`. Confirm no other importer first.

## Impact

None functionally — pure cleanup. Dead code carries maintenance and
comprehension cost.

## Surfaced by

Flagged by the tb-WF-12 subagent during the 2026-05-21-1812 AFK execution run.

## References

- `web/components/InviteWebCard.tsx`, `web/components/InviteWebCard.test.tsx`
