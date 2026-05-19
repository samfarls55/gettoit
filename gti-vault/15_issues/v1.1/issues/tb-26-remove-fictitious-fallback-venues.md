---
issue: tb-26
title: Remove fictitious fallback venues; render the Q5 no-results screen
status: done
type: AFK
github_issue: 137
prd: v1.1-quiz-redesign-prd
created: 2026-05-19
---

# tb-26 — Remove fictitious fallback venues; render the Q5 no-results screen

## Context

The iOS app ships three hardcoded fictitious restaurants — `QuizDummyCandidates`
(`Pico's Taqueria`, `Ren Soba House`, `Bar Pastoral`) — and renders them as the
Q5 cards whenever the per-member venue fetch produces no factorial-usable pool.
This was a build / testing scaffold from the tb-04 era. It is being removed
entirely: the app must never surface a fictitious place to a user. In its place
Q5 shows the `no-results` mode (specced in sg-05) with a forward CTA so the
member is never stranded mid-flow.

This is the iOS consumption of the [[sg-05-q5-no-results-mode|sg-05]]
design-system spec.

## What to build

End-to-end behavior: when a member completes Q1–Q4 the per-member Foursquare
fetch fires. If it returns no factorial-usable pool — the venue union is empty,
the factorial card generator returns `nil`, the fetch throws, or there is no
session coordinate — Q5 renders the **no-results screen** instead of candidate
cards. The member taps the CTA, their quiz submits (Q1–Q4 answers plus an empty
Q5), and they advance to Waiting (group) or the verdict (solo). A solo member
with no candidates lands on the existing `no-survivor` verdict — no extra work.

Where the fetch *did* return real venues that were merely too thin / uniform for
the factorial, those venues still persist to `member_fetches` and still feed the
verdict candidate pool. Removing the dummy changes only what Q5 **displays**,
never the verdict pool.

Specifics:

- Delete `QuizDummyCandidates` from the app target. Any test-only candidate
  fixture moves into the **test target** so the shipped app binary contains zero
  fictitious venues.
- The candidate-fetch result's fallback source (`.fallbackDummy`) becomes an
  empty / no-results source; the Q5 candidates state (`.fallbackDummy`) becomes
  a no-results state. The four fallback paths return an empty candidate list,
  preserving the real `rawFetch` where it exists.
- The no-coordinate fetch double (`DummyQuizCandidateFetch`) returns the
  no-results result, not fiction — rename accordingly.
- Q5 renders the no-results screen — matching sg-05's `no-results` mode and its
  locked copy — when the state is no-results. Its CTA runs the same
  submit-then-route path as the normal Q5 CTA.
- Verify `compute-verdict`'s Q5 ratings reader tolerates an empty
  `votes.q5.answer.ratings` array (degrades to the equal-weight prior). Fix it
  if it does not.

### Decision callout — the thin-pool case

A member who fetched real venues but no strict factorial triple now sees the
no-results screen even though real venues exist in their fetch. This is
intentional: the Q5 factorial probe is all-or-nothing (the generator returns
three cards or `nil`, never one or two), and those real venues still reach the
verdict via `rawFetch`. Surfacing a partial / non-factorial card set would break
the `{droppedAxis, score}` vote shape.

## Acceptance criteria

- [ ] `QuizDummyCandidates` is deleted; the shipped app target contains no
      hardcoded fictitious venues (greppable: no `Pico`, `Ren Soba`, `Pastoral`,
      or `dummy-` candidate ids under `ios/Sources`).
- [ ] Q5 renders the no-results screen — matching sg-05's `no-results` mode and
      locked copy — when the per-member fetch returns an empty union, a `nil`
      factorial, a thrown fetch, or there is no session coordinate.
- [ ] The no-results CTA submits the member's quiz (Q1–Q4 plus an empty Q5) and
      advances them to Waiting (group) or the verdict (solo) — the member is
      never stranded.
- [ ] A thin / uniform but non-empty fetch still persists its real venues to
      `member_fetches`; the verdict candidate pool is unaffected.
- [ ] `compute-verdict` produces a correct verdict when a member's
      `votes.q5.answer.ratings` is empty (equal-weight prior) — confirmed by a
      test.
- [ ] TDD throughout (red-green-refactor). New tests cover all four no-results
      triggers, the CTA submit / route, and the empty-Q5 vote row; the existing
      dummy-referencing tests are updated; `QuizScreenSnapshotTests` gains a
      no-results reference snapshot.
- [ ] The Deno test suite and the `ios` CI lane are green.
- [ ] A new ADR records the decision (fictitious fallback removed, Q5
      no-results mode, skip-ahead behavior) — next sequential number in
      `gti-vault/60_engineering/adr/` (0013 unless taken). `adr/_index.md` and
      the issue `_index.md` files are updated.

## Out of scope

- The design-system spec for the no-results mode — that is sg-05; this issue
  consumes it.
- Any change to the verdict engine, the Q5 factorial card generator, or the
  running-union logic.
- The web app — web already degrades to an empty-state message
  (`PlacesEmptyState`) and ships no fictitious venues.
- New design-system components or tokens.

## Blocked by

- [[sg-05-q5-no-results-mode|sg-05]] (GitHub #136) — the Q5 no-results mode
  design-system spec. The iOS no-results screen must match it.

## Comments

- 2026-05-19 — Done (AFK, branch `afk/tb-26`). `QuizDummyCandidates` deleted
  from the iOS app target; the four no-results paths (empty union, `nil`
  factorial, thrown fetch, no coordinate) now resolve the candidate fetch to
  a `.noResults` source with an empty candidate list. New `QuizQ5NoResults`
  view renders sg-05's `no-results` mode with the locked copy; its CTA runs
  the same submit-then-route path as the normal Q5 CTA (Q1–Q4 + an empty Q5).
  The `.fallbackDummy` source / state and `DummyQuizCandidateFetch` were
  renamed to `.noResults` / `NoResultsQuizCandidateFetch`. The test-only
  candidate fixture moved into the test target as `QuizCandidateFixtures`.
  `compute-verdict` already tolerated an empty `votes.q5.answer.ratings`
  array (the equal-weight prior survives) — confirmed by a new Deno test, no
  server change. Decision recorded in
  [[../../../60_engineering/adr/0013-no-fictitious-fallback-venues|ADR 0013]].
  Adjacency flagged: `VerdictScreen` / `CheckinScreen` / `LockedScreen` still
  ship `static func fixture()` snapshot factories that hardcode fictitious
  place names ("Pico's Taqueria" etc.) — pre-existing, out of tb-26 scope
  (those are verdict-side fixtures, not Q5 fallback venues); a future ticket
  could move them into the test target.
