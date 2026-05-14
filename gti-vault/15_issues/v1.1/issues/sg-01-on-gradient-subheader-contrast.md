---
issue: sg-01
title: On-gradient subheader contrast — token-level fix for white subheader on yellow gradient
github_issue: 45
status: ready-for-agent
type: AFK
created: 2026-05-14
prd: v1-prd
---

# sg-01 — On-gradient subheader contrast

## Parent

[[../_index|v1.1 backlog]] candidate #5.

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

- [ ] On the home / initiator surface, white-equivalent subheader text on the brightest gradient stop measures ≥ 4.5:1 contrast (WCAG AA body text).
- [ ] `tokens.json` updated; generated `code/tokens.css` regenerated; consumers updated.
- [ ] `design-system/accessibility.md` contrast table reflects the new measured ratio.
- [ ] `node design-system/scripts/verify.mjs` green — no inline hex, no orphan tokens.
- [ ] `design-system/CHANGELOG.md` entry referencing this issue.
- [ ] Spot-check screenshot review across every surface that uses the modified role — no regressions surfaced.

## Open questions

- Whether the right answer is to tune the existing on-gradient secondary token, or to introduce a new on-bright-gradient role specifically. Tuning the existing role cascades the change to anywhere "on a gradient" lives; introducing a new role keeps the existing role intact for less-bright gradients. Recommend tuning the existing role unless the cascade regresses a different surface — flag for review at fix time.

## Blocked by

None — can start immediately.
