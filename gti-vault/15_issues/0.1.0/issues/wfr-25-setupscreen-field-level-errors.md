---
issue: wfr-25
title: Move SetupScreen errors to field-level
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
closed: 2026-05-26
github_issue: 266
---

# wfr-25 — SetupScreen errors rendered top-of-dock, not field-local

## What to build

`SetupScreen.swift:616-621` renders a single error string at the top of the dock for both Save and Launch failures. Render errors inline beneath the field that failed, or scroll the failing field into view with localised copy.

## Acceptance criteria

- [x] Field-local error rendering on invalid name, invalid distance.
- [x] Top-of-dock error reserved for cross-field / network failures.
- [x] Snapshot test covers error placement.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Error Messages]]
- [[../../30_design/interaction-patterns/surfaces#Form]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #25.

## Comments

- 2026-05-26 — Closed via PR for `afk/wfr-25`. Introduced `SetupScreen.FieldError` + `FieldErrorField` (`.name` / `.distance` / `.crossField`) and a pure substring classifier `classifyPersistFailure(_:)` that routes raw error messages to the field bucket. The `Phase` enum's `.error(String)` payload now carries the routed `FieldError` so the view body has a single branch point — `.name` errors render under the name input, `.distance` errors render under the C-21 slider, `.crossField` (the historical fallback for network / RLS / unknown failures) keeps the top-of-dock slot. Treatment uses an SF Symbol `exclamationmark.triangle.fill` in the brand `sun` token paired with `TextOnGradient.primary` body copy — icon + text + color per `patterns.md` §"Error Messages" ("not color alone"), no new design tokens introduced. Surface doc gained a new §"Error placement (wfr-25)" listing the routing rule + canonical copy. The view stack added a non-color-alone accessibility identifier per bucket (`setup.name.error`, `setup.distance.error`, `setup.error`). Render-only tests pin the field-local + top-of-dock placement via an internal `injectingError(_:)` seam that constructs a SetupScreen with the phase pre-set; the seam piggybacks on the existing init via a new `initialPhase:` parameter (default `.ready`) so production callers don't need to know it exists.
