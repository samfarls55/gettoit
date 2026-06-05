---
title: Codex project memory
description: Migrated Claude-era project and working-style memories for Codex sessions.
type: reference
status: active
created: 2026-06-02
source:
  - "C:/Users/sfarl/.claude/projects/C--development-gettoit/memory/"
related:
  - "[[codex-migration-readiness-audit]]"
  - "[[adr/0001-ios-tech-stack-supabase]]"
  - "[[stack-patterns]]"
  - "[[../50_product/0.1.0-design-locks]]"
  - "[[../30_design/sunset-pop-handover]]"
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# Codex Project Memory

These notes migrate the durable Claude project memories into the vault so Codex can recover them without relying on user-level Claude state. Treat this as quick orientation only: when it conflicts with current repo docs, trust the current repo docs.

## How To Use This

- Start from `AGENTS.md`, `CONTEXT.md`, `docs/agents/`, and the relevant vault/design-system docs.
- Use this note as a compact memory bridge from the Claude era.
- Do not treat Claude transcripts, command history, or pasted setup material as migrated memory.
- Current issue tracker truth: GitHub Issues are remote; vault issue notes mirror/preserve local context. The old Claude note saying "vault-based, no remote" is stale.

## Product Snapshot

- GetToIt kills group decision paralysis for trivial-to-mid going-out choices.
- v1 is food vertical only, group-first, no ML, and optimized for fast single-verdict decisions.
- Invite model is group-chat native: link invite with web fallback.
- Each participant answers a fixed-length quiz; the app generates candidate places, aggregates preferences with veto-respecting majority logic, and returns one verdict plus capped reroll-with-reason.
- North-star metric: percentage of verdicts followed through, measured by a lightweight next-day check-in.
- Compound moat: zero pre-curation, group-native invite flow, and speed-to-verdict.

## Research And Product Locks

- Decision-simplification research closed on 2026-05-08.
- For quiz or verdict design, read `gti-vault/50_product/0.1.0-design-locks.md` first.
- Supporting synthesis docs from the old memory:
  - `gti-vault/50_product/framework-comparison.md`
  - `gti-vault/50_product/paralysis-cause-priority.md`
  - `gti-vault/50_product/verdict-screen-spec.md`
- Deferred to post-launch A/B, not further pre-launch research:
  - Quiz length 4 vs 5 vs 6
  - Regret-of-omission tiebreaker vs random pick
  - Warm-friend vs court-formal verdict-screen register
  - Whether algorithm-as-decider carries the same relational signal as human authority figures

## Stack Memory

- v1 stack was decided on 2026-05-12: Swift, SwiftUI, and Supabase.
- Canonical ADR: `gti-vault/60_engineering/adr/0001-ios-tech-stack-supabase.md`.
- Implementation patterns: `gti-vault/60_engineering/stack-patterns.md`.
- Do not relitigate Supabase unless a current ADR re-evaluation trigger fires.
- Locked patterns from the old memory:
  - Realtime Broadcast for live vote events; Postgres Changes only for cold-start hydration.
  - Anonymous auth as the default invitee path; Sign in with Apple for explicit account creation.
  - Universal Links at `/join/{roomId}`; no Branch or AppsFlyer.
  - PostGIS for food-vertical geo.
  - Foursquare for places data with Apple MapKit fallback.
  - pg_cron plus SQL triggers for deadline, quorum, and verdict work.
  - APNs through an Edge Function with a `.p8` key.
  - Offline v1 is a DIY SwiftData mirror with LWW; PowerSync is deferred unless offline pain blocks shipping.

## Design Memory

- Visual direction locked on 2026-05-12: Sunset Pop.
- Sunset Pop means coral to magenta to indigo to midnight gradients, sun-yellow accent, Inter Black display, stacked all-caps verdict hero, sun-yellow time block, and glass receipt chips.
- Do not re-pitch the earlier Warm Receipt or Quiet Serif directions unless the user explicitly asks to reopen visual direction.
- Watch for over-confident "the algorithm picked" framing; copy should preserve aggregate-rule attribution.
- Logo direction: lead with standalone abstract/geometric/pictorial app-icon marks in the Linear/Vercel/Stripe/Ramp neighborhood. Avoid wordmarks, letterform tricks, or typographic-first concepts unless explicitly requested.

## Design System Memory

- `design-system/` lives at repo root and is authoritative for tokens, components, surfaces, motion, and accessibility.
- `design-system/tokens.json` is canonical.
- Generated consumers should not be hand-edited:
  - CSS from `scripts/gen-css.mjs`
  - Future Swift tokens from a generator when added
- User-visible design-system changes should update `design-system/CHANGELOG.md`.
- Read `design-system/AGENTS.md` before touching that tree.

## Brand And Repo Rename Memory

- The project was previously named `figureitout`.
- On 2026-05-12 the brand changed to GetToIt after `figureitout.app` was unavailable.
- `gettoit.app` was registered.
- Rename work included `fio-vault/` to `gti-vault/`, `Fio*` to `GTI*`, `fio-*` CSS classes to `gti-*`, and the wordmark tile letter from `f` to `g`.
- Naming bible, voice samples, and final wordmark remain marketing/branding responsibilities.

## Working Style Memory

- When the user asks for a recommendation, give one confident pick with explicit defense.
- Pros and cons are useful as support, but do not end with a neutral options menu.
- Pre-empt likely objections and state how the recommendation should be defended.
- Honest hedging belongs in narrow re-evaluation triggers, not in the recommendation itself.
- Re-evaluation triggers should be grounded in real conditions the user has signaled or observable operational thresholds. Avoid speculative org/strategy hypotheticals.
- Git policy memory: track load-bearing docs, vault notes, ADRs, design-system files, and code. Ignore only machine-specific config, secrets, and generated/build output.

## Not Migrated

- Claude session transcripts and command history were left as historical logs.
- Sensitive pasted setup material from history was not copied into this note.
- User-level Claude paths are archival references, not active project configuration.
