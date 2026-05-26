---
issue: wfr-15
title: Add Cancel affordance to CheckinScreen choice phase
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 256
pr: 288
---

# wfr-15 — CheckinScreen has no Cancel on choice surface

## What to build

Before the user taps a checkin outcome, there is no path to abandon. Add a top-leading "Cancel" chrome glyph.

## Acceptance criteria

- [ ] Cancel visible on choice phase.
- [ ] Tap dismisses without writing a checkin.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #15.

## Comments

- 2026-05-26 — Closed by PR #288. Added a top-leading `Cancel` chrome glyph to `CheckinScreen` that renders during the choice phase (`selectedOutcome == nil && !committed`) and reverts to the decorative GTI paper-circle once an outcome is selected. Tap fires a new `onCancel` seam (defaulted to `{}` for back-compat with snapshot fixtures) without writing a `check_ins` row. Mirrors the wfr-14 / `JoinScreen` shape (`cancelLabel` + `simulateCancelTapForTesting`). Inline decision: keep Cancel hidden on the skipped-reason chip row — the chip row is a continuation of the user's first tap, not a new commitment, so showing Cancel there would muddle the Escape Hatch single-destination contract; the chip row's own `DONE` is the commitment point.
