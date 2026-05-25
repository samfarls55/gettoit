---
adr: 0005
title: Telemetry — Supabase tables as event store
status: accepted
date: 2026-05-12
supersedes: null
superseded_by: null
---

# 0005 — Telemetry: Supabase tables as event store, SQL views for metrics

## Status

Accepted — 2026-05-12.

## Context

[[../../50_product/north-star|north-star.md]] names **% of verdicts followed-through** as the primary metric. The 0.1.0 "definition of done" in [[../../50_product/0.1.0-scope|0.1.0-scope]] requires that metric be computable across the beta cohort. Without telemetry, the thesis test is unobservable.

Candidates considered:

- **PostHog Cloud (free tier 1M events/mo)** — best-in-class funnel/retention/cohort tooling, but adds vendor, SDK, off-stack PII handling.
- **Mixpanel (free tier 20M events/mo)** — similar tradeoffs.
- **Supabase tables + SQL views** — already in stack; SQL queries answer the 0.1.0 questions.
- **Defer** — rejected; violates 0.1.0 DoD.

## Decision

**Event storage lives in Supabase tables. Metrics computed by SQL views.**

Schema sketch:

- `events (id uuid, room_id uuid null, user_id uuid null, event_type text, properties jsonb, created_at timestamptz default now())`
- `check_ins (room_id uuid, user_id uuid, outcome text, reason text null, created_at timestamptz)` — `outcome` ∈ {`went`, `skipped`, `snoozed`, `no_signal`}.
- RLS: `events` read-only to admin/service-role; writeable by authenticated users for their own `user_id`. `check_ins` insert-only per user.
- Indices on `(event_type, created_at)` and `(room_id, created_at)`.

Computed views:

- `metric_follow_through_pct` — `count(check_ins WHERE outcome='went') / count(check_ins WHERE outcome IN ('went','skipped'))`. `snoozed` and `no_signal` excluded from denominator.
- `metric_time_to_verdict_p50` — from `events` where `event_type IN ('room_created','verdict_ready')`.
- `metric_invite_acceptance` — invites sent vs invitees who voted.

Inspected via Supabase Studio or a single-pager Metabase dashboard.

## Why

1. **Already in stack.** No new vendor, no new SDK, no new PII exit point.
2. **Privacy posture stays clean.** [[0006-privacy-posture-0.1.0|ADR 0006]] enforces a strict no-third-party-PII rule; PostHog/Mixpanel would re-open that decision.
3. **SQL answers 0.1.0 questions directly.** The metrics we need are aggregates and joins — Supabase's native shape.
4. **Layer PostHog later if needed.** When behavior questions get richer (funnels, retention cohorts) PostHog can layer on top of these tables, not replace them.

## Consequences

### Positive

- Single data plane: app data + events both in Postgres.
- Custom SQL beats fixed-template product-analytics dashboards for GetToIt's specific shape (verdicts → check-ins).
- No vendor lock-in on telemetry.

### Negative / accepted tradeoffs

- **No out-of-box funnels.** Funnels are hand-rolled SQL until/unless PostHog layers in.
- **No session-level user-behavior playback** (PostHog has session recordings; we don't).
- **Storage of `events` table grows linearly.** Plan: archive to cold storage after 90 days; keep `check_ins` hot indefinitely (low row count).

## Re-evaluation triggers

- Behavior questions arise that need cohort retention curves and SQL-from-scratch takes > 1 hour per question.
- Beta cohort grows past 10k DAU and `events` write throughput hits Postgres limits.

## References

- [[../../50_product/north-star|north-star.md]]
- [[../../50_product/0.1.0-scope|0.1.0-scope.md]] §Definition of done
- [[0006-privacy-posture-0.1.0|ADR 0006]]
