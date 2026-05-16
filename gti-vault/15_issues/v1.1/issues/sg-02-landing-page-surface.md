---
issue: sg-02
title: Landing page surface — Start a Decision + Account Settings (two-button)
github_issue: 46
status: done
type: AFK
created: 2026-05-14
prd: v1-prd
---

# sg-02 — Landing page surface

## Parent

[[../_index|v1.1 backlog]] candidate #6.

## Why

The v1 app drops directly into the initiator surface (S01 / "Pick a Vertical") on launch. There is no dedicated landing screen that frames the entry point. The user wants a minimal landing surface between launch and the existing flow with two affordances:

- **Start a Decision** — routes into the existing "Pick a Vertical" screen → existing food flow.
- **Account Settings** — routes to the existing delete-your-data page (the v1 settings surface).

This is the v1.1 *structural* introduction of the landing surface. **Visual / brand design is deferred** — user will design fully later. Ship the surface skeleton; the polish ticket lands separately.

This issue does NOT introduce a category selector — "Pick a Vertical" already exists with food enabled and drinks/movies stubbed. The landing surface routes into it; it does not replace it.

This issue does NOT introduce distance or time sliders — those are out of v1.1 entirely per [[../../../50_product/questions-profile-vs-session-split|the profile/session decision]] (same-geo assumption holds for v1.1).

## Scope

- **New surface document** in `design-system/surfaces/` — propose `00-landing.md` (numbered before the existing `01-initiator.md`). Describe:
  - Two-button layout (Start a Decision + Account Settings).
  - Routing: Start a Decision → existing initiator surface; Account Settings → existing settings surface.
  - Explicit deferral note: visual / brand design lands in a separate polish ticket post-v1.1.
  - Behavior: launching the app (after first-launch sign-in per [[sg-03-account-creation-surfaces|sg-03]]) lands here, not directly on S01.
- **New JSX** at `design-system/code/screens/ScreenLanding.jsx` rendering the two-button layout with tokens. No inline hex.
- **No new components** unless a primary-CTA button variant is genuinely missing — check `design-system/components.md` first.
- **Tokens** — confirm no new tokens needed. Surface is layout + existing typography + existing color roles.

## Acceptance criteria

- [x] `design-system/surfaces/00-landing.md` (or chosen filename) exists describing the two-button surface, routing, and visual-polish deferral.
- [x] `design-system/code/screens/ScreenLanding.jsx` renders the surface with tokens-only styling.
- [x] `design-system/components.md` updated if any new component variant is introduced (none expected).  *(N/A — no new components introduced; existing `C-05` Primary Pill CTA `white` + `ghost` variants cover the two buttons.)*
- [x] `node design-system/scripts/verify.mjs` green.
- [x] `design-system/CHANGELOG.md` entry referencing this issue.

## Resolution

Landed 2026-05-14 on branch `spec/sg-02-landing-page-surface`. Surface ships at `design-system/surfaces/00-landing.md` with JSX at `design-system/code/screens/ScreenLanding.jsx`. Reuses `initiator` gradient stop + `C-05 PillCTA` `white` and `ghost` variants — no new components, no new tokens. `verify.mjs` reports `10 surface docs claim 15 screens, no orphans / double-claims` and all drift / hex sweeps green. Downstream wire is [[tb-01-landing-page-wire|TB-01]].

### Adjacency surfaced (not actioned)

S01's existing `"SETTINGS"` footer link becomes redundant once S00 routes to S09 as a first-class CTA. Whether to remove the S01 footer link is a separate spec decision — flagged in the new surface doc under `## Adjacencies` and `## Out of scope`, not actioned in this PR.

## Open questions

- File naming: `00-landing.md` (sorts first) vs `09-landing.md` (sorts last with onboarding-adjacent surfaces). **Resolved:** `00-landing.md` (precedes S01 in the flow, matches `00a-signin.md` numbering proposed in [[sg-03-account-creation-surfaces|sg-03]]).

## Blocked by

None — can start immediately. [[tb-01-landing-page-wire|tb-01]] is blocked on this issue.
