# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

Workspace currently contains one subdirectory:

- `fio-vault/` — Obsidian knowledge base (PRDs, planning, design system, product, engineering docs). Documentation, not source code — never build features from it. Has its own `CLAUDE.md` with vault-specific rules; load and follow that file when editing anything under `fio-vault/`.

No application code, package manifests, build tooling, or tests exist yet. Do not invent commands or scaffolding that isn't present — when a code project starts here, add real commands at that point.

## Working in `fio-vault/`

- Read `fio-vault/CLAUDE.md` first — defines librarian role, `compile` / `audit` verbs, numbered-folder taxonomy.
- Master index at `fio-vault/_index.md` maps every folder. Read before diving in. Keep current when folders change.
- Each numbered folder has its own `_index.md` for file-level contents. Sync as files are added.
- Cross-reference with `[[wikilinks]]`. Use `obsidian:*` skills for vault edits.
- Reading order: master `_index.md` → folder `_index.md` → specific doc. No speculative scans.

## Working Style

Durable preferences. Apply every session.

### Asking vs assuming
- **Never assume on non-trivial calls.** Stop and ask whenever a choice changes architecture, scope, UX, or has more than one reasonable answer.
- Push through obvious micro-decisions with a stated assumption.
- Many cheap questions beat one wrong path. Batch via `AskUserQuestion` when possible.

### Documentation
- **Document every decision and finding in the vault** — architecture choices, naming rationale, dead-ends, rejected options, third-party quirks, anything a future reader would want.
- **Auto-place.** Pick the right folder, write the doc, report path + one-line summary in the turn output. Don't ask first.
- Use master `_index.md` and folder `_index.md` files to find the right home. Update both when adding a file.
- If no folder fits cleanly, drop in `01_raw/` and flag for `compile`.

### Scope
- **Strict.** Touch only what was asked.
- **Flag adjacencies.** Surface related issues you spot as a separate note so I can decide. No silent fixes, no silent refactors.

### Plan-first
- Single-file or single-feature: dive in after questions answered.
- Cross-cutting / multi-file / architectural: draft step-by-step plan, get sign-off, then execute.

### Verification
- **Run it / test it end-to-end.** Build, run, exercise feature in real environment (browser, CLI, real DB) before reporting done.
- Type-check + tests passing is not "done" by itself.
- Can't actually run it? Say so explicitly. Don't claim success.

### Voice
- **Caveman mode (full) is the default voice.** Drop articles, filler, hedging. Fragments fine. Active every session unless I say "stop caveman" or "normal mode".
- Code, commits, PR descriptions, security warnings, vault docs (other readers): write normal grammatical English.

### Memory
- **Auto-save** user / feedback / project / reference memories as you learn them. Note what was saved in turn summary.
- Skip anything derivable from code, git, or current docs.

## Future Code

When code lands here (likely sibling to `fio-vault/`), update this file with real build, lint, test, run commands. No placeholders.

## Agent skills

### Issue tracker

Issues live in `fio-vault/15_issues/` as markdown notes (vault-based, no remote tracker). See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical defaults. Stored as `status:` YAML frontmatter in each issue note. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. `CONTEXT.md` at repo root. ADRs in `fio-vault/60_engineering/adr/`. See `docs/agents/domain.md`.
