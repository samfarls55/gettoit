---
report: foursquare-tastes-vibe-2026-05
prd: v1.1-quiz-redesign-prd
issue: 15_issues/v1.1/issues/research-02-tastes-vibe-token-allowlist
date: 2026-05-18
status: final
---

# Report — Foursquare `tastes` vibe-token allowlist

## Purpose

This is the research spike that issue [[../../../15_issues/v1.1/issues/research-02-tastes-vibe-token-allowlist|research-02]] calls for. It is a **research deliverable — no application code ships.**

The v1.1 quiz's Q4 vibe axis ([[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] module (E)) currently infers a venue's energy (Quiet -> Chill -> Social -> Lively -> Rowdy) from a category-archetype baseline table — "all steakhouses read as energy X." [[../../../15_issues/v1.1/issues/tb-18-q4-vibe-tastes-signal|tb-18]] upgrades that with a bounded nudge from the Foursquare `tastes` field. tb-18's `/grill-with-docs` session locked the *consumption* contract; this spike produces the *data* it consumes: a curated, direction-tagged allowlist of `tastes` tokens, derived from a live sample.

The output here is consumed by exactly one thing: tb-18's `Q5VenueClassifier`, which transcribes [section 4's allowlist](#4-the-curated-vibe-token-allowlist) into a classifier constant verbatim.

## TL;DR

- **Observed `tastes` coverage is 66.8%**, not the ~76% the tb-18 ticket guessed. The figure is corrected here (section 3). Coverage is strongly category-dependent: restaurants 83%, bars 75%, cafes/coffee shops only 44%.
- A live sample of **1090 unique venues** (8 US metros x 3 categories) yielded **2732 distinct `tastes` tokens** — overwhelmingly folksonomy noise (dish names, meal slots, ingredients). Genuine atmosphere tokens are a thin seam in that cloud.
- The curated **vibe-token allowlist is 30 tokens** — 16 loud-leaning (`+1`), 14 quiet-leaning (`-1`). It is in section 4 as a flat list and as a machine artifact at [`data/vibe-token-allowlist.json`](data/vibe-token-allowlist.json).
- The single biggest curation finding: most "atmosphere-ish" high-frequency tokens (`casual`, `cute`, `good for special occasions`, `spacious`) are **not energy-directional** and were excluded. `casual` (the #1 atmosphere-adjacent token, 56% of venues) does not tell you loud-vs-quiet — it was cut. See section 5.

## 1. Method

### 1.1 Sampling

The sampler script — [`sample-tastes.ts`](sample-tastes.ts) — pulls the live Foursquare `GET /places/search` surface (host `places-api.foursquare.com`, API version `2025-06-17`, matching `supabase/functions/_shared/foursquare.ts`). It is a spike script, not wired into the proxy.

Pool design — a representative spread, deliberately not single-city:

- **8 US metros**: New York, Los Angeles, Chicago, Austin, Seattle, Nashville, Denver, Portland ME. Dense + mid-size, spread across regions, to dilute any one city's folksonomy bias.
- **3 categories**: Restaurant, Bar, Cafe / Coffee Shop (Foursquare top-level taxonomy ids). These are the venue kinds the v1.1 quiz ever feeds the classifier, and they span the energy spectrum the Q4 axis cares about — quiet cafes through loud bars.
- 50 results per (metro x category) call = 24 calls, deduped by `fsq_place_id` (first sighting wins) -> **1090 unique venues**.

`tastes` is already in the proxy's `fields` csv, so this sample added **no new API cost dimension** — it is the same field shape the proxy already pays for.

### 1.2 Aggregation

For each venue with a non-empty `tastes` array, every token was lowercased + trimmed (so `Toro`/`toro` fold together — the classifier matches case-insensitively too) and counted **once per venue**. The frequency table is venue-document-frequency, not raw term-frequency: "how many venues carry this token", which is what matters for the classifier's per-venue match.

Raw per-venue data: [`data/raw-sample.json`](data/raw-sample.json). Aggregated table: [`data/token-frequency.json`](data/token-frequency.json).

### 1.3 Reproducing

```
FOURSQUARE_API_KEY=... deno run --allow-env --allow-net --allow-write --allow-read \
  gti-vault/60_engineering/research/foursquare-tastes-vibe-2026-05/sample-tastes.ts
```

The `tastes` cloud is crowd-sourced and drifts; a re-run on a later date will not reproduce the table token-for-token. The **2026-05-18 sample is the canonical input** for tb-18; the allowlist is curated against it and is what tb-18 transcribes.

## 2. The token-frequency sample

`tastes` is a long-tailed free-text cloud — 2732 distinct tokens over 728 tastes-bearing venues, ~26 tokens per venue on average. The top of the table is dominated by **meal slots, dish names, and ingredients**, not atmosphere. The atmosphere signal is real but thin.

Top tokens (venue count / % of the 728 tastes-bearing venues). Full table: [`data/token-frequency.json`](data/token-frequency.json).

| Token | Venues | % | Kind |
|---|---:|---:|---|
| casual | 409 | 56.2% | atmosphere-ambiguous — *excluded*, see section 5 |
| dinner | 375 | 51.5% | meal slot — noise |
| lunch | 359 | 49.3% | meal slot — noise |
| great value | 341 | 46.8% | price/quality — noise (not vibe) |
| **trendy** | 281 | 38.6% | **atmosphere `+1`** |
| well | 276 | 37.9% | noise |
| **good for dates** | 267 | 36.7% | **atmosphere `-1`** |
| town | 248 | 34.1% | noise |
| bar | 244 | 33.5% | venue-kind — noise |
| **crowded** | 241 | 33.1% | **atmosphere `+1`** |
| **good for groups** | 229 | 31.5% | **atmosphere `+1`** |
| restaurants | 210 | 28.8% | venue-kind — noise |
| city | 203 | 27.9% | noise |
| **happy hour** | 194 | 26.7% | **atmosphere `+1`** |
| outdoor seating | 190 | 26.1% | amenity — noise (not vibe) |
| **good for singles** | 158 | 21.7% | **atmosphere `+1`** |
| music | 149 | 20.5% | atmosphere-ambiguous — *excluded*, see section 5 |
| good for a quick meal | 141 | 19.4% | pace, not vibe — *excluded*, see section 5 |
| **spacious** | 113 | 15.5% | **atmosphere `-1`** |
| **hipster** | 50 | 6.9% | **atmosphere `+1`** |
| **people watching** | 45 | 6.2% | **atmosphere `+1`** |
| **good for business meetings** | 39 | 5.4% | **atmosphere `-1`** |
| **comfortable** | 35 | 4.8% | **atmosphere `-1`** |
| **quiet** | 35 | 4.8% | **atmosphere `-1`** |
| **good for working** | 33 | 4.5% | **atmosphere `-1`** |
| **lively** | 33 | 4.5% | **atmosphere `+1`** |
| **dancing** | 33 | 4.5% | **atmosphere `+1`** |
| **live music** | 32 | 4.4% | **atmosphere `+1`** |
| **fun atmosphere** | 14 | 1.9% | **atmosphere `+1`** |
| **loud** | 12 | 1.6% | **atmosphere `+1`** |
| **comfortable seats** | 10 | 1.4% | **atmosphere `-1`** |
| **cozy** | 6 | 0.8% | **atmosphere `-1`** |
| **cosy atmosphere** | 4 | 0.5% | **atmosphere `-1`** |
| **nightclubs** | 3 | 0.4% | **atmosphere `+1`** |
| **study area** | 3 | 0.4% | **atmosphere `-1`** |
| **romantic** | 3 | 0.4% | **atmosphere `-1`** |
| **business meetings** | 3 | 0.4% | **atmosphere `-1`** |
| **night clubs** | 2 | 0.3% | **atmosphere `+1`** |
| **noisy** | 2 | 0.3% | **atmosphere `+1`** |
| **quaint atmosphere** | 1 | 0.1% | **atmosphere `-1`** |
| **pleasant atmosphere** | 1 | 0.1% | **atmosphere `-1`** |
| **festive atmosphere** | 1 | 0.1% | **atmosphere `+1`** |

(Bold rows are the curated allowlist. The long tail below is ~2690 more tokens — dish names, ingredients, chef names — all noise.)

## 3. Observed `tastes` coverage rate

> **66.8%** of sampled venues carry a non-empty `tastes` array (728 of 1090).

This **corrects the ~76% figure** the tb-18 ticket and the research-01 report cited — that was an estimate, never measured against live data. 66.8% is the measured rate over a 1090-venue, 8-metro, 3-category sample.

Coverage is not uniform — it depends heavily on venue kind and metro:

| Slice | Tastes-bearing / sampled | Coverage |
|---|---:|---:|
| **By category** | | |
| Restaurant | 333 / 400 | 83.3% |
| Bar | 226 / 302 | 74.8% |
| Cafe / Coffee Shop | 169 / 388 | 43.6% |
| **By metro** | | |
| New York, NY | 115 / 132 | 87.1% |
| Chicago, IL | 107 / 136 | 78.7% |
| Seattle, WA | 96 / 131 | 73.3% |
| Austin, TX | 100 / 137 | 73.0% |
| Denver, CO | 81 / 130 | 62.3% |
| Nashville, TN | 84 / 137 | 61.3% |
| Los Angeles, CA | 83 / 143 | 58.0% |
| Portland, ME | 62 / 144 | 43.1% |

**Implication for tb-18.** The "no matching tokens -> classify exactly as today" path is not a rare fallback — it is the path for **a third of all venues**, and for the *majority* of coffee shops. The category-archetype baseline carries most of the load; the `tastes` nudge is genuinely incremental, exactly as the tb-18 background section frames it. This is a feature, not a gap: the locked design already makes the nudge optional and additive.

## 4. The curated vibe-token allowlist

The deliverable. A **flat list, 30 tokens**, each tagged exactly `+1` (loud-leaning) or `-1` (quiet-leaning). No magnitude/weight column — direction-only was locked in the tb-18 grill. Machine artifact: [`data/vibe-token-allowlist.json`](data/vibe-token-allowlist.json).

tb-18's classifier sums the +/-1 tags of a venue's matched tokens and nudges the category-archetype baseline by the **sign** of that sum (`-1`/`0`/`+1`), capped at +/-1 step. A venue whose matched tokens net to zero gets no nudge.

### `+1` — loud-leaning (16 tokens)

```
crowded
trendy
good for groups
happy hour
good for singles
hipster
people watching
dancing
live music
lively
loud
fun atmosphere
nightclubs
night clubs
festive atmosphere
noisy
```

### `-1` — quiet-leaning (14 tokens)

```
spacious
good for dates
comfortable
quiet
good for working
good for business meetings
comfortable seats
cozy
cosy atmosphere
study area
romantic
business meetings
quaint atmosphere
pleasant atmosphere
```

### Notes for the tb-18 transcriber

- **Match lowercased + trimmed.** The allowlist tokens are the canonical lowercase form. Foursquare returns mixed casing (`Toro`); lowercase both sides before matching, the same way `applyPostFilters` already does in `foursquare.ts`.
- **Multi-word tokens are whole tokens, not substrings.** `good for groups` is one `tastes` array element, not the word "groups". Match array-element equality, never `String.contains`.
- **`nightclubs`/`night clubs` and `cozy`/`cosy atmosphere` are kept as separate entries** because Foursquare's crowd-sourced cloud carries both spellings/forms as distinct strings. They are not deduped — each is a real token in the live sample. They carry the same direction, so a venue tagged with both simply double-counts in the same direction, which is harmless under the sign-of-sum rule.

## 5. Curation rationale — what was excluded and why

Curation is the hard part of this spike: the cloud is ~98.9% noise by distinct-token count. Two exclusion classes:

### 5.1 Folksonomy noise (the easy cut)

Dish names (`tacos`, `pork belly`, `cheesecake`), ingredients (`avocado`, `jalapenos`, `truffle aioli`), meal slots (`dinner`, `lunch`, `brunch food`), venue-kind echoes (`bar`, `restaurants`), and place words (`town`, `city`, `country`) — none describe atmosphere energy. Excluded wholesale. This is ~2690 of the 2732 tokens.

### 5.2 Atmosphere-adjacent but **not energy-directional** (the judgement cut)

These tokens *feel* like atmosphere but do not place a venue on the Quiet/Rowdy axis. Including them would inject noise into the nudge. Each was excluded deliberately:

| Token | Venues | Why excluded |
|---|---:|---|
| `casual` | 409 | The single most common atmosphere-adjacent token, but "casual" is a *dress/formality* signal, not an energy one. A casual venue can be a quiet diner or a loud sports bar. No direction. |
| `music` | 149 | A coffee shop with background jazz and a club both carry `music`. Only `live music` (kept, `+1`) reliably leans loud. |
| `good for a quick meal` | 141 | A *pace/service-speed* signal, not an energy one. A quick-meal venue is not inherently loud or quiet. |
| `good for special occasions` | 181 | Genuinely bidirectional — a hushed fine-dining room and a loud celebration venue both earn it. Cancels out. |
| `cute` | 72 | Aesthetic, not energy. |
| `outdoor seating`, `wifi`, `parking`, `takes reservations` | — | Amenities. The 2026-05-17 audit already ruled `attributes` out as a vibe signal; these are the same amenities surfacing inside `tastes`. |
| `great value`, `pricey`, `inexpensive` | — | Price/quality signals. Price already has its own axis (Q2) and its own tie-break in the classifier. |

`spacious` was *kept* as `-1` — a judgement call: a spacious room disperses sound and crowding, which in practice the `tastes` crowd applies to calmer venues. Flagged as the softest `-1` in the list.

### 5.3 Borderline calls — recorded for the reviewer

- **`good for working` / `study area` / `good for business meetings` / `business meetings` -> `-1`.** A venue the crowd tags as work/study-friendly is one you *can* concentrate in — that implies a calmer room. Kept as quiet-leaning.
- **`good for singles` -> `+1`.** Reads as a social/scene signal in the sample (co-occurs heavily with `bar`, `happy hour`, `trendy`), so it leans loud. Softer than `crowded`/`lively` but defensible.
- **`hipster` -> `+1`.** Not strictly an energy word, but in the sample it consistently co-occurs with `trendy` and bar/nightlife tokens; treated as loud-leaning. A reasonable reviewer could cut it — it is the most debatable `+1`. Low cost to keep: it nets out against any `-1` the venue also carries.
- **`trendy` -> `+1`.** High frequency (38.6%) and reliably loud-leaning in the cloud. Kept.

Direction-only tagging (no magnitude) means these borderline calls are low-stakes: a single soft token cannot swing a venue on its own unless the venue has *no* other allowlist tokens, and the nudge is capped at +/-1 step regardless.

## 6. Handoff to tb-18

- tb-18 transcribes section 4 into a classifier constant — a flat `[token: String: Int]` (or equivalent) where the value is `+1` / `-1`.
- The classifier lowercases the venue's `tastes` strings, intersects with the allowlist, sums the directions, takes the sign, caps at +/-1, applies it to the archetype baseline. That mechanism is tb-18's; this spike does not touch it.
- The 66.8% coverage figure (section 3) should replace the ~76% estimate wherever tb-18 or research-01 cite it.

## 7. Quirks recorded

- **Foursquare `tastes` coverage was over-estimated.** The ~76% figure that propagated through tb-18 and research-01 was never measured. Live rate is **66.8%**, and it collapses to ~44% for cafes/coffee shops. Any future design that leans on `tastes` should assume a third of venues have none.
- **`tastes` carries amenities too.** `outdoor seating`, `wifi`, `parking`, `takes reservations` appear inside `tastes`, overlapping the `attributes` field. The cloud is not purely menu/atmosphere data — it is a catch-all crowd tag cloud.
- **Crowd-sourced spelling variants are not normalised by Foursquare.** `cozy`/`cosy atmosphere`, `nightclubs`/`night clubs`, `jalapenos`/`jalepenos` all appear as distinct tokens. Any token-match consumer must allowlist each variant explicitly — there is no canonical form upstream.
