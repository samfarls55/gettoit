---
title: How to audit a codebase with this framework
purpose: Step-by-step workflow for an agent reviewing user workflows against the pattern catalog
---

# How to audit a codebase with this framework

This is the **entry point for an agent doing a workflow audit**. It assumes the agent has the catalog ([[02-information-architecture]] through [[10-forms]]) and the [[audit-checklist]] available.

## Step 1 — Inventory the surfaces

Walk the app and produce a flat list of surfaces (screens, modals, routes). Tag each with its dominant *intent*:

- **Overview** — show a list/grid of things or options (e.g., search results, dashboard).
- **Focus** — show one single thing in detail (e.g., a product page, a record view).
- **Make** — provide tools to build/create a thing (e.g., editor, canvas).
- **Do** — facilitate a single task (e.g., checkout, sign-up, run a workflow).
- **Settings/Configuration** — adjust preferences or system state.
- **Entry/Empty** — first-run, empty-state, or landing.

These four-plus types (Overview / Focus / Make / Do) come from Ch.2 of the source. Almost every screen collapses to one.

## Step 2 — For each surface, ask the foundation questions

For every surface, run the 13 foundation principles in [[01-foundations-cognition]] as yes/no audit checks. These are non-negotiable: a screen that fails any of them is a candidate for rework regardless of which patterns it uses.

Key foundation checks (full list in [[01-foundations-cognition]]):

- Safe Exploration: can a user click around without dire consequences?
- Instant Gratification: is the first useful action reachable in under a few seconds?
- Satisficing: are the visible labels short and self-explanatory?
- Deferred Choices: is the user forced to answer questions they could answer later?
- Habituation: do platform gestures/shortcuts do what users expect?

## Step 3 — Apply the per-surface pattern questions

Open [[audit-checklist]] and run the section that matches each surface's intent. Each section poses concrete questions tied to specific named patterns. Where a question fires, jump to the named pattern's entry for its *Signals present* / *Signals missing* / *Anti-patterns* lines.

## Step 4 — Cross-surface checks

Some checks apply across the whole app, not per surface:

- **Navigation model coherence** — does the app pick a navigation model (hub-and-spoke, tree, step-by-step, flat) and stick with it? See [[03-navigation]] navigational models section.
- **Sign-in / utility-nav placement** — are global tools where users expect them? See `Sign-In Tools` in [[03-navigation]].
- **Reentrance / state preservation** — if a user leaves mid-task, do they come back to where they were? See Deferred Choices + Prospective Memory in [[01-foundations-cognition]] and Many Workspaces in [[02-information-architecture]].
- **Habituated shortcuts** — Ctrl-S, Tab order, Back-button behavior, swipe gestures. See Habituation in [[01-foundations-cognition]] and Keyboard Only.

## Step 5 — Anti-pattern sweep

Each pattern entry has an *Anti-patterns / mis-applications* line. Grep for those in the actual screens. Examples of common anti-patterns to flag aggressively:

- Confirmation modals that ask "Are you sure?" on every routine action (habituated dismissal — they don't protect; they annoy).
- Long forced upfront forms before any value delivered.
- Custom Back-button behavior that breaks the browser default.
- Inline navigation that hijacks scroll, momentum, or the URL bar.
- Dynamic menus that re-sort themselves and defeat Spatial Memory.

## Step 6 — Produce the report

For each surface, produce a finding in this shape:

```
Surface: <name>
Intent: <Overview | Focus | Make | Do | Settings | Entry>
Patterns present: <list>
Foundation violations: <list, severity>
Missing patterns (high-value): <list, why>
Anti-patterns observed: <list>
Recommended next step: <one or two concrete edits>
```

Aggregate into a per-app summary that surfaces (a) systemic issues (same anti-pattern repeats across surfaces) vs (b) one-off issues (a single screen needs a fix).

## What this framework does NOT cover

- Visual aesthetics (color, type, spacing tokens) — that's `design-system/` at repo root.
- Voice/conversational UI, AR, brain-computer, gesture-only — source book deliberately excludes (see source preface).
- Domain-specific copy/voice rules — see `40_marketing_branding/`.
- Accessibility audit — visible in [[05-visual-style]] at a heuristic level only; for WCAG compliance use a dedicated checklist.
