---
issue: sg-WF-7
title: Web invitee account claim â€” cross-context identity bridge
status: done
type: HITL
feature: 0.1.0
github_issue: 191
created: 2026-05-21
grilled: 2026-05-21
closed: 2026-05-22
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# sg-WF-7 â€” Web invitee account claim

## Parent

[[../../../50_product/0.1.0-workflow-overhaul-web-invitee-flow|0.1.0-workflow-overhaul-web-invitee-flow]] Â§Q8 â€” the app-installed branch. The web invitee grill identified this gap as real and directed it be filed as its own buildable issue rather than folded into the sg-WF-5 shell. Related: [[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]] (`linkApple` anonymous-upgrade) and [[../../../CONTEXT|CONTEXT.md]] â†’ Plan member.

## The gap

A web invitee votes in the browser, then **installs the iOS app and signs in with Apple**. Sign-in with Apple mints a **fresh Apple `user_id`** with no relation to the web anonymous `user_id` held in the browser's `localStorage`. Consequences:

- The in-flight Plan does not appear on the new Account member's Plan list.
- Re-entering the Plan would force a re-vote â€” the browser vote is **stranded** (a member row keyed to the old anonymous `user_id`).

This is the one web-invitee scenario the sg-WF-5 grill could not close by construction â€” the others all resolve through the per-room anonymous-session model. This one needs a cross-context identity bridge.

## Desired end-state

When a web invitee installs the app and signs in, the **web anonymous identity is linked into the Apple Account** â€” `user_id` preserved, every row keyed off it (members, votes, `quiz_progress`) carried along, **zero row migration**. This is exactly the [[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]] `linkApple` model. Once linked:

- The open Plan appears on the user's Plan list (a `Joined` card).
- Subsequent link taps follow the normal Account-member workflow.

Most of that end-state is **already built** â€” tb-WF-7 landed `joined_plans_for_user` + resume-from-state. The thing this issue must design and build is the bridge, not the destination.

## The hard core â€” what the grill must resolve

`linkApple` upgrades an anonymous session **only when that anonymous session is already in the app keychain**. Here it is not â€” it lives in the **browser's `localStorage`**, a separate storage context the freshly-installed app cannot read. The bridge channel that carries the anonymous identity from browser to app keychain is an open design space:

- **Claim code.** A short code shown on the web Waiting screen; the user types it into the app, which redeems it for the anonymous session.
- **Clipboard-based deferred deep link.** The web app writes a token to the clipboard; the app reads it on first launch.
- **Third-party deferred-deep-link SDK.** A dependency that solves deferred deep links off-the-shelf â€” a dependency decision in its own right.

Each has real tradeoffs (friction, reliability, privacy posture, a new dependency). Picking one is a `/grill-with-docs`-sized decision.

## Grill outcome (2026-05-21)

Resolved in a `/grill-with-docs` round. Full decisions:
[[../../../50_product/0.1.0-workflow-overhaul-web-invitee-account-claim|0.1.0-workflow-overhaul-web-invitee-account-claim]];
architecture in [[../../../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]].

- **Channel â€” claim code.** The web fallback mints a short, single-use,
  short-TTL claim code carrying the anonymous session key; the user
  enters it on S00a *before* the Sign-in-with-Apple tap, which then
  becomes `linkApple`. Clipboard, deferred-deep-link SDK, and a
  Universal Link round-trip were all rejected â€” the deciding lens is
  the `linkApple` ordering constraint (the anonymous session must be in
  the keychain before Apple sign-in).
- **Scope â€” same-device, before-sign-in, per-person.** Browser and app
  on one phone; the claim completes on S00a only; one code carries the
  whole identity (every web Plan that identity voted in).
- **Surfacing.** Low-key "Getting the app?" mint affordance on the web
  Waiting screen *and* the read-only verdict card (lazy mint on tap);
  a secondary "Voted on the web?" code-entry on S00a with teaching
  copy honest about the ~30-day anonymous-identity TTL.
- **Failure boundary.** Skip the code â†’ web data strands; only recovery
  is delete-and-reinstall within the 30-day window. All after-sign-in
  recovery (empty + populated Apple account) is **deferred to a future
  feature**.

The destination is already built â€” S00a's `SignInScreen` already routes
an in-keychain anonymous session through `linkApple`. The build is the
transport only: a `claim_codes` table + migration, two edge functions
(mint / redeem), an S00a design-system amendment, and web affordances
on Waiting + the read-only verdict card.

**Next step:** decompose via `/to-issues` along the established sg â†’ tb
pairing (the build spans a design-system amendment + schema + edge
functions + web/iOS wiring â€” larger than one AFK slice). The web-side
build slice is sequenced after tb-WF-11 / tb-WF-12 (which build the web
Waiting screen + read-only verdict card the mint affordance attaches
to).

## Things already locked (do NOT re-grill)

- The end-state is `linkApple`-style: preserve `user_id`, zero row migration ([[../../../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]).
- After the link, the Plan surfaces on the Plan list and behaves as a normal `Joined` Plan â€” the destination is built (tb-WF-7).
- Web invitee identity itself is the anonymous Supabase session in `localStorage` ([[../../../50_product/0.1.0-workflow-overhaul-web-invitee-flow|web-invitee-flow]] Â§Q3) â€” not in question here.

## Acceptance criteria (after grill)

- [x] A `/grill-with-docs` round picks the bridge channel and records the decision â€” claim code; recorded in [[../../../50_product/0.1.0-workflow-overhaul-web-invitee-account-claim|0.1.0-workflow-overhaul-web-invitee-account-claim]] + [[../../../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]] (2026-05-21).
- [ ] This issue is decomposed via `/to-issues` into a sg â†’ tb pair (build is larger than one AFK slice) â€” the grilled outcomes are inlined above.
- [ ] After decomposition: the bridge is implemented end-to-end â€” a web invitee who installs the app and claims keeps their `user_id`, their vote is not stranded, and the Plan appears on their list.

## Blocked by

Grill complete (2026-05-21). Next: `/to-issues` decomposition. The web-side build slice is further sequenced after tb-WF-11 / tb-WF-12.

## Comments

### Triage 2026-05-22 â€” closed (done, decomposed)

> *This was generated by AI during triage.*

Closed during a `/triage` pass that flagged it as a stale-open issue. sg-WF-7
was the parent account-claim spec-gap: it was grilled 2026-05-21
(`/grill-with-docs` â€” claim-code bridge,
[[../../../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]] +
[[../../../50_product/0.1.0-workflow-overhaul-web-invitee-account-claim|decision doc]])
and decomposed via `/to-issues` into the build slices sg-WF-8 (#194),
tb-WF-13 (#195), and tb-WF-14 (#196) â€” all three merged 2026-05-21. With the
grill recorded and every child slice landed, the parent has nothing left to
action. Status `needs-triage` â†’ `done`.
