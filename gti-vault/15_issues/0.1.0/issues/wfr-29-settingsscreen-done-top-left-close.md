---
issue: wfr-29
title: Switch SettingsScreen DONE to iOS top-left close convention
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 270
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-29 â€” SettingsScreen "DONE" label + center placement breaks iOS habituation

## What to build

Replace the bottom-center plain-text "DONE" with a top-leading X icon (or "Close") matching iOS sheet dismissal convention. Combines with [[wfr-07-settingsscreen-demote-delete-pill|wfr-07]] (DELETE demotion). Assumes [[wfr-06-settingsscreen-entry-from-planlist|wfr-06]] (Settings entry point) has landed.

## Acceptance criteria

- [ ] Top-leading close affordance.
- [ ] Tap dismisses sheet.
- [ ] Bottom-center DONE removed.

## Blocked by

- [[wfr-06-settingsscreen-entry-from-planlist|wfr-06]] â€” Settings entry point.
- [[wfr-07-settingsscreen-demote-delete-pill|wfr-07]] â€” DELETE demotion. Pair these two so the sheet chrome is coherent on a single review.

## Hub anchors

- [[../../30_design/interaction-patterns/principles#P-07. Habituation]]
- [[../../30_design/interaction-patterns/surfaces#Settings]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #29.

## Comments

- **2026-05-26 (AFK close)** â€” Shipped on `afk/wfr-29` (PR [#309](https://github.com/samfarls55/gettoit/pull/309)). Replaces the bottom-center `DONE` PillCTA on S09 Settings with a top-leading `xmark` SF Symbol close glyph â€” iOS sheet-dismissal convention, P-07 Habituation. The wfr-07 ghost-destructive treatment on `DELETE MY DATA` is preserved verbatim; the CTA dock now holds only that one action. The close glyph fires the same `onDone` callback the retired DONE pill used, so RootView wiring is unchanged. Decisions: chose the SF Symbol glyph over a text `CLOSE` label (the issue allowed either; glyph reads "sheet escape" at a glance and visually distinguishes the Settings utility surface from the Sunset Pop ritual arc); dropped the previously-rendered top-leading `GTIMark` from the JSX (the Swift never had it â€” the slot now belongs to the close glyph); style contract amended, not extended (removed the wfr-07 `donePillFill` / `donePrimaryOrder` / `deleteSecondaryOrder` flags since there's no primary/secondary pair to order anymore, added four wfr-29 flags `closeSymbolName`, `closeAlignment`, `closeMinTapTarget`, `rendersBottomDonePill`); glyph styling 17pt semibold, white-at-0.86 opacity (matches VerdictReadOnly home chrome), 44pt minimum tap target, no new tokens; accessibility label `"Close. Return to plans."` (terminal verb + destination, matching the cadence of the retired pill). Tests pin all four wfr-29 flags and preserve the wfr-07 ghost-destructive + no-red contract + confirm-alert copy tests. `design-system/surfaces/09-settings.md` updated with the new surface-escape section.
