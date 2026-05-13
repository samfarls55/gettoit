---
folder: 60_engineering/research
purpose: Research artifacts that feed engineering decisions (precursor to ADRs)
---

# research — Engineering Research

Time-stamped research bundles that inform ADRs. Each subfolder is a self-contained investigation (outline, fields, deep-research outputs, synthesis report).

## Contents

- [[ios-stack-2026-05/_index|ios-stack-2026-05/]] — v1 iOS tech-stack evaluation (May 2026).
- [[foursquare-dietary-tags-2026-05/_index|foursquare-dietary-tags-2026-05/]] — Q1 menu-compliance dietary-tag audit against Foursquare Places API (May 2026). Draft pending live probe.

## Convention

Subfolder name = `<topic-slug>-YYYY-MM`. Each contains at minimum:

- `outline.yaml` — items + execution config
- `fields.yaml` — evaluation field framework
- `_index.md` — status, lens, summary

Research that crystallizes into a decision should be cited from the corresponding ADR in [[../adr/_index|60_engineering/adr/]].
