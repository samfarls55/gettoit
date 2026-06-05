---
adr: 0004
status: accepted
date: 2026-05-12
supersedes: null
superseded_by: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 0004 â€” Monorepo layout

## Status

Accepted â€” 2026-05-12.

## Context


## Decision

**Single monorepo. Top-level siblings:**

```
GetToIt/
  AGENTS.md
  CLAUDE.md            # compatibility shim: Read AGENTS.md
  CONTEXT.md
  README.md
  gti-vault/            # Obsidian knowledge base
  ios/                  # Xcode project (Swift + SwiftUI app)
  web/                  # Next.js web fallback
  docs/                 # agent contracts (issue tracker, ADR rules)
```


## Why

5. **No package-publish overhead.** Solo dev + single consumer pair. pnpm workspaces or git submodules add tooling cost with no payoff at 0.1.0 scale.

## Consequences

### Positive

- One `git clone` reproduces everything.
- Vault doc references survive moves with simple relative-path bumps.
- CI workflow boilerplate stays small.

### Negative / accepted tradeoffs

- **Mixed tooling in one repo.** Xcode + Node/pnpm + scripts. CI matrix has two ecosystems. Manageable; common pattern.

## Re-evaluation triggers

- Second iOS app (e.g., dedicated initiator-vs-invitee build) â€” reconsider workspaces.
- CI runtime crosses 15 min â€” split into separate workflows or repos.

## References

- [[0001-ios-tech-stack-supabase|ADR 0001]]
- [[0003-web-fallback-nextjs-vercel|ADR 0003]]
