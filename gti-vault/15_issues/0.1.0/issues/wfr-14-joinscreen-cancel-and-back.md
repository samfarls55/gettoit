---
issue: wfr-14
title: Add Cancel to JoinScreen joining + Back to error phase
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 255
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-14 â€” JoinScreen joining spinner has no Cancel; error state has no Back

## What to build

`.joining` phase shows a progress spinner with no abort path. `.error` phase shows a message with no back/retry link. Add a "Cancel" affordance during joining and a "Go back" link on error.

## Acceptance criteria

- [ ] Cancel affordance visible during `.joining`.
- [ ] Back / "Try another link" visible on `.error`.
- [ ] Cancel clears `deepLink` and returns to PlanList.

## Blocked by

None â€” can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Escape Hatch]]
- [[../../30_design/interaction-patterns/patterns#Error Messages]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #14.

## Comments

- 2026-05-26 â€” Closed by [#287](https://github.com/samfarls55/gettoit/pull/287). Added a shared `onCancel` closure wired to RootView's `deepLink = nil`. Cancel tertiary on `.joining` (11pt eyebrow, 55% opacity â€” matches RerollScreen cancel), "Try another link" tertiary on `.error` (regular eyebrow, 78% opacity â€” matches LockedScreen home chrome). `.joined` deliberately has no escape (host hops straight into the quiz). In-flight join `Task` auto-cancelled by SwiftUI's `.task` modifier on unmount. All CI checks green (ios xcodebuild test 3m50s pass, design-system verify pass).
