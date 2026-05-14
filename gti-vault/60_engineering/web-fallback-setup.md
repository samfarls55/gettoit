---
title: Web fallback setup — Vercel env vars + Realtime contract
status: living
last-updated: 2026-05-14
related: tb-15, adr-0003
---

# Web fallback — setup notes

Working notes for the Next.js web fallback shipped in [[../15_issues/v1/issues/tb-15-web-fallback|TB-15]]. Cross-references [[adr/0003-web-fallback-nextjs-vercel|ADR 0003]] for the high-level decision; this file holds the operational tail.

## Environment variables

Next.js exposes env vars to the browser only when they're prefixed with `NEXT_PUBLIC_`. The repo's existing names are bare (`SUPABASE_PROJECT_URL`, `SUPABASE_ANON_KEY`) — those work for iOS (Xcode-injected) and for Edge Functions (server-only), but the web client needs the `NEXT_PUBLIC_` variants.

**Vercel project env vars (Production + Preview):**

| Vercel name | Source value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_PROJECT_URL` from GH secrets | `https://rlnevdqebmzbxpntghzb.supabase.co`. Public — fine to expose. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` from GH secrets | Public anon key. RLS gates real access. |

Set in Vercel via:

```
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
```

The values mirror the existing iOS-side GH-Actions secrets. The Vercel→Supabase integration can also paste them in automatically if the projects are linked.

## Routes shipped

- `/` — placeholder landing (TB-01).
- `/join/[roomId]` — Universal Link landing (S02b invite card). Routes to `/s/<roomId>`.
- `/s/[sessionId]` — live session (anon auth + quiz + waiting + read-only verdict).
- `/.well-known/apple-app-site-association` — AASA file (TB-00).

## Realtime contract

The web `SessionRoom` subscribes to a single Supabase channel topic `room:<roomId>` that listens for four things, mirroring iOS:

1. `broadcast` event `verdict_ready` — emitted by the `compute-verdict` Edge Function. Flips the local `roomStatus` to `verdict_ready` and triggers the verdict fetch.
2. `postgres_changes` INSERT on `members where room_id=eq.<id>` — drives the avatar row growing as invitees join.
3. `postgres_changes` INSERT on `votes where room_id=eq.<id>` — drives the answered ring on peers' avatars.
4. `postgres_changes` UPDATE on `rooms where id=eq.<id>` — picks up `open → firing → verdict_ready → locked` flips when other clients drive them.

RLS guarantees only authenticated room members can subscribe; the anon JWT carries the `auth.uid()` the postgres_changes filter checks.

## What's NOT on web (accepted gaps)

Per [[adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]] §"Web fallback voters stay anonymous indefinitely" and [[adr/0003-web-fallback-nextjs-vercel|ADR 0003]] §"Push notifications absent on web":

- **No Sign-in with Apple chip.** Web users stay anonymous indefinitely.
- **No check-in push notifications.** Web has no APNs channel.
- **No "I'm in" ratification.** Verdict surface is read-only.
- **No "Widen radius" reroll.** Initiator-only on iOS; web never has the initiator role.
- **No "Decide now" CTA.** Same reason — only iOS-side initiators trigger manual fire.

## Drift gate

`design-system/scripts/verify.mjs` now sweeps `web/**/*.{ts,tsx,js,jsx,css}` for orphan hex codes alongside the iOS / JSX sweep. Every hex in the web source must be present in `design-system/tokens.json` — extend `tokens.json` first if you need a new color.

The web build pulls `design-system/code/tokens.css` directly via `app/layout.tsx`, so token mutations flow into the web surface without a code change.

## Testing

`web/` runs vitest as `npm test`:

- `lib/quiz.test.ts` — quiz state-machine helpers (toggleVeto, wire-shape).
- `lib/verdict.test.ts` — verdict shaping (action, metaLine, audienceCopy, survivingHardNeeds, shapeVerdictView).
- `lib/mixed-platform.test.ts` — TB-15 integration AC: a 4-person room with one web + three iOS members shapes the identical verdict view.
- `components/*.test.tsx` — surface-level smoke for each screen (InviteWebCard, QuizScreens, WaitingScreen, VerdictReadOnly).

The CI `web` lane runs `npm test && npm run build`.
