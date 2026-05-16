---
report: foursquare-filter-surface-2026-05
prd: v1.1-quiz-redesign-prd
adr: 0002
issue: 15_issues/v1.1/issues/research-01-foursquare-filter-surface
date: 2026-05-15
status: final
---

# Report — Foursquare Places API filter-surface + venue-metadata mapping for the v1.1 quiz redesign

## Purpose

This is the research spike that issue [[../../../15_issues/v1.1/issues/research-01-foursquare-filter-surface|research-01]] calls for. It is a **research deliverable — no application code ships**.

The v1.1 quiz redesign ([[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]]) introduces two new scoring axes — **reputation** (Popular / Hidden gem / Classic / New) and **vibe** (a 5-point energy scale Quiet -> Chill -> Social -> Lively -> Rowdy) — and a per-member fetch planner that has to know which quiz inputs can strict-filter a fetch and which can only be scored after it. This report fixes both surfaces:

1. **Fetch-time filters** — which `GET /places/search` request parameters can legitimately strict-filter a fetch, and how each v1.1 quiz input maps onto them (or why it cannot).
2. **Client-side-scored metadata** — which venue-response fields the reputation and vibe axis scorers can read *after* the fetch, since neither axis can strict-filter.

The output here is consumed by:

- **PRD module (D) — per-member fetch planner / running-union pool manager** ([[../../../15_issues/v1.1/issues/tb-07-per-member-foursquare-fetch|tb-07]], [[../../../15_issues/v1.1/issues/tb-10-running-union-pool-manager|tb-10]]). It reads section 2 (fetch-time filter table) to compose each member's request.
- **PRD module (E) — preference-function axis scorers** ([[../../../15_issues/v1.1/issues/tb-09-preference-function-axis-scorers|tb-09]]). It reads sections 4 and 5 (reputation + vibe metadata mappings).
- **PRD module — Q5 factorial probe** ([[../../../15_issues/v1.1/issues/tb-08-q5-factorial-probe|tb-08]]). It reads section 6 (the graded-axis recommendation) to know what "drop the vibe axis" means in the binary keep/drop factorial.

## TL;DR

- **Five request parameters are usable as legitimate strict fetch-time filters**: `ll` (location), `radius`, `fsq_category_ids` (category), `min_price` / `max_price` (price), `open_at` (open-at-time). Of the v1.1 quiz inputs, **Q2 spend cap, parameter geo, parameter meal-time, parameter transport radius, and profile dietary all map cleanly onto one of these**. The transport-radius mapping carries one caveat — see section 3.
- **Reputation and cuisine-preference cannot be strict fetch filters.** Reputation is not a server-side query dimension at all. Cuisine *can* be passed as a category id, but the v1.1 design treats it as a graded preference (Q4 / scenario composites), not a hard cut, so it must be scored client-side from `categories[]`, not strict-filtered. Both are confirmed in section 3.
- **Reputation axis** is scored client-side from a composite of `rating`, `stats.total_ratings` (or `stats.total_tips`), and `date_created` — see section 4 for the concrete bucket mapping. None of these strict-filter; they are all post-fetch metadata.
- **Vibe axis** has **no first-class Foursquare field**. It is the weakest signal in this report. The recommended v1.1 source is a heuristic over `categories[]` (category archetype carries most of the vibe signal) with `attributes` / `tastes` tokens as a secondary nudge — see section 5. This is an explicit accuracy compromise, documented as such.
- **Graded-axis open question** (section 6): vibe is cardinal (5 points) but the Q5 factorial treats every axis as binary keep/drop. Recommendation: **"drop the vibe axis" means widen the vibe tolerance band to the full scale (accept any vibe), not delete the vibe score.** The factorial toggles a *tolerance*, not the *dimension*. This keeps the cardinal score intact for the final preference-function ranking while still giving the factorial a clean binary lever.

---

## 1. The live Foursquare request surface (baseline)

The live API surface was verified for v1 in [[../../adr/0002-places-data-foursquare-mapkit|ADR 0002]] section "Live API surface verified 2026-05-13" and is exercised by `supabase/functions/_shared/foursquare.ts`. This report does **not** re-verify the wire contract — it builds on it. Recap of the load-bearing facts:

- **Base URL**: `https://places-api.foursquare.com/` — the legacy `api.foursquare.com/v3/*` surface returns HTTP 410.
- **Auth**: `Authorization: Bearer <service_key>`.
- **Required version header**: `X-Places-Api-Version: 2025-06-17` (pinned).
- **Endpoint in use**: `GET /places/search`. v1 takes the first page (`limit=50`) as the candidate pool; it does not paginate.
- **`fields` parameter is mandatory** to receive optional payloads. Without an explicit `fields` csv the response strips to a minimal projection. Every field this report relies on for scoring (sections 4, 5) must be named in `fields` or it will not arrive.

The v1.1 work adds new *inputs* to map and new *response fields* to consume. It does not change the endpoint or the auth contract.

---

## 2. Fetch-time filters — request parameters usable as strict filters

A request parameter is a **legitimate strict filter** when Foursquare applies it server-side and the response only contains venues that satisfy it. Passing a non-filter parameter and hoping is not a strict filter — it is a post-fetch score.

| Foursquare `/places/search` parameter | What it filters | Strict? | Notes |
|---|---|---|---|
| `ll=<lat>,<lng>` | Search centre | n/a (anchor) | Required. The geo anchor every other geo filter is relative to. |
| `radius=<metres>` | Distance from `ll` | **Yes** | Server-side. Foursquare caps at 100 000 m; v1.1 transport radii are far below that. |
| `fsq_category_ids=<csv>` | Foursquare taxonomy category | **Yes** | Server-side. Comma-separated; OR semantics across ids. This is how dietary category filters and (if used) cuisine ids reach the wire. |
| `min_price` / `max_price` (integer 1..4) | Price tier | **Yes** | Server-side. v1 uses `max_price` only (cap, never floor). |
| `open_at=<unix-seconds>` | Open at a specific instant | **Yes** | Server-side. Takes a unix-seconds timestamp; the proxy converts an ISO-8601 input. Distinct from the `open_now` *response field*, which is a post-fetch badge signal. |
| `query=<text>` | Free-text name / keyword | Partial | Text relevance ranking, not a hard set-membership filter. **Not used as a strict filter** in v1/v1.1 — text search is fuzzy and would silently drop venues. |
| `sort` | Result ordering | n/a | Ordering only, not filtering. v1.1 ignores it; the EBA/preference engine does its own ranking. |
| `limit` | Page size | n/a | Caps the candidate pool at 50. |
| `fields` | Response projection | n/a | Controls which fields arrive, not which venues. Must include every scoring field (sections 4, 5). |

**The five strict filters are: `radius`, `fsq_category_ids`, `min_price`/`max_price`, `open_at`, with `ll` as the required anchor.** Everything else is ordering, projection, or fuzzy.

### v1.1 quiz-input -> filter mapping

The v1.1 quiz inputs fall into three buckets (profile / params / questions — see the project's quiz-input-buckets note). Mapping each input that *could* touch a fetch:

| v1.1 quiz input | Bucket | Maps to fetch-time filter | Strict-filterable? |
|---|---|---|---|
| **Profile dietary** (vegan / vegetarian / halal / kosher) | profile | `fsq_category_ids` | **Yes** — category-level. Inherited verbatim from v1; see [[../foursquare-dietary-tags-2026-05/report|dietary-tag report]] Option C. |
| **Profile dietary — gluten-free** | profile | none on the wire | **No** — post-fetch `tastes` token filter. No category id exists. |
| **Profile dietary — allergens** (dairy / shellfish / nuts) | profile | none | **No** — no Foursquare signal at all. Disclaimer only. (v1.1 ships allergy-blind by design — see v1.1 #10 deferral; mapping recorded here for completeness.) |
| **Q2 spend cap** | question | `max_price` (1..4) | **Yes** — Foursquare's 1..4 price scale maps 1:1 onto the Q2 cap. Cap, never floor. |
| **Parameter — session geo / location** | param | `ll` | **Yes** — the anchor. From the geo permission / location selector (sg-04 / ADR 0009 `C-23 LocationPicker`). |
| **Parameter — meal-time** | param | `open_at` (unix-seconds) | **Yes** — the session's meal-time instant converts to a unix-seconds `open_at`. Filters to venues open at that instant. |
| **Parameter — transport radius** | param | `radius` (metres) | **Yes, with a caveat** — see section 3. The transport mode (walk / transit / drive) sets a metres value, but Foursquare's `radius` is straight-line, not travel-time. |
| **Cuisine preference / dislike** | profile / Q4 | `fsq_category_ids` is *available* but **not used as a strict filter** | **No (by design)** — see section 3. Scored client-side from `categories[]`. |
| **Reputation (Q3)** | question | none | **No** — not a server-side query dimension. Scored client-side; see section 4. |
| **Vibe (Q4)** | question | none | **No** — no Foursquare field; heuristic-scored client-side; see section 5. |

The fetch planner (module D) composes each member's request from the **Yes** rows only. The **No** rows are handed to the axis scorers (module E) as post-fetch work.

---

## 3. What cannot be a strict fetch filter — and why

Three things the quiz captures look like they could filter the fetch but must not. Recording the reason so module D does not "optimise" by pushing them onto the wire.

### 3.1 Reputation cannot strict-filter

Foursquare has **no request parameter for venue reputation.** There is no `popularity`, no `min_rating`, no `age` filter on `/places/search`. Reputation is purely a property of the *response payload* (`rating`, `stats`, `date_created` — section 4). The reputation axis scorer must derive its signal entirely from post-fetch metadata.

This is also a *correctness* requirement, not just an API limitation: the Q5 factorial ([[../../../15_issues/v1.1/issues/tb-08-q5-factorial-probe|tb-08]]) needs **reputation variety in every candidate pool** — Popular venues *and* Hidden gems *and* Classics *and* New spots — so it can probe how much each member's reputation preference moves their verdict. If reputation were a strict fetch filter, a member who answered "Hidden gem" on Q3 would get a pool with zero Popular venues and the factorial would have nothing to vary. **Reputation must stay a post-fetch score precisely so the pool keeps its spread.**

### 3.2 Cuisine cannot (must not) strict-filter

Cuisine is the subtle one. Foursquare *does* expose cuisine as category ids (`fsq_category_ids` would accept e.g. an Italian or Thai category id), so it is *technically* wire-filterable. It must still **not** be used as a strict filter in v1.1, for two reasons:

1. **The v1.1 design treats cuisine as a graded preference, not a hard cut.** Per the project's quiz-redesign locks, cuisine moved into the session quiz as a scenario-composite / Q4 input — "I'd love Thai tonight" is a *preference weight*, not "show me only Thai." Strict-filtering on it would turn a soft lean into a hard veto and collapse the candidate pool.
2. **Same factorial-variety argument as reputation.** The Q5 factorial needs cuisine spread in the pool to probe cuisine preference strength. Strict-filtering destroys the spread.

The dietary categories (section 2) *are* strict filters because dietary is a genuine hard NEED (a vegan cannot eat at a steakhouse); cuisine preference is a soft WANT. **The fetch planner must keep cuisine category ids off the wire and hand cuisine to the client-side scorer**, which matches the member's cuisine preference against the venue's `categories[]` and produces a graded score.

> **Implementation reconciliation (tb-17, 2026-05-16).** The N+1 per-member fetch design refines "keep cuisine off the wire" without contradicting it. The fan-out is N category-scoped per-cuisine calls **plus one mandatory general call with no cuisine tag**. Each individual per-cuisine call *is* `fsq_category_ids`-scoped to its craved cuisine — that is what makes the N+1 fan-out buy anything — but the general call stays un-scoped and supplies the non-craved breadth. So the *fetch as a whole* is still never cuisine-strict-filtered: a member's craved cuisine narrows their per-cuisine calls but never narrows the union pool, which always contains the general call's breadth. The graded client-side cuisine scorer is unchanged. See `supabase/functions/_shared/foursquare.ts` `CUISINE_CATEGORY_MAP`. The cuisine→category ids are sourced from the published Foursquare "Dining and Drinking > Restaurant" taxonomy and carry the same `verified_against_api: false` caveat as the dietary ids; a live probe should resolve one known id overlap (`thai` = `13352` overlaps the dietary map's `halal` category id).

The reputation and cuisine scorers therefore derive from:

- **Reputation scorer** — `rating`, `stats.total_ratings` / `stats.total_tips`, `date_created` (section 4).
- **Cuisine scorer** — `categories[]` (each entry's taxonomy `id` + `name`), matched against the member's cuisine preference/dislike set. (Cuisine scoring detail is out of scope for this spike — research-01 owns the *filter-vs-score* boundary; the cuisine scorer's exact algorithm is a tb-09 concern. This report only fixes that cuisine is a `categories[]`-derived post-fetch score.)

### 3.3 Transport radius is straight-line, not travel-time

`radius` *is* a strict filter, but it filters on **straight-line distance from `ll`**, not travel time. The v1.1 parameter is a *transport* radius — "15 minutes by transit" is not a circle. Recommendation for module D:

- Convert the transport-mode + time budget to a **conservative straight-line metres** value (e.g. walk pace ~80 m/min as already used in `estimateWalkMinutes`; transit / drive use a faster pace) and pass that as `radius`.
- Accept that this **over-includes** venues that are geographically near but travel-time far (across a river, no transit link). This is acceptable: it is better to over-fetch and let a post-fetch travel-time refinement (or the user) trim, than to under-fetch and miss a venue. Under-fetching is unrecoverable; over-fetching is.
- Flagged as an adjacency, not solved here: a true isochrone fetch would need a routing API (MapKit ETA, or a directions service). Out of v1.1 scope. Record in module D's notes.

---

## 4. Reputation axis — venue-response metadata mapping

The reputation axis has four named buckets plus a no-preference escape: **Popular / Hidden gem / Classic / New / No preference**. None strict-filter; all are scored from post-fetch metadata.

### Available response fields (must be named in `fields`)

| Field | Type | Reputation signal it carries |
|---|---|---|
| `rating` | number (0..10 on the Foursquare scale) | Quality. High rating + high volume = Popular/Classic; high rating + low volume = Hidden gem. |
| `stats.total_ratings` | integer | **Volume / footfall.** The primary "how many people know this place" signal. |
| `stats.total_tips` | integer | Secondary volume signal — tip count. Use as a fallback when `total_ratings` is sparse, or blend. |
| `popularity` | number 0..1 (when present) | Foursquare's own normalised popularity score. Sparse coverage; use as a tie-breaker / corroboration, not the primary axis. |
| `date_created` | ISO-8601 date | **Age.** When the venue first entered the Foursquare dataset. Proxy for "New" vs "Classic". Imperfect — see caveat below. |

> **`date_created` caveat.** `date_created` is when the *Foursquare record* was created, not when the *restaurant* opened. A long-established venue added to Foursquare recently would read as "New." This is a known inaccuracy. v1.1 accepts it: it is the only age-like signal Foursquare exposes, "New" is the lowest-stakes of the four buckets, and the factorial (section 6) is designed to tolerate noisy axes. If cohort-1 telemetry shows the "New" bucket is badly wrong, the fallback is to drop "New" as a distinct bucket and fold it into "Hidden gem."

### Proposed bucket mapping

Reputation is a 2-D space — **volume** (how known) by **quality** (how good) — plus an **age** overlay. The four buckets carve that space:

| Bucket | Signal rule (proposed thresholds — tuneable) | Rationale |
|---|---|---|
| **Popular** | high `stats.total_ratings` (top tercile of the pool) AND `rating` >= ~7.0 | Lots of people, well-liked. The "everyone knows it, it's good" quadrant. |
| **Hidden gem** | low `stats.total_ratings` (bottom tercile of the pool) AND `rating` >= ~8.0 | Few ratings but the ones it has are strong. "Under-the-radar but excellent." |
| **Classic** | high `stats.total_ratings` AND `date_created` older than ~3 years | Long-established and well-known. Overlaps Popular on volume; `date_created` age is the discriminator. |
| **New** | `date_created` within ~12 months, regardless of volume | Recently in the dataset. Age dominates this bucket. |
| **No preference** | — | The scorer contributes a flat (zero-weight) score; the axis does not move this member's ranking. |

**Important — thresholds are pool-relative, not absolute.** "High `total_ratings`" should be computed as a tercile/percentile *within the fetched candidate pool*, not against a global constant. A dense metro and a quiet suburb have wildly different absolute rating counts; a pool-relative split keeps the buckets meaningful in both. The exact tercile boundaries and the `rating` cutoffs are **tuneables for tb-09**, not research findings — this report fixes the *shape* (which fields, which axes, pool-relative), not the magic numbers.

**Bucket overlap is expected and fine.** A venue can be both Popular and Classic. The reputation scorer should not force a single label; it should score the member's *stated preference* against the venue's position in the volume/quality/age space (e.g. a member who answered "Hidden gem" scores high on low-volume/high-rating venues and low on high-volume venues). The four buckets are the *member's answer options*, not mutually-exclusive venue tags.

---

## 5. Vibe axis — venue-response metadata mapping

The vibe axis is a cardinal 5-point energy scale: **Quiet (0) -> Chill (1) -> Social (2) -> Lively (3) -> Rowdy (4)**.

**This is the weakest mapping in the report. Foursquare has no first-class "energy" or "atmosphere" field.** The recommendation below is a heuristic, and it is labelled as one so module E does not over-trust it.

### Candidate signals, ranked

| Signal | Source field | Strength for vibe | Verdict |
|---|---|---|---|
| **Category archetype** | `categories[]` (taxonomy `id` + `name`) | Strong-ish. A cocktail-bar / sports-bar / nightclub category is reliably high-energy; a tea house / cafe / bakery is reliably low-energy; a casual sit-down restaurant is mid. | **Primary signal.** Most of the vibe signal lives in the category. |
| **`attributes`** (e.g. `noise_level`, `good_for_groups`, `crowd`, music/dancing flags, when present) | `attributes` object | Directly on-topic *when present* — `noise_level` in particular is almost exactly the vibe axis. **But coverage is sparse and uneven.** | **Secondary nudge.** Use when present; never depend on it. Treat absence as "no information," not "quiet." |
| **`price`** | `price` (1..4) | Weak, indirect. High-price fine dining skews quieter; cheap fast-casual skews louder — but plenty of exceptions. | **Tertiary tie-break only.** Do not let price move the vibe score much. |
| **`tastes` / tips text** | `tastes[]` | Very weak. Occasionally a token like "romantic" or "lively" appears; coverage is too sparse to lean on. | **Optional flavour, not a real input.** |

### Proposed mapping

1. **Build a category -> vibe-baseline table.** For each Foursquare restaurant/bar category id the v1.1 fetch can return, assign a baseline 0..4 vibe value (e.g. tea house -> 0, cafe / bakery -> 1, casual restaurant -> 2, gastropub / wine bar -> 3, sports bar / nightclub -> 4). This table is a **tb-09 deliverable** — research-01 fixes that the table exists and is the primary signal; populating every category id is implementation work and should live next to the scorer code with a comment pointing back here.
2. **Apply `attributes` as a +/- nudge when present.** If `attributes.noise_level` (or an equivalent crowd/music flag) is present, nudge the baseline toward it by at most ~1 point. If absent, no nudge.
3. **Optionally apply `price` as a small tie-break** (at most ~0.5 point) only when category and attributes leave the score ambiguous.
4. **Clamp to 0..4.**

The vibe scorer then compares the member's Q4 vibe answer against the venue's computed vibe score.

> **Honest limitation, recorded for module E and the PRD.** This heuristic will be noisy at the per-venue level. The mitigations: (a) the Q5 factorial is explicitly designed to *measure* how much each axis actually moves verdicts, so a noisy vibe axis that turns out not to matter will be caught; (b) the graded-axis recommendation (section 6) lets the factorial drop the vibe axis cleanly when it is not load-bearing for a given room. If cohort-1 telemetry shows vibe is both noisy *and* load-bearing, the escalation path is a different data source (e.g. a venue-attributes enrichment, or user-correction feedback as the dietary report proposed for tags) — out of v1.1 scope, flagged here as a future research item.

---

## 6. The graded-axis open question — what "drop the vibe axis" means

**The problem.** The reputation and vibe scorers produce *graded* outputs (vibe is an explicit 5-point cardinal scale; reputation is a position in a continuous volume/quality space). But the Q5 factorial probe ([[../../../15_issues/v1.1/issues/tb-08-q5-factorial-probe|tb-08]]) treats every axis as a **binary keep/drop** lever — it builds candidate verdicts with each axis switched on or off to measure that axis's influence. A binary factorial and a cardinal axis do not obviously compose. What does it *mean* to "drop" the vibe axis when vibe is a number from 0 to 4?

**Three interpretations were considered:**

- **(A) Delete the vibe score.** When the factorial drops the vibe axis, the vibe scorer contributes nothing — the score is removed from the preference function for that factorial cell.
- **(B) Zero the vibe weight.** Keep the vibe score in the function but multiply its weight by 0 for that cell.
- **(C) Widen the vibe tolerance to the full scale.** Keep the vibe score and its weight, but set the member's *acceptable vibe band* to the entire 0..4 range — i.e. "drop" means "this member will accept any vibe," not "vibe stops being computed."

**Recommendation: (C) — "drop the vibe axis" means widen the vibe tolerance band to the full 0..4 scale.**

Rationale:

1. **It keeps one consistent mental model across hard and soft axes.** The verdict engine already relaxes *soft* constraints by *widening a band*, not by deleting a dimension — see the v1 [[../../verdict-engine|VerdictEngine]] soft-pref relax cascade (vibe floor relaxes by *incrementing a relax step that widens the gap*; radius relaxes by *adding metres*). Interpretation (C) makes the factorial's "drop" use the **exact same widen-the-band primitive** the relax cascade already uses. (A) and (B) introduce a second, different mechanic ("sometimes the dimension vanishes") that the engine would have to special-case.
2. **It is the correct semantics for what the factorial is probing.** The factorial asks "how much does this member's vibe preference change the verdict?" The honest counterfactual to "this member cares about vibe" is "this member is indifferent to vibe" — i.e. *accepts anything* — **not** "vibe ceases to exist for everyone." (A) and (B) accidentally answer a different question.
3. **The cardinal score survives for the final ranking.** The preference function still has a real, graded vibe score for every venue. Only the *member's tolerance* toggles. So the final verdict ranking is always computed from full-fidelity cardinal scores; the factorial only ever toggles tolerance bands. Reputation gets the same treatment — "drop reputation" = "this member accepts any reputation bucket."
4. **It degrades gracefully and is symmetric with the hard axes.** A hard NEED (dietary, budget, walk) is a band that *cannot* widen past its limit; a soft axis (vibe, reputation, cuisine) is a band that the factorial *and* the relax cascade *can* widen all the way to fully-open. One spectrum, one mechanic.

**Concrete contract for tb-08 / tb-09:**

- Each soft axis (vibe, reputation, cuisine) carries, per member, a **tolerance band** over its score range.
- The preference-function scorer (module E) always computes the full cardinal/graded score for every venue.
- "Axis kept" for a member = use that member's stated tolerance band.
- "Axis dropped" for a member (a factorial cell, or a relax-cascade step that fully opens the band) = set that member's tolerance band to the **entire score range** — every venue passes the band; the axis no longer discriminates for that member.
- The factorial therefore varies **tolerance bands**, never the **presence of a score**. Binary lever (band = stated vs band = full-range), cardinal score underneath. The two compose cleanly.

This is a **product/architecture recommendation**, not a verified API fact. It should be ratified when tb-08 is specced; if the PRD owner disagrees, the alternative (B — zero-weight) is the next-best and is a one-line change in the scorer. (A) is not recommended — it forces the engine to special-case a missing dimension.

---

## 7. Acceptance-criteria coverage

Mapping this report against research-01's acceptance criteria:

- [x] **Request parameters usable as fetch-time filters, each PRD input mapped.** Section 2 — five strict filters enumerated; every v1.1 quiz input mapped to a parameter or flagged not-filterable.
- [x] **Venue-response metadata fields enumerated; concrete reputation + vibe mappings proposed.** Section 4 (reputation: `rating` / `stats` / `date_created` -> Popular / Hidden gem / Classic / New / No preference) and section 5 (vibe: `categories[]` heuristic + `attributes` nudge -> 5-point scale).
- [x] **Confirms reputation and cuisine cannot be strict fetch filters; records what each scorer derives from.** Section 3.1 (reputation -> section 4 metadata), section 3.2 (cuisine -> `categories[]`). Section 3.3 additionally records the transport-radius straight-line caveat.
- [x] **Graded-axis open question addressed with a recommendation for what "drop the vibe axis" means.** Section 6 — recommendation (C): widen the tolerance band to the full scale.
- [x] **Filed in the vault, linked from the PRD and the issue index. No application code changed.** This bundle lives at `60_engineering/research/foursquare-filter-surface-2026-05/`; linked from the v1.1 PRD and the v1.1 issue index. No code touched.

## 8. What this report does NOT settle (handed downstream)

- **Exact threshold numbers** for the reputation buckets (tercile cutoffs, `rating` floors) — tuneables for tb-09, to be set from cohort-1 telemetry.
- **The full category -> vibe-baseline table** — a tb-09 implementation deliverable; lives next to the scorer code.
- **The cuisine scorer's algorithm** — research-01 only fixes that cuisine is a `categories[]`-derived post-fetch score; the scoring function itself is tb-09.
- **Travel-time isochrone fetching** — section 3.3 records that `radius` over-includes; a true isochrone needs a routing API and is out of v1.1 scope.
- **Live coverage probe** for `rating` / `stats` / `date_created` / `attributes` in the beta metro — the same gap the [[../foursquare-dietary-tags-2026-05/report|dietary-tag report]] has for `tastes`. This report is **public-docs + verified-v1-surface based**; it has not probed how *populated* the reputation/vibe fields are in the beta metro. If `stats` or `attributes` coverage turns out thin, the reputation mapping degrades (fewer signals) and the vibe mapping leans even harder on `categories[]`. The probe should run as a first step of tb-07 (per-member fetch), alongside the dietary-tag probe that is still outstanding from TB-05. **Recorded as the one open verification gate.**

## Related

- [[../../adr/0002-places-data-foursquare-mapkit|ADR 0002]] — Foursquare primary / MapKit fallback; the live API surface this report builds on.
- [[../foursquare-dietary-tags-2026-05/report|foursquare-dietary-tags-2026-05/report.md]] — v1 dietary-tag audit; the category-filter / `tastes`-postfilter pattern reused in section 2.
- [[../../verdict-engine|verdict-engine.md]] — v1 VerdictEngine; the soft-pref relax cascade that section 6's recommendation aligns with.
- [[../../../10_prds/v1.1-quiz-redesign-prd|v1.1 Quiz Redesign & Verdict Engine PRD]] — the parent PRD; modules D and E consume this report.
- [[../../../15_issues/v1.1/issues/research-01-foursquare-filter-surface|research-01]] — the issue this bundle closes.
- [[../../../15_issues/v1.1/issues/tb-07-per-member-foursquare-fetch|tb-07]], [[../../../15_issues/v1.1/issues/tb-08-q5-factorial-probe|tb-08]], [[../../../15_issues/v1.1/issues/tb-09-preference-function-axis-scorers|tb-09]], [[../../../15_issues/v1.1/issues/tb-10-running-union-pool-manager|tb-10]] — the downstream issues blocked on this spike.
