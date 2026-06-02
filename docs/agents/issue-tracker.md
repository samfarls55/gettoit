# Issue tracker: GitHub Issues + gti-vault

Issues for this repo are tracked remotely in GitHub Issues. The vault keeps durable local context, issue bodies, PRD links, comments worth preserving, and agent run history.

- **Canonical tracker:** GitHub Issues on `samfarls55/gettoit`.
- **Vault context:** markdown notes in `gti-vault/15_issues/`. Each issue note records the remote issue number in `github_issue: NN` frontmatter and may carry richer local context or historical comments.

When the vault file changes in a way that changes the actionable issue body, re-sync the corresponding GitHub issue with `gh issue edit <number> --body-file <vault path>`.

## Conventions

- One feature per subdirectory: `gti-vault/15_issues/<feature-slug>/`
- The PRD lives at either `gti-vault/15_issues/<feature-slug>/PRD.md` or `gti-vault/10_prds/<slug>-prd.md`; the feature folder's `_index.md` always points to the canonical PRD location.
- Implementation issues are `gti-vault/15_issues/<feature-slug>/issues/<NN>-<slug>.md` numbered from `01`. Tracer-bullet build slices use `tb-NN-<slug>.md` so they sort separately from spec-gap or other sub-task issues.
- Triage state is recorded in YAML frontmatter: `status: needs-triage` (see `triage-labels.md` for the role strings).
- Work type for tracer bullets is recorded in YAML frontmatter: `type: AFK` or `type: HITL`.
- GitHub issue number is recorded in YAML frontmatter: `github_issue: NN`.
- Comments and conversation history append to the bottom of the vault file under a `## Comments` heading when they are worth preserving; threaded discussion lives on the GitHub issue.
- Cross-reference related vault content with `[[wikilinks]]` (Obsidian convention).
- Keep `gti-vault/15_issues/_index.md` current — one line per feature directory.
- Keep each `gti-vault/15_issues/<feature>/_index.md` current — one line per issue with GitHub issue number.

## When a skill says "publish to the issue tracker"

1. Write the issue body to a new file under `gti-vault/15_issues/<feature-slug>/`, creating the directory if needed. Apply the correct `status:` and (for tracer bullets) `type:` frontmatter fields.
2. Create the GitHub issue via `gh issue create --repo samfarls55/gettoit` with:
   - Title in the form `TB-NN: <vault title>` for tracer bullets, `spec-gap NN: <vault title>` for spec gaps, or `<feature slug> NN: <vault title>` for other features.
   - Body composed by prepending a `> **Vault context:** [vault path](github blob URL)` line, then stripping the YAML frontmatter from the vault file and appending the rest.
   - Labels matching `status:`, `type:`, the feature slug (e.g. `0.1.0`), and the artifact kind (`tracer-bullet` / `spec-gap`).
3. Capture the returned issue number and add `github_issue: NN` to the vault file's frontmatter.
4. Update both `gti-vault/15_issues/_index.md` and the feature's `_index.md`.

## When a skill says "fetch the relevant ticket"

Read the vault file at the referenced path. If the user references a GitHub issue number, look up the vault file via the `github_issue:` frontmatter field (grep `github_issue: NN` across `gti-vault/15_issues/`).

## Tooling

Use `gh` CLI for GitHub Issues operations (`gh issue create`, `gh issue edit`, `gh issue close`, `gh issue list`). Frontmatter, wikilinks, and tags follow Obsidian Flavored Markdown.

## Closing an issue

When work completes, close on both sides:

1. Update the vault file's `status:` to `done` (or remove it if the issue is genuinely no longer relevant). Append a closing note under `## Comments` if context is worth preserving.
2. `gh issue close <number>` (with optional `--comment` for the closing note).
