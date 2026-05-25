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

# bug-24 — Bottom-sheet shape + sizing mismatch

## Symptom

The sheets that rise from the bottom of the screen on the Plan list — the new-plan disambig sheet (Solo vs Group, triggered by the `+` FAB) and the per-card delete confirm sheet — do not fit the screen well.

Two distinct complaints:

1. **Shape is wrong for iOS.** The sheets do not look like native iOS sheets. iOS users expect a rounded-top, drag-indicator-bearing sheet that floats above the gradient with the system's grabber + safe-area treatment. The current sheets look generic.
2. **Vertical sizing wastes space.** The sheets expand upward more than the content needs, which produces a lot of empty space inside the sheet. There is no reason to grow upward to that height — and the user is fine with the sheets being **wider** if that means less vertical empty space (or sized to content with a sensible cap).

User report: "The menus that come up from the bottom of the screen (for both new plans and deletion) don't fit the screen very well. They're not shaped appropriately for iOS. Also, there is no reason to expand it up, but you can make them larger which creates a lot of empty space."

## Suggested direction (triage to confirm)

Both sheets compose inline from existing C-16-pattern primitives (per `surfaces/00-plan-list.md` §Components used). The locked surface doc + the iOS port both need to change. Likely shape:

- Move the iOS port to SwiftUI's `.sheet` + `.presentationDetents([.medium, ...])` / `.presentationDragIndicator(.visible)` (or `.presentationDetents([.height(contentHeight)])`) so the sheet sizes to its content and carries the native grabber + rounded-top affordance.
- Re-visit the design-system spec for the sheet container to match — keep the dark-glass register inside, but the *container* takes the iOS-native shape rather than a bespoke one.
- Disambig sheet: 2 large-row buttons (Solo / Group) + cancel — content-height, not half-screen.
- Delete confirm sheet: 1 destructive primary + cancel + body copy — content-height.

Two work shapes possible: `spec-gap` on a shared "sheet container" primitive that both compositions consume, OR two narrower edits if the sheets are not meant to share a primitive. Grill to decide.

## Surfaced by

User dogfood, 2026-05-24.

## References

- `design-system/surfaces/00-plan-list.md` §Components used — "C-16-style confirm bottom sheet (composed inline)".
- `design-system/components.md` — C-16 family; check for an existing bottom-sheet container spec.
- `ios/Sources/App/PlanListScreen.swift` — the new-plan disambig sheet site + the delete confirm sheet site (search around the `ActionDotMenu.Item(... destructive: true)` callers).
- Apple HIG: Sheets (`https://developer.apple.com/design/human-interface-guidelines/sheets`) — native shape baseline.

## Grill outcome (2026-05-24)

`/grill-with-docs` resolved this as a `spec-gap` introducing a new component primitive distinct from C-16, plus paired iOS + web port. Classified `spec-gap` + `AFK`. Bundle the spec edit, the new component JSX, the S00 surface update, and both ports in a single AFK PR.

### Diagnosis

The design system today has **one** bespoke sheet primitive — `C-16 Bottom Sheet (Reroll)` — and `components.md` line 513 (the C-23 LocationPicker spec) explicitly states: *"The sheet inherits C-16's primitive (radius, blur, shadow, handle) verbatim so the system has one sheet idiom, not two."* C-16's container is intentional and consistent for the system's modal-editor surfaces (reroll, location picker) but is **not native iOS** — `rgba(20,20,30,0.92)` dark glass, inset 12 from edges, bottom 12, custom 38×4 handle, no native grabber, no `presentationDetents`.

The two sheets the user flagged on S00 (new-plan disambig + delete confirm) are described in `surfaces/00-plan-list.md` §Components used as `"C-16-style confirm bottom sheet (composed inline; reuses the existing reroll sheet primitive language)"` — they are not formal components; they are inline compositions in `PlanListScreen.swift` that adopt C-16's visual language for surfaces it was never designed for. iOS HIG distinguishes:
- **Sheet** — modal editor surface, rich content, persistent. (Apple's Mail compose, Maps' details.)
- **Action sheet / alert sheet** — short binary choice, content-height, native rounded-top + grabber.

The disambig (2 large-row buttons) and delete-confirm (1 destructive + cancel) are *action-sheet-shaped* in intent but are being rendered with the *modal-sheet* primitive. That is the mismatch the user is feeling.

### Chosen shape — split into two primitives

- **C-16 (`Bottom Sheet — Reroll`)** stays as it is. The reroll surface and the C-23 LocationPicker sheet are both rich editor surfaces; the bespoke dark-glass treatment is intentional there. **No change** to C-16, no change to the reroll sheet, no change to the location-picker sheet.
- **New primitive: `C-2N · Action Sheet`** (the next available `C-NN` slot in `components.md` — assign at edit time). Native iOS shape: rounded-top only, full-width, content-height (`.presentationDetents([.height(contentHeight)])` on iOS), native grabber (`.presentationDragIndicator(.visible)`), system safe-area treatment. Inside the container, the system's dark-glass register is preserved for visual continuity with the rest of Sunset Pop — but the container's outer geometry is native, not bespoke.
- The S00 Plan list disambig sheet and the delete confirm sheet both consume the new `C-2N` primitive instead of inline-composing from C-16.

Rejected shapes (recorded so the trade-off is not relitigated): (A) full native iOS divergence with no design-system change — rejected because it would split the iOS port from the design-system spec, breaking the single-source-of-truth contract; (B) re-spec C-16's outer container to native iOS shape — rejected because it would break the locked reroll + location-picker visual register the founder hasn't complained about and which serves modal-editor intent correctly.

### Fix scope

- **Spec edit** — `design-system/components.md`:
  - Add a new `C-2N · Action Sheet` section after the C-16 section. Include the why-distinct-from-C-16 paragraph (action-sheet vs modal-sheet HIG distinction), the visual spec table (container = native iOS rounded-top, full-width, content-height; inside = dark-glass register), behavior, customization props, and the SwiftUI primitive snippet.
  - Amend the C-16 §intro paragraph to disambiguate C-16 (modal editor) from C-2N (action sheet). Note that C-23 LocationPicker continues to inherit C-16 (modal editor surface).
- **Spec edit** — `design-system/code/components.jsx`:
  - Export a new `ActionSheet` component (companion to the existing `BottomSheet` / equivalent for C-16). Web JSX cannot literally use SwiftUI's `presentationDetents`, but the JSX should model the shape: full-width, rounded-top, no edge insets, content-height container; backdrop click-to-dismiss; ARIA role `dialog` with `aria-modal="true"`.
- **Spec edit** — `design-system/surfaces/00-plan-list.md`:
  - Update §Components used: the inline `"C-16-style confirm bottom sheet"` reference is replaced with `"C-2N ActionSheet (consumer)"`. Disambig sheet and delete-confirm sheet are both noted as C-2N consumers.
  - Update §"Disambig sheet" subsection: the container row's spec rows (Backdrop / Sheet inset / Sheet bottom) are replaced with `"C-2N container"` and the inner content (2 stacked C-05 ghost pills, cancel) is preserved.
  - Add a §"Delete confirm sheet" subsection if one does not exist, describing the destructive-primary + cancel composition over a C-2N container.
- **iOS port** — `ios/Sources/App/PlanListScreen.swift`:
  - Replace both sheet sites with SwiftUI `.sheet` + `.presentationDetents([.height(contentHeight)])` + `.presentationDragIndicator(.visible)`. Inside the sheet, render the existing dark-glass register so the visual is continuous with the rest of the app.
  - Drop any custom drag handle, custom rounded-top container, and custom edge inset that competed with the native grabber + native rounded-top.
- **Web port** — `web/` (any web surfaces that render the equivalent sheets):
  - Adopt the same `ActionSheet` JSX export; full-width, rounded-top, content-height.
- **CHANGELOG** — `design-system/CHANGELOG.md`: one-line entry. **Not** prefixed `BREAKING:` — C-16 is unchanged, and the new C-2N primitive is purely additive. The S00 surface update changes the §Components used list but the user-visible behavior of the disambig + delete sheets is the goal, not a regression.

### Verification

- `node design-system/scripts/verify.mjs` green.
- iOS simulator walk: tap FAB → disambig sheet rises with native iOS grabber, content-height, no dead vertical space. Tap Solo or Group → routes to S01 Setup. Cancel dismisses.
- iOS simulator walk: tap `⋯` on a Plan card → tap Delete → delete-confirm sheet rises content-height with the destructive primary visible without scrolling. Cancel dismisses; destructive confirms.
- Reroll surface (S07) and C-23 LocationPicker sheet are visually unchanged — C-16 is preserved.

### Adjacency flagged, not filed

If C-2N's introduction surfaces a use case for a second consumer (e.g. a future single-choice action sheet on a different surface), file the consumer separately. The point primitive landing here is enough; do not stretch the spec on speculation.

## Comments

- **2026-05-24 (AFK close):** Shipped as PR #225 (`afk/bug-24`). The new primitive landed as **C-27 · Action Sheet** (next sequential slot after C-25 / C-26). Spec: `design-system/components.md §C-27` + C-16 intro disambiguation; web JSX: `design-system/code/components.jsx` `ActionSheet` export; surface update: `design-system/surfaces/00-plan-list.md` §Components used + §"Disambig sheet" (revised) + new §"Delete confirm sheet" subsection. iOS port: `ios/Sources/App/PlanDisambigSheet.swift` + `ios/Sources/App/PlanDestructiveConfirmSheet.swift` drop the custom 38×4 handle pill and the `[.height(N), .medium]` detents in favor of `.presentationDragIndicator(.visible)` + a single `.presentationDetents([.height(contentHeight)])` + `.presentationBackground(GTIColor.ink2.opacity(0.94))` to keep the dark-glass register inside the native container. Each sheet exposes a public `enum Shape` with static constants (`usesNativeGrabber`, `detentCount`, `contentHeight`) tests pin so a future regression cannot silently re-introduce the `.medium` snap or a custom handle. CHANGELOG entry is purely additive (not BREAKING — C-16 unchanged).
