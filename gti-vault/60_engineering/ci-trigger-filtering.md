---
title: CI trigger filtering — skip docs-only changes
created: 2026-05-19
tags: [engineering, ci]
---

# CI trigger filtering — skip docs-only changes

2026-05-19. `.github/workflows/ci.yml` `push` and `pull_request` triggers
carry a `paths-ignore` list so docs-only changes never spin up the CI
matrix (the iOS lane alone is ~10 min).

## What is ignored

```yaml
paths-ignore:
  - 'gti-vault/**'   # Obsidian vault — issue files, AFK run logs, _index churn
  - 'docs/**'        # agent / runbook docs
  - '*.md'           # root-only: AGENTS.md, CLAUDE.md shim, CONTEXT.md, README
```

## Why these three and not a blanket `**/*.md`

- `gti-vault/**` is the single biggest source of docs-only churn — every
  `/execute-issues` run writes issue files, run logs, and `_index.md`
  updates. None of it is source.
- The ignore list is **deliberately conservative**. `**/*.md` would also
  swallow `design-system/surfaces/*.md`, and those `.md` files feed
  `verify.mjs` (surface↔jsx pairing gate). A new surface doc must still
  trip the `design-system` lane. So `.md` is matched at repo root only.

## Why it matters beyond saving runners

The `concurrency` group (`ci-${{ github.ref }}`, `cancel-in-progress:
true`) means a new push cancels an in-flight build on the same ref. Before
this filter, a docs-only commit pushed mid-build would cancel a real code
build and force it to restart later. With the filter, docs commits don't
trigger CI at all, so they can't interrupt a code build.

## Not done (deferred)

Per-lane path filtering — e.g. a `web/`-only PR skipping the `ios` lane —
needs a `changes` job (`dorny/paths-filter`) emitting per-lane booleans
plus `if:` guards on each lane. More involved because of the `needs:`
chain (a skipped dependency skips its dependents unless guarded with
`if: ${{ !cancelled() && ... }}`). Worth its own PR if build minutes stay
a problem. See [[ios-ci-setup]] for the lane structure, [[stack-patterns]]
for the single-`ci.yml` convention.
