---
status: ready-for-agent
type: AFK
github_issue: 368
---

# TB-28: Move Web And Mobile Q5 Onto Assigned Card Sets

## What to build

Move both active Q5 clients onto the server-assigned card set seam. Web invitee Q5 and mobile Q5 should ask the server for assigned cards, render the returned provider-safe display fields, and submit ratings against the server-provided card receipts. Client code should stop assigning Q5 axis roles from local classifier logic, provider result order, or result indexes.

This slice should preserve the current user journey: members answer Q1-Q4, see Q5 place-name cards, rate them, submit, and advance to Waiting. The architectural change is that client-side Q5 modules become adapters over the server-owned Q5 Candidate Pool.

## Acceptance criteria

- [ ] Web invitee Q5 loads assigned Q5 cards from the server-owned card set path.
- [ ] Mobile Q5 loads assigned Q5 cards from the same server-owned card set path.
- [ ] Both clients render provider-safe name-only cards with attribution, without reading raw provider payloads for Q5 behavior.
- [ ] Both clients submit Q5 ratings using the server-provided card receipts and canonical axis language.
- [ ] Web no longer depends on active Foursquare-era Q5 candidate fetch behavior for the current Q5 flow.
- [ ] Mobile no longer derives Q5 profile roles from provider result indexes for the current Q5 flow.
- [ ] Existing resume/progress behavior still returns members to the correct Q5 step without creating duplicate card sets.
- [ ] Tests cover web Q5 load/submit, mobile Q5 load/submit, resume behavior, and no-results/degraded card set handling.

## Blocked by

- [[tb-27-server-assigned-q5-card-sets|TB-27: Server-Assigned Q5 Card Sets]] - GH [#367](https://github.com/samfarls55/gettoit/issues/367)
