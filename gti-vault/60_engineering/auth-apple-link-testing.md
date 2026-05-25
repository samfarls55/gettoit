---
title: Apple Sign-in link testing — what CI catches, what TestFlight catches
type: engineering-note
created: 2026-05-13
related:
  - "[[adr/0007-auth-anonymous-default-apple-upgrade]]"
  - "[[../15_issues/0.1.0/issues/tb-12-apple-signin-upgrade]]"
  - "[[../15_issues/0.1.0/issues/tb-17-testflight-cohort]]"
  - "[[apple-keys-setup]]"
---

# Apple Sign-in link testing — what CI catches, what TestFlight catches

TB-12 ships the Apple Sign-in upgrade chip on S04 Waiting. The full acceptance — "an anonymous user upgrades, lands on a second iOS device, and sees their prior `user_id`'s history" — splits across two test surfaces because **CI cannot mint a real Apple identity token**.

## What `xcodebuild test` on macOS-14 CI catches

Coverage that runs on every PR via `.github/workflows/ci.yml`:

| Concern | Test | What's exercised |
|---|---|---|
| State-machine contract | `AuthCoordinatorLinkAppleTests` | Success path returns the SAME `user_id`. Failure restores `.anonymous`. `notSignedIn` rejected. `userIDChanged` defended. No-op for already-linked. |
| Suppression-window math | `AuthChipRenderGateTests.testSuppressionWindowIsExactly30Days` | The 30-day constant is locked at the value the PRD demands. |
| Dismiss persistence + 30-day suppression | `AuthPromptStoreIntegrationTests` | Real Postgres + RLS. Fresh user → no row. Dismiss → row exists. Day 1–29 → suppressed. Day 30+ → re-prompt. Re-dismiss restarts the clock. |
| RLS isolation | `AuthPromptStoreIntegrationTests.testRLSHidesOneUsersDismissalFromAnother` | User B cannot read user A's `user_preferences` row. |
| Chip render gate | `AuthChipRenderGateTests` | `isAnonymous` flag is correct for all 6 coordinator states; `userID` accessor surfaces the active id for the 3 cases that carry one. |
| Web fallback exclusion | `AuthChipRenderGateTests.testChipCodePathIsIosOnly` | The chip's source files (`AuthUpgradeChip.swift`, `WaitingScreen.swift`) only compile on iOS — verified by `#if os(iOS)`. The web fallback at `web/` never imports them. |
| Compile-time wiring | `xcodebuild test` build phase | The new `SupabaseAuthLinker` protocol + `LiveSupabaseAuthLinker` resolve against supabase-swift v2's `linkIdentityWithIdToken(credentials:)` API. |

## What TestFlight (TB-17) catches

These are real-world checks that require a sandbox Apple ID and a signed build:

| Concern | Verified how |
|---|---|
| Apple sheet renders the warm-friend copy | Founder + 2-3 cohort-1 members test on real devices. The chip should NOT read `"Sign in with Apple"` — the locked copy is `"Save this taste profile"`. |
| `ASAuthorizationController` round-trips a valid `identityToken` | Tap the chip, complete the Apple flow, observe the chip flip to the `"Saved."` state. |
| Supabase server accepts the idToken with the existing session JWT | If the bearer header is misconfigured (e.g. supabase-swift regresses on `linkIdentityWithIdToken`), the call returns HTTP 401. Caught by manual run; if observed, bump supabase-swift. |
| `user_id` survives the merge | Before tapping the chip, note the anonymous `user_id` (visible in the JoinScreen debug label). After tapping, query `select id from auth.users where id = ...` — same id, but now `is_anonymous = false`. |
| `votes`, `members`, `events` rows survive | Vote in a room as anonymous, link Apple, query `select count(*) from votes where user_id = <id>` — non-zero. |
| Cross-device login | Install GetToIt on a second iOS device. Sign in with the same Apple ID. Open the prior room link — the session resumes against the same `user_id`, history visible. |
| 30-day re-prompt suppression in production | After tapping "Maybe later" in TestFlight, fast-forward the device clock 31 days (or wait), reopen — chip re-appears. |

## Why we can't CI-test the Apple round-trip

`xcodebuild test` runs on macOS-14 GitHub runners. To exercise the real Apple sheet you'd need:

1. **A signed simulator build** — requires `DEVELOPMENT_TEAM` + signing identity. Our project sets `CODE_SIGNING_ALLOWED=NO` for the test target because the runner can't provision app IDs without manual keychain setup. TestFlight builds are signed; the test target isn't.
2. **A sandbox Apple ID** — Apple's sandbox identities exist for App Store / IAP, not Sign in with Apple. There's no programmatic way to mint a real `identityToken` against Apple's JWKS for CI.
3. **A bypass on Apple's side** — none exists. The whole point of Sign in with Apple is that only Apple mints the token.

The path forward when supabase-swift or our auth code regresses:

- If the regression is in our state machine → caught by `AuthCoordinatorLinkAppleTests`.
- If the regression is in the SQL or RLS → caught by `AuthPromptStoreIntegrationTests`.
- If the regression is in `linkIdentityWithIdToken` itself → invisible to CI. Caught on the next TestFlight run.

## What to do if a TestFlight check fails

1. Capture the failing scenario in a runbook step here (so the next founder hits it later, not first).
2. If the failure is reproducible without Apple — e.g. wrong header on the supabase call — write a CI test that exercises the wrong-shape request and assert the supabase-swift method behaves correctly.
3. If the failure requires Apple — note it in this doc with date + device + observed behavior + workaround. Treat the runbook as the live registry of "things we've seen in the wild that CI can never catch."

## Pointers

- ADR 0007 — the upgrade flow's product justification.
- TB-12 acceptance — the chip + merge invariant.
- TB-17 — TestFlight rollout where the Apple round-trip is first exercised end-to-end.
- `apple-keys-setup.md` §"Key 2" — the SiwA key wiring Supabase uses on the server side.
