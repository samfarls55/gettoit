---
status: ready-for-agent
type: AFK
github_issue: 346
---

# TB-02: Google-Only Durable Storage Baseline

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Move the active durable schema to a Google-only provider model. Fresh local and CI database resets should no longer create active Foursquare / MapKit cache, snapshot, fallback, config, or provider-fact artifacts. Durable place identity should be limited to app-owned records plus `place_provider = "google"` and Google Place ID. Verdict slate, votes, outcome labels, reason codes, room / plan / verdict IDs, final aggregate fit score, scoring version, decided timestamp, winner / reroll metadata, and app-owned receipts remain durable.

This slice establishes the storage boundary that all later provider, Q5, verdict, reroll, and history slices depend on.

## Acceptance criteria

- [ ] A fresh Supabase reset creates no active Foursquare / MapKit provider cache, fallback, env/config, telemetry, or schema artifacts.
- [ ] Durable place identity stores `place_provider = "google"` and Google Place ID where place identity is needed.
- [ ] Durable records do not store Google display name, address, Maps URI, summaries, ratings, hours, price, atmosphere fields, types, photos, raw payloads, provider-fact component scores, or distance.
- [ ] Verdict slate storage supports up to four ranked Google Place IDs plus app-owned rank, final aggregate fit score, scoring version, and receipts.
- [ ] Persisted rule text is place-name-free; any venue-name copy must be composed after current refetch.
- [ ] Migration/storage tests prove both allowed fields and forbidden Google content boundaries.

## Blocked by

None - can start immediately.
