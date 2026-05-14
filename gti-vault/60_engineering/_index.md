---
folder: 60_engineering
purpose: Architecture, conventions, runbooks, ADRs
---

# 60_engineering — Engineering

Architecture, conventions, runbooks, ADRs.

## Contents

- [[adr/_index|adr/]] — Architecture Decision Records (one file per decision, numbered from `0001`).
- [[research/_index|research/]] — Time-stamped research bundles that feed ADRs (outline + fields + deep-research outputs).
- [[stack-patterns|stack-patterns.md]] — Implementation patterns implied by the current stack (cross-references the active ADR).
- [[verdict-engine|verdict-engine.md]] — VerdictEngine architecture, EBA order, anonymization rules, and the canon for TB-06's clean-run path.
- [[waiting-fire-trigger|waiting-fire-trigger.md]] — TB-07's S04 Waiting surface, Realtime wiring, verdict-fire trigger + pg_cron auto-fire path, expired-no-quorum terminal.
- [[ratification-push-hardclose|ratification-push-hardclose.md]] — TB-08's "I'm in" ratification, push permission prompt (once per session), correctability window + S06 hard-close shutter motion, APNsSender Edge Function with ES256 JWT signing.
- [[checkin-telemetry|checkin-telemetry.md]] — TB-14's next-day check-in (S08), CheckinScheduler pg_cron + exactly-once `checkin_dispatches` table, 3-day-no-signal sweeper, TelemetryWriter module + event vocabulary, and the three SQL metric views (`metric_follow_through_pct`, `metric_time_to_verdict_p50`, `metric_invite_acceptance`).
- [[devcontainer-setup|devcontainer-setup.md]] — Step-by-step rebuild instructions for the Claude Code devcontainer (toolchain, secrets, allowlist, CI handoff for iOS).
- [[apple-keys-setup|apple-keys-setup.md]] — Runbook for obtaining and wiring the Apple credentials v1 needs (App Store Connect API key → CI, Sign in with Apple key → Supabase; MapKit JS skipped).
- [[supabase-setup|supabase-setup.md]] — Runbook for provisioning the v1 Supabase project (Pro plan, extensions postgis/pg_cron/pgmq, anonymous auth, CLI link, GH Actions secret mirror).
- [[ios-ci-setup|ios-ci-setup.md]] — Runbook for the iOS CI lane (XcodeGen-driven project generation, macOS-14 runner, Xcode 15.4 pin, Supabase env injection, no-local-Xcode constraint).
- [[auth-apple-link-testing|auth-apple-link-testing.md]] — TB-12 testing split: what CI's state-machine + DB-integration tests cover vs. what only TestFlight (TB-17) can verify against a real Apple Sign-in round-trip.
- [[web-fallback-setup|web-fallback-setup.md]] — TB-15 operational notes: Vercel `NEXT_PUBLIC_*` env vars, Realtime channel contract, accepted web-side gaps per ADR 0003 / 0007.
