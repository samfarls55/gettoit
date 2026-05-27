---
issue: bug-41
title: Additional user settings on SettingsScreen
status: needs-triage
type: HITL
github_issue: 313
created: 2026-05-26
grilled: null
---

# bug-41 — Additional user settings (HITL placeholder)

## Symptom

Current `SettingsScreen` is minimal. Founder wants more settings surfaced before v1 — exact set TBD. Candidates likely include profile edit, notification toggles, default location/radius preferences, account/sign-out controls, support link. Concrete list is founder-driven.

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

- `ios/Sources/App/SettingsScreen.swift` — current settings host
- `design-system/surfaces/settings.md` (if present) — surface contract
- `supabase/migrations/` — for any new user-pref columns/tables

## References

- [[project_pre_public_launch_milestone]] (memory)
- [[wfr-06-settingsscreen-entry-from-planlist]] — recently shipped Settings entry from PlanList
- [[wfr-07-settingsscreen-demote-delete-pill]] — recent Settings shape change
