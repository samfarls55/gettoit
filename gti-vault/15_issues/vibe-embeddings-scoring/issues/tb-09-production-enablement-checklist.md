---
status: ready-for-human
type: HITL
github_issue: 366
---

# TB-09: Production Enablement Checklist

## Parent

GitHub parent: [#357](https://github.com/samfarls55/gettoit/issues/357)

Vault parent: [[../PRD|Vibe Embeddings Scoring PRD]]

## What to build

Complete the human production enablement gate for transient Vibe embeddings in the single v0.1.0 production environment. Confirm Voyage data-use/retention terms, verify the Supabase secret and server-side kill switch, run the opt-in live smoke/calibration path using app-authored examples only, and perform the manual privacy/logging audit required by the PRD.

This slice decides whether embeddings are enabled in production or left disabled behind the kill switch.

## Acceptance criteria

- [ ] Voyage API data-use/retention review is complete and acceptable for ADR 0022 / ADR 0023 boundaries.
- [ ] `VOYAGE_API_KEY` is present as a server-only secret and never printed during verification.
- [ ] The server-side kill switch is verified both disabled and enabled.
- [ ] All required synthetic fixture, privacy, storage, and observability tests are passing before enablement.
- [ ] Opt-in live smoke uses `VOYAGE_API_KEY` and explicit live-smoke flag only, with app-authored synthetic summaries/anchors.
- [ ] Manual calibration confirms common vibe language lands plausibly on the Quiet-to-Rowdy band, with no committed Google-derived text.
- [ ] Manual privacy/logging audit inspects one successful embedding run, one provider failure, one budget exhaustion, and one disabled-mode run for leaks.
- [ ] If any gate fails, embeddings remain disabled or provider choice is revisited before product traffic uses embeddings.

## Blocked by

- [[tb-08-privacy-storage-and-observability-proof|TB-08: Privacy, Storage, And Observability Proof]] - GH [#365](https://github.com/samfarls55/gettoit/issues/365)
