---
issue: tb-SA-4
title: Density preview pins
status: ready-for-agent
type: AFK
feature: 0.1.0
artifact: tracer-bullet
created: 2026-06-03
parent_github_issue: 316
github_issue: 321
---

# tb-SA-4 - Density preview pins

## Parent

[[../search-area-picker-prd|Search area picker PRD]] - GitHub #316.

## User Stories Covered

US 16-20.

## What to build

Add **Density preview pins** to the Search area editor.

After map movement settles, run a broad Apple MapKit food/dining search around the draft Search area. Render only pins inside the selected circle, capped around 20 visible pins. The pins help the user size the Search area; they are not candidates, recommendations, venue details, or final options.

Pins are non-interactive. No cards, detail payloads, cuisine filters, quiz filters, open-now filters, ranking, or Candidate pool eligibility should be introduced in this editor. Empty preview results or preview fetch failure must not block committing the Search area.

## Acceptance criteria

- [ ] Density preview refresh starts only after map movement settles or debounces.
- [ ] Preview search uses broad Apple MapKit food/dining scope.
- [ ] Rendered pins are filtered to the selected circle.
- [ ] Visible pins are capped around 20.
- [ ] Pins are non-interactive and do not open cards or details.
- [ ] Preview data is not treated as Candidate pool membership or ranking.
- [ ] Empty preview results still allow `USE THIS AREA`.
- [ ] Preview fetch failure still allows `USE THIS AREA`.
- [ ] Tests cover debounce/idle refresh, circle filtering, cap behavior, non-interaction, and non-blocking empty/failure paths.

## Blocked by

- [[tb-sa-2-map-viewport-selection-editor|tb-SA-2 - Map viewport selection editor]] (GH [#319](https://github.com/samfarls55/gettoit/issues/319))
