---
issue: tb-15
title: Web fallback â€” Next.js routes for invite, quiz, verdict (read-only)
github_issue: 16
status: done
type: AFK
created: 2026-05-12
completed: 2026-05-14
prd: 0.1.0-prd
adr: 0003
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-15 â€” Web fallback

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

## What to build

The hosted web fallback so the viral loop survives invitees who don't have iOS or don't want to install. A non-installer taps the Universal Link, lands on a Next.js page at `gettoit.app/s/<sessionId>`, authenticates anonymously against Supabase, answers the same 5-question quiz in the browser, and sees the verdict when it ships.

Per [[../../../60_engineering/adr/0003-web-fallback-nextjs-vercel|ADR 0003]], the web fallback consumes `design-system/code/tokens.css` directly but re-implements the components with real-data wiring (no import from `design-system/code/components.jsx`).

- **Routes** â€”
  - `/join/{roomId}` â€” the iMessage unfurl unfurls to OG meta + a "Sender sent you a session" landing card. Click â†’ `/s/{sessionId}` (the actual web session route).
  - `/s/{sessionId}` â€” the live web session. Anon auth, member-add, quiz steps, waiting, verdict.
- **Implementations** â€” the web equivalents of S02 (Invite unfurl), S03 (Q1â€“Q5), S04 (Waiting), S05 (Verdict in read-only mode â€” no ratification, no reroll, no check-in). Visual continuity with iOS via the shared tokens.
- **Realtime + auth** â€” `supabase-js` anon auth, Realtime Broadcast subscriber, RLS-scoped reads.
- **No web claims** â€” Apple Sign-in is not offered in the browser per ADR 0007.
- **No web push** â€” check-in does not fire for web-only participants per ADR 0003 + ADR 0005. Documented as accepted gap.
- **Visual gates** â€” drift checker â€” `node design-system/scripts/verify.mjs` extended to scan `web/` for orphan hex / out-of-token usage, mirroring the iOS / JSX checks.
- **Tests** â€” a web user joins the same room as iOS members and submits a vote that participates in the verdict; the web verdict renders the same content as the iOS verdict; the orphan-hex sweep is clean for `web/`.

## Acceptance criteria

- [x] `/join/{roomId}` route renders the unfurl card and routes to `/s/<sessionId>`.
- [x] `/s/<sessionId>` route handles join, anon auth, 5-question quiz submission, live waiting, verdict read-only.
- [x] `supabase-js` Realtime subscription updates the web Waiting + Verdict surfaces in lockstep with iOS.
- [x] Web fallback consumes `design-system/code/tokens.css` directly with no inline hex.
- [x] `node design-system/scripts/verify.mjs` extended to scan `web/`; orphan-hex sweep passes.
- [x] Integration tests for a mixed-platform room (iOS + web members) where both contribute to a verdict.

## Blocked by

- [[tb-07-waiting-realtime-fire-trigger|TB-07]]

## Adjacencies

Items spotted during TB-15 build, surfaced for future tickets â€” none silently fixed.

1. **OG image asset missing.** `app/join/[roomId]/page.tsx` references `/og/invite.png` in its `openGraph.images` metadata. The asset itself is not produced by this PR â€” branding hasn't shipped an invite-unfurl card yet. Falls back to no-image unfurl gracefully; no behavioural impact. Park for a 0.1.0 polish ticket alongside `40_marketing_branding/`.
2. **Web countdown depends on `rooms.deadline_at`.** TB-07 added the column and the BEFORE INSERT trigger; existing rooms have it backfilled. If a future migration removes the column or makes it nullable for some room types, the web Waiting countdown will display nothing (gracefully) â€” but the iOS surface relies on the same row. Tracked as a documentation concern rather than a behaviour change.
3. **No `display_name` source on web.** S05 receipts surface `m<uuid-prefix>` for every member, mirroring iOS. TB-08 / TB-12 introduce a Sign-in-with-Apple-derived name on iOS; web users stay anonymous indefinitely per ADR 0007 so the prefix-form receipts persist on the web side. Acceptable per ADR 0003 Â§Consequences ("Web users miss check-in entirely in 0.1.0").
4. **`SUPABASE_PROJECT_URL` vs `NEXT_PUBLIC_SUPABASE_URL`.** The repo's `.env.example` and CI secrets are named `SUPABASE_PROJECT_URL` + `SUPABASE_ANON_KEY`; the web client reads `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Next.js convention). Vercel env-var aliases were added (see `docs/agents/web-env-mapping.md`). Update the runbook if the CI secret names change.

## Notes

- The web fallback is a fresh React port of the design-system JSX rather than an import. Per ADR 0003 Â§"Design-system relationship", `web/` MUST NOT import from `design-system/code/`. The drift gate is `verify.mjs` â€” extended in this PR to sweep `web/` for orphan hex codes.
- Verdict surface on web is **read-only**: no ratification, no reroll, no check-in, no widen-radius. The `VerdictReadOnly` component intentionally suppresses every mutating affordance the iOS S05 surface offers. See `VerdictReadOnly.test.tsx` for the assertion that the iOS-only copy never appears on the web variant.
- The `members` table requires the caller to be authenticated to insert (`with check (user_id = auth.uid())`). The web fallback uses `auth.signInAnonymously()` on first mount and then UPSERTs the member row â€” the unique `(room_id, user_id)` PK makes the call idempotent across reloads.
