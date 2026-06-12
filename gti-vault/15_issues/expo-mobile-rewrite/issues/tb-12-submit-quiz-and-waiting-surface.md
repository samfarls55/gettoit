---
status: done
type: AFK
github_issue: 338
---

# TB-12: Submit quiz and Waiting surface

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Wire Q5 submit into the post-quiz Waiting path. The slice should write quiz answers through a repository seam, render member progress, support the initiator close-voting action, route when a verdict is ready, and handle session-ended state without stranding the user.

## Acceptance criteria

- [ ] Q5 submit writes the quiz payload through a typed repository interface.
- [ ] After submit, group flow routes to Waiting.
- [ ] Waiting renders member progress from a fake/simulated snapshot.
- [ ] Initiator close-voting action calls an injected fire-verdict seam.
- [ ] Verdict-ready state routes to a verdict placeholder.
- [ ] Session-ended state shows feedback and routes back to Plan list.
- [ ] Tests cover submit, Waiting progress, initiator close-voting, verdict-ready routing, and session-ended routing.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-11: Q5 candidate probe.

## Notes

- 2026-06-04: Shipped on `sandcastle/issue-338`. Q5 final submit now writes through a typed `QuizSubmissionRepository` seam and routes to Waiting. Added a fakeable Waiting repository/surface that renders member progress, lets the initiator close voting, routes verdict-ready snapshots to the verdict placeholder, and returns session-ended rooms to the Plan list with feedback. `npm run verify --prefix mobile` passed with the existing non-failing React `act(...)` warnings from async screen hydration.
