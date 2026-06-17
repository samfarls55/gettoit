---
status: ready-for-agent
type: AFK
github_issue: 367
---

# TB-27: Server-Assigned Q5 Card Sets

## What to build

Build the first server-owned Q5 Candidate Pool slice: a member can request a Q5 card set for a locked Room and receive stable, provider-safe cards with app-owned axis receipts. The server owns card assignment, deterministic shuffle, Google request planning for the Q5 preference probe, same-axis replacement bookkeeping, and low/no-results behavior. Clients should be able to render the returned cards without inferring axis roles from provider result order.

This is an architecture-deepening slice, not a product redesign. Keep the visible Q5 experience the same: name-only cards with Google attribution, submitted as the existing Q5 preference probe. The new behavior is that the server becomes the deep module behind the Q5 seam.

## Acceptance criteria

- [ ] A locked Room member can request a Q5 card set and receive card identities, display names, attribution metadata, and app-owned axis receipts.
- [ ] The returned card set uses canonical Q5 axes: `cuisine`, `crowd_approval`, and `vibe`.
- [ ] Server-side deterministic shuffle is keyed to stable app-owned inputs, not Google result order.
- [ ] Card assignment preserves strict-factorial shape when the candidate pool supports it.
- [ ] Thin candidate pools return a clean degraded/no-results outcome instead of forcing clients to infer fallback behavior.
- [ ] Same-axis replacement state is represented by the returned card set or receipts so later clients do not need to reconstruct it.
- [ ] Google display content retention remains inside ADR 0022 boundaries; durable state stores Google identity and app-owned receipts, not provider display payloads.
- [ ] Tests cover assigned card set generation, deterministic ordering, axis receipts, thin-pool degradation, and name-only attribution payloads.

## Blocked by

None - can start immediately.
