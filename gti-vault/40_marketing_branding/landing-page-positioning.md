---
folder: 40_marketing_branding
purpose: Pre-public-launch landing page (`/`) positioning + scope frame
status: scope-locked (design + build deferred to HITL grill)
date: 2026-05-26
---

# Landing page (`/`) — positioning + scope frame

Closes audit finding [[../15_issues/_runs/2026-05-26-0958-workflow-review|workflow-review 2026-05-26]] #2. Records the surface-intent decision for `web/app/page.tsx` and parks the build work as a HITL issue ([[../15_issues/0.1.0/issues/bug-35-landing-page-pre-launch|bug-35]]).

## Decision (2026-05-26)

`/` is an **Entry surface**, not a Redirect surface. Pre-public-launch the work is **deferred** but tracked.

The two paths the grill considered:

- **Redirect surface.** `/` becomes a deliberately-thin domain placeholder — App Store badge + legal links + a "this domain hosts shared Plan invites" frame. Audit P-02 finding re-classified as non-applicable. Cheap, but commits the long-term shape.
- **Entry surface (chosen).** Real landing page — product positioning, App Store CTA, background on what GetToIt is and the problem it solves. Audit P-02 finding remains real; the fix lands when the page is built.

Founder chose Entry. Pre-public-launch the landing page must (a) tell a first-time visitor what GetToIt is, (b) redirect to the App Store to download, (c) maintain that on a different visitor with different intent (e.g. a friend who heard the name). The placeholder ("Coming soon") is a real audit gap, not a re-frame.

## What the surface must do (sketch — for the future grill)

Inputs the future grill needs to resolve:

- **Positioning copy.** One-sentence what-GetToIt-is. Voice guidelines do not yet exist in `40_marketing_branding/` — they get drafted alongside this surface, not before.
- **CTA hierarchy.** App Store badge (primary) + something else? Sign-up-for-launch-email? Demo video? Pre-launch the answer is probably "App Store + nothing else" but the future grill confirms.
- **Background sections.** What the product does, who it's for, the problem framing. Length and depth depend on the marketing voice that does not yet exist.
- **Visual register.** Dark Sunset Pop register lives in `design-system/tokens.json`; the landing page either inherits that register or chooses something deliberately different for marketing voice. Future grill decides.
- **Mobile vs desktop.** This is the first GetToIt surface a desktop visitor sees; everything else in the app is mobile-first. Layout breakpoints + desktop hero composition are open.

## What pre-launch the surface does NOT need

- A "get notified at launch" signup form. Out of scope — adds account-creation work + email-list infra that doesn't pay for itself pre-launch.
- A press kit, blog, or product-update feed. Out of scope.
- Internationalisation. US-only beta ([[../60_engineering/adr/0006-privacy-posture-0.1.0|ADR 0006]]).
- A11y review beyond the design-system defaults. The page must pass the design-system gates; bespoke a11y work is post-launch.

## Status

- **Scope locked** 2026-05-26: this IS a real Entry surface, not a Redirect placeholder.
- **Design + build deferred** to a future grill session (HITL — the marketing voice doesn't exist yet, founder must drive). Tracked as [[../15_issues/0.1.0/issues/bug-35-landing-page-pre-launch|bug-35]].
- **Public launch is blocked on this surface shipping.** Marketing arrivals to `/` post-launch must not hit "Coming soon."

## See also

- [[../15_issues/0.1.0/issues/bug-35-landing-page-pre-launch|bug-35]] — the placeholder HITL issue
- [[../15_issues/_runs/2026-05-26-0958-workflow-review|2026-05-26 workflow review]] — audit finding #2 origin
- [[../30_design/interaction-patterns/surfaces#Entry]] — Entry surface playbook
- `web/app/page.tsx` — current placeholder (54 lines)
- [[project_pre_public_launch_milestone]] (memory) — the broader milestone this sits inside
- `gti-vault/60_engineering/adr/0006-privacy-posture-0.1.0` — US-only beta scope
