---
status: done
type: AFK
github_issue: 345
---

# TB-01: Google Provider Contract To Q5 Name-Only Cards

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Introduce the first Google Places provider path behind the existing provider Edge Function seam so Q5 can request real Google candidates and render name-only cards with Google attribution. The server owns API key access, request construction, named field-mask contracts, response shaping, redaction, attribution payloads, bounded retries, and fail-closed guardrails. Clients receive only the Q5 display contract they need: Google Place ID, current display name, and attribution/render instruction.

This slice proves Google can replace the current Foursquare / MapKit candidate source for the narrow Q5 card surface without exposing the Google key, letting clients widen field masks, or storing Google display content.

## Acceptance criteria

- [ ] Q5 candidate requests go through the Supabase Edge Function; mobile and web clients do not call Google directly.
- [ ] The server uses named/versioned field-mask contracts and rejects or ignores any client attempt to request extra Google fields.
- [ ] The Q5 response contract contains Google Place ID, current display name, and attribution/render instruction only.
- [ ] The Q5 response does not include summaries, ratings, hours, photos, addresses, atmosphere fields, raw reviews, editorial summary, raw Google payloads, or Maps URI.
- [ ] Google API key, request shaping, redaction, bounded retry behavior, and fail-closed guardrail behavior are covered by tests.
- [ ] Logs emitted by this path avoid Google display content, provider facts, raw responses, and stale place names.

## Blocked by

None - can start immediately.
