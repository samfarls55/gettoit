---
issue: bug-18
title: tsc --noEmit type error in web/lib/quiz.test.ts is not CI-gated
status: needs-triage
type: HITL
github_issue: 208
created: 2026-05-21
---

# bug-18 — Uncaught `tsc --noEmit` type error in web/lib/quiz.test.ts

## Symptom

`web/lib/quiz.test.ts` lines 128-129 produce a `tsc --noEmit` type error. CI
does not catch it: the web lane runs only `npm test` (Vitest) and `npm run
build` (`next build`) — neither does a standalone `tsc --noEmit` of the test
files, so the error ships silently green.

## Detail

- Lines 128-129 are two `(row as Record<string, unknown>)` casts asserting the
  retired v1 `votes` columns (`q1_vetoes`, `q3_walk_minutes`) do not leak onto
  the new generic-slot row.
- Left behind by the tb-WF-10 web quiz v1.1 port.
- Two sub-problems for triage to scope:
  1. Fix the type error itself.
  2. Decide whether the web CI lane should gain a `tsc --noEmit` gate so this
     class of error cannot ship green again.

## Impact

Low — a test-file-only type error; the runtime tests pass. But it is invisible
to CI, so it will rot and can mask future type regressions in the test suite.

## Surfaced by

Flagged by the tb-WF-11 subagent during the 2026-05-21-1812 AFK execution run
(noted as pre-existing, not introduced by tb-WF-11).

## References

- `web/lib/quiz.test.ts:128-129`
- `.github/workflows/ci.yml` — the web lane.
