---
issue: bug-24
title: Bottom sheets (new-plan disambig, delete confirm) are not iOS-shaped and create dead vertical space
status: done
type: AFK
github_issue: 224
created: 2026-05-24
grilled: 2026-05-24
closed: 2026-05-24
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-24 â€” Bottom-sheet shape + sizing mismatch

## Symptom

The sheets that rise from the bottom of the screen on the Plan list â€” the new-plan disambig sheet (Solo vs Group, triggered by the `+` FAB) and the per-card delete confirm sheet â€” do not fit the screen well.

Two distinct complaints:

1. **Shape is wrong for iOS.** The sheets do not look like native iOS sheets. iOS users expect a rounded-top, drag-indicator-bearing sheet that floats above the gradient with the system's grabber + safe-area treatment. The current sheets look generic.
2. **Vertical sizing wastes space.** The sheets expand upward more than the content needs, which produces a lot of empty space inside the sheet. There is no reason to grow upward to that height â€” and the user is fine with the sheets being **wider** if that means less vertical empty space (or sized to content with a sensible cap).

User report: "The menus that come up from the bottom of the screen (for both new plans and deletion) don't fit the screen very well. They're not shaped appropriately for iOS. Also, there is no reason to expand it up, but you can make them larger which creates a lot of empty space."

## Suggested direction (triage to confirm)

Both sheets compose inline from existing C-16-pattern primitives (per `surfaces/00-plan-list.md` Â§Components used). The locked surface doc + the iOS port both need to change. Likely shape:

- Move the iOS port to SwiftUI's `.sheet` + `.presentationDetents([.medium, ...])` / `.presentationDragIndicator(.visible)` (or `.presentationDetents([.height(contentHeight)])`) so the sheet sizes to its content and carries the native grabber + rounded-top affordance.
- Disambig sheet: 2 large-row buttons (Solo / Group) + cancel â€” content-height, not half-screen.
- Delete confirm sheet: 1 destructive primary + cancel + body copy â€” content-height.

Two work shapes possible: `spec-gap` on a shared "sheet container" primitive that both compositions consume, OR two narrower edits if the sheets are not meant to share a primitive. Grill to decide.

## Surfaced by

User dogfood, 2026-05-24.

## References

- `ios/Sources/App/PlanListScreen.swift` â€” the new-plan disambig sheet site + the delete confirm sheet site (search around the `ActionDotMenu.Item(... destructive: true)` callers).
- Apple HIG: Sheets (`https://developer.apple.com/design/human-interface-guidelines/sheets`) â€” native shape baseline.

## Grill outcome (2026-05-24)

`/grill-with-docs` resolved this as a `spec-gap` introducing a new component primitive distinct from C-16, plus paired iOS + web port. Classified `spec-gap` + `AFK`. Bundle the spec edit, the new component JSX, the S00 surface update, and both ports in a single AFK PR.

### Diagnosis


The two sheets the user flagged on S00 (new-plan disambig + delete confirm) are described in `surfaces/00-plan-list.md` Â§Components used as `"C-16-style confirm bottom sheet (composed inline; reuses the existing reroll sheet primitive language)"` â€” they are not formal components; they are inline compositions in `PlanListScreen.swift` that adopt C-16's visual language for surfaces it was never designed for. iOS HIG distinguishes:
- **Sheet** â€” modal editor surface, rich content, persistent. (Apple's Mail compose, Maps' details.)
- **Action sheet / alert sheet** â€” short binary choice, content-height, native rounded-top + grabber.

The disambig (2 large-row buttons) and delete-confirm (1 destructive + cancel) are *action-sheet-shaped* in intent but are being rendered with the *modal-sheet* primitive. That is the mismatch the user is feeling.

### Chosen shape â€” split into two primitives

- **C-16 (`Bottom Sheet â€” Reroll`)** stays as it is. The reroll surface and the C-23 LocationPicker sheet are both rich editor surfaces; the bespoke dark-glass treatment is intentional there. **No change** to C-16, no change to the reroll sheet, no change to the location-picker sheet.
- **New primitive: `C-2N Â· Action Sheet`** (the next available `C-NN` slot in `components.md` â€” assign at edit time). Native iOS shape: rounded-top only, full-width, content-height (`.presentationDetents([.height(contentHeight)])` on iOS), native grabber (`.presentationDragIndicator(.visible)`), system safe-area treatment. Inside the container, the system's dark-glass register is preserved for visual continuity with the rest of Sunset Pop â€” but the container's outer geometry is native, not bespoke.
- The S00 Plan list disambig sheet and the delete confirm sheet both consume the new `C-2N` primitive instead of inline-composing from C-16.


### Fix scope

  - Add a new `C-2N Â· Action Sheet` section after the C-16 section. Include the why-distinct-from-C-16 paragraph (action-sheet vs modal-sheet HIG distinction), the visual spec table (container = native iOS rounded-top, full-width, content-height; inside = dark-glass register), behavior, customization props, and the SwiftUI primitive snippet.
  - Amend the C-16 Â§intro paragraph to disambiguate C-16 (modal editor) from C-2N (action sheet). Note that C-23 LocationPicker continues to inherit C-16 (modal editor surface).
  - Export a new `ActionSheet` component (companion to the existing `BottomSheet` / equivalent for C-16). Web JSX cannot literally use SwiftUI's `presentationDetents`, but the JSX should model the shape: full-width, rounded-top, no edge insets, content-height container; backdrop click-to-dismiss; ARIA role `dialog` with `aria-modal="true"`.
  - Update Â§Components used: the inline `"C-16-style confirm bottom sheet"` reference is replaced with `"C-2N ActionSheet (consumer)"`. Disambig sheet and delete-confirm sheet are both noted as C-2N consumers.
  - Update Â§"Disambig sheet" subsection: the container row's spec rows (Backdrop / Sheet inset / Sheet bottom) are replaced with `"C-2N container"` and the inner content (2 stacked C-05 ghost pills, cancel) is preserved.
  - Add a Â§"Delete confirm sheet" subsection if one does not exist, describing the destructive-primary + cancel composition over a C-2N container.
- **iOS port** â€” `ios/Sources/App/PlanListScreen.swift`:
  - Replace both sheet sites with SwiftUI `.sheet` + `.presentationDetents([.height(contentHeight)])` + `.presentationDragIndicator(.visible)`. Inside the sheet, render the existing dark-glass register so the visual is continuous with the rest of the app.
  - Drop any custom drag handle, custom rounded-top container, and custom edge inset that competed with the native grabber + native rounded-top.
- **Web port** â€” `web/` (any web surfaces that render the equivalent sheets):
  - Adopt the same `ActionSheet` JSX export; full-width, rounded-top, content-height.

### Verification

- iOS simulator walk: tap FAB â†’ disambig sheet rises with native iOS grabber, content-height, no dead vertical space. Tap Solo or Group â†’ routes to S01 Setup. Cancel dismisses.
- iOS simulator walk: tap `â‹¯` on a Plan card â†’ tap Delete â†’ delete-confirm sheet rises content-height with the destructive primary visible without scrolling. Cancel dismisses; destructive confirms.
- Reroll surface (S07) and C-23 LocationPicker sheet are visually unchanged â€” C-16 is preserved.

### Adjacency flagged, not filed

If C-2N's introduction surfaces a use case for a second consumer (e.g. a future single-choice action sheet on a different surface), file the consumer separately. The point primitive landing here is enough; do not stretch the spec on speculation.

## Comments

