---
issue: sg-01
title: On-gradient subheader contrast — token-level fix for white subheader on yellow gradient
github_issue: 45
status: done
type: AFK
created: 2026-05-14
prd: 0.1.0-prd
---

# sg-01 — On-gradient subheader contrast

## Parent

[[../_index|0.1.0 backlog]] candidate #5.

## Why

White subheader text on the brightest band (first, yellow-heavy stop) of the initiator / home gradient fails WCAG AA contrast. Confirmed on real device 2026-05-14. The failure is at the token role level — the on-gradient subheader text color does not survive the brightest gradient stop in the Sunset Pop palette.

## Scope

**Token-level fix, WCAG AA target (4.5:1 body text, 3:1 large text).** Surface-level override would weaken the token system and conflict with the locked visual system in [[../../../../design-system/tokens|tokens.md §1.2]].

- Edit the on-gradient subheader color role in `design-system/tokens.json`. Likely path: `color.text.on-gradient.secondary` (or whichever role the subheader currently consumes). Shift from pure white toward a tinted dark color that clears 4.5:1 against the brightest gradient stop.
- If the role itself is correctly named but the value is wrong, just change the value. If the role does not exist at the right specificity, introduce a new on-gradient text role and migrate consumers.
- Re-spot-check every surface that consumes the modified role for regressions (look for visual hits where a darker subheader now competes with foreground content).
- Update `design-system/accessibility.md` contrast table with the new measured ratio against the brightest gradient stop.
- Run `node design-system/scripts/verify.mjs` to confirm no inline-hex drift or orphan token.

## Acceptance criteria

- [x] On the home / initiator surface, white-equivalent subheader text on the brightest gradient stop measures ≥ 4.5:1 contrast (WCAG AA body text). — new role `color.text.on-bright-gradient.secondary` = `rgba(14,16,17,0.78)` measures **7.74:1** against `#FFD23F` (initiator g4) and **5.62:1** worst-case against the coral top `#FF8868`.
- [x] `tokens.json` updated; generated `code/tokens.css` regenerated; consumers updated. — `gen-css.mjs` + `gen-swift.mjs` both regenerated; iOS consumers on `InitiatorScreen.swift` migrated (eyebrow, subhead, radius value, vertical-row meta). Shared `QuizQuestionHeader` intentionally NOT migrated — see CHANGELOG.
- [x] `design-system/accessibility.md` contrast table reflects the new measured ratio. — §1.1 updated, new §1.1.1 added with full alpha-composited measurements per stop.
- [x] `node design-system/scripts/verify.mjs` green — no inline hex, no orphan tokens. — confirmed locally before PR.
- [x] `design-system/CHANGELOG.md` entry referencing this issue. — entry added, references issue #45.
- [ ] Spot-check screenshot review across every surface that uses the modified role — no regressions surfaced. — manual founder action; the role is **new** (not a cascade), so the only surface affected is the initiator. Q1–Q5 quiz subheaders still on the white-tinted role pending a follow-up issue.

## Open questions

- ~~Whether the right answer is to tune the existing on-gradient secondary token, or to introduce a new on-bright-gradient role specifically.~~ **Resolved during sg-01:** introduced a new role. Tuning the existing role would have regressed Q3/Q4/Q5/waiting/midnight (white-tinted secondary reads fine on indigo/midnight; tinted-ink would tank). The Swift generator's `Color.white.opacity(...)` template is architecturally aligned with white-tinted alpha — cascading via the existing role would have forced generator changes anyway. New role is the cleaner separation.

## Blocked by

None — can start immediately.
