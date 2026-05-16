---
issue: tb-04
title: Generic votes Q1..Q5 jsonb schema + verdict-engine mapping layer
status: ready-for-agent
type: AFK
github_issue: 65
prd: v1.1-quiz-redesign-prd
created: 2026-05-15
---

# tb-04 — Generic votes jsonb schema + engine mapping layer

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — module (H). Walking-skeleton slice for the redesign.

## What to build

Replace the `votes` table's typed-per-question columns (`q1_vetoes`, `q2_budget`, `q3_walk_minutes`, `q4_vibe`, `q5_regret`) with generic `Q1`..`Q5` jsonb slots, so quiz content can change without a migration. Each slot carries both the answer payload and enough question metadata to interpret it per session — per-session question variability lives in the jsonb, not the schema.

The verdict engine (`supabase/functions/_shared/verdict-engine.ts`) currently reads those columns by hardcoded field name. Add a schema-driven mapping layer so the engine consumes question answers through question metadata instead. After this slice the **existing** quiz and verdict still run unchanged end-to-end on the new shape — only the storage shape and the engine's input path change. This is the foundation every later quiz-redesign slice writes and reads through.

## Acceptance criteria

- [ ] Migration replaces the five typed `votes` columns with generic `Q1`..`Q5` jsonb columns. Pre-launch with no real user data — recreating the table is acceptable.
- [ ] Each jsonb slot carries the answer plus per-session question metadata; no question content is hardcoded in the schema.
- [ ] The verdict engine reads question answers through a mapping layer keyed on question metadata, not hardcoded column names.
- [ ] Existing `verdict-engine*.test.ts` suites pass against the new shape (updated as needed).
- [ ] The current quiz still writes answers and the engine still produces a verdict end-to-end.

## Blocked by

None — can start immediately.
