---
status: done
type: AFK
github_issue: 363
---

# TB-06: Q5 Vibe Keep/Drop Selection

## Parent

GitHub parent: [#357](https://github.com/samfarls55/gettoit/issues/357)

Vault parent: [[../PRD|Vibe Embeddings Scoring PRD]]

## What to build

Use the shared Vibe fit signal inside Q5 card generation so the vibe-axis cards choose meaningful keep/drop candidates on the same Quiet-to-Rowdy ruler used by final scoring. Q5 uses a stricter confidence bar than verdict scoring, keeps sit near the member's selected Vibe band, drops sit meaningfully outside it while matching other axes, and thin pools relax vibe confidence or contrast before clean failure.

The Q5 UI remains unchanged and still shows only the allowed card content for v0.1.0.

## Acceptance criteria

- [ ] Q5 vibe-axis selection consumes the shared Vibe Fit scorer through a thin adapter.
- [ ] Vibe keep candidates sit near the member's selected Vibe band when confidence and pool shape allow.
- [ ] Vibe drop candidates sit meaningfully outside the selected band while preserving the strict-factorial Q5 card role.
- [ ] Q5 uses stricter Vibe confidence/contrast thresholds than final verdict scoring.
- [ ] Thin pools relax vibe confidence or contrast before failing, using controlled receipt codes.
- [ ] Disabled/unavailable embeddings preserve the vibe-axis card shape when weak hints or neutral/low-confidence behavior can do so honestly.
- [ ] If a useful vibe-axis card cannot be formed, Q5 fails cleanly rather than inferring from a broken probe.
- [ ] Tests cover keep/drop contrast, relaxation order, disabled embeddings, embedding failure, no-results behavior, and no client-visible summary/embedding data.

## Blocked by

- [[tb-04-google-summary-mask-and-vibefitcandidate-path|TB-04: Google Summary Mask And VibeFitCandidate Path]] - GH [#361](https://github.com/samfarls55/gettoit/issues/361)
- [[tb-05-voyage-wrapper-budgets-kill-switch-and-degradation|TB-05: Voyage Wrapper, Budgets, Kill Switch, And Degradation]] - GH [#362](https://github.com/samfarls55/gettoit/issues/362)
