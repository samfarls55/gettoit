---
issue: tb-07
title: Waiting surface + Realtime + initiator-set timer + Decide-now fire trigger
github_issue: 8
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
implements_spec_gap: 02-s04-decide-now-countdown
---

# TB-07 — Waiting + Realtime fire trigger

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

Land the live-coordination layer. When members submit their Q5 answers, they land on the S04 Waiting surface; the initiator sees an enabled "Decide now" button once at least 2 answers are in; the initiator's timer counts down; if the initiator taps OR the timer expires, the VerdictEngine fires on whoever has answered.

This is the implementation of [[02-s04-decide-now-countdown|spec-gap issue 02]] plus the realtime fanout and the fire trigger itself.

- **Realtime Broadcast** — clients subscribe to `room:{roomId}` channel. Vote submission emits a `vote` event for live UI updates (peer avatars flip from unanswered to answered). VerdictEngine emits a `verdict_ready` event when it writes the verdict.
- **Presence channel** — drives the avatar row state on S04.
- **Postgres trigger** — `AFTER INSERT ON votes` fires the VerdictEngine when `(rooms.status = 'firing' OR now() >= rooms.deadline_at) AND count(votes WHERE room_id = NEW.room_id) >= 2`. `status = 'firing'` is set by the initiator's manual-fire RPC. `deadline_at` is set to `created_at + (timer_minutes * interval '1 minute')` when the room is created.
- **pg_cron job** — runs every minute, scans `rooms WHERE status = 'open' AND deadline_at <= now() AND member_answer_count >= 2`, sets `status = 'firing'`, triggers VerdictEngine. The trigger and cron coexist; whichever fires first sets `status = 'verdict_ready'` and the other is a no-op.
- **TimerCoordinator (iOS)** — counts down from `deadline_at - now()`. Reactive countdown for UI. Exposes `tap_decide_now()` which calls a `fire_verdict(room_id)` RPC; RPC validates min quorum 2 and flips `status = 'firing'`.
- **S04 SwiftUI port** — full port of [[../../../../design-system/surfaces/04-waiting|S04]] including: avatar row with answered / answering states, live update via Realtime, initiator-only "Decide now" CTA (disabled below quorum), countdown timer display, optional nudge button (rate-limited 1 per 2 min). Apply the surface updates from [[02-s04-decide-now-countdown|spec-gap 02]] in the design-system first, then port to SwiftUI.
- **Edge case** — timer expires with only the initiator answered (no quorum). Room flips to `status = 'expired'`. S04 transitions to a terminal "Couldn't reach quorum tonight" state with a re-invite CTA. Define copy alongside the implementation.
- **Tests** — Realtime echo updates the avatar row within 200ms; "Decide now" disabled until 2nd answer arrives; manual fire RPC enforces quorum; pg_cron auto-fire works at deadline; expired-no-quorum routes to terminal state.

## Acceptance criteria

- [ ] All [[02-s04-decide-now-countdown|spec-gap 02]] acceptance criteria pass.
- [ ] Realtime Broadcast wired for vote events + verdict_ready.
- [ ] Postgres trigger + pg_cron auto-fire path verified.
- [ ] `fire_verdict(room_id)` RPC enforces min quorum 2 (initiator + 1).
- [ ] S04 SwiftUI view renders with the initiator-only Decide-now button and countdown.
- [ ] Expired-no-quorum terminal state lands with copy.
- [ ] Integration tests for Realtime echo, trigger fire, cron auto-fire, quorum enforcement.

## Blocked by

- [[tb-06-verdict-engine-clean-run|TB-06]]
