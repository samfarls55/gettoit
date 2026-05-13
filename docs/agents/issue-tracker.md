# Issue tracker: gti-vault

Issues and PRDs for this repo live as markdown notes in `gti-vault/15_issues/`. There is no remote tracker (no GitHub/GitLab/Linear).

## Conventions

- One feature per subdirectory: `gti-vault/15_issues/<feature-slug>/`
- The PRD is `gti-vault/15_issues/<feature-slug>/PRD.md`
- Implementation issues are `gti-vault/15_issues/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded in YAML frontmatter: `status: needs-triage` (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading
- Cross-reference related vault content with `[[wikilinks]]` (Obsidian convention)
- Keep `gti-vault/15_issues/_index.md` current — one line per feature directory

## When a skill says "publish to the issue tracker"

Create a new file under `gti-vault/15_issues/<feature-slug>/`, creating the directory if needed. Update both `gti-vault/15_issues/_index.md` and `gti-vault/_index.md` (master) if a new feature folder is added.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the feature slug + issue number directly.

## Tooling

Use `obsidian:*` skills when editing inside the vault. Frontmatter, wikilinks, and tags follow Obsidian Flavored Markdown.
