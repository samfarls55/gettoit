# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the label strings used in this repo — both in the vault (`status:` frontmatter) and on GitHub Issues (label).

## Triage status

| Label in mattpocock/skills | Label in this repo | Meaning                                  |
| -------------------------- | ------------------ | ---------------------------------------- |
| `needs-triage`             | `needs-triage`     | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`       | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`  | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`  | Requires human implementation            |
| `wontfix`                  | `wontfix`          | Will not be actioned                     |
| —                          | `deferred`         | Planned but timing deferred — not actively worked, awaiting external gate |

## Additional labels in use on this repo

| Label             | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `AFK`             | Tracer-bullet build slice that can run without human interaction |
| `HITL`            | Tracer-bullet build slice that requires a human in the loop       |
| `v1`              | Scoped to the v1 PRD                                              |
| `tracer-bullet`   | A vertical-slice build issue (`tb-NN-*` in the vault)            |
| `spec-gap`        | A design-system spec change required by the PRD                  |

## Storage mechanism

### Vault

Status is stored in YAML frontmatter at the top of each issue note:

```yaml
---
status: needs-triage
type: AFK
github_issue: 1
---
```

`status:` is the canonical triage role. `type:` is the AFK/HITL designation (tracer bullets only). `github_issue:` is the back-reference to the GitHub Issues mirror.

When transitioning state, update the `status:` field in place and re-label the GitHub issue to match (`gh issue edit <number> --add-label <new> --remove-label <old>`).

### GitHub

Each issue carries labels matching its vault frontmatter:
- One triage label (one of the 5 canonical roles)
- One type label (`AFK` or `HITL`) for tracer bullets
- One feature label (`v1` for now)
- One artifact label (`tracer-bullet` or `spec-gap`)

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), set `status: ready-for-agent` in the vault frontmatter AND add the `ready-for-agent` label on the GitHub issue. The two must stay in sync.
