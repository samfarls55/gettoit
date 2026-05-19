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
- [[v1.1/_index|v1.1]] — dogfood follow-ups from the 2026-05-14 TestFlight first-install, plus the 2026-05-15 quiz-redesign build slices. **Dogfood batch:** 6 bugs (`bug-01`–`bug-06`), 4 spec-gaps (`sg-01`–`sg-04`), 3 tracer-bullets (`tb-01`–`tb-03`). The initial publish on 2026-05-14 was 11 issues (GitHub #41–#51); `bug-05` (ITMS-90683 location-purpose string) and `bug-06` (#63, legacy-anon S00a bypass) were filed afterward. Two candidates (#2b dynamic OG card, #10 allergy/dietary capture) deferred to the pre-public-launch milestone. **Quiz-redesign batch:** 11 vertical AFK issues (`research-01`, `tb-04`–`tb-13`; GitHub #64–#74) from [[../10_prds/v1.1-quiz-redesign-prd|v1.1-quiz-redesign-prd.md]]. **Q5-wiring batch:** 4 tracer-bullets (`tb-14`–`tb-17`; GitHub #91–#94) from the 2026-05-16 Q5 diagnosis — restore PlacesProxy + wire the orphaned v1.1 Q5 pipeline into the live quiz. **Premium-data follow-ups (2026-05-17):** Foursquare category-id fix (PR #101, shipped) + `tb-18` Q4-vibe-from-`tastes` — triaged 2026-05-18 to `ready-for-agent`, with the allowlist research split out as `research-02` (GitHub #102, #108). **Post-Q5 router fix (2026-05-18):** `bug-07` — post-Q5 router unwired; quiz submit dead-ends to S00 Landing (GitHub #109) — decomposed via `/to-issues` into 2 AFK tracer-bullets (`tb-19`, `tb-20`; GitHub #106–#107). **Verdict-pipeline diagnosis (2026-05-18):** the post-Q5 verdict spinner hangs forever — diagnosed against the live DB to 3 compounding defects, filed `bug-08`–`bug-10` (GitHub #116–#118): candidate-pool + scoring integration unwired (`bug-08`, closed — decomposed into tb-21–tb-23), fire dispatch no-ops on unset DB GUCs (`bug-09`, re-triaged to ready-for-agent/AFK 2026-05-18 — robust plan: URL via migration, key via CI step), resolving poll never times out (`bug-10`, ready-for-agent). Diagnosis: [[../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]]. **Verdict-pipeline integration fix (2026-05-18):** `bug-08`'s architecture fork decided (Option 2, server-side) and decomposed via `/to-issues` into 3 AFK tracer-bullets (`tb-21`–`tb-23`; GitHub #119–#121). **Candidate-pool floor (2026-05-19):** a `/grill-with-docs` session ratified [[../60_engineering/adr/0012-candidate-pool-floor|ADR 0012]] — the candidate-pool floor — and filed `tb-25` (GitHub #133, ready-for-agent) to floor every Foursquare call to an 8-category venue-type allowlist. **Verdict-spinner diagnosis (2026-05-19):** `/diagnose` against TestFlight build 267 split "the app still gets stuck at the verdict screen" into two independent defects (disproving the earlier hung-fetch theory); `/to-issues` filed 4 AFK issues (GitHub #142–#145, ready-for-agent) — post-Q5 router orphaned-host bug (`bug-12`, also reverts the PR #141 `debug_trace` instrumentation), empty-pool engine wedge (`bug-13` server / `bug-14` client), and the wedged-room re-fire (`ops-01`, blocked by `bug-13`).

## Runs

- [[_runs/_index|_runs/]] — AFK execution run logs from `/execute-issues`. One file per run, named `<YYYY-MM-DD-HHmm>-afk-execution-log.md`.
