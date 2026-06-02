---
title: Agent skills Codex audit
description: Audit of custom user-level and project-level skills after migration from Claude Code to Codex.
type: audit
status: done
created: 2026-06-02
resolved: 2026-06-02
---

# Agent Skills Codex Audit

## Scope

Audited custom skills visible to this Codex session:

- User `.codex/skills`: 5 custom skills.
- User `.agents/skills`: 21 custom skills.
- Project `.agents/skills`: 6 custom skills.
- Project `.codex/skills`: none found.

Codex bundled `.codex/skills/.system` skills were excluded from the main audit.

## Checks Performed

- Confirmed each custom skill has a loadable `SKILL.md` with opening and closing frontmatter.
- Confirmed every custom skill has `name` and `description` metadata and is visible in the session skill list.
- Checked relative markdown references to companion files.
- Scanned for Claude Code-specific tool names, paths, and subagent instructions.
- Checked PATH availability for external commands mentioned by the skills.
- Ran two deterministic helper checks:
  - `node C:\Users\sfarl\.agents\skills\execute-issues\scripts\ready-issues.mjs`
  - `python C:\development\gettoit\.agents\skills\research\validate_json.py --help`

## Findings

### P0: `execute-issues` still contains hard-coded Claude paths and Claude Agent schema

`C:\Users\sfarl\.agents\skills\execute-issues\SKILL.md` still declares the skill directory as `/home/node/.claude/skills/execute-issues/` and tells the agent to run:

```bash
node /home/node/.claude/skills/execute-issues/scripts/ready-issues.mjs
```

That path is not valid in this Windows Codex workspace. The helper script itself does run when addressed at its real path, but following the skill literally will fail.

The same skill also says to spawn via Claude-style fields such as `isolation: "worktree"` and `subagent_type: general-purpose`. Codex exposes multi-agent tools through `multi_agent_v1.spawn_agent` with `agent_type`, and separate Codex thread/worktree creation uses different tooling and explicit user intent.

### P0: project research validator is not runnable with current Python

`C:\development\gettoit\.agents\skills\research\validate_json.py` imports `yaml`, but the available `python` does not have PyYAML installed:

```text
ModuleNotFoundError: No module named 'yaml'
```

`research-deep` requires this validator to pass before task completion, so deep research runs will fail at the validation step unless the dependency is installed or the validator is rewritten without PyYAML.

### P1: project research skills use Claude-only tool names in executable instructions

The project research skill family uses `allowed-tools` and body instructions for `AskUserQuestion`, `WebSearch`, and `Task`. Codex can translate some of those concepts manually, but those names are not the active tool API.

Affected files:

- `C:\development\gettoit\.agents\skills\research\SKILL.md`
- `C:\development\gettoit\.agents\skills\research-add-fields\SKILL.md`
- `C:\development\gettoit\.agents\skills\research-add-items\SKILL.md`
- `C:\development\gettoit\.agents\skills\research-deep\SKILL.md`
- `C:\development\gettoit\.agents\skills\research-report\SKILL.md`

The most risky parts are background `web-search-agent` instructions, `AskUserQuestion` requirements, and "Task Output: Disabled", which do not map one-to-one to Codex behavior.

### P1: several skills assume subagents may be spawned automatically

Codex multi-agent tooling is available, but the current tool contract only permits spawning subagents when the user explicitly asks for subagents, delegation, or parallel agent work. Some skills instruct automatic subagent use after broad trigger phrases.

Affected files:

- `C:\Users\sfarl\.agents\skills\swift-code-review\SKILL.md`
- `C:\Users\sfarl\.agents\skills\improve-codebase-architecture\SKILL.md`
- `C:\Users\sfarl\.agents\skills\workflow-review\SKILL.md`
- `C:\Users\sfarl\.agents\skills\execute-issues\SKILL.md`
- `C:\development\gettoit\.agents\skills\research\SKILL.md`
- `C:\development\gettoit\.agents\skills\research-deep\SKILL.md`

These should include a Codex-safe fallback: perform the scan locally unless the user explicitly authorizes delegated or parallel agent work.

### P1: required external CLIs are missing from PATH

The following commands are referenced by skills but are not currently on PATH:

- `defuddle`, used by `C:\Users\sfarl\.codex\skills\defuddle\SKILL.md`
- `obsidian`, used by `C:\Users\sfarl\.codex\skills\obsidian-cli\SKILL.md`
- `jq`, suggested by `C:\Users\sfarl\.agents\skills\workflow-review\SKILL.md`

Commands present on PATH: `node`, `python`, `gh`, `bash`, `npx`.

### P2: `find-skills` relies on the Skills CLI but it is not globally installed

`C:\Users\sfarl\.agents\skills\find-skills\SKILL.md` assumes `npx skills ...`. `npx` exists, but `npm list -g --depth=0 skills` reports empty. It may still work by downloading the package through `npx`, but Codex network access is restricted and would require escalation.

### P2: `humanizer` metadata is stale but not currently blocking

`C:\Users\sfarl\.agents\skills\humanizer\SKILL.md` says `compatibility: claude-code opencode` and lists Claude-style `allowed-tools`, including `AskUserQuestion`. Codex still loads the skill and the body does not appear to depend on `AskUserQuestion`, so this is metadata cleanup rather than a functional blocker.

### P3: illustrative placeholder links are harmless

The reference checker flagged example links such as `[Source1](url1)`, `[Source2](url2)`, `[text](url)`, and template text pointing to `REFERENCE.md`. These appear to be examples, not broken companion-file references.

## Non-Issues

- All custom `SKILL.md` files are discoverable by Codex.
- No duplicate skill names were found across the custom user and project skill roots.
- Real companion markdown references exist for the Obsidian, TDD, setup, security-audit, architecture, prototype, workflow-review, swift-code-review, and nano-banana skills.
- `execute-issues/scripts/ready-issues.mjs` is present and runs successfully when invoked at its real path.

## Suggested Fix Order

1. Fix `execute-issues` paths and replace Claude Agent schema with Codex thread/subagent instructions.
2. Add PyYAML to the project research runtime or remove the dependency from `validate_json.py`.
3. Rewrite the project research family to use Codex terms: direct chat questions, `web.run` or `web-search-agent` only when authorized, and explicit output files.
4. Add local-fallback wording to `swift-code-review`, `improve-codebase-architecture`, and `workflow-review`.
5. Install or document required CLIs: `defuddle`, `obsidian`, and `jq`.
6. Clean stale compatibility metadata in `humanizer`.

## Fixes Applied

Completed on 2026-06-02:

- `execute-issues` now resolves scripts relative to its own skill directory instead of `/home/node/.claude/...`.
- `execute-issues` no longer names Claude Agent fields (`isolation`, `subagent_type`) as executable instructions; it now requires explicit Codex delegation/worktree authorization.
- `execute-issues` cleanup snippets use `<repoRoot>` instead of `/workspace`.
- `research`, `research-add-fields`, `research-add-items`, `research-deep`, `research-report`, and `logo-concepts` no longer depend on `AskUserQuestion`, `WebSearch`, `Task`, `allowed-tools`, or hidden task-output behavior.
- `research/validate_json.py` now works without PyYAML for the generated `field_categories` schema and reads BOM/non-BOM UTF-8 files.
- `swift-code-review`, `improve-codebase-architecture`, and `workflow-review` now perform scans directly unless the user explicitly authorized delegated or parallel agent work.
- `workflow-review` and `setup-matt-pocock-skills` now allow JSON parsing without `jq`.
- `defuddle`, `obsidian-cli`, and `find-skills` now document Codex-safe fallback/approval behavior when their external CLIs are missing or network access is restricted.
- `humanizer` no longer carries stale Claude/opencode compatibility and `allowed-tools` metadata.
- Slash-command skills now carry `user-invocable: true`: `caveman`, `execute-issues`, `logo-concepts`, `research`, `research-add-fields`, `research-add-items`, `research-deep`, `research-report`, `swift-code-review`, `triage`, and `workflow-review`.

## Verification After Fix

- `python .agents/skills/research/validate_json.py --help` passes.
- `validate_json.py` passes against a minimal generated `fields.yaml` and JSON fixture without PyYAML installed.
- `node C:\Users\sfarl\.agents\skills\execute-issues\scripts\ready-issues.mjs` runs successfully from the repo root.
- Scan across custom `SKILL.md` files found no remaining active matches for: `allowed-tools`, `AskUserQuestion`, `WebSearch`, `Task Output: Disabled`, `/home/node`, `.claude`, `subagent_type`, `isolation:`, `Edit tool`, `inline jq is fine`, or `Use the Agent tool`.
- Scan across custom skills confirmed every skill that advertises its own `/command` has `user-invocable: true`.

## Remaining External Prerequisites

These were documented but not installed:

- `defuddle`, for the `defuddle` skill.
- `obsidian`, for the `obsidian-cli` skill.
- `jq`, optional for workflow and GitHub issue JSON shaping.
- `npx skills`, which may require network approval when uncached.
