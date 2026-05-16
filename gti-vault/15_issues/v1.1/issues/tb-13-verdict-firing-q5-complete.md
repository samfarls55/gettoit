---
issue: tb-13
title: Verdict firing on the new Q5-complete signal
status: ready-for-agent
type: AFK
github_issue: 74
prd: v1.1-quiz-redesign-prd
created: 2026-05-15
---

# tb-13 — Verdict firing on Q5-complete

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — verdict-firing user stories (33-36). Not a labelled PRD module; small slice re-pointing the existing firing mechanism.

## What to build

Re-point the existing verdict-firing mechanism (the v1 close-voting control, auto-fire-on-all-complete, and solo-verdict paths — `verdict-engine-solo.test.ts` already exists) at the **new quiz's "completed Q5" signal**. The verdict fires when all participants complete Q5, or when the initiator closes voting — no timer, no shot clock. A dead session with only the initiator still resolves.

## Acceptance criteria

- [ ] The verdict fires automatically once all participants have completed Q5.
- [ ] The initiator's "close voting" control produces the verdict without waiting on a straggler.
- [ ] A solo session (initiator alone) still produces a verdict.
- [ ] There is no shot clock or timer on the quiz.
- [ ] Tests cover all-complete auto-fire and solo firing on the new Q5-complete signal.

## Blocked by

- [[tb-08-q5-factorial-probe|tb-08]] — defines the Q5-complete signal.
- [[tb-11-verdict-engine-rewrite|tb-11]] — the verdict the firing path triggers.
