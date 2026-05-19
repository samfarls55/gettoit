# CONTEXT

Domain glossary and shared vocabulary for GetToIt. Agents read this before exploring; outputs (issue titles, refactor proposals, test names) should use the terms defined here.

This file is grown lazily by `/grill-with-docs` as terms get resolved during real work. Don't pre-fill speculatively.

## Language

### Auth identity

**Anonymous session**:
A Supabase auth session minted via `signInAnonymously()`, carrying a real `user_id` but no Apple identity. v1 default for both iOS and web. Post-v1.1 iOS, anonymous sessions only exist as transient legacy state on pre-v1.1 TestFlight installs and on the web fallback.
_Avoid_: guest user, anon account, unauthenticated session (a session is still present), no-account user.

**Linked-Apple session**:
A Supabase auth session whose `user_id` has an Apple identity attached, either via fresh `signInWithApple` (no prior session) or `linkApple` (existing anonymous session upgraded, same `user_id` preserved). Canonical iOS post-v1.1 state.
_Avoid_: signed-in user, authenticated user, Apple account (the account is on Apple's side, the session is ours).

**S00a Sign-in Gate**:
The surface (`design-system/surfaces/00a-signin.md`) rendered on iOS launch when the current auth state is anything other than Linked-Apple. One Sign-in-with-Apple pill, no skip. v1.1 closure of the iOS half of [[gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]'s anonymous-default.
_Avoid_: sign-up page, sign-up screen, onboarding screen, welcome screen, account creation page (see Flagged ambiguities).

### Quiz redesign vocabulary (v1.1, 2026-05-15)

**Parameter**:
A session-level setting captured BEFORE the quiz begins, on a session-setup surface, typically by the initiator. Distinct from quiz questions (asked of every member) and profile data (account-level, sticky). Current v1.1 parameters: meal time / urgency (timestamp), dine-in vs takeout.
_Avoid_: setting, option, pre-question (ambiguous).

**Profile** (in the quiz-redesign sense):
Account-level data stored once per user and read on every decision. Identity / body / values that do not change session-to-session. v1.1 contents: allergies, dietary restrictions, cuisine NEVERS (negative-only). Note that the profile-edit surface itself is deferred to the pre-public-launch milestone.
_Avoid_: account info (too broad), preferences (the cuisine-craving signal is a session-level preference, distinct from profile preferences).

**Scenario question**:
A quiz question whose answer compiles to a *recipe* of multiple underlying Foursquare filters at once, rather than mapping to a single filter dimension. Users pick a real-world scenario in plain language; the engine assembles the filter set. Distinct from one-question-per-filter design.
_Avoid_: composite question (mechanically accurate but doesn't convey the "scenario in user voice" framing), bundled question (collides with "bundle" in PR terminology).

**Q5 preference probe**:
The v1.1 Q5 mechanism. Each member rates three real candidate venues 1-5 on excitement. The three cards are a strict factorial -- each deviates from the member's stated Q1-Q4 profile on exactly one axis (cuisine, reputation, vibe) and matches the other two; never a 100% match. The engine reads the member's axis-weight hierarchy from the ratings and extrapolates a preference function over the full candidate pool. Replaces the v1-locked "regret-of-omission per surviving option" mechanism (signal-unstable under partial quorum) and the briefly-considered archetype rater (rejected: too abstract, rated templates not real venues -- see [[gti-vault/50_product/v1.1-quiz-amendments|v1.1-quiz-amendments]] §7).
_Avoid_: archetype rater (rejected design, now historical), regret rater (the v1 mechanism, historical), tiebreaker (Q5 is a probe, not a tiebreaker -- the verdict tiebreak is the maximin rule).

**Cuisine NEVER**:
A profile-level negative filter -- a cuisine the user will never eat under any circumstance. Hard veto, EBA-style. Distinct from cuisine craving (session-level positive signal, "Italian sounds good tonight").
_Avoid_: cuisine dislike (too soft; NEVER is hard veto), cuisine veto (collides with the Q1-veto verdict-engine machinery from v1).

### Candidate pool (v1.1, 2026-05-19)

**Candidate pool**:
The set of real venues a session's verdict ranks -- the running union of every member's per-member Foursquare / MapKit fetch, deduped by `fsq_place_id`. The Q5 preference probe draws its three factorial cards from the same union: the Q5 candidate pool and the verdict candidate pool are one set, not two.
_Avoid_: options (the `options` table is the pool's persisted form, not a separate concept), results (a raw Foursquare response, pre-union), candidate set (acceptable informally, but "pool" is the canonical noun).

**Candidate-pool floor**:
The named, shared allowlist of venue *types* eligible for the candidate pool before any quiz answer narrows it. v1.1: eight Foursquare `Dining and Drinking` subcategories -- Restaurant, Sports Bar, Food Court, Food Truck, Food Stand, Cafeteria, Breakfast Spot, Bagel Shop. Applied as a fetch-time hard filter on every Foursquare call (seeded into `fsq_category_ids` when no other category scope is present) and approximated as `.restaurant`-only on the MapKit fallback. The single source of truth that keeps the Q5 candidate pool and the verdict candidate pool from diverging. See [[gti-vault/60_engineering/adr/0012-candidate-pool-floor|ADR 0012]].
_Avoid_: category filter (collides with the per-cuisine `fsq_category_ids` scoping, a different mechanism), restaurant filter ("Restaurant" is one of eight members, not the whole floor).

## Relationships

- An **Anonymous session** can upgrade to a **Linked-Apple session** via `AuthCoordinator.linkApple`, preserving the `user_id` and all owned rows (rooms, votes, members, events).
- The **S00a Sign-in Gate** is the iOS entry point that converts any non-Linked-Apple state into a **Linked-Apple session**. It is the ONLY surface that mints a Linked-Apple session on iOS.
- A **Linked-Apple session** is durable across reinstalls keyed by the device's Apple identity. An **Anonymous session** is durable only until the keychain is cleared or the app is deleted.
- A **Parameter** is set on session setup and constrains the entire quiz that follows. A **Scenario question** is asked of every member during the quiz, and its answer is per-member. A **Profile** value is read silently per member without re-asking.
- The conditional Q3 structure (indoor/outdoor only if dine-in **Parameter**) means quiz question identity depends on session parameters. Schema must support per-session question-slot variability.
- The **Q5 preference probe** draws its three cards from the **Candidate pool**; the verdict engine ranks the same **Candidate pool**. They are one set — the **Candidate-pool floor** is what guarantees they cannot diverge.
- The **Candidate-pool floor** is a fetch-time (Stage 1) venue-*class* hard filter, applied alongside geo / radius / price / meal-time. It is orthogonal to cuisine, which is a Stage-2 soft scoring axis in the verdict engine and never strict-filters the fetch.

## Example dialogue

> **Founder:** "There is still no sign-up page upon app launch."
> **Engineer:** "The **S00a Sign-in Gate** is wired but its render guard only fires when there is no session at all. Your phone still has an **Anonymous session** in keychain from a pre-v1.1 build, so the gate is being skipped."
> **Founder:** "And when I do sign in, I keep my old rooms?"
> **Engineer:** "Yes. The fix routes you through **S00a** but taps `linkApple` instead of `signInWithApple`, so your **Anonymous session** is upgraded to a **Linked-Apple session** with the same `user_id`. Every row keyed off that id survives."

## Flagged ambiguities

- "sign-up" vs "sign-in": product / founder voice uses "sign-up page" loosely for any account-creation moment. Engineering uses "sign-in gate" because the surface only ever signs in with an existing Apple identity (Apple owns account creation; the app never sees a "new vs returning" distinction). When the founder says "sign-up page," they almost always mean the **S00a Sign-in Gate**.
- "anonymous user" vs "no user": pre-v1.1 these were the same in practice (every iOS install minted an anonymous user on launch). Post-v1.1 they diverge - no user = pre-S00a state; anonymous user = legacy carryover that must pass through S00a via `linkApple`.

## See also

- `gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade.md` - Auth ADR
- `design-system/surfaces/00a-signin.md` - S00a surface spec
- `docs/agents/domain.md` - consumer rules for this file
