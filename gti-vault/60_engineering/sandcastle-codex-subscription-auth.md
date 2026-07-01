---
title: Sandcastle Codex subscription auth
description: Local Sandcastle setup for using host Codex subscription auth instead of an OpenAI API key.
type: runbook
status: active
created: 2026-06-03
related:
  - "[[codex-project-memory]]"
---

# Sandcastle Codex Subscription Auth

Sandcastle is configured to run `codex()` agents in Docker with the host's Codex subscription login instead of an OpenAI API key.

The key rule: do not mount the full `~/.codex` directory into a sandbox. `.sandcastle/main.mts` mounts only `~/.codex/auth.json` read-only at `/home/agent/codex-auth.json`, then copies it into sandbox-local `CODEX_HOME`.

## 2026-06-26 Clean Sandcastle Comparison

Compared local `.sandcastle/` with a shallow clone of `mattpocock/sandcastle` at commit `2d93226d37da129c54d4ecfd5b370122b48b31b2` on `main`.

Summary: this repo does not contain a clean copy of upstream `.sandcastle/`. It replaces upstream's Claude Code runner with a smaller project-specific `main.mts` that runs Sandcastle through the Codex CLI using the host Codex subscription login.

Codex subscription changes:

- Upstream `.sandcastle/run.ts` uses `sandcastle.claudeCode("claude-opus-4-8")` for planner, implementer, reviewer, and merger agents. Local `.sandcastle/main.mts` uses `sandcastle.codex(...)` through a local `codexAgent()` wrapper.
- Upstream `.sandcastle/.env.example` asks for `ANTHROPIC_API_KEY` and `GH_TOKEN`. Local `.sandcastle/.env.example` removes provider API keys and documents `codex login` plus `~/.codex/auth.json`; it still asks for `GH_TOKEN` for GitHub Issues.
- Upstream Docker installs Claude Code with `curl -fsSL https://claude.ai/install.sh | bash` and adds it to `PATH`. Local Docker installs the OpenAI Codex CLI with `npm install -g @openai/codex`.
- Local `main.mts` checks for host `~/.codex/auth.json` before running and fails with an instruction to run `codex login` if it is missing.
- Local Docker sandbox mounts only host `~/.codex/auth.json` read-only at `/home/agent/codex-auth.json`.
- Local sandbox hooks copy that file into sandbox-local `CODEX_HOME=/home/agent/.codex/auth.json` with mode `600`, so Codex runs as a logged-in CLI instead of using an API key.
- Local Codex session storage is redirected to host `~/.sandcastle/codex-sessions` and sandbox `/home/agent/.codex/sessions`, keeping session data outside the repo worktree.
- Local `GIT_CONFIG_GLOBAL` points at `.sandcastle/gitconfig` inside the writable workspace, avoiding failures when the aligned container user cannot write `/home/agent/.gitconfig`.
- Local `codexAgent()` supports an optional `serviceTier: "fast"` by appending `-c 'service_tier="fast"'` to the Codex print command. Current calls do not pass `serviceTier`, so this is available but inactive.

Other local changes found during the comparison:

- Upstream has `.sandcastle/agent-workflows/**`, `test-podman.ts`, `test-vercel.ts`, and `test-interactive.ts`; local `.sandcastle/` omits those and uses only `main.mts` plus four prompts.
- Local planner output is parsed with `sandcastle.Output.object({ tag: "plan", schema: planSchema })` and Zod instead of manual regex plus `JSON.parse`.
- Local planning uses GitHub label `AFK`; upstream uses `ready-for-agent`.
- Local issue IDs are strings named `id`; upstream uses numeric `number`.
- Local implementer/reviewer/merge prompts were tightened to avoid broad scans, use `docs/agents/verification.md`, and exclude `.sandcastle/**`, `node_modules/**`, `.next/**`, build outputs, generated caches, and prior worktrees.
- Local dependency hooks run `npm ci` at the repo root and conditionally in `web/` and `mobile/`, instead of upstream's `npm install && npm run build`.
- Local reviewer failure does not discard implementer commits.
- Local Docker also installs `ripgrep`.
- `.sandcastle/.env` is ignored and was not copied into the report; its variable names include a stale `OPENAI_KEY`, but `rg` found no `.sandcastle`, `package.json`, or `package-lock.json` references to it. The tracked `.env.example` is the source of truth and no longer asks for OpenAI API-key auth.

## 2026-06-04 Performance Finding

Do not place sandbox `CODEX_HOME` under `/home/agent/workspace`. The original Codex-subscription setup used `/home/agent/workspace/.sandcastle/codex-home`; logs later showed agents searching through `.sandcastle/codex-home/.tmp/plugins`, session JSONL, and cached plugin files during normal `find .` / fallback exploration. That made Sandcastle runs look like multi-million-token context windows and slowed issue work substantially.

Implemented shape:

- Sandbox `CODEX_HOME` is `/home/agent/.codex`, outside `/home/agent/workspace`.
- Captured Codex sessions are stored on the host under `~/.sandcastle/codex-sessions`, outside the repo.
- The Docker image installs `ripgrep` so agents do not fall back to broad `find` / `grep -R` scans over ignored directories.
- Planner and merger hooks skip dependency install; implementer and reviewer sandboxes run dependency setup before agents start so dependency discovery does not burn model turns.
- Implementer and reviewer prompts explicitly avoid broad scans and exclude `.sandcastle/**`, `node_modules/**`, `.next/**`, build outputs, generated caches, and prior worktrees.
- Reviewer failure no longer discards implementer commits. If the reviewer crashes after the implementer committed work, the issue still proceeds to the merge phase with the implementer result.
- Remove stale `.sandcastle/worktrees/*` directories after extracting any needed artifacts; those nested repo copies are ignored by git but visible to shell searches.

`GIT_CONFIG_GLOBAL` points at `/home/agent/workspace/.sandcastle/gitconfig` so Git writes global config into the writable worktree instead of `/home/agent/.gitconfig`, which can be unwritable when container UID/GID alignment differs.

Host prerequisite: run `codex login` before starting Sandcastle. `.sandcastle/.env.example` no longer asks for `OPENAI_KEY`; it still needs `GH_TOKEN` for GitHub Issues access.
