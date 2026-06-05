---

issue: tb-WF-1
title: Plans table + lifecycle schema + Plan store
status: done
type: AFK
feature: 0.1.0
github_issue: 160
created: 2026-05-19
closed: 2026-05-20
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# tb-WF-1 â€” Plans table + lifecycle schema

## Parent

[[../../../50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]] â€” the workflow overhaul promotes the loose ephemeral `rooms` row into a durable `Plan` entity. This issue lands the schema + the iOS read/write layer (PlansStore) so subsequent tracer-bullets can consume it.

The end-to-end behavior delivered by this slice: an iOS user can create a Plan via a low-fidelity test path (a dev-mode harness, e.g. a SwiftUI debug screen or a CLI helper), see it persist with `status: pending`, list their own Plans, and observe the state transition `pending â†’ decided-active` after the existing verdict-fire path runs against a Room linked to that Plan. The user-facing Setup surface is **tb-WF-4** â€” this issue ships the schema + store without changing the existing S01 + S01b flow.

## What to build

### Database â€” new `plans` table

```sql
create table public.plans (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references auth.users(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  category      text not null default 'food' check (category in ('food')),
  scope         text not null default 'group' check (scope in ('solo', 'duo', 'group')),
  location      jsonb,
  session_params jsonb not null default '{}'::jsonb,
  distance_meters int not null default 1609,
  status        text not null default 'pending'
                check (status in ('pending', 'decided-active', 'decided-expired')),
  reroll_window_closes_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

- `name` â€” required, 40-char cap, matches sg-WF-1's validation.
- `category` â€” food-only in 0.1.0 per the locked decision; the check constraint protects future expansion (drinks/movie added as new enum values in v2+).
- `scope` â€” the occasion signal, not headcount. Three values match the S01b `group_context` chips (`Just me` â†’ `solo`, `Two of us` â†’ `duo`, `A group` â†’ `group`).
- `location` â€” jsonb to mirror today's `rooms.location_*` shape; carries `lat`, `lng`, `name`, etc.
- `session_params` â€” generic jsonb (per [[../../60_engineering/adr/0010-generic-jsonb-votes-schema|ADR 0010]]'s precedent on `votes`) to carry `meal_time`, `service_shape`, and anything else that may be added without a migration.
- `distance_meters` â€” replaces `rooms.radius_meters`. Default `1609` (â‰ˆ1.0 mi, matches the new sg-WF-1 default).
- `status` â€” the lifecycle state machine.
- `reroll_window_closes_at` â€” null while `pending`; computed at verdict-fire time as `date_trunc('day', verdict_at AT TIME ZONE creator_tz) + interval '2 days' - interval '1 second'`. (The exact server-side computation mechanism is sg-WF-6; for this issue, just provision the column.)
- `updated_at` â€” auto-updated via trigger on `UPDATE`.

### Database â€” extend `rooms`

```sql
alter table public.rooms add column plan_id uuid references public.plans(id) on delete set null;
create index rooms_plan_id_idx on public.rooms (plan_id) where plan_id is not null;
```

- `plan_id` â€” nullable FK. Existing rows (created before workflow-overhaul) stay `null`; new rows minted via Plan launch carry the FK. Eventually `not null` once S01+S01b retire (tb-WF-4 + later).

### Database â€” RLS

- `plans` is `RLS-enabled`. Standard `creator_id = auth.uid()` for both read + write.
- Joined-Plan visibility (Account members seeing Plans they joined): not in scope for this issue. Today's `members` table already gates room-level participation; the join-visibility query is the Plan list surface's concern (sg-WF-4 / future tracer-bullet).

### Database â€” state transition

- Add a Postgres function `set_plan_decided_active(p_plan_id uuid)` invoked from the existing `compute-verdict` edge function on successful verdict-fire. Sets `plans.status = 'decided-active'`, populates `reroll_window_closes_at`. (The cron / trigger for `decided-active â†’ decided-expired` is sg-WF-6.)

### iOS â€” PlansStore

A new `@MainActor @Observable PlansStore` that owns:

- `func create(name:scope:locationJSON:sessionParams:distanceMeters:) async throws -> Plan` â€” inserts a row with `status: pending`, returns the typed model.
- `func fetchMine() async throws -> [Plan]` â€” returns the user's plans, ordered `updated_at desc`.
- `func update(planId:fields:) async throws -> Plan` â€” partial update, only while `status = pending`.
- `func delete(planId:) async throws` â€” deletes the Plan; the FK cascade handles the active room's `plan_id` going to `null`.
- `func observe(planId:) -> AsyncStream<Plan>` â€” Realtime subscription (uses the existing Realtime channel pattern; if Realtime infra not yet in place for `plans`, fall back to polling on app foreground).

A `Plan` struct mirrors the schema. Codable, Sendable, with a `LifecycleState` enum for `status`.

### Migrations

- New migration file: `supabase/migrations/<timestamp>_workflow_overhaul_plans_table.sql` â€” additive only.
- CI `supabase-db` lane pushes it to `gettoit-prod`.

### Tests

- Postgres tests (Deno test against the linked DB or a transactional fixture): inserts, RLS enforcement, state-transition function, the `distance_meters` default.
- iOS unit tests for `PlansStore` against a fake Supabase client (the existing pattern in `RoomStoreTests` / `VerdictStoreTests`).
- Boundary assertion: the existing `compute-verdict` path invokes `set_plan_decided_active` when a `room.plan_id` is non-null and the verdict resolves to a venue. (For rooms without a `plan_id` â€” the legacy path â€” nothing changes.)

## Acceptance criteria

- [x] `public.plans` table exists in the linked Supabase project with the schema above, RLS enabled, the appropriate indexes.
- [x] `public.rooms.plan_id` exists as a nullable FK; existing rows are unaffected.
- [x] `set_plan_decided_active` function exists and is invoked by `compute-verdict` on successful verdict-fire (only when `room.plan_id` is non-null).
- [x] `PlansStore` exists on iOS with the operations listed; covered by unit tests against a fake client.
- [x] A Postgres test covers RLS (non-creator cannot read/write) and the state-transition function.
- [x] CI `supabase-db` lane is green; the migration applies cleanly.
- [x] `ios` CI lane is green; no regression to existing tests.
- [x] The existing S01 + S01b flow continues to work unchanged for users (Plans are not yet user-visible).

## Blocked by

None â€” schema can land independently of any spec-gap. The user-facing wiring happens in tb-WF-4.

## Comments


  Two non-obvious calls worth tagging for future readers:
  - **`Location.source` typed as `String` (not enum) on `PlansStore.Location`** â€” keeps the Plan-side decoder tolerant of any future source value without forcing a Plan struct revision. Canonical enum stays on `RoomStore.RoomLocation.Source`.
  - **`plans_creator_id_updated_at_idx` is composite, not a plain `creator_id` index** â€” covers the "my plans" list query `where creator_id = auth.uid() order by updated_at desc` without a sort step.
