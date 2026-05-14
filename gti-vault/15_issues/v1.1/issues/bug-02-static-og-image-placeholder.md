---
issue: bug-02
title: Invite link in iMessage shows plain text — add placeholder OG image + meta tags
github_issue: 42
status: ready-for-agent
type: AFK
created: 2026-05-14
prd: v1-prd
---

# bug-02 — Static placeholder OG image + meta tags

## Parent

[[../_index|v1.1 backlog]] candidate #2a (split from original #2; #2b deferred to pre-public-launch milestone).

## What's broken

Pasting a `/join/<roomId>` invite link into iMessage today produces plain blue underlined text. No rich-link card, no icon. Two layers contribute:

1. Open Graph / Twitter / Apple `meta` tags are not wired on the destination page.
2. The OG image asset itself (`/og/invite.png`) does not exist.

[[../v1/issues/tb-15-web-fallback|TB-15 §Adjacencies]] already flagged the missing asset as a v1 polish gap. v1.1 closes the placeholder version of that gap.

## Fix scope

**Explicitly non-branded for v1.1.** Goal is "not plain blue text," not "on-brand." Branded version (and dynamic per-invite variant) lives in the pre-public-launch milestone — see [[../_index#v1.1 → pre-public-launch milestone handoff]].

- Produce a placeholder `/og/invite.png` at `web/public/og/invite.png`. Any gradient or solid color is fine. No logo, no copy, no Sunset Pop branding lock-in — branding is deferred and a placeholder that looks intentional risks blocking the branded version's design call.
- Wire OG + Twitter + Apple meta tags into `web/app/join/[roomId]/page.tsx`:
  - `og:image`, `og:title`, `og:description`
  - `twitter:card` (summary_large_image), `twitter:image`
  - `apple-mobile-web-app-title` if applicable
- Image MUST be a real file in the deployed bundle, not a generated route — Apple's iMessage rich-link cache is stricter than other clients.

## Acceptance criteria

- [ ] `web/public/og/invite.png` exists and is served at `/og/invite.png` on the deployed web app.
- [ ] `web/app/join/[roomId]/page.tsx` exports `metadata` (or equivalent) populating OG + Twitter meta tags pointing at `/og/invite.png`.
- [ ] Pasting `/join/<roomId>` into iMessage on a real device shows a card (any card), not plain blue text.
- [ ] OG meta-tag presence verifiable via `curl -s` of the deployed page and grep for `og:image`.

## Blocked by

None — can start immediately. Investigate alongside [[bug-01-invite-link-404|bug-01]] for shared AASA / universal-link root-cause overlap.

## Adjacencies

- **#2b (branded / dynamic per-invite card)** lives in the pre-public-launch milestone, not v1.1. Static branded card is the next step there; dynamic per-invite is blocked on resolving initiator display-name source (intersects [[../_index#9]] questions split).
- **Placeholder choice signals "deferred branding".** If the placeholder looks too polished, future design call gets anchored on it. Keep the placeholder visually generic (flat color or simple gradient) on purpose.
