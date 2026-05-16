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
- [[v1.1/_index|v1.1]] — dogfood follow-ups from the 2026-05-14 TestFlight first-install, plus the 2026-05-15 quiz-redesign build slices. **Dogfood batch:** 6 bugs (`bug-01`–`bug-06`), 4 spec-gaps (`sg-01`–`sg-04`), 3 tracer-bullets (`tb-01`–`tb-03`). The initial publish on 2026-05-14 was 11 issues (GitHub #41–#51); `bug-05` (ITMS-90683 location-purpose string) and `bug-06` (#63, legacy-anon S00a bypass) were filed afterward. Two candidates (#2b dynamic OG card, #10 allergy/dietary capture) deferred to the pre-public-launch milestone. **Quiz-redesign batch:** 11 vertical AFK issues (`research-01`, `tb-04`–`tb-13`; GitHub #64–#74) from [[../10_prds/v1.1-quiz-redesign-prd|v1.1-quiz-redesign-prd.md]]. **Q5-wiring batch:** 4 tracer-bullets (`tb-14`–`tb-17`; GitHub #91–#94) from the 2026-05-16 Q5 diagnosis — restore PlacesProxy + wire the orphaned v1.1 Q5 pipeline into the live quiz.

## Runs

- [[_runs/_index|_runs/]] — AFK execution run logs from `/execute-issues`. One file per run, named `<YYYY-MM-DD-HHmm>-afk-execution-log.md`.
