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

**Archetype rater (Q5)**:
The v1.1 Q5 mechanism. Members rate 3-4 restaurant-type templates (e.g. "the cozy hole-in-the-wall", "the trendy hotspot") on a 1-5 scale. Engine maps archetype scores to candidates via candidate-archetype affinity. Replaces the v1-locked "regret-of-omission per surviving option" mechanism specifically because templates are universal across members while rolling-survivor candidates are not.
_Avoid_: regret rater (was the v1 mechanism, now historical), restaurant rater (rates types, not actual restaurants).

**Cuisine NEVER**:
A profile-level negative filter -- a cuisine the user will never eat under any circumstance. Hard veto, EBA-style. Distinct from cuisine craving (session-level positive signal, "Italian sounds good tonight").
_Avoid_: cuisine dislike (too soft; NEVER is hard veto), cuisine veto (collides with the Q1-veto verdict-engine machinery from v1).

## Relationships

- An **Anonymous session** can upgrade to a **Linked-Apple session** via `AuthCoordinator.linkApple`, preserving the `user_id` and all owned rows (rooms, votes, members, events).
- The **S00a Sign-in Gate** is the iOS entry point that converts any non-Linked-Apple state into a **Linked-Apple session**. It is the ONLY surface that mints a Linked-Apple session on iOS.
- A **Linked-Apple session** is durable across reinstalls keyed by the device's Apple identity. An **Anonymous session** is durable only until the keychain is cleared or the app is deleted.
- A **Parameter** is set on session setup and constrains the entire quiz that follows. A **Scenario question** is asked of every member during the quiz, and its answer is per-member. A **Profile** value is read silently per member without re-asking.
- The conditional Q3 structure (indoor/outdoor only if dine-in **Parameter**) means quiz question identity depends on session parameters. Schema must support per-session question-slot variability.

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
