---
issue: bug-27
title: Reroll is broken end-to-end — not just a UI bug
status: needs-info
type: AFK
github_issue: 227
created: 2026-05-24
grilled: 2026-05-24
---

# bug-27 — Reroll broken end-to-end

## Symptom

On the verdict screen (S05), invoking the reroll path does not work. The user explicitly flags this as **not just a UI bug** — the reroll affordance fails at runtime to produce a new verdict.

User report: "Reroll doesn't work at all (more than just a UI bug)."

## Open questions for triage (route through /diagnose at fix time)

The single-line report doesn't pin the failure mode. /diagnose should establish:

- **What happens on tap?** Does the reroll sheet open? Does the user reach the S07 Reroll surface? Does the primary CTA fire?
- **Where does the failure manifest?** Client side (sheet doesn't open, CTA dead), RPC side (`apply_reroll` returns an error or the room status doesn't transition), engine side (`compute-verdict` runs but doesn't produce a new verdict), or render side (a new verdict is produced but the screen doesn't update — note that web's same defect is **bug-20** and is fixed; iOS may have an analog).
- **Solo vs group.** Both, or solo-only / group-only?
- **Within the reroll window vs outside?** ADR 0016 §3 introduced a server-side time-exact `apply_reroll` guard — the breakage could be window-related and look like "doesn't work".
- **TestFlight build under test.** Pin the build number so the diagnosis routes off a concrete commit.

## Surfaced by

User dogfood, 2026-05-24.

## References

- `ios/Sources/App/RerollStore.swift` — `applyReroll`, the `apply_reroll` RPC call site, error mapping.
- `ios/Sources/App/RerollScreen.swift` — S07 surface.
- `ios/Sources/App/VerdictScreen.swift` — tertiary reroll affordance on S05.
- `ios/Sources/App/RootView.swift:417` — reroll routing in `RootView`.
- `ios/Sources/App/PlansStore.swift:767` — `apply_reroll` client-side window note.
- `supabase/functions/compute-verdict/` — server-side verdict (reroll re-uses the same path).
- ADR 0016 — Plan reroll-window enforcement (deadline + `apply_reroll` server guard).
- `design-system/surfaces/05-verdict.md` + `07-reroll.md` — the surfaces.
- [[bug-20-web-verdict-live-update-unwired|bug-20]] — the web analog (done), useful as a comparison datapoint.

## Grill outcome (2026-05-24)

`/grill-with-docs` did **not** classify this issue — the single-line report does not pin a failure mode, and classification (bug vs spec-gap, AFK vs HITL) depends on whether the breakage is client-side, RPC-side, engine-side, or render-side. Status moved to `needs-info` (the "info" being a `/diagnose` session output). **Deferred to a separate session.**

### Why deferred (not grilled inline)

- The grill resolves design / scope tension. The reroll report is a runtime defect that needs telemetry, not a scope conversation.
- `/diagnose` against TestFlight needs (a) a pinned build number, (b) a rough timestamp of the failed reroll attempt, and (c) Supabase log access for `apply_reroll` + `compute-verdict`. Without those pinned, an inline diagnose would speculate from code paths — exactly what the issue body warned against.
- The other seven UI dogfood issues are now classified and ready for execution; this issue's deferral does not block them.

### Inputs required before /diagnose can start

The user owes back, in a follow-up message attached to this issue (or in a fresh `/diagnose` invocation):

1. **TestFlight build number** under test when the reroll failed (the bottom of the iOS Settings → GetToIt page, or the TestFlight app's build list).
2. **Approximate timestamp** of the failed reroll attempt (within ~10 minutes is enough for a Supabase log grep window).
3. **Solo or group session?** Both, or solo-only / group-only?
4. **Within or outside the reroll window?** ADR 0016's 23:59:59-search-area-tz deadline matters here — a "broken" report could be the server guard firing as designed if the attempt landed outside the window.
5. **What happens on tap?** Walk it from the verdict screen: does the reroll sheet open at all? Does the user reach S07 Reroll? Does the primary CTA fire? Or does the tap dead-end?

### Next session prompt

When the inputs above are available, run:

```
/diagnose bug-27 against TestFlight build <N> at <timestamp>; pull supabase logs for apply_reroll + compute-verdict in the ±10min window; map symptom to (client / RPC / engine / render) and re-enter /grill-with-docs for classification.
```

### Status

- `status: needs-info` (vault frontmatter, this file).
- GitHub: `needs-info` label applied; `needs-triage` removed.
- No AFK/HITL label until `/diagnose` lands.
