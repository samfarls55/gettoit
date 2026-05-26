---
issue: wfr-07
title: Demote SettingsScreen DELETE pill to destructive style
status: done
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 248
---

# wfr-07 — SettingsScreen destructive DELETE button visually dominates DONE

## What to build

Restyle DELETE MY DATA from white-pill primary (SettingsScreen.swift:127-129) to destructive style (red outline or text-only). Promote DONE to primary pill. Keep existing two-step confirm alert.

## Acceptance criteria

- [ ] DELETE renders in destructive style per `design-system/components.md`.
- [ ] DONE is the visually dominant primary.
- [ ] Snapshot test on SettingsScreen render covers new hierarchy.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Settings Editor]]
- [[../../30_design/interaction-patterns/principles#V-01. Visual hierarchy]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #7.

## Comments

- 2026-05-26 (AFK): DONE promoted to C-05 white PillCTA; DELETE MY DATA demoted to C-05 ghost (transparent fill, 1.5pt white-0.5 stroke). No red anywhere — `tokens.md §1.3` no-red contract preserved; destructive weight lives in outline + copy + native two-step confirm alert. Surface spec `surfaces/09-settings.md` and JSX `code/screens/ScreenSettings.jsx` updated; iOS contract pinned via `SettingsScreen.Style` static constants. `node design-system/scripts/verify.mjs` clean. Closed by PR #275.
