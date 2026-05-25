---
adr: 0001
title: iOS 0.1.0 tech stack — Swift + SwiftUI + Supabase
status: accepted
date: 2026-05-12
supersedes: null
superseded_by: null
---

# 0001 — iOS 0.1.0 tech stack: Swift + SwiftUI + Supabase

## Status

Accepted — 2026-05-12.

## Context

GetToIt 0.1.0 is a group-first decision-paralysis killer with food as the first vertical. Core mechanic: a room of N humans voting on M options against a deadline, with a "verdict" surfaced when quorum or deadline is reached. North star is follow-through %.

Constraints driving this decision:

- **Solo dev with Claude Code**, 1–3 month MVP target.
- **iOS-only 0.1.0.** Android path is deferred but not ruled out — the stack must not foreclose it.
- **Balanced priority lens:** ship 0.1.0 fastest *without* painting into a corner. Performance-per-dollar weighs heavily in the 0–10k DAU range.
- **Cross-platform stacks dropped** (React Native, Flutter) — Swift + SwiftUI is the chosen client.
- **Anti-recommendations** that emerged during research (do not propose these): Realm / Atlas Device Sync (EOL 2025-09-30), Replicache (maintenance), Zero (no Swift), Triplit (no Swift), Electric SQL Swift (experimental community port).

8 stack archetypes were evaluated end-to-end. Full research bundle and per-stack data are at [[../research/ios-stack-2026-05/_index|gti-vault/60_engineering/research/ios-stack-2026-05/]].

## Decision

**Swift + SwiftUI + Supabase.**

Supabase provides Postgres + Realtime + Auth + Storage + Edge Functions. The Swift SDK (`supabase-swift`) mirrors `supabase-js` and has strong Claude Code training-data coverage.

## Why Supabase

1. **Relational data shape is the exact match.** Rooms → members → options → votes is a foreign-key graph. SQL joins resolve a full room state in one query; document stores would force denormalization. RLS policies make "only members of room X may read/write votes for X" declarative and server-enforced.
2. **PostGIS solves the food vertical natively.** Nearby-restaurant / radius / open-now queries are first-class. Avoids paying for Google Places ($) or assembling Foursquare integration up front.
3. **pg_cron + SQL triggers cover deadline evaluation and quorum.** Verdict computation is server-authoritative and race-free.
4. **Anonymous auth → linked credentials** is the gold path for group-invite UX. Invitee taps a deep link, votes immediately, optionally signs up with Apple later. No PII required to participate.
5. **Pro plan at $25/mo is absurd value** at 0–10k DAU: 100K MAU + 500 realtime connections + 5M realtime messages + 250GB egress. Free tier carries 0–1k DAU; the only caveat is that free-tier projects pause after 7 days idle.
6. **`pg_dump` is the escape hatch.** Data is plain Postgres — migrate to any Postgres anywhere. Self-host is OSS. Lowest lock-in of any candidate.

## Consequences

### Positive

- Relational schema is the natural shape of the domain.
- Postgres is boring, well-understood tech. Every failure mode is documented; every consultant can debug it.
- PostGIS, pg_cron, pgmq are gravy once oriented.
- Sign in with Apple + anonymous auth are first-class Swift SDK calls.
- Self-host or migrate path keeps the Android door open and survives vendor-failure scenarios.
- Strong Claude Code coverage compounds solo-dev velocity.

### Negative / accepted tradeoffs

- **Offline handling is DIY.** Native SDK has no offline queue. We will ship 0.1.0 with a thin SwiftData mirror + last-write-wins (LWW) reconciliation — adequate for 5-person groups with short deadline windows. PowerSync is a future overlay if offline pain materializes.
- **No native optimistic mutation framework.** Pattern: update local `@State` immediately, fire the Supabase write, reconcile on the Realtime echo (or roll back on error). Boilerplate but well-trodden — estimate ~1–2 weeks to build a reusable pattern.
- **No native APNs sender.** Server pushes ship via an Edge Function calling APNs directly with a `.p8` key, or via FCM as a relay. Roughly half a day of plumbing vs Firebase's zero-config FCM.
- **No native invite primitive.** Build `/join/{roomId}` Universal Links yourself. Standard iOS pattern with the Associated Domains entitlement; not a blocker.
- **Postgres Changes are reportedly flaky at scale** per community reports. Mitigation: use **Realtime Broadcast** for live vote events, reserve Postgres Changes only for cold-start hydration. See [[../stack-patterns#realtime|stack-patterns.md]].

## Alternatives considered (and why rejected)

The top-3 final contenders were Supabase, Convex, and Firebase. The other five (CloudKit, Nakama, Turso, InstantDB, Supabase+PowerSync) were eliminated earlier.

### Firebase — rejected

- **Per-document-read billing compounds with fanout.** GetToIt's whole product is "N people watch votes arrive live." Firestore bills directly for that load shape. Supabase Realtime Broadcast bills $2.50 per 1M messages — orders of magnitude cheaper for the same UX.
- **Highest lock-in of any candidate.** No SQL export, proprietary doc model, no migration path. Directly violates the "don't paint into corner" priority.
- **Spark plan is a hard cliff**, not a soft throttle. Quota overage stops the app.
- **Dynamic Links shutdown 2025-08-25** — Google deprecated the exact primitive group-invite apps depend on. Vendor-direction signal matters at multi-year commitment scale.
- NoSQL document model fights relational group-vote shape — forces denormalization or expensive joins.
- The 2-day TTFP advantage over Supabase is not worth the structural tax.

### Convex — rejected (but #2 if we ever go TS-native)

- **Two-language codebase tax.** TS backend + Swift client means double the API surface, double the schema diffs, double the breaking-change surface for a solo dev.
- **Offline is mutation-queue only**, not offline reads. Same "vote on subway" gap as Supabase without the relational shape wins to compensate.
- **No PostGIS equivalent** — food vertical requires bolting on Google Places (paid since Feb 2025) or Foursquare. Hidden integration cost.
- Convex's killer features (reactive subscriptions, optimistic updates) are replicable in Supabase with ~1–2 weeks of pattern code. Supabase's killer features (Postgres + RLS + PostGIS + pg_cron + anonymous auth + pg_dump) are not replicable in Convex without writing them yourself.
- Newer company, smaller community, thinner Stack Overflow / training-data corpus for GetToIt's specific shape.

### CloudKit, Nakama, Turso, InstantDB, Supabase+PowerSync — rejected earlier

- **CloudKit:** iOS-only forever; forecloses the deferred Android path.
- **InstantDB:** 21/64 fields uncertain in research — vendor immaturity, community-maintained Swift SDK.
- **Turso:** 10–20 day TTFP (longest), no realtime push, Swift SDK in tech-preview, integration tax (auth + push + cron + CDN all external).
- **Nakama:** Swift client `v1.2.0` last released 2024-03-19 ("deprioritized per maintainer comment"). Forking and maintaining the SDK ourselves is a solo-dev death spiral.
- **Supabase + PowerSync:** $25–60/mo cost floor at zero DAU. PowerSync Swift SDK in Open Alpha. PowerSync cannot open its local SQLite from widgets, App Intents extensions, or Live Activities (GitHub issue #126) — directly kills the "3 of 5 voted, deadline 2m" Live Activity UX GetToIt needs.

## Implementation guardrails

See [[../stack-patterns|60_engineering/stack-patterns.md]] for the patterns implied by this decision (Realtime Broadcast vs Postgres Changes, anonymous-auth invite flow, PostGIS for places, pg_cron for deadlines, SwiftData mirror for offline, APNs via Edge Function).

## Re-evaluation triggers

Revisit this ADR if any of the following become true:

- **Offline UX pain blocks shipping after one full sprint.** Add PowerSync as an overlay (not a replacement) — accept the $25–60/mo floor and the Live Activity caveat. Do not switch to a different base BaaS.
- **Realtime Broadcast hits a scaling cliff we didn't anticipate.** Move hot path to Pusher/Ably; keep Supabase for Postgres + Auth + Storage.

## References

- Research bundle: [[../research/ios-stack-2026-05/_index|gti-vault/60_engineering/research/ios-stack-2026-05/]]
- Synthesized comparison report: [[../research/ios-stack-2026-05/report|report.md]]
- Per-stack JSON: `research/ios-stack-2026-05/results/`
- Field framework: `research/ios-stack-2026-05/fields.yaml`
