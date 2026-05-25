---
issue: tb-WF-12
title: Web invitee shell re-click behaviors — resume, read-only, leave
status: done
type: AFK
feature: 0.1.0
github_issue: 193
created: 2026-05-21
---

# tb-WF-12 — Web invitee shell re-click behaviors

## Parent

[[sg-wf-5-web-invitee-flow|sg-WF-5]] — the web invitee shell design-system surface doc. Behavior locked in [[../../../50_product/0.1.0-workflow-overhaul-web-invitee-flow|0.1.0-workflow-overhaul-web-invitee-flow]] §Q5 (resume), §Q6 (decided re-click), §Q7 (leave).

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

- [x] Re-clicking the link mid-quiz resumes at the last-answered question with prior answers intact; a post-submit re-click routes to Waiting; a post-verdict re-click routes to Verdict.
- [x] Re-clicking a decided Plan shows the read-only verdict card; an unresolved membership shows the "this plan is closed" terminal.
- [x] The quiz-chrome `Leave` affordance drops the `members` row after the confirm step and shows the "you left this plan" terminal; a subsequent re-click is a fresh first-landing.
- [x] No new migration and no new edge-function code are introduced.
- [x] Web CI lane (`npm test`, `npm run build`) is green. (`npm run lint` is not a configured CI gate — the `web` lane in `ci.yml` runs `npm ci` + `npm test` + `npm run build` only; `next lint` has no eslint config and prompts interactively.)

## Blocked by

- [[tb-wf-11-web-invitee-shell-foundation|tb-WF-11]] — the shell scaffold + member-creating first landing this builds on.

## Comments

**2026-05-21 — done (PR #205).** Landed the four re-click behaviors on the tb-WF-11 foundation. New web files: `lib/quiz-progress.ts` (the `members.quiz_progress` pack/unpack contract), `components/InviteShellSurfaces.tsx` (the §C verdict card, §D closed terminal, §E left terminal + leave-confirm sheet). Extended `lib/invitee-shell.ts` (`readQuizProgress`, `writeQuizProgress`, `readRoomPlanState`, `leaveMembership`), `InviteShell` (re-click boot routing + §C Realtime live-update), `SessionRoom` (resume hydration from `quiz_progress`, progress writes on advance, the leave flow), and the `TopBar` / Q1–Q5 chrome (the `Leave` affordance). No new migration, no new edge-function code — reuses `members.quiz_progress` + `members_progress_upsert`, `plans_decided_for_user` / `plans_history_for_user`, and `members_delete_self`.

Key autonomous call: `rooms` carries a membership-gated SELECT policy, so the shell cannot tell a genuine first-timer apart from a TTL-purged member / stranger on a *decided* Plan without new server code. Per the surface doc §B single-path lock, a no-membership click routes to §A name entry; §D ("this plan is closed") is reached when a membership resolves at boot but the room read inside `readRoomPlanState` comes back empty — the membership aged out mid-session. Documented in [[../../../60_engineering/adr/0017-web-invitee-reclick-rls-routing|ADR 0017]].

Adjacency noted, not actioned (out of #193 scope): `web/components/InviteWebCard.tsx` is referenced only by its own test — genuinely dead since tb-WF-11 retired the `ScreenInviteWeb` web port path. A separate cleanup issue should retire it. The `/s/[sessionId]` route is **not** dead — it still hosts `SessionRoom`.
