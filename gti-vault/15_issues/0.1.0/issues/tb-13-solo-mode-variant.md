---
issue: tb-13
title: Solo mode â€” Verdict (S05) variant + solo quiz path
github_issue: 14
status: done
type: AFK
created: 2026-05-12
completed: 2026-05-14
prd: 0.1.0-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-13 â€” Solo mode variant

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

## What to build

Solo mode â€” a user runs the same 5-question quiz without inviting anyone. No Waiting surface (no other members to wait on); verdict surface drops the per-member voice-receipt row (no group to receipt); save-group affordance becomes save-taste-profile affordance.

- **Solo path detection** â€” after a room is created and the initiator submits Q5, if no other `members` rows exist for the room AND the initiator did NOT share an invite link, the flow skips S04 Waiting and jumps directly to verdict computation followed by S05 in the solo variant.
- **VerdictEngine** â€” runs identically; with one member's `votes` row the EBA chain still produces a survivor set and the regret tiebreaker still picks the maximum. The rule chip names the rules without any "3/4 wanted X" counts.
- **Sign-in upgrade chip** â€” solo mode is the highest-conversion moment for Apple Sign-in (the user just demonstrated effort). The auth chip from TB-12 also surfaces on the solo verdict surface (not on S04 since S04 is skipped).
- **Tests** â€” solo flow runs end-to-end without an invite share; S05 solo variant suppresses the voice-receipt row; rule_text doesn't reference "N of M" counts on a solo run; auth chip surfaces on the solo verdict surface.

## Acceptance criteria

- [x] `code/screens/ScreenVerdict.jsx` supports the solo variant via prop.
- [x] Solo-path detection skips S04 when `members.length === 1` and no invite was shared.
- [x] S05 SwiftUI view supports the solo variant.
- [x] VerdictEngine produces a sensible verdict on a single `votes` row.
- [x] Auth upgrade chip surfaces on the solo verdict surface.
- [x] Integration tests for the solo path, solo verdict rendering, rule_text without counts.

## Blocked by

- [[tb-08-ratification-push-hard-close|TB-08]]
