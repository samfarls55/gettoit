---
folder: 30_design
purpose: Design system — tokens, components, previews, briefs
---

# 30_design — Design

Single source of truth for design system: tokens, components, previews, briefs.

## Contents

### Active

- [[interaction-patterns/_index|interaction-patterns/]] — Workflow-audit framework distilled from Tidwell/Brewer/Valencia, *Designing Interfaces* (O'Reilly, 3rd ed., 2020). Per-pattern entries with audit signals (present/missing/anti-pattern), foundations (cognition + behavior principles), visual-style lenses, UI-systems lenses, plus a per-surface audit checklist and alphabetical quick reference. Entry point: [[interaction-patterns/00-how-to-audit]].

### Superseded

The four docs below are **superseded** — pre-build design-exploration artifacts. The chosen direction (Sunset Pop) shipped as the `design-system/` package at repo root, which is now the authoritative visual design spec. Kept as historical record.

- [[frontend-design-brief]] — *Superseded.* One-page kickoff brief for the frontend design session: concept, 7 key screens, voice, locked verdict-screen elements, anti-patterns.
- [[refero-pattern-extract]] — *Superseded.* Patterns harvested from Refero (quiz, verdict, lobby, anti-patterns) that fed the 0.1.0 prototype directions.
- [[0.1.0-directions]] — *Superseded.* Three aesthetic directions (Warm Receipt / Quiet Serif / Sunset Pop) explored in the now-removed `design-prototype/`. Direction C (Sunset Pop) won and shipped as `design-system/`.
- [[sunset-pop-handover]] — *Superseded.* Self-contained brief that fed the design session producing the full Sunset Pop design system (tokens / components / motion / surfaces). The handover is complete; the system lives at `design-system/`.

## Visual vs interaction split

- **Visual** (tokens, color, type, motion, spacing) — lives in `design-system/` at repo root. The superseded docs above were its pre-build exploration.
- **Interaction** (workflow patterns, navigation models, form/list/action patterns, cognition principles) — lives in [[interaction-patterns/_index|interaction-patterns/]]. Source-of-truth audit framework, not a one-off exploration.
