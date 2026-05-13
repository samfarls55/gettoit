---
title: Devcontainer setup for AFK agent
description: Step-by-step setup for the Claude Code container so it can build, test, and ship the v1 issue set end-to-end without a Mac.
type: runbook
status: active
created: 2026-05-13
related:
  - "[[../15_issues/v1/issues/tb-00-external-accounts]]"
  - "[[../15_issues/v1/issues/tb-01-walking-skeleton]]"
  - "[[adr/0001-ios-tech-stack-supabase]]"
  - "[[adr/0008-ios-min-target-17]]"
---

# Devcontainer setup for AFK agent

## What this is

Step-by-step rebuild instructions for the Claude Code devcontainer so an agent can execute the v1 tracer-bullet issues without a Mac. The container handles all code editing, web/edge testing, and CI orchestration; iOS builds happen on free `macos-latest` GitHub Actions runners (only possible because the repo is public).

## Premise

- **iOS toolchain (Xcode, SwiftUI, UIKit) is macOS-only.** No Linux port exists. Container cannot run `xcodebuild`.
- **Free macOS CI minutes require a public repo.** Private repos charge ~$0.08/min on `macos-latest`. The plan below assumes `samfarls55/gettoit` is public.
- **No Mac, ever.** Even App Store submission is automated via App Store Connect API key — no human at a Mac required at any step.
- **Local Swift toolchain (Linux) is useful for non-UI code only.** Catches roughly half the iOS bugs (logic, models, supabase-swift wrappers) before the CI round-trip.

## Pre-reqs (do these before rebuilding)

1. **TB-00 complete.** See [[../15_issues/v1/issues/tb-00-external-accounts]]. Specifically:
   - Apple Developer account approved, Bundle ID reserved
   - **App Store Connect API key generated** (Users and Access → Integrations → App Store Connect API). Save the Key ID, Issuer ID, and `.p8` file
   - Foursquare API key generated
   - Supabase Pro project provisioned (URL, anon key, service-role key)
   - `gettoit.app` DNS pointed at Vercel placeholder
2. **Repo flipped to public.** Settings → Danger Zone → Change visibility. Confirms free macOS CI.
3. **Personal Access Token (fine-grained) created** for `gh auth` inside container. Scope: this repo only, with `Contents: read/write`, `Pull requests: read/write`, `Issues: read/write`, `Workflows: read/write`, `Actions: read/write`, `Secrets: read/write` (or skip Secrets scope and set them once manually via the web UI).

## Step 1 — Update `.devcontainer/Dockerfile`

Append after the existing `apt-get install` block, before the `USER node` switch:

```dockerfile
# Swift toolchain (Linux) — for sourcekit-lsp, swift-format, syntax checks on non-UI code
ARG SWIFT_VERSION=5.10
RUN ARCH=$(dpkg --print-architecture) \
    && SWIFT_PLATFORM=ubuntu22.04 \
    && [ "$ARCH" = "arm64" ] && SWIFT_PLATFORM=ubuntu22.04-aarch64 || true \
    && wget -q "https://download.swift.org/swift-${SWIFT_VERSION}-release/${SWIFT_PLATFORM/.*/}/swift-${SWIFT_VERSION}-RELEASE/swift-${SWIFT_VERSION}-RELEASE-${SWIFT_PLATFORM}.tar.gz" \
    && tar xzf "swift-${SWIFT_VERSION}-RELEASE-${SWIFT_PLATFORM}.tar.gz" -C /opt \
    && ln -s "/opt/swift-${SWIFT_VERSION}-RELEASE-${SWIFT_PLATFORM}/usr/bin/swift" /usr/local/bin/swift \
    && ln -s "/opt/swift-${SWIFT_VERSION}-RELEASE-${SWIFT_PLATFORM}/usr/bin/sourcekit-lsp" /usr/local/bin/sourcekit-lsp \
    && rm "swift-${SWIFT_VERSION}-RELEASE-${SWIFT_PLATFORM}.tar.gz"

# SwiftLint (Linux release binary)
RUN wget -q https://github.com/realm/SwiftLint/releases/latest/download/swiftlint_linux.zip \
    && unzip -o swiftlint_linux.zip -d /usr/local/bin \
    && rm swiftlint_linux.zip

# Deno (for Supabase Edge Functions)
RUN curl -fsSL https://deno.land/install.sh | sh -s -- --no-modify-path \
    && mv ~/.deno/bin/deno /usr/local/bin/deno

# Supabase CLI
RUN curl -fsSL -o /tmp/supabase.tar.gz https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
    && tar xzf /tmp/supabase.tar.gz -C /usr/local/bin supabase \
    && rm /tmp/supabase.tar.gz

# Vercel CLI (npm global)
RUN npm install -g vercel@latest
```

Pin specific versions (Swift, Supabase CLI, etc.) once the first green CI run confirms the combination works.

## Step 2 — Widen the firewall whitelist (optional, do later)

`postStartCommand` in `.devcontainer/devcontainer.json` is currently commented out, so the firewall doesn't apply. **Leave it commented during initial build-out** — locking down before the toolchain is stable turns every package install into a debugging session.

When ready to re-enable, append to the `for domain in \` loop in `.devcontainer/init-firewall.sh`:

```
"supabase.com" \
"api.supabase.io" \
"developer.apple.com" \
"appstoreconnect.apple.com" \
"api.appstoreconnect.apple.com" \
"deno.land" \
"jsr.io" \
"vercel.com" \
"api.vercel.com" \
"api.foursquare.com" \
"swift.org" \
"download.swift.org" \
"nextjs.org" \
"gettoit.app" \
```

Note: Supabase project endpoints use a UUID subdomain of `*.supabase.co` — `ipset` can't wildcard, so you'll need a per-project rule like `dig +short <project-ref>.supabase.co | xargs -I{} ipset add allowed-domains {}` once the project ref is known.

Then uncomment `postStartCommand` and `waitFor` lines in `devcontainer.json`.

## Step 3 — Inject container secrets via `.env`

Template lives at repo root as `.env.example`. It enumerates every var with a comment pointing at its source.

```bash
cp .env.example .env
# fill in real values (TB-00 outputs)
```

`.env` is gitignored (`.gitignore` has `.env` blocked and `!.env.example` allow-listed). Load it into the container shell by appending to `~/.zshrc`:

```bash
set -a && source /workspace/.env && set +a
```

Or — preferred — wire it into `devcontainer.json` so all processes in the container see the vars (not just the interactive shell):

```jsonc
"runArgs": ["--env-file", "${localWorkspaceFolder}/.env", "--cap-add=NET_ADMIN", "--cap-add=NET_RAW"]
```

Rebuild needed after the second option.

## Step 4 — Set GitHub Actions secrets

Run from your local machine (or the container, after `gh auth` works):

```bash
gh secret set APPLE_API_KEY_ID --body "<key id from App Store Connect>"
gh secret set APPLE_API_ISSUER_ID --body "<issuer id>"
gh secret set APPLE_API_PRIVATE_KEY < AuthKey_XXXX.p8
gh secret set APPLE_TEAM_ID --body "<team id from developer.apple.com>"
gh secret set SUPABASE_ACCESS_TOKEN --body "<token>"
gh secret set SUPABASE_DB_PASSWORD --body "<db password>"
gh secret set SUPABASE_PROJECT_REF --body "<project ref>"
gh secret set FOURSQUARE_API_KEY --body "<key>"
gh secret set VERCEL_TOKEN --body "<token>"
gh secret set VERCEL_ORG_ID --body "<org id>"
gh secret set VERCEL_PROJECT_ID --body "<project id>"
```

The macOS CI runner uses the Apple API key for both code signing (Apple's Cloud Managed Distribution Certificates handle the cert; the API key authorises it) and TestFlight upload via `xcrun altool --upload-app`. No `.p12` cert distribution, no `fastlane match` repo.

> **Gotcha — `gh secret set` returns 403 from the container.** When `GH_TOKEN` is set in the environment (e.g. via `source /workspace/.env`), gh CLI uses it instead of its stored OAuth login. If the fine-grained PAT in `.env` was created without **Secrets: read/write** (the older `.env.example` template omitted it before 2026-05-13), every `gh secret set` call above fails with `Resource not accessible by personal access token`. Fix: either regenerate the PAT with the Secrets permission added, or run the secret-set block in a subshell that strips the env override: `( unset GH_TOKEN GITHUB_TOKEN; gh secret set … )`. The pre-req list above (Step 36) is the canonical scope list.

## Step 5 — Commit `.claude/settings.json`

Project-scoped allowlist. Path: `/workspace/.claude/settings.json` (the committed one, not `settings.local.json`).

```json
{
  "permissions": {
    "allow": [
      "Bash(gh issue:*)", "Bash(gh pr:*)", "Bash(gh label:*)",
      "Bash(gh api:*)", "Bash(gh workflow:*)", "Bash(gh run:*)",
      "Bash(gh secret:*)", "Bash(gh repo:*)", "Bash(gh release:*)",
      "Bash(git:*)",
      "Bash(npm:*)", "Bash(npx:*)", "Bash(node:*)", "Bash(yarn:*)",
      "Bash(swift:*)", "Bash(swiftlint:*)", "Bash(swift-format:*)",
      "Bash(supabase:*)", "Bash(deno:*)", "Bash(vercel:*)",
      "Bash(curl:*)", "Bash(jq:*)",
      "WebSearch",
      "WebFetch(domain:supabase.com)",
      "WebFetch(domain:foursquare.com)",
      "WebFetch(domain:developer.apple.com)",
      "WebFetch(domain:vercel.com)",
      "WebFetch(domain:nextjs.org)",
      "WebFetch(domain:deno.land)",
      "WebFetch(domain:docs.github.com)",
      "WebFetch(domain:swift.org)",
      "WebFetch(domain:github.com)"
    ],
    "deny": [
      "Bash(git push --force*)",
      "Bash(git push -f*)",
      "Bash(git reset --hard*)",
      "Bash(rm -rf /*)"
    ]
  }
}
```

## Step 6 — Rebuild and verify

After Dockerfile and `devcontainer.json` changes:

1. **VS Code Command Palette → "Dev Containers: Rebuild Container"**.
2. Wait for build (5–10 min cold).
3. Inside container, verify toolchain:
   ```bash
   swift --version          # 5.10
   sourcekit-lsp --help     # exists
   swiftlint version
   deno --version
   supabase --version
   vercel --version
   gh --version
   ```
4. Verify auth:
   ```bash
   gh auth status           # logged in via GH_TOKEN
   supabase projects list   # works via SUPABASE_ACCESS_TOKEN
   ```
5. Verify secrets visible:
   ```bash
   gh secret list           # shows the 11 secrets set in Step 4
   ```

If any step fails, fix before unleashing the agent. The first failure compounds.

## Step 7 — Unleash agent on TB-01

Start the agent on [[../15_issues/v1/issues/tb-01-walking-skeleton]]. Expected flow:

1. Agent scaffolds `ios/`, `web/`, `supabase/`, `docs/`, writes `gen-swift.mjs`, writes `.github/workflows/ci.yml`.
2. Agent runs `node design-system/scripts/verify.mjs` locally — passes.
3. Agent runs `swift build` against the non-UI Swift portions — passes (or fails with type errors agent fixes).
4. Agent pushes branch, opens PR.
5. CI runs four lanes; first run probably fails (Xcode project misconfigured, simulator OS mismatch, etc.).
6. Agent reads CI logs via `gh run watch`, iterates.
7. Loop until green. Merge. On to TB-02.

## Realistic caveats

- **CI iteration is 3–5x slower than local Xcode.** A 30-second SwiftUI tweak becomes a 5-minute round-trip. Acceptable for tracer-bullet vertical slices. Painful for pixel-level choreography (TB-08 verdict screen). Mitigation: snapshot tests on simulator with artifacts uploaded — you eyeball PR artifact PNGs to approve visual changes.
- **`xcodebuild` toolchain choice matters.** Pin a specific Xcode version in CI (`maxim-lobanov/setup-xcode@v1` with `xcode-version: '15.4'`). Floating versions cause CI to break on Xcode releases.
- **Free macOS minutes are unlimited but slow.** Each job ~5–10 min cold. If you push 20 PRs in a day, expect to wait. Public repos don't have a minute cap but jobs queue.
- **Supabase local development typically uses Docker.** Running Docker-in-Docker inside this devcontainer is messy. Skip it — use the hosted Supabase project for everything. `supabase functions serve` for local edge function dev works without Docker.
- **TestFlight build needs at least one manual review** in App Store Connect before external testers see it. The upload is automated; the "submit for review" tap is one click on the web UI.

## Maintenance

- Re-pin Swift / Supabase CLI / Vercel CLI versions in the Dockerfile after each major version bump tests cleanly.
- Rotate the Apple API key annually (Apple expires keys after 1 year by default — App Store Connect surfaces the expiry date).
- Audit `.claude/settings.json` `allow` list quarterly; remove entries no longer used.
