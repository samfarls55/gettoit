---
status: ready-for-agent
type: AFK
github_issue: 376
---

# TB-35: Dashboard honest social state

## What to build

Remove fake participant/social state from Plan cards. The current dashboard implies real group presence with hardcoded initials and a count; until real participant data is available on the Plan list, cards should use honest state copy tied to the Plan's current action.

Required design skill: invoke `$impeccable clarify app dashboard page` before implementing. Keep the copy grounded in GetToIt's Plan language and avoid introducing new social metrics that are not backed by data.

## Acceptance criteria

- [ ] Plan cards no longer show hardcoded participant initials or hardcoded member counts.
- [ ] Created/pending Plans use honest state copy that explains what happens next.
- [ ] Joined/open quiz Plans use honest state copy that points to answering or waiting, based only on data already available to the dashboard.
- [ ] Decided Plans avoid generic/static meal filler unless the real verdict or Plan data supports it.
- [ ] Dashboard tests assert that fake initials/counts are absent and the replacement copy is present.
- [ ] The AFK handoff or PR notes name the `$impeccable clarify app dashboard page` invocation and its main finding.

## Blocked by

- [#374](https://github.com/samfarls55/gettoit/issues/374) - TB-34: Dashboard Next Up primary path.
