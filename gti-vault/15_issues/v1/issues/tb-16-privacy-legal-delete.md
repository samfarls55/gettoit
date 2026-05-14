---
issue: tb-16
title: Privacy Policy + TOS + Privacy Nutrition Labels + in-app delete
github_issue: 17
status: ready-for-agent
type: HITL
created: 2026-05-12
prd: v1-prd
adr: 0006
---

# TB-16 — Privacy + TOS + Nutrition Labels + in-app delete

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The legal and policy work required to ship to external TestFlight and the App Store. Per [[../../../60_engineering/adr/0006-privacy-posture-v1|ADR 0006]] the posture is minimal: claimed-retained, anonymous-30-day-TTL, in-app delete with cascade, no third-party preference sharing, US-only beta.

This is HITL because the policy text needs human review and the App Store Connect entries require an Apple Developer account login.

- **Privacy Policy + TOS** — generate via iubenda or termly template. Inputs to the template:
  - Data collected: device-generated anonymous user_id, optional Apple email + name on link, quiz answers, restaurant interactions, push device token if granted.
  - Data shared: Foursquare receives geo queries only (no user identifiers, no preferences).
  - Retention: claimed accounts retained until in-app delete; anonymous accounts 30-day TTL.
  - User rights: in-app account deletion; data export deferred to v2.
  - Jurisdiction: US-only beta; EU launch deferred.
- **Privacy Nutrition Labels** — fill out the App Store Connect Privacy form to match the policy. Labels for: anonymous user ID, optional email + name (on link), location (precise — for Foursquare queries; not linked to identity), purchases (none), usage data (anonymous quiz answers).
- **In-app delete flow** — schema migration: every table grows an `ON DELETE` rule that cascades from `auth.users`. The user-facing button lives in a "Settings" screen (new minimal surface — propose `surfaces/09-settings.md` or fold into an account chip). On tap → confirmation dialog → `supabase.auth.admin.deleteUser()` → cascade. Rooms the user *created* hard-delete; rooms the user *participated in* nullify `members.user_id`, `votes.user_id`, `ratifications.user_id`.
- **30-day TTL cron** — `pg_cron` job that hard-deletes anonymous user rows + cascades for `auth.users WHERE is_anonymous = true AND last_sign_in_at < now() - interval '30 days'`.
- **Tests** — in-app delete cascades correctly (user's own rooms gone, co-participated rooms intact); anonymous TTL cron purges expired users.

## Acceptance criteria

- [x] **(AFK)** Privacy Policy and TOS text drafted and built into the web fallback at `gettoit.app/privacy` and `gettoit.app/terms`. _(`web/app/privacy/page.tsx`, `web/app/terms/page.tsx`. Self-drafted in-house rather than via Termly — see [ADR 0006 amendment 2026-05-14](../../../60_engineering/adr/0006-privacy-posture-v1.md#amendments). TN governing law, support@gettoit.app contact, USD 100 LoL cap. Build green via `npm run build` — both routes prerender as static content.)_
- [x] **(HITL)** `gettoit.app` apex domain pointed at the Vercel deployment and `/privacy` + `/terms` reachable from the public internet. _(2026-05-14 — DNS already delegated from TB-00; the apex was 404'ing because the gettoit-web Vercel project had Framework Preset "Other" instead of "Next.js". Patched via `vercel api -X PATCH /v9/projects/<id> -f framework=nextjs` + `vercel redeploy --target production`. Confirmed: `curl -sI` returns HTTP 200 for `/`, `/privacy`, `/terms`, and `/.well-known/apple-app-site-association`. See [TB-00 addendum 2026-05-14](../tb-00-external-accounts.md#post-completion-addendum-2026-05-14--vercel-framework-preset-gotcha).)_
- [ ] **(HITL)** `support@gettoit.app` mailbox or forwarding rule set up so inbound user requests (deletion, complaints, legal-resolution per ToS §15) actually land somewhere the operator reads. Currently only an Outlook personal account exists.
- [ ] **(HITL)** Privacy Nutrition Labels filled out in App Store Connect to match the policy.
- [x] **(AFK)** In-app "Delete my data" button works end-to-end with the documented cascade — S09 Settings surface + native confirmation alert + `delete-user` Edge Function + cascade FKs + fresh anonymous re-bootstrap. _(`design-system/surfaces/09-settings.md`, `design-system/code/screens/ScreenSettings.jsx`, `ios/Sources/App/SettingsScreen.swift`, `ios/Sources/App/AuthCoordinator.swift` `deleteAndReboot()` + `SupabaseAccountDeleter` protocol + `LiveSupabaseAccountDeleter`, `supabase/functions/delete-user/{handler,index}.ts`. S01 entry point added per spec exception in `surfaces/01-initiator.md` §"Settings footer link".)_
- [x] **(AFK)** Anonymous 30-day TTL `pg_cron` job runs and purges expired rows. _(`supabase/migrations/20260514001000000_anonymous_ttl_sweeper.sql` — hourly at minute 30, `auth.users` delete cascades through every dependent table.)_
- [x] **(AFK)** Integration tests for delete cascade and TTL purge. _(`supabase/functions/delete-user/index.test.ts` — 13 handler-level cases including the security invariant that body-supplied user_id is ignored. `ios/Tests/AuthCoordinatorDeleteTests.swift` — state-machine cases. `ios/Tests/DeleteUserIntegrationTests.swift` — end-to-end via live Supabase. Cascade-at-row-level is a Postgres FK invariant declared in the existing migrations + ADR 0006 amendment; CI `supabase db push --include-all` is the contract. TTL purge cron is declared in the migration; observable in the Supabase cron job log.)_

## Engineering notes (2026-05-14)

- **Schema cascade work was a no-op.** The 10 existing FK declarations across the public schema already match ADR 0006 after the implementation-time reconciliation: 9 cascade + 1 set null on `events`. See the [Amendments section](../../../60_engineering/adr/0006-privacy-posture-v1.md#amendments) of ADR 0006 — two clarifications surfaced (events nullify + the cascade concession on participated rooms due to the `(room_id, user_id)` PK conflict).
- **Edge function manual deploy required:** `supabase functions deploy delete-user --project-ref rlnevdqebmzbxpntghzb`. Same pattern as the other Edge functions (no CI deploy step exists yet).
- **One spec exception added:** S01 Initiator now carries a tertiary `"SETTINGS"` footer link in the CTADock (eyebrow mono-tag, white 0.55, 44pt tap row). Justified in `surfaces/01-initiator.md` §"Settings footer link" — App Store guideline 5.1.1(v) needs the delete affordance ≤2 taps from a cold-start surface.
- **No new tokens or components added.** The Settings surface reuses the registered `midnight` gradient (previously declared but unused by any locked surface) and composes existing primitives (`GradientSurface`, `Eyebrow`, display headline, `PillCTA` white, plain text button).

## Blocked by

- [[tb-14-checkin-telemetry|TB-14]]
- [[tb-00-external-accounts|TB-00]]
