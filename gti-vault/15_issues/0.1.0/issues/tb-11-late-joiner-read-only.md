---
issue: tb-11
title: Late-joiner read-only Verdict mode + re-invite CTA
github_issue: 12
status: done
type: AFK
created: 2026-05-12
completed: 2026-05-14
prd: 0.1.0-prd
implements_spec_gap: 03-s05-late-joiner-read-only
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-11 â€” Late-joiner read-only verdict

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

## What to build

When a user taps the invite link AFTER the verdict has fired, they land on the S05 surface in `read-only` mode â€” verdict + rule + receipts visible, ratification and reroll suppressed, with a `"Start a new decision"` CTA that returns them to S01 (as the new initiator).

This is the implementation of [[03-s05-late-joiner-read-only|spec-gap issue 03]] plus the routing that decides which mode to show.

- **Deep-link router update** â€” when the link is tapped, the join handler checks `rooms.status`:
  - `status IN ('open', 'firing')` â€” proceed to quiz (existing TB-04 path).
  - `status IN ('verdict_ready', 'locked', 'expired')` â€” route to S05 in `read-only` mode.
- **Re-invite flow** â€” tapping `"Start a new decision"` opens S01 with `timer_minutes` and `radius_meters` pre-populated from the prior room. The user is the new initiator.
- **Tests** â€” deep link to a room with `status='locked'` routes to read-only; voice-receipt row excludes the late-joiner; re-invite CTA creates a new room with the prior room's defaults; late-joiner is not added to `members` of the closed room.

## Acceptance criteria

- [x] All [[03-s05-late-joiner-read-only|spec-gap 03]] acceptance criteria pass.
- [x] Deep-link router routes by `rooms.status`.
- [x] S05 SwiftUI view supports the `read-only` mode.
- [x] Re-invite CTA opens S01 with prior timer + radius defaults.
- [x] Late-joiner is not added to `members` of the closed room.
- [x] Integration tests for late-join routing, read-only render, re-invite defaults.

## Blocked by

- [[tb-08-ratification-push-hard-close|TB-08]]
