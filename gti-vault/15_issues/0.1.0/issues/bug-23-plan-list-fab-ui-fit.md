---
issue: bug-23
title: Plan list "+" FAB does not fit the Sunset Pop visual register â€” rework against Impeccable reference
status: done
type: AFK
github_issue: 223
created: 2026-05-24
grilled: 2026-05-24
closed: 2026-05-24
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-23 â€” Plan list "+" FAB visual register mismatch

## Symptom



## Open question for grill â€” "Impeccable"


- a Refero / Mobbin reference library to mine for FAB treatments,
- a third-party iOS / design library,
- a separate design source (Figma file, screenshot, mood board),
- shorthand for an existing internal asset we should locate,

â€¦and which specific reference inside it should the FAB be modeled on?

Do not start work on this issue until that reference is pinned.

## Suggested direction (triage to confirm â€” pending the Impeccable clarification)

`C-26 FloatingActionButton` is the locked primitive. Two possible shapes for the fix:

- **Token-level adjustment** â€” re-tune glass fill, blur, sun-glyph weight, shadow, border against tokens.json without changing the component's structural contract. Lower risk; classified as `spec-gap` (component visual spec edit) + a 1-file iOS port follow-up.
- **Structural rework** â€” change the shape, position, or composition of the FAB (e.g. extend to a pill, drop the glass register for a sun-fill, attach a label). Requires a real S00 surface change â€” `spec-gap` on `surfaces/00-plan-list.md` + `components.md Â§C-26` + a paired `tracer-bullet`.

Pick the shape after the Impeccable reference is pinned.

## Surfaced by

User dogfood, 2026-05-24.

## References

- iOS port site (grep for `FloatingActionButton` / `FAB` in `ios/Sources/App/PlanListScreen.swift`).

## Grill outcome (2026-05-24)

### "Impeccable" resolved

`Impeccable` refers to the `impeccable:impeccable` skill loaded in this session (frontend design-intelligence skill â€” "design, redesign, shape, critique, polish, distill, harden, adapt, colorizeâ€¦"). Not a Refero library, not a Figma file, not a third-party iOS package, not a separate mood board. The grill invoked the skill inline against C-26 + `tokens.json` + `surfaces/00-plan-list.md` and produced a treatment proposal table; the user picked **T1 ink-fill**. Classified `spec-gap` + `AFK`.

### Diagnosis (why C-26 read generic)

1. Hits `impeccable`'s "Glassmorphism as default" absolute ban â€” glass is the *carrier* of the primary create affordance, not a rare / purposeful flourish.
2. Current shadow `0 8px 24px rgba(0,0,0,0.18)` is generic-dark â€” drifts from the system's sun-tinted elevation language (`shadow.cta-sun`, `shadow.time-badge`, `shadow.chip-selected` all carry `rgba(255,210,63,*)`). The FAB is the only major elevated primitive using a black-noise shadow.
3. Glyph is `+` Inter 900 â€” a typeset plus on a brand whose mark is a sun. Functional, not branded.

### Chosen treatment â€” T1 ink-fill

| Element | Spec |
|---|---|
| Container | 56Ã—56, `position: absolute`, `bottom: 18`, `right: 18`, `z-index: 5` (**unchanged**) |
| Background | `var(--ink-2)` (`#1A1C1F`) â€” deep but warmer than pure ink |
| Border | **none** â€” glass stroke removed |
| Shadow | `0 12px 32px rgba(255,210,63,0.32), inset 0 1px 0 rgba(255,255,255,0.08)` â€” new token `shadow.fab` (sun-tinted halo) |
| Radius | 999 (full circle) (**unchanged**) |
| Glyph | `+` Inter 900 / 28, `var(--sun)`, vertically centered (**unchanged**) |
| Pressed | `transform: scale(0.96)`, 140ms `var(--ease-out)` (**unchanged**) |
| Tap target | 56Ã—56 visible â€” clears HIG 44 with breathing room (**unchanged**) |

### Why T1 over T2 (polished glass) and T3 (sun-fill)

- **T3 sun-fill rejected.** The locked rationale at `components.md Â§C-26` line 752 (`"a sun-yellow disc would over-saturate against the warm wash"`) is correct: the `initiator` gradient's bottom stop `g4` is `#FFD23F` (= `--sun`), so a 56pt sun puck visually melts into the bottom of the gradient.
- **T2 polished glass deferred.** T2 still recovers most of the "generic" complaint via shadow + fill density tweaks, but does not break the glassmorphism-default ban. Kept as the fallback if T1's spec call surfaces a regression in user testing.
- **T1 ink-fill picked.** Breaks the absolute ban; sun glyph is the only sun on the FAB so the "sun = registered intent" semantic sharpens; sun-tinted halo lands the FAB inside the system's elevation language for the first time; warm gradient + ink puck + sun glyph reads graphic, not templated.

### Fix scope

  - Add `shadow.fab = "0 12px 32px rgba(255,210,63,0.32), inset 0 1px 0 rgba(255,255,255,0.08)"`.
  - Replace `Background`, `Border`, `Shadow` rows of the Visual spec table with the T1 values above.
  - Amend the Â§"Why a custom FAB" rationale: keep the FAB-vs-chrome-vs-dock paragraph (sg-WF-4 founder lock); rewrite the glass-vs-sun-fill paragraph to reflect the T1 ink-fill decision, citing the impeccable grill (2026-05-24) and naming the absolute-ban motivation. The line 752 sun-fill rejection rationale stays â€” T1 is neither glass nor sun-fill but ink-fill, and the sun-fill argument still applies if anyone reopens that path.
  - Update `FloatingActionButton` style to T1: drop `background: 'rgba(255,255,255,0.18)'`, `backdropFilter`, `border` (set to `none`); replace `boxShadow` with `var(--shadow-fab)`; set `background: 'var(--ink-2)'`.
- **iOS port** â€” `ios/Sources/App/PlanListScreen.swift` (the `FloatingActionButton` SwiftUI primitive):
  - Replace `.background(.ultraThinMaterial, in: Circle())` with `.background(GTIColor.ink2, in: Circle())`.
  - Remove the `.overlay(Circle().stroke(.white.opacity(0.32), lineWidth: 0.75))` glass border.
  - Replace `.shadow(color: .black.opacity(0.18), radius: 12, x: 0, y: 8)` with the regenerated `GTIShadow.fab` (sun-tinted halo).

### Verification

- Sunset Pop gradient + ink puck + sun glyph composition reviewed on iPhone simulator across the three S00 states (Pending only, Decided only, both populated). FAB still legible against the brightest gradient stop.
- Confirm the empty-state hero (`PillCTA fill="white"`) still suppresses the FAB â€” no change to that path.

### Adjacency flagged, not filed

The shadow audit during the grill noted the FAB was the only major elevated primitive on a generic-dark shadow. If any other primitive (search `tokens.json` for `rgba(0,0,0,*)` shadows) is found to read generic for the same reason, file separately â€” not folded into bug-23.

## Comments

### 2026-05-24 â€” AFK execution closed

Shipped on `afk/bug-23`. Token + spec + JSX + iOS all landed in one PR:

- `tokens.json` gained `shadow.fab` (sun-tinted halo `0 12px 32px rgba(255,210,63,0.32), inset 0 1px 0 rgba(255,255,255,0.08)`).
- `scripts/gen-css.mjs` now emits `--shadow-fab` in `code/tokens.css`.
- `scripts/gen-swift.mjs` now emits a `GTIShadow` enum + `.gtiShadow(_:)` `View` extension; `GTIShadow.fab` carries the outer drop (`color: sun@0.32, radius: 32, x: 0, y: 12`). Multi-stop CSS recipes' inset / spread layers are not lifted because SwiftUI's `.shadow(...)` renders one drop layer; the 0.08-white inset on a 56pt disc does not read on iOS.
- `components.md Â§C-26` rewritten: new "Why ink-fill" rationale section, Visual spec table swaps `Background` to `var(--ink-2)`, `Border` to `none`, `Shadow` to `var(--shadow-fab)`. SwiftUI snippet swapped to `.background(GTIColor.ink2, in: Circle()).gtiShadow(GTIShadow.fab)`.
- `code/components.jsx` `FloatingActionButton` drops glass + blur + glass border + black-shadow combo; uses `var(--ink-2)` + `border: none` + `var(--shadow-fab)`.
- `ios/Sources/App/FloatingActionButton.swift` drops `.ultraThinMaterial` + glass border overlay + black-0.18 shadow literal; uses `GTIColor.ink2` + `.gtiShadow(GTIShadow.fab)`.
- `surfaces/00-plan-list.md` untouched (external FAB contract unchanged).
- `CHANGELOG.md` carries `BREAKING:` entry naming bug-23.
- New `scripts/test-fab-rework.mjs` (34 assertions, mirrors `test-plan-list.mjs` pattern) gates the whole rework.
- iOS `FloatingActionButtonTests` extended with two new tests pinning `GTIShadow.fab` recipe values + asserting it is not equal to `GTIShadow.ctaWhite` (the generic-dark recipe).

