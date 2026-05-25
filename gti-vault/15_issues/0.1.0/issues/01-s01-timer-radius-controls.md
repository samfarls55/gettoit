---
issue: 01
title: S01 — add timer chip + radius slider to Initiator Landing
github_issue: 19
status: done
completed: 2026-05-12
created: 2026-05-12
surface: 01-initiator
prd: 0.1.0-prd
---

# 01 — S01: timer chip + radius slider on Initiator Landing

## Why

The 0.1.0 PRD ([[../../../10_prds/0.1.0-prd|0.1.0-prd.md]]) locks the verdict fire trigger to **initiator-set timer OR initiator manual "Decide now" tap**, and the candidate pool radius to **initiator-set slider with sensible default**. Both controls have to live on the Initiator Landing surface (S01) because the decision is made before the share-sheet step.

The current `design-system/surfaces/01-initiator.md` explicitly forbids "configure your session" and "optional fields." This issue documents the spec exception against that rule and adds the two controls.

## Scope

- **Edit `design-system/surfaces/01-initiator.md`** to:
  - Add a section explicitly describing the timer chip group + radius slider.
  - Document the spec exception against the current "no optional fields" rule. Frame the controls as "setting expectations, not configuring options" — both have sensible defaults that the zero-tap path uses.
  - Update the `Behavior` section to describe: CTA generates session ID with the selected timer + radius written to the `rooms` row, then proceeds to share sheet + Q1.
- **Edit `design-system/code/screens/ScreenInitiator.jsx`** to render:
  - A timer chip group with preset chips `5 · 10 · 15 · 30` minutes, default `10`, single-select.
  - A radius slider with range `0.5 mi – 5 mi`, default `2 mi`, step `0.5 mi`. Render the current value as a readable label (`"2.0 mi"`).
  - Both inline above the vertical-picker rows.
- **Components:** the timer chip group can reuse `C-04 · Chip (Single-Select)` with the eyebrow vocabulary. The radius slider is a new component — propose `C-21 · Range Slider` with the appropriate token treatment.
- **Tokens:** if any new token is needed (e.g. a slider track + thumb fill), register in `tokens.json` first. No raw hex.

## Acceptance criteria

- [ ] `design-system/surfaces/01-initiator.md` describes the timer + radius controls and documents the spec exception.
- [ ] `design-system/code/screens/ScreenInitiator.jsx` renders both controls with the canonical defaults.
- [ ] If a `C-21` slider component is introduced, `design-system/components.md` has the entry and `design-system/code/components.jsx` implements it.
- [ ] `design-system/accessibility.md` updated for tap-target conformance on the chip group + slider thumb (≥44pt).
- [ ] `node design-system/scripts/verify.mjs` passes.
- [ ] `design-system/CHANGELOG.md` updated with a one-line entry referencing this issue.

## Open questions

- Slider visual treatment — solid sun-yellow fill on left of thumb (consistent with `C-08 · Vibe Slider` selected state) vs. white glass fill. Recommend sun-yellow for state-signal continuity; flag for design review.
- Whether the controls render above or below the vertical-picker. Recommended: above, so the radius slider's "tonight, near me" framing precedes the vertical choice.

## Comments
