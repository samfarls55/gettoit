---
note: verdict-pipeline-pool-manager-unwired
status: resolved
created: 2026-05-16
resolved: 2026-05-18
resolved_into: bug-08
---

# Adjacency — verdict pipeline pool manager may be unwired

Surfaced 2026-05-16 during the Q5 diagnosis that produced [[issues/tb-14-restore-placesproxy-foursquare-path|tb-14]]–[[issues/tb-17-edge-function-cuisine-tag|tb-17]]. Flagged, not yet confirmed — needs a diagnosis pass before it becomes an issue.

## The smell

- `RunningUnionPoolManager` (shipped by [[issues/tb-10-running-union-pool-manager|tb-10]]) has the same not-wired-in pattern the Q5 components had: built, unit-tested, **zero live references** in the iOS sources.
- tb-10's own closing comment punted the wiring forward: *"the pool manager is built and tested but not yet wired into a live session ... That wiring is tb-11 and tb-13."* Both tb-11 and tb-13 closed without doing it.

## Open question

If `RunningUnionPoolManager` is never constructed per session and its `scores(for:)` cache never reaches the verdict engine, the verdict may be running on un-pooled / un-scored data — the same build-but-don't-integrate gap as the Q5 side, on the verdict side instead.

**Not confirmed.** The verdict path was not deep-traced during the Q5 diagnosis. This needs its own diagnosis before an issue is filed.

## Next step

Triage: run a diagnosis on the verdict pipeline — does anything wire `RunningUnionPoolManager` into a live session, and does the verdict engine read real per-member scores? If a fault is confirmed, file a tracer-bullet to wire it, analogous to [[issues/tb-15-wire-answer-tailored-fetch|tb-15]] / [[issues/tb-16-q5-factorial-card-selection|tb-16]].

## Resolution — 2026-05-18

**Smell confirmed.** The 2026-05-18 verdict diagnosis ([[../../60_engineering/verdict-path-options-table-never-populated|verdict-path-options-table-never-populated]]) deep-traced the verdict pipeline against the live DB: `RunningUnionPoolManager` and `PreferenceFunction` have zero live callers, the `options` table is empty across all 2587 rooms, and `verdicts` has never had a row. The fault is exactly the build-but-don't-integrate gap this note predicted.

Filed as [[issues/bug-08-verdict-pipeline-integration-unwired|bug-08]] (GitHub #116, `ready-for-human`). This note is closed — bug-08 is the tracking record. Two adjacent verdict-path defects found in the same diagnosis are [[issues/bug-09-verdict-fire-dispatch-guc-noop|bug-09]] and [[issues/bug-10-verdict-poll-no-timeout|bug-10]].
