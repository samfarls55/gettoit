---
issue: sg-WF-9
title: web-01-invitee-shell §C does not spec the no-survivor decided-plan case
status: needs-triage
feature: workflow-overhaul
github_issue: 215
created: 2026-05-22
---

# SG-WF-9 — web-01 §C does not spec the no-survivor verdict card

## Symptom

`design-system/surfaces/web-01-invitee-shell.md` §C ("Read-only verdict card")
specs the web invitee verdict card as **plan name + verdict venue only**. It
does not address a decided plan whose verdict is `method: no_survivor` — a
verdict row exists, the plan *is* decided, but there is no winning venue to put
in the card's venue slot.

§D ("This plan is closed") is a different case — it covers a membership that
does **not** resolve (a purged member row, or a stranger with no member row). A
no-survivor plan has a resolving membership and a real verdict; by §B's resume
routing ("Plan decided -> §C") it lands on §C, which has no no-survivor variant.

## Detail

- A `no_survivor` verdict is a legitimate, reachable outcome — the engine
  writes one whenever no candidate survives the combined constraints.
- The §C layout (wordmark -> eyebrow -> plan name -> verdict card -> auto) and
  copy register assume a venue. There is no spec for what the card says when
  there is none.
- The iOS S05 verdict surface has a no-survivor mode; §C, the web invitee's
  far-smaller analogue, was specced for the venue case only.

## Interim state (bug-17)

[[bug-17-web-verdict-surface-conformance|bug-17]] — the web verdict §C
conformance fix — ships a **minimal interim** no-survivor variant so the web
path does not regress: plan name + a "No spot fits" card in the venue slot, no
votes-derived meta line (`votes` is ephemeral and gone by decided-time). This
spec-gap is to ratify or replace that interim treatment in §C proper.

## Suggested direction (triage to confirm)

Amend `web-01-invitee-shell.md` §C with a no-survivor variant: the same minimal
register (plan name + a single card), the card's copy ("No spot fits" or a
chosen alternative), the eyebrow, and whether any body copy is warranted. Keep
it consistent with §C's "this is a read, not the full S05 Verdict surface"
posture and the locked Sunset Pop copy register. `verify.mjs` must stay green.

## Surfaced by

Flagged during the bug-17 `/grill-with-docs` session (2026-05-22, Q2) as a
design-system spec-gap follow-up.

## References

- `design-system/surfaces/web-01-invitee-shell.md` §C — the locked spec with
  the gap.
- [[bug-17-web-verdict-surface-conformance|bug-17]] — ships the interim
  no-survivor variant this spec-gap ratifies.
- [[workflow-overhaul-web-invitee-flow]] §Q6 — the decision doc behind §C.
