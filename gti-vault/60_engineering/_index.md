---
folder: 60_engineering
purpose: Architecture, conventions, runbooks, ADRs
---

# 60_engineering — Engineering

Architecture, conventions, runbooks, ADRs.

## Contents

- [[adr/_index|adr/]] — Architecture Decision Records (one file per decision, numbered from `0001`).
- [[verdict-path-options-table-never-populated|verdict-path-options-table-never-populated.md]] — 2026-05-18 diagnosis: the post-Q5 verdict spinner hangs forever. Three compounding defects — the `options` table has no writer (0 rows / 2587 rooms, root cause), the verdict-fire dispatch silently no-ops on unset `app.*` GUCs, and `VerdictPoller` has no timeout. Verdict path has never produced a row.
- [[verdict-dispatch-guc-superuser-blocker|verdict-dispatch-guc-superuser-blocker.md]] — 2026-05-18 bug-09 blocker: setting the `app.*` verdict-dispatch GUCs at the database/role level requires a Postgres superuser; Supabase's `postgres` role is not one, so the prescribed migration + CI-step fix cannot land (and the migration would red the shared `supabase-db` lane). Recommends re-triage: HITL dashboard config, or AFK re-scope to read the config from an `app_config` table instead of `current_setting()`.
- [[research/_index|research/]] — Time-stamped research bundles that feed ADRs (outline + fields + deep-research outputs).
- [[stack-patterns|stack-patterns.md]] — Implementation patterns implied by the current stack (cross-references the active ADR).
- [[verdict-engine|verdict-engine.md]] — VerdictEngine architecture: the v1.1 worst-off-protecting pipeline (EBA prune + satisficing floor + maximin tiebreak), anonymization rules, Q5-complete firing, and the compute-verdict Edge Function.
- [[foursquare-venue-closure-signal|foursquare-venue-closure-signal.md]] — 2026-05-18 investigation + resolution: the post-2025 Foursquare surface has no `closed_bucket`; `date_closed` is effectively never populated (0/300 sampled); out-of-business venues like Pastime pass through unflagged. Resolved via Option B — an on-device MapKit closure cross-check (`VenueClosureVerifier`).
- [[places-api-foursquare-vs-google|places-api-foursquare-vs-google.md]] — 2026-05-18 provider comparison: Foursquare Places API (current) vs Google Places API (New) on capability, data fields, taxonomy, pricing, and terms. Recommendation: stay on Foursquare — finer filterable taxonomy, cache-friendly terms, cheaper at the rich-data tier; Google's storage ToS would forbid the `places-proxy` cache.
- [[waiting-fire-trigger|waiting-fire-trigger.md]] — TB-07's S04 Waiting surface, Realtime wiring, verdict-fire trigger + pg_cron auto-fire path, expired-no-quorum terminal.
- [[ratification-push-hardclose|ratification-push-hardclose.md]] — TB-08's "I'm in" ratification, push permission prompt (once per session), correctability window + S06 hard-close shutter motion, APNsSender Edge Function with ES256 JWT signing.
- [[checkin-telemetry|checkin-telemetry.md]] — TB-14's next-day check-in (S08), CheckinScheduler pg_cron + exactly-once `checkin_dispatches` table, 3-day-no-signal sweeper, TelemetryWriter module + event vocabulary, and the three SQL metric views (`metric_follow_through_pct`, `metric_time_to_verdict_p50`, `metric_invite_acceptance`).
- [[devcontainer-setup|devcontainer-setup.md]] — Step-by-step rebuild instructions for the Claude Code devcontainer (toolchain, secrets, allowlist, CI handoff for iOS).
- [[apple-keys-setup|apple-keys-setup.md]] — Runbook for obtaining and wiring the Apple credentials v1 needs (App Store Connect API key → CI, Sign in with Apple key → Supabase; MapKit JS skipped).
- [[supabase-setup|supabase-setup.md]] — Runbook for provisioning the v1 Supabase project (Pro plan, extensions postgis/pg_cron/pgmq, anonymous auth, CLI link, GH Actions secret mirror).
- [[ios-ci-setup|ios-ci-setup.md]] — Runbook for the iOS CI lane (XcodeGen-driven project generation, macOS-14 runner, Xcode 15.4 pin, Supabase env injection, no-local-Xcode constraint).
- [[auth-apple-link-testing|auth-apple-link-testing.md]] — TB-12 testing split: what CI's state-machine + DB-integration tests cover vs. what only TestFlight (TB-17) can verify against a real Apple Sign-in round-trip.
- [[web-fallback-setup|web-fallback-setup.md]] — TB-15 operational notes: Vercel `NEXT_PUBLIC_*` env vars, Realtime channel contract, accepted web-side gaps per ADR 0003 / 0007.
- [[asc-privacy-labels|asc-privacy-labels.md]] — TB-16 final HITL gate: line-by-line answers for App Store Connect's App Privacy nutrition-labels form, derived from the deployed Privacy Policy + ADR 0006.
