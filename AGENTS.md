# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Voice

Default voice should be `/ponytail full`.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Codebase map

- `web/` — Next.js app (App Router, Vercel-deployed).
- `mobile/` — active React Native / Expo iOS app (TypeScript, EAS-built).
- `supabase/` — `migrations/`, edge `functions/`, local `config.toml`, `scripts/`.
- `gti-vault/` — knowledge vault (see below).
- `docs/agents/` — agent contracts (`issue-tracker.md`, `triage-labels.md`, `domain.md`).
- `CONTEXT.md` — single-context domain doc at repo root.

## Vault

`gti-vault/` is the documentation home: PRDs, plans, design notes, marketing/branding, engineering ADRs, raw inbox, and issues (`15_issues/`). Any new long-lived note, decision, spec, or research artifact goes here — not into ad-hoc files at the repo root or inside `web/`/`mobile/`.

**Document everything of substance here.** If a decision, finding, plan, or piece of context would be useful to your future self or another agent, write it into the vault as you go — don't leave it stranded in chat. Skip anything derivable from code, git, or current docs.

## Agent skills

### Issue tracker

Issues are tracked remotely on GitHub. Vault notes in `gti-vault/15_issues/` mirror and document those issues for agent context. See `docs/agents/issue-tracker.md`.

### Verification

Use the command matrix in `docs/agents/verification.md` to choose checks for the files you touched.

### Triage labels

Canonical defaults. Stored as `status:` YAML frontmatter in each issue note. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. `CONTEXT.md` at repo root. ADRs in `gti-vault/60_engineering/adr/`. See `docs/agents/domain.md`.
