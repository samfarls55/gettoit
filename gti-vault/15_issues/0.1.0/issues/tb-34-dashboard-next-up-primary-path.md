---
status: ready-for-agent
type: AFK
github_issue: 374
---

# TB-34: Dashboard Next Up primary path

## What to build

Add one obvious "Next up" path to the Plan dashboard so a returning member can resume the Plan that needs action without scanning every bucket. Use the existing Plan states to choose one primary Plan in urgency order: pending setup first, quiz/open participation second, ready/decided Plan third. The existing rail can remain as secondary browsing.

Required design skill: invoke `$impeccable polish app dashboard page` before implementing, using the latest critique snapshot as the backlog. Keep the pass scoped to the dashboard and choose the smallest UI change that makes the primary action unmistakable.

## Acceptance criteria

- [ ] A dashboard with at least one actionable Plan shows a single primary "Next up" treatment before secondary browsing.
- [ ] The chosen Plan follows the agreed urgency order and uses the existing open/resume behavior for that Plan.
- [ ] Empty and history-only states still offer a clear way to start a new Plan.
- [ ] Existing Plan dashboard tests are updated or extended to cover the selected primary Plan behavior.
- [ ] The AFK handoff or PR notes name the `$impeccable polish app dashboard page` invocation and its main finding.

## Blocked by

None - can start immediately.
