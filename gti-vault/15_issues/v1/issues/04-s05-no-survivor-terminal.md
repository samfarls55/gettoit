---
issue: 04
title: S05 — add terminal no-survivor state to Verdict
github_issue: 22
status: ready-for-agent
created: 2026-05-12
surface: 05-verdict
prd: v1-prd
---

# 04 — S05: terminal no-survivor state on Verdict

## Why

The v1 PRD ([[../../../10_prds/v1-prd|v1-prd.md]]) locks the VerdictEngine fallback cascade: when EBA pruning leaves zero survivors, the engine silently relaxes soft preferences (cuisine veto → vibe floor → radius widen) and re-runs. Hard NEED vetoes (dietary, allergy, budget) never relax. If the engine still has zero survivors after exhausting soft-pref relax, it exits with `method = 'no_survivor'`.

The current `design-system/surfaces/05-verdict.md` has no terminal state for this case. Working copy: `"No spot fits tonight — widen radius?"`.

## Scope

- **Edit `design-system/surfaces/05-verdict.md`** to:
  - Add a fifth mode: `no-survivor` (alongside `default`, `cuts`, `committed`, `read-only`).
  - Document visible state — eyebrow `"Tonight"`, hero `"NO SPOT / FITS"` (one word per line per the standard rule), meta line naming the hard-need vetoes that survived (e.g. `"Vegan options · $$ cap · 15 min walk"`), no time badge, terminal rule chip explaining the situation in aggregate-rule register (e.g. `"Vegan options + 15-minute walk left no candidates after widening."`).
  - Suppress: voice-receipt row (no verdict to receipt), ratification CTA, reroll affordance, "Start over" secondary.
  - Replace primary CTA with `"Widen radius"` (sun-filled `C-05` pill) — tapping opens a small bottom sheet or inline expansion that raises the radius slider (1–10 mi range, current value + 1.0 mi default suggestion) and re-runs the engine on commit.
  - Add a secondary `ghost` CTA `"Start over"` that returns to the Initiator Landing surface.
- **Edit `design-system/code/screens/ScreenVerdict.jsx`** to support `mode === 'no-survivor'` via the existing `mode` prop.
- **Defensive copy register:**
  - Never blame a member. Aggregate-rule attribution applies here too. **Bad:** `"Maya's vegan veto left no places."` **Good:** `"Vegan options left no candidates within walking distance tonight."`
  - For private constraints (allergies), use attribute attribution. **Bad:** `"Filtered for shellfish allergy left no places."` **Good:** `"Shellfish-safe kitchens are sparse within 2 miles tonight."`
  - The copy should suggest an action without implying the user did anything wrong. The system failed to find a fit; the user's constraint stays respected.

## Acceptance criteria

- [ ] `design-system/surfaces/05-verdict.md` describes the `no-survivor` mode with all visible + suppressed elements + copy register.
- [ ] `design-system/code/screens/ScreenVerdict.jsx` accepts `mode='no-survivor'` and renders accordingly.
- [ ] The "Widen radius" CTA flow is described — inline radius adjustment + re-run trigger.
- [ ] `motion.md` updated for the choreography of this mode (likely a compressed reveal — there's less to choreograph).
- [ ] `design-system/accessibility.md` notes VO behavior — the rule chip carries the load-bearing message, so it must be in the first read order.
- [ ] `node design-system/scripts/verify.mjs` passes.
- [ ] `design-system/CHANGELOG.md` updated.

## Open questions

- Whether the "Widen radius" path is an inline expansion (radius slider appears on the same screen) or a small bottom sheet (à la reroll sheet). Recommended: inline expansion — the user is already on a terminal state and a sheet adds friction without proportional clarity gain.
- Whether to surface telemetry hint copy ("This is rare — most groups find a spot at 2 mi.") to reassure the user the failure isn't normal. Recommended: skip in v1; revisit if no-survivor rate proves high in beta.
- Whether the no-survivor exit should consume a reroll. Recommended: no — the engine failed, not the group. Reroll budget should be preserved.

## Comments
