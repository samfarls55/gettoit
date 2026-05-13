---
issue: tb-11
title: Late-joiner read-only Verdict mode + re-invite CTA
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
implements_spec_gap: 03-s05-late-joiner-read-only
---

# TB-11 — Late-joiner read-only verdict

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

When a user taps the invite link AFTER the verdict has fired, they land on the S05 surface in `read-only` mode — verdict + rule + receipts visible, ratification and reroll suppressed, with a `"Start a new decision"` CTA that returns them to S01 (as the new initiator).

This is the implementation of [[03-s05-late-joiner-read-only|spec-gap issue 03]] plus the routing that decides which mode to show.

- **Deep-link router update** — when the link is tapped, the join handler checks `rooms.status`:
  - `status IN ('open', 'firing')` — proceed to quiz (existing TB-04 path).
  - `status IN ('verdict_ready', 'locked', 'expired')` — route to S05 in `read-only` mode.
- **S05 read-only mode** — apply the changes in [[03-s05-late-joiner-read-only|spec-gap 03]] to the design-system spec + JSX, then port to SwiftUI. Visible: eyebrow `"Tonight's verdict"`, verdict hero + meta + time badge + rule chip + voice receipts (late-joiner NOT in receipts). Suppressed: ratification CTA, reroll, "Start over" secondary. Replace primary CTA with `"Start a new decision"` (white pill).
- **Re-invite flow** — tapping `"Start a new decision"` opens S01 with `timer_minutes` and `radius_meters` pre-populated from the prior room. The user is the new initiator.
- **Tests** — deep link to a room with `status='locked'` routes to read-only; voice-receipt row excludes the late-joiner; re-invite CTA creates a new room with the prior room's defaults; late-joiner is not added to `members` of the closed room.

## Acceptance criteria

- [ ] All [[03-s05-late-joiner-read-only|spec-gap 03]] acceptance criteria pass.
- [ ] Deep-link router routes by `rooms.status`.
- [ ] S05 SwiftUI view supports the `read-only` mode.
- [ ] Re-invite CTA opens S01 with prior timer + radius defaults.
- [ ] Late-joiner is not added to `members` of the closed room.
- [ ] Integration tests for late-join routing, read-only render, re-invite defaults.

## Blocked by

- [[tb-08-ratification-push-hard-close|TB-08]]
