---
issue: wfr-08
title: Distinguish primary vs secondary CTA on LocationPermissionScreen
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 249
github_pr: 277
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# wfr-08 â€” LocationPermissionScreen two CTAs share equal visual weight

## What to build

Promote "Share my location" to primary pill (existing white pill). Demote "Enter manually" to secondary text button. Both CTAs currently render in the same pill style.

## Acceptance criteria

- [x] Primary/secondary distinction visible.
- [x] Snapshot test covers both states.

## Blocked by

None â€” can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/principles#V-01. Visual hierarchy]]
- [[../../30_design/interaction-patterns/patterns#Clear Entry Points]]
- [[../../30_design/interaction-patterns/surfaces#Entry]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #8.

## Comments

- **2026-05-26** â€” Closed via PR #277. The view body already rendered the spec-correct treatments (white pill primary + eyebrow text-link secondary per `design-system/surfaces/00b-location-permission.md`); finding #8 was based on a pre-fix snapshot of the screen. The PR extracts the CTA treatment into static spec data (`primaryCtaTreatment` / `secondaryCtaTreatment`) so the view body reads from it, and adds `LocationPermissionScreenSnapshotTests.swift` with a load-bearing distinct-treatment regression guard. Pixel-identical to `main`; the change is structural.
