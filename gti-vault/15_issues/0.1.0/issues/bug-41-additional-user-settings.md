---
issue: bug-41
title: Additional user settings on SettingsScreen
status: needs-triage
type: HITL
github_issue: 313
created: 2026-05-26
grilled: null
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-41 â€” Additional user settings (HITL placeholder)

## Symptom

Current `SettingsScreen` is minimal. Founder wants more settings surfaced before v1 â€” exact set TBD. Candidates likely include profile edit, notification toggles, default location/radius preferences, account/sign-out controls, support link. Concrete list is founder-driven.

## Why HITL

The set of settings is a product call. Some entries (sign-out, account deletion, support link) carry policy weight; others (notification toggles) require coordinated backend wiring. Future grill scopes the list, then per-setting build issues spawn (AFK where mechanical, HITL where copy/policy-driven).

## What this issue does NOT do pre-grill

- Pick the settings list.
- Touch `SettingsScreen` code.
- Decide persistence layer (local vs Supabase) for each toggle.

## Acceptance criteria (placeholder)

- [ ] Founder has enumerated the settings to add.
- [ ] Each setting has a defined storage backend (local prefs, Supabase row, derived).
- [ ] Each setting has confirmed copy + interaction pattern (consult `design-system/`).
- [ ] Per-setting build issues spawned.

## Code breadcrumbs

- `ios/Sources/App/SettingsScreen.swift` â€” current settings host
- `design-system/surfaces/settings.md` (if present) â€” surface contract
- `supabase/migrations/` â€” for any new user-pref columns/tables

## References

- [[project_pre_public_launch_milestone]] (memory)
- [[wfr-06-settingsscreen-entry-from-planlist]] â€” recently shipped Settings entry from PlanList
- [[wfr-07-settingsscreen-demote-delete-pill]] â€” recent Settings shape change
