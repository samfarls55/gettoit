---
issue: sg-01
title: On-gradient subheader contrast â€” token-level fix for white subheader on yellow gradient
github_issue: 45
status: done
type: AFK
created: 2026-05-14
prd: 0.1.0-prd
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# sg-01 â€” On-gradient subheader contrast

## Parent

[[../_index|0.1.0 backlog]] candidate #5.

## Why

White subheader text on the brightest band (first, yellow-heavy stop) of the initiator / home gradient fails WCAG AA contrast. Confirmed on real device 2026-05-14. The failure is at the token role level â€” the on-gradient subheader text color does not survive the brightest gradient stop in the Sunset Pop palette.

## Scope


- If the role itself is correctly named but the value is wrong, just change the value. If the role does not exist at the right specificity, introduce a new on-gradient text role and migrate consumers.
- Re-spot-check every surface that consumes the modified role for regressions (look for visual hits where a darker subheader now competes with foreground content).

## Acceptance criteria

- [x] On the home / initiator surface, white-equivalent subheader text on the brightest gradient stop measures â‰¥ 4.5:1 contrast (WCAG AA body text). â€” new role `color.text.on-bright-gradient.secondary` = `rgba(14,16,17,0.78)` measures **7.74:1** against `#FFD23F` (initiator g4) and **5.62:1** worst-case against the coral top `#FF8868`.
- [x] `tokens.json` updated; generated `code/tokens.css` regenerated; consumers updated. â€” `gen-css.mjs` + `gen-swift.mjs` both regenerated; iOS consumers on `InitiatorScreen.swift` migrated (eyebrow, subhead, radius value, vertical-row meta). Shared `QuizQuestionHeader` intentionally NOT migrated â€” see CHANGELOG.
- [ ] Spot-check screenshot review across every surface that uses the modified role â€” no regressions surfaced. â€” manual founder action; the role is **new** (not a cascade), so the only surface affected is the initiator. Q1â€“Q5 quiz subheaders still on the white-tinted role pending a follow-up issue.

## Open questions

- ~~Whether the right answer is to tune the existing on-gradient secondary token, or to introduce a new on-bright-gradient role specifically.~~ **Resolved during sg-01:** introduced a new role. Tuning the existing role would have regressed Q3/Q4/Q5/waiting/midnight (white-tinted secondary reads fine on indigo/midnight; tinted-ink would tank). The Swift generator's `Color.white.opacity(...)` template is architecturally aligned with white-tinted alpha â€” cascading via the existing role would have forced generator changes anyway. New role is the cleaner separation.

## Blocked by

None â€” can start immediately.
