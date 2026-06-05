---
issue: tb-01
title: Walking skeleton â€” monorepo, Swift token generator, anon auth hello-world
github_issue: 2
status: done
type: AFK
created: 2026-05-12
completed: 2026-05-13
prd: 0.1.0-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-01 â€” Walking skeleton

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

## What to build

The first end-to-end vertical slice. The iOS app boots, signs in anonymously against the Supabase project, and displays its `user_id` on screen. The web app is scaffolded but only renders a placeholder. The design-system Swift token generator is in place so no later iOS work touches raw hex.

- **Monorepo scaffolding** per [[../../../60_engineering/adr/0004-monorepo-layout|ADR 0004]] â€” `ios/`, `web/`, `supabase/functions/`, `docs/` siblings of the existing `design-system/` and `gti-vault/`. Add a top-level `package.json` (workspaces optional), an `.editorconfig`, and a unified `.gitignore`.
- **iOS Xcode project** in `ios/` â€” SwiftUI App template, iOS 17 minimum deployment target per [[../../../60_engineering/adr/0008-ios-min-target-17|ADR 0008]]. Bundle ID matches TB-00. Add `supabase-swift` via Swift Package Manager.
- **`design-system/scripts/gen-swift.mjs`** â€” reads `design-system/tokens.json`, emits `ios/Sources/GTITokens.swift` with `GTIColor` enum, `GTIGradient` helper, `GTIFont` constants, motion duration / easing constants, spacing / radii numeric constants. Idempotent â€” `--check` mode for CI. Extend `design-system/scripts/verify.mjs` to require Swift output be byte-identical to a fresh regeneration.
- **Web app** in `web/` â€” Next.js App Router with `app/page.tsx` rendering a placeholder. Pull `design-system/code/tokens.css` directly. No supabase-js yet beyond the dependency install.
- **Supabase migrations baseline** in `supabase/migrations/` â€” empty bootstrap migration that enables PostGIS, pg_cron, pgmq. No tables yet.
- **iOS hello-world flow** â€” on app launch, the app calls `signInAnonymously()`, renders a single screen showing `"User ID: <uuid>"`. Integration test: anon auth succeeds, JWT contains expected claims.
- **CI workflow** â€” single GitHub Actions workflow runs four lanes: `xcodebuild test`, `deno test` (empty for now), `node design-system/scripts/verify.mjs`, web build. Per [[../../../60_engineering/adr/0004-monorepo-layout|ADR 0004]] Â§"One CI lane."

## Acceptance criteria

- [x] Repo has `ios/`, `web/`, `supabase/`, `docs/` siblings of `design-system/` and `gti-vault/`. _(2026-05-13)_
- [x] `node design-system/scripts/gen-swift.mjs` writes `ios/Sources/GTITokens.swift`; `--check` mode passes. _(2026-05-13)_
- [x] `node design-system/scripts/verify.mjs` includes the Swift output in its byte-identical check. _(2026-05-13)_
- [x] iOS app builds on iOS 17 simulator, signs in anonymously, displays `user_id` on launch. _(2026-05-13 â€” iOS 17.5 sim under Xcode 16.2 on macOS-14 runner)_
- [x] Integration test for anon auth passes. _(2026-05-13)_
- [x] CI workflow runs all four lanes green. _(2026-05-13 â€” PR #24)_

## Blocked by

- [[tb-00-external-accounts|TB-00]] _(satisfied)_

## Comments

### 2026-05-13 â€” Landed (PR #24)

Landed in [PR #24](https://github.com/samfarls55/gettoit/pull/24). Three follow-up CI fixes on top of the initial agent's branch:

1. **Xcode version pin removed.** Initial workflow pinned `Xcode_15.4`. XcodeGen 2.45+ emits project format objectVersion 77, which only Xcode 16+ can open â€” `xcodebuild: error: The project 'GetToIt' cannot be opened because it is in a future Xcode project file format (77)`. Fix: dynamically pick the highest `/Applications/Xcode_*.app` on the macOS-14 runner (Xcode 16.2 selected on the actual run). Robust across image refreshes.
2. **TEST_HOST / BUNDLE_LOADER manual overrides removed.** `project.yml` had `TEST_HOST: "$(BUILT_PRODUCTS_DIR)/GetToIt.app/$(BUNDLE_EXECUTABLE_NAME):GetToIt.app/GetToIt"` â€” the stray `:` separator broke linking with `ld: library '...GetToIt.app/:GetToIt.app/GetToIt' not found`. XcodeGen auto-wires both settings correctly for `bundle.unit-test` targets that declare a dependency on the app target, so the manual override was both redundant and malformed. Removed.
3. CI runtime â‰ˆ 2m10s for the iOS lane, < 30s for each other lane.

### Adjacencies (flagged, not fixed in this PR)

- **`UIRequiredDeviceCapabilities: armv7`** in `ios/project.yml` is wrong for an iOS 17+ minimum target â€” iOS 17 only ships on arm64 devices, so listing `armv7` would make the App Store refuse to install the app on every real device. Doesn't affect simulator runs, so didn't surface in CI. Will need to be changed to `arm64` (or removed entirely â€” UIRequiredDeviceCapabilities is rarely needed in modern apps) before TB-17 TestFlight rollout. Not fixed here to stay in TB-01 scope.
