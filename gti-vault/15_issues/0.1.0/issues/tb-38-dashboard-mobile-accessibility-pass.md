---
status: ready-for-agent
type: AFK
github_issue: 378
---

# TB-38: Dashboard mobile accessibility pass

## What to build

Run a focused dashboard accessibility pass after the primary-action and nav shape are settled. The goal is to make the Plan dashboard reliable for touch, keyboard/web, and assistive technology without broad visual redesign.

Required design skill: invoke `$impeccable audit app dashboard page` before implementing. Use the audit to check target sizes, selected state, focus behavior, horizontal scrolling affordances, and ambiguous image/button semantics.

## Acceptance criteria

- [ ] Top dashboard controls meet the 44pt target-size baseline or have an equivalent hit target.
- [ ] The active dashboard navigation/control exposes selected/current state where applicable.
- [ ] The account/avatar visual is either a real accessible action or a non-interactive image with appropriate semantics.
- [ ] Horizontal Plan browsing remains usable with keyboard/web and assistive technology, or the dashboard no longer depends on horizontal browsing for primary action.
- [ ] Focus and accessibility assertions are covered by the smallest relevant mobile/web tests.
- [ ] The AFK handoff or PR notes name the `$impeccable audit app dashboard page` invocation and its main finding.

## Blocked by

- [#374](https://github.com/samfarls55/gettoit/issues/374) - TB-34: Dashboard Next Up primary path.
- [#375](https://github.com/samfarls55/gettoit/issues/375) - TB-36: Dashboard real bottom actions.
