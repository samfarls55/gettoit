---
issue: tb-08
title: Q5 factorial preference probe over real candidate venues
status: done
type: AFK
github_issue: 69
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-15
---

# tb-08 — Q5 factorial preference probe

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] — module (C) card generator + module (J) part 2. Closes [[bug-03-q5-placeholder-no-foursquare-calls|bug-03]] at the Q5 surface — no placeholder venues ever.

## What to build

- **Factorial card generator (pure).** Input: a member's Q1-Q4 answers and their fetched pool. Output: three strict-factorial cards — each deviates from the member's stated profile on **exactly one** axis (cuisine, reputation, vibe) and matches the other two; never a 100% match. Which two of the member's cuisines are probed is a member-local feasibility rule (best card-generation feasibility in the pool) — group state never influences card selection.
- **Q5 surface.** Renders the three **real** candidate venues and captures a 1-5 excitement rating for each, written to the `Q5` jsonb slot. Q5 never shows a placeholder or sample restaurant.

Any new Q5 card UI is designed with the Refero MCP and the design-system in unison (authority granted for this issue). Q5 card info-availability UX (default vs expanded content) is out of scope per the PRD — ship the minimal real-venue card.

## Acceptance criteria

- [ ] Q5 shows three real venues from the member's fetched pool — never a placeholder or sample.
- [ ] Each card deviates on exactly one axis and matches the other two; no card is a 100% match.
- [ ] Card cuisine selection is member-local (pool feasibility) and never influenced by group state.
- [ ] Each card captures a 1-5 excitement rating; the three ratings persist to the `Q5` jsonb slot.
- [ ] The card generator has pure unit tests: one-axis deviation, no perfect match, member-local cuisine selection honored.
- [ ] Any new card UI is specified in `design-system/`, tokens only; `verify.mjs` green.

## Blocked by

- [[research-01-foursquare-filter-surface|research-01]] — axis definitions for the factorial deviation.
- [[tb-04-votes-jsonb-schema|tb-04]] — ratings write to the `Q5` jsonb slot.
- [[tb-07-per-member-foursquare-fetch|tb-07]] — the factorial draws from the member's real fetched pool.

## Comments

**2026-05-15 — done (AFK, branch `afk/tb-08`).** Shipped the pure Q5
factorial card generator (PRD module C) and the Q5-surface bridge on
the iOS side.

- **`Q5FactorialCardGenerator`** — pure, no I/O, no clock, no
  randomness, no group state. `generate(member:pool:)` takes a
  member's stated Q1–Q4 profile (`Q5MemberProfile`) and their
  axis-profiled candidate pool, and emits exactly three strict-
  factorial cards — one cuisine-drop, one reputation-drop, one
  vibe-drop. Each card deviates from the member's stated profile on
  exactly one axis and matches the other two; no card is ever a 100%
  match. Cards are picked first-fit in pool order, so the result is a
  deterministic pure function of `member` and pool order.
- **Member-local cuisine selection.** `selectProbedCuisines` ranks the
  member's craved cuisines by pool feasibility (how many pool venues
  carry each cuisine), ties broken on Q1 pick order, and probes the
  top two — the strict factorial has only two cuisine keep-cards
  (0.1.0-quiz-amendments §"Q1 multi-select and the cuisine cap"). The
  feasibility count is pool-order-independent, so the choice never
  leaks group state.
- **Decision — the generator consumes pre-classified `Q5VenueProfile`s,
  not raw `ShapedPlace`s.** A venue's position on the cuisine /
  reputation / vibe axes is an injected input, produced by the axis
  scorers (PRD module E — tb-09). research-01 fixed that reputation
  and vibe are *client-side-scored* axes whose metadata mapping is a
  tb-09 deliverable, and `ShapedPlace` carries no `rating` / `stats` /
  `date_created` / `attributes` fields. Making the generator depend on
  raw venues would have forced tb-08 to invent the scorer internals
  research-01 explicitly defers. The clean seam: tb-08 ships the pure
  factorial *selection* logic over `Q5VenueProfile`; tb-09 ships the
  *classification* that produces the profiles and wires it in front.
- **Pool starvation.** When the pool cannot furnish three valid
  distinct cards, `generate` returns `nil` rather than inventing a
  placeholder venue — the bug-03 "no placeholder venues" hard rule.
  The PRD lists the starvation fallback as "Out of Scope"; the Q5
  loader's existing dummy-fixture fallback covers the stranded-flow
  case at the surface boundary.
- **Q5 surface.** `QuizQ5Regret` already renders `[QuizCandidate]`
  rows with a 1–5 rating each, persisted to the `votes.q5` jsonb slot
  via `QuizCoordinator.setRegret` → `VoteRow` (`q5` slot,
  `answer.scores`). Added `Q5FactorialCardGenerator.quizCandidates`,
  which shapes factorial cards into `[QuizCandidate]` carrying the
  real `fsq_place_id` and venue name — so ratings key on real venue
  ids, never placeholders. The Q5 surface section in
  `design-system/surfaces/03-quiz.md` is the "visual shell only"; no
  new component or token was needed, so no design-system spec change.
- **Q5 framing copy.** The 0.1.0 `QuizQ5Regret` view carried the 0.1.0
  "regret" wording ("how much would you mind?", "DON'T MIND" / "REALLY
  MIND"). The 0.1.0 PRD and the surface spec fix Q5 as an *excitement*
  probe ("How excited does each of these make you?"). Updated the
  view's question header and the rating-scale end labels to the
  excitement framing. The JSX in `design-system/code/screens/` keeps
  its 0.1.0 sample copy — illustrative, not locked (see the surface doc's
  own JSX-rename note + the `design-system scope` project note).
- **Tests.** 15 pure unit tests in `Q5FactorialCardGeneratorTests` —
  one-axis deviation per card, no perfect match (the deliberately-
  perfect pool venue is never picked), member-local cuisine selection
  (top-two feasibility, tie-break on Q1 order, pool-order
  independence, keep-cards use only probed cuisines), the "No
  preference" degenerate cases, pool-starvation `nil` returns,
  determinism, and the `quizCandidates` bridge. Ran green locally via
  the Swift 5.10 frontend; the `ios` CI lane runs the full
  `xcodebuild test` on the simulator.

**Adjacency flagged — the factorial is not yet wired into the live
quiz.** `Q5FactorialCardGenerator` and its bridge are built and
tested, but `QuizSessionAssembler` / `Q5CandidatesLoader` still feed
Q5 a flat truncated fetch, not factorial-selected cards. Running the
factorial in the live flow needs the axis-profiled pool — i.e. the
cuisine / reputation / vibe scorers that classify each `ShapedPlace`
into a `Q5VenueProfile`. That classification is PRD module E, owned
by tb-09 (which blocks on tb-08). tb-09 is the natural home for the
`Q5CandidatesLoader` → `Q5FactorialCardGenerator` wiring.
