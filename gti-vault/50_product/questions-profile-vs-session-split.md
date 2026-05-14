---
title: Questions — profile vs session split
description: Rule for which user data lives on the account (profile-level) vs is asked every run (session-level). Source of truth for the v1.1 questions rework.
type: decision-record
status: locked
created: 2026-05-14
related:
  - "[[v1-design-locks]]"
  - "[[v1-scope]]"
  - "[[decision-model]]"
  - "[[../15_issues/v1.1/_index|v1.1 backlog]]"
---

# Questions — profile vs session split

Rule for the v1.1 questions rework. Decides which inputs become persistent **profile** data (asked once, stored on the account) vs **session** data (asked every run, situational).

This document is the source of truth that `15_issues/v1.1/_index.md` #9 cross-references. It supersedes the original v1 PRD's flat treatment of all questions as session-level.

## Decision

### Split rule

> **Profile** = identity / body / values. Sticky across sessions. Asked once, stored on the account.
>
> **Session** = right-now context. Variable across sessions. Asked every run.

Allergies are profile because your body does not change between sessions. Mood is session because it does.

### Profile-level (sticky, lives on the account)

| Item | Why profile |
|---|---|
| Allergies | Body fact; safety constraint; never changes between sessions. |
| Dietary restrictions (vegan, keto, halal, etc.) | Values or body fact; rarely changes session-to-session. |
| Cuisine preferences ("I love Thai") | Stable taste signal; survives across sessions. |
| Cuisine dislikes ("hate seafood") | Stable taste signal; survives across sessions. |

### Session-level (asked every run)

| Item | Why session |
|---|---|
| Budget tier | Varies by occasion (date night vs lunch). |
| Mood | Right-now state; cannot be pre-stored. |
| Hunger level | Right-now state. |
| Solo / partner / group | Per-decision context. |
| Indoor / outdoor / takeout | Per-decision context. |

### Deferred from v1.1 entirely

The following inputs are *not* asked at all in v1.1 — neither profile nor session. They re-enter scope in a future milestone:

- **Distance willing to travel** — v1.1 assumes all participants in the same general geographic area.
- **Time available** — same justification.

When multi-geo decisions become a thing, both re-enter as session-level inputs.

## Implications

### v1.1

- **Profile-edit surface** (where the four profile-level items get edited): **deferred** to the pre-public-launch milestone, not v1.1. See [[../15_issues/v1.1/_index|v1.1 backlog]] #7 and #10.
- **Anonymous-user fallback** (the proposed 6th question capturing allergies + dietary for users without a profile): **deferred** to the same milestone. v1.1 recommender is allergy-blind by design — acceptable risk because only the user-as-self is on the platform during v1.1.
- **v1.1 session-question count** is 5 (the items in the session table above), plus the existing v1 quiz shape per [[v1-design-locks]] Lock 1. Re-check this against Lock 1 wording before PRD update — Lock 1 currently embeds budget, distance, time as session-level via the v1 EBA chain. Lock 1 wording will need an addendum (or v1.1-prd) acknowledging the deferrals + the split.

### Pre-public-launch milestone

- Build the profile-edit surface (settings → preferences area where the four profile items get captured / edited).
- Wire profile reads into the verdict engine so authed users skip the four profile questions during a decision.
- Decide capture flow for first-time authed users (during onboarding vs progressive vs Account Settings only).

### Long-term direction

**Passive preference learning.** Cuisine likes / dislikes (and possibly other soft signals) should *emerge from answer history over time* rather than always being explicitly captured. Explicit capture stays opt-in via the profile-edit surface; the system learns from observed choices in parallel.

This is a directional north-star, not a v1.1 or pre-public-launch commitment. It biases architecture decisions: the profile schema should make room for "learned" preferences alongside "stated" preferences from the start, so the learned signal can be added without a schema migration later.

## Open questions

- Does the verdict engine treat stated profile preferences as **hard** signals (EBA vetoes) or **soft** signals (Satisficing thresholds)? Cuisine dislike "hate seafood" — does the engine refuse to surface seafood places, or does it down-weight them? [[v1-design-locks]] Lock 2 implies cuisine is a soft signal at Q4 (cardinal axis); profile-level cuisine likes/dislikes may want the same treatment, but this is unstated.
- Allergies are unambiguously hard per [[v1-design-locks]] Lock 1; dietary restrictions are also hard per Lock 1's "menu-compliance" framing. Profile lookup just replaces the per-session ask without changing engine semantics.

These questions land when the profile-edit surface is built in the pre-public-launch milestone.

## Sources

- [[../15_issues/v1.1/_index|v1.1 backlog]] §Resolutions #9, #10, #11 — the grilling session that produced this rule.
- [[../01_raw/testflight-first-dogfood-2026-05-14|Raw dogfood note]] — the original "allergies should be on the profile" observation.
- [[v1-design-locks]] Lock 1 — the existing v1 quiz composition this split modifies.
