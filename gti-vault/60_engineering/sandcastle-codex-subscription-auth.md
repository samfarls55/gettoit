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

The key rule: do not mount the full `~/.codex` directory into a sandbox. `.sandcastle/main.mts` mounts only `~/.codex/auth.json` read-only at `/tmp/codex-auth.json`, then copies it into sandbox-local `CODEX_HOME` at `/home/agent/workspace/.sandcastle/codex-home`.

`GIT_CONFIG_GLOBAL` points at `/home/agent/workspace/.sandcastle/gitconfig` so Git writes global config into the writable worktree instead of `/home/agent/.gitconfig`, which can be unwritable when container UID/GID alignment differs.

Host prerequisite: run `codex login` before starting Sandcastle. `.sandcastle/.env.example` no longer asks for `OPENAI_KEY`; it still needs `GH_TOKEN` for GitHub Issues access.
