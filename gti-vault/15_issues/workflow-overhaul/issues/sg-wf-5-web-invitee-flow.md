---

issue: sg-WF-5
title: Web invitee single-link flow — design needed
status: needs-triage
type: HITL
feature: workflow-overhaul
github_issue: 158
created: 2026-05-19
---

# sg-WF-5 — Web invitee single-link flow

## Parent

[[../../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] §Q6 — Plan member subtypes. The Web invitee is the disjoint subtype that accesses a single Plan via the iMessage/SMS deep-link, with no homepage. The *what* is locked; the *how* (the actual web surfaces, identity persistence mechanism, name-entry UX) was out of scope of the 2026-05-19 grill and needs its own grill.

## What to build (after grill)

A design-system surface doc (or pair of docs) plus the web JSX/React code for the single-link flow. The grill must resolve, at minimum:

- **Landing-on-first-click.** What does the user see the first time they click the link? Name-entry alone, or name + a brief plan summary ("[Initiator] wants to figure out dinner")?
- **Identity persistence.** URL-token-based (member token embedded in the URL), cookie-based, or both? How does re-opening the link in the same browser resolve back to the same member? What about re-opening in a different browser?
- **Resume behavior.** Re-click while quiz active → resume at current question, with prior answers preserved? Re-click after Q5 submit → waiting room? Re-click after verdict → verdict screen?
- **Read-only window.** When the Plan transitions to `decided-expired` (reroll window closed), what does the web invitee see on re-click? Verdict frozen as a read-only card with venue + voted-summary? Or just a "this plan is closed" terminal?
- **Exit / Leave affordance.** Does the web invitee get a `Leave` button? If yes, on which surfaces? What happens on the web after they tap it — terminal "you left this plan" screen? Hard block on re-clicking the link, or soft (let them rejoin)?
- **Name entry UX.** Single text input + CTA? Validation rules? Max length? Placeholder copy? What happens if the user enters an empty name?
- **No homepage.** Per the locked decision, the web invitee has no list of Plans. But what if they were invited to a *second* Plan by a different person? Two different URLs → two separate sessions, each independent. Make sure this is explicit in the spec.
- **iOS-app-installed branch.** What happens if the user clicks an iMessage link and they have the iOS app installed? Universal-links flow opens the app (existing behavior — `bug-01` regression test guards this). The web surface is only reached if the app is *not* installed. Confirm this branch is documented.

### Things that are already locked (do NOT re-grill)

- Web invitees have **no Plan list** and no homepage.
- The iMessage/SMS deep-link is their *only* persistent handle on the Plan.
- They are identified by a name they enter on first landing.
- Re-opening the same link returns them to the Plan's current state (quiz / waiting / verdict / read-only history).
- They are an Account-disjoint subtype — never sign in with Apple from the web; their identity is name-only.
- Plan creators are *always* Account members (iOS-only creation); web users never create Plans.

## Acceptance criteria (after grill)

- [ ] A grill session resolves the open items above and updates [[../../../50_product/workflow-overhaul-plan-setup|workflow-overhaul-plan-setup]] (or a sibling decision doc) with the locked outcomes.
- [ ] This issue is re-triaged to `ready-for-agent` / `AFK` once the grill outcomes are inlined.
- [ ] After re-triage: design-system surface doc(s) for the web invitee flow land in `design-system/surfaces/` (existing convention is shared between iOS and web; or a `web-NN-*.md` namespace if web-only spec is preferred).
- [ ] Web JSX (`web/app/join/[roomId]/...` or analogous) implements the spec end-to-end.
- [ ] Identity persistence mechanism (URL token or cookie) is documented, including the same-browser / cross-browser behavior.
- [ ] `verify.mjs` is green.

## Blocked by

None to start the grill. A follow-up `/grill-with-docs` session is the prerequisite to AFK promotion.
