---
issue: sg-WF-5
status: done
type: AFK
feature: 0.1.0
github_issue: 158
created: 2026-05-19
grilled: 2026-05-21
---


## Parent

[[../../../50_product/0.1.0-workflow-overhaul-web-invitee-flow|0.1.0-workflow-overhaul-web-invitee-flow]] — the decision doc, locked outcomes of the `/grill-with-docs` session on 2026-05-21. Parent-of-parent: [[../../../50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]] §Q6 (the Web invitee subtype itself).

## Grill resolved + decomposed

The follow-up `/grill-with-docs` round (2026-05-21) locked all eight design questions. Post-grill the work was bigger than one clean AFK slice, so it was decomposed via `/to-issues`:

- **tb-WF-11** — tracer-bullet: the shell foundation (the `/join/<roomId>` scaffold, first-landing name entry, the `members.display_name` migration).
- **tb-WF-12** — tracer-bullet: the re-click behaviors (resume, read-only verdict card, leave).
- **tb-WF-10** (#190) — sibling tracer-bullet: the 0.1.0 web quiz port + `votes-wire.ts`. Delivery pair with the shell.
- **sg-WF-7** (#191) — sibling HITL: the app-installed account-claim gap.

## What to build



### Surfaces / states the doc must spec

- **First-landing name entry (§Q4)** — single text input + one CTA. 30-char cap, placeholder `Your name`, CTA disabled until trimmed-non-empty. No plan summary.
- **Resume routing (§Q5)** — re-click lands the invitee at their current state: quiz at last-answered question, Waiting, or Verdict.
- **Read-only verdict card (§Q6)** — Plan name + verdict venue only, for a decided Plan when membership resolves.
- **"This plan is closed" terminal (§Q6)** — for a re-click whose membership does not resolve (anon-TTL purge / forwarded-link stranger).

All five render the Sunset Pop tokens and stay consistent with the existing web surfaces. Anything the shell needs that the spec does not have is a spec gap to flag — not an inline hex.

## Acceptance criteria

- [ ] The doc references the decision doc for behavior and stays purely a visual / UX / copy / motion contract.
- [ ] The cross-browser / cleared-storage resume limitation (decision doc §Q3) is documented in the surface doc as an accepted constraint.
- [ ] `verify.mjs` is green.

## Blocked by

None — the follow-up grill (the prior blocker) is complete.

## Comments

**2026-05-21 — grilled, re-triaged, decomposed.** The follow-up `/grill-with-docs` round resolved all eight open questions (locked in [[../../../50_product/0.1.0-workflow-overhaul-web-invitee-flow|0.1.0-workflow-overhaul-web-invitee-flow]]); status `needs-triage` → `ready-for-agent`, type `HITL` → `AFK`. `/to-issues` then narrowed this issue to the surface-doc spec-gap and filed two paired tracer-bullets — tb-WF-11 (shell foundation) and tb-WF-12 (re-click behaviors) — alongside the already-filed siblings tb-WF-10 (#190) and sg-WF-7 (#191).

