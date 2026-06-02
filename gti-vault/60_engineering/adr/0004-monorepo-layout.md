---
adr: 0004
title: Monorepo layout — ios/, web/, design-system/, gti-vault/ siblings
status: accepted
date: 2026-05-12
supersedes: null
superseded_by: null
---

# 0004 — Monorepo layout

## Status

Accepted — 2026-05-12.

## Context

[[0001-ios-tech-stack-supabase|ADR 0001]] picks Swift + SwiftUI. [[0003-web-fallback-nextjs-vercel|ADR 0003]] adds a Next.js web fallback. Both consume `design-system/tokens.json`. Repo already houses `design-system/` and `gti-vault/` at root.

## Decision

**Single monorepo. Top-level siblings:**

```
GetToIt/
  AGENTS.md
  CLAUDE.md            # compatibility shim: Read AGENTS.md
  CONTEXT.md
  README.md
  design-system/        # authoritative UI spec (tokens, components, surfaces)
  gti-vault/            # Obsidian knowledge base
  ios/                  # Xcode project (Swift + SwiftUI app)
  web/                  # Next.js web fallback
  docs/                 # agent contracts (issue tracker, ADR rules)
```

`design-system/scripts/gen-css.mjs` writes `design-system/code/tokens.css` (consumed directly by `web/`). Future `design-system/scripts/gen-swift.mjs` writes `ios/Sources/GTITokens.swift` from the same `tokens.json`.

## Why

1. **Single source of truth boundary.** `design-system/tokens.json` is the contract. Both consumers live under the same repo root.
2. **Atomic spec changes.** A token change can update `design-system/` + `ios/` + `web/` in one PR. No publish-and-pin coordination.
3. **One CI lane.** GitHub Actions runs `node design-system/scripts/verify.mjs`, iOS build, web build, web lint, and (later) Swift lint in one workflow. Drift gates run together.
4. **Vault references stay relative.** `gti-vault/60_engineering/adr/*.md` links to `design-system/`, `ios/`, `web/` via relative paths without cross-repo URL fragility.
5. **No package-publish overhead.** Solo dev + single consumer pair. pnpm workspaces or git submodules add tooling cost with no payoff at 0.1.0 scale.

## Consequences

### Positive

- One `git clone` reproduces everything.
- Vault doc references survive moves with simple relative-path bumps.
- CI workflow boilerplate stays small.

### Negative / accepted tradeoffs

- **Mixed tooling in one repo.** Xcode + Node/pnpm + scripts. CI matrix has two ecosystems. Manageable; common pattern.
- **Repository size grows.** Xcode project artifacts (`.xcodeproj` metadata, derived data ignored) + Next.js `.next/` (ignored) + design-system. Still small.
- **No enforced package boundaries.** Without workspaces, nothing prevents accidental imports from `web/` into `design-system/code/` or vice versa. Mitigation: ESLint rule + manual review.

## Re-evaluation triggers

- Second iOS app (e.g., dedicated initiator-vs-invitee build) — reconsider workspaces.
- External consumer of `design-system/` appears — convert to a published npm package.
- CI runtime crosses 15 min — split into separate workflows or repos.

## References

- [[0001-ios-tech-stack-supabase|ADR 0001]]
- [[0003-web-fallback-nextjs-vercel|ADR 0003]]
- [[../../../design-system/AGENTS|design-system/AGENTS.md]] (editing rules for the spec dir)
