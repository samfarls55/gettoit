---
issue: tb-00
title: External account setup (Apple Developer, Foursquare, Supabase, domain)
github_issue: 1
status: ready-for-agent
type: HITL
created: 2026-05-12
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
- [ ] `gettoit.app` DNS pointed at a placeholder (or Vercel) target.
- [ ] AASA file hosted at `https://gettoit.app/.well-known/apple-app-site-association` with the v1 Bundle ID and Team ID.

> MapKit JS key is **not required** for v1 — per [[../../../60_engineering/adr/0002-places-data-foursquare-mapkit|ADR-0002]], native iOS MapKit needs no key and the web fallback skips MapKit. Documented in [[../../../60_engineering/apple-keys-setup|apple-keys-setup.md]].

## References

- [[../../../60_engineering/apple-keys-setup|apple-keys-setup.md]] — full step-by-step for the three Apple keys (and why MapKit JS is skipped).
- [[../../../60_engineering/devcontainer-setup|devcontainer-setup.md]] — Step 4 lists every `gh secret set` command the project uses.

## Blocked by

None — can start immediately.
