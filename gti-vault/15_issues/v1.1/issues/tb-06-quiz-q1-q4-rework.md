---
issue: tb-06
title: Quiz Q1-Q4 rework — four new input surfaces
status: ready-for-agent
type: AFK
github_issue: 67
prd: v1.1-quiz-redesign-prd
created: 2026-05-15
---

# tb-06 — Q1-Q4 quiz rework

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — module (J), part 1. Covers the first four of the five decision-shaping questions.

## What to build

Rework `QuizCoordinator`'s Q1-Q4 to the new question semantics, writing each answer to its generic jsonb slot from [[tb-04-votes-jsonb-schema|tb-04]]:

- **Q1 — cuisine craving.** Multi-select, capped at 3 selections, with a mutually-exclusive "No preference" toggle (selecting it clears any cuisines; selecting a cuisine clears "No preference"). Selecting a 4th cuisine is prevented.
- **Q2 — spend cap.** A hard ceiling on spend.
- **Q3 — reputation / discovery.** A chip picker: Popular / Hidden gem / Classic / New / No preference.
- **Q4 — vibe energy.** A 5-point scale: Quiet → Chill → Social → Lively → Rowdy.

Where the new questions need UI the design system does not yet have (the chip picker, the energy scale), design it with the Refero MCP and the design-system in unison and add the component spec to `design-system/` (authority granted for this issue). The flow must advance through Q1-Q4 without stalling.

## Acceptance criteria

- [ ] Q1 enforces the 3-cuisine cap and the mutually-exclusive "No preference" option both ways.
- [ ] Q2 captures a spend cap, Q3 the reputation chip, Q4 the 5-point vibe energy value.
- [ ] All four answers persist to their `Q1`..`Q4` jsonb slots.
- [ ] Advancing through Q1-Q4 never stalls.
- [ ] Any new components are specified in `design-system/`, built from tokens only; `verify.mjs` green.
- [ ] Tests cover the cap-3 logic, the "No preference" exclusivity, and answer persistence.

## Blocked by

- [[tb-04-votes-jsonb-schema|tb-04]] — answers write to the generic jsonb slots.
