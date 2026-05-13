---
title: v1 Scope
description: Smallest cut that proves the paralysis-killing thesis — what ships, what defers, what's deliberately open
type: product-vision
status: draft
created: 2026-05-08
---

# v1 Scope

The aspirational vision (see [[north-star]] and [[decision-model]]) stacks: 3 verticals + group-first + preference learning + web fallback + check-in + reroll-with-reason. That's a year-plus build.

v1 is the smallest cut that exercises every core mechanic and produces a measurable [[north-star|follow-through %]].

## In v1

- **Single vertical: food / restaurants.** Highest decision frequency, best data layer, lead anecdote. Fastest learning loop.
- **Group-first flow.** Initiator + Partyful-style link invite + web fallback for non-installers. Solo mode exists as fallback but is not promoted.
- **Fixed-length quiz.** Provisional 5 questions. Exact content + signal type land after [[research-brief|research]] completes.
- **External option source.** Yelp or Google Places integration for food. Single data source for v1, not multi-provider.
- **Veto-respecting + majority aggregation.**
- **Single-verdict output + reroll-with-reason.** Reroll cap 3.
- **Per-user history captured backend-only.** Preference data instrumented for future ML. No history UI surface in v1.
- **Post-decision check-in.** Lightweight thumbs-up/down nudge ~12–24h after verdict. iOS push only. Required to measure north-star metric.

## Deferred (vision but not v1)

- **Activities and bars verticals.** Activities specifically blocked on data-layer problem (fragmented sources). Bars deferred for scope reasons, not difficulty.
- **Full preference learning / ML.** v1 instruments preference data so this is unblocked later. No models in v1.
- **Group taste profiles.** Same reason as preference learning.
- **Verdict reasoning surface.** "Because 3/4 wanted X" — design exists but ship as A/B against pure-verdict.
- **Multi-provider data sourcing per vertical.** v1 picks one provider, lives with its limits.
- **Persistent groups + one-tap re-invite.** Cut in 2026-05-12 PRD grill. The group-chat thread itself is the persistent group — re-invite means starting a new decision and re-sharing the link to the same chat. No in-app "Friday crew" entity.
- **Decision history UI.** Backend captures every quiz answer per user, but no in-app history list, recents tab, or "last verdict" chip in v1. Data exists for ML; UX surface deferred.
- **Quiz-answer prefill from past sessions.** Backend has the data; v1 does not pre-populate quiz defaults from a returning user's history. Returning users answer fresh each time.

## Resolved in 2026-05-12 grill

The following items moved from "open" to locked. See ADRs for full rationale.

- **Auth / identity model.** Anonymous default + post-quiz Sign in with Apple upgrade on Waiting surface. [[../60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]].
- **Privacy posture.** Claimed-indefinite / anonymous-30d TTL / in-app delete / no third-party preference sharing / US-only beta. [[../60_engineering/adr/0006-privacy-posture-v1|ADR 0006]].
- **Monetization.** Free, no IAP, no ads in v1. Decision deferred until thesis validated.
- **Solo flow shape.** Same 5-question quiz; verdict surface hides per-member receipts. Empty-state variant of S05 (no new component required) — implemented in tracer bullet [[../15_issues/v1/issues/tb-13-solo-mode-variant|TB-13]].
- **Geographic launch scope.** Single metro, TestFlight only, seed-group cohort recruitment (~3–5 groups of 3–6).
- **Reroll cap.** 3 per session — already locked in `design-system/surfaces/07-reroll.md`. Was redundantly listed as open here.
- **Cardinal Q4 axis.** Vibe/energy (HUSHED → ROWDY) — already locked in `design-system/code/screens/ScreenQ4Vibe.jsx`. Was redundantly listed as open in [[v1-design-locks#Lock 2|Lock 2]].

## Resolved in 2026-05-12 PRD grill

The following items moved from "open" to locked during the pre-PRD grill session. They feed directly into the v1 PRD draft.

- **Group size and fire trigger.** 2–6 expected, but no fixed N — invite link is shareable, anyone in the chat can tap. Verdict fires when the initiator taps "Decide now" on the Waiting surface (S04) OR when an initiator-set timer expires (default 10 min, presets 5 / 10 / 15 / 30). Minimum quorum to fire = 2 (initiator + 1 other answer). After fire, link goes read-only for new joiners.
- **Late-joiner behavior.** Someone who taps the invite link AFTER the verdict ships sees a read-only verdict screen plus a re-invite CTA to start a fresh decision. They cannot retroactively influence the closed decision.
- **No-survivor fallback.** EBA elimination cascade is silent for soft preferences (cuisine veto, vibe floor, radius widen). Hard NEED vetoes (dietary, budget, allergy) never relax. If hard vetoes kill all options, terminal screen: "No spot fits tonight — widen radius?" (Surface gap to spec in S05.)
- **Dietary semantics.** Hard dietary vetoes are *menu-compliance filters*, not *restaurant-type filters*. "Vegan" means "restaurant offers vegan options," not "vegan-only restaurant." Same for halal, kosher, gluten-free, allergens. Lock 1 of [[v1-design-locks]] updated to reflect this.
- **Geographic radius.** 2 mi default, initiator-adjustable slider (0.5–5 mi) on S01 invite step. Silent auto-widen during no-survivor fallback for soft preferences.
- **Persistent groups + decision history.** Persistent group entity cut from v1 entirely. Per-user history captured backend-only, no UI surface. (Both listed in Deferred above.)
- **Check-in delivery.** iOS push only. Pre-permission ask on Verdict surface (S05) — pre-permission copy line fires the native iOS prompt after the first "I'm in" tap. Implemented in tracer bullet [[../15_issues/v1/issues/tb-08-ratification-push-hard-close|TB-08]]. Web-fallback users get no check-in; their follow-through is unmeasured (accepted gap in north-star coverage).
- **Beta success bar.** Learn-the-baseline first. First cohort (2–4 weeks) measures the follow-through distribution. Public-release threshold set retroactively from cohort median, not pre-committed.
- **Public-release gates (all four required).**
    1. Follow-through % meets the retroactive target from cohort 1.
    2. Groups make ≥3 decisions/group/week sustained over 2 weeks.
    3. <10% verdict failures (terminal no-survivor, crash, network).
    4. Some beta invitees become initiators for new groups (viral loop verified).
- **Seed recruitment.** Founder's own friend groups, cohort 1. Stranger-cohort deferred to cohort 2 post-validation.
- **Quiz copy in PRD.** PRD ships framework-compliant placeholder strings, explicitly marked for replacement during the [[../40_marketing_branding/_index|40_marketing_branding]] copy pass.
- **Privacy Policy + TOS.** Template-generated (iubenda / termly) before external TestFlight goes live. Not before code work begins.
- **Apple Developer account.** Individual account at sign-up. LLC formation deferred until thesis validates and monetization is on the table.

## Open gaps still pending

- **Brand / tone specifics.** Name locked to **GetToIt**; domain `gettoit.app` registered 2026-05-12. Naming bible (voice samples, visual register beyond Sunset Pop, final logo / wordmark) owns slot in [[../40_marketing_branding/_index|40_marketing_branding]]. Tile mark in `design-system/code/components.jsx` (`GTIMark`) is a placeholder pending real wordmark.
- **Final quiz copy strings.** Owned by [[../40_marketing_branding/_index|40_marketing_branding]]. v1 PRD carries placeholders.

## Design-system spec gaps from the PRD grill

The PRD-grill answers introduced four surface-level changes that the locked `design-system/` spec does not yet reflect. Each is a separate `design-system/` issue requiring synced JSX + markdown updates per `design-system/CLAUDE.md`:

- **S01 — Initiator Landing.** Add timer chip (presets 5 / 10 / 15 / 30, default 10) and radius slider (0.5–5 mi, default 2). Document the spec exception against S01's current "no optional fields" rule.
- **S04 — Waiting.** Add initiator-only "Decide now" button and timer-countdown display. Update the line that reserves force-verdict for v2.
- **S05 — Verdict.** Add read-only mode for late-joiners (verdict shown, no ratification controls, re-invite CTA below).
- **S05 — Verdict.** Add terminal no-survivor state ("No spot fits tonight — widen radius?") for when hard NEED vetoes kill all options.

Also: verify Foursquare exposes the dietary tags needed for menu-compliance filtering (`vegan_friendly`, `gluten_free_options`, `halal`, `kosher`). If coverage is thin, the menu-compliance dietary mechanic needs a fallback plan.

## Risks flagged in concept

- **Reroll dilutes paralysis-kill.** Cap mitigates but does not eliminate. Watch follow-through % on rerolled verdicts vs. first verdicts.
- **Multi-vertical vision was originally chosen for v1.** Cut to single vertical here. Honor the cut — resist scope creep before food vertical proves out the loop.
- **"Mid-sized decisions" framing in original pitch tension with "trivial / playful" stakes pick.** v1 stays trivial. Re-evaluate before any vertical that drifts heavier.

## Definition of done for v1

A target group of beta users can:

1. Receive an invite in a group chat from a friend.
2. Open it (app or web) and complete the quiz in under 60 seconds.
3. See a single verdict for a real, locally-relevant restaurant.
4. Optionally reroll once with a reason and get a different verdict.
5. Receive a follow-through nudge the next day and answer it.

Measurable: follow-through % computable across cohort. Mechanic tunable. Viral loop testable.

## Related

- [[north-star]]
- [[decision-model]]
- [[research-brief]]
