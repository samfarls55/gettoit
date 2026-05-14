---
folder: 15_issues/v1
purpose: v1 PRD implementation — tracer-bullet build slices + design-system spec-gap issues
---

# v1 — Implementation Issues

Implementation tickets feeding the v1 PRD. The canonical PRD lives at [[../../10_prds/v1-prd|gti-vault/10_prds/v1-prd.md]] — this folder hosts only the discrete issues that PRD generated.

Two issue groups:

- **Tracer-bullet build slices** (`tb-NN-*`) — vertical slices that cut through every layer (schema → Edge → iOS / web → tests) and are demoable end-to-end. Picked up by an AFK agent in dependency order. Some are HITL (external accounts, legal, recruitment).
- **Design-system spec-gap issues** (`NN-*`) — surface-level changes to the locked `design-system/` spec that the PRD requires. Each is consumed by exactly one tracer bullet (cross-referenced via `implements_spec_gap` in the tracer bullet's frontmatter).

Tracer-bullet issues have `status: ready-for-agent`. **All 5 design-system spec-gap issues (`01`–`05`) landed 2026-05-12** — see `design-system/CHANGELOG.md`. Tracer bullets that depend on them (TB-03, TB-07, TB-09, TB-11, TB-05) are now unblocked on the spec side.

## Tracer-bullet build slices

| # | Title | Type | GitHub | Blocked by |
|---|---|---|---|---|
| TB-00 | [[issues/tb-00-external-accounts\|External account setup]] | HITL | [#1](https://github.com/samfarls55/gettoit/issues/1) | — |
| TB-01 | [[issues/tb-01-walking-skeleton\|Walking skeleton]] ✅ done | AFK | [#2](https://github.com/samfarls55/gettoit/issues/2) | TB-00 |
| TB-02 | [[issues/tb-02-room-create-deeplink-join\|Initiator creates room + invitee deep-link join]] ✅ done | AFK | [#3](https://github.com/samfarls55/gettoit/issues/3) | TB-01 |
| TB-03 | [[issues/tb-03-s01-timer-radius\|S01 timer chip + radius slider]] ✅ done | AFK | [#4](https://github.com/samfarls55/gettoit/issues/4) | TB-02 |
| TB-04 | [[issues/tb-04-full-quiz\|Full 5-question quiz]] ✅ done | AFK | [#5](https://github.com/samfarls55/gettoit/issues/5) | TB-02 |
| TB-05 | [[issues/tb-05-foursquare-placesproxy\|Foursquare PlacesProxy + cache]] ✅ done | AFK | [#6](https://github.com/samfarls55/gettoit/issues/6) | TB-01, TB-00 |
| TB-06 | [[issues/tb-06-verdict-engine-clean-run\|VerdictEngine clean run + S05 default]] ✅ done | AFK | [#7](https://github.com/samfarls55/gettoit/issues/7) | TB-04, TB-05 |
| TB-07 | [[issues/tb-07-waiting-realtime-fire-trigger\|Waiting + Realtime + fire trigger]] ✅ done | AFK | [#8](https://github.com/samfarls55/gettoit/issues/8) | TB-06 |
| TB-08 | [[issues/tb-08-ratification-push-hard-close\|Ratification + push perm + hard close]] ✅ done | AFK | [#9](https://github.com/samfarls55/gettoit/issues/9) | TB-07 |
| TB-09 | [[issues/tb-09-no-survivor-terminal\|Soft-pref relax + no-survivor terminal]] ✅ done | AFK | [#10](https://github.com/samfarls55/gettoit/issues/10) | TB-06 |
| TB-10 | [[issues/tb-10-reroll\|Reroll sheet + 3-cap + reason-to-constraint]] | AFK | [#11](https://github.com/samfarls55/gettoit/issues/11) | TB-08 |
| TB-11 | [[issues/tb-11-late-joiner-read-only\|Late-joiner read-only verdict]] | AFK | [#12](https://github.com/samfarls55/gettoit/issues/12) | TB-08 |
| TB-12 | [[issues/tb-12-apple-signin-upgrade\|Apple Sign-in upgrade chip]] ✅ done | AFK | [#13](https://github.com/samfarls55/gettoit/issues/13) | TB-02 |
| TB-13 | [[issues/tb-13-solo-mode-variant\|Solo mode variant]] | AFK | [#14](https://github.com/samfarls55/gettoit/issues/14) | TB-08 |
| TB-14 | [[issues/tb-14-checkin-telemetry\|Next-day check-in + telemetry views]] ✅ done | AFK | [#15](https://github.com/samfarls55/gettoit/issues/15) | TB-08 |
| TB-15 | [[issues/tb-15-web-fallback\|Web fallback (Next.js)]] ✅ done | AFK | [#16](https://github.com/samfarls55/gettoit/issues/16) | TB-07 |
| TB-16 | [[issues/tb-16-privacy-legal-delete\|Privacy + TOS + Nutrition Labels + delete]] | HITL | [#17](https://github.com/samfarls55/gettoit/issues/17) | TB-14, TB-00 |
| TB-17 | [[issues/tb-17-testflight-cohort\|TestFlight external + cohort 1 recruit]] | HITL | [#18](https://github.com/samfarls55/gettoit/issues/18) | TB-16 |

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

| # | Title | Status | GitHub | Consumed by |
|---|---|---|---|---|
| 01 | [[issues/01-s01-timer-radius-controls\|S01 timer chip + radius slider]] | ✅ done | [#19](https://github.com/samfarls55/gettoit/issues/19) | TB-03 |
| 02 | [[issues/02-s04-decide-now-countdown\|S04 Decide-now + countdown]] | ✅ done | [#20](https://github.com/samfarls55/gettoit/issues/20) | TB-07 |
| 03 | [[issues/03-s05-late-joiner-read-only\|S05 read-only mode]] | ✅ done | [#21](https://github.com/samfarls55/gettoit/issues/21) | TB-11 |
| 04 | [[issues/04-s05-no-survivor-terminal\|S05 no-survivor terminal]] | ✅ done | [#22](https://github.com/samfarls55/gettoit/issues/22) | TB-09 |
| 05 | [[issues/05-foursquare-dietary-tags\|Foursquare dietary-tag coverage research]] | ✅ done · `needs-human-review` for Lock 1 update | [#23](https://github.com/samfarls55/gettoit/issues/23) | TB-05 (informs) |

## Related

- [[../../10_prds/v1-prd|v1 PRD]] — canonical product requirements
- [[../../50_product/v1-design-locks|v1-design-locks]] — research deliverables and PRD-grill resolutions
- [[../../50_product/v1-scope|v1-scope]] — what ships, what defers
