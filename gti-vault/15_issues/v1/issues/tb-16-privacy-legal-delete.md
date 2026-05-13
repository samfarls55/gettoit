---
issue: tb-16
title: Privacy Policy + TOS + Privacy Nutrition Labels + in-app delete
github_issue: 17
status: ready-for-agent
type: HITL
created: 2026-05-12
prd: v1-prd
adr: 0006
---

# TB-16 — Privacy + TOS + Nutrition Labels + in-app delete

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The legal and policy work required to ship to external TestFlight and the App Store. Per [[../../../60_engineering/adr/0006-privacy-posture-v1|ADR 0006]] the posture is minimal: claimed-retained, anonymous-30-day-TTL, in-app delete with cascade, no third-party preference sharing, US-only beta.

This is HITL because the policy text needs human review and the App Store Connect entries require an Apple Developer account login.

- **Privacy Policy + TOS** — generate via iubenda or termly template. Inputs to the template:
  - Data collected: device-generated anonymous user_id, optional Apple email + name on link, quiz answers, restaurant interactions, push device token if granted.
  - Data shared: Foursquare receives geo queries only (no user identifiers, no preferences).
  - Retention: claimed accounts retained until in-app delete; anonymous accounts 30-day TTL.
  - User rights: in-app account deletion; data export deferred to v2.
  - Jurisdiction: US-only beta; EU launch deferred.
- **Privacy Nutrition Labels** — fill out the App Store Connect Privacy form to match the policy. Labels for: anonymous user ID, optional email + name (on link), location (precise — for Foursquare queries; not linked to identity), purchases (none), usage data (anonymous quiz answers).
- **In-app delete flow** — schema migration: every table grows an `ON DELETE` rule that cascades from `auth.users`. The user-facing button lives in a "Settings" screen (new minimal surface — propose `surfaces/09-settings.md` or fold into an account chip). On tap → confirmation dialog → `supabase.auth.admin.deleteUser()` → cascade. Rooms the user *created* hard-delete; rooms the user *participated in* nullify `members.user_id`, `votes.user_id`, `ratifications.user_id`.
- **30-day TTL cron** — `pg_cron` job that hard-deletes anonymous user rows + cascades for `auth.users WHERE is_anonymous = true AND last_sign_in_at < now() - interval '30 days'`.
- **Tests** — in-app delete cascades correctly (user's own rooms gone, co-participated rooms intact); anonymous TTL cron purges expired users.

## Acceptance criteria

- [ ] Privacy Policy and TOS hosted at `gettoit.app/privacy` and `gettoit.app/terms`.
- [ ] Privacy Nutrition Labels filled out in App Store Connect to match the policy.
- [ ] In-app "Delete my data" button works end-to-end with the documented cascade.
- [ ] Anonymous 30-day TTL `pg_cron` job runs and purges expired rows.
- [ ] Integration tests for delete cascade and TTL purge.

## Blocked by

- [[tb-14-checkin-telemetry|TB-14]]
- [[tb-00-external-accounts|TB-00]]
