---
issue: tb-12
title: Anonymous â†’ Sign in with Apple upgrade chip on Waiting (S04)
github_issue: 13
status: done
type: AFK
created: 2026-05-12
completed: 2026-05-13
prd: 0.1.0-prd
adr: 0007
pr: 29
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-12 â€” Apple Sign-in upgrade chip

## Parent

[[../../../10_prds/0.1.0-prd|0.1.0 PRD]]

## What to build

The non-blocking upgrade path from anonymous identity to a claimed Apple-linked identity. Surfaced as a chip on the S04 Waiting surface with copy `"Save this taste profile"` / `"Maybe later"`. On tap â†’ Apple authentication flow â†’ Supabase `auth.link_identity` attaches the Apple identity to the existing anonymous `user_id`. No data loss.

- **AuthCoordinator** â€” extend the TB-01 anon-only implementation to handle the link upgrade path. `link_apple()` triggers the Authentication Services framework Apple Sign-in flow, then calls `supabase.auth.linkIdentity({ provider: 'apple', idToken })`. On success, the existing `user_id` survives â€” all `votes`, `members`, `events` rows already keyed to it remain attached. On failure or user dismissal, no state changes.
- **30-day re-prompt suppression** â€” `users.auth_prompt_dismissed_at` column (or equivalent). The chip checks this on render and hides if dismissed within 30 days.
- **Web fallback** â€” chip is NOT rendered in the web fallback per ADR 0007 ("Web fallback voters stay anonymous indefinitely"). Web S04 shows only the primary waiting state.
- **Tests** â€” anonymous user upgrades to Apple-linked retains all existing rows (`votes`, `members`, `ratifications`); dismiss persists the timestamp; re-prompt is suppressed for 30 days; the linked-user can sign in on a second iOS device and see the prior `user_id`'s history.

## Acceptance criteria

- [x] `code/screens/ScreenWaiting.jsx` renders the chip in canonical state.
- [x] AuthCoordinator implements `link_apple()` with `supabase.auth.linkIdentity`.
- [x] Anonymous-to-Apple merge preserves the `user_id` and all related rows.
- [x] S04 SwiftUI view renders the chip with the canonical states (default, in-progress, success, dismissed).
- [x] Dismiss persists `auth_prompt_dismissed_at`; re-prompt suppressed for 30 days.
- [x] Web S04 does not render the chip.
- [x] Integration tests for merge correctness, dismissal persistence, re-prompt suppression, cross-device login.

## Blocked by

- [[tb-02-room-create-deeplink-join|TB-02]]

## Adjacencies

Surfaced while implementing TB-12; **not** silently fixed â€” flagged for triage.

- **Cross-device login + Apple-token round-trip cannot be CI-tested.** The native Apple Sign-in flow requires either a real Apple ID auth or an idToken minted against Apple's sandbox JWKS. Neither is feasible inside `xcodebuild test` on a macOS-14 GitHub runner â€” no signed simulator identity, no sandbox key. The state-machine contract is covered by `AuthCoordinatorLinkAppleTests`; the actual merge ("sign in on device 2, see device 1's history") is verified manually in TestFlight per TB-17. Documented in [[../../../60_engineering/auth-apple-link-testing|auth-apple-link-testing.md]].
- **Five states, three views in the SwiftUI port.** `default` / `in-progress` render the same pill (disabled flag flips); `success` is a separate `Text`; `dismissed` / `hidden` both render `EmptyView`. The ticket asked for "canonical states (default, in-progress, success, dismissed)" â€” collapsing `dismissed`/`hidden` to the same render is correct: the visual result is identical, only the upstream reason differs. The Swift enum keeps both cases so the caller can log which path the gate took.
- **`auth_prompt_dismissed_at` is never wiped.** When a user dismisses and re-prompts past 30 days, the timestamp is simply overwritten on the next dismiss. We never null it out. This is intentional â€” the column carries forensic value (when did the user last dismiss?), and the gate logic is age-based, not presence-based. Documented in the migration's column comment.
- **Successful link doesn't touch the dismissal stamp.** After a successful Apple link the user is no longer anonymous; the chip's render gate checks `auth.state.isAnonymous` first and renders `hidden` regardless of the dismissal stamp. The leftover timestamp is harmless.
- **C-22 is component number 22, not 21.** The ticket suggested `C-21` but C-21 is already the Range Slider (landed in spec-gap 01, TB-03 prep). Promoted to C-22; everything cross-referenced accordingly.
- **`SignInWithAppleButton` system primitive was deliberately rejected.** It locks the label and visual to Apple's strings (`"Sign in with Apple"` / `"Continue with Apple"`), which violates the warm-friend copy register. Apple's HIG explicitly permits custom buttons that trigger the same `ASAuthorizationController` request. Documented in the C-22 spec.
- **`linkIdentityWithIdToken` vs `signInWithIdToken`.** supabase-swift exposes both. We use `linkIdentityWithIdToken` for the chip's flow â€” it explicitly attaches the identity to the **current** session's user, where `signInWithIdToken` could mint a fresh user if the bearer header is missing. The distinction matters for the merge-correctness invariant.
- **`linking` state added to `AuthCoordinator.State`.** TB-01's State enum had four cases (`.idle`, `.signingIn`, `.anonymous`, `.error`); TB-12 adds two more (`.linking`, `.linkedApple`). The chip's render gate uses `.isAnonymous` to know when to render â€” the new gate-helper covers the new cases cleanly.

## Comments

### 2026-05-13 â€” final CI green, merged

Two bugs caught only by the integration tests, fixed in the second agent pass:

1. **`AuthCoordinator.linkApple` drift detection.** The `.error` state set inside the `do` block was being overwritten by the outer `catch` clause (because `throw LinkError.userIDChanged(...)` re-entered the `catch`, which reset state to `.anonymous`). Refactored to detect drift OUTSIDE the do/catch so the `.error` transition survives the throw.
2. **`AuthPromptStore` timestamp parsing.** A single `ISO8601DateFormatter` configured with `.withFractionalSeconds` cannot parse PostgREST's `timestamptz` responses across all three shapes (no fraction / millisecond / 6-digit microsecond). The integration tests round-tripped `Date(timeIntervalSinceReferenceDate: 800_000_000)` and got `nil` back because the parser rejected the microsecond-precision response Postgres emits by default. Replaced with a 3-attempt parser: fractional â†’ plain â†’ truncate-to-ms-then-fractional. The whole thing is documented at the call site so the next codebase reader doesn't repeat the trap.

`gti-vault/60_engineering/stack-patterns.md` could be updated with the timestamp-parsing pattern â€” flagging as adjacency rather than in-scope here.

Merged via PR #29 (squash) at 2026-05-14T06:21Z, commit `c401819`.
