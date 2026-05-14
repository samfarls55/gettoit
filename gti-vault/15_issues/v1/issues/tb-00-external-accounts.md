---
issue: tb-00
title: External account setup (Apple Developer, Foursquare, Supabase, domain)
github_issue: 1
status: done
type: HITL
created: 2026-05-12
completed: 2026-05-13
prd: v1-prd
---

# TB-00 — External account setup

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The four external accounts and assets that every later tracer bullet depends on. Each is a one-time setup with paperwork, not engineering.

- **Apple Developer Program** — individual account, founder's name. ~$99/yr. Per [[../../../50_product/v1-scope|v1-scope]], LLC formation is deferred until thesis validates. No DUNS required for individual. Account approval typically 24–48h.
- **Foursquare Places API** — free-tier developer account. Generate an API key for the Places endpoints (`search`, `details`). Store in 1Password or equivalent.
- **Supabase project** — create the v1 production project on the Pro plan ($25/mo). Note the project URL and the service-role key. Anonymous auth enabled. Postgres extensions enabled: `postgis`, `pg_cron`, `pgmq`.
- **Domain + DNS for `gettoit.app`** — already registered 2026-05-12. Point at the eventual Vercel deployment for the web fallback. Host the `apple-app-site-association` file (signed JSON) for Universal Links at `https://gettoit.app/.well-known/apple-app-site-association` — actual content depends on the Bundle ID assigned in the Apple Developer account, so this step lands after the Apple account is provisioned.

## Acceptance criteria

- [x] Apple Developer account approved; Bundle ID `app.gettoit.GetToIt` reserved. _(2026-05-13)_
- [x] App Store Connect API key generated (`.p8` stored locally; Key ID + Issuer ID recorded). _(2026-05-13)_
- [x] Sign in with Apple key generated (`.p8`, Key ID, Services ID `app.gettoit.GetToIt.signin` recorded). _(2026-05-13)_
- [x] App Store Connect API key wired into GitHub Actions secrets (`APPLE_TEAM_ID`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_PRIVATE_KEY`). See [[../../../60_engineering/apple-keys-setup#wire-into-ci|runbook §Wire into CI]]. _(2026-05-13 — all 4 secrets present per `gh secret list`.)_
- [x] Sign in with Apple key wired into Supabase (Auth → Providers → Apple). See [[../../../60_engineering/apple-keys-setup#wire-into-supabase|runbook §Wire into Supabase]]. _(2026-05-13 — Management API confirms `external_apple_enabled: true`, client IDs `app.gettoit.GetToIt, app.gettoit.GetToIt.signin`, secret set.)_
- [x] Foursquare API key generated; recorded in secure storage. _(2026-05-13 — key in `.env` as `FOURSQUARE_API_KEY`; live `places/search` call returns 200. ⚠️ Legacy `api.foursquare.com/v3/*` endpoints return HTTP 410 — new key auth + endpoint required. See follow-up note below.)_
- [x] Supabase project provisioned; URL + service-role key + anon key recorded; PostGIS / pg_cron / pgmq enabled. _(2026-05-13 — `gettoit-prod` ref `rlnevdqebmzbxpntghzb`, West US Oregon; anon auth on; postgis 3.3.7 / pg_cron 1.6.4 / pgmq 1.5.1; 3 GH Actions secrets set. See [[../../../60_engineering/supabase-setup|supabase-setup.md]].)_
- [x] `gettoit.app` DNS pointed at a placeholder (or Vercel) target. _(2026-05-13 — Namecheap nameservers delegated to `ns1/ns2.vercel-dns.com`; Vercel serves `web/` placeholder at apex with auto-provisioned Let's Encrypt cert. Authoritative A: `216.198.79.65`, `64.29.17.65`.)_
- [x] AASA file hosted at `https://gettoit.app/.well-known/apple-app-site-association` with the v1 Bundle ID and Team ID. _(2026-05-13 — HTTP 200, `content-type: application/json`, served by Vercel; appID `WXTMNYM34A.app.gettoit.GetToIt`, components claim `/join/*` for TB-02 room-join deeplink.)_

> MapKit JS key is **not required** for v1 — per [[../../../60_engineering/adr/0002-places-data-foursquare-mapkit|ADR-0002]], native iOS MapKit needs no key and the web fallback skips MapKit. Documented in [[../../../60_engineering/apple-keys-setup|apple-keys-setup.md]].

## References

- [[../../../60_engineering/apple-keys-setup|apple-keys-setup.md]] — full step-by-step for the three Apple keys (and why MapKit JS is skipped).
- [[../../../60_engineering/devcontainer-setup|devcontainer-setup.md]] — Step 4 lists every `gh secret set` command the project uses.

## Blocked by

None — can start immediately.

## Post-completion addendum (2026-05-13)

Added after TB-00 was closed, in the same session, to clear the remaining hard blocker for TB-08 / TB-14:

- **APNs auth key** generated (`AuthKey_H929WAC8SC.p8`). Environment: `Both` (sandbox + production). Key Restriction: `Team Scoped (All Topics)` — Apple disallows `Topic Specific` when Environment = `Both`; theoretical privilege only with one app under the team.
- **Push Notifications capability** confirmed enabled on App ID `app.gettoit.GetToIt`.
- GitHub Actions secrets: `APNS_AUTH_KEY_ID`, `APNS_AUTH_KEY` set.
- Supabase Edge Function secrets: `APNS_AUTH_KEY_ID`, `APNS_AUTH_KEY`, `APNS_TEAM_ID`, `APNS_TOPIC` set via Management API.
- **Foursquare key fanout**: `FOURSQUARE_API_KEY` also added to GitHub Actions secrets (was only in `.env`) and Supabase Edge Function secrets.

Runbook updates: [[../../../60_engineering/apple-keys-setup#key-3--apns-auth-key|apple-keys-setup §Key 3]] and [[../../../60_engineering/devcontainer-setup|devcontainer-setup §Step 4]].

## Post-completion addendum (2026-05-14) — Vercel framework-preset gotcha

Surfaced during the TB-16 walkthrough. The DNS / AASA / cert state above all checked out, but `https://gettoit.app/` returned `x-vercel-error: NOT_FOUND` for any Next.js route (every `app/**/page.tsx`). Root cause: the `gettoit-web` Vercel project was created with **Framework Preset = "Other"** rather than "Next.js" — likely because the project was added before `web/package.json` carried a Next.js manifest, so Vercel's auto-detect fell back. With "Other", Vercel serves from `public/` or `.` and ignores `.next/`. The AASA file (under `web/public/`) served fine, masking the issue from TB-00's lightweight verification.

Fix applied 2026-05-14:

```
vercel api -X PATCH "/v9/projects/<projectId>?teamId=samfarls55s-projects" \
           -f framework=nextjs
vercel redeploy <latest-prod-deployment-url> --target production
```

Post-fix `curl -sI https://gettoit.app/` returns `HTTP/2 200` and serves the Next.js placeholder page.

Acceptance-row gap: the original DNS row above (`gettoit.app DNS pointed at a placeholder ...`) was verified only by DNS resolution + AASA content-type. A `curl -f https://gettoit.app/` returning 200 was not part of the verification. Going forward, treat "domain serving an actual app route" and "DNS resolves" as separate gates.
