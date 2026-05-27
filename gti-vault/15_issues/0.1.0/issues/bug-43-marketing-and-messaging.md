---
issue: bug-43
title: Marketing and messaging — positioning, voice, copy before v1
status: needs-triage
type: HITL
github_issue: 315
created: 2026-05-26
grilled: null
---

# bug-43 — Marketing and messaging (HITL placeholder)

## Symptom

GetToIt does not yet have a settled marketing voice, positioning copy, or messaging system. Several pre-launch surfaces are blocked on this:

- Landing page at `/` ([[bug-35-landing-page-pre-launch]]) — explicitly deferred until marketing voice exists
- App Store listing copy — subtitle, promotional text, screenshot captions
- In-app onboarding/empty-state copy
- Any social, share-sheet, or invite copy
- Support email tone + canned replies ([[project_support_email_todo]])

## Why HITL

Voice, positioning, and tagline copy are founder-driven product calls. Cannot be derived from existing docs. Once positioning + voice are locked, downstream surface copy can be drafted (some AFK with founder review on PR; some HITL).

## What this issue does NOT do pre-grill

- Write any copy.
- Touch landing page, ASC listing, in-app strings.
- Decide channel/distribution strategy (separate concern).

## Acceptance criteria (placeholder)

- [ ] One-sentence positioning locked ("GetToIt is the app that ___").
- [ ] Voice + tone guide written under `40_marketing_branding/`.
- [ ] Tagline / subtitle locked.
- [ ] Downstream copy issues spawned (landing page, ASC listing, onboarding, share sheet).

## Surfaces blocked on this

- [[bug-35-landing-page-pre-launch]] — landing page deferred on marketing voice
- ASC listing pre-launch update
- In-app onboarding + empty-state copy review

## References

- `40_marketing_branding/` — positioning + voice + brand docs (sparse today)
- [[40_marketing_branding/landing-page-positioning|landing-page-positioning.md]] — scope frame for `/`
- [[project_pre_public_launch_milestone]] (memory)
- [[bug-42-app-rename-and-logo]] — sibling rename/identity issue
