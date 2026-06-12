---
status: done
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

- [x] Voyage API data-use/retention review is complete and acceptable for ADR 0022 / ADR 0023 boundaries when the Voyage org opt-out is enabled before sending Google-derived text.
- [x] `VOYAGE_API_KEY` is present as a server-only secret and never printed during verification.
- [x] The server-side kill switch is verified both disabled and enabled.
- [x] All required synthetic fixture, privacy, storage, and observability tests are passing before enablement.
- [x] Opt-in live smoke uses `VOYAGE_API_KEY` and explicit live-smoke flag only, with app-authored synthetic summaries/anchors.
- [ ] Manual calibration confirms common vibe language lands plausibly on the Quiet-to-Rowdy band, with no committed Google-derived text.
- [x] Manual privacy/logging audit inspects one successful embedding run, one provider failure, one budget exhaustion, and one disabled-mode run for leaks.
- [x] If any gate fails, embeddings remain disabled or provider choice is revisited before product traffic uses embeddings.

## Blocked by

- [[tb-08-privacy-storage-and-observability-proof|TB-08: Privacy, Storage, And Observability Proof]] - GH [#365](https://github.com/samfarls55/gettoit/issues/365)

## Closeout - 2026-06-12

Decision: do not enable production vibe embeddings for v0.1.0. The HITL gate is complete, and the failed calibration gate leaves embeddings disabled behind `VIBE_EMBEDDINGS_ENABLED=false`.

Validation:

- Voyage review: FAQ, Terms, Privacy Policy, and DPA reviewed. Voyage supports hosted API data storage/training opt-out with zero-day retention after opt-out, but the org dashboard opt-out was not independently verifiable from this workspace. The provider is acceptable for ADR 0022 / ADR 0023 only after opt-out is verified before sending Google-derived text.
- Secret posture: `VOYAGE_API_KEY` is present in Supabase Edge Function secrets and GitHub Actions secrets by name only; no raw key value was printed in closeout notes. `VIBE_EMBEDDINGS_ENABLED` is present and was pinned to `false` in Supabase and GitHub Actions after smoke testing.
- Kill switch: disabled read-back returned `embeddingsEnabled=false`; enabled smoke was run only by temporarily setting `VIBE_EMBEDDINGS_ENABLED=true`, then restored to `false`.
- Live smoke: temporary `tb09-vibe-smoke` used the runtime Voyage key plus the explicit enabled flag with app-authored synthetic summaries only. Success, disabled, provider failure, and budget exhaustion scenarios all returned controlled status/count/receipt payloads. The temporary remote function was deleted and returned 404 afterward; the local temp file was removed.
- Calibration: five app-authored cases (`cal-quiet`, `cal-chill`, `cal-social`, `cal-lively`, `cal-rowdy`) all landed in low-confidence `social` with `vibe_conflicting_evidence`. This is not plausible Quiet-to-Rowdy calibration, so the enablement gate failed.
- Privacy/logging audit: Supabase connector request logs exposed only POST status/URL/function metadata for the smoke invocations. The emitted smoke payloads carried aggregate counts, buckets, and controlled receipt codes only; no source summaries, vectors, `VOYAGE_API_KEY`, Google place names/content, numeric vibe positions, or numeric confidence values appeared in the inspected output.
- Verification: `npx --yes deno test --allow-net --allow-env --allow-read` from `supabase/functions` passed with 542 passed, 0 failed, 3 ignored.

Code note: the checklist found production wiring issues while validating. `compute-verdict` now reads the canonical `VIBE_EMBEDDINGS_ENABLED` flag, uses the live Voyage scoring flow only when enabled, keeps deterministic fake scoring for fake-mode tests, and the CI edge-deploy lane can push `VOYAGE_API_KEY` plus the disabled-by-default flag. This wiring does not enable product traffic.
