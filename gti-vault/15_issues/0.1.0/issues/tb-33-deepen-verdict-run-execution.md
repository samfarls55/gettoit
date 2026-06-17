---
status: ready-for-agent
type: AFK
github_issue: 373
---

# TB-33: Deepen Verdict Run Execution

## What to build

Refactor the final Verdict firing path around a deep Verdict Run module for one Room. The external behavior should stay the same: a ready Room fires deterministically, handles idempotency/reroll state, computes a Verdict or no-survivor outcome, persists the slate and receipts, broadcasts readiness, and transitions the Plan/Room state correctly.

The internal architecture should stop making one wide handler/adapter seam carry HTTP concerns, member selection, provider fetch, option writes, Vibe prefiltering, scoring, persistence, notifications, and Plan transition at the same level. The new shape should give those responsibilities stronger locality behind the Verdict Run seam.

## Acceptance criteria

- [ ] A ready Room can still fire a live Verdict through the existing public trigger path.
- [ ] Duplicate or concurrent firing requests remain idempotent.
- [ ] Reroll firing still respects the existing reroll state and persistence behavior.
- [ ] Active-member filtering, submitted vote loading, provider Candidate pool fetch, hard eligibility, Vibe fit, scoring, slate persistence, notification/broadcast, and Plan transition are orchestrated through a deep Verdict Run path.
- [ ] The data adapter used by the firing path is narrower or more behavior-oriented than the current broad fetch/write method collection.
- [ ] No-survivor outcomes still persist and surface according to current product behavior.
- [ ] Tests cover normal live Verdict, no-survivor, duplicate firing, reroll, persistence, and broadcast/transition behavior.
- [ ] Existing Google/Vibe storage boundaries from ADR 0022 and ADR 0023 remain intact.

## Blocked by

- [[tb-32-shared-hard-eligibility-core|TB-32: Share Hard Eligibility Between Vibe Fit And Verdict]] - GH [#372](https://github.com/samfarls55/gettoit/issues/372)
