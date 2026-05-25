---
note: service-shape-attributes-unbacked
status: needs-triage
created: 2026-05-17
related:
  - "[[issues/tb-18-q4-vibe-tastes-signal]]"
  - "[[../../10_prds/0.1.0-quiz-redesign-prd]]"
---

# Adjacency — service-shape parameter has no Foursquare backing

Surfaced 2026-05-17 during the premium-field audit that produced [[issues/tb-18-q4-vibe-tastes-signal|tb-18]]. Flagged, not yet an issue — needs a triage decision before it becomes one.

## The smell

PRD user story 8: *"As a session initiator, I want to choose the service shape (dine-in indoor/outdoor vs takeout pickup/delivery), so that candidates match how the group wants to eat."* Service shape is a **session parameter** (set pre-quiz, consistent across the session).

The Foursquare candidate fetch currently applies geo, radius, price, and `open_at` as hard filters — but **nothing backs the service-shape parameter**. A group that picked "outdoor dine-in" or "takeout/delivery" gets the same candidate pool as everyone else.

## The opportunity

The premium-field audit found Foursquare's `attributes` field carries exactly the right structured booleans:

- `outdoor_seating` — backs the dine-in indoor/outdoor split.
- `delivery` — backs the takeout/delivery shape.
- `reservations`, `restroom`, `wifi`, `takes_credit_card` — adjacent amenity signal.

`attributes` is a premium field, already paid for, but **not currently in the proxy's `fields` request list** — it would need adding. Unlike `tastes` (noisy folksonomy), `attributes` is clean structured data.

## Open questions for triage

- Is service shape a **hard fetch filter** (EBA-style prune) or a **soft scoring signal**? The PRD's union-not-intersection architecture argues against hard-filtering the fetch; it may belong in the verdict engine's EBA prune or as a soft axis.
- `attributes` coverage was uneven in the audit sample (9/12 venues) — does sparse coverage make a hard filter unsafe (a venue with no `attributes` would be wrongly pruned)?
- Does the pre-quiz parameters surface ([[issues/tb-05-pre-quiz-parameters-surface|tb-05]]) already capture service shape, or is that input not yet collected?

## Next step

Triage: confirm whether the service-shape parameter is captured today and where it should bite (fetch filter vs verdict EBA vs soft axis). If a real gap is confirmed, file a tracer-bullet to add `attributes` to the proxy `fields` list and wire the service-shape consumption — analogous to how [[issues/tb-17-edge-function-cuisine-tag|tb-17]] wired the cuisine tag. Out of scope for the Q1-Q4 premium-data work; this is a parameter, not a quiz question.
