---
status: done
type: AFK
github_issue: 364
---

# TB-07: Verdict Per-Member Vibe Scoring

## Parent

GitHub parent: [#357](https://github.com/samfarls55/gettoit/issues/357)

Vault parent: [[../PRD|Vibe Embeddings Scoring PRD]]

## What to build

Use the shared Vibe fit signal inside final verdict scoring. Each candidate's transient `vibe_position` is scored independently against each active member's selected Vibe band, then blended into the final aggregate fit score. Missing or low-confidence Vibe evidence weakens the vibe component toward neutral and caps positive upside without disqualifying the candidate.

Only final app-owned aggregate score, version identifiers, allowed Google Place IDs, Q5 outcome labels, axis roles, and controlled receipts may persist.

## Acceptance criteria

- [ ] Verdict scoring consumes the shared Vibe Fit scorer through a thin adapter.
- [ ] Vibe-axis scoring is per member, not a group-average target first.
- [ ] Missing or low-confidence Vibe evidence blends toward neutral and does not disqualify candidates.
- [ ] Low-confidence fits cap maximum positive contribution so sparse evidence cannot become a perfect vibe match.
- [ ] Candidates with no Vibe evidence remain eligible to win if they score strongly enough on other axes.
- [ ] The durable scoring version identifies Google scoring mask version, Vibe anchor version, span assembler version, embedding provider/model, projection/confidence formula version, Q5 generation rules version, and verdict scoring formula version as applicable.
- [ ] Durable receipts use only controlled app-owned codes and do not store source text, vectors, `vibe_position`, numeric confidence, provider facts, or provider-fact component scores.
- [ ] Tests cover per-member target scoring, neutral degradation, confidence cap, aggregate fit behavior, version persistence, and storage boundaries.

## Blocked by

- [[tb-04-google-summary-mask-and-vibefitcandidate-path|TB-04: Google Summary Mask And VibeFitCandidate Path]] - GH [#361](https://github.com/samfarls55/gettoit/issues/361)
- [[tb-05-voyage-wrapper-budgets-kill-switch-and-degradation|TB-05: Voyage Wrapper, Budgets, Kill Switch, And Degradation]] - GH [#362](https://github.com/samfarls55/gettoit/issues/362)
