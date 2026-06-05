---
title: GitHub Actions secrets
description: Secret roster for CI, TestFlight upload, Supabase deploys, and live smoke tests.
type: runbook
status: active
created: 2026-06-02
related:
  - "[[apple-keys-setup]]"
  - "[[supabase-setup]]"
  - "[[ios-ci-setup]]"
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# GitHub Actions Secrets

GitHub Issues and CI are remote; Codex runs in its own sandbox and does not need a repo devcontainer. This runbook is the durable secret roster that replaced the old devcontainer setup note.

## Required Secrets

| Secret | Used by | Source |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase DB push, Edge Function deploy, Management API calls | Supabase account access token |
| `SUPABASE_DB_PASSWORD` | `supabase link` / `supabase db push` | Supabase project database password |
| `SUPABASE_PROJECT_REF` | Supabase DB push and function deploy | Supabase project settings |
| `SUPABASE_PROJECT_URL` | iOS tests, Edge live integration tests | Supabase project API URL |
| `SUPABASE_ANON_KEY` | iOS tests, Edge live integration tests | Supabase project API settings |
| `SUPABASE_SERVICE_ROLE_KEY` | CI seeds private `app_config` rows | Supabase project API settings |
| `FOURSQUARE_API_KEY` | `places-proxy` Edge Function runtime secret push | Foursquare developer dashboard |
| `CLAIM_CODE_ENC_KEY` | Claim-code Edge Functions | `openssl rand -base64 32` |
| `EXPO_TOKEN` | Expo EAS TestFlight workflow for `mobile/` | Expo account access token |
| `APP_STORE_CONNECT_API_KEY_ID` | TestFlight archive/export/upload | App Store Connect API key |
| `APP_STORE_CONNECT_API_KEY_ISSUER_ID` | TestFlight archive/export/upload | App Store Connect API key |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | TestFlight archive/export/upload | Base64 of the App Store Connect `.p8` file |

## Setting Secrets

Use GitHub's web UI or `gh secret set` from a trusted local shell:

```sh
gh secret set SUPABASE_ACCESS_TOKEN --body "$SUPABASE_ACCESS_TOKEN"
gh secret set SUPABASE_DB_PASSWORD --body "$SUPABASE_DB_PASSWORD"
gh secret set SUPABASE_PROJECT_REF --body "$SUPABASE_PROJECT_REF"
gh secret set SUPABASE_PROJECT_URL --body "$SUPABASE_PROJECT_URL"
gh secret set SUPABASE_ANON_KEY --body "$SUPABASE_ANON_KEY"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "$SUPABASE_SERVICE_ROLE_KEY"
gh secret set FOURSQUARE_API_KEY --body "$FOURSQUARE_API_KEY"
gh secret set CLAIM_CODE_ENC_KEY --body "$CLAIM_CODE_ENC_KEY"
gh secret set EXPO_TOKEN --body "$EXPO_TOKEN"
gh secret set APP_STORE_CONNECT_API_KEY_ID --body "$APP_STORE_CONNECT_API_KEY_ID"
gh secret set APP_STORE_CONNECT_API_KEY_ISSUER_ID --body "$APP_STORE_CONNECT_API_KEY_ISSUER_ID"
gh secret set APP_STORE_CONNECT_API_KEY_CONTENT --body "$APP_STORE_CONNECT_API_KEY_CONTENT"
```

`EXPO_TOKEN` may also be stored as an environment secret scoped to the GitHub Environment named `testflight`. Configure that environment with required reviewers so manual TestFlight dispatches pause for approval before EAS runs.

For the App Store Connect key content:

```sh
base64 -i AuthKey_<KEY_ID>.p8 | pbcopy
```

On Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_<KEY_ID>.p8"))
```

## Verification

```sh
gh secret list
```

Secrets are write-only in GitHub. To prove they are populated, run the relevant workflow and inspect its gate step output; populated values render as `***`, empty values render as empty strings.

## Notes

- `SUPABASE_SERVICE_ROLE_KEY` must never ship to a client.
- `EXPO_TOKEN` is the active Expo mobile release secret. The legacy App Store Connect secrets are historical Swift/TestFlight release material unless a human explicitly reopens that path.
- Supabase Edge Function runtime secrets that are not pushed by CI, such as APNs secrets, should be set in Supabase directly.
- If `GH_TOKEN` or `GITHUB_TOKEN` is set locally, `gh` may use that token instead of the browser-authenticated account. If `gh secret set` returns a permissions error, unset those variables and retry from the trusted shell.
