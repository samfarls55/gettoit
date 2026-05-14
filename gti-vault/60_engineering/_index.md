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
- [[devcontainer-setup|devcontainer-setup.md]] — Step-by-step rebuild instructions for the Claude Code devcontainer (toolchain, secrets, allowlist, CI handoff for iOS).
- [[apple-keys-setup|apple-keys-setup.md]] — Runbook for obtaining and wiring the Apple credentials v1 needs (App Store Connect API key → CI, Sign in with Apple key → Supabase; MapKit JS skipped).
- [[supabase-setup|supabase-setup.md]] — Runbook for provisioning the v1 Supabase project (Pro plan, extensions postgis/pg_cron/pgmq, anonymous auth, CLI link, GH Actions secret mirror).
- [[ios-ci-setup|ios-ci-setup.md]] — Runbook for the iOS CI lane (XcodeGen-driven project generation, macOS-14 runner, Xcode 15.4 pin, Supabase env injection, no-local-Xcode constraint).
