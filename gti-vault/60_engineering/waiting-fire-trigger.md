---
folder: 60_engineering
purpose: TB-07 — S04 Waiting surface, Realtime wiring, verdict-fire trigger + cron
---

# Waiting + Realtime + verdict-fire trigger — TB-07

Server-authoritative auto-fire path that turns the room's state forward through the S04 Waiting surface and into S05 Verdict. Documents the moving parts so future agents can extend the path without re-deriving the choices.

## Where the canonical code lives

- **Schema migrations**
  - `supabase/migrations/20260513223000000_rooms_deadline_at_and_firing_status.sql`
    - Adds `rooms.deadline_at timestamptz` and a BEFORE INSERT trigger that derives it as `created_at + (timer_minutes * interval '1 minute')`.
    - Widens `rooms.status` check constraint to admit `'firing'`.
    - Introduces `public.is_room_member(uuid, uuid)` SECURITY DEFINER helper + a wider `members_select_via_helper` SELECT policy so the S04 avatar row can render every co-member.
  - `supabase/migrations/20260513223500000_fire_verdict_rpc.sql`
    - Initial cut of `public.fire_verdict(uuid)` RPC — initiator-only, min-quorum-2 enforced, flips `status='firing'`. Pure status-flip path.
  - `supabase/migrations/20260513224000000_verdict_fire_trigger_and_cron.sql`
    - Replaces `fire_verdict` with the dispatch-aware version — adds inline `dispatch_compute_verdict(p_room_id)` call after the status flip.
    - Adds `public.dispatch_compute_verdict(uuid)` — fire-and-forget HTTP POST via `pg_net` to the `compute-verdict` Edge Function.
    - Adds `AFTER INSERT ON votes` trigger that dispatches when `status='firing'` OR `deadline_at <= now()` AND `vote_count >= 2`.
    - Adds `public.cron_auto_fire_or_expire()` worker + `pg_cron` schedule `'gettoit_verdict_auto_fire'` running every minute.
- **Edge Function** — `supabase/functions/compute-verdict/handler.ts`
  - Now accepts a `method` field on the request body (`manual` default; `quorum` / `deadline` from the trigger / cron paths).
  - Calls `markRoomVerdictReady(room_id)` (flip `rooms.status` to `verdict_ready` for clients subscribing to row updates) and `emitVerdictReadyBroadcast(room_id, verdict_id)` (Realtime Broadcast on the `room:{roomId}` channel) post-write.
- **iOS surface** — `ios/Sources/App/WaitingScreen.swift`
  - Full S04 port: top eyebrow, "N of M / ARE IN" headline, avatar row with answered/answering state, body copy, mono-tag countdown, Decide-now CTA (initiator-only, quorum-gated), Nudge CTA, Auth Upgrade Chip (preserved from TB-12), expired-no-quorum terminal mode.
- **iOS state** — `ios/Sources/App/WaitingStore.swift` + `ios/Sources/App/TimerCoordinator.swift`
  - `WaitingStore` — observable `members`, `answered`, `status`, `verdictReady`; reacts to `WaitingStoreEvent` cases (`memberJoined` / `voteCast` / `roomStatusChanged` / `verdictReady`). Local nudge rate-limit (1 per 2 min) per surface spec.
  - `TimerCoordinator` — observable `secondsRemaining` from injected clock + invoker seam for the `fire_verdict` RPC. `formatCountdown` + `formatCountdownReducedMotion` pure-function helpers per `surfaces/04-waiting.md`.

## Two fire paths, one engine

Both paths share the same `dispatch_compute_verdict(p_room_id)` function. The function reads the cluster GUC settings `app.supabase_url` + `app.service_role_key` and POSTs to the Edge Function endpoint via `pg_net`. Failure modes:

- **GUC unset (local dev / CI)** — the dispatcher silently no-ops. The RPC + trigger + cron still update `rooms.status`; the iOS layer's direct invoke is the live engine call.
- **Edge Function returns 422 (TB-09 no-survivor)** — the dispatcher fired-and-forgot; no error path is captured. The verdict surface still routes to S05 — TB-09 lands the no-survivor terminal mode there.

The Edge Function's idempotency contract (`verdicts.room_id` unique constraint + `existingVerdict` short-circuit) means double-dispatches are safe.

## RLS recursion landmine resolution

The members SELECT policy from TB-02 (`members_select_self`) only let a user read their OWN member row. S04's avatar row needs to see every co-member. TB-07 lands the SECURITY DEFINER helper pattern the engineering note in `20260513210500000_fix_members_rls_recursion.sql` flagged for this tracer bullet:

```sql
create function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.members m
        where m.room_id = p_room_id and m.user_id = p_user_id
    );
$$;

create policy "members_select_via_helper" on public.members
    for select to authenticated
    using (public.is_room_member(room_id, (select auth.uid())));
```

The function runs as the postgres role internally, bypassing the `members` SELECT policy and avoiding the recursion. The narrower `members_select_self` policy stays in place so the bootstrap-bootstrap path (room creator inserting their own member row before the join policy admits them) keeps working.

## Realtime delivery contract

Per `stack-patterns.md §Realtime`:

- **Broadcast** is the canonical channel for live fanout. The Edge Function emits `verdict_ready` on `room:{roomId}` after writing the verdict.
- **Postgres Changes** is the cold-start hydration path only — iOS subscribes to it to pick up the initial `members` + `votes` snapshot, but live updates flow through Broadcast.
- **Presence** is a future polish layer; the avatar row uses the `votes` row's existence as the "answered" signal, not Presence's online lights.

The iOS subscriber pattern (left to a follow-up because supabase-swift Realtime is hard to mock in CI):
1. Bootstrap fetch of `members` + `votes` from PostgREST.
2. Subscribe to the `room:{roomId}` broadcast channel.
3. On `vote_cast` broadcast → `WaitingStore.apply(event: .voteCast(userID:))`.
4. On `verdict_ready` broadcast → `WaitingStore.apply(event: .verdictReady)`.
5. View routes into S05 via `onChange(of: store.verdictReady)`.

The vote-cast broadcast is emitted client-side from the voter's device — the votes INSERT writes the durable record; the broadcast is the live wake-up. (A future iteration can move the broadcast to a Postgres trigger so the source-of-truth is server-side.)

## Manual fire RPC outcomes

The `fire_verdict(p_room_id)` RPC returns one of:

- `{"status":"firing","vote_count":N}` — happy path.
- `{"status":"already_firing","room_status":"<state>"}` — concurrent press or cron already flipped the row.
- `{"error":"below_quorum","vote_count":N}` — fewer than 2 votes.
- `{"error":"not_initiator"}` — caller isn't `creator_user_id`.
- `{"error":"room_not_found"}` — no such row or RLS hides it.
- `{"error":"unauthenticated"}` — no JWT context.

The iOS `TimerCoordinator.tapDecideNow()` maps these to a `FireVerdictOutcome` enum the view surfaces.

## Expired-no-quorum terminal

When `deadline_at` elapses with `vote_count < 2`, the cron job flips `rooms.status` to `'expired'` (not `firing`). The iOS view observes this via the Realtime channel and renders the terminal mode — `"COULDN'T REACH / QUORUM TONIGHT"` plus a `"Start over"` white pill that returns the initiator to S01 with their prior radius + timer pre-populated. Surface copy lives in `surfaces/04-waiting.md §"Edge cases"`.

## What's intentionally out of scope for TB-07

Tracked in subsequent tickets:

- **TB-08** — `"I'm in"` ratification + push permission prompt + hard-close motion.
- **TB-09** — soft-pref relax + no-survivor terminal (S05 `no-survivor` mode). The dispatcher path lights up automatically when the engine starts emitting `method='no_survivor'`.
- **TB-11** — late-joiner read-only verdict surface.
- **Supabase-swift Realtime wiring** — the WaitingStore is decoupled from the supabase-swift Realtime API on purpose so unit tests can drive `apply(event:)` without a network round-trip. The live channel wiring (`client.channel("room:\(roomID)").send(...)` on the voter device + the corresponding `.onBroadcast` subscriber) lands as a small follow-up that's safer to debug after the schema + RPC contract is observable end-to-end.

## Adjacencies flagged (not fixed)

- **Vote broadcast vs. Postgres Changes** — TB-07's iOS path leans on the vote sender's device to emit the broadcast. A future iteration can move the source-of-truth to a Postgres trigger that fires the broadcast via `pg_net` on every votes INSERT, mirroring the verdict-ready broadcast pattern. The schema is broadcast-agnostic; the iOS subscriber doesn't care which producer fires the event.
- **fire_verdict UPDATE policy on rooms** — the RPC writes to `rooms.status` from SECURITY DEFINER context so no client-side UPDATE policy is needed. If a future surface ever exposes a direct status-flip UPDATE to clients, the policy gap surfaces there — out of scope for TB-07.
- **`emitVerdictReadyBroadcast` failure semantics** — the live adapter logs and swallows. iOS clients that miss the broadcast can still poll the `verdicts` row when the room status flips to `verdict_ready` (a separate Postgres Changes subscription on `rooms` would catch this).

## Related

- [[../10_prds/v1-prd|v1 PRD]] §"Group size, fire trigger, timer"
- [[verdict-engine|verdict-engine.md]] — engine architecture + idempotency contract
- [[stack-patterns|stack-patterns.md]] §"Realtime" + §"Deadline / quorum / verdict computation"
- [[../15_issues/v1/issues/02-s04-decide-now-countdown|spec-gap 02]] — surface-level scope
- [[../15_issues/v1/issues/tb-07-waiting-realtime-fire-trigger|TB-07 ticket]]
