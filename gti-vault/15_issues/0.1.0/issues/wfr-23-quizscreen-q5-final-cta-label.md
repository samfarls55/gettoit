---
issue: wfr-23
title: Label Q5 final CTA as Get Verdict / Submit
status: ready-for-agent
type: AFK
surfaced_by: workflow-review 2026-05-26
created: 2026-05-26
github_issue: 264
---

# wfr-23 — QuizScreen Q5 final CTA label is the generic "Next"

## What to build

On Q5 the primary CTA renders the same Next button as Q1..Q4. Switch to a finish-shaped label ("Get Verdict" or copy from `gti-vault/40_marketing_branding/`) so the final step reads as terminal.

Full autonomy on choice of copy — pick the line that best matches marketing voice. AFK agent should consult `40_marketing_branding/` before settling.

## Acceptance criteria

- [ ] Q5 primary CTA copy differs from Q1..Q4.
- [ ] Copy aligns with marketing voice doc.
- [ ] Snapshot test covers Q5 CTA render.

## Blocked by

None — can start immediately.

## Hub anchors

- [[../../30_design/interaction-patterns/patterns#Prominent "Done" Button or Assumed Next Step]]

## Surfaced by

`/workflow-review` whole-app audit, 2026-05-26. See run report at [[../_runs/2026-05-26-0958-workflow-review|2026-05-26-0958-workflow-review]] finding #23.
