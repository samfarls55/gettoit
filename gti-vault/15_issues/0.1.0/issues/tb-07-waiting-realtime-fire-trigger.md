---
issue: tb-07
title: Waiting surface + Realtime + initiator-set timer + Decide-now fire trigger
github_issue: 8
status: done
completed: 2026-05-14
type: AFK
created: 2026-05-12
prd: 0.1.0-prd
implements_spec_gap: 02-s04-decide-now-countdown
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-07 â€” Waiting + Realtime fire trigger

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

## What to build

Land the live-coordination layer. When members submit their Q5 answers, they land on the S04 Waiting surface; the initiator sees an enabled "Decide now" button once at least 2 answers are in; the initiator's timer counts down; if the initiator taps OR the timer expires, the VerdictEngine fires on whoever has answered.

This is the implementation of [[02-s04-decide-now-countdown|spec-gap issue 02]] plus the realtime fanout and the fire trigger itself.

- **Realtime Broadcast** â€” clients subscribe to `room:{roomId}` channel. Vote submission emits a `vote` event for live UI updates (peer avatars flip from unanswered to answered). VerdictEngine emits a `verdict_ready` event when it writes the verdict.
- **Presence channel** â€” drives the avatar row state on S04.
- **Postgres trigger** â€” `AFTER INSERT ON votes` fires the VerdictEngine when `(rooms.status = 'firing' OR now() >= rooms.deadline_at) AND count(votes WHERE room_id = NEW.room_id) >= 2`. `status = 'firing'` is set by the initiator's manual-fire RPC. `deadline_at` is set to `created_at + (timer_minutes * interval '1 minute')` when the room is created.
- **pg_cron job** â€” runs every minute, scans `rooms WHERE status = 'open' AND deadline_at <= now() AND member_answer_count >= 2`, sets `status = 'firing'`, triggers VerdictEngine. The trigger and cron coexist; whichever fires first sets `status = 'verdict_ready'` and the other is a no-op.
- **TimerCoordinator (iOS)** â€” counts down from `deadline_at - now()`. Reactive countdown for UI. Exposes `tap_decide_now()` which calls a `fire_verdict(room_id)` RPC; RPC validates min quorum 2 and flips `status = 'firing'`.
- **Edge case** â€” timer expires with only the initiator answered (no quorum). Room flips to `status = 'expired'`. S04 transitions to a terminal "Couldn't reach quorum tonight" state with a re-invite CTA. Define copy alongside the implementation.
- **Tests** â€” Realtime echo updates the avatar row within 200ms; "Decide now" disabled until 2nd answer arrives; manual fire RPC enforces quorum; pg_cron auto-fire works at deadline; expired-no-quorum routes to terminal state.

## Acceptance criteria

- [x] All [[02-s04-decide-now-countdown|spec-gap 02]] acceptance criteria pass.
- [x] Realtime Broadcast wired for vote events + verdict_ready.
- [x] Postgres trigger + pg_cron auto-fire path verified.
- [x] `fire_verdict(room_id)` RPC enforces min quorum 2 (initiator + 1).
- [x] S04 SwiftUI view renders with the initiator-only Decide-now button and countdown.
- [x] Expired-no-quorum terminal state lands with copy.
- [x] Integration tests for Realtime echo, trigger fire, cron auto-fire, quorum enforcement.

## Blocked by

- [[tb-06-verdict-engine-clean-run|TB-06]]

## Adjacencies

Surfaced during TB-07 but intentionally deferred:

- **Live supabase-swift Realtime wiring** â€” `WaitingStore` is decoupled from the supabase-swift channel API so unit tests can drive `apply(event:)` deterministically. The production channel binding (subscribing to `room:{roomId}` broadcasts, fanning to `apply(event:)`) is a small follow-up; the store + RPC contract is fully observable end-to-end without it.
- **Vote broadcast source-of-truth** â€” voters' devices currently emit the `vote_cast` broadcast on the channel. A future iteration moves the broadcast emission server-side (Postgres trigger via `pg_net`) so the engine is the only sender; the subscriber pattern doesn't change.
- **Method passthrough docs** â€” `compute-verdict` now accepts `method=quorum|deadline|manual` from the dispatcher. `verdict-engine.md` calls this out; if TB-09 wants to introduce `no_survivor` as a method too, the engine's `VerdictMethod` union is the type to extend.
- **fire_verdict UPDATE policy on rooms** â€” the RPC's status flip runs from SECURITY DEFINER context. No client-side UPDATE policy on `rooms` is needed for 0.1.0. If a future surface ever exposes a direct status-flip UPDATE to clients, the policy gap surfaces there â€” flagged in `waiting-fire-trigger.md`.

## Comments
