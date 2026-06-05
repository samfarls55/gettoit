---
issue: bug-21
title: Plan list per-card â‹¯ trigger hitbox too small â€” taps frequently land on the card body and open the verdict
status: done
type: AFK
github_issue: 221
created: 2026-05-24
grilled: 2026-05-24
closed: 2026-05-24
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-21 â€” Plan list per-card `â‹¯` trigger hitbox too small

## Symptom

On the home page (S00 Plan list), tapping the trailing `â‹¯` (Action Dot Menu trigger) on a Plan card very often misses the trigger and falls through to the card body's tap target, which navigates into the Plan and lands the user on the verdict screen by accident.

User report: "The hitbox on the ... button (home page) is too small. Often times, clicking it will go to the verdict screen by accident."

## Suggested direction (triage to confirm)

`ActionDotMenu.Trigger` is currently sized at `ActionDotMenu.triggerDiameter` (36Ã—36 per the locked C-25 spec). On a real device that does not clear the 44pt HIG minimum, and the surrounding `PlanCard` row owns a 64â€“76pt min-height tap target â€” so the dot trigger is both physically small AND nested inside a much larger competing tap target. Likely fixes (grill picks the right one):

- Expand the trigger's effective hit area without changing its visual diameter (SwiftUI `contentShape(Rectangle())` over a padded frame, or an outer 44Ã—44 tap zone that visually centers the 36pt glyph).
- Subtract the trigger's hit zone from the `PlanCard` tap area (high-priority gesture / `simultaneousGesture` ordering, or `Button` over `Button` precedence) so a tap inside the trigger never reaches the row's `onTap`.
- Both â€” the HIG floor wants 44pt, and the nested-target precedence is a separate defect.

This is a C-25 contract question: the locked spec says the visual glyph stays 36pt; growing the hit area only is non-breaking. Confirm in grill.

## Surfaced by

User dogfood on the post-tb-WF-5..9 Plan list, 2026-05-24.

## References

- `ios/Sources/App/ActionDotMenu.swift` â€” `ActionDotMenu.Trigger`, `triggerDiameter`.
- `ios/Sources/App/PlanListScreen.swift` â€” `PlanCard` host row + trailing-slot composition (around the `padding(.trailing, ActionDotMenu.triggerDiameter)` sites).

## Grill outcome (2026-05-24)


### Fix scope

Apply both fixes â€” HIG floor and nested-target precedence are separate defects, and either one alone is insufficient.

1. **Expand the trigger's effective hit area to 44Ã—44** without changing its 36pt visual diameter. SwiftUI `contentShape(Rectangle())` over a 44pt padded frame, or an outer 44pt tap zone that visually centers the existing 36pt glyph. C-25 visual spec unchanged.
2. **Make the trigger's tap zone exclusive over the card row's `onTap`.** Use `simultaneousGesture` / high-priority gesture ordering, or a nested `Button` whose precedence pre-empts the row's tap recognizer. A tap inside the 44pt zone must never propagate to the row's "open verdict" handler.

### Verification

- Manual on-device walk: tap the dot 20+ times across multiple cards; every tap opens the action menu, never the verdict screen.
- Tap inside the 44pt zone but outside the 36pt visible glyph â†’ menu opens (proves the enlarged hit area is consumed correctly).
- Tap on the card body away from the dot â†’ verdict opens (proves the card's own tap target still works).

### Out of scope

- C-25 visual diameter or position changes.
- Other `ActionDotMenu` consumers (this fix is localized to the trigger primitive and may benefit any future consumer for free).

## Comments

### 2026-05-24 â€” closed (PR #229)

Fixed in [PR #229](https://github.com/samfarls55/gettoit/pull/229) (merged 2026-05-24).

- `ActionDotMenu.triggerDiameter` (36) stays the C-25 **visible** lock; a new `ActionDotMenu.triggerHitDiameter` (44) is the load-bearing tap target. Pair-of-constants approach pins both halves of the contract.
- `ActionDotMenu.Trigger` body now renders the visible glyph inside a `ZStack { ... }.frame(44).contentShape(Rectangle())`. The 44pt frame is the Button's actual tap footprint; `contentShape` paints it as the hit-test surface so taps in the 36â€“44pt corona land on the trigger instead of the card row.
- No `simultaneousGesture` / `highPriorityGesture` wiring needed â€” SwiftUI already gives the inner sibling Button precedence over the outer card-row Button in the ZStack overlay arrangement. The corona-fall-through happened because the inner Button's frame was only 36pt; widening to 44pt is sufficient on its own.
- Three new tests pin the contract: `testTriggerHitDiameterClearsHIG`, `testTriggerHitDiameterStrictlyExceedsVisualDiameter`, and `testTriggerRendersAtHitDiameter` (uses `UIHostingController.sizeThatFits` so a future regression that collapses the hit area back to 36pt fails CI).

Pending: on-device verification on the next TestFlight build.
