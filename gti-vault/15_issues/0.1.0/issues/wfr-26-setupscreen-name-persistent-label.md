---
issue: wfr-26
title: Add persistent label to SetupScreen name field
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 267
---

# wfr-26 — SetupScreen name field uses placeholder-as-label (anti-pattern)

## What to build

`SetupScreen.swift:484-502` uses the prompt as the only label. Once the user starts typing the label disappears. Add a persistent floating label or a static label above the field.

## Acceptance criteria

- [x] Label persists during and after typing.
- [x] VoiceOver reads the label.
- [x] Snapshot test covers empty + typed states.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Input Prompt]]
- [[../../30_design/interaction-patterns/surfaces#Form]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #26.

## Comments

- 2026-05-26 — Closed via PR #307 (`afk/wfr-26`). Replaced the eyebrow above the name input (`NAME THIS PLAN`, eyebrow-token UPPERCASE) with a persistent field label rendered through a new `fieldLabel(_:id:)` helper — sentence case `Name this plan`, `GTIFont.Size.sm` (14pt) / weight 600 / `TextOnGradient.secondary` (white 0.78). The new treatment reads as a field label, not a section heading, so the label can't be mistaken for one of the other five eyebrow rows on the surface. Persistence: the label sits above the row and stays put during and after typing; the in-field placeholder `Name this plan` keeps its Input Prompt role and still disappears on type. VoiceOver: the visible label is `accessibilityHidden(true)` and the TextField's existing `accessibilityLabel("Name this plan")` is the single VO announcement — no double-read. Identifier renamed `setup.name.eyebrow` → `setup.name.label` (no existing tests referenced the old identifier). New static `SetupScreen.nameLabelCopy()` pins the label copy for unit tests. Render coverage added in `SetupScreenRenderTests`: empty + typed (typed seeded via `editingPlan` prefill) per AC #3. Surface doc (`design-system/surfaces/01-setup.md`) gained a wfr-26 override note next to the wfr-24 override; the JSX (`design-system/code/screens/ScreenSetup.jsx`) mirrors the iOS treatment with `aria-hidden="true"` on the visible label. The other five rows continue to use the eyebrow treatment — the override is scoped to the one text-input row.
