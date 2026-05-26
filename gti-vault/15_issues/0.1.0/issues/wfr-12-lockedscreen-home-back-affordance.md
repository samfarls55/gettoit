---
issue: wfr-12
title: Add Home/Back affordance to LockedScreen
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 253
pr: 285
---

# wfr-12 — LockedScreen has no Escape Hatch from terminal state

## What to build

`LockedScreen` renders the verdict-locked state with no path back to PlanList. Add a top-leading or footer "Home" affordance that routes to the post-sign-in PlanList.

## Acceptance criteria

- [ ] Home/Back affordance visible on LockedScreen.
- [ ] Tap dismisses LockedScreen and returns to PlanList via the RootView precedence chain.
- [ ] Snapshot test covers the new chrome.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]
- [[../../30_design/interaction-patterns/principles#P-01. Safe Exploration]]
- [[../../30_design/interaction-patterns/surfaces#Entry]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #12.

## Comments

- 2026-05-26 — Closed via PR #285. `LockedScreen` gains a top-leading `Home` text-verb chrome row mirroring `VerdictScreen.homeChromeRow` (bug-22) — eyebrow-token treatment (Inter 700 / 11 / 0.18em / UPPERCASE / white 0.78), 44pt min hit row, top-trailing reserved 44pt frame for vertical rhythm, rendered at `zIndex(6)` so it sits above the veil + shutters + plate across the entire hard-close choreography. New `onHome: @escaping () -> Void = {}` initializer parameter (defaulted to no-op so existing call shapes stay source-compatible — `LockedScreen` is not currently mounted in RootView, so the parameter is forward-compatible for future mount sites). New static `LockedScreen.homeChromeLabel = "Home"` matching `VerdictScreen.homeChromeLabel`. Test seam `simulateHomeTapForTesting()` exposes the closure invocation as a public method (SwiftUI snapshot tests don't traverse the rendered tree to hit-test buttons). Surface spec amended in-place at `design-system/surfaces/06-hard-close.md` new §"Locked chrome (Home)" + CHANGELOG entry — the S06 surface was status: locked, but the *Escape Hatch* foundation-P-01 gap outranks the lock.
