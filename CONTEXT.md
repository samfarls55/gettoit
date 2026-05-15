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

## Relationships

- An **Anonymous session** can upgrade to a **Linked-Apple session** via `AuthCoordinator.linkApple`, preserving the `user_id` and all owned rows (rooms, votes, members, events).
- The **S00a Sign-in Gate** is the iOS entry point that converts any non-Linked-Apple state into a **Linked-Apple session**. It is the ONLY surface that mints a Linked-Apple session on iOS.
- A **Linked-Apple session** is durable across reinstalls keyed by the device's Apple identity. An **Anonymous session** is durable only until the keychain is cleared or the app is deleted.

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
