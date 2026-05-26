---
folder: 30_design/interaction-patterns
purpose: Actionable interaction-design audit framework distilled from Tidwell/Brewer/Valencia, *Designing Interfaces* (O'Reilly, 3rd ed., 2020)
---

# interaction-patterns — Workflow Audit Framework

A structured catalog of interaction-design patterns and cognition principles, formatted so an agent can walk a codebase or screen spec and answer: *is the right pattern present?*, *is an anti-pattern being committed?*, *what pattern fills the gap?*

This is the workflow / interaction-design counterpart to the visual `design-system/` at the repo root. **Visual tokens, color, typography, motion: see `design-system/`. How users get things done: here.**

## Source

Tidwell J., Brewer C., Valencia A. *Designing Interfaces — Patterns for Effective Interaction Design*, 3rd ed. O'Reilly, 2020. ISBN 978-1-492-05196-1. PDF archived at [[../../60_engineering/references/_index|60_engineering/references/]].

## How to use this framework

Entry point: [[00-how-to-audit|00-how-to-audit]]. Pattern-quick-reference: [[pattern-quick-reference]]. Per-surface audit prompts: [[audit-checklist]].

The framework has three layers:

1. **Foundations** — universal cognition/behavior principles. Apply everywhere.
2. **Pattern catalog** — named structural devices, grouped by surface (IA, navigation, layout, mobile, lists, actions, data, forms).
3. **Audit checklist** — concrete prompts grouped by surface type. The "how to use it on a codebase" doc.

## Contents

- [[00-how-to-audit]] — agent workflow: how to walk a codebase / screen spec with this catalog.
- [[01-foundations-cognition]] — 13 universal cognition + behavior principles. Apply across every surface.
- [[02-information-architecture]] — content organization patterns (Ch.2 of source).
- [[03-navigation]] — wayfinding + nav-model patterns (Ch.3).
- [[04-layout]] — screen-level layout patterns (Ch.4).
- [[05-visual-style]] — visual-design heuristics (Ch.5). No patterns; principles only.
- [[06-mobile]] — mobile-specific patterns (Ch.6).
- [[07-lists]] — list / collection presentation patterns (Ch.7).
- [[08-actions]] — action + command patterns (Ch.8).
- [[09-complex-data]] — data-visualization + exploration patterns (Ch.9).
- [[10-forms]] — form + control patterns (Ch.10).
- [[11-ui-systems]] — design-system thinking, atomic design, UI frameworks (Ch.11-12).
- [[audit-checklist]] — actionable prompts grouped by surface (entry point for "review this codebase").
- [[pattern-quick-reference]] — alphabetical one-liner of every pattern with its "use when".

## Schema (all pattern entries)

Each pattern entry uses the same fixed schema, designed for codebase auditing:

```
### {Pattern Name}
- Use when: <user need / scenario that triggers this pattern>
- What it is: <one-sentence structural device>
- Why it works: <cognitive or behavioral mechanism>
- How to apply: <minimum structural requirements, bulleted>
- Signals present (in code/spec): <what indicates this pattern is in use>
- Signals missing (red flag): <what gap suggests this pattern should be added>
- Anti-patterns / mis-applications: <how it goes wrong>
- Related: [[wiki links]]
```

Use the *Signals present* / *Signals missing* lines as the audit hooks.
