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
| Anonymous accounts | 30-day TTL from last activity. Cron job deletes the user from `auth.users`; FK cascades purge dependent rows (same mechanism as the in-app delete button). `events.user_id` nullifies to preserve analytics. |
| Anonymous → claim merge | All anonymous-period data attached to the new `user_id`. No orphan loss. Implemented via `auth.link_identity` + a tx that rewrites `user_id` foreign keys on linked tables. |
| Account deletion | In-app button: hard-deletes the user from `auth.users`. Cascade FKs (every dependent table except `events`) remove the user's `members`, `votes`, `ratifications`, `rerolls`, `check_ins`, `user_preferences`, `push_tokens`, `checkin_dispatches` rows, plus all `rooms` they created. `events.user_id` is `on delete set null` so analytics rollups (event counts, funnels) survive without retaining identity. See [Amendments](#amendments) for why participated-room history cascades rather than nullifying. |
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
- **Account deletion cascades across participated rooms.** Beyond rooms the user *created* (which hard-delete), their `members`, `votes`, `ratifications`, `rerolls` rows in rooms they joined as a non-owner *also* cascade-delete. The original ADR draft targeted `SET NULL` on `members.user_id` + `votes.user_id` to preserve co-participation history, but the `(room_id, user_id)` primary keys on those tables preclude `SET NULL` in PostgreSQL without a synthetic-id rework. Accepted at v1 cohort scale (US beta, small cohort) — rare for non-owners to delete, and verdicts are already computed + ratified by the time anyone leaves. Re-evaluation trigger added below.
- **30-day anonymous TTL must not surprise users.** Privacy Policy and the post-vote auth-prompt copy on the Waiting surface (S04 chip — implemented in tracer bullet [[../../15_issues/v1/issues/tb-12-apple-signin-upgrade|TB-12]]) must mention it without sounding alarming.

## Re-evaluation triggers

- EU launch decision.
- DAU crosses a threshold where CCPA's "verifiable consumer requests" workflow needs operational support (typically > 50k California users).
- Any product surface starts wanting to expose cross-group preference data.
- Any post-verdict surface displays historical participant lists where retroactive shrinkage from a participant deletion would be user-visible (would force the synthetic-id rework to enable `SET NULL` on `members`, `votes`, `ratifications`).

## References

- [[../../50_product/v1-scope|v1-scope.md]] §Open gaps
- [[0007-auth-anonymous-default-apple-upgrade|ADR 0007]]
- [[0005-telemetry-supabase-event-store|ADR 0005]] (event retention couples to this)

## Amendments

### 2026-05-14 — TB-16 implementation reconciliation

When TB-16 (in-app delete + 30-day TTL) hit the schema layer, two clarifications surfaced and were applied to the rows above:

1. **Account-deletion mechanism on participated rooms.** The original Decision row described co-participation history as nullified on `members.user_id` and `votes.user_id`. PostgreSQL primary-key constraints `(room_id, user_id)` preclude `SET NULL` on a PK column without a synthetic-id rework. Decision: cascade applied uniformly across all participated-room tables (`members`, `votes`, `ratifications`, `rerolls`). The "Negative / accepted tradeoffs" bullet was rewritten to document the concession, and a new re-evaluation trigger added if any future surface makes the retroactive shrinkage user-visible.
2. **Events table semantics.** `events.user_id` was implemented as `on delete set null` in `supabase/migrations/20260514000400000_checkins_and_events.sql` so analytics rollups survive a user delete (event happened, identity is gone — zero retained PII). The original ADR row implied cascade; corrected to match deployed semantics.

No reversal of overall intent. Status remains `accepted`. Schema is already correct as of `493a482` — no new migration required for cascade semantics; only the 30-day TTL cron is net-new in TB-16.
