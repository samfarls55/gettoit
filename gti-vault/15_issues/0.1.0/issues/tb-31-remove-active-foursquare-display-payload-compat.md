---
status: ready-for-agent
type: AFK
github_issue: 371
---

# TB-31: Remove Active Foursquare And Display Payload Compatibility

## What to build

Remove remaining active runtime dependence on Foursquare-era provider shapes and stale display payload fallback after Google provider policy is centralized. Current active flows should use Google Place ID plus app-owned receipts, and should refetch display content through the Google provider display path when display is needed.

This slice is intentionally after provider centralization so removal work has a safe replacement seam. Do not remove historical documentation or intentional legacy read support that is still needed for old data; remove active behavior that can affect current Q5, Verdict, or web invitee flows.

## Acceptance criteria

- [ ] Active Q5 behavior no longer depends on Foursquare-era candidate fetch, classifier, cache, or payload shape.
- [ ] Active Verdict behavior no longer writes or reads Google identity through `fsq_place_id` compatibility in current flows.
- [ ] Web Verdict display no longer falls back to stale option payload display fields for current Google-backed Verdicts.
- [ ] Current durable state for new Rooms stores Google identity and app-owned receipts within ADR 0022 boundaries.
- [ ] Legacy compatibility, if still required for old rows, is isolated behind explicit read/migration adapters and is not on the current happy path.
- [ ] Tests prove current Q5, Verdict fetch, Verdict slate, and display refetch pass without Foursquare runtime paths or display payload fallback.
- [ ] Deployment checks or edge-function tests prove removed compatibility does not break current provider configuration.

## Blocked by

- [[tb-30-centralize-google-provider-runtime-policy|TB-30: Centralize Google Provider Runtime Policy]] - GH [#370](https://github.com/samfarls55/gettoit/issues/370)
