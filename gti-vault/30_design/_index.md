---
folder: 30_design
purpose: Interaction-patterns hub + superseded visual-design exploration archive
---

# 30_design — Design

Hosts the interaction-patterns workflow-design hub (active) plus the pre-build visual-design exploration that fed `design-system/` at repo root (superseded). Visual tokens / components / motion now live in repo-root `design-system/`, not here.

## Contents

### Active

- [[interaction-patterns/README|interaction-patterns/]] — Workflow-design hub distilled from Tidwell/Brewer/Valencia, *Designing Interfaces* (O'Reilly, 3rd ed., 2020). Six files: `principles.md` (29 foundation rules), `patterns.md` (81 named patterns, flat catalog), `surfaces.md` (9 surface playbooks + screen-type taxonomy + nav models), `workflows.md` (10 end-to-end recipes), `patterns.json` (machine index), `README.md` (entry point). Supports both audit and construction workflows.

### Superseded

The four docs below are **superseded** — pre-build design-exploration artifacts. The chosen direction (Sunset Pop) shipped as the `design-system/` package at repo root, which is now the authoritative visual design spec. Kept as historical record.

- [[frontend-design-brief]] — *Superseded.* One-page kickoff brief for the frontend design session: concept, 7 key screens, voice, locked verdict-screen elements, anti-patterns.
- [[refero-pattern-extract]] — *Superseded.* Patterns harvested from Refero (quiz, verdict, lobby, anti-patterns) that fed the 0.1.0 prototype directions.
- [[0.1.0-directions]] — *Superseded.* Three aesthetic directions (Warm Receipt / Quiet Serif / Sunset Pop) explored in the now-removed `design-prototype/`. Direction C (Sunset Pop) won and shipped as `design-system/`.
- [[sunset-pop-handover]] — *Superseded.* Self-contained brief that fed the design session producing the full Sunset Pop design system (tokens / components / motion / surfaces). The handover is complete; the system lives at `design-system/`.

## Visual vs interaction split

- **Visual** (tokens, color, type, motion, spacing) — lives in `design-system/` at repo root. The superseded docs above were its pre-build exploration.
- **Interaction** (workflow patterns, navigation models, form/list/action patterns, cognition principles) — lives in [[interaction-patterns/README|interaction-patterns/]]. Source-of-truth design hub, not a one-off exploration.
