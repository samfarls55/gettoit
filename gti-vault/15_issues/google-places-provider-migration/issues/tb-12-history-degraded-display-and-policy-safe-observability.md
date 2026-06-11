---
status: ready-for-agent
type: AFK
github_issue: 356
---

# TB-12: History Degraded Display And Policy-Safe Observability

## Parent

GitHub parent: [#344](https://github.com/samfarls55/gettoit/issues/344)

Vault parent: [[../PRD|Google Places Provider Migration PRD]]

## What to build

Make Plan history and observability honor the same Google storage boundary as live flows. History refetches current Google display data by Place ID when it needs to show a past verdict. If refetch fails, history degrades to app-owned Plan context only: Plan name, decided time, "Place unavailable", and unavailable details. Outcome labels, reason codes, receipts, logs, analytics, and telemetry remain app-owned, controlled, place-name-free, provider-fact-free, and append-only where released.

This slice closes the long-tail leakage risk: stale place names, provider facts, and raw payloads must not survive in history or operational data.

## Acceptance criteria

- [ ] Plan history refetches current Google display data by Place ID before showing place content.
- [ ] Failed history refetch displays degraded app-owned content without stale place name, address, Maps URI, summaries, ratings, hours, price, atmosphere, types, photos, or raw payload.
- [ ] Degraded history shows Plan name, decided time, "Place unavailable", and unavailable details.
- [ ] Outcome labels are stored as controlled app-owned behavioral signals.
- [ ] System skips and refetch failures are stored as operational receipts, not user outcome labels.
- [ ] Reason codes are app-authored, controlled, place-name-free, provider-fact-free, stable, and append-only once released.
- [ ] Logs, analytics, and telemetry avoid Google display content, provider facts, raw responses, stale names, and per-place overfetch identifiers.
- [ ] Google Place IDs appear in operational logs only when necessary for access-controlled short-retention debugging.
- [ ] Tests cover history refetch, degraded history, outcome labels, reason codes, receipts, log redaction, analytics redaction, and overfetch telemetry aggregation.

## Blocked by

- [[tb-02-google-only-durable-storage-baseline|TB-02: Google-Only Durable Storage Baseline]] - GH [#346](https://github.com/samfarls55/gettoit/issues/346)
- [[tb-11-verdict-display-refetch-slate-and-rerolls|TB-11: Verdict Display Refetch, Slate, And Rerolls]] - GH [#355](https://github.com/samfarls55/gettoit/issues/355)
