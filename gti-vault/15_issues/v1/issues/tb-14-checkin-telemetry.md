---
issue: tb-14
title: Next-day check-in (S08) + CheckinScheduler + telemetry SQL views
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
adr: 0005
---

# TB-14 — Next-day check-in + telemetry views

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The metric loop that makes the v1 thesis observable. 12–24 hours after a verdict, every member with a registered APNs push token receives a single push notification asking `"Did you go?"`. Tapping it opens S08 with three taps — `We went` / `We skipped` / `Ask me later`. The skip path opens a follow-up reason chip row. Responses land in `check_ins`; SQL views compute the north-star metric and secondary metrics.

- **Schema** — `check_ins (room_id uuid, user_id uuid, outcome text, reason text null, created_at)` and `events (id uuid, room_id uuid null, user_id uuid null, event_type text, properties jsonb, created_at)` per [[../../../60_engineering/adr/0005-telemetry-supabase-event-store|ADR 0005]]. RLS — `check_ins` insert-only per user; `events` writeable per user for own rows, service-role read.
- **CheckinScheduler** — `pg_cron` job runs every minute. Selects `verdicts` where `computed_at` is 12–24 hours ago AND a check-in notification has not yet been dispatched. For each verdict, enqueues per-member APNs sends via the APNsSender Edge Function (TB-08). Records dispatch in an internal table so notifications fire exactly once per `(verdict_id, user_id)`.
- **Verdicts older than 3 days without response** — a second `pg_cron` job marks `check_ins.outcome = 'no_signal'` for any `(verdict_id, user_id)` pair past 3 days with no response. These rows do not count toward or against the north-star metric.
- **S08 SwiftUI port** — full port of [[../../../../design-system/surfaces/08-checkin|S08]]. Three tap rows (`We went` sun-pill, `We skipped` white-pill, `Ask me later` ghost-pill). After `We skipped`, the chip row of reasons appears (`Wallet/time · Group bailed · Place was packed · Mood shifted · Other`). Single tap → confirmation plate.
- **TelemetryWriter** — iOS module writing `events` rows for key product moments (`room_created`, `quiz_completed`, `verdict_ready`, `ratified`, `rerolled`). Thin wrapper.
- **SQL views** —
  - `metric_follow_through_pct` — `count(check_ins WHERE outcome='went') / count(check_ins WHERE outcome IN ('went','skipped'))`. `snoozed` and `no_signal` excluded from denominator.
  - `metric_time_to_verdict_p50` — median of `verdict.computed_at - room.created_at` from `events`.
  - `metric_invite_acceptance` — invites sent vs invitees who voted; computed from `events` (`invite_shared`, `member_joined`, `quiz_completed`).
- **Web fallback** — receives no check-in (no push channel). Documented as accepted gap.
- **Tests** — check-in fires exactly once per (verdict, user); already-dispatched verdicts are skipped; verdicts under 12h are skipped; 3-day-no-response auto-marks `no_signal`; SQL views return correct values against fixture data.

## Acceptance criteria

- [ ] `check_ins` and `events` migrations land with RLS.
- [ ] CheckinScheduler `pg_cron` job runs and dispatches APNs per verdict in the 12–24h window.
- [ ] Dispatch is exactly-once per (verdict_id, user_id).
- [ ] 3-day-no-response auto-mark works.
- [ ] S08 SwiftUI port matches the locked spec.
- [ ] TelemetryWriter writes the documented event types from the documented surfaces.
- [ ] `metric_follow_through_pct`, `metric_time_to_verdict_p50`, `metric_invite_acceptance` views return correct values on fixture data.
- [ ] Web fallback documents the absent check-in.

## Blocked by

- [[tb-08-ratification-push-hard-close|TB-08]]
