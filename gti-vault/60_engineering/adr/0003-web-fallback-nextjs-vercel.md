---
adr: 0003
title: Web fallback stack — Next.js on Vercel
status: accepted
date: 2026-05-12
supersedes: null
superseded_by: null
---

# 0003 — Web fallback: Next.js (App Router) on Vercel

## Status

Accepted — 2026-05-12.

## Context

The product north-star is group-first viral flow: initiator shares an invite link in a group chat, invitees vote. Some invitees don't have iOS. Without a web fallback the viral loop dies at the first Android friend — the exact paralysis cousin we're solving.

The web fallback must:

- Render the same 5-question quiz (matches [[../../50_product/v1-design-locks|Lock 1]]).
- Authenticate anonymously against Supabase from a browser.
- Subscribe to Realtime channels for the room (votes, presence, verdict_ready).
- Reuse `design-system/tokens.json` so brand/visual lockstep with iOS.

## Decision

**Next.js (App Router) hosted on Vercel.** Routes `/join/{roomId}` (deep link landing) and the five quiz steps. Server-side reads only what the landing screen needs; everything else is client-side React with `supabase-js` driving Realtime + anonymous auth + writes.

Token consumption: web build pulls `design-system/code/tokens.css` directly. Components are re-implemented in `web/` using the same primitives as `design-system/code/components.jsx` (the design-system JSX is **spec**, not production source for web — see [[#design-system-relationship]]).

## Why

1. **`supabase-js` is the canonical SDK.** Realtime Broadcast, Presence, anonymous auth, RLS all first-class in the browser SDK. No translation layer needed.
2. **App Router server components keep the landing route light.** OG tags and AASA-style link-preview metadata can render server-side; the rest is client-driven.
3. **Vercel free tier is sized for beta.** Hobby tier handles single-metro TestFlight load with headroom.
4. **Code reuse with `design-system/`.** Tokens (CSS variables) consume directly. Component implementations are a 1:1 port of the design-system JSX with real data wiring — minimal cognitive surface.

## Design-system relationship

`design-system/code/screens/*.jsx` is the **spec** for visual + motion. `web/` consumes:

- `design-system/code/tokens.css` (generated from `tokens.json`) — directly.
- `design-system/code/components.jsx` — as reference; web/ has its own implementations parameterized for live data, accessibility, Next.js routing.

`web/` **must not import** from `design-system/code/`. Drift gate (`verify.mjs`) stays the contract: web components match the spec because the spec is the canonical visual reference, not because of code-sharing.

## Consequences

### Positive

- Two-codebase reality acknowledged: iOS + web both consume `tokens.json`.
- Viral loop survives mixed-platform group chats.
- Web fallback also doubles as a marketing landing-page substrate.

### Negative / accepted tradeoffs

- **Spec drift risk.** Two implementations of the same component. `verify.mjs` will need extension to scan `web/` for orphan hex / out-of-token usage, mirroring the design-system check.
- **Hosting bill.** Vercel free tier carries beta but a hosting line item appears at scale.
- **Push notifications absent on web.** Web fallback can't receive next-day check-in pushes (iOS-only flow). Web users miss check-in entirely in v1 — accepted, as check-in primarily drives north-star measurement for committed (iOS) users.

## Re-evaluation triggers

- Vercel free-tier limits hit during beta (unlikely at single-metro scale).
- Spec drift between `web/` and `design-system/` shows up in `verify.mjs` more than twice per quarter — consider a shared component library.

## References

- [[../../50_product/north-star|north-star.md]] §Unfair advantage
- [[../stack-patterns|stack-patterns.md]]
- [[0001-ios-tech-stack-supabase|ADR 0001]]
- [[0004-monorepo-layout|ADR 0004]] for repo structure
