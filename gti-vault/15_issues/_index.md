---
folder: 15_issues
purpose: Issue tracker — features, PRDs, and implementation tickets
---

# 15_issues — Index

Vault-based issue tracker. One subdirectory per feature; each holds the PRD plus numbered implementation issues.

## Conventions

- `<feature-slug>/PRD.md` — product requirements doc
- `<feature-slug>/issues/<NN>-<slug>.md` — implementation tickets, numbered from `01`
- Triage state in YAML frontmatter: `status: needs-triage | needs-info | ready-for-agent | ready-for-human | wontfix`
- Cross-reference with `[[wikilinks]]`. Append discussion under `## Comments` at the bottom of each note.

See `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md` for the full agent contract.

## Features

- [[v1/_index|v1]] — v1 PRD implementation issues. Tracer-bullet build slices (`tb-00`–`tb-17`) + design-system spec-gap issues (S01 controls, S04 Decide-now, S05 read-only, S05 no-survivor, Foursquare tag research). PRD at [[../10_prds/v1-prd|10_prds/v1-prd.md]].
- [[v1.1/_index|v1.1]] — dogfood follow-ups from 2026-05-14 TestFlight first-install. 11 issues published 2026-05-14 (GitHub #41–#51): 4 bugs (`bug-01`–`bug-04`), 4 spec-gaps (`sg-01`–`sg-04`), 3 tracer-bullets (`tb-01`–`tb-03`). Two candidates (#2b dynamic OG card, #10 allergy/dietary capture) deferred to the pre-public-launch milestone.
