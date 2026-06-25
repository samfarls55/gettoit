---
status: clean_app_owned_pass
created: 2026-06-25
scope: production-like-local-qa
production_touched: false
sensitive_data_touched: false
destructive_actions: false
---

# Production-like local QA run

## Assumptions

- Scope is the current web app, active Expo mobile app, Supabase schema, local seed data, and local-only browser smoke.
- "Production-like local" means full local Supabase stack, RLS still enabled, fresh-project Data API grants made explicit, and deterministic synthetic rows large enough to exercise public and app workflows.
- The user confirmed the app is pre-user and local data is not sensitive. No production project, production data, or destructive reset was used.
- Browser smoke joins create extra anonymous members in the local database. I did not clean them up because the seed is intentionally non-destructive and cleanup would be a destructive local data action.

## Inventory

### Roles

- Signed-out visitor: can load public web routes and legal pages without Supabase auth.
- Anonymous web invitee: can open `/join/[roomId]`, bootstrap anonymous auth, enter a display name, join, answer quiz, wait, view verdict/read-only state, and mint claim-code handoff where offered.
- Legacy anonymous session user: can open `/s/[sessionId]`, join if needed, answer, wait, and view live session state.
- Linked account user: can keep durable mobile plan list state, create/edit/delete plans, join plans, sign out, redeem web claim codes, and delete account.
- Plan owner: creates setup data, shares invites, closes voting where supported, and sees active/history buckets.
- Participant/late viewer: joins from invite while open, or sees closed/read-only/expired state without mutating closed rooms.
- Edge/service role: computes verdicts, mints/redeems claim codes, and uses service-only tables not exposed to regular clients.

### Web Routes

- `/`: public landing/fallback. Accept: 200 without auth/Supabase, brand and primary copy fit mobile and desktop.
- `/privacy`: static legal route. Accept: 200 without auth, footer/nav links render.
- `/terms`: static legal route. Accept: 200 without auth, footer/nav links render.
- `/places-fallback`: provider-unavailable surface. Accept: 200 without auth, recovery CTA and text fit narrow mobile.
- `/join/[roomId]`: invite flow. Accept: 200, local Supabase env present, anonymous auth bootstraps, name input appears for open room, closed/expired rooms do not crash.
- `/s/[sessionId]`: session room. Accept: 200, anonymous auth bootstraps, waiting state renders for seeded open room, member progress fits narrow mobile even with repeated local joins.

### Mobile Routes And States

- `signInGate`: Apple sign-in, optional dev password sign-in, "Voted on the Web?" toggle, claim-code input, claim-code submit.
- `planList`: Created, Joined, Decided, History buckets; settings icon; create solo/duo/group; plan cards; delete plan with confirm/cancel.
- `deepLink`: invite resolves to join, quiz, waiting, verdict, read-only verdict, closed/expired state, or sign-in gate by auth/room state.
- `setup`: plan name input, participant chips, meal time chips, service shape chips, search area editor, launch/save actions.
- `join`: invitee display-name confirm and member creation.
- `quiz`: Q1-Q5 answer controls, persisted progress, back navigation, leave confirmation modal, no-result handling.
- `waiting`: member progress, session-ended fallback, owner close-voting action where present.
- `verdict`: live verdict, no-survivor terminal, reroll controls, history/read-only rendering.
- `settings`: close, sign out, delete-account modal with destructive confirm/cancel.

### Buttons, Inputs, Modals, Workflows

- Public web: home/brand link, privacy/terms footer links, places fallback recovery CTA.
- Invite/name entry: display-name input, continue/submit button, boot/loading state, boot-error state.
- Quiz: answer chips/buttons, Q5 ratings, save/continue, back, leave, leave confirm/cancel modal.
- Waiting: member progress row/grid, countdown, "Getting the app?" affordance, claim-code mint affordance where wired.
- Verdict: primary action, reroll entry points, no-survivor recovery, read-only history state.
- Plan list/setup/search: create buttons, plan cards, delete confirm/cancel, setup inputs/chips, location/manual search/radius/commit/discard/close controls.
- Account: Apple/dev sign-in, claim-code redeem, sign out, delete account confirm/cancel.

## Acceptance Criteria

- Every inventoried user-facing route has a non-crashing initial render for its expected auth/data state.
- Web public and invite/session surfaces fit 390px mobile viewport with no horizontal page overflow.
- Fresh Supabase defaults do not hide client-used tables from PostgREST/Data API.
- RLS remains enabled; `claim_codes` stays service-only; client tables receive only the needed explicit grants.
- Local seed is synthetic, deterministic, rerunnable, non-destructive, and covers pending, open, verdict-ready, locked, expired, member-progress, verdict-slate, and reroll states.
- Open sessions stay open unless completed by workflow; verdict-ready rooms remain reroll-testable; locked/expired rooms are stable read-only/history fixtures.
- Generic JSONB vote schema is used by reroll logic; retired typed vote columns are not referenced.
- Regression checks pass for touched areas: migrations/edge tests, web typecheck/tests/build, mobile typecheck/tests, React Doctor changed-file scan, and browser smoke.

## Finite Risk Cases

- Fresh local Supabase project exposes no public table implicitly to Data API.
- Client queries a table that has an RLS policy but lacks a SQL grant.
- Seed load accidentally fires triggers and locks all verdict-ready rooms.
- Reroll RPC still references retired typed vote columns after JSONB vote migration.
- Repeated anonymous browser joins increase room membership beyond the nominal seeded count.
- Narrow mobile waiting screen overflows header/status text or avatar rows.
- Missing web Supabase env routes users into missing-env/loading paths during QA.
- DB-only Supabase start differs from the full production-like local stack.
- Closed-room or expired-room invite must not add late mutable membership.
- Claim-code table must remain hidden from regular authenticated clients.
- Plan without room appears as created draft, not joined/active history.
- Anonymous claim-code redeem handles invalid, expired, and already-redeemed codes.
- Account deletion/sign-out clears local state without deleting unrelated rows.

## Findings And Fixes

### BUG-001: Fresh Supabase Data API grants were implicit

Evidence: Fresh Supabase defaults require explicit table grants for Data API access. Client paths query `plans`, `rooms`, `members`, `votes`, `options`, `verdicts`, `verdict_slate_entries`, and `rerolls`, while existing migrations relied on RLS policies alone.

Fix: added `supabase/migrations/20260624222129_data_api_explicit_grants.sql`. Client-used tables get explicit authenticated grants; `claim_codes` remains service-only.

### BUG-002: No durable production-scale local seed existed

Evidence: repository search found tests/fixtures but no `supabase/seed.sql`.

Fix: added deterministic synthetic `supabase/seed.sql`. Baseline seed creates 48 users, 96 plans, 72 rooms, 288 memberships, 240 votes, 192 options, 48 verdicts, 192 slate entries, and 24 rerolls. It is conflict-tolerant and does not delete or truncate data.

### BUG-003: Seed did not preserve active reroll-ready rooms

Evidence: initial seeded verdict-ready rows had old committed timestamps, so local triggers/cron could lock them and remove the live reroll workflow from test coverage.

Fix: adjusted `supabase/seed.sql` so rooms cover `open`, `verdict_ready`, `locked`, and `expired`; active verdict-ready rooms keep an open reroll window while locked rooms carry committed/locked timestamps.

### BUG-004: `apply_reroll` referenced retired typed vote columns

Evidence: local migration/lint/runtime inspection found `apply_reroll` still using `q2_budget`, `q3_walk_minutes`, `q4_vibe`, and `q1_vetoes_extra` after the generic JSONB vote migration.

Fix: added `supabase/migrations/20260624225613_repair_apply_reroll_generic_votes.sql`, rewriting `apply_reroll` to use generic JSONB vote helpers and preserving the reroll-window guard. Added regression coverage in `supabase/functions/compute-verdict/production-like-local-data-schema.test.ts`.

### BUG-005: Mobile-width web display text clipped off-canvas

Evidence: 390x844 browser screenshots showed the public landing hero and places fallback headline clipped horizontally. Invite error copy also risked clipping long env names.

Fix: updated `web/app/globals.css`, `web/app/page.tsx`, `web/components/PlacesEmptyState.tsx`, `web/components/InviteShell.tsx`, `web/components/InviteShellSurfaces.tsx`, and `web/components/SessionRoom.tsx` to constrain content, remove negative display tracking, lower mobile display sizes, wrap long env/error strings, and avoid grid-stretched CTAs. Added web regression tests.

### BUG-006: Waiting screen overflowed with production-scale/repeated members

Evidence: env-wired local browser smoke on `/s/30000000-0000-4000-8000-000000000002` rendered 7+ members from repeated anonymous joins. The avatar row overflowed and the header status clipped in mobile screenshots.

Fix: updated `web/components/WaitingScreen.tsx` so the header uses a constrained grid status and avatars wrap into centered rows. Final controlled Chrome CDP capture at 390x844 reported `innerWidth=390`, `scrollWidth=390`, and rendered 13 members without horizontal overflow.

## Verification Log

- Pass: `supabase migration up --local` applied the reroll repair migration.
- Pass: `supabase/seed.sql` applied twice locally without truncation. Baseline counts after seed: 48 auth users, 96 plans, 72 rooms, 288 members, 240 votes, 192 options, 48 verdicts, 192 slate entries, 24 rerolls.
- Pass: room state coverage after seed: 24 open, 12 verdict_ready, 12 locked, 24 expired.
- Pass: live rollback `apply_reroll('30000000-0000-4000-8000-000000000002', 'cost')` as authenticated user returned `{"status":"rerolled","remaining":0,...}` and rolled back cleanly.
- Pass: `npm run verify:edge`. Result: 473 passed, 0 failed, 2 ignored.
- Pass: `npm run verify:web` after final WaitingScreen fix. Result: typecheck passed, Vitest 26 files / 152 tests passed, Next build passed.
- Pass: `npm run mobile:verify`. Result: typecheck passed, Jest 11 suites / 123 tests passed.
- Pass: `npx react-doctor@latest --verbose --scope changed`. Result: no issues, 100/100.
- Pass: env-wired local web smoke for `/`, `/privacy`, `/terms`, `/places-fallback`, `/join/30000000-0000-4000-8000-000000000002`, and `/s/30000000-0000-4000-8000-000000000002`. Result: all HTTP 200.
- Pass: controlled Chrome CDP visual smoke at 390x844 for `/s/30000000-0000-4000-8000-000000000002`. Result: `innerWidth=390`, `bodyScrollWidth=390`, `htmlScrollWidth=390`; screenshot shows header/status and 13 member avatars fitting without horizontal overflow.

## Evidence

- Run folder: `gti-vault/15_issues/_runs/2026-06-25-production-like-local-qa-evidence/`
- Final route smoke: `final-fixed-header-wrapped-smoke-results.json`
- Final controlled mobile screenshot: `final-cdp-mobile-waiting-session-active-room.png`
- Final controlled viewport metrics: `final-cdp-mobile-waiting-session-active-room-metrics.json`
- Earlier bug screenshots and HTML dumps are preserved in the same evidence folder for comparison.

## Residual Notes

- `supabase db lint` now exits successfully for the app-owned `apply_reroll` repair path, and searches no longer find retired vote columns in that function. The lint output still contains PostGIS/extension noise from Supabase-managed functions in `public`; I treated that as non-app-owned residual risk.
- Next build warns that multiple lockfiles exist and Next inferred the workspace root from `C:\development\gettoit\package-lock.json` while also seeing `web\package-lock.json`. Build succeeds; no code change was made because it is unrelated to this QA pass.
- Browser smoke intentionally left extra anonymous local members in the seeded test room. This is documented evidence of non-destructive local testing, not production data.
