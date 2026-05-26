---
issue: wfr-23
title: Label Q5 final CTA as Get Verdict / Submit
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 264
---

# wfr-23 — QuizScreen Q5 final CTA label is the generic "Next"

## What to build

On Q5 the primary CTA renders the same Next button as Q1..Q4. Switch to a finish-shaped label ("Get Verdict" or copy from `gti-vault/40_marketing_branding/`) so the final step reads as terminal.

Full autonomy on choice of copy — pick the line that best matches marketing voice. AFK agent should consult `40_marketing_branding/` before settling.

## Acceptance criteria

- [ ] Q5 primary CTA copy differs from Q1..Q4.
- [ ] Copy aligns with marketing voice doc.
- [ ] Snapshot test covers Q5 CTA render.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Prominent "Done" Button or Assumed Next Step]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #23.

## Comments

- 2026-05-26 — Closed via `afk/wfr-23`. Investigated and confirmed both iOS (`QuizQ5Regret.swift`, `QuizQ5NoResults.swift`) and web (`web/components/QuizScreens.tsx`) already render the finish-shaped Q5 CTA copy specced in `design-system/surfaces/03-quiz.md` §Q5 — `"Drop the verdict"` for the default state and `"Head to the verdict"` for the no-results mode. AC #1 (differs from Q1..Q4 generic `Next`) and AC #2 (aligns with marketing-voice / locked design-system copy) were already satisfied in source — the runtime gap was AC #3 (missing test coverage on the literal CTA label that would catch a paraphrase regression). Pinned the two iOS CTA labels as `public static let primaryCTALabel` constants on `QuizQ5Regret` / `QuizQ5NoResults` (mirrors the `QuizScreen.sessionEndedToastLabel` convention introduced for bug-38) and added two locked-copy tests in `ios/Tests/QuizScreenSnapshotTests.swift` under a new `wfr-23 — Q5 final CTA copy is finish-shaped` MARK. Added a paired RTL test in `web/components/QuizScreens.test.tsx` asserting the Q5 default state renders the `"Drop the verdict"` button and never the generic `Next`. No marketing-voice copy change was needed — `40_marketing_branding/` does not yet exist beyond the landing-page positioning note, and the design-system already owns the canonical Q5 copy.
