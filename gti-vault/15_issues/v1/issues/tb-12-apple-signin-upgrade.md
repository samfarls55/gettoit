---
issue: tb-12
title: Anonymous → Sign in with Apple upgrade chip on Waiting (S04)
status: ready-for-agent
type: AFK
created: 2026-05-12
prd: v1-prd
adr: 0007
---

# TB-12 — Apple Sign-in upgrade chip

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The non-blocking upgrade path from anonymous identity to a claimed Apple-linked identity. Surfaced as a chip on the S04 Waiting surface with copy `"Save this taste profile"` / `"Maybe later"`. On tap → Apple authentication flow → Supabase `auth.link_identity` attaches the Apple identity to the existing anonymous `user_id`. No data loss.

- **AuthCoordinator** — extend the TB-01 anon-only implementation to handle the link upgrade path. `link_apple()` triggers the Authentication Services framework Apple Sign-in flow, then calls `supabase.auth.linkIdentity({ provider: 'apple', idToken })`. On success, the existing `user_id` survives — all `votes`, `members`, `events` rows already keyed to it remain attached. On failure or user dismissal, no state changes.
- **S04 design-system spec change** — add a new chip component or chip variant for the auth-upgrade affordance. Add a `C-NN` entry in `design-system/components.md`; implement in `code/components.jsx` (or a dedicated file if motion/state warrants). Update `design-system/surfaces/04-waiting.md` to call out the placement (secondary to the primary "N of M are in" headline), hierarchy, and dismiss behavior. Update `code/screens/ScreenWaiting.jsx` to render the chip in the canonical state. Copy register: voluntary warm-friend — `"Save this taste profile"` + `"Maybe later"`. NEVER `"Sign up"` / `"Create account"` / `"Confirm"`. On success, replace chip with a quiet `"Saved."` confirmation or hide it. On dismiss, persist `auth_prompt_dismissed_at` and suppress re-prompts for 30 days. Web fallback does NOT render the chip (no Sign in with Apple in browser).
- **iOS port** — port the new chip from the design-system JSX into the SwiftUI ScreenWaiting view. Chip is secondary to the primary "N of M are in" waiting state; tap target ≥44pt.
- **30-day re-prompt suppression** — `users.auth_prompt_dismissed_at` column (or equivalent). The chip checks this on render and hides if dismissed within 30 days.
- **Web fallback** — chip is NOT rendered in the web fallback per ADR 0007 ("Web fallback voters stay anonymous indefinitely"). Web S04 shows only the primary waiting state.
- **Tests** — anonymous user upgrades to Apple-linked retains all existing rows (`votes`, `members`, `ratifications`); dismiss persists the timestamp; re-prompt is suppressed for 30 days; the linked-user can sign in on a second iOS device and see the prior `user_id`'s history.

## Acceptance criteria

- [ ] New chip component entry added to `design-system/components.md` + `code/components.jsx`.
- [ ] `design-system/surfaces/04-waiting.md` describes the chip placement, copy, and dismiss behavior.
- [ ] `code/screens/ScreenWaiting.jsx` renders the chip in canonical state.
- [ ] `node design-system/scripts/verify.mjs` passes; `design-system/CHANGELOG.md` updated.
- [ ] AuthCoordinator implements `link_apple()` with `supabase.auth.linkIdentity`.
- [ ] Anonymous-to-Apple merge preserves the `user_id` and all related rows.
- [ ] S04 SwiftUI view renders the chip with the canonical states (default, in-progress, success, dismissed).
- [ ] Dismiss persists `auth_prompt_dismissed_at`; re-prompt suppressed for 30 days.
- [ ] Web S04 does not render the chip.
- [ ] Integration tests for merge correctness, dismissal persistence, re-prompt suppression, cross-device login.

## Blocked by

- [[tb-02-room-create-deeplink-join|TB-02]]
