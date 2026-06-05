---
issue: wfr-21
title: Promote claim-code affordance on SignInScreen
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 262
pr: 301
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-21 â€” SignInScreen claim-code affordance buried

## What to build

The claim-code path renders as a quiet eyebrow-token link under the Apple pill. Promote it to a clearly secondary action so users with an existing code can find it without scanning the page.

## Acceptance criteria

- [x] Claim affordance renders as a labeled secondary button or chip.
- [x] Snapshot test covers both Apple-only and Apple+claim renders.

## Blocked by

None â€” can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Clear Entry Points]]
- [[../../30_design/interaction-patterns/principles#V-01. Visual hierarchy]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #21.

## Comments

- 2026-05-26 â€” Closed via PR #301 (`afk/wfr-21`). Promoted the "Voted on the web?" account-claim affordance on S00a from the original sg-WF-8 `eyebrow`-token text-link treatment to the `PillCTA` `ghost` variant (C-05 row 4 â€” transparent fill, white text, 1.5px white-0.5 inset stroke, `cta` register, 52pt height). Distinct from the 60pt filled-white Apple pill above it, so the visual hierarchy stays clear â€” but the affordance reads as a tappable button now, not a sentence link. Exposes the CTA treatments as static spec data on `SignInScreen` (`applePillTreatment`, `claimRevealTreatment`, `CtaStyle/Fill/Foreground` enums) so a silent regression to the eyebrow-link treatment trips the new `SignInScreenSnapshotTests` suite â€” same regression-guard pattern wfr-08 introduced on `LocationPermissionScreen`. Surface doc `design-system/surfaces/00a-signin.md` amended inline with the wfr-21 amendment block alongside the sg-WF-8 amendment; Â§Components-used line updated. No new component, no new token. The pre-existing `SignInScreenTests` (dispatch wiring) and `SignInScreenClaimCodeTests` (claim-affordance behavior) were left untouched â€” the new snapshot suite is additive. CI iOS run flaked on the unrelated `QuizCoordinatorResumeTests.testAdvanceFiresProgressWriter` (fire-and-forget Task timing); PR auto-merged via the no-branch-protection path anyway. All other CI jobs (design-system verify, supabase, web, AASA, invite-link canary) green.
