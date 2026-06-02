## Vault Rules

This is the project knowledge base. You are the librarian — you read, write,
and maintain everything in it. The codebase is where you build; this vault
is where you document.

## Master Index

Vault root has [[_index|_index.md]] — master map of every folder. Read it first to orient, then drill into the relevant folder's own `_index.md`. Update the master index whenever a folder is added, renamed, removed, or its purpose shifts.

## Folder Structure

- 01_raw/                  — inbox for unprocessed notes, dumps, and assets
- 10_prds/                 — product requirements documents (PRDs)
- 20_plan/                 — roadmap, priorities, and session planning
- 30_design/               — design system: tokens, components, previews, briefs (single source of truth)
- 40_marketing_branding/   — positioning, voice, and copy guidelines
- 50_product/              — product vision, decisions, and feature context
- 60_engineering/          — architecture, conventions, runbooks, and ADRs

## Behavior

- Never build anything from this vault. Read and document only.
- When I say "compile", process everything in 01_raw/ into the appropriate
  folder, then clear 01_raw/.
- When I say "audit", review the vault for gaps, inconsistencies, and
  outdated content and report findings.
- Keep all docs concise — bullet points over paragraphs.
- Use [[wiki links]] to cross-reference related docs across folders.
- Each folder must have an _index.md listing its contents with one-line
  descriptions. Keep these up to date as files are added.
- Vault root has _index.md (master index) listing every folder with a
  one-line summary. Keep it current when folders change.
- Use normal repository file edits for vault work. If an Obsidian-specific skill is available, it may help, but it is not required.

## When Reading This Vault

Start at the master `_index.md` at the vault root, then the relevant folder's
`_index.md`, then drill into specific docs. Never read the entire vault
speculatively — pull only what the current task needs.
