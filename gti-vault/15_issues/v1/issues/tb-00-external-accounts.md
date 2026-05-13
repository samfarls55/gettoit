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

- [ ] Apple Developer account approved; Bundle ID `app.gettoit.GetToIt` (or equivalent) reserved.
- [ ] Foursquare API key generated; recorded in secure storage.
- [ ] Supabase project provisioned; URL + service-role key + anon key recorded; PostGIS / pg_cron / pgmq enabled.
- [ ] `gettoit.app` DNS pointed at a placeholder (or Vercel) target.
- [ ] AASA file hosted at `https://gettoit.app/.well-known/apple-app-site-association` with the v1 Bundle ID and a placeholder team ID until iOS build lands.

## Blocked by

None — can start immediately.
