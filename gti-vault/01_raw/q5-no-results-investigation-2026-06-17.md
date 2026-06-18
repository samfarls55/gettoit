---
date: 2026-06-17
topic: q5-no-results
status: raw
---

# Q5 no-results investigation

## Summary

Active Expo Q5 can fail locally even when the Google Q5 edge call returns three or more places.
The clearest bug is the multi-cuisine path: the repository assigns every Google-backed "keep cuisine" profile to only the first selected cuisine, while the factorial selector may require the second selected cuisine for the vibe-drop card.

## Walked path

- `mobile/src/quiz/QuizScreen.tsx`: Q4 save advances to Q5 and calls `loadQ5Candidates`.
- `mobile/src/quiz/q5CandidateRepository.ts`: loads plan or room location, invokes `places-proxy` with `surface: "q5"`, then converts Google places into `Q5PoolVenue` profiles.
- `supabase/functions/places-proxy/handler.ts`: routes Google Q5 requests to `handleGoogleQ5PlacesProxy`.
- `supabase/functions/_shared/places-proxy-core.ts`: runs Google Nearby Search, shapes by timing and service eligibility, logs `google_q5_shape`.
- `mobile/src/quiz/q5Factorial.ts`: picks three strict-factorial Q5 cards, returning `null` when any axis card is impossible.

## Concrete bug

Example: Q1 answers `["italian", "mexican"]`, Q3 Hidden gem, Q4 Social.

`q5PoolFromGoogleResponse` sets generated profiles to either `null` cuisine or the first selected cuisine, `italian`. No generated profile has `mexican`.

`selectProbedCuisines` ranks all selected cuisines and keeps two, including zero-support cuisines. It can return `["italian", "mexican"]`.

The generator then requires:

- reputation-drop card: `italian`
- vibe-drop card: `mexican`

No `mexican` venue exists in the generated pool, so Q5 returns `null` and the UI shows no results.

## Other likely causes

- Provider/config/network errors are collapsed into the same no-results UI. Edge guardrail errors return `{ error }`; mobile converts that to an empty pool.
- Missing plan or room location also returns an empty pool.
- Active Google Q5 does not actually use cuisine or price in the Nearby Search request, even though the mobile client sends them. Current thinning is more likely timing/service/min-count than cuisine/price.
- Timing is strict: mobile always sends an `open_at` token based on the device day and fixed meal hour. Server requires Google `regularOpeningHours` to match; service can relax, timing cannot.
- Google Q5 requests only `includedPrimaryTypes: ["restaurant"]`, max 20 results, no pagination or radius retry.

## Suggested fixes

- Filter zero-support cuisines out of `selectProbedCuisines`, or reuse the strongest supported cuisine when only one selected cuisine has support.
- Add regression coverage for two selected cuisines plus three Google places.
- Split Q5 status into true empty pool vs provider/config/network/context failure.
- Consider timing fallback, search-area timezone, broader provider floor, and overfetch/retry before no-results.

## Applied 2026-06-17

- `selectProbedCuisines` now ignores selected cuisines with zero pool support before generating strict-factorial cards.
- Google Q5 pool shaping now profiles the first two selected cuisines across the generated representative profiles, so three Google places can satisfy a two-cuisine Q5 card set.
- Mobile Q5 now throws provider edge errors instead of collapsing them into an empty candidate pool.
- Edge Google Q5 shaping now has a last-resort timing relaxation when strict meal timing leaves fewer than three service-compatible places.
- Added mobile and edge regression tests for the multi-cuisine and timing-relaxation failure modes.

## Applied 2026-06-18

- Kept Google Nearby Search as the provider path instead of switching Q5/verdict to Text Search.
- Added a shared Q1 cuisine-to-Google primary type map and changed Google Q5 from broad `includedPrimaryTypes: ["restaurant"]` to the selected Q1 cuisine type union.
- Changed final verdict Google fetch to use the active members' selected Q1 cuisines from vote preference inputs. If nobody selected a cuisine, it falls back to the bounded union of all Q1 cuisine mappings instead of generic `restaurant`.
- Added edge tests for selected cuisine mapping, no-preference fallback, Q5 outbound request bodies, and production verdict wiring.
- Aligned Q2 spend cap with Google's price-level model: UI/progress/backend now treat `$`, `$$`, `$$$`, and `$$$$` as numeric tiers `1`, `2`, `3`, and `4` instead of app-created dollar thresholds. Legacy saved dollar-string progress still decodes to the matching numeric tier.

## Submit RLS follow-up

After Q5 options appeared, browser submit failed with:

`new row violates row-level security policy for table "votes"`

The failing room was visible to its creator through `rooms_select_creator`, but it had no owner row in `members`. That makes the plan look joined enough to open the quiz, while `votes_insert_self_in_room` still rejects the final vote because its RLS check requires the caller to be a room member. The progress RPC updates the caller's existing `members` row only, so an orphaned owner membership lets Q1-Q4 advance in the UI while silently persisting nothing.

Applied fix:

- `launchPlan` now idempotently upserts the owner membership even when reusing an existing room.
- Quiz progress and quiz submit now repair creator-owned visible rooms with a missing owner membership via an idempotent `members` upsert before saving progress or inserting votes.
- Supabase client creation is cached per browser session, removing the duplicate GoTrue client warning during the same browser verification pass.

Browser verification submitted Q5 for the orphaned room, landed on Waiting, and the database showed the creator owner membership plus a Q5 vote row.
