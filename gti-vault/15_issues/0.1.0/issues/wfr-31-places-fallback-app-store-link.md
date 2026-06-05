---
issue: wfr-31
title: Add App Store link to places-fallback install copy
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 272
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-31 â€” web/app/places-fallback "open the app on iOS" copy without App Store link

## What to build

`places-fallback` page (~line 35) mentions "open the GetToIt app on iOS" but does not link to the App Store. Add the App Store URL inline. AFK agent has full autonomy to pick the cleanest CTA shape â€” inline link on the word "iOS" or a dedicated secondary button â€” and to fetch the correct App Store URL.

## Acceptance criteria

- [ ] App Store link present (either the word "iOS" or a dedicated CTA).
- [ ] Link opens the App Store on mobile, the App Store web page on desktop.

## Blocked by

None â€” can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Help Systems]]
- [[../../30_design/interaction-patterns/patterns#Richly Connected Apps]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #31.

## Comments

- 2026-05-26 â€” Closed via afk/wfr-31. Wrapped the word "iOS" in the `PlacesEmptyState` body copy as an inline `<a>` to the existing `APP_STORE_URL` constant in `web/lib/app-store.ts` (the same placeholder S04 / SessionRoom already uses; the real Apple ID swaps centrally there once allocated). Inline-link CTA shape chosen over a dedicated button so the existing "Try again" / "Start over" remains the dominant action on the terminal fallback. `target="_blank"` + `rel="noopener noreferrer"` matches the SessionRoom S04 affordance (download CTA opens in a new tab so the verdict context isn't lost). New `PlacesEmptyState.test.tsx` covers the link `href`/`target`/`rel`.
