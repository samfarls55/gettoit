---
adr: 0015
title: Web invitee account-claim bridge — a claim code carries the anonymous session into the app
status: accepted
date: 2026-05-21
supersedes: null
superseded_by: null
---

# 0015 — Web invitee account-claim bridge

## Status

Accepted — 2026-05-21. Decided in the `/grill-with-docs` session on
[[../../15_issues/workflow-overhaul/issues/sg-wf-7-web-invitee-account-claim|sg-WF-7]]
(#191). Sibling to the web invitee single-link grill
([[../../50_product/workflow-overhaul-web-invitee-flow|workflow-overhaul-web-invitee-flow]]
§Q8, which filed this gap). Full grilled outcomes:
[[../../50_product/workflow-overhaul-web-invitee-account-claim|workflow-overhaul-web-invitee-account-claim]].

## Context

A [[../../CONTEXT|Web invitee]] votes in the browser, then installs
the iOS app and signs in with Apple. Sign in with Apple mints a
**fresh Apple `user_id`** with no relation to the web **Anonymous
session** held in the browser's `localStorage`. The in-flight Plan
never appears on the new account's Plan list, and re-entering it would
force a re-vote — the browser vote is **stranded**. This is the one
web-invitee scenario the sg-WF-5 grill could not close by
construction.

The desired end-state is locked: it is the [[0007-auth-anonymous-default-apple-upgrade|ADR 0007]]
`linkApple` model — attach the Apple identity to the **existing**
anonymous user, `user_id` preserved, **zero row migration**. The
destination is already built — `RootView.shouldRenderSignInGate`
fires on `.anonymous` as well as `.idle`, and S00a's `SignInScreen`
already routes the Apple tap through `linkApple` (not
`signInWithApple`) whenever the keychain holds an anonymous session.

The unsolved problem is purely one of **transport**, and it carries a
hard ordering constraint:

- `linkApple` upgrades an anonymous session **only when that session
  is in the app keychain**. The web invitee's anonymous session lives
  in the **browser's `localStorage`** — a storage context the
  freshly-installed app cannot read.
- `linkApple` can only attach Apple to a *currently anonymous* user.
  The moment the user completes Apple sign-in on a fresh install, the
  keychain holds a brand-new Linked-Apple `user_id`; joining the web
  user from that point on would require a true two-user merge.

**Therefore the anonymous session must reach the app keychain *before*
the user taps Sign in with Apple.** Every channel candidate has to be
judged against that constraint first.

## Decision

**Bridge the identity with a claim code.**

- The web fallback mints a short, single-use, short-TTL **claim code**
  that carries the web invitee's anonymous session key. The code is
  minted **lazily** — only when the user taps a low-key "Getting the
  app?" affordance — and is shown on the **Waiting screen** and the
  **read-only verdict card**.
- The freshly-installed app collects the code on **S00a**, via a
  secondary "Voted on the web?" entry beneath the Sign-in-with-Apple
  button. Redeeming it installs the anonymous session into the
  keychain; S00a then re-renders into its `.anonymous` state and the
  Apple tap becomes `linkApple` — the existing path, unchanged.
- The code carries the **whole anonymous identity**, not one Plan
  (per-person scope) — one redemption brings over every web Plan that
  identity voted in.

Scope deliberately bounded:

- **Same-device only** — browser and app on one phone. Mirrors the
  web-invitee grill's Q3 "cross-device resume is impossible by
  construction."
- **Before-sign-in only** — the claim must complete on S00a before the
  Apple tap. There is no in-app, post-sign-in claim path. All
  after-sign-in recovery (empty *or* populated Apple account) is
  **deferred to a future feature** (see Considered options §4 and
  Re-evaluation triggers).

The carrier mechanism: a `claim_codes` table maps the code to the web
session's refresh token (encrypted at rest, short TTL, single-use);
two edge functions mint (authed by the live web session) and redeem
(protected by the unguessable code + rate limiting).

## Why

1. **The ordering constraint is the deciding lens.** A claim code
   entered on S00a makes the *only correct order* the *default* order:
   code entry and the Apple button live on one screen, and the code
   must be entered first for the Apple tap to become `linkApple`. The
   wrong order (Apple-first) becomes the harder path, not the easy
   one.
2. **It reuses `linkApple` untouched.** The bridge's only new work is
   transport. Once the anonymous session is in the keychain, the user
   is indistinguishable from a pre-v1.1 legacy-carryover anonymous
   install, which S00a already handles.
3. **No new dependency, no privacy footgun.** No third-party SDK, no
   clipboard read (and its iOS paste banner), no capability token in a
   URL.
4. **Failure is visible.** A bad/expired/mistyped code produces an
   explicit error the user can act on ("generate a fresh one"), rather
   than a silent loss.
5. **Reliability beats friction for a rare, one-time, high-value
   event.** A web invitee converts to an app install once. Typing ~8
   characters once is a fair price for a channel that works regardless
   of install delay, browser-tab state, or clipboard contents.

## Considered options

1. **Clipboard-carried token.** The web app writes a token to the
   clipboard; the app reads it on first launch. Rejected — it *solves*
   the ordering constraint automatically (the token is present before
   S00a renders) but is unreliable: the App Store install takes
   minutes during which the user copies other things; iOS shows a
   "pasted from Safari" banner (a snooping-shaped disclosure, or a
   permission prompt on newer iOS); the token is stale if the user
   installs later. And it **fails silently** — no code to fall back
   on.
2. **Third-party deferred-deep-link SDK (Branch / Adjust /
   AppsFlyer).** Rejected — a heavy paid dependency for one rare flow.
   Across an install gap these SDKs fall back to either the clipboard
   (same problems as §1) or device fingerprinting, which is
   privacy-hostile and a privacy-manifest / App Review liability.
3. **Universal Link "Open in app" round-trip.** Rejected — a Universal
   Link **cannot survive an app install** (that is the definition of a
   *deferred* deep link), so the app's first launch never carries it.
   Making it work demands the *same* "act before Apple sign-in"
   discipline as a claim code, but with extra app-switching and a
   capability token in a URL — strictly worse on the same constraint.
4. **Full after-the-fact account merge.** Rejected for this issue
   (deferred, not refused forever). Once a Linked-Apple session
   exists, bringing the web identity in is a true two-user merge.
   T-shirt size **L** — not for code volume but because it is the only
   path that can *destroy data*: it requires re-keying every
   user-FK'd table, an unresolved conflict policy for the case where
   the user is both a web member and an app member of the same room,
   live-room hazards, and an irreversible-migration test burden.
   Pre-public-launch, with zero real users, building an irreversible
   merge engine for the rare "used the app for weeks, *then*
   remembered" case is premature. Filed as a future feature.

## Consequences

### Positive

- Closes the last open web-invitee scenario from the sg-WF-5 grill.
- Reuses the existing S00a `linkApple` path — no new linking code, no
  new auth state.
- No third-party dependency; no clipboard/fingerprinting privacy
  surface.

### Negative / accepted tradeoffs

- **Typing friction.** The user manually enters ~8 characters once.
  Accepted as the price of reliability for a one-time event.
- **The server briefly holds a refresh token.** There is no Supabase
  primitive to mint a session for an arbitrary anonymous user, so the
  code must carry the session key itself; the `claim_codes` row holds
  it encrypted, single-use, short-TTL. Low stakes — the protected
  asset is an anonymous web invitee's vote in one dinner Plan.
- **New surface area.** A `claim_codes` table + migration, two edge
  functions, an S00a design-system amendment (the "Voted on the web?"
  affordance), and web affordances on Waiting + the read-only verdict
  card.
- **Skip = stranded.** A user who signs in with Apple without claiming
  first permanently strands that web data; the only recovery is
  delete-and-reinstall (which returns them to a fresh S00a), within
  the 30-day anonymous-identity TTL ([[0006-privacy-posture-v1|ADR 0006]]).
  This is not new harm — it is exactly today's ADR 0007 behavior
  ("web users can't claim — flagged").
- **The recovery promise has a 30-day ceiling.** Beyond the anonymous
  TTL the web identity is purged; app-side copy must not over-promise.

## Re-evaluation triggers

- **After-sign-in claim demand appears** — recovery requests from
  users who already completed Apple sign-in exceed a manageable
  trickle. First build the empty-Apple-account path (delete the empty
  husk, then claim + `linkApple` — T-shirt **S**, pure composition of
  existing parts); the populated-account merge (option §4) only if
  demand persists past that.
- **A reliable OS-level deferred-deep-link primitive emerges** that
  removes the ordering discipline without a fingerprinting or
  clipboard cost — revisit whether the manual code can be dropped.
- **The bridge is requested cross-device** — out of scope here by the
  same reasoning as the web-invitee grill's Q3.

## References

- [[../../50_product/workflow-overhaul-web-invitee-account-claim|workflow-overhaul-web-invitee-account-claim]]
  — the full grilled decision doc this ADR records.
- [[../../50_product/workflow-overhaul-web-invitee-flow|workflow-overhaul-web-invitee-flow]]
  §Q8 — the sibling grill that filed this gap.
- [[0007-auth-anonymous-default-apple-upgrade|ADR 0007]] — the
  `linkApple` anonymous-upgrade model this bridge feeds into.
- [[0006-privacy-posture-v1|ADR 0006]] — the 30-day anonymous-identity
  TTL that bounds the recovery promise.
- [[../../15_issues/workflow-overhaul/issues/sg-wf-7-web-invitee-account-claim|sg-WF-7]]
  (#191) — the issue this grill resolves.
- [[../../CONTEXT|CONTEXT.md]] → Account claim, Claim code — canonical
  terms added by this grill.
