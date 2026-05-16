---
issue: tb-08
title: Q5 factorial preference probe over real candidate venues
status: ready-for-agent
type: AFK
github_issue: 69
prd: v1.1-quiz-redesign-prd
created: 2026-05-15
---

# tb-08 — Q5 factorial preference probe

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — module (C) card generator + module (J) part 2. Closes [[bug-03-q5-placeholder-no-foursquare-calls|bug-03]] at the Q5 surface — no placeholder venues ever.

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
