---
issue: tb-WF-13
title: Claim code mint side — claim_codes table + mint edge function + web affordance
status: ready-for-agent
type: AFK
feature: workflow-overhaul
github_issue: 195
created: 2026-05-21
---

# TB-WF-13 — Claim code mint side

## Parent

[[sg-wf-7-web-invitee-account-claim|sg-WF-7]] (#191) — Web invitee account claim. Grilled decisions: [[../../../50_product/workflow-overhaul-web-invitee-account-claim|workflow-overhaul-web-invitee-account-claim]]; architecture: [[../../../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]].

## What to build

The **mint half** of the claim-code bridge, end-to-end: a web invitee taps the "Getting the app?" affordance and a single-use claim code is generated and shown. The code carries the web invitee's whole anonymous identity (per-person scope), so it can later be redeemed into a freshly-installed app by tb-WF-14.

- **`claim_codes` table + migration.** Maps a code to the web session it carries: the code itself, the **encrypted refresh token** of the web anonymous session, an expiry (~30 min from mint), and a single-use redeemed-at marker. RLS locked so only the service-role (the edge functions) can read or write it — no client touches this table directly.
- **`mint-claim-code` edge function.** Authed by the caller's live web session JWT. Generates a single-use code — **8 characters from an unambiguous alphabet** (no `O/0`, `I/1/l`) — stashes the session's encrypted refresh token against it with a ~30-min TTL, and returns the code. Re-mintable: a fresh call yields a fresh code.
- **Web wiring.** The low-key "Getting the app?" affordance (per the sg-WF-8 spec) on the Waiting screen and the read-only verdict card. **Lazy mint** — the code is generated on tap, not eagerly. On tap, call `mint-claim-code` and render the returned code + instructions.

The code carries the whole identity, not one Plan — one redemption later brings over every web Plan that anonymous identity voted in.

## Acceptance criteria

- [ ] `claim_codes` table migration applies cleanly; RLS permits only service-role access.
- [ ] `mint-claim-code` mints a single-use, ~30-min-TTL, 8-char unambiguous code from the caller's live web session and stores the encrypted refresh token.
- [ ] The "Getting the app?" affordance appears on the web Waiting screen and read-only verdict card per the sg-WF-8 spec; it is absent from the quiz chrome and from the terminal "closed" screen.
- [ ] Tapping the affordance lazily mints a code and displays it with instructions; tapping again yields a fresh code.
- [ ] Edge-function tests cover mint success, the unauthed-caller rejection, and code uniqueness.
- [ ] Web tests cover the affordance render + the lazy-mint call.

## Blocked by

- [[sg-wf-8-account-claim-design-system|sg-WF-8]] (#194) — the web mint-affordance design-system spec.
- [[tb-wf-12-web-invitee-shell-reclick|tb-WF-12]] (#193) — builds the v1.1 web Waiting screen + read-only verdict card the affordance attaches to.
