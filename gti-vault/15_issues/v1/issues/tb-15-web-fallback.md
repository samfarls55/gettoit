---
issue: tb-15
title: Web fallback — Next.js routes for invite, quiz, verdict (read-only)
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
adr: 0003
---

# TB-15 — Web fallback

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The hosted web fallback so the viral loop survives invitees who don't have iOS or don't want to install. A non-installer taps the Universal Link, lands on a Next.js page at `gettoit.app/s/<sessionId>`, authenticates anonymously against Supabase, answers the same 5-question quiz in the browser, and sees the verdict when it ships.

Per [[../../../60_engineering/adr/0003-web-fallback-nextjs-vercel|ADR 0003]], the web fallback consumes `design-system/code/tokens.css` directly but re-implements the components with real-data wiring (no import from `design-system/code/components.jsx`).

- **Routes** —
  - `/join/{roomId}` — the iMessage unfurl unfurls to OG meta + a "Sender sent you a session" landing card. Click → `/s/{sessionId}` (the actual web session route).
  - `/s/{sessionId}` — the live web session. Anon auth, member-add, quiz steps, waiting, verdict.
- **Implementations** — the web equivalents of S02 (Invite unfurl), S03 (Q1–Q5), S04 (Waiting), S05 (Verdict in read-only mode — no ratification, no reroll, no check-in). Visual continuity with iOS via the shared tokens.
- **Realtime + auth** — `supabase-js` anon auth, Realtime Broadcast subscriber, RLS-scoped reads.
- **No web claims** — Apple Sign-in is not offered in the browser per ADR 0007.
- **No web push** — check-in does not fire for web-only participants per ADR 0003 + ADR 0005. Documented as accepted gap.
- **Visual gates** — drift checker — `node design-system/scripts/verify.mjs` extended to scan `web/` for orphan hex / out-of-token usage, mirroring the iOS / JSX checks.
- **Tests** — a web user joins the same room as iOS members and submits a vote that participates in the verdict; the web verdict renders the same content as the iOS verdict; the orphan-hex sweep is clean for `web/`.

## Acceptance criteria

- [ ] `/join/{roomId}` route renders the unfurl card and routes to `/s/<sessionId>`.
- [ ] `/s/<sessionId>` route handles join, anon auth, 5-question quiz submission, live waiting, verdict read-only.
- [ ] `supabase-js` Realtime subscription updates the web Waiting + Verdict surfaces in lockstep with iOS.
- [ ] Web fallback consumes `design-system/code/tokens.css` directly with no inline hex.
- [ ] `node design-system/scripts/verify.mjs` extended to scan `web/`; orphan-hex sweep passes.
- [ ] Integration tests for a mixed-platform room (iOS + web members) where both contribute to a verdict.

## Blocked by

- [[tb-07-waiting-realtime-fire-trigger|TB-07]]
