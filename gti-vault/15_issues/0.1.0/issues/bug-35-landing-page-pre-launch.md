---
issue: bug-35
title: Build pre-public-launch landing page at `/` (Entry surface, App Store redirect + product background)
status: needs-triage
type: HITL
github_issue: 276
created: 2026-05-26
grilled: null
parent_grill: workflow-review-2026-05-26 finding #2
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# bug-35 â€” Pre-public-launch landing page at `/` (HITL placeholder)

## Symptom

`web/app/page.tsx` is a 54-line "Coming soon" placeholder. The `/workflow-review` audit on 2026-05-26 flagged this as an S1 violation of [[../../../30_design/interaction-patterns/principles#P-02. Instant Gratification|P-02 (Instant Gratification)]] and [[../../../30_design/interaction-patterns/surfaces#Entry|Entry-surface required patterns]] â€” no Clear Entry Points, no value delivered before sign-up wall.

The `/grill-with-docs` grill on 2026-05-26 (finding #2) resolved the surface-intent question: `/` is a real **Entry surface**, not a Redirect placeholder. See [[../../../40_marketing_branding/landing-page-positioning|landing-page-positioning.md]] for the scope frame.

The design + build is deferred â€” the marketing voice that the landing page would speak in does not yet exist. This issue is a placeholder for a future grill session that will resolve the design open-questions and produce a buildable spec.

## Why HITL

The future grill cannot run AFK. The marketing voice, positioning copy, visual register choice, and CTA hierarchy are founder-driven product calls that need a human in the loop. Once the future grill closes with a buildable spec, the implementation may flip to AFK (or stay HITL â€” the future grill decides).

## What the future grill must resolve

(See also [[../../../40_marketing_branding/landing-page-positioning|landing-page-positioning.md]] Â§"What the surface must do".)

- **Positioning copy.** One-sentence what-GetToIt-is. Founder voice â€” not derivable from existing docs.
- **CTA hierarchy.** App Store badge (primary) plus what else, if anything. Default assumption: App Store badge only.
- **Background content.** Sections, length, depth. Depends on marketing voice that does not yet exist.
- **Visual register.** Inherit the app's dark Sunset Pop, or use a different register for marketing voice. Tradeoff: continuity vs differentiation.
- **Mobile vs desktop layout.** First GetToIt surface most desktop visitors see â€” needs a deliberate desktop hero composition (the app is mobile-first; the landing page is the exception).
- **Footer + legal.** Coordinate with audit finding [[wfr-10-global-footer-web|wfr-10]] (global web footer) â€” likely the landing page's footer is the global footer, and shipping #wfr-10 first means this issue inherits it.

## What this issue does NOT do pre-grill

- Wire any CSS, copy, or React component changes.
- Decide marketing voice.
- Block other work that's not directly coupled (audit findings #wfr-06..#wfr-31 stay independent).

## Acceptance criteria (placeholder â€” future grill expands)

- [ ] A `/grill-with-docs` session has produced a buildable spec for `web/app/page.tsx`.
- [ ] The spec has been recorded in [[../../../40_marketing_branding/landing-page-positioning|landing-page-positioning.md]] or a sibling note.
- [ ] Marketing voice / positioning copy lives in `40_marketing_branding/` and is referenceable.
- [ ] Public-launch checklist references this issue as a pre-launch blocker (per [[../../../40_marketing_branding/landing-page-positioning|landing-page-positioning.md]] â€” "Public launch is blocked on this surface shipping").
- [ ] A downstream AFK or HITL build issue is spawned to implement the spec.

## Notes for the future grill driver

- This is grill-bucket finding #2 from the 2026-05-26 workflow-review. The grill seed in the audit report was a starter, not the whole tree. Expect the future grill to fan out into positioning + voice + CTA + visual-register sub-trees.
- Be wary of TB-17 coupling. The memory entry [[project_tb17_deferred]] refers to TestFlight cohort recruitment, NOT this landing page. They are independent.
- The audit finding's P-02 violation is real and stays real until this surface ships. Closing this issue without shipping the landing page would close it as `wontfix` or `deferred`, not as `done`.

## Surfaced by

`/workflow-review` audit, 2026-05-26. Finding #2, S1 cognition tier. Grill closed 2026-05-26 with a "defer build, track as HITL" outcome.

## References

- [[../../../40_marketing_branding/landing-page-positioning|landing-page-positioning.md]] â€” positioning + scope frame
- [[../_runs/2026-05-26-0958-workflow-review|2026-05-26 workflow review]] â€” audit report (finding #2)
- [[../../../30_design/interaction-patterns/surfaces#Entry|surfaces.md Â§Entry]] â€” Entry surface playbook
- [[../../../30_design/interaction-patterns/principles#P-02. Instant Gratification|principles.md Â§P-02]] â€” the foundation gate this surface fails today
- [[project_pre_public_launch_milestone]] (memory)
- `web/app/page.tsx` â€” the current placeholder
- `web/app/layout.tsx` â€” global shell that will host the landing-page footer + chrome
- [[wfr-10-global-footer-web]] (when the `/to-issues` session names it) â€” coordinate footer ownership
