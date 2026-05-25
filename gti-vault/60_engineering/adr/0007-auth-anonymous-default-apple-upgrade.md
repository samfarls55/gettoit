---
adr: 0007
title: Auth model — anonymous default + post-quiz Apple upgrade
status: accepted
date: 2026-05-12
supersedes: null
superseded_by: null
---

# 0007 — Auth model: anonymous default + post-quiz Sign in with Apple

## Status

Accepted — 2026-05-12.

## Context

[[../../50_product/0.1.0-scope|0.1.0-scope.md]] flagged auth/identity model as open. [[../stack-patterns#auth|stack-patterns.md]] sketched anonymous-then-claim; this ADR ratifies it with a specific upgrade moment.

The auth model must:

- Support the two-tap invitee promise (deep link → vote, no friction).
- Allow opportunistic upgrade for users who want persistent groups + cross-device history.
- Work on iOS and on the Next.js web fallback ([[0003-web-fallback-nextjs-vercel|ADR 0003]]).
- Carry the [[0006-privacy-posture-0.1.0|privacy posture]] (anonymous TTL, claim-on-link data merge).

## Decision

**Anonymous-by-default. Sign in with Apple offered as a non-blocking upgrade after Q5 submit, displayed as a secondary chip on the Waiting surface (S08).**

### Flow

1. Invitee taps Universal Link → app deep-links to join screen → `auth.signInAnonymously()` → vote immediately. JWT carries no PII.
2. Initiator and invitees alike see the auth-upgrade chip on the Waiting surface after submitting Q5. Copy is voluntary register: "Save this taste profile" / "Maybe later".
3. If user taps the chip → `signInWithIdToken` flow (Authentication Services framework) → Supabase `auth.link_identity` to attach Apple identity to the existing anonymous `user_id`. No data loss.
4. Web fallback voters stay anonymous indefinitely (no Sign in with Apple on browser-only flows). They are transient by design.

### What is and isn't supported in 0.1.0

- **Supported:** anonymous voting, Sign in with Apple upgrade, cross-device access for claimed users, deletion of all data per user.
- **Not supported:** email/password, social logins other than Apple, phone-number auth, OTP, magic links, Sign in with Google.

## Why

1. **Two-tap invitee promise is the viral loop.** Any auth gate at vote time kills the loop. Anonymous default removes the gate without sacrificing identity continuity.
2. **Post-quiz is the right upgrade moment.** User has just demonstrated effort; offering to save it converts. Pre-vote prompts default-deny.
3. **Sign in with Apple is the only social login Apple requires you offer if you offer any.** Picking it alone avoids the multi-provider matrix while still giving users a name + email if they consent.
4. **Anonymous → linked migration preserves data.** No "lost my history when I signed up" anti-pattern.
5. **Web fallback voters are transient.** Forcing them to claim destroys their fast path; not forcing them is the correct tradeoff.

## Consequences

### Positive

- Lowest possible friction at invite time.
- Single identity provider to maintain.
- Anonymous TTL ([[0006-privacy-posture-0.1.0|ADR 0006]]) cleans up unclaimed accounts automatically.

### Negative / accepted tradeoffs

- **Account recovery for never-linked users is impossible.** Reinstall = new anonymous identity. Acceptable; the upgrade path is loud and the cost of loss is small (transient vote history).
- **Web users can't claim.** A user who joins via web fallback today, then installs iOS later, lands as a fresh anonymous identity — no merge. Future feature; flagged.
- **Sign in with Apple has its own Apple-side flow** the user can't bypass. Rejection rate ~10–20% on first ask is normal; design assumes this.

## Re-evaluation triggers

- Sign in with Apple acceptance rate below 20% in beta cohort — A/B alternative placements or copy.
- A second identity provider becomes essential (e.g., Android app launches; Sign in with Google joins).
- Account recovery requests from never-linked users exceed a manageable trickle.

## References

- [[../stack-patterns#auth|stack-patterns.md §Auth]]
- [[../../50_product/0.1.0-scope|0.1.0-scope.md]]
- [[0001-ios-tech-stack-supabase|ADR 0001]]
- [[0006-privacy-posture-0.1.0|ADR 0006]]
- [[../../15_issues/0.1.0/issues/tb-12-apple-signin-upgrade|TB-12 — Apple Sign-in upgrade chip on Waiting]]
