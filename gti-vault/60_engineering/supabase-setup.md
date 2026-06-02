---
title: Supabase — setup runbook
type: runbook
status: active
created: 2026-05-13
related:
  - "[[../15_issues/0.1.0/issues/tb-00-external-accounts]]"
  - "[[github-actions-secrets]]"
  - "[[apple-keys-setup]]"
  - "[[adr/0001-ios-tech-stack-supabase]]"
  - "[[adr/0005-telemetry-supabase-event-store]]"
  - "[[adr/0007-auth-anonymous-default-apple-upgrade]]"
---

# Supabase — setup runbook

Step-by-step for provisioning the 0.1.0 production Supabase project and wiring it everywhere it needs to go. Pairs with [[github-actions-secrets|github-actions-secrets.md]] for the CI secret roster and [[apple-keys-setup|apple-keys-setup.md]] (Apple provider wiring lives there). Originating issue: [[../15_issues/0.1.0/issues/tb-00-external-accounts|TB-00]] AC #4.

## Summary — what 0.1.0 needs

| Resource | Where it lives | Status |
|---|---|---|
| Production project on Pro plan | supabase.com dashboard | Required ($25/mo) |
| Project URL + anon key + service-role key | `.env` locally; `gh secret` for CI | Required |
| Postgres extensions: `postgis`, `pg_cron`, `pgmq` | Dashboard → Database → Extensions | Required |
| Anonymous auth provider | Dashboard → Authentication → Providers | Required ([[adr/0007-auth-anonymous-default-apple-upgrade\|ADR-0007]]) |
| Apple Sign-in provider | Dashboard → Authentication → Providers → Apple | Required — set up in [[apple-keys-setup\|apple-keys-setup.md]] |
| Personal Access Token (for CLI) | Account → Access Tokens | Required |

## Prerequisites

1. Apple Developer account artifacts in hand (only needed for Apple provider — anon auth alone is fine without). See [[apple-keys-setup|apple-keys-setup.md]].
2. Founder email — same one used for Apple Developer if you can; keeps the credential surface small.
3. Credit card for Pro plan billing.
4. `gh` CLI authenticated locally for the secret-mirror step.

## Step 1 — Create the project

1. https://supabase.com/dashboard → sign in.
2. Create an org (`GetToIt`) if you don't have one yet — Pro plan applies per-org.
3. **New project**:
   - **Name**: `gettoit-prod` (use `gettoit-staging` or `gettoit-dev` for non-prod copies).
   - **Database password**: generate a strong password. **Save in 1Password AND `.env` (`SUPABASE_DB_PASSWORD`) immediately.** Supabase shows it once.
   - **Region**: pick closest to founder + target users. US default: `us-west-1` (Oregon) or `us-east-1` (Virginia). **Sticky** — migrating later means new project + dump/restore. Decide carefully.
   - **Pricing plan**: Pro ($25/mo). Required for production — free tier auto-pauses inactive projects, no daily backups, no custom domains.
4. Provision: ~2 min.

## Step 2 — Record API credentials → `.env`

Dashboard → Settings (gear) → API. Paste into `.env`:

| Supabase field | `.env` var |
|---|---|
| Project URL (`https://<ref>.supabase.co`) | `SUPABASE_PROJECT_URL` |
| Project Ref (the `<ref>` subdomain) | `SUPABASE_PROJECT_REF` |
| `anon` `public` key | `SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

⚠️ `service_role` bypasses Row Level Security. Server, Edge Functions, and CI only — never ship to a client, never commit.

## Step 3 — Personal Access Token (CLI auth)

The PAT lets the `supabase` CLI act on your behalf.

1. Top-right avatar → Account → **Access Tokens**.
2. **Generate new token**, name it `gettoit-cli`.
3. Copy once → `SUPABASE_ACCESS_TOKEN` in `.env`. The dashboard won't show it again.

## Step 4 — Enable anonymous auth

Per [[adr/0007-auth-anonymous-default-apple-upgrade|ADR-0007]], anonymous auth is the default sign-in path; Apple is an opt-in upgrade.

1. Sidebar → **Authentication → Providers**.
2. **Anonymous Sign-ins** → toggle **on**.

The Apple provider is configured separately in [[apple-keys-setup|apple-keys-setup.md §Key 2]].

## Step 5 — Enable Postgres extensions

Sidebar → **Database → Extensions**. Search and enable each:

| Extension | Used for |
|---|---|
| `postgis` | `geography` type for radius queries on the Foursquare cache ([[../15_issues/0.1.0/issues/tb-05-foursquare-placesproxy\|TB-05]]) |
| `pg_cron` | Scheduled jobs — auto-expire rooms ([[../15_issues/0.1.0/issues/tb-07-waiting-realtime-fire-trigger\|TB-07]]), next-day check-ins ([[../15_issues/0.1.0/issues/tb-14-checkin-telemetry\|TB-14]]) |
| `pgmq` | Message queue — fire-trigger ([[../15_issues/0.1.0/issues/tb-07-waiting-realtime-fire-trigger\|TB-07]]), hard-close ([[../15_issues/0.1.0/issues/tb-08-ratification-push-hard-close\|TB-08]]) |

If `pgmq` doesn't appear in the list, the project is on a Postgres version older than 15.6 — file a Supabase support ticket. Projects provisioned 2025+ on Pro should have it by default.

## Step 6 — Verify from a local shell

```bash
set -a && source /workspace/.env && set +a
supabase login --token "$SUPABASE_ACCESS_TOKEN"
supabase projects list                       # should list gettoit-prod
supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
```

Sanity-check the extensions over the Management API (avoids creating real DB connections):

```bash
supabase db query --linked --output table \
  "SELECT extname, extversion FROM pg_extension
   WHERE extname IN ('postgis','pg_cron','pgmq') ORDER BY extname;"
```

Expect 3 rows. Reference versions from initial provisioning (2026-05-13): `postgis 3.3.7`, `pg_cron 1.6.4`, `pgmq 1.5.1`.

Confirm anonymous auth is on (Management API; no anon user created):

```bash
curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/0.1.0/projects/$SUPABASE_PROJECT_REF/config/auth" \
  | grep -oE '"external_anonymous_users_enabled":[^,}]*'
# expect: "external_anonymous_users_enabled":true
```

## Step 7 — Mirror to GitHub Actions secrets

Three secrets are needed in CI (`db push`, `db dump`, scheduled migrations). The anon/service-role keys are not — Edge Functions read them from the Supabase runtime directly, and CI doesn't talk to the app's REST surface.

```bash
gh secret set SUPABASE_ACCESS_TOKEN --body "$SUPABASE_ACCESS_TOKEN"
gh secret set SUPABASE_DB_PASSWORD  --body "$SUPABASE_DB_PASSWORD"
gh secret set SUPABASE_PROJECT_REF  --body "$SUPABASE_PROJECT_REF"
```

Verify:

```bash
gh secret list | grep SUPABASE
```

See [[github-actions-secrets|github-actions-secrets.md]] for the full secret roster.

## Gotchas

- **`supabase link` writes `supabase/.temp/pooler-url` in plaintext, password and all.** Ensure `supabase/.temp/` and `supabase/.branches/` are in `.gitignore` *before* running `link`. (Already added to `.gitignore` 2026-05-13.)
- **`GH_TOKEN` in `.env` overrides gh CLI's stored auth.** If `gh secret set` returns `403 Resource not accessible by personal access token`, the fine-grained PAT in `.env` is missing the **Secrets: read/write** permission. Either bump the PAT permissions OR run the secret-set commands in a subshell with `unset GH_TOKEN GITHUB_TOKEN` so gh falls back to its OAuth login. See [[github-actions-secrets|github-actions-secrets.md]].
- **Region is sticky.** No move button. Migrating regions = new project + `pg_dump` / `pg_restore`. Pick once.
- **DB password is one-shot.** Lose it = reset via dashboard, then update every place it's cached (`.env`, `gh secret`, any local `supabase/.temp/`).
- **`service_role` key in client-side code is catastrophic.** It bypasses RLS. Audit `.env` reads — only Edge Functions and CI should see it.
- **`supabase db query` defaults to local.** Always pass `--linked` for remote ops, or set up `supabase start` for genuine local dev when Docker is available.
- **Anonymous users count toward MAU billing.** Pro plan includes 100k MAU; the pre-S00a anonymous-default path makes every visitor a MAU. Watch the [Auth dashboard usage panel] once the app is live — if MAU growth outpaces conversion, consider rate-limiting anon signup at the Edge.
- **Pooler vs direct connection**: `supabase link` uses the transaction-pooler URL (port 6543) by default; CI migrations need the direct connection (port 5432). The `supabase db push` CLI handles the switch; raw `psql` callers don't.

## Edge Function deploy (CI lane `edge-deploy`)

Added 2026-05-16 for [[../15_issues/0.1.0/issues/tb-14-restore-placesproxy-foursquare-path|tb-14]].

**Root cause tb-14 closed.** The `places-proxy` Edge Function was written,
unit-tested, and merged in 0.1.0's TB-05 — but nothing ever deployed it. CI
had an `edge` lane (`deno test` over `supabase/functions/`) and a
`supabase-db` lane (`supabase db push`), but **no lane ever ran
`supabase functions deploy`**. The function stayed dark on the live
project, so every quiz session fell through to the on-device MapKit
fallback and Foursquare was never reached.

**The fix** is the `edge-deploy` job in `.github/workflows/ci.yml`:

- Runs `supabase secrets set FOURSQUARE_API_KEY=…` so the function
  runtime has the upstream key. A missing key makes the handler return
  `places_proxy_misconfigured`. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
  are injected automatically by the Supabase platform — they do **not**
  need to be set as function secrets.
- Runs `supabase functions deploy places-proxy` plus the companion
  functions (`apns-sender`, `compute-verdict`, `delete-user`).
- `needs: supabase-db` — deploys only after the migration push, so the
  `places` cache table the handler upserts into already exists.
- Gated to `push` on `refs/heads/main` (or `workflow_dispatch`).
  Deploying on a PR would race the migration push and could ship a
  function ahead of its schema. Skips itself when the Supabase
  credentials are absent (fork / unconfigured clone) — the same gate
  shape `supabase-db` and `testflight` use.
- Final step runs `places-proxy/live-integration.test.ts` against the
  just-deployed function. The test has two tiers:
  - **Tier 1 — deploy contract** (hard CI gate): asserts HTTP 200, not
    `places_proxy_misconfigured`, and a well-formed envelope. A
    regression here means the deploy lane broke.
  - **Tier 2 — Foursquare data quality** (diagnostic, not a gate): logs
    a loud warning if the response carries no Foursquare rows. It is
    deliberately non-blocking — see below.

**Known follow-up (2026-05-16).** The post-merge run proved the deploy
+ secrets steps succeed and the function answers 200 — but Foursquare
still returns zero rows. That is a bad/expired key or a stale
`X-Places-Api-Version` pin, outside tb-14's deploy scope. Tracked in
[[../15_issues/0.1.0/placesproxy-empty-foursquare-results|placesproxy-empty-foursquare-results]].
Diagnose with `supabase functions logs places-proxy` (reads the
upstream Foursquare HTTP status the handler logs); once fixed, promote
Tier 2 of the live test from warnings to hard asserts.

**Founder check still open** — tb-14 acceptance criterion #5 (a non-zero
call count on the Foursquare developer dashboard after a real Q5 session)
is a human verification step, not an AFK gate.

## Rotation

- **`SUPABASE_DB_PASSWORD`** — rotate via dashboard → Settings → Database → Reset password. Update `.env` and `gh secret set SUPABASE_DB_PASSWORD --body "$NEW"` atomically.
- **`SUPABASE_SERVICE_ROLE_KEY`** — Settings → API → "Reset service-role key". Update `.env` + every Edge Function that reads it. Any in-flight requests holding the old key will start failing.
- **`SUPABASE_ANON_KEY`** — Settings → API → "Reset anon key". Forces every existing iOS/web client to re-fetch; ship a client update before rotating in production.
- **`SUPABASE_ACCESS_TOKEN`** (the PAT) — Account → Access Tokens → revoke + regenerate. Update `.env` + `gh secret set SUPABASE_ACCESS_TOKEN --body "$NEW"`.

Annual cadence by default. Rotate immediately if any value lands in a git diff, Slack message, or screenshot.
