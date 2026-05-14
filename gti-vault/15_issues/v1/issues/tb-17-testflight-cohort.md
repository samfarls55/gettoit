---
issue: tb-17
title: TestFlight external + cohort 1 recruitment
github_issue: 18
status: deferred
deferred_until: founder comfortable living in app + v1.1 TBs/bugs cleared
type: HITL+AFK
created: 2026-05-12
prd: v1-prd
---

# TB-17 — TestFlight external + cohort 1 recruit

## Parent

[[../../../10_prds/v1-prd|v1 PRD]]

## What to build

The final HITL slice — get a real beta cohort running so the north-star metric can be measured. Per [[../../../50_product/v1-scope|v1-scope]] the cohort is 3–5 friend groups of 3–6 members in a single metro, hand-picked from the founder's own social network.

- **App Store Connect setup** — bundle ID configured, app record created, screenshots prepared (one per locked surface in canonical state), description copy drafted (placeholder until `40_marketing_branding/` ships real strings).
- **TestFlight external testing group** — configured, beta-app-review submitted, public link generated. External TestFlight requires the Privacy Policy URL from TB-16.
- **Cohort 1 recruitment** — founder reaches out to 3–5 friend groups (3–6 members each), explains the beta, distributes the TestFlight link. Recruitment plan, contact log, and consent (informal — friend-group context, not IRB).
- **Cohort 1 success-gate instrumentation** — confirm the four public-release gate signals from PRD §"Public-release gates" are observable from cohort 1 data via the `metric_*` SQL views and the `events` table:
  1. Follow-through % meeting retroactive target.
  2. ≥3 decisions/group/week sustained over 2 weeks.
  3. <10% verdict failures.
  4. Some beta invitees becoming initiators.
- **Cohort debrief plan** — schedule a 15-min debrief with one member from each friend group at the end of week 2. Capture (a) what surprised them, (b) what they'd reroll if they could, (c) whether they'd use it without the beta context.

## Acceptance criteria

- [ ] App Store Connect record created; TestFlight external testing group active.
- [ ] Public TestFlight link generated.
- [ ] 3–5 friend groups recruited; TestFlight builds installed by ≥80% of recruited members.
- [ ] Cohort 1 has run ≥1 complete decision per group with the metric landing in the SQL views.
- [ ] Founder has completed at least one end-to-end run as a non-founder participant (a friend's group, founder invited as a regular member).
- [ ] Debrief notes captured for each group at week 2.

## Blocked by

- [[tb-16-privacy-legal-delete|TB-16]]

## Engineering notes

### AFK scaffolding landed 2026-05-14

The CI plumbing for archive + upload to TestFlight is in place
ahead of the HITL bits above. Every push to `main` after the `ios`
test lane goes green now runs the `testflight` job in
`.github/workflows/ci.yml`:

- `xcodegen generate` → `xcodebuild archive` with App Store Connect
  API-key auth (no fastlane / Match) → `xcodebuild -exportArchive`
  with `ios/exportOptions.plist` (`method=app-store`, team
  `WXTMNYM34A`, `signingStyle=automatic`) → `xcrun altool
  --upload-app`.
- `CFBundleVersion = $(CURRENT_PROJECT_VERSION)` in `ios/project.yml`;
  the CI lane overrides with `CURRENT_PROJECT_VERSION=$GITHUB_RUN_NUMBER`
  so every upload gets a unique, monotonically-increasing build
  number (TestFlight rejects duplicates).
- The job self-skips when the three App Store Connect API key
  secrets aren't set, so the workflow stays green for forks /
  fresh clones / the period before the HITL setup below is done.

The HITL setup walkthrough (App Store Connect app record, API key
generation, the three GitHub secrets, internal-tester invite,
TestFlight install) lives in `ios/README.md` §TestFlight setup.
That doc is the gate that flips the `testflight` job from "skip"
to "upload". The external-tester + beta-app-review + cohort
recruitment pieces below all still require the HITL work.
