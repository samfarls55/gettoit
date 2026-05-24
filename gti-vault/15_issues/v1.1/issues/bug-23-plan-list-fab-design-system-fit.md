---
issue: bug-23
title: Plan list "+" FAB does not fit the Sunset Pop visual register — rework against Impeccable reference
status: ready-for-agent
type: AFK
github_issue: 223
created: 2026-05-24
grilled: 2026-05-24
---

# bug-23 — Plan list "+" FAB visual register mismatch

## Symptom

The `+` floating action button on the home page (S00 Plan list — `C-26 FloatingActionButton`, bottom-right glass + sun-glyph circle) looks out of place against the rest of the Sunset Pop surface. The visual treatment reads as generic / templated rather than part of the design system.

User report: "The + button on the homepage doesn't fit the design system very well. Use Impeccable to fix."

## Open question for grill — "Impeccable"

The fix instruction names **Impeccable** as a reference. That term does not appear in the vault, the design system, or any memory. Grill must resolve: is Impeccable

- a Refero / Mobbin reference library to mine for FAB treatments,
- a third-party iOS / design library,
- a separate design source (Figma file, screenshot, mood board),
- shorthand for an existing internal asset we should locate,

…and which specific reference inside it should the FAB be modeled on?

Do not start work on this issue until that reference is pinned.

## Suggested direction (triage to confirm — pending the Impeccable clarification)

`C-26 FloatingActionButton` is the locked primitive. Two possible shapes for the fix:

- **Token-level adjustment** — re-tune glass fill, blur, sun-glyph weight, shadow, border against tokens.json without changing the component's structural contract. Lower risk; classified as `spec-gap` (component visual spec edit) + a 1-file iOS port follow-up.
- **Structural rework** — change the shape, position, or composition of the FAB (e.g. extend to a pill, drop the glass register for a sun-fill, attach a label). Requires a real S00 surface change — `spec-gap` on `surfaces/00-plan-list.md` + `components.md §C-26` + a paired `tracer-bullet`.

Pick the shape after the Impeccable reference is pinned.

## Surfaced by

User dogfood, 2026-05-24.

## References

- `design-system/components.md` §C-26 Floating Action Button.
- `design-system/code/components.jsx` — `FloatingActionButton` export.
- `design-system/surfaces/00-plan-list.md` §Components used — `C-26 FloatingActionButton`.
- `design-system/tokens.json` — `gradient.surfaces.initiator`, glass tokens, sun glyph.
- iOS port site (grep for `FloatingActionButton` / `FAB` in `ios/Sources/App/PlanListScreen.swift`).

## Grill outcome (2026-05-24)

### "Impeccable" resolved

`Impeccable` refers to the `impeccable:impeccable` skill loaded in this session (frontend design-intelligence skill — "design, redesign, shape, critique, polish, distill, harden, adapt, colorize…"). Not a Refero library, not a Figma file, not a third-party iOS package, not a separate mood board. The grill invoked the skill inline against C-26 + `tokens.json` + `surfaces/00-plan-list.md` and produced a treatment proposal table; the user picked **T1 ink-fill**. Classified `spec-gap` + `AFK`.

### Diagnosis (why C-26 read generic)

1. Hits `impeccable`'s "Glassmorphism as default" absolute ban — glass is the *carrier* of the primary create affordance, not a rare / purposeful flourish.
2. Current shadow `0 8px 24px rgba(0,0,0,0.18)` is generic-dark — drifts from the system's sun-tinted elevation language (`shadow.cta-sun`, `shadow.time-badge`, `shadow.chip-selected` all carry `rgba(255,210,63,*)`). The FAB is the only major elevated primitive using a black-noise shadow.
3. Glyph is `+` Inter 900 — a typeset plus on a brand whose mark is a sun. Functional, not branded.

### Chosen treatment — T1 ink-fill

| Element | Spec |
|---|---|
| Container | 56×56, `position: absolute`, `bottom: 18`, `right: 18`, `z-index: 5` (**unchanged**) |
| Background | `var(--ink-2)` (`#1A1C1F`) — deep but warmer than pure ink |
| Border | **none** — glass stroke removed |
| Shadow | `0 12px 32px rgba(255,210,63,0.32), inset 0 1px 0 rgba(255,255,255,0.08)` — new token `shadow.fab` (sun-tinted halo) |
| Radius | 999 (full circle) (**unchanged**) |
| Glyph | `+` Inter 900 / 28, `var(--sun)`, vertically centered (**unchanged**) |
| Pressed | `transform: scale(0.96)`, 140ms `var(--ease-out)` (**unchanged**) |
| Tap target | 56×56 visible — clears HIG 44 with breathing room (**unchanged**) |

### Why T1 over T2 (polished glass) and T3 (sun-fill)

- **T3 sun-fill rejected.** The locked rationale at `components.md §C-26` line 752 (`"a sun-yellow disc would over-saturate against the warm wash"`) is correct: the `initiator` gradient's bottom stop `g4` is `#FFD23F` (= `--sun`), so a 56pt sun puck visually melts into the bottom of the gradient.
- **T2 polished glass deferred.** T2 still recovers most of the "generic" complaint via shadow + fill density tweaks, but does not break the glassmorphism-default ban. Kept as the fallback if T1's spec call surfaces a regression in user testing.
- **T1 ink-fill picked.** Breaks the absolute ban; sun glyph is the only sun on the FAB so the "sun = registered intent" semantic sharpens; sun-tinted halo lands the FAB inside the system's elevation language for the first time; warm gradient + ink puck + sun glyph reads graphic, not templated.

### Fix scope

- **Token edit** — `design-system/tokens.json`:
  - Add `shadow.fab = "0 12px 32px rgba(255,210,63,0.32), inset 0 1px 0 rgba(255,255,255,0.08)"`.
  - Run `node design-system/scripts/gen-css.mjs` to regenerate `code/tokens.css`. Commit both.
- **Spec edit** — `design-system/components.md` §C-26:
  - Replace `Background`, `Border`, `Shadow` rows of the Visual spec table with the T1 values above.
  - Amend the §"Why a custom FAB" rationale: keep the FAB-vs-chrome-vs-dock paragraph (sg-WF-4 founder lock); rewrite the glass-vs-sun-fill paragraph to reflect the T1 ink-fill decision, citing the impeccable grill (2026-05-24) and naming the absolute-ban motivation. The line 752 sun-fill rejection rationale stays — T1 is neither glass nor sun-fill but ink-fill, and the sun-fill argument still applies if anyone reopens that path.
- **Spec edit** — `design-system/code/components.jsx`:
  - Update `FloatingActionButton` style to T1: drop `background: 'rgba(255,255,255,0.18)'`, `backdropFilter`, `border` (set to `none`); replace `boxShadow` with `var(--shadow-fab)`; set `background: 'var(--ink-2)'`.
- **iOS port** — `ios/Sources/App/PlanListScreen.swift` (the `FloatingActionButton` SwiftUI primitive):
  - Replace `.background(.ultraThinMaterial, in: Circle())` with `.background(GTIColor.ink2, in: Circle())`.
  - Remove the `.overlay(Circle().stroke(.white.opacity(0.32), lineWidth: 0.75))` glass border.
  - Replace `.shadow(color: .black.opacity(0.18), radius: 12, x: 0, y: 8)` with the regenerated `GTIShadow.fab` (sun-tinted halo).
- **No surface edit** — `design-system/surfaces/00-plan-list.md` is **not** touched. The FAB's external contract (diameter, position, behavior, components-used list) is unchanged. Only the FAB's fill/border/shadow change.
- **CHANGELOG** — `design-system/CHANGELOG.md`: one-line entry, prefix `BREAKING:` (the FAB's visual identity shifts — any external consumer assuming the glass treatment will see a different rendering).

### Verification

- `node design-system/scripts/verify.mjs` green.
- Sunset Pop gradient + ink puck + sun glyph composition reviewed on iPhone simulator across the three S00 states (Pending only, Decided only, both populated). FAB still legible against the brightest gradient stop.
- Confirm the empty-state hero (`PillCTA fill="white"`) still suppresses the FAB — no change to that path.

### Adjacency flagged, not filed

The shadow audit during the grill noted the FAB was the only major elevated primitive on a generic-dark shadow. If any other primitive (search `tokens.json` for `rgba(0,0,0,*)` shadows) is found to read generic for the same reason, file separately — not folded into bug-23.
