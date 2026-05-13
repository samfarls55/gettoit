---
title: Apple keys — setup runbook
type: runbook
created: 2026-05-13
related:
  - "[[../15_issues/v1/issues/tb-00-external-accounts]]"
  - "[[../15_issues/v1/issues/tb-12-apple-signin-upgrade]]"
  - "[[devcontainer-setup]]"
  - "[[adr/0002-places-data-foursquare-mapkit]]"
  - "[[adr/0007-auth-anonymous-default-apple-upgrade]]"
---

# Apple keys — setup runbook

Step-by-step for obtaining and wiring the Apple credentials v1 needs. Pairs with [[devcontainer-setup|devcontainer-setup.md]] (which covers the `gh secret set` commands) and the issues above.

## Summary — what v1 actually needs

| Key | Used for | Where it lives | Status |
|---|---|---|---|
| App Store Connect API key (`.p8`) | CI uploads to TestFlight, App Store submission via `xcrun altool` | GitHub Actions secrets | Required |
| Sign in with Apple key (`.p8`) | Supabase verifies Apple identity tokens server-side ([[../15_issues/v1/issues/tb-12-apple-signin-upgrade\|TB-12]]) | Supabase dashboard (Auth → Providers → Apple) | Required |
| MapKit JS key | Embedding Apple Maps on a webpage | — | **Not needed.** Per [[adr/0002-places-data-foursquare-mapkit\|ADR-0002]], native iOS uses MapKit framework (no key); web fallback skips MapKit entirely (Foursquare-only). |

Native iOS MapKit (`import MapKit`) needs zero keys. Skip MapKit JS for v1.

## Prerequisites (one-time)

1. Apple Developer Program membership — $99/year. Individual approval is usually 24–48h; org enrollment needs a DUNS number (1–2 weeks).
2. Apple ID with 2FA enabled.
3. Account Holder or Admin role in App Store Connect.
4. **Team ID** — find at https://developer.apple.com/account → Membership. 10-char string. Same value for every key below. Maps to `APPLE_TEAM_ID` in `.env.example` and the corresponding GitHub Actions secret.

## Key 1 — App Store Connect API key

Used by CI to upload builds and manage TestFlight/App Store. The `.p8` is the private key; pair with Key ID + Issuer ID + Team ID.

### Generate

1. https://appstoreconnect.apple.com → **Users and Access**.
2. Top tab **Integrations** → sub-tab **App Store Connect API** → **Team Keys**.
3. **+** → name `getoit-ci` → access **App Manager** (enough for TestFlight + submit; don't use Admin unless you need it).
4. **Generate**. **Download the `.p8` immediately** — Apple does not allow re-download. One shot.
5. Record:
   - **Key ID** (10 chars, in the key list) → `APPLE_API_KEY_ID`
   - **Issuer ID** (UUID at top of the page) → `APPLE_API_ISSUER_ID`
   - `.p8` path → `APPLE_API_PRIVATE_KEY_PATH` (local-only; CI stores contents)

### Store locally

```bash
mkdir -p ~/.appstoreconnect
mv ~/Downloads/AuthKey_*.p8 ~/.appstoreconnect/
chmod 600 ~/.appstoreconnect/*.p8
```

Never commit. Never email/Slack/Drive.

### Wire into CI

Run from your local machine (`gh` authenticated):

```bash
gh secret set APPLE_TEAM_ID --body "<team id>"
gh secret set APPLE_API_KEY_ID --body "<key id>"
gh secret set APPLE_API_ISSUER_ID --body "<issuer id>"
gh secret set APPLE_API_PRIVATE_KEY < ~/.appstoreconnect/AuthKey_XXXXX.p8
```

Verify:

```bash
gh secret list | grep APPLE
```

These four are referenced by the iOS workflow when it lands (see [[devcontainer-setup|devcontainer-setup.md]] Step 4 for the full secret roster).

### Rotation

Rotate annually. Generate new key → swap the four secrets → revoke the old key in App Store Connect. No downtime if the swap is atomic.

## Key 2 — Sign in with Apple key

Used by **Supabase** to mint the OAuth client_secret JWT and verify Apple identity tokens. Native iOS Sign in with Apple (`ASAuthorizationAppleIDProvider`) on-device does **not** need this `.p8` — only the server side does.

### Prereq — App ID + Services ID

Skip whichever already exists.

**App ID** (the app binary identifier):

1. https://developer.apple.com/account/resources → **Identifiers** → **+** → **App IDs** → **App**.
2. Description: `GetToIt`. Bundle ID: `app.gettoit.GetToIt` (matches `APPLE_BUNDLE_ID`).
3. Capabilities: tick **Sign in with Apple**. Continue → Register.

**Services ID** (the OAuth `client_id` Supabase uses):

1. **Identifiers** → **+** → **Services IDs**.
2. Description: `GetToIt Sign In`. Identifier: `app.gettoit.GetToIt.signin` (must differ from the Bundle ID).
3. Register, then click into it → tick **Sign in with Apple** → **Configure**:
   - Primary App ID: the App ID above.
   - Domain: `<project-ref>.supabase.co`
   - Return URL: `https://<project-ref>.supabase.co/auth/v1/callback`

### Generate the key

1. **Keys** (sidebar) → **+**.
2. Name `GetToIt Sign in with Apple` → tick **Sign in with Apple** → **Configure** → pick the App ID.
3. Register → **download the `.p8` immediately**.
4. Record Key ID (10 chars) and Team ID.

### Wire into Supabase

Supabase Dashboard → **Authentication → Providers → Apple**:

- Enable.
- **Client IDs**: `app.gettoit.GetToIt.signin` (the Services ID).
- **Secret Key (for OAuth)**: paste the full contents of the `.p8` file (`-----BEGIN PRIVATE KEY-----` lines and all).
- **Key ID**: 10-char Key ID.
- **Team ID**: 10-char Team ID.

Supabase mints the JWT client_secret internally; you don't manage that token.

No `gh secret` entries needed — Supabase holds these credentials, not CI.

### Rotation

Same yearly cadence as #1. Generate new → update Supabase → revoke old.

## Key 3 — MapKit JS

**Skip.** Not required for v1. Documented here so the question doesn't get re-asked.

- Native iOS MapKit POI search needs no key — per [[adr/0002-places-data-foursquare-mapkit|ADR-0002]] it's the fallback to Foursquare on iOS.
- Web fallback ([[../15_issues/v1/issues/tb-15-web-fallback|TB-15]]) does not embed Apple Maps — Foursquare-only, degrade to error if Foursquare is down.

Revisit only if a future web feature genuinely needs Apple Maps embeds, in which case MapKit JS adds a server-side JWT-minting endpoint to the architecture (the `.p8` signs short-lived JWTs delivered to the browser).

## Gotchas

- **`.p8` files are one-shot downloads.** Apple does not let you re-download. If lost: revoke + regenerate.
- **Bundle ID ≠ Services ID.** Bundle ID identifies the app binary (`app.gettoit.GetToIt`). Services ID is a separate identifier used as the OAuth `client_id` for web/server flows (`app.gettoit.GetToIt.signin`). They must be distinct strings.
- **Team ID is shared** across every Apple key — record once, reuse everywhere.
- **Newline corruption in CI secrets**: prefer `gh secret set APPLE_API_PRIVATE_KEY < file.p8` (stdin) over `--body "$(cat file.p8)"` (shell may strip newlines). If you hit issues anyway, base64-encode: `base64 -i AuthKey_XXX.p8 | gh secret set APPLE_API_PRIVATE_KEY_B64`, then decode in the workflow.
- **Trusted device for 2FA**: enrollment flows push 2FA prompts to your most-recently-active Apple device. Make sure that device is reachable.
- **Account Holder transfer**: only the Account Holder can generate App Store Connect API keys. If the founder ever transfers ownership of the developer account, the new holder regenerates keys.
