---
issue: sg-WF-4
title: Plan list surface — design-system spec + JSX
status: done
type: AFK
feature: workflow-overhaul
github_issue: 157
created: 2026-05-19
grilled: 2026-05-20
done: 2026-05-20
---

# sg-WF-4 — Plan list surface

## Parent

[[../../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] §Q3 — the Plan list becomes the new app landing surface, replacing S00 Landing. The *what* was locked in the 2026-05-19 grill; the *how* (card visuals, status badges, ordering, empty state, history visibility) was deferred to a follow-up grill.

**Follow-up grill ran 2026-05-20.** Locked outcomes captured in [[../../../50_product/workflow-overhaul-plan-list|workflow-overhaul-plan-list]] (sibling decisions doc). This issue is now `ready-for-agent` / `AFK`.

## What to build

A design-system surface doc + JSX for the Plan list, implementing every locked decision in [[../../../50_product/workflow-overhaul-plan-list|workflow-overhaul-plan-list]] §Q1–Q8. The decisions doc is the canonical source; this section summarizes the build contract for AFK pickup.

### Surface structure (locked Q1)

Sectioned list, three sections in order: `Pending` → `Decided` → `History`. Empty sections render nothing. History section is collapsible (iOS disclosure pattern); default expanded.

### Card content (locked Q2)

| Section | Card silhouette |
|---|---|
| Pending | 1-line: Plan name only |
| Decided | 2-line: name (primary) + verdict place name (secondary) |
| History | 2-line: name + verdict place name |

Long verdict names truncate with ellipsis. No thumbnail images at v1.

### Joined-card distinction (locked Q3)

`JOINED` eyebrow chip in `var(--sun)`, top-leading above the name, on Joined cards only. Created cards carry no chip. Eyebrow typography follows existing C-11 spec (Inter 700 / 11 / tracking 0.18em UPPERCASE).

### Three-dot action menu (locked Q4)

Trailing `⋯` glyph on every owned card. Menu contents by role + status:

| Card | Menu items |
|---|---|
| Created Pending | `Edit plan`, `Delete plan` |
| Created Decided | `Delete plan` |
| Created History | `Delete plan` |
| Joined (any) | `Leave plan` |

Destructive items open a C-16-pattern bottom sheet for confirm. Confirm copy table is in the decisions doc Q4. **No red anywhere** — destructive weight is in copy, not color.

**New component:** the action-dot menu is a new design-system primitive (provisional **C-25 Action Dot Menu**). Spec it in `components.md` with matching JSX. Reuse elsewhere later (e.g., Verdict overflow).

### Create affordance (locked Q5 + Q6)

Two entry points, both routing through a disambig sheet:

- **Populated state:** bottom-right floating action button. New primitive (provisional **C-26 Floating Action Button** — circular glass, ~56pt, `var(--sun)` glyph, 18pt off bottom + trailing, light shadow). Spec in `components.md`.
- **Empty state:** giant C-05 primary pill mid-screen, full-width, copy `Create your first plan`.

Both → C-16-style bottom sheet with two stacked ghost C-05 pills: `Solo` (top), `Group` (below). No Cancel button (swipe-down / tap-scrim dismiss).

**Setup-screen amendment** (lifted out of parent Q7): the Setup screen now has 5 controls in solo path (no `Who's coming` row) and 6 controls in group path (`Who's coming` chips become `Two of us / A group`). **This amendment also affects the Setup-screen build slice** — see [[tb-wf-4-wire-plan-setup-surface|tb-WF-4]] dependency note below.

### Ordering (locked Q7)

Section-appropriate "newest event first":
- Pending: `created_at DESC`
- Decided: `verdict_fired_at DESC` (tiebreak: `created_at DESC`)
- History: `expired_at DESC` (tiebreak: `created_at DESC`)

### Tap behavior

**Created cards** (parent Q11 + clarifying note 2026-05-20):
| Status | Destination |
|---|---|
| Pending | S01 Setup in Edit mode |
| Decided-active | S05 Verdict (with reroll affordance) |
| Decided-expired | S05 Verdict read-only |

**Joined cards** (this grill Q8 — resume-from-state):
| State | Destination |
|---|---|
| Pending, no quiz progress | S03 Quiz Q1 |
| Pending, mid-quiz | S03 Quiz at last-answered question |
| Pending, finished quiz | S04 Waiting |
| Decided-active | S05 Verdict read-only (no reroll — initiator-only) |
| Decided-expired | S05 Verdict read-only history |

Implementation: list-render needs per-joiner quiz progress for Joined cards.

### S00 Landing retirement

S00 is fully retired. The Plan list IS the new app entry.
- `design-system/surfaces/00-landing.md` → `status: superseded`, add `superseded-by: 00-plan-list` (or whichever filename you land on).
- Either delete or repurpose `code/screens/ScreenLanding.jsx` (your call — full autonomy on file-level layout; the surface-doc/JSX pair is what matters).
- CHANGELOG entry: `BREAKING: app entry surface changed from S00 Landing to Plan List`.

## Things you have full autonomy on

Per project working style and the [[../../../../memory/feedback_afk_full_autonomy|AFK full-autonomy default]] — make these calls without coming back to ask:

- Section header visual treatment (eyebrow typography is locked; whether to add count badges, sun-accent on actionable Decided header, sticky vs non-sticky on scroll — your call).
- Exact dimensions, paddings, radii on C-25 and C-26 (match the existing Sunset Pop primitive language — C-19 / C-06 / C-22 are the closest reference points).
- Empty-state pill copy refinement (locked at `Create your first plan` from parent Q3; supporting eyebrow/body copy is yours).
- History collapse default + animation timing (use existing motion tokens).
- Confirm-sheet body copy — table in decisions doc Q4 is the locked register; finesse word-for-word as needed.
- New component file structure (one component per file vs grouped in `components.jsx` — match what's there).

## Acceptance criteria

- [x] A grill session resolves the open items and produces a locked-decisions doc → [[../../../50_product/workflow-overhaul-plan-list|workflow-overhaul-plan-list]] (2026-05-20).
- [x] This issue is re-triaged from `needs-triage` / `HITL` to `ready-for-agent` / `AFK` with the grill outcomes inlined.
- [x] A new design-system surface doc lands at `design-system/surfaces/00-plan-list.md` (or whichever number you pick — coordinate with the S00 retirement).
- [x] `design-system/code/screens/ScreenPlanList.jsx` renders the surface per the spec.
- [x] `design-system/components.md` gains entries for **C-25 Action Dot Menu** and **C-26 Floating Action Button**, with matching JSX primitives.
- [x] `design-system/surfaces/00-landing.md` is marked `status: superseded` with a `superseded-by:` pointer.
- [x] `CHANGELOG.md` carries a `BREAKING:` entry (app entry surface change).
- [x] `node design-system/scripts/verify.mjs` is green (drift gate + orphan-hex sweep + surface↔jsx pairing).

## Blocks / blocked by

- **Blocks:** [[tb-wf-4-wire-plan-setup-surface|tb-WF-4]] (Setup wire) is currently `needs-info` pending this surface. Once this lands, tb-WF-4 can be unblocked. **Also** the Setup-screen build needs the parent-Q7 amendment (5-control solo / 6-control group + disambig sheet) folded into its scope — either by amending tb-WF-4 in place or by spawning a tiny adjunct issue.
- **Blocks:** the new tracer-bullet that wires the Plan list itself on iOS (not yet filed — likely lands in the next issue batch after this surface spec exists).
- **Blocked by:** none. All grill prereqs resolved.

## Comments

### 2026-05-20 — AFK landed

Closed by PR (auto-merge on green). New surface `design-system/surfaces/00-plan-list.md` + `design-system/code/screens/ScreenPlanList.jsx` land together; `00-landing.md` is now `status: superseded` with `superseded-by: 00-plan-list` and an in-body banner pointing here. Two new component primitives ship — **C-25 Action Dot Menu** (`ActionDotMenuTrigger` + `ActionDotMenu`, custom dark-glass popover so destructive items can render with the no-red rule intact) and **C-26 Floating Action Button** (56×56 glass body, sun glyph, anchored 18 / 18 off the trailing + bottom edges). Disambig + confirm sheets compose inline from the existing C-16 sheet primitive — single-surface, kept out of `components.jsx`. `CHANGELOG.md` carries the `BREAKING:` entry for the S00 retirement plus the C-25 / C-26 additions. `node design-system/scripts/verify.mjs` is green; the new structural test `design-system/scripts/test-plan-list.mjs` lands 89 assertions covering frontmatter, locked copy, JSX composition, no-red rules, and superseded bookkeeping. Unblocks tb-WF-5..9 (iOS port).

### 2026-05-20 — grill outcomes

Eight-question follow-up grill ran today against this issue. All open items from the original body resolved:

- Card visuals → Q2 (verdict inlined on decided cards, no thumbnail)
- Status badges → resolved by Q1 sectioning (section headers carry status)
- Created vs Joined → Q3 (`JOINED` eyebrow chip in sun-yellow)
- Empty state → Q6 (unified entry path through disambig sheet)
- Ordering → Q7 (section-appropriate newest-event-first)
- History visibility → resolved by Q1 (collapsible section)
- The `+` button → Q5 (FAB + disambig sheet)
- Delete affordance → Q4 (three-dot menu + C-16 confirm sheet, no red)
- Tap behavior → parent Q11 (Created) + this Q8 (Joined resume-from-state)
- S00 Landing retirement → folded into AFK build scope

Side amendments to parent grill captured inline in [[../../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]]: §Q7 (lifted solo/group out) and §Q11 (Created-only tap rule).

Promoting to `ready-for-agent` / `AFK`.
