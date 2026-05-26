---
title: Interaction Patterns -- workflow-design hub
purpose: Single entry point for the interaction-patterns framework. Routes agents to principles, patterns, surfaces, workflows, and the machine index.
---

# Interaction Patterns

This folder is a workflow-design framework adapted from Tidwell, Brewer, Valencia, *Designing Interfaces: Patterns for Effective Interaction Design*, 3rd ed., O'Reilly, 2020. It is organized into a flat pattern catalog, a foundation principle system, surface-by-surface playbooks, end-to-end workflow recipes, and a machine-readable index for programmatic use. Visual tokens (color, type, motion) live in repo-root `design-system/`; this hub covers how users get things done.

## How to use this hub

Two workflows. Pick the one that matches your task.

### Audit an existing surface

1. Identify the surface intent -- Overview, Focus, Make, Do, Settings, Entry, Form, Data, or Mobile overlay. See [[surfaces#Screen-type taxonomy]].
2. Run the foundation gates that apply (cognition + visual + system + beyond-the-screen where relevant). See [[principles]] for the 29 principle IDs.
3. Walk the matching surface playbook in [[surfaces]]. Check that required patterns are present, optional patterns add value where they appear, and the listed foundation gates fire.
4. Sweep the surface's anti-patterns. Fix any hits. Foundation misses tend to be systemic across the app; pattern misuses tend to be local to one screen -- report the two separately.

### Build a new workflow or surface

1. Identify the user goal and the surface composition the flow will touch. Match against the 10 recipes in [[workflows]], or compose from [[surfaces]] when no recipe fits.
2. Pick the patterns you need from [[patterns]]. Read each entry's *Use when* and *How to apply* lines before reaching for it.
3. Validate the composition against [[principles]]. Every cognition principle should either fire or be deliberately skipped with a stated reason.
4. Anti-pattern sweep before shipping -- check each chosen pattern's *Anti-patterns* line and the surface's anti-pattern list.

### Audit report shape

Each surface in an audit produces a finding in this shape:

```
Surface: <name>
Intent: <Overview | Focus | Make | Do | Settings | Entry | Form | Data | Mobile overlay>
Patterns present: <list>
Foundation violations: <list, severity>
Missing patterns (high-value): <list, why>
Anti-patterns observed: <list>
Recommended next step: <one or two concrete edits>
```

Aggregate into a per-app summary that separates (a) systemic issues -- same anti-pattern or foundation miss repeats across surfaces -- from (b) one-off issues local to one screen.

## Master index

- [[principles]] -- 29 foundation rules. 13 cognition (P-01..P-13), 6 visual (V-01..V-06), 6 system (S-01..S-06), 4 beyond-the-screen (B-01..B-04).
- [[patterns]] -- 81 named UI patterns. Flat alphabetical catalog, each entry uses the same per-pattern schema (Use when / What it is / Why it works / How to apply / Signals present / Signals missing / Anti-patterns / Related).
- [[surfaces]] -- 9 surface playbooks (Overview, Focus, Make, Do, Settings, Entry, Form, Data, Mobile overlay) plus the screen-type taxonomy and navigation models.
- [[workflows]] -- 10 end-to-end recipes (Checkout, Onboarding, Search results, Editor, Settings management, Sign-in / sign-up, Monitoring dashboard, Browse and detail, Media library viewer, Multi-step survey or form).
- `patterns.json` -- machine-readable index for skills and agents.

## Glossary

### Screen-type taxonomy

Name the screen type before reaching for a pattern. Almost every screen collapses to one. Common failure mode: a screen trying to be two at once. Detail in [[surfaces#Screen-type taxonomy]].

- **Overview** -- show a list or set of things (home pages, search results, feeds, grids, tables, dashboards).
- **Focus** -- show one single thing (article, item detail, single record, map, video).
- **Make** -- provide tools to create or update a digital object (editor, builder, canvas, IDE).
- **Do** -- facilitate a single task (sign in, register, purchase, change a setting, run a wizard).

### Navigation models

Pick one or knowingly mix before applying any specific nav pattern. Detail in [[surfaces#Navigation models]].

- **Hub and Spoke** -- hub lists destinations; user goes to a spoke, does the job, returns.
- **Fully Connected** -- every screen carries global nav reaching every other screen in one hop.
- **Multilevel / Tree** -- top sections fully connected, subpages reach siblings only.
- **Step by Step** -- prescribed linear sequence with Back/Next.
- **Pyramid** -- step-by-step plus a hub/menu page listing the whole sequence.
- **Pan and Zoom** -- one large virtual space; navigation is pan/zoom/reset.
- **Flat** -- almost no inter-screen navigation; tools live inside one workspace.

### Audit vs. construction

- **Audit** workflow: surface already exists, you are checking it against the framework. Start at [[surfaces]] for the matching playbook.
- **Construction** workflow: you are designing a new surface or flow. Start at [[workflows]] if a recipe matches, otherwise compose from [[surfaces]].

## For programmatic use

`patterns.json` is the machine index. It has three top-level arrays: `patterns`, `principles`, `workflows`. Schema by example:

```json
{
  "patterns": [
    {
      "id": "action-panel",
      "name": "Action Panel",
      "kind": "pattern",
      "anchor": "patterns.md#Action Panel",
      "surface_tags": ["do", "make"],
      "platform_tags": ["any"],
      "foundations_touched": ["P-03", "V-01"],
      "source_chapter": 8,
      "related": ["button-groups", "movable-panels", "center-stage"]
    }
  ],
  "principles": [
    {
      "id": "P-01",
      "name": "Safe Exploration",
      "kind": "cognition",
      "anchor": "principles.md#P-01. Safe Exploration"
    }
  ],
  "workflows": [
    {
      "id": "checkout",
      "name": "Checkout",
      "anchor": "workflows.md#Checkout",
      "patterns": ["progress-indicator", "good-defaults-and-smart-prefills", "cancelability"]
    }
  ]
}
```

See the file itself for the full data.

Use cases:
- Skills that need to look up a pattern by surface or platform tag.
- Agents that need to enumerate foundation IDs to run as audit gates.
- Tools that map workflow ids to their required pattern ids.

## What this framework does NOT cover

- Visual aesthetics (color, type, spacing tokens) -- repo-root `design-system/` owns that.
- Voice / conversational UI, AR, brain-computer interfaces, gesture-only interaction -- the source book deliberately excludes these (see its preface).
- Domain-specific copy and voice rules -- see `40_marketing_branding/`.
- Accessibility audit -- touched in [[principles#V-01. Visual hierarchy]], [[principles#V-02. Color]], and [[principles#V-04. Readability]] at a heuristic level only; for WCAG compliance use a dedicated checklist.

## Source

Tidwell J., Brewer C., Valencia A. *Designing Interfaces: Patterns for Effective Interaction Design*. 3rd edition. O'Reilly Media, 2020. ISBN 978-1-492-05196-1. PDF archived at `60_engineering/references/designing-interfaces-2020-tidwell-brewer-valencia.pdf`.

The framework adapts the book's pattern language into a workflow-design hub. Original chapters split into atomic patterns ([[patterns]]). Original foundations lifted into a principle ID system ([[principles]]) so they can be cited as audit gates. Surface taxonomy preserved ([[surfaces]]). End-to-end recipes added as new synthesis ([[workflows]]).
