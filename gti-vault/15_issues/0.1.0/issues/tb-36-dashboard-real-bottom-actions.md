---
status: ready-for-agent
type: AFK
github_issue: 375
---

# TB-36: Dashboard real bottom actions

## What to build

Distill the dashboard bottom area so it contains only destinations or actions that work now. Unavailable Groups, Activity, and Profile affordances should not consume the primary mobile thumb zone. Replace or hide placeholder nav with real dashboard actions such as Plans, Start Plan, or the current primary Plan action.

Required design skill: invoke `$impeccable distill app dashboard page` before implementing. Prefer deletion over placeholder states; only keep an unavailable control if it is genuinely necessary and clearly secondary.

## Acceptance criteria

- [ ] The dashboard no longer presents unavailable Groups, Activity, or Profile as primary bottom-nav destinations.
- [ ] The bottom area contains only working navigation/actions, or is removed if the screen is clearer without it.
- [ ] A distracted mobile user can reach Start Plan or the primary Plan action without horizontal scrolling.
- [ ] Accessibility labels and disabled states match the final visible controls.
- [ ] Dashboard tests are updated to assert that unavailable primary nav items are absent or no longer primary.
- [ ] The AFK handoff or PR notes name the `$impeccable distill app dashboard page` invocation and its main finding.

## Blocked by

None - can start immediately.
