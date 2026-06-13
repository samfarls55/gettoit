---
folder: 60_engineering
purpose: Architecture, conventions, runbooks, ADRs
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# 60_engineering â€” Engineering

Architecture, conventions, runbooks, ADRs.

## Contents

- [[adr/_index|adr/]] â€” Architecture Decision Records (one file per decision, numbered from `0001`).
- [[2026-05-19-voteless-firing-rooms|2026-05-19-voteless-firing-rooms.md]] â€” 2026-05-19 ops-01 finding: ~300 of the rooms stuck in `status='firing'` have no `votes` rows, so `compute-verdict` hard-404s them (`no_votes`) and the ops-01 re-fire cannot resolve them. A separate failure mode from the bug-13 empty-pool wedge â€” likely abandoned dogfood rooms auto-fired before anyone voted. Flagged for triage (sweep to `expired` / fix the fire dispatch / leave).
- [[verdict-path-options-table-never-populated|verdict-path-options-table-never-populated.md]] â€” 2026-05-18 diagnosis: the post-Q5 verdict spinner hangs forever. Three compounding defects â€” the `options` table has no writer (0 rows / 2587 rooms, root cause), the verdict-fire dispatch silently no-ops on unset `app.*` GUCs, and `VerdictPoller` has no timeout. Verdict path has never produced a row.
- [[verdict-dispatch-guc-superuser-blocker|verdict-dispatch-guc-superuser-blocker.md]] â€” 2026-05-18 bug-09 blocker: setting the `app.*` verdict-dispatch GUCs at the database/role level requires a Postgres superuser; Supabase's `postgres` role is not one, so the prescribed migration + CI-step fix cannot land (and the migration would red the shared `supabase-db` lane). Recommends re-triage: HITL dashboard config, or AFK re-scope to read the config from an `app_config` table instead of `current_setting()`.
- [[claim-code-mint-encryption|claim-code-mint-encryption.md]] â€” tb-WF-13 implementation note: why the `claim_codes` refresh token is encrypted application-layer (AES-GCM, in a shared Edge Function helper) with a runtime `CLAIM_CODE_ENC_KEY` secret, rather than via a `pgcrypto` column default that would put the key in the database. Includes the `openssl rand -base64 32` key-generation step.
- [[research/_index|research/]] â€” Time-stamped research bundles that feed ADRs (outline + fields + deep-research outputs).
- [[references/_index|references/]] â€” Processed third-party reference materials (books, papers) whose substance was extracted into vault docs or repo standards.
- [[stack-patterns|stack-patterns.md]] â€” Implementation patterns implied by the current stack (cross-references the active ADR).
- [[verdict-engine|verdict-engine.md]] â€” VerdictEngine architecture: the 0.1.0 worst-off-protecting pipeline (EBA prune + satisficing floor + maximin tiebreak), anonymization rules, Q5-complete firing, and the compute-verdict Edge Function.
- [[foursquare-venue-closure-signal|foursquare-venue-closure-signal.md]] â€” 2026-05-18 investigation + resolution: the post-2025 Foursquare surface has no `closed_bucket`; `date_closed` is effectively never populated (0/300 sampled); out-of-business venues like Pastime pass through unflagged. Resolved via Option B â€” an on-device MapKit closure cross-check (`VenueClosureVerifier`).
- [[places-api-foursquare-vs-google|places-api-foursquare-vs-google.md]] â€” 2026-05-18 provider comparison: Foursquare Places API (current) vs Google Places API (New) on capability, data fields, taxonomy, pricing, and terms. Recommendation: stay on Foursquare â€” finer filterable taxonomy, cache-friendly terms, cheaper at the rich-data tier; Google's storage ToS would forbid the `places-proxy` cache.
- [[google-places-restaurant-fields-2026-06|google-places-restaurant-fields-2026-06.md]] - 2026-06-03 current Google Places API (New) restaurant field surface: identity, location, types, closure status, hours, price, reviews, service booleans, atmosphere, payment, parking, accessibility, summaries, and migration caveats.
- [[places-provider-options-survey-2026-05|places-provider-options-survey-2026-05.md]] â€” 2026-05-19 full market scan of 13 venue-data providers (Google, Yelp, Tripadvisor, Apple MapKit, HERE, TomTom, Mapbox, OSM, Geoapify, Radar, Overture, FSQ OS, Foursquare) with capability + pricing tables. Triggered by the call to drop Foursquare for stale data. Key findings: Mapbox/Overture/FSQ-OS are all Foursquare-derived (no escape); only Google/Yelp self-serve real ratings; Google `businessStatus` is the only reliable closure signal; MapKit is a "what's there" provider with no detail layer and Apple Maps reviews are licensed-in Yelp data with no developer channel. **Decision 2026-05-19: stay on Foursquare for now** â€” cheapest provider that feeds the quiz; staleness accepted and partially mitigated by `VenueClosureVerifier`. The Google-migration analysis is retained in the doc for a future revisit.
- [[waiting-fire-trigger|waiting-fire-trigger.md]] â€” TB-07's S04 Waiting surface, Realtime wiring, verdict-fire trigger + pg_cron auto-fire path, expired-no-quorum terminal.
- [[ratification-push-hardclose|ratification-push-hardclose.md]] â€” TB-08's "I'm in" ratification, push permission prompt (once per session), correctability window + S06 hard-close shutter motion, APNsSender Edge Function with ES256 JWT signing.
- [[checkin-telemetry|checkin-telemetry.md]] â€” TB-14's next-day check-in (S08), CheckinScheduler pg_cron + exactly-once `checkin_dispatches` table, 3-day-no-signal sweeper, TelemetryWriter module + event vocabulary, and the three SQL metric views (`metric_follow_through_pct`, `metric_time_to_verdict_p50`, `metric_invite_acceptance`).
- [[github-actions-secrets|github-actions-secrets.md]] â€” Secret roster for CI, TestFlight upload, Supabase deploys, and live smoke tests; replaces the retired devcontainer setup note.
- [[vibe-embeddings-runtime-secrets|vibe-embeddings-runtime-secrets.md]] - Server-only Supabase Edge Function secret names for the transient Vibe fit embedding path.
- [[apple-keys-setup|apple-keys-setup.md]] â€” Runbook for obtaining and wiring the Apple credentials 0.1.0 needs (App Store Connect API key â†’ CI, Sign in with Apple key â†’ Supabase; MapKit JS skipped).
- [[supabase-setup|supabase-setup.md]] â€” Runbook for provisioning the 0.1.0 Supabase project (Pro plan, extensions postgis/pg_cron/pgmq, anonymous auth, CLI link, GH Actions secret mirror).
- [[ios-ci-setup|ios-ci-setup.md]] â€” Runbook for the iOS CI lane (XcodeGen-driven project generation, macOS-14 runner, Xcode 15.4 pin, Supabase env injection, no-local-Xcode constraint).
- [[ci-trigger-filtering|ci-trigger-filtering.md]] â€” 2026-05-19: `ci.yml` `paths-ignore` skips docs-only changes (`gti-vault/**`, `docs/**`, root `*.md`); why the list is conservative (not blanket `**/*.md`); per-lane filtering deferred.
- [[codex-migration-readiness-audit|codex-migration-readiness-audit.md]] â€” 2026-06-02 completed audit/cleanup for Codex-readable instructions, retired Claude devcontainer setup, migrated skill paths, GitHub issue-tracker contract, and verification runbooks.
- [[codex-project-memory|codex-project-memory.md]] â€” Migrated Claude-era project and working-style memories for Codex sessions; quick orientation only, with current repo docs as authority.
- [[auth-apple-link-testing|auth-apple-link-testing.md]] â€” TB-12 testing split: what CI's state-machine + DB-integration tests cover vs. what only TestFlight (TB-17) can verify against a real Apple Sign-in round-trip.
- [[expo-web-dev-testing|expo-web-dev-testing.md]] - Expo web smoke testing on Windows, including guarded dev-only password auth.
- [[expo-windows-iteration-workflow|expo-windows-iteration-workflow.md]] - Windows-first Expo iteration workflow: web, Expo Go, dev builds, EAS Update, and TestFlight build triggers.
- [[web-fallback-setup|web-fallback-setup.md]] â€” TB-15 operational notes: Vercel `NEXT_PUBLIC_*` env vars, Realtime channel contract, accepted web-side gaps per ADR 0003 / 0007.
- [[asc-privacy-labels|asc-privacy-labels.md]] â€” TB-16 final HITL gate: line-by-line answers for App Store Connect's App Privacy nutrition-labels form, derived from the deployed Privacy Policy + ADR 0006.
- [[swift-to-expo-vault-audit-2026-06-05|swift-to-expo-vault-audit-2026-06-05.md]] - audit of vault docs/issues that still treat the legacy Swift `ios/` app as active after `mobile/` became the active Expo React Native client.
