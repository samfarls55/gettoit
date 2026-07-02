---
status: ready-for-agent
type: AFK
github_issue: 377
---

# TB-37: Dashboard user-action language

## What to build

Rewrite the dashboard's Plan status and section language so it describes what the member can do, not how the backend stores the Plan. Replace internal-sounding bucket labels with user-facing action states while preserving the underlying Plan behavior.

Required design skill: invoke `$impeccable clarify app dashboard page` before implementing. Keep the language specific to Plans, Rooms, quiz participation, and verdict readiness; avoid generic productivity-dashboard wording.

## Acceptance criteria

- [ ] Dashboard copy no longer relies on "Created," "Joined," "Decided," or "History" as the primary user-facing mental model.
- [ ] Each Plan state has a short label or heading that makes the next action clear.
- [ ] The main section heading communicates urgency or current activity, not just storage category.
- [ ] Accessibility labels are updated to match the new visible language.
- [ ] Tests are updated for the new labels and still verify the correct Plan opens.
- [ ] The AFK handoff or PR notes name the `$impeccable clarify app dashboard page` invocation and its main finding.

## Blocked by

- [#374](https://github.com/samfarls55/gettoit/issues/374) - TB-34: Dashboard Next Up primary path.
