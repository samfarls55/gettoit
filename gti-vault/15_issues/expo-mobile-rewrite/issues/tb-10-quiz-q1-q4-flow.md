---
status: done
type: AFK
github_issue: 335
---

# TB-10: Quiz Q1-Q4 flow

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Implement the quiz flow through Q1-Q4 with local state, progress persistence seams, Plan back, and Plan exit/leave behavior. The slice should focus on testable quiz navigation and answer state before Q5 candidate work.

## Acceptance criteria

- [x] Starting or joining a Room can route into Quiz at Q1.
- [x] Q1-Q4 screens capture and preserve answers in the quiz state model.
- [x] Plan back moves to the prior question with prior answers preserved.
- [x] Plan exit/leave routes out through a repository seam and returns to the expected destination.
- [x] Progress persistence is an injected dependency and can be faked in tests.
- [x] Tests cover forward navigation, back navigation, answer preservation, exit/leave, and resume state.
- [x] Typecheck and mobile tests pass.

## Implementation note

Completed in branch `sandcastle/issue-335`. The Expo app now routes joined Plans and solo Plan launches into a local Q1-Q4 Quiz surface, tracks answer state for cuisine craving, spend cap, reputation, and vibe, persists progress through an injected `QuizProgressRepository`, resumes from saved progress, and exits/leaves through the same seam back to the Plan list. Q5 candidate loading remains outside this issue.

## Blocked by

- TB-08: Setup create/edit Plan.

