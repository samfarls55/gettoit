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
