---
issue: tb-WF-14
title: Claim code redeem side â€” redeem edge function + S00a code entry + linkApple
status: done
type: AFK
feature: 0.1.0
github_issue: 196
created: 2026-05-21
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# TB-WF-14 â€” Claim code redeem side

## Parent

[[sg-wf-7-web-invitee-account-claim|sg-WF-7]] (#191) â€” Web invitee account claim. Grilled decisions: [[../../../50_product/0.1.0-workflow-overhaul-web-invitee-account-claim|0.1.0-workflow-overhaul-web-invitee-account-claim]]; architecture: [[../../../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]].

## What to build

The **redeem half** of the claim-code bridge, end-to-end: a web invitee installs the app, enters a claim code on S00a **before** signing in with Apple, and the redeemed anonymous session lands in the app keychain â€” so the existing S00a `linkApple` path upgrades that identity (preserving `user_id`, zero row migration) when they tap Sign in with Apple.

- **`redeem-claim-code` edge function.** Takes a code, rate-limited against guessing. Looks it up in `claim_codes`, rejects if expired or already redeemed, burns it single-use, and returns the session for the carried anonymous identity.
- **iOS S00a wiring.** The "Voted on the web?" entry + code field (per the sg-WF-8 spec). On submit: call `redeem-claim-code`, install the returned session into the keychain so `AuthCoordinator` reaches its `.anonymous` state, and let S00a re-render. The subsequent Sign-in-with-Apple tap then runs `linkApple` â€” the existing, unchanged path â€” preserving the `user_id`.
- **Failure handling.** A bad / expired / already-used / mistyped code surfaces a visible, retryable error. A redeem that succeeds followed by an Apple sign-in that fails leaves the anonymous session safely in the keychain for retry.

The end-to-end win: a web invitee who installs the app and claims keeps their `user_id`, their web vote is not stranded, and the Plan appears on their Plan list as a `Joined` card. The Apple round-trip itself is verified in TestFlight, not CI (the established iOS-auth model â€” CI cannot mint a real Apple identity token).

## Acceptance criteria

- [x] `redeem-claim-code` redeems a valid code once (single-use burn), rejects expired / redeemed / unknown codes, and is rate-limited.
- [x] S00a renders the "Voted on the web?" entry + code field per the sg-WF-8 spec.
- [x] Submitting a valid code installs the anonymous session in the keychain; `AuthCoordinator` reaches `.anonymous` and the Apple tap routes through `linkApple`, preserving the `user_id`.
- [x] A bad / expired / used / mistyped code shows a visible, retryable error; nothing is destroyed.
- [x] Edge-function tests cover redeem success, double-redeem rejection, expiry rejection, and rate-limiting.
- [x] iOS tests cover the redeem â†’ keychain â†’ `.anonymous` transition and the error path (the `linkApple` state-machine contract is already covered; the Apple round-trip is TestFlight-verified).

## Blocked by

- [[tb-wf-13-claim-code-mint|tb-WF-13]] (#195) â€” the `claim_codes` table + a real minted code to redeem.

## Comments

- **2026-05-21 â€” done (PR #206).** Redeem half shipped end to end. `supabase/functions/redeem-claim-code/` â€” a pure handler (rate-limit, `claim_codes` lookup, single-use burn all dependency-injected) reusing the shared `_shared/claim-code.ts` crypto helper; rejects expired (410) / already-redeemed + concurrent-race (409) / unknown (404) / malformed (400) codes, and an in-memory sliding-window rate limiter (10 / IP / 10 min) guards against guessing. iOS â€” `ClaimCodeRedeemer` invokes the function then installs the carried session into the keychain via `auth.refreshSession(refreshToken:)`; `AuthCoordinator.redeemClaimCode` is fresh-install-gate-only and lands `.anonymous`; the S00a "Voted on the web?" affordance is pure composition of existing primitives. 32 new edge tests + iOS unit tests for the redeem state machine and the affordance. Two non-obvious calls documented in the source: the redeem function has **no caller-auth gate** (a fresh-install app has no JWT â€” the unguessable single-use short-TTL code plus rate limiting is the credential, per ADR 0015), and the rate limiter is **in-memory not DB-backed** (the structural defenses carry the weight; a global limiter is a clean future upgrade). One CI fix mid-run: the S00a affordance state was lifted into an `@Observable ClaimAffordanceModel` so it is unit-testable (SwiftUI `@State` value writes do not persist outside a render). Closes the account-claim bridge â€” its mint counterpart tb-WF-13 merged earlier the same day.
