---
issue: tb-WF-12
title: Web invitee shell re-click behaviors — resume, read-only, leave
status: ready-for-agent
type: AFK
feature: workflow-overhaul
github_issue: 193
created: 2026-05-21
---

# tb-WF-12 — Web invitee shell re-click behaviors

## Parent

[[sg-wf-5-web-invitee-flow|sg-WF-5]] — the web invitee shell design-system surface doc. Behavior locked in [[../../../50_product/workflow-overhaul-web-invitee-flow|workflow-overhaul-web-invitee-flow]] §Q5 (resume), §Q6 (decided re-click), §Q7 (leave).

Second of the two shell-wiring tracer-bullets — builds the re-click behaviors on the [[tb-wf-11-web-invitee-shell-foundation|tb-WF-11]] foundation.

## What to build

Everything that happens when a web invitee re-opens their `/join/<roomId>` link after the first landing. The shell resolves the invitee to the Plan's current state and renders the right surface; the invitee can also leave an in-progress quiz.

**Journeys demoed:**

- An invitee answers Q1–Q3, closes the tab, re-clicks the link → resumes at Q3 (last-answered question) with prior answers intact. Re-click after submitting → Waiting. Re-click after the verdict → Verdict.
- An invitee re-clicks a decided Plan → a read-only verdict card (Plan name + verdict venue). If their membership no longer resolves (anon-TTL purge, or a stranger opening a forwarded link) → a "this plan is closed" terminal.
- An invitee taps `Leave` on the quiz chrome → confirm sheet → their `members` row is dropped → "you left this plan" terminal. Re-clicking the link afterwards is a fresh first-landing (name entry again).

### Behavior

- **Resume (§Q5)** — read `members.quiz_progress` (a plain select on boot; the existing `members_progress_upsert` RPC for writes) and route to the last-answered question. "Already voted → Waiting" and "verdict → Verdict" via `SessionRoom.boot`. No new server code.
- **Decided re-click (§Q6)** — read-only verdict card via the existing `plans_decided_for_user` / `plans_history_for_user` RPCs (a web invitee returns `role='joined'`); the card live-updates on the existing Realtime rebroadcast during `decided-active`. Terminal fallback when membership does not resolve.
- **Leave (§Q7)** — a `Leave` affordance on the Q1–Q5 quiz chrome only; a confirm step reusing the locked `joinedLeave` copy from [[../../../design-system/surfaces/00-plan-list|surfaces/00-plan-list.md]]; drop the `members` row via the existing `members_delete_self` RLS policy (`quiz_progress` rides along on the row delete); a "you left this plan" terminal; soft rejoin (a re-click after leave is a fresh first-landing — no tombstone, no hard block).

This slice adds **no new schema and no new server code** — every server-side piece (the `quiz_progress` column + `members_progress_upsert` RPC, the decided/history RPCs, the `members_delete_self` policy) already exists. It is a vertical slice that integrates through those existing layers up to the web UI.

### Out of scope

- A resume *into Q5* re-firing the per-member candidate fetch — that belongs to [[tb-wf-10-web-quiz-v11-port|tb-WF-10]] (the quiz port).

## Acceptance criteria

- [ ] Re-clicking the link mid-quiz resumes at the last-answered question with prior answers intact; a post-submit re-click routes to Waiting; a post-verdict re-click routes to Verdict.
- [ ] Re-clicking a decided Plan shows the read-only verdict card; an unresolved membership shows the "this plan is closed" terminal.
- [ ] The quiz-chrome `Leave` affordance drops the `members` row after the confirm step and shows the "you left this plan" terminal; a subsequent re-click is a fresh first-landing.
- [ ] No new migration and no new edge-function code are introduced.
- [ ] Web CI lane (`npm test`, `npm run build`, `npm run lint`) is green.

## Blocked by

- [[tb-wf-11-web-invitee-shell-foundation|tb-WF-11]] — the shell scaffold + member-creating first landing this builds on.
