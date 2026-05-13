---
report: foursquare-dietary-tags-2026-05
prd: v1-prd
adr: 0002
issue: 15_issues/v1/issues/05-foursquare-dietary-tags
date: 2026-05-12
status: draft-pending-live-probe
---

# Report — Foursquare dietary-tag coverage for v1 Q1 menu-compliance filter

## TL;DR

**Recommended: Option C (narrow the Q1 mechanic to what Foursquare reliably exposes), with a future-facing Option B feedback loop.**

Concretely for v1:

- **Filter at the category level** for `vegan`, `vegetarian`, `halal`, `kosher` — the Foursquare category taxonomy is reliable for these, free-tier, and matches user intent for halal/kosher. For vegan/vegetarian, the category signal undercounts omnivore venues but the cost of false-negatives is acceptable (the user-side narrative becomes "we showed you the safest options first").
- **Filter `gluten-free` at the `tastes` level** if and only if a live probe confirms `tastes` is free-tier and coverage in the beta metro is ≥40%. Surface a copy disclaimer that the filter is menu-callout, not celiac-safe.
- **Do not offer allergen filtering in Q1 in v1.** The data does not exist in Foursquare. Replace the allergen veto chip with a copy disclaimer: `"We can't filter for allergen-safe kitchens — please confirm with the venue before going."`
- **Build the user-correction feedback path** (post-verdict chip `"This place doesn't actually have vegan options"`) so the cache improves over time. Out of v1 critical path, in v1 backlog.

This narrows Lock 1 of the v1 design locks. **Lock 1 needs a one-line update to acknowledge the allergen limitation** — see §spec-change-proposal below.

---

## Per-tag verdict

| Tag | Foursquare signal | v1 verdict |
|---|---|---|
| `vegan` | Category (high confidence, low coverage of menu-compliance) + `tastes` (medium confidence, medium coverage) | **Filter at category level.** Accept undercounting. |
| `vegetarian` | Same as vegan; category clusters with vegan | **Filter at category level.** Accept undercounting; Italian/Indian categories help backfill. |
| `gluten-free` | `tastes` only — no category | **Filter at `tastes` if free-tier; flag celiac disclaimer in rule chip.** Else drop with disclaimer. |
| `halal` | Category (high confidence, near-complete coverage of intent) | **Filter at category level.** Good fit. |
| `kosher` | Category (high confidence, geographically concentrated) | **Filter at category level.** Good fit; thin metros are reality, not data gap. |
| `shellfish-safe` / `nut-safe` / allergens | **None.** | **Drop from Q1 filter in v1.** Surface disclaimer copy when chosen. |

## Decision rules

The recommendation above is **contingent on a live probe** in the beta metro confirming the public-docs picture. If the probe disagrees:

1. **If `tastes` is Premium-only:** drop `gluten-free` filter; keep the four category-level filters as recommended. Cost-floor of [[../../adr/0002-places-data-foursquare-mapkit|ADR 0002]] holds.
2. **If category-level coverage of vegan in the beta metro is < 20 venues:** flip to Option A — infer vegan/vegetarian from cuisine category (`Indian`, `Italian`, `Vegetarian` cluster) until cache user-corrections fill the gap. Lock 1 needs a wider revision in that case.
3. **If Foursquare's free-tier quota is exhausted by a typical v1 daily session shape (~3-5 places searches × ~50 details lookups per session × beta cohort size):** the cache strategy in ADR 0002 has to be more aggressive (longer TTL, broader geo bucket). Re-evaluate ADR 0002 if this happens — that's downstream of this audit.

## Spec-change proposal — Lock 1

The current Lock 1 ([[../../../50_product/v1-design-locks|v1-design-locks.md]]) treats allergens as menu-compliance filters. **Recommend a one-line update:**

> "Allergens (shellfish, nuts, dairy, eggs) are NOT filterable in v1 — Foursquare has no allergen kitchen-protocol data, and no commodity third-party source covers this at scale. When a user chooses an allergen veto in Q1, the surface shows a non-blocking disclaimer (`"We can't filter for allergen-safe kitchens — please confirm with the venue before going."`) and the veto is recorded as a soft signal that surfaces only in the verdict's rule chip and on the place's detail."

This preserves the user's voice (the veto is on the receipt) without making a filter promise the system can't keep. The verdict rule chip in this case would read: `"You said no shellfish. We couldn't verify shellfish-safe kitchens, so please confirm with the venue."` — aggregate-rule register, defers safety to the user.

Tagging this issue with `needs-human-review` so the Lock 1 change can be made deliberately by the product owner (not silently in this audit).

## What couldn't be verified

The audit is **public-docs-only**. The following need a live probe to close:

- Whether `tastes` is gated at Premium tier or free.
- Whether `categories=13377` (vegan) returns ≥20 venues in the beta metro.
- Whether `categories=13351` / `13352` (kosher / halal) coverage matches what community sources (Zabihah, etc.) report for the same metro.
- Whether the free-tier 10k calls/month is sufficient for the beta session shape, given the dietary lookup adds details-endpoint calls per place.

These probes belong to [[../../../15_issues/v1/issues/tb-05-foursquare-placesproxy|TB-05]] (PlacesProxy build). The PlacesProxy implementation should land the probe as a first step before the rest of the tracer bullet.

## Cost implications for ADR 0002

ADR 0002 assumes 10k calls/month is enough. If `tastes` is Premium and we need it for gluten-free, we are forced to either drop gluten-free, accept paid tier, or use a third-party gluten-free DB. None of these break the ADR — but the cost path may shift. Flag for re-evaluation only if the probe shows gluten-free gated and we choose to pay.

## Next steps

1. **HITL:** Product owner reviews the Lock 1 spec-change proposal above. If accepted, edit Lock 1 in `v1-design-locks.md` and update Q1 surface copy (`surfaces/03-quiz.md`) to surface the allergen disclaimer.
2. **TB-00:** Foursquare API key acquisition lands. Without this, no live probe.
3. **TB-05 step 1:** First commit on PlacesProxy is a probe script that runs the four open questions above against the beta metro and writes results back into this bundle as `live-probe-{date}.md`.
4. After probe results land, this report's `status:` flips from `draft-pending-live-probe` to `final` and the conditional rules above either hold or trigger their fallback.
