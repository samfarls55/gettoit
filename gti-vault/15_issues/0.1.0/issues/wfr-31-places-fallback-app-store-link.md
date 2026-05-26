---
issue: wfr-31
title: Add App Store link to places-fallback install copy
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 272
---

# wfr-31 — web/app/places-fallback "open the app on iOS" copy without App Store link

## What to build

`places-fallback` page (~line 35) mentions "open the GetToIt app on iOS" but does not link to the App Store. Add the App Store URL inline. AFK agent has full autonomy to pick the cleanest CTA shape — inline link on the word "iOS" or a dedicated secondary button — and to fetch the correct App Store URL.

## Acceptance criteria

- [ ] App Store link present (either the word "iOS" or a dedicated CTA).
- [ ] Link opens the App Store on mobile, the App Store web page on desktop.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Help Systems]]
- [[../../30_design/interaction-patterns/patterns#Richly Connected Apps]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #31.
