---
issue: tb-WF-14
title: Claim code redeem side — redeem edge function + S00a code entry + linkApple
status: ready-for-agent
type: AFK
feature: workflow-overhaul
github_issue: 196
created: 2026-05-21
---

# TB-WF-14 — Claim code redeem side

## Parent

[[sg-wf-7-web-invitee-account-claim|sg-WF-7]] (#191) — Web invitee account claim. Grilled decisions: [[../../../50_product/workflow-overhaul-web-invitee-account-claim|workflow-overhaul-web-invitee-account-claim]]; architecture: [[../../../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]].

## What to build

The **redeem half** of the claim-code bridge, end-to-end: a web invitee installs the app, enters a claim code on S00a **before** signing in with Apple, and the redeemed anonymous session lands in the app keychain — so the existing S00a `linkApple` path upgrades that identity (preserving `user_id`, zero row migration) when they tap Sign in with Apple.

- **`redeem-claim-code` edge function.** Takes a code, rate-limited against guessing. Looks it up in `claim_codes`, rejects if expired or already redeemed, burns it single-use, and returns the session for the carried anonymous identity.
- **iOS S00a wiring.** The "Voted on the web?" entry + code field (per the sg-WF-8 spec). On submit: call `redeem-claim-code`, install the returned session into the keychain so `AuthCoordinator` reaches its `.anonymous` state, and let S00a re-render. The subsequent Sign-in-with-Apple tap then runs `linkApple` — the existing, unchanged path — preserving the `user_id`.
- **Failure handling.** A bad / expired / already-used / mistyped code surfaces a visible, retryable error. A redeem that succeeds followed by an Apple sign-in that fails leaves the anonymous session safely in the keychain for retry.

The end-to-end win: a web invitee who installs the app and claims keeps their `user_id`, their web vote is not stranded, and the Plan appears on their Plan list as a `Joined` card. The Apple round-trip itself is verified in TestFlight, not CI (the established iOS-auth model — CI cannot mint a real Apple identity token).

## Acceptance criteria

- [ ] `redeem-claim-code` redeems a valid code once (single-use burn), rejects expired / redeemed / unknown codes, and is rate-limited.
- [ ] S00a renders the "Voted on the web?" entry + code field per the sg-WF-8 spec.
- [ ] Submitting a valid code installs the anonymous session in the keychain; `AuthCoordinator` reaches `.anonymous` and the Apple tap routes through `linkApple`, preserving the `user_id`.
- [ ] A bad / expired / used / mistyped code shows a visible, retryable error; nothing is destroyed.
- [ ] Edge-function tests cover redeem success, double-redeem rejection, expiry rejection, and rate-limiting.
- [ ] iOS tests cover the redeem → keychain → `.anonymous` transition and the error path (the `linkApple` state-machine contract is already covered; the Apple round-trip is TestFlight-verified).

## Blocked by

- [[sg-wf-8-account-claim-design-system|sg-WF-8]] (#194) — the S00a design-system spec.
- [[tb-wf-13-claim-code-mint|tb-WF-13]] (#195) — the `claim_codes` table + a real minted code to redeem.
