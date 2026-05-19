---
issue: bug-15
title: Pool-floor allows multi-category bars; primary "Bar" leaks into verdict
status: ready-for-agent
type: AFK
github_issue: 152
created: 2026-05-19
prd: v1.1-quiz-redesign-prd
---

# bug-15 — Pool-floor allows multi-category bars; primary "Bar" leaks into verdict

## Parent

[[../_index|v1.1 backlog]] — found during the 2026-05-19 solo-session post-mortem. The companion structural gap to [[../../../60_engineering/adr/0012-candidate-pool-floor|ADR 0012]] / [[tb-25-candidate-pool-floor|TB-25]]: the candidate-pool floor floors *which categories Foursquare returns*, but cannot exclude a bar that *also* carries a floor-eligible category.

## What's broken

A solo session on 2026-05-19 produced the verdict `Robert's Western World` (a Nashville honky-tonk) — confirmed in `gettoit-prod` at room `d11b3983-a8f6-4741-81a5-309ba038a2f6`, verdict computed at `2026-05-19T20:41:15Z`. The stored option payload is:

```
categories = ["Bar", "Burger Joint", "Rock Club"]
```

The Q5 verdict surface (`VerdictStore.swift:276`) renders `categories.first`, so the room sees the verdict displayed as a **Bar** — even though the ADR 0012 floor deliberately omits `Bar` from the eight allowed venue-type categories.

## Root cause

The candidate-pool floor is a **query-time OR allowlist** on Foursquare's `fsq_category_ids` parameter. It restricts which categories *can match*; it does not exclude any venue. Foursquare venues are multi-category — Robert's is tagged `Bar` *and* `Burger Joint` *and* `Rock Club`. `Burger Joint` is a child of the floor's `Restaurant` parent id, so Robert's matches the floor as a Burger Joint and enters the candidate pool legitimately. The `Bar` tag rides along on the shaped row.

Nothing downstream re-checks venue type:

- `shapeFoursquareResult` (`supabase/functions/_shared/foursquare.ts:637`) preserves all Foursquare category names in `payload.categories`, dropping nothing.
- `VerdictEngine.prune` (`supabase/functions/_shared/verdict-engine.ts:480-530`) cuts on dietary tags, allergy tags, and cuisine-NEVERS only — no venue-type prune exists.

So Robert's survives prune, wins the maximin in a 36-option pool of which 5 carry a bar-class tag, and `categories.first` renders it as "Bar."

**Bucket evidence (across all 215 venues in the prod `options` table):**

- **16 venues** have a primary-class nightlife tag and a meal tag riding along — the Robert's mechanism (Robert's, Tin Roof, Mother's Ruin, Acme Feed & Seed, Dierks Bentley's Whiskey Row, the Broadway honky-tonks).
- **19 venues** are food-primary with a nightlife tag in the set — legitimate restaurants that happen to have a bar (Trattoria Il Mulino, J. Alexander's, Ted's Montana Grill, Germantown Cafe, …). These must remain eligible.
- **14 venues** carry no food tag at all — leftover pre-floor leak in older rooms; the floor blocks them in new fetches.

## Desired behavior

A new **shape-time primary-class gate**, applied alongside the existing query-time floor, drops bars and entertainment-complex venues from the candidate pool. Eligible iff *both*:

1. **Primary-class gate.** `categories[0]` is a meal category. Sports Bar and Gastropub count as meal categories (ADR 0012 carve-out + ratified 2026-05-19).
2. **Entertainment-venue backstop.** Even with a meal primary, drop the venue when its category set contains *both* a nightlife tag *and* an entertainment-venue tag (Music Venue / Rock Club / Night Club / Bowling Alley / Stadium). This catches venues like Pinewood Social, Ole Red, and Commodore Grille that are food-primary but functionally entertainment complexes.

Enforced in `shapeFoursquareResult` — the row returns `null` (same path the existing `fsq_place_id` / `name` guards use). Q5 probe, candidate-pool union, and verdict pool all derive from the shaped output, so one enforcement point reaches all three (same architectural shape ADR 0012 used for the query-time floor).

## Known limitations (accepted, documented in ADR 0012 amendment)

- **Foursquare category-ordering noise.** A real restaurant Foursquare tags `Bar`-first (City House `["Bar","Italian Restaurant"]`, The Hampton Social `["Wine Bar","New American Restaurant"]`, Tennessee Brew Works `["Brewery","American Restaurant"]`) will be cut. Accepted: a "Bar"-first venue rendering as a Bar verdict would be worse.
- **Cross-time instability.** The same venue can return with different category ordering on different fetches (Kid Rock's came back as `["Bar","Music Venue","Steakhouse"]` and `["Sports Bar","Music Venue"]` in different rooms). Within a single verdict the rule is deterministic; across nights eligibility may flip. Accepted for v1.1; document in ADR 0012.

## Agent Brief

**Category:** bug
**Summary:** The candidate-pool floor (ADR 0012) is a query-time OR allowlist on Foursquare's `fsq_category_ids` — it cannot exclude a bar that also carries a floor-eligible category. Add a shape-time primary-class gate plus an entertainment-venue backstop, enforced in `shapeFoursquareResult`. ADR 0012 amended to record the new contract and its known limitations.

**Current behavior:** `buildFoursquareQuery` seeds the 8-category floor on the general call. `shapeFoursquareResult` preserves every Foursquare category name verbatim. A multi-category venue (Robert's Western World, `["Bar","Burger Joint","Rock Club"]`) matches the floor's `Restaurant` parent and enters the pool; nothing downstream re-checks venue type; `VerdictStore.swift:276` renders `categories.first` so the verdict reads as a Bar.

**Desired behavior:** `shapeFoursquareResult` returns `null` for any venue whose `categories[0]` is not a meal category, or whose category set contains both a nightlife tag and an entertainment-venue tag. Sports Bar and Gastropub are explicit meal-class carve-outs. Two new exported constants in `supabase/functions/_shared/foursquare.ts` hold the nightlife and entertainment-venue name sets — single source of truth, matched case-insensitively against Foursquare's display strings.

## Acceptance criteria

- [ ] Two new exported constants in `supabase/functions/_shared/foursquare.ts`: `NIGHTLIFE_CATEGORY_NAMES` and `ENTERTAINMENT_VENUE_CATEGORY_NAMES`. Case-insensitive name match. Sports Bar and Gastropub explicitly excluded from `NIGHTLIFE_CATEGORY_NAMES` (carve-outs).
- [ ] `shapeFoursquareResult` returns `null` when (a) `categories[0]` is a name in `NIGHTLIFE_CATEGORY_NAMES` or `ENTERTAINMENT_VENUE_CATEGORY_NAMES`, OR (b) the category set contains at least one nightlife name *and* at least one entertainment-venue name.
- [ ] A venue with no `categories` field, or whose primary is an unrecognized string, is **kept** (don't over-cut on taxonomy drift; the query-time floor already constrained it).
- [ ] Pure unit tests covering each rule branch: primary-bar cut, primary-music-venue cut, primary-meal + nightlife-only kept (Trattoria Il Mulino), primary-meal + nightlife + entertainment-venue cut (Pinewood Social), primary-Sports-Bar kept, primary-Gastropub kept, unknown primary kept.
- [ ] Regression test against the verdict-engine seam: feed the exact 36-option pool from prod room `d11b3983-a8f6-4741-81a5-309ba038a2f6` (capture as fixture from the live row) and assert Robert's Western World is excluded after shape-time filtering. The two surviving bars (`Sports Bar`-primary) remain in the pool.
- [ ] ADR 0012 amended with a new "Shape-time primary-class gate" section: contract, Sports Bar + Gastropub carve-outs, Foursquare-ordering-noise tradeoff, cross-time-instability caveat.
- [ ] `deno test` and the `ios` CI lane green.
- [ ] Vault frontmatter `status: done`; GitHub issue closed; both `_index.md` rows updated.

## Out of scope

- A name-based bar-detection rescue (treat "Saloon"/"Honky Tonk" in the venue name as a nightlife signal). Foursquare names are unreliable; the rule stays category-only.
- A cuisine-restaurant secondary rescue for false-cuts like City House. Trades 3 false-cuts for 1 false-keep (Losers Bar Downtown) and adds taxonomy fragility. Accepted as known limitation; revisit post-cohort.
- Display-side fix to pick a non-Bar category from `categories[]` (lipstick — the bar still wins the verdict).
- Cleanup of pre-floor `options` rows (Bridgestone Arena, pure honky-tonks). Those came from rooms before TB-25 shipped; the fix is forward-looking.
- The `MKPOICategoryRestaurant` raw-enum display leak (separate bug — file when convenient).
