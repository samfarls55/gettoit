---
issue: tb-18
title: Q4 vibe energy from the Foursquare tastes signal
status: ready-for-agent
type: AFK
github_issue: 102
prd: v1.1-quiz-redesign-prd
created: 2026-05-17
related:
  - "[[tb-16-q5-factorial-card-selection]]"
  - "[[tb-09-preference-function-axis-scorers]]"
  - "[[research-02-tastes-vibe-token-allowlist]]"
---

# tb-18 — Q4 vibe energy from the Foursquare `tastes` signal

## Parent

[[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — module (E) axis scorers, vibe axis.

## Background

[[tb-16-q5-factorial-card-selection|tb-16]] shipped the live Q4 vibe axis, but its `Q5VenueClassifier` infers a venue's energy (Quiet → Chill → Social → Lively → Rowdy) from a **category-archetype baseline table** plus a one-step `priceTier` tie-break — i.e. "all steakhouses read as energy X." That is an inference, a free-tier-era workaround chosen because no real per-venue vibe signal was available.

A 2026-05-17 audit of the now-paid Foursquare premium fields found Q4 vibe is the **only** v1.1 quiz axis still on a free-tier-era workaround (Q1 cuisine, Q2 spend, Q3 reputation are all on the right mechanism). Premium fields evaluated as a vibe signal:

- **`tastes`** — a crowd-sourced free-text tag cloud. Carries genuine vibe tokens (`quiet`, `lively`, `trendy`, `romantic`, `crowded`, `good for groups`, `intimate`, `cozy`, `casual`, `spacious`) but buried in folksonomy noise (`trains`, `hummingbirds`, chef names) at ~76% venue coverage.
- **`attributes`** — amenities only (`outdoor_seating`, `wifi`, `reservations`, `delivery`) — **not** atmosphere data. Dead end for vibe. (Useful elsewhere — see [[../service-shape-attributes-unbacked|service-shape-attributes-unbacked]].)
- **`popularity`** — 0..1 score, value-crushed near 1.0 in dense areas; no better than `total_ratings`.
- **`hours_popular`** — busy-hours-by-day; weak indirect energy proxy.

Conclusion: `tastes` via a curated allowlist is the only real vibe upgrade — **incremental, not a silver bullet**. `tastes` is already in the proxy's `fields` list (already paid for), so consuming it adds no API cost.

## Design — locked during triage (2026-05-18)

A `/grill-with-docs` session resolved the open design questions. The vibe score is a **weighted blend**: the category-archetype table stays the baseline; the `tastes` signal applies a bounded nudge.

Classifier precedence for a venue's vibe value:

1. **Category-archetype baseline** (0–4) — the tb-16 table, unchanged.
2. **`tastes` nudge** — if the venue has ≥1 token matching the curated allowlist, nudge the baseline by the **sign** of the summed token tags, **capped at ±1 step**. Applies whether or not an archetype matched (a `tastes` nudge on a *matched* archetype is the point — it splits two same-category venues).
3. **Else** `priceTier` tie-break (±1, archetype-unmatched only) — the existing tb-16 behavior, demoted to last-resort: it now fires only when `tastes` contributed nothing.
4. Clamp to 0–4.

`tastes` and `priceTier` are mutually exclusive, so total drift from the baseline is always ≤ ±1.

**Allowlist contract** (produced by [[research-02-tastes-vibe-token-allowlist|research-02]]): a flat list of tokens, each tagged `+1` (loud-leaning) or `-1` (quiet-leaning). The classifier sums the tags of a venue's matched tokens; the nudge is the sign of that sum (`-1` / `0` / `+1`). A balanced or conflicting venue nets to `0` → no nudge. No per-token magnitude — direction-only. No minimum token count — one matched token may nudge.

**Plumbing.** `tastes` is fetched by the places-proxy but is **not** currently decoded into the iOS venue model — there is no `tastes` field on `ShapedPlace`. This issue must thread it from the proxy response through `PlacesService` onto `ShapedPlace` before the classifier can read it.

**Out of scope — graded axis.** The PRD's open "graded axis in the factorial" question is *not* reopened here. It was already resolved by [[research-01-foursquare-filter-surface|research-01]] §6 (interpretation C — "drop the vibe axis" = widen the tolerance band). That governs how the factorial *toggles* the axis; it is orthogonal to where the vibe *score's data* comes from, which is all this issue changes.

## Acceptance criteria

- [ ] `tastes` is decoded from the places-proxy response onto the iOS venue model (`ShapedPlace`).
- [ ] `Q5VenueClassifier` computes the vibe value per the locked precedence above: archetype baseline → `tastes` nudge (±1, sign of summed allowlist-token tags, matched or unmatched archetype) → else `priceTier` tie-break (±1, unmatched only) → clamp 0–4.
- [ ] A venue with no matching `tastes` tokens classifies **exactly** as tb-16 does today — no regression on the ~24% with absent/sparse `tastes`.
- [ ] The classifier consumes the research-02 allowlist; if research-02's note is not yet final, the issue is blocked.
- [ ] Tests cover: a token-rich venue that nets a nudge, a conflicting-token venue that nets `0` (no nudge), a no-`tastes` venue (archetype path), and a matched-archetype venue that `tastes` nudges off its category baseline.
- [ ] `ios` test lane is green.

## Blocked by

- [[research-02-tastes-vibe-token-allowlist|research-02]] ([#108](https://github.com/samfarls55/gettoit/issues/108)) — the curated `tastes` allowlist this classifier consumes.

## Comments

**2026-05-17 — filed `needs-triage`.** Surfaced by the premium-data audit; needed a research/design pass before it could be specified.

**2026-05-18 — triaged (`ready-for-agent`, AFK).** A `/grill-with-docs` session locked the blend design (see §"Design — locked during triage"). The live-data allowlist build was split out into [[research-02-tastes-vibe-token-allowlist|research-02]]; this issue is now the implementation tracer-bullet, blocked by it. Agent brief below.

### Agent Brief

> *This was generated by AI during triage.*

**Category:** enhancement
**Summary:** Upgrade the Q5 vibe classifier from a category-archetype-only inference to a category-archetype baseline blended with a bounded `tastes`-token nudge.

**Current behavior:**
`Q5VenueClassifier` derives a venue's vibe (0–4, Quiet→Rowdy) from a category-archetype baseline table plus a `priceTier` tie-break that nudges ±1 only when no archetype matched. Two venues in the same category get an identical vibe. The Foursquare `tastes` field is fetched by the places-proxy but discarded — it is never decoded onto the iOS venue model.

**Desired behavior:**
The vibe value is a weighted blend. The category archetype stays the baseline; a curated `tastes`-token allowlist applies a bounded nudge so same-category venues can differ. Precedence: archetype baseline → `tastes` nudge (±1, the sign of the summed ±1 allowlist-token tags of the venue's matched tokens, applied whether or not an archetype matched) → else `priceTier` tie-break (±1, unmatched archetype only) → clamp 0–4. `tastes` and price are mutually exclusive; drift from baseline is always ≤ ±1. A venue with no matching `tastes` tokens must classify exactly as it does today.

**Key interfaces:**
- The iOS venue model (`ShapedPlace`) needs a `tastes` field decoded from the places-proxy / Foursquare response (the proxy already requests it).
- `Q5VenueClassifier`'s vibe classification — the `tastes` nudge slots in as the secondary signal; the `priceTier` tie-break drops to last-resort.
- The allowlist constant — a flat token→(`+1`/`-1`) map, transcribed from the research-02 vault note.

**Acceptance criteria:**
- [ ] `tastes` is decoded onto `ShapedPlace` from the proxy response.
- [ ] Vibe is computed per the precedence above.
- [ ] A venue with no matching `tastes` tokens classifies exactly as tb-16 does today (no regression on absent/sparse `tastes`).
- [ ] The allowlist is sourced from the research-02 note.
- [ ] Tests cover a token-rich venue (nets a nudge), a conflicting-token venue (nets `0`), a no-`tastes` venue (archetype path), and a matched-archetype venue that `tastes` nudges.
- [ ] `ios` test lane green.

**Out of scope:**
- Sampling / curating the `tastes` allowlist — that is research-02.
- The graded-axis / "drop the vibe axis" factorial question — resolved by research-01 §6, not reopened here.
- `attributes`, `popularity`, `hours_popular` as vibe signals — ruled out by the 2026-05-17 audit.
- Per-token magnitude weights — the grill locked direction-only tags.
