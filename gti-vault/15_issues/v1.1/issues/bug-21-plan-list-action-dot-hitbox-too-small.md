---
issue: bug-21
title: Plan list per-card ⋯ trigger hitbox too small — taps frequently land on the card body and open the verdict
status: ready-for-agent
github_issue: 221
created: 2026-05-24
grilled: 2026-05-24
---

# bug-21 — Plan list per-card `⋯` trigger hitbox too small

## Symptom

On the home page (S00 Plan list), tapping the trailing `⋯` (Action Dot Menu trigger) on a Plan card very often misses the trigger and falls through to the card body's tap target, which navigates into the Plan and lands the user on the verdict screen by accident.

User report: "The hitbox on the ... button (home page) is too small. Often times, clicking it will go to the verdict screen by accident."

## Suggested direction (triage to confirm)

`ActionDotMenu.Trigger` is currently sized at `ActionDotMenu.triggerDiameter` (36×36 per the locked C-25 spec). On a real device that does not clear the 44pt HIG minimum, and the surrounding `PlanCard` row owns a 64–76pt min-height tap target — so the dot trigger is both physically small AND nested inside a much larger competing tap target. Likely fixes (grill picks the right one):

- Expand the trigger's effective hit area without changing its visual diameter (SwiftUI `contentShape(Rectangle())` over a padded frame, or an outer 44×44 tap zone that visually centers the 36pt glyph).
- Subtract the trigger's hit zone from the `PlanCard` tap area (high-priority gesture / `simultaneousGesture` ordering, or `Button` over `Button` precedence) so a tap inside the trigger never reaches the row's `onTap`.
- Both — the HIG floor wants 44pt, and the nested-target precedence is a separate defect.

This is a C-25 contract question: the locked spec says the visual glyph stays 36pt; growing the hit area only is non-breaking. Confirm in grill.

## Surfaced by

User dogfood on the post-tb-WF-5..9 Plan list, 2026-05-24.

## References

- `ios/Sources/App/ActionDotMenu.swift` — `ActionDotMenu.Trigger`, `triggerDiameter`.
- `ios/Sources/App/PlanListScreen.swift` — `PlanCard` host row + trailing-slot composition (around the `padding(.trailing, ActionDotMenu.triggerDiameter)` sites).
- `design-system/components.md` §C-25 Action Dot Menu — locked visual spec for the trigger.
- `design-system/surfaces/00-plan-list.md` §Card content — the host row's tap target spec.
- `design-system/accessibility.md` — 44pt HIG minimum.

## Grill outcome (2026-05-24)

`/grill-with-docs` resolved this as a pure bug (no design-system spec change). C-25's locked visual diameter (36pt) is preserved; the fix is implementation-only in the iOS port. Classified `bug` + `AFK`.

### Fix scope

Apply both fixes — HIG floor and nested-target precedence are separate defects, and either one alone is insufficient.

1. **Expand the trigger's effective hit area to 44×44** without changing its 36pt visual diameter. SwiftUI `contentShape(Rectangle())` over a 44pt padded frame, or an outer 44pt tap zone that visually centers the existing 36pt glyph. C-25 visual spec unchanged.
2. **Make the trigger's tap zone exclusive over the card row's `onTap`.** Use `simultaneousGesture` / high-priority gesture ordering, or a nested `Button` whose precedence pre-empts the row's tap recognizer. A tap inside the 44pt zone must never propagate to the row's "open verdict" handler.

### Verification

- Manual on-device walk: tap the dot 20+ times across multiple cards; every tap opens the action menu, never the verdict screen.
- Tap inside the 44pt zone but outside the 36pt visible glyph → menu opens (proves the enlarged hit area is consumed correctly).
- Tap on the card body away from the dot → verdict opens (proves the card's own tap target still works).

### Out of scope

- C-25 visual diameter or position changes.
- Other `ActionDotMenu` consumers (this fix is localized to the trigger primitive and may benefit any future consumer for free).
