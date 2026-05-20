---

issue: sg-WF-4
title: Plan list surface — design needed
status: needs-triage
type: HITL
feature: workflow-overhaul
github_issue: 157
created: 2026-05-19
---

# sg-WF-4 — Plan list surface

## Parent

[[../../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] §Q3 — the Plan list becomes the new app landing surface, replacing S00 Landing. The *what* is locked; the *how* (card visuals, status badges, ordering, empty state, history visibility) was explicitly out of scope of the 2026-05-19 grill and needs its own grill before this can become an AFK spec-gap.

## What to build (after grill)

A design-system surface doc + JSX for the Plan list. The grill must resolve, at minimum:

- **Card visuals.** What does a Plan card look like? Name + status badge + verdict thumbnail (when decided)? Glass row vs solid? Tap target size?
- **Status badges.** How do `pending` / `decided-active` / `decided-expired` render? Sun-yellow accent for `decided-active`? Muted glass for `decided-expired`? No badge for `pending`?
- **Created vs Joined.** Card affordance distinguishing Plans the user *created* from Plans the user *joined*. Per [[../../../CONTEXT|CONTEXT.md]] → `Plan member`, Account members see both on the same list.
- **Empty state.** First-launch copy + the `Create your first plan` CTA treatment. What does a brand-new user see?
- **Ordering.** Chronological newest-first? Grouped by status (pending top, decided-active middle, decided-expired bottom)? Smart (actionable items first)?
- **History visibility.** Are `decided-expired` Plans always visible, or behind a `Show history` toggle / a separate section?
- **The `+` button.** Where does it sit? Bottom-right floating action button, top-trailing chrome, large empty-state-only CTA?
- **Delete affordance.** Swipe-to-delete, long-press, three-dot menu, dedicated edit mode? Confirm prompt copy.
- **Tap behavior at each status.** Pending → opens Setup in Edit mode. Decided-active → opens verdict screen with reroll affordance. Decided-expired → opens read-only verdict.
- **S00 Landing retirement.** The new list surface *is* the app entry; S00 Landing is fully retired. Coordinate the retirement with this surface's spec.

### Things that are already locked (do NOT re-grill these)

- Plan list **is** the new app landing (Q3 of the parent grill).
- Plans persist across sessions with status states `pending → decided-active → decided-expired` (Q1).
- Account members see both Created and Joined Plans on their list; Web invitees have no list at all (Q6).
- Tap a `pending` Plan → Setup in Edit mode (Q11).
- Tap a decided Plan → verdict screen (read-only for `decided-expired`).
- `Delete` is creator-only; joiners see no delete affordance.

## Acceptance criteria (after grill)

- [ ] A grill session resolves the open items above and updates [[../../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] (or a sibling decision doc) with the locked outcomes.
- [ ] This issue is re-triaged from `needs-triage` / `HITL` to `ready-for-agent` / `AFK` with the grill outcomes inlined into the body.
- [ ] After re-triage: a new design-system surface doc (`design-system/surfaces/00-plan-list.md` or similar) lands with card visuals, status badges, empty state, ordering, history visibility, `+` button placement, delete affordance, tap behavior — all per the grill.
- [ ] `design-system/code/screens/ScreenPlanList.jsx` renders the surface per the spec.
- [ ] S00 Landing is marked `status: superseded` with a `superseded-by:` pointer to the new surface.
- [ ] `CHANGELOG.md` carries a `BREAKING:` entry (app entry surface change).
- [ ] `verify.mjs` is green.

## Blocked by

None to start the grill. A follow-up `/grill-with-docs` session is the prerequisite to AFK promotion.
