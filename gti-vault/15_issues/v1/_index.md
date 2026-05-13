---
folder: 15_issues/v1
purpose: v1 PRD implementation — tracer-bullet build slices + design-system spec-gap issues
---

# v1 — Implementation Issues

Implementation tickets feeding the v1 PRD. The canonical PRD lives at [[../../10_prds/v1-prd|gti-vault/10_prds/v1-prd.md]] — this folder hosts only the discrete issues that PRD generated.

Two issue groups:

- **Tracer-bullet build slices** (`tb-NN-*`) — vertical slices that cut through every layer (schema → Edge → iOS / web → tests) and are demoable end-to-end. Picked up by an AFK agent in dependency order. Some are HITL (external accounts, legal, recruitment).
- **Design-system spec-gap issues** (`NN-*`) — surface-level changes to the locked `design-system/` spec that the PRD requires. Each is consumed by exactly one tracer bullet (cross-referenced via `implements_spec_gap` in the tracer bullet's frontmatter).

All issues have `status: ready-for-agent`.

## Tracer-bullet build slices

| # | Title | Type | Blocked by |
|---|---|---|---|
| TB-00 | [[issues/tb-00-external-accounts\|External account setup]] | HITL | — |
| TB-01 | [[issues/tb-01-walking-skeleton\|Walking skeleton]] | AFK | TB-00 |
| TB-02 | [[issues/tb-02-room-create-deeplink-join\|Initiator creates room + invitee deep-link join]] | AFK | TB-01 |
| TB-03 | [[issues/tb-03-s01-timer-radius\|S01 timer chip + radius slider]] | AFK | TB-02 |
| TB-04 | [[issues/tb-04-full-quiz\|Full 5-question quiz]] | AFK | TB-02 |
| TB-05 | [[issues/tb-05-foursquare-placesproxy\|Foursquare PlacesProxy + cache]] | AFK | TB-01, TB-00 |
| TB-06 | [[issues/tb-06-verdict-engine-clean-run\|VerdictEngine clean run + S05 default]] | AFK | TB-04, TB-05 |
| TB-07 | [[issues/tb-07-waiting-realtime-fire-trigger\|Waiting + Realtime + fire trigger]] | AFK | TB-06 |
| TB-08 | [[issues/tb-08-ratification-push-hard-close\|Ratification + push perm + hard close]] | AFK | TB-07 |
| TB-09 | [[issues/tb-09-no-survivor-terminal\|Soft-pref relax + no-survivor terminal]] | AFK | TB-06 |
| TB-10 | [[issues/tb-10-reroll\|Reroll sheet + 3-cap + reason-to-constraint]] | AFK | TB-08 |
| TB-11 | [[issues/tb-11-late-joiner-read-only\|Late-joiner read-only verdict]] | AFK | TB-08 |
| TB-12 | [[issues/tb-12-apple-signin-upgrade\|Apple Sign-in upgrade chip]] | AFK | TB-02 |
| TB-13 | [[issues/tb-13-solo-mode-variant\|Solo mode variant]] | AFK | TB-08 |
| TB-14 | [[issues/tb-14-checkin-telemetry\|Next-day check-in + telemetry views]] | AFK | TB-08 |
| TB-15 | [[issues/tb-15-web-fallback\|Web fallback (Next.js)]] | AFK | TB-07 |
| TB-16 | [[issues/tb-16-privacy-legal-delete\|Privacy + TOS + Nutrition Labels + delete]] | HITL | TB-14, TB-00 |
| TB-17 | [[issues/tb-17-testflight-cohort\|TestFlight external + cohort 1 recruit]] | HITL | TB-16 |

### Critical path

TB-00 → TB-01 → TB-02 → TB-04 → TB-05 → TB-06 → TB-07 → TB-08 → TB-14 → TB-16 → TB-17.

### Parallel branches

- TB-03 (S01 controls) — branches off TB-02; can run in parallel with TB-04.
- TB-09 (no-survivor) — branches off TB-06.
- TB-10 (reroll), TB-11 (late-joiner), TB-13 (solo) — branch off TB-08.
- TB-12 (Apple link) — branches off TB-02; can run very early in parallel with TB-04 onward.
- TB-15 (web fallback) — branches off TB-07.

## Design-system spec-gap issues

These are surface-level changes to the locked `design-system/` spec required by the PRD. Each is referenced by exactly one tracer bullet via `implements_spec_gap` in that tracer bullet's frontmatter.

- [[issues/01-s01-timer-radius-controls|01 — S01 timer chip + radius slider]] (consumed by TB-03)
- [[issues/02-s04-decide-now-countdown|02 — S04 Decide-now + countdown]] (consumed by TB-07)
- [[issues/03-s05-late-joiner-read-only|03 — S05 read-only mode]] (consumed by TB-11)
- [[issues/04-s05-no-survivor-terminal|04 — S05 no-survivor terminal]] (consumed by TB-09)
- [[issues/05-foursquare-dietary-tags|05 — Foursquare dietary-tag coverage research]] (informs TB-05)

## Related

- [[../../10_prds/v1-prd|v1 PRD]] — canonical product requirements
- [[../../50_product/v1-design-locks|v1-design-locks]] — research deliverables and PRD-grill resolutions
- [[../../50_product/v1-scope|v1-scope]] — what ships, what defers
