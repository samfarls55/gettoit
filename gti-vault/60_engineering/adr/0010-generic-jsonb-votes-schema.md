---
adr: 0010
title: votes storage — generic Q1..Q5 jsonb slots, not typed-per-question columns
status: accepted
date: 2026-05-15
supersedes: null
superseded_by: null
---

# 0010 — Generic jsonb votes schema + a schema-driven engine mapping layer

## Status

Accepted — 2026-05-15. Implemented by issue [[../../15_issues/v1.1/issues/tb-04-votes-jsonb-schema|tb-04]].

## Context

The v1 `votes` table carried one typed column per quiz question:
`q1_vetoes text[]`, `q2_budget int`, `q3_walk_minutes int`,
`q4_vibe int`, `q5_regret jsonb`. The verdict engine read those columns
by hardcoded field name.

The v1.1 quiz redesign ([[../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]],
module H) makes quiz content **session-variable**: questions can be
reordered, reworded, have their option copy changed, and — in later
slices — be swapped for scenario-composite questions. With typed
columns every such change is a schema migration, and the engine's
hardcoded reads make the quiz and the engine move in lockstep.

Two storage shapes were on the table:

- **Path A — keep typed columns, migrate per quiz change.** Each quiz
  revision ships an `ALTER TABLE`. The engine keeps reading named
  columns.
- **Path B — five generic jsonb slots `q1`..`q5`.** Each slot is a
  `{ meta, answer }` envelope. `meta.question_kind` is a discriminator;
  `answer` is the response payload. The engine reads answers through a
  mapping layer that dispatches on `meta.question_kind`, never on the
  column name.

## Decision

**Path B — generic `q1`..`q5` jsonb slots, plus a schema-driven mapping
layer (`supabase/functions/_shared/votes-schema.ts`) the verdict engine
consumes its input through.**

## Why

1. **Quiz content changes without a migration.** Per-session question
   variability lives in the jsonb (`meta`), not in the schema. The
   quiz-redesign backlog has multiple slices that change question
   content; a typed schema would gate each one on a migration.
2. **Engine / quiz decoupling.** Dispatching on `meta.question_kind`
   means a question can move between slots, or change its prompt and
   option copy, with zero engine change. The mapping layer is the one
   seam; everything downstream of it sees a stable `MemberVote`.
3. **The slots are positional, the meaning is not.** `q1`..`q5` are
   just five generic buckets. A question of kind `vibe` works whether
   it lands in `q3` or `q4` — the mapping layer finds it by kind. This
   is what makes question reordering free.
4. **Pre-launch, the recreate is cheap.** No real user data exists
   (the v1 TestFlight dogfood produced nothing worth preserving), so
   `DROP TABLE ... CASCADE` + `CREATE` is cleaner than five
   `ALTER COLUMN`s and a no-op backfill.

## Rejected alternatives

- **Typed columns + migrate per change (Path A).** Rejected — couples
  the schema to a fixed quiz and makes every quiz-content slice carry
  a migration. The whole point of the v1.1 redesign is fluid quiz
  content.
- **One jsonb blob for all five answers.** Rejected — loses the
  per-slot CHECK constraints (a malformed answer would not fail fast at
  the DB layer) and the per-question structure that makes the mapping
  layer's dispatch legible.
- **A separate `question_definitions` table the slots foreign-key
  into.** Rejected for v1.1 — over-built for the current need. The
  per-session question metadata is small and self-contained; carrying
  it inline in the slot's `meta` avoids a join on every votes read and
  keeps a vote row a complete, self-describing record. Revisit if a
  question catalogue ever needs to be queried independently.

## Consequences

### Positive

- Quiz-redesign slices that change question content ship without a
  migration.
- The verdict engine has one well-tested input seam
  (`mapVotesRowToMemberVote`) rather than column-name reads scattered
  across the read path.
- A vote row is self-describing — `meta` records the prompt and option
  copy the member actually saw, useful for audit and replay.

### Negative / costs

- Two SQL RPCs that landed after the v1 `votes` migration —
  `apply_reroll` and `fetch_read_only_verdict` — read / wrote the typed
  columns and had to be re-cut for the jsonb shape. They now go through
  SQL-side mapping helpers (`votes_slot_of_kind`, `votes_min_int_answer`,
  `votes_patch_answer`) that mirror the TypeScript mapping layer's
  dispatch-on-`question_kind` contract. Their behavior and payload
  shapes are unchanged.
- jsonb answers are not type-checked by the column type. The per-slot
  CHECK constraint guards the envelope shape (object + string
  `question_kind`); the mapping layer guards the per-kind `answer`
  shape and throws on an unknown kind. A bad write fails fast at one of
  those two layers rather than at the column type.
- The diet-reason reroll's dietary-chip additions moved from a
  dedicated `q1_vetoes_extra` column into the dietary slot's
  `answer.vetoes_extra` array. The mapping layer unions
  `vetoes` + `vetoes_extra` into the engine's `q1_vetoes`.

## Notes

The full verdict-engine rewrite (PRD module B) is a later slice; tb-04
is the walking-skeleton foundation it builds on. The current engine's
internal logic is unchanged — tb-04 moved only the storage shape and
the engine's input path. When module B lands it will widen the
`question_kind` taxonomy; the mapping layer's `QUESTION_KINDS` set and
its per-kind reader table are extended together at that point.
