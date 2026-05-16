---
note: verdict-pipeline-pool-manager-unwired
status: needs-triage
created: 2026-05-16
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
