---
folder: 50_product/research
purpose: Raw research bundles that feed the product synthesis docs (P1/P2/P3)
---

# research — Product research bundles

Time-stamped deep-research outputs whose synthesis lives in [[../framework-comparison|framework-comparison]] / [[../paralysis-cause-priority|paralysis-cause-priority]] / [[../verdict-screen-spec|verdict-screen-spec]]. One subfolder per topic; each is self-contained (outline + fields + per-item results + synthesized report).

## Contents

- [[decision-simplification-frameworks/report|decision-simplification-frameworks/]] — P1. 6 framework JSONs + outline + report. Source for [[../framework-comparison|framework-comparison]].
- [[paralysis-causes/report|paralysis-causes/]] — P2. 6 paralysis-cause JSONs + outline + report. Source for [[../paralysis-cause-priority|paralysis-cause-priority]].
- [[group-fairness-procedural-justice/report|group-fairness-procedural-justice/]] — P3. 7 fairness-construct JSONs + outline + report. Source for [[../verdict-screen-spec|verdict-screen-spec]].

## Convention

Subfolder layout: `outline.yaml`, `fields.yaml`, `generate_report.py`, `report.md`, `results/<item>.json`.

Sibling engineering research lives at [[../../60_engineering/research/_index|60_engineering/research/]] (decisions that crystallize there feed ADRs, not product docs).
