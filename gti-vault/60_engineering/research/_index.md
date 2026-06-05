---
folder: 60_engineering/research
purpose: Research artifacts that feed engineering decisions (precursor to ADRs)
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# research â€” Engineering Research

Time-stamped research bundles that inform ADRs. Each subfolder is a self-contained investigation (outline, fields, deep-research outputs, synthesis report).

## Contents

- [[ios-stack-2026-05/_index|ios-stack-2026-05/]] â€” 0.1.0 iOS tech-stack evaluation (May 2026).
- [[foursquare-dietary-tags-2026-05/_index|foursquare-dietary-tags-2026-05/]] â€” Q1 menu-compliance dietary-tag audit against Foursquare Places API (May 2026). Draft pending live probe.
- [[foursquare-filter-surface-2026-05/_index|foursquare-filter-surface-2026-05/]] â€” Foursquare fetch-time filter surface + venue-metadata mapping for the 0.1.0 quiz redesign (May 2026). Fixes the reputation + vibe axis scorer inputs and the per-member fetch planner's filter set. Closes research-01.
- [[foursquare-tastes-vibe-2026-05/_index|foursquare-tastes-vibe-2026-05/]] â€” live-sampled Foursquare `tastes` token-frequency table + curated vibe-token allowlist for the 0.1.0 Q4 vibe classifier (May 2026). 30 direction-tagged tokens; measures `tastes` coverage at 66.8%. Closes research-02; consumed by tb-18.

## Convention

Subfolder name = `<topic-slug>-YYYY-MM`. Each contains at minimum:

- `outline.yaml` â€” items + execution config
- `fields.yaml` â€” evaluation field framework
- `_index.md` â€” status, lens, summary

Research that crystallizes into a decision should be cited from the corresponding ADR in [[../adr/_index|60_engineering/adr/]].
