---
adr: 0003
title: Web fallback stack â€” Next.js on Vercel
status: accepted
date: 2026-05-12
supersedes: null
superseded_by: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 0003 â€” Web fallback: Next.js (App Router) on Vercel

## Status

Accepted â€” 2026-05-12.

## Context

The product north-star is group-first viral flow: initiator shares an invite link in a group chat, invitees vote. Some invitees don't have iOS. Without a web fallback the viral loop dies at the first Android friend â€” the exact paralysis cousin we're solving.

The web fallback must:

- Render the same 5-question quiz (matches [[../../50_product/0.1.0-design-locks|Lock 1]]).
- Authenticate anonymously against Supabase from a browser.
- Subscribe to Realtime channels for the room (votes, presence, verdict_ready).

## Decision

**Next.js (App Router) hosted on Vercel.** Routes `/join/{roomId}` (deep link landing) and the five quiz steps. Server-side reads only what the landing screen needs; everything else is client-side React with `supabase-js` driving Realtime + anonymous auth + writes.


## Why

1. **`supabase-js` is the canonical SDK.** Realtime Broadcast, Presence, anonymous auth, RLS all first-class in the browser SDK. No translation layer needed.
2. **App Router server components keep the landing route light.** OG tags and AASA-style link-preview metadata can render server-side; the rest is client-driven.
3. **Vercel free tier is sized for beta.** Hobby tier handles single-metro TestFlight load with headroom.





## Consequences

### Positive

- Two-codebase reality acknowledged: iOS + web both consume `tokens.json`.
- Viral loop survives mixed-platform group chats.
- Web fallback also doubles as a marketing landing-page substrate.

### Negative / accepted tradeoffs

- **Hosting bill.** Vercel free tier carries beta but a hosting line item appears at scale.
- **Push notifications absent on web.** Web fallback can't receive next-day check-in pushes (iOS-only flow). Web users miss check-in entirely in 0.1.0 â€” accepted, as check-in primarily drives north-star measurement for committed (iOS) users.

## Re-evaluation triggers

- Vercel free-tier limits hit during beta (unlikely at single-metro scale).

## References

- [[../../50_product/north-star|north-star.md]] Â§Unfair advantage
- [[../stack-patterns|stack-patterns.md]]
- [[0001-ios-tech-stack-supabase|ADR 0001]]
- [[0004-monorepo-layout|ADR 0004]] for repo structure
