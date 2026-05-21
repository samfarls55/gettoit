---
issue: sg-WF-8
title: Account-claim design-system amendment — S00a + web mint affordance
status: done
type: AFK
feature: workflow-overhaul
github_issue: 194
created: 2026-05-21
---

# SG-WF-8 — Account-claim design-system amendment

## Parent

[[sg-wf-7-web-invitee-account-claim|sg-WF-7]] (#191) — Web invitee account claim. Grilled decisions: [[../../../50_product/workflow-overhaul-web-invitee-account-claim|workflow-overhaul-web-invitee-account-claim]]; architecture: [[../../../60_engineering/adr/0015-web-invitee-account-claim-bridge|ADR 0015]].

## What to build

The design-system spec amendments for the account-claim feature — both the iOS and the web side. **Spec only, no wiring.** This lands the spec the two tracer-bullets (tb-WF-13, tb-WF-14) consume, per the repo rule that a spec change lands in `design-system/` before any feature wiring.

**S00a (`design-system/surfaces/00a-signin.md`).** Amend the sign-in gate spec to add:

- A secondary "Voted on the web?" affordance beneath the Sign-in-with-Apple pill — quiet and secondary, so the common fresh-install user (never on web) ignores it without friction.
- The code-entry state it reveals: a single code input + CTA.
- Teaching copy for a user who does not yet have a code — how to generate one from any prior web link. The copy must be honest about the ~30-day anonymous-identity TTL (ADR 0006): frame it as "bring back your recent web Plans," never "recover all your history."

**Web invitee surfaces (Waiting screen + read-only verdict card).** Amend the sg-WF-5 web invitee surface doc(s) to add:

- A low-key "Getting the app?" mint affordance — a quiet line, not a banner and not a hard upsell (respects the web-invitee-flow §Q7 "plumbing, not a growth surface" lock).
- The revealed state after the tap: the displayed claim code + plain instructions pointing the user at the S00a "Voted on the web?" entry.

Matching JSX in `design-system/code/`. If the spec needs a token or component that does not exist, surface the gap — do not invent a component or inline a raw literal.

## Acceptance criteria

- [ ] `surfaces/00a-signin.md` amended: the "Voted on the web?" secondary affordance, the code-entry state, and TTL-honest teaching copy.
- [ ] The web invitee Waiting screen + read-only verdict card specs carry the low-key "Getting the app?" mint affordance and its revealed code/instructions state.
- [ ] All new UI uses design tokens — no inline hex / px / easing literals.
- [ ] Matching JSX added/updated; the surface↔jsx pairing holds.
- [ ] `node design-system/scripts/verify.mjs` is green.
- [ ] Any required new token or component is flagged, not silently added.

## Blocked by

None for the S00a amendment — can start immediately. The web-surface amendment consumes the sg-WF-5 web invitee surface doc; sequence that portion after [[sg-wf-5-web-invitee-flow|sg-WF-5]] (#158) if it has not yet landed.

## Comments

- **Done 2026-05-21** (AFK, branch `afk/sg-WF-8`). sg-WF-5 was already merged, so both halves of the amendment landed in one slice.
  - **S00a** — `surfaces/00a-signin.md` gained a `## "Voted on the web?" account-claim affordance` section: a quiet, secondary `eyebrow`-token text link beneath the Apple pill that reveals a code-entry state (TTL-honest teaching copy + a single soft-glass claim-code input reusing the web-01 §A / C-23 input pattern + a `"Bring my Plans over"` `PillCTA white` submit). `code/screens/ScreenSignIn.jsx` got the two-state JSX, driven by a `claimCodeOpen` prop the caller (tb-WF-14) owns. Motion / Accessibility / Out-of-scope sections amended to cover the new state.
  - **Web side** — `surfaces/web-01-invitee-shell.md` gained a `## "Getting the app?" mint affordance (sg-WF-8)` section: a low-key single `eyebrow`-token line on the §B web Waiting screen and the §C read-only verdict card (only those two membership-resolved surfaces). Tapping it lazily mints a claim code shown in a `Glass` `soft` card with `mono-tag` type, with instructions pointing at the S00a entry. The pre-existing §C "Spec adjacency" placeholder note was replaced by the real spec.
  - **Copy** — TTL-honest per ADR 0006: `"bring back your recent web Plans"`, never "recover all your history". S00a CTA `"Bring my Plans over"`, affordance label `"Voted on the web?"`; web label `"Getting the app?"`.
  - **No new component, no new token** — pure composition of existing primitives (`eyebrow` text link, soft-glass input, `PillCTA white`, `Glass`, `mono-tag`). `node design-system/scripts/verify.mjs` green; new structural test `scripts/test-account-claim.mjs` (44 assertions) green via a real red→green TDD cycle.
  - Wiring stays out of scope by design: the redeem side is tb-WF-14, the mint side is tb-WF-13.
