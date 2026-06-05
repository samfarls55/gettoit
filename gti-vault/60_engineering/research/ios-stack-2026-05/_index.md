---
folder: 60_engineering/research/ios-stack-2026-05
purpose: Tech-stack research artifacts for the 0.1.0 iOS stack decision
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# ios-stack-2026-05 â€” Research

Preliminary research artifacts produced by `/research` on 2026-05-12. Feeds the eventual ADR for the 0.1.0 iOS stack.

## Contents

- [[outline|outline.yaml]] â€” Items list (8 stack archetypes for deep research), excluded items, anti-recommendations, execution config.
- [[fields|fields.yaml]] â€” Field framework: basic info, category fit, onboarding, velocity, operational/cost, Apple platform alignment, food vertical, push UX, risk/longevity.
- [[report|report.md]] â€” Synthesized comparison report. TOC table (TTFP / Cost@1k / Perf$ / Lock-in) + per-stack detail by category.
- `generate_report.py` â€” Script that built `report.md` from `results/*.json` + `fields.yaml`. Rerun if data changes.
- `results/` â€” 8 JSON files, one per stack (100% field coverage validated).

## Status

- [x] Preliminary outline + fields generated (2026-05-12)
- [x] Deep research (`/research-deep`) completed (2026-05-12) â€” 8/8 JSON files in `results/`, 100% field coverage
- [x] Synthesis report (`/research-report`) generated (2026-05-12) â€” [[report|report.md]]
- [x] ADR drafted: [[../../adr/0001-ios-tech-stack-supabase|0001 â€” Swift + SwiftUI + Supabase]] (accepted 2026-05-12)

## Deep research uncertainty

`app_clip_support` and `shareplay_groupactivities_fit` are uncertain across all 8 stacks â€” these depend on iOS-side code paths, not the backend. Resolve in synthesis, not re-research. InstantDB has 21/64 uncertain fields â€” material signal of vendor immaturity / sparse public data.

## Priority lens

Balanced â€” ship 0.1.0 fastest without painting into corner. Perf-per-dollar weighs heavy in 0â€“10k DAU. iOS-only; cross-platform stacks dropped.

## Items in deep research

Supabase, Firebase, Convex, Supabase+PowerSync, InstantDB, CloudKit, Nakama, Turso.

## Anti-recommendations

Realm/Atlas Device Sync (EOL), Replicache (maintenance), Zero (no Swift), Triplit (no Swift), Electric SQL Swift (experimental).
