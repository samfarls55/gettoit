---
folder: 60_engineering
purpose: Architecture, conventions, runbooks, ADRs
---

# 60_engineering — Engineering

Architecture, conventions, runbooks, ADRs.

## Contents

- [[adr/_index|adr/]] — Architecture Decision Records (one file per decision, numbered from `0001`).
- [[2026-05-19-voteless-firing-rooms|2026-05-19-voteless-firing-rooms.md]] — 2026-05-19 ops-01 finding: ~300 of the rooms stuck in `status='firing'` have no `votes` rows, so `compute-verdict` hard-404s them (`no_votes`) and the ops-01 re-fire cannot resolve them. A separate failure mode from the bug-13 empty-pool wedge — likely abandoned dogfood rooms auto-fired before anyone voted. Flagged for triage (sweep to `expired` / fix the fire dispatch / leave).
- [[verdict-path-options-table-never-populated|verdict-path-options-table-never-populated.md]] — 2026-05-18 diagnosis: the post-Q5 verdict spinner hangs forever. Three compounding defects — the `options` table has no writer (0 rows / 2587 rooms, root cause), the verdict-fire dispatch silently no-ops on unset `app.*` GUCs, and `VerdictPoller` has no timeout. Verdict path has never produced a row.
- [[verdict-dispatch-guc-superuser-blocker|verdict-dispatch-guc-superuser-blocker.md]] — 2026-05-18 bug-09 blocker: setting the `app.*` verdict-dispatch GUCs at the database/role level requires a Postgres superuser; Supabase's `postgres` role is not one, so the prescribed migration + CI-step fix cannot land (and the migration would red the shared `supabase-db` lane). Recommends re-triage: HITL dashboard config, or AFK re-scope to read the config from an `app_config` table instead of `current_setting()`.
- [[claim-code-mint-encryption|claim-code-mint-encryption.md]] — tb-WF-13 implementation note: why the `claim_codes` refresh token is encrypted application-layer (AES-GCM, in a shared Edge Function helper) with a runtime `CLAIM_CODE_ENC_KEY` secret, rather than via a `pgcrypto` column default that would put the key in the database. Includes the `openssl rand -base64 32` key-generation step.
- [[research/_index|research/]] — Time-stamped research bundles that feed ADRs (outline + fields + deep-research outputs).
- [[references/_index|references/]] — Processed third-party reference materials (books, papers) whose substance was extracted into vault docs or repo standards.
- [[stack-patterns|stack-patterns.md]] — Implementation patterns implied by the current stack (cross-references the active ADR).
- [[verdict-engine|verdict-engine.md]] — VerdictEngine architecture: the 0.1.0 worst-off-protecting pipeline (EBA prune + satisficing floor + maximin tiebreak), anonymization rules, Q5-complete firing, and the compute-verdict Edge Function.
- [[foursquare-venue-closure-signal|foursquare-venue-closure-signal.md]] — 2026-05-18 investigation + resolution: the post-2025 Foursquare surface has no `closed_bucket`; `date_closed` is effectively never populated (0/300 sampled); out-of-business venues like Pastime pass through unflagged. Resolved via Option B — an on-device MapKit closure cross-check (`VenueClosureVerifier`).
- [[places-api-foursquare-vs-google|places-api-foursquare-vs-google.md]] — 2026-05-18 provider comparison: Foursquare Places API (current) vs Google Places API (New) on capability, data fields, taxonomy, pricing, and terms. Recommendation: stay on Foursquare — finer filterable taxonomy, cache-friendly terms, cheaper at the rich-data tier; Google's storage ToS would forbid the `places-proxy` cache.
- [[places-provider-options-survey-2026-05|places-provider-options-survey-2026-05.md]] — 2026-05-19 full market scan of 13 venue-data providers (Google, Yelp, Tripadvisor, Apple MapKit, HERE, TomTom, Mapbox, OSM, Geoapify, Radar, Overture, FSQ OS, Foursquare) with capability + pricing tables. Triggered by the call to drop Foursquare for stale data. Key findings: Mapbox/Overture/FSQ-OS are all Foursquare-derived (no escape); only Google/Yelp self-serve real ratings; Google `businessStatus` is the only reliable closure signal; MapKit is a "what's there" provider with no detail layer and Apple Maps reviews are licensed-in Yelp data with no developer channel. **Decision 2026-05-19: stay on Foursquare for now** — cheapest provider that feeds the quiz; staleness accepted and partially mitigated by `VenueClosureVerifier`. The Google-migration analysis is retained in the doc for a future revisit.
- [[waiting-fire-trigger|waiting-fire-trigger.md]] — TB-07's S04 Waiting surface, Realtime wiring, verdict-fire trigger + pg_cron auto-fire path, expired-no-quorum terminal.
- [[ratification-push-hardclose|ratification-push-hardclose.md]] — TB-08's "I'm in" ratification, push permission prompt (once per session), correctability window + S06 hard-close shutter motion, APNsSender Edge Function with ES256 JWT signing.
- [[checkin-telemetry|checkin-telemetry.md]] — TB-14's next-day check-in (S08), CheckinScheduler pg_cron + exactly-once `checkin_dispatches` table, 3-day-no-signal sweeper, TelemetryWriter module + event vocabulary, and the three SQL metric views (`metric_follow_through_pct`, `metric_time_to_verdict_p50`, `metric_invite_acceptance`).
- [[devcontainer-setup|devcontainer-setup.md]] — Step-by-step rebuild instructions for the Claude Code devcontainer (toolchain, secrets, allowlist, CI handoff for iOS).
- [[apple-keys-setup|apple-keys-setup.md]] — Runbook for obtaining and wiring the Apple credentials 0.1.0 needs (App Store Connect API key → CI, Sign in with Apple key → Supabase; MapKit JS skipped).
- [[supabase-setup|supabase-setup.md]] — Runbook for provisioning the 0.1.0 Supabase project (Pro plan, extensions postgis/pg_cron/pgmq, anonymous auth, CLI link, GH Actions secret mirror).
- [[ios-ci-setup|ios-ci-setup.md]] — Runbook for the iOS CI lane (XcodeGen-driven project generation, macOS-14 runner, Xcode 15.4 pin, Supabase env injection, no-local-Xcode constraint).
- [[ci-trigger-filtering|ci-trigger-filtering.md]] — 2026-05-19: `ci.yml` `paths-ignore` skips docs-only changes (`gti-vault/**`, `docs/**`, root `*.md`); why the list is conservative (not blanket `**/*.md`); per-lane filtering deferred.
- [[auth-apple-link-testing|auth-apple-link-testing.md]] — TB-12 testing split: what CI's state-machine + DB-integration tests cover vs. what only TestFlight (TB-17) can verify against a real Apple Sign-in round-trip.
- [[web-fallback-setup|web-fallback-setup.md]] — TB-15 operational notes: Vercel `NEXT_PUBLIC_*` env vars, Realtime channel contract, accepted web-side gaps per ADR 0003 / 0007.
- [[asc-privacy-labels|asc-privacy-labels.md]] — TB-16 final HITL gate: line-by-line answers for App Store Connect's App Privacy nutrition-labels form, derived from the deployed Privacy Policy + ADR 0006.
