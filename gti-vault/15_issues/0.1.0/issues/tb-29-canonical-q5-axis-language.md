---
status: ready-for-agent
type: AFK
github_issue: 369
---

# TB-29: Make Active Q5 Axis Language Canonical

## What to build

Make the active Q5 pipeline speak the canonical axis language from ADR 0022 and ADR 0023: `cuisine`, `crowd_approval`, and `vibe`. Any remaining `reputation` vocabulary should be behind a legacy adapter for old stored rows or compatibility reads, not part of the active Q5 module interface, progress shape, submission path, or scoring inputs.

This is a vocabulary and seam cleanup. The user-visible quiz should not change, but submitted votes, Q5 receipts, and scoring inputs should no longer require late translation from active `reputation` terminology.

## Acceptance criteria

- [ ] Active Q5 card receipts, progress state, submitted ratings, and scoring inputs use `crowd_approval` rather than `reputation`.
- [ ] Legacy `reputation` handling remains only where needed to read or migrate older data safely.
- [ ] No active Q5 client module needs to translate from `reputation` to `crowd_approval` at submit time.
- [ ] Vibe scale conversion is owned by one Q5 translation path rather than spread across screen, progress, and submission code.
- [ ] Server preference scoring accepts the canonical active axis language without caller-side vocabulary drift.
- [ ] Existing old vote rows, if supported by current tests, continue to be read through the legacy adapter.
- [ ] Tests cover canonical axis submission, legacy read compatibility, and absence of active `reputation` output in new Q5 receipts.

## Blocked by

- [[tb-28-move-web-mobile-q5-to-assigned-card-sets|TB-28: Move Web And Mobile Q5 Onto Assigned Card Sets]] - GH [#368](https://github.com/samfarls55/gettoit/issues/368)
