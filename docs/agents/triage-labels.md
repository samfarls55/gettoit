# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo, and where they are stored.

## Mapping

| Label in mattpocock/skills | Label in this repo | Meaning                                  |
| -------------------------- | ------------------ | ---------------------------------------- |
| `needs-triage`             | `needs-triage`     | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`       | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`  | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`  | Requires human implementation            |
| `wontfix`                  | `wontfix`          | Will not be actioned                     |

## Storage mechanism

Status is stored in YAML frontmatter at the top of each issue note:

```yaml
---
status: needs-triage
---
```

One value per issue. When transitioning state, update the `status:` field in place.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), set `status: ready-for-agent` in the issue's frontmatter.
