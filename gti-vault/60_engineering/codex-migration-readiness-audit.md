---
title: Codex migration readiness audit
description: Completed migration cleanup for Codex-readable instructions, retired Claude devcontainer setup, and Codex verification entrypoints.
type: audit
status: done
created: 2026-06-02
resolved: 2026-06-02
related:
  - "[[github-actions-secrets]]"
  - "[[ci-trigger-filtering]]"
  - "[[adr/0004-monorepo-layout]]"
---

# Codex Migration Readiness Audit

## Scope

- Reviewed agent-facing docs, local agent config, skills, devcontainer setup, CI workflow, root scripts, and top-level runbooks.
- Follow-up changes landed the same day to make Codex the active agent surface.

## Resolved Changes

1. `AGENTS.md` is the primary repo instruction file; `CLAUDE.md` files are tracked compatibility shims that say `Read AGENTS.md`.
3. Removed the obsolete `.devcontainer/` files and the old devcontainer setup runbook.
4. Added [[github-actions-secrets]] as the durable replacement for the deleted devcontainer secret roster.
5. Made the migrated Codex web-search agent load modules from `.codex/agents/web-search-modules/`.
6. Made the research-deep validator path repo-relative: `.agents/skills/research/validate_json.py`.
7. Fixed the issue-tracker contract: GitHub Issues are the remote tracker; vault issue notes provide local context.
8. Added `docs/agents/verification.md` plus root `npm run verify:*` scripts for Codex check selection.

## Remaining Historical Mentions

- Old run logs, research outputs, and dated issue comments may still mention Claude Code or `.claude` paths as historical record. Those are archival, not active instructions.
