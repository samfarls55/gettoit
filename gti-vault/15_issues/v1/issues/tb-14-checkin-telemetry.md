---
issue: tb-14
title: Next-day check-in (S08) + CheckinScheduler + telemetry SQL views
github_issue: 15
status: done
completed: 2026-05-14
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

- [x] `check_ins` and `events` migrations land with RLS (`supabase/migrations/20260514000400000_checkins_and_events.sql` — `check_ins` INSERT-self-in-room with SELECT denied; `events` INSERT-self constrained to rooms the caller belongs to with SELECT denied; indices on `(event_type, created_at)` and `(room_id, created_at)`).
- [x] CheckinScheduler `pg_cron` job runs and dispatches APNs per verdict in the 12–24h window (`20260514000420000_checkin_scheduler_cron.sql` — `cron_dispatch_checkins()` every minute; `dispatch_checkin_for_verdict(verdict_id)` walks room members and POSTs apns-sender via `pg_net`).
- [x] Dispatch is exactly-once per (verdict_id, user_id) (`20260514000410000_checkin_dispatches.sql` — PK on `(verdict_id, user_id)` with `ON CONFLICT DO NOTHING`; the dispatcher only fires APNs on a fresh insert).
- [x] 3-day-no-response auto-mark works (`20260514000430000_checkin_no_signal_sweeper.sql` — `cron_mark_no_signal_checkins()` hourly writes `outcome = 'no_signal'` for `(verdict, user)` past 3 days with no response).
- [x] S08 SwiftUI port matches the locked spec (`ios/Sources/App/CheckinScreen.swift` — `We went` sun-pill, `We skipped` white-pill, `Ask me later` ghost-pill; skip path reveals reason chip row; single-tap confirmation plate).
- [x] TelemetryWriter writes the documented event types from the documented surfaces (`ios/Sources/App/TelemetryWriter.swift` — `room_created`, `quiz_completed`, `verdict_ready`, `ratified`, `rerolled`, `invite_shared`, `member_joined`; with `[String: TelemetryValue]` property bag).
- [x] `metric_follow_through_pct`, `metric_time_to_verdict_p50`, `metric_invite_acceptance` views return correct values on fixture data (`20260514000440000_metric_views.sql` — `snoozed`/`no_signal` excluded from follow-through denominator; p50 over verdict latency from `events`; acceptance from `invite_shared` / `member_joined` / `quiz_completed`).
- [x] Web fallback documents the absent check-in (`gti-vault/60_engineering/checkin-telemetry.md` records the accepted gap — web has no push channel; no check-in path).

## Blocked by

- [[tb-08-ratification-push-hard-close|TB-08]]

## Comments

**2026-05-14** — closed. PR [#37](https://github.com/samfarls55/gettoit/pull/37) merged to main as `5810657`. Subagent burned through its allocation mid-task; the orchestrator recovered uncommitted work and applied one follow-up fix.

- Implementation landed in five migrations (`20260514000400000_checkins_and_events` → `20260514000440000_metric_views`), a SwiftUI S08 screen (`CheckinScreen.swift`), a `TelemetryWriter` module (~308 LOC, 7 documented events), and ~318 LOC of XCTest coverage across `CheckinScreenTests` and `TelemetryWriterTests`. Engineering pattern documented at `gti-vault/60_engineering/checkin-telemetry.md`.
- Build-time fix applied by the orchestrator at `282d055` — `TelemetryValue` was missing `ExpressibleBy{String,Integer,Float,Boolean}Literal` conformances, so `["vertical": "food"]` and `["method": "manual"]` callers failed with `"cannot convert value of type 'String' to expected dictionary value type 'TelemetryValue'"`. Adding the four conformances lets every caller use natural literals with the compiler inserting the correct enum case at the type wall.
- Exactly-once invariant lives in the `checkin_dispatches` table's PK + `ON CONFLICT DO NOTHING`; the row's existence locks the slot before `pg_net` fires apns-sender. The cron tick is therefore safe to run every minute without dispatch storms.
