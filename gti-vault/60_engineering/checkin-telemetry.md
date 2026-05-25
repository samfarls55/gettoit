---
folder: 60_engineering
purpose: TB-14 — Next-day check-in (S08), CheckinScheduler pg_cron, telemetry tables + SQL views
---

# Check-in + telemetry — TB-14

The metric loop that makes the 0.1.0 thesis observable. 12–24 hours after a verdict, every room member with a registered APNs push token receives a single push notification asking `"Did you go?"`. Tapping it opens S08 (`We went` / `We skipped` / `I'd rather not say`). The skip path opens a reason chip row. Responses land in `check_ins`; SQL views compute the north-star metric and two secondary metrics.

> The third option commits `outcome='snoozed'` — a metric-excluded, **terminal** write (`check_ins` PK is `(room_id, user_id)`; the first row wins). Despite the machine token's name it is not a deferral: bug-16 (fork B) re-labelled the option from `Ask me later` to `I'd rather not say` because the system has no re-prompt path. See [[bug-16-checkin-snooze-terminal-row]].

## Where the canonical code lives

- **Schema migrations**
  - `supabase/migrations/20260514000400000_checkins_and_events.sql`
    - `check_ins (room_id, user_id, outcome, reason, created_at)` — PK (room, user). RLS: INSERT-self-in-room only; SELECT denied to authenticated (service-role bypasses for the views).
    - `events (id, room_id, user_id, event_type, properties jsonb, created_at)` — generic event store. RLS: INSERT-self only (room_id, when present, must be a room the user belongs to); SELECT denied.
    - Indices: `events (event_type, created_at)`, `events (room_id, created_at)`, `check_ins (room_id)`.
  - `supabase/migrations/20260514000410000_checkin_dispatches.sql`
    - `checkin_dispatches (verdict_id, user_id, requested_at, delivered_at, success, status_code, apns_id)` — PK (verdict, user). RLS: no policies → all client access denied; service-role bypasses.
    - This is the exactly-once anchor. See §"Exactly-once delivery" below.
  - `supabase/migrations/20260514000420000_checkin_scheduler_cron.sql`
    - `dispatch_checkin_for_verdict(p_verdict_id)` — per-verdict dispatcher. Walks `members`, attempts to insert a `checkin_dispatches` row per (verdict, user), and on fresh inserts POSTs to the `apns-sender` Edge Function via `net.http_post`. Returns the number of fresh dispatches (0 when every user has already been notified).
    - `cron_dispatch_checkins()` — per-minute worker. Walks verdicts with `computed_at <= now() - 12h AND computed_at > now() - 24h` and calls the per-verdict dispatcher on each.
    - `pg_cron` schedule `gettoit_dispatch_checkins` at `* * * * *`.
  - `supabase/migrations/20260514000430000_checkin_no_signal_sweeper.sql`
    - `cron_mark_no_signal_checkins()` — hourly sweeper. Writes `outcome='no_signal'` for any `(verdict, user)` pair whose check-in push was dispatched 3+ days ago and no `check_ins` row has landed. Excluded from the metric numerator + denominator per S08 §"Edge cases."
    - `pg_cron` schedule `gettoit_mark_no_signal_checkins` at `0 * * * *`.
  - `supabase/migrations/20260514000440000_metric_views.sql`
    - `metric_follow_through_pct` — north-star metric (PRD user story 78). `went_count`, `answered_count`, `follow_through_pct` (numeric, 4 decimal places).
    - `metric_time_to_verdict_p50` — median seconds between `room_created` and `verdict_ready` events for the same room_id.
    - `metric_invite_acceptance` — distinct rooms with `invite_shared` vs. distinct (room, user) `member_joined` and `quiz_completed` events.
- **iOS — `ios/Sources/App/`**
  - `TelemetryWriter.swift` — thin wrapper writing into the `events` table. Owns the canonical event-type vocabulary (`room_created`, `quiz_completed`, `verdict_ready`, `ratified`, `rerolled`, `invite_shared`, `member_joined`). `TelemetryEventSink` protocol seam; `SupabaseTelemetrySink` production adapter; capture-spy test adapter.
  - `CheckinScreen.swift` — full SwiftUI port of `design-system/code/screens/ScreenCheckin.jsx`. Three tap rows; reason-chip row after `We skipped`; confirmation plate after commit; mono-tagged footer eyebrow before commit. `CheckinWriter` protocol seam; `SupabaseCheckinWriter` production adapter.
- **iOS tests — `ios/Tests/`**
  - `TelemetryWriterTests.swift` — every documented event-type emits the right `event_type` string; the row shape (`room_id` / `user_id` / `properties`) matches the schema; custom properties carry through; errors propagate.
  - `CheckinScreenTests.swift` — locked copy register (`"Did you go?"`, three option labels, sub-copy, reason chip taxonomy, confirmation headline); choreo timing (320ms fade-up); writer fires once on commit with the correct outcome + reason mapping; view materializes under default + skipped + snoozed + went states.

## Exactly-once delivery

The critical correctness invariant: each `(verdict_id, user_id)` pair receives exactly one check-in push, regardless of how many times the per-minute cron tick fires while the verdict is in the 12–24h window.

The mechanism is a dispatch tracking table — `checkin_dispatches` with PK on `(verdict_id, user_id)`.

Pattern:

1. The cron walks `verdicts` in the window.
2. For each verdict, the dispatcher walks `members` of the verdict's room.
3. For each `(verdict_id, user_id)`, the dispatcher executes:
   ```sql
   insert into public.checkin_dispatches (verdict_id, user_id)
   values (p_verdict_id, v_member.user_id)
   on conflict (verdict_id, user_id) do nothing
   returning true;
   ```
4. If the RETURNING clause yields a row → this call won the insert, fire the APNs POST.
5. If the RETURNING clause is null → another invocation already wrote the row, skip.

Why a separate table (instead of a `notified_at` column on `verdicts`):

- Per-user delivery, not per-verdict. The metric is at the user grain.
- Records the APNs delivery shape (`delivered_at`, `success`, `status_code`, `apns_id`) for audit. A growing-pile-of-columns shape on `verdicts` is the deeper-module smell.
- Re-runs after a partial crash are safe — the row's existence locks the slot even if the APNs POST never fired.

Failure modes:

- **Pre-send write succeeds, APNs call fails.** The row exists with `success=null`. Re-runs are no-ops. The product-level intent (per `surfaces/08-checkin.md` §"What this surface defends against") is that we don't nag — a missed push is just a missed push.
- **Cron worker crashes mid-fanout.** Same as above. The next tick skips already-dispatched users; the user gets one attempt per verdict regardless.

## 3-day-no-response auto-mark

The hourly sweeper (`cron_mark_no_signal_checkins`) writes `outcome='no_signal'` for every `(verdict, user)` pair whose `checkin_dispatches.requested_at` is 3+ days old and no matching `check_ins (room_id, user_id)` row has landed. The view denominator excludes `no_signal` so silent users don't corrupt the cohort.

Idempotent: re-runs against an already-marked dispatch are no-ops via the `check_ins` PK on `(room_id, user_id)`. A late-arriving real response wins against a missing `no_signal` row only when the sweep hasn't fired yet; once `no_signal` lands the late response is rejected by the PK. This is an accepted tradeoff — at 3 days the response has effectively become noise.

## SQL view shapes

Each view returns a single row. Cheap to compute; no materialized-view machinery needed at 0.1.0 scale.

### `metric_follow_through_pct`

Columns: `went_count`, `answered_count`, `follow_through_pct`.

```sql
follow_through_pct = went / (went + skipped)
```

`snoozed` and `no_signal` are EXCLUDED from the denominator — they represent "didn't answer," not "didn't go." Letting silent users count as "skipped" would corrupt the cohort. Null `follow_through_pct` when `answered_count = 0` (avoids division-by-zero).

### `metric_time_to_verdict_p50`

Columns: `rooms_counted`, `p50_seconds`.

Pairs `room_created` and `verdict_ready` events on `room_id`, computes `verdict_ready_at - room_created_at` per room, returns the median via `percentile_cont(0.5)`. Rooms without a `verdict_ready` event (expired / no_survivor) are excluded from the cohort — they don't represent a successful verdict path.

### `metric_invite_acceptance`

Columns: `invites_shared`, `invitees_joined`, `invitees_voted`, `join_rate`, `vote_rate`.

- `invites_shared` — distinct rooms with at least one `invite_shared` event. Normalizes against a noisy initiator who re-shares 10 times for the same room.
- `invitees_joined` — distinct `(room, user)` `member_joined` events.
- `invitees_voted` — distinct `(room, user)` `quiz_completed` events.
- `join_rate = invitees_joined / invites_shared`. The "did they tap the link" signal.
- `vote_rate = invitees_voted / invites_shared`. The load-bearing signal — a join without a vote doesn't help the verdict.

## Web-fallback gap (accepted)

Users on the Next.js web fallback (TB-15) receive NO check-in push. The fallback has no APNs channel and adding push to the web client would mean a Service Worker + a separate VAPID key pair + a separate fanout path — well outside 0.1.0 scope.

The scheduler still writes a `checkin_dispatches` row for users with no `push_tokens` row, so the exactly-once invariant holds. The APNsSender call no-ops on empty `push_tokens`. The metric counts users who can respond — web-fallback users simply won't appear in `check_ins`.

PRD user story 70 already documents this: "As a group member on the web fallback, I expect to receive no check-in (no push channel exists for me), so that the absence of a follow-up doesn't feel like a bug."

## TelemetryWriter — event vocabulary

| event_type      | room_id | user_id | properties                  |
|-----------------|---------|---------|-----------------------------|
| room_created    |   yes   |   yes   | `{ vertical, radius_m? }`   |
| quiz_completed  |   yes   |   yes   | `{}`                        |
| verdict_ready   |   yes   |   no    | `{ method, option_id? }`    |
| ratified        |   yes   |   yes   | `{}`                        |
| rerolled        |   yes   |   yes   | `{ reason }`                |
| invite_shared   |   yes   |   yes   | `{}`                        |
| member_joined   |   yes   |   yes   | `{}`                        |

`verdict_ready` is room-level — there's only one verdict per room and it isn't "owned" by any single user. The other six are per-user actions.

The writer exposes one dedicated method per event_type so callers can never typo the string. A generic `emit(eventType:roomID:userID:properties:)` exists for tests + a future TB-NN's event type before it gets its own helper.

## What ships, what's intentionally deferred

- **Ships in TB-14:** the `events` + `check_ins` + `checkin_dispatches` tables, the per-minute scheduler, the hourly no-signal sweeper, the three SQL views, the S08 SwiftUI port, the TelemetryWriter module.
- **Does NOT ship in TB-14:** wiring TelemetryWriter callsites into existing iOS surfaces. The writer is the primitive; per-surface call-site landings are non-invasive single-line additions that ship alongside the surface they instrument. Adding them inside TB-14 would touch every surface — explicit out-of-scope per the ticket.
- **Does NOT ship in TB-14:** the `apns-sender` Edge Function changes. The function already accepts a `payload` field; the scheduler's POST body passes `{kind: "checkin", verdict_id, room_id}` in payload so iOS deep-link routing can pick the right surface from the lock-screen tap. The existing JWT signing + per-(user, device_token) fanout is the contract.

## Adjacencies flagged (not fixed)

- **TelemetryWriter call-site landings.** Per the 0.1.0 PRD §"TelemetryWriter," the writer is consumed by every existing surface. Each call-site is a one-line addition. Lands alongside the surface it instruments — strict scope on this ticket keeps the blast radius small. Issues to file: per-surface telemetry instrumentation (S01 room_created, S02 invite_shared + member_joined, S03–S07 quiz_completed at submit, S05 ratified / rerolled).
- **Edge Function `kind=checkin` deep-link routing.** The scheduler emits `payload.kind = "checkin"` so the iOS PushCoordinator's notification-response handler can route a check-in tap directly to S08 with the verdict + room ids pre-filled. Routing lands alongside the iOS deep-link surface (post-TB-14).
- **`checkin_dispatches.delivered_at + success + status_code + apns_id`.** The scheduler writes the row pre-send but doesn't currently patch it post-send with the APNs result. Adding the patch requires either (a) making the cron worker await the `net.http_post` response (loses fire-and-forget semantics), (b) a second cron worker that reconciles via a future APNs delivery log, or (c) the APNsSender Edge Function calling back into Postgres post-send. Option (c) is the cleanest; track as a follow-up for the audit story.
- **`metric_time_to_verdict_p50` event source.** The view pairs `room_created` and `verdict_ready` events. Both currently must be emitted client-side (TelemetryWriter), which means the metric is only accurate for clients that successfully wrote both. Server-side emission (in `compute-verdict` Edge Function) for `verdict_ready` is a one-line addition that should land alongside the per-surface call-site work above.
- **Audit dashboard.** The views are queryable via Supabase Studio; a Metabase / single-pager dashboard is post-launch polish per ADR 0005 §"Decision."

## Related

- [[../10_prds/0.1.0-prd|0.1.0 PRD]] §"User stories 65-70" + §"TelemetryWriter" + §"CheckinScheduler"
- [[adr/0005-telemetry-supabase-event-store|ADR 0005]] — telemetry as Supabase tables + SQL views
- [[waiting-fire-trigger|waiting-fire-trigger.md]] — the canonical pg_cron + pg_net dispatcher pattern that TB-14 mirrors
- [[ratification-push-hardclose|ratification-push-hardclose.md]] §"Adjacencies" — TB-08's note that per-trigger APNs fanout wiring lands in TB-14
- [[../../design-system/surfaces/08-checkin|S08 spec]] — locked surface spec
- [[../15_issues/0.1.0/issues/tb-14-checkin-telemetry|TB-14 ticket]]
