---
issue: tb-04
title: Generic votes Q1..Q5 jsonb schema + verdict-engine mapping layer
status: done
type: AFK
github_issue: 65
prd: 0.1.0-quiz-redesign-prd
created: 2026-05-15
---

# tb-04 — Generic votes jsonb schema + engine mapping layer

## Parent

[[../../../10_prds/0.1.0-quiz-redesign-prd|0.1.0 Quiz Redesign & Verdict Engine PRD]] — module (H). Walking-skeleton slice for the redesign.

## What to build

Replace the `votes` table's typed-per-question columns (`q1_vetoes`, `q2_budget`, `q3_walk_minutes`, `q4_vibe`, `q5_regret`) with generic `Q1`..`Q5` jsonb slots, so quiz content can change without a migration. Each slot carries both the answer payload and enough question metadata to interpret it per session — per-session question variability lives in the jsonb, not the schema.

The verdict engine (`supabase/functions/_shared/verdict-engine.ts`) currently reads those columns by hardcoded field name. Add a schema-driven mapping layer so the engine consumes question answers through question metadata instead. After this slice the **existing** quiz and verdict still run unchanged end-to-end on the new shape — only the storage shape and the engine's input path change. This is the foundation every later quiz-redesign slice writes and reads through.

## Acceptance criteria

- [x] Migration replaces the five typed `votes` columns with generic `Q1`..`Q5` jsonb columns. Pre-launch with no real user data — recreating the table is acceptable.
- [x] Each jsonb slot carries the answer plus per-session question metadata; no question content is hardcoded in the schema.
- [x] The verdict engine reads question answers through a mapping layer keyed on question metadata, not hardcoded column names.
- [x] Existing `verdict-engine*.test.ts` suites pass against the new shape (updated as needed).
- [x] The current quiz still writes answers and the engine still produces a verdict end-to-end.

## Blocked by

None — can start immediately.

## Comments

**2026-05-15 — done (AFK, PR #65 / branch `afk/tb-04`).** Shipped the generic jsonb schema and the mapping layer.

- **Storage shape.** Migration `20260515000000000_votes_generic_jsonb.sql` recreates `votes` with five jsonb slots `q1`..`q5` (lowercase — SQL is case-insensitive; matches the existing column-naming convention). Each slot is a `{ meta, answer }` envelope, validated by a per-slot CHECK that a present slot is an object carrying a string `meta.question_kind`. RLS, the `(room_id, user_id)` PK, the write-once contract, and the `votes_maybe_fire_verdict` trigger are carried over verbatim.
- **Mapping layer.** New `supabase/functions/_shared/votes-schema.ts`. `mapVotesRowToMemberVote` dispatches each slot on `meta.question_kind` (`dietary_veto`, `budget_cap`, `walk_minutes`, `vibe`, `regret`) — not on the column name — so a question can move between slots with no engine change. Unknown kinds throw rather than silently dropping an answer. 10 fixture tests.
- **Engine input path.** `compute-verdict/index.ts` `fetchVotes` reads the jsonb slots and feeds the engine through the mapping layer. The engine's internal logic (`MemberVote` consumption) is unchanged — this slice only moves the storage shape and the input seam, per the issue's scope.
- **Adjacency handled (not silently).** Two SQL RPCs that landed *after* the original typed-column `votes` migration — `apply_reroll` (TB-10) and `fetch_read_only_verdict` (TB-11) — read / wrote the now-deleted typed columns. They were re-cut for the jsonb shape via SQL-side mapping helpers (`votes_slot_of_kind`, `votes_min_int_answer`, `votes_patch_answer`). Behavior and the RPC payload shapes are unchanged, so `LateJoinerStore` and its mocked-RPC tests need no edit. Diet-reroll dietary-chip additions now land in the dietary slot's `answer.vetoes_extra`; the mapping layer unions them into `q1_vetoes`.
- **iOS write / read paths.** `QuizCoordinator.VoteRow` now encodes the `{ meta, answer }` envelope; `VerdictStore.VoteRow` decodes it back to typed values. Integration-test vote inserts route through the real `QuizCoordinator.VoteRow` so the wire shape tracks the production writer.

See [[../../../60_engineering/adr/0010-generic-jsonb-votes-schema|ADR 0010]] for the schema-vs-typed-columns decision and the rejected alternatives.
