---
issue: tb-01
title: Walking skeleton — monorepo, Swift token generator, anon auth hello-world
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
---

# TB-01 — Walking skeleton

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The first end-to-end vertical slice. The iOS app boots, signs in anonymously against the Supabase project, and displays its `user_id` on screen. The web app is scaffolded but only renders a placeholder. The design-system Swift token generator is in place so no later iOS work touches raw hex.

- **Monorepo scaffolding** per [[../../../60_engineering/adr/0004-monorepo-layout|ADR 0004]] — `ios/`, `web/`, `supabase/functions/`, `docs/` siblings of the existing `design-system/` and `gti-vault/`. Add a top-level `package.json` (workspaces optional), an `.editorconfig`, and a unified `.gitignore`.
- **iOS Xcode project** in `ios/` — SwiftUI App template, iOS 17 minimum deployment target per [[../../../60_engineering/adr/0008-ios-min-target-17|ADR 0008]]. Bundle ID matches TB-00. Add `supabase-swift` via Swift Package Manager.
- **`design-system/scripts/gen-swift.mjs`** — reads `design-system/tokens.json`, emits `ios/Sources/GTITokens.swift` with `GTIColor` enum, `GTIGradient` helper, `GTIFont` constants, motion duration / easing constants, spacing / radii numeric constants. Idempotent — `--check` mode for CI. Extend `design-system/scripts/verify.mjs` to require Swift output be byte-identical to a fresh regeneration.
- **Web app** in `web/` — Next.js App Router with `app/page.tsx` rendering a placeholder. Pull `design-system/code/tokens.css` directly. No supabase-js yet beyond the dependency install.
- **Supabase migrations baseline** in `supabase/migrations/` — empty bootstrap migration that enables PostGIS, pg_cron, pgmq. No tables yet.
- **iOS hello-world flow** — on app launch, the app calls `signInAnonymously()`, renders a single screen showing `"User ID: <uuid>"`. Integration test: anon auth succeeds, JWT contains expected claims.
- **CI workflow** — single GitHub Actions workflow runs four lanes: `xcodebuild test`, `deno test` (empty for now), `node design-system/scripts/verify.mjs`, web build. Per [[../../../60_engineering/adr/0004-monorepo-layout|ADR 0004]] §"One CI lane."

## Acceptance criteria

- [ ] Repo has `ios/`, `web/`, `supabase/`, `docs/` siblings of `design-system/` and `gti-vault/`.
- [ ] `node design-system/scripts/gen-swift.mjs` writes `ios/Sources/GTITokens.swift`; `--check` mode passes.
- [ ] `node design-system/scripts/verify.mjs` includes the Swift output in its byte-identical check.
- [ ] iOS app builds on iOS 17 simulator, signs in anonymously, displays `user_id` on launch.
- [ ] Integration test for anon auth passes.
- [ ] CI workflow runs all four lanes green.

## Blocked by

- [[tb-00-external-accounts|TB-00]]
