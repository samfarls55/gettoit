---
adr: 0006
title: Privacy posture v1 — retention, deletion, sharing
status: accepted
date: 2026-05-12
supersedes: null
superseded_by: null
---

# 0006 — Privacy posture v1

## Status

Accepted — 2026-05-12.

## Context

[[../../50_product/v1-scope|v1-scope.md]] flagged privacy posture as open. App Store submission requires Privacy Nutrition Labels, a Privacy Policy URL, and clear handling rules for any retained user data. Anonymous-then-claim auth ([[0007-auth-anonymous-default-apple-upgrade|ADR 0007]]) creates a specific edge case: data accumulated under an anonymous identity must be either retained-on-link or expired-on-abandon.

## Decision

**Minimal-stance v1:**

| Concern | Rule |
|---|---|
| Claimed accounts (linked to Sign in with Apple) | Data retained until user invokes in-app delete. |
| Anonymous accounts | 30-day TTL from last activity. Cron job purges expired rows from `votes`, `events`, `members`, `check_ins`, and `auth.users` for the affected `user_id`. |
| Anonymous → claim merge | All anonymous-period data attached to the new `user_id`. No orphan loss. Implemented via `auth.link_identity` + a tx that rewrites `user_id` foreign keys on linked tables. |
| Account deletion | In-app button: hard-delete all rooms the user created (rooms they were a non-owner participant of remain, with the deleted user's `user_id` nullified on `members.user_id`, `votes.user_id`). Cascade deletes on `events` and `check_ins`. |
| Third-party preference-data sharing | None. Foursquare receives geo queries only — no user identifiers, no preferences. |
| Cross-group preference visibility | A user's preferences are visible only inside the rooms they participated in (RLS-enforced). No "see what X likes" surfaces. |
| Geographic scope at v1 | US-only beta. Minimizes GDPR/CCPA exposure. EU launch requires a compliance pass not in v1 scope. |
| Privacy Policy + TOS | Template-and-edit approach (e.g., iubenda, termly). Custom legal review deferred until post-thesis. |

## Why

1. **App Store gates on this.** Privacy Nutrition Labels need a clear answer; deferring blocks submission.
2. **Anonymous TTL prevents indefinite storage of zero-PII rows we can't act on anyway.** Anonymous-only users who never claim are noise data after 30 days.
3. **Anonymous→claim merge is the gold path UX.** Voters who like the app must keep their vote history when they sign in. Anything else punishes the upgrade.
4. **No third-party preference sharing simplifies the privacy story.** Single-paragraph policy. Single set of nutrition labels.
5. **US-only beta defers GDPR/CCPA complexity** without foreclosing it. Re-enter compliance work before EU launch.

## Consequences

### Positive

- Privacy story fits on one screen of the App Store listing.
- Anonymous TTL keeps Postgres compact at near-zero PII cost.
- No DPA negotiations with third-party processors for v1.

### Negative / accepted tradeoffs

- **No EU users at beta.** Foreclosed during v1; geofence by App Store availability (US storefront only) and TestFlight invite control.
- **Account-deletion cascade has edge cases.** Rooms the deleted user *created* hard-delete; co-participants lose access to that room's history. Acceptable; deletion is a hard delete by design.
- **30-day anonymous TTL must not surprise users.** Privacy Policy and the post-vote auth-prompt copy on the Waiting surface (S04 chip — implemented in tracer bullet [[../../15_issues/v1/issues/tb-12-apple-signin-upgrade|TB-12]]) must mention it without sounding alarming.

## Re-evaluation triggers

- EU launch decision.
- DAU crosses a threshold where CCPA's "verifiable consumer requests" workflow needs operational support (typically > 50k California users).
- Any product surface starts wanting to expose cross-group preference data.

## References

- [[../../50_product/v1-scope|v1-scope.md]] §Open gaps
- [[0007-auth-anonymous-default-apple-upgrade|ADR 0007]]
- [[0005-telemetry-supabase-event-store|ADR 0005]] (event retention couples to this)
