---
title: Web fallback setup — Vercel env vars + Realtime contract
status: living
last-updated: 2026-06-03
related: tb-15, tb-WF-10, adr-0003, adr-0013, adr-0014
---

# Web fallback — setup notes

Working notes for the Next.js web fallback shipped in [[../15_issues/0.1.0/issues/tb-15-web-fallback|TB-15]]. Cross-references [[adr/0003-web-fallback-nextjs-vercel|ADR 0003]] for the high-level decision; this file holds the operational tail.

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
- `/join/[roomId]` — the web invitee shell (tb-WF-11). The iMessage/SMS deep link lands here; `InviteShell` ensures the anon Supabase session, and on a first landing renders the name-entry surface (`NameEntry`, web-01 §A) before handing into the quiz (`SessionRoom`). `generateMetadata` still emits the OG unfurl card. **Before tb-WF-11** this route rendered the S02b invite card (`InviteWebCard`) and routed to `/s/<roomId>`.
- `/s/[sessionId]` — live session (anon auth + quiz + waiting + read-only verdict). **Now unreferenced** after tb-WF-11 — `/join` mounts `SessionRoom` directly. `InviteWebCard` + this route are dead code, candidate cleanup for tb-WF-12.
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

## Native UI reference screenshots

Native iOS reference screenshots are a development aid for any local UI lab, not production app code. Local preview routes, UI-lab API helpers, downloaded PNGs, and the optional `/ui-lab` agent skill are ignored by Git.

- Generate native screenshots without a local Mac by running the `ios-ui-snapshots` GitHub Actions workflow.
- The workflow runs `GetToItTests/UiLabScreenshotExportTests/testExportUiLabScreenshots` on a macOS runner and uploads the `ios-ui-lab-screenshots` artifact.
- The local `/ui-lab` slash command is expected to dispatch that workflow, wait for completion, download the artifact into `web/public/ui-lab-ios/`, then start or reuse the Next dev server and open the lab. It should stop on workflow failure rather than opening stale screenshots silently.
- The screenshot directory must be injected through the XcodeGen-generated test scheme environment variable; shell env alone reaches the xcodebuild process but not reliably the iOS XCTest process.
- Download that artifact into the ignored local folder `web/public/ui-lab-ios/` when a local UI lab needs side-by-side native references.
- On a local Mac, run the iOS test target with `GTI_UI_LAB_SCREENSHOT_DIR` pointed at `../web/public/ui-lab-ios/` and `-only-testing:GetToItTests/UiLabScreenshotExportTests/testExportUiLabScreenshots`.
- Use these screenshots for layout, copy, spacing, visual hierarchy, and quick visual comparison before porting chosen changes into SwiftUI/TestFlight.

## 0.1.0 quiz port (tb-WF-10)

The web quiz was brought to 0.1.0 parity in tb-WF-10. Two implementation
notes for future readers:

- **The vote wire shape is the shared `votes-wire.ts` leaf module.** Per
  [[adr/0014-web-consumes-shared-votes-wire|ADR 0014]], `web/lib/quiz.ts`
  no longer hand-mirrors the `{ meta, answer }` envelope — it imports
  `supabase/functions/_shared/votes-wire.ts` directly. That is the *only*
  sanctioned cross-sibling import; do not generalise it.
- **The factorial / classifier / fetch planner are re-implemented in
  `web/lib/candidate-fetch.ts`, not imported.** There is a server-side
  TypeScript port of the venue classifier (`_shared/venue-classifier.ts`)
  and preference function (`_shared/preference-function.ts`), but those
  import engine code (`verdict-engine.ts`) and so are *not* leaf modules
  — importing them would drag the whole verdict engine into the web
  bundle. ADR 0014's leaf-module rule and ADR 0003's "web re-implements
  the spec" rule both point the same way: `candidate-fetch.ts` is a
  faithful, separately-tested port of the iOS `Q5VenueClassifier` /
  `Q5FactorialCardGenerator` / `FoursquareFetchPlanner`, with the
  classifier thresholds kept byte-identical so the web and server
  classify the same venue the same way.
- **Web has no MapKit fallback (ADR 0002).** A thin / failed / thrown
  `places-proxy` call degrades straight to the Q5 `no-results` screen —
  there is no second data source. The web client never renders a
  fictitious venue ([[adr/0013-no-fictitious-fallback-venues|ADR 0013]]).

## Testing

`web/` runs vitest as `npm test`:

- `lib/quiz.test.ts` — 0.1.0 quiz state helpers (cuisine toggle + cap,
  generic-slot wire-shape).
- `lib/candidate-fetch.test.ts` — the N+1 fetch planner, the venue
  classifier, the strict-factorial card generator, and the end-to-end
  per-member fetch (incl. the no-results honest-degradation paths).
- `lib/web-vote-round.test.ts` — integration: a full web quiz round
  builds a `votes` row carrying the kinds + answer shapes
  `compute-verdict` dispatches on.
- `lib/verdict.test.ts` — verdict shaping (action, metaLine, audienceCopy, survivingHardNeeds, shapeVerdictView).
- `lib/mixed-platform.test.ts` — TB-15 integration AC: a 4-person room with one web + three iOS members shapes the identical verdict view.
- `components/*.test.tsx` — surface-level smoke for each screen (InviteWebCard, QuizScreens, WaitingScreen, VerdictReadOnly).

The CI `web` lane runs `npm test && npm run build`.
