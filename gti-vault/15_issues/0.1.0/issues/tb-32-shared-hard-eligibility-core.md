---
status: ready-for-agent
type: AFK
github_issue: 372
---

# TB-32: Share Hard Eligibility Between Vibe Fit And Verdict

## What to build

Build one hard-eligibility core for candidate cuts that must happen consistently before transient Vibe fit scoring and before final Verdict winner selection. A candidate rejected for price, open-at time, service mode, dietary constraints, cuisine vetoes, provider metadata, Search area, or crowd floor should be rejected for the same app-owned reason wherever hard eligibility is applied.

Keep the Verdict engine's winner-selection depth intact. This slice only centralizes hard cuts that currently risk drifting between the Vibe prefilter and Verdict eligibility path.

## Acceptance criteria

- [ ] Vibe fit prefilter and final Verdict eligibility use the same hard-eligibility decision path for shared hard constraints.
- [ ] Hard cut reasons are app-owned, stable, and suitable for Verdict cut receipts where the current product exposes them.
- [ ] Eligibility decisions cover price, current/open-at hours, service mode, dietary constraints, cuisine vetoes, provider metadata requirements, Search area, and crowd floor where those rules exist today.
- [ ] Vibe fit does not embed candidates that shared hard eligibility already rejects.
- [ ] Verdict winner selection remains responsible for scoring, maximin/satisficing behavior, and tie-breaks after hard eligibility.
- [ ] Tests cover matching Vibe and Verdict hard-eligibility decisions across representative candidate/member/Room contexts.
- [ ] Tests cover at least one rejected candidate per major hard-cut category and verify the exposed cut reason remains stable.

## Blocked by

None - can start immediately.
