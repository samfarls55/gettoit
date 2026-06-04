---
status: ready-for-agent
type: HITL
github_issue: 343
---

# TB-17: Native runtime parity checklist

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Prepare and run the native iOS runtime parity gate for the Expo app. This slice verifies the things Windows-local tests cannot prove: Apple auth, Universal Links, iOS location prompts and map feel, share sheet, push/APNs, app lifecycle, and EAS/dev-build/TestFlight installation.

## Acceptance criteria

- [ ] A native runtime parity checklist exists and covers Apple auth, Account claim, Universal Links, location/Search area, share sheet, push, lifecycle, and install/update flows.
- [ ] EAS/dev build or TestFlight path can produce an installable iOS build.
- [ ] Human/device validation results are recorded in the issue or linked vault notes.
- [ ] Any native-only defects discovered are filed as follow-up issues or fixed within this slice if small.
- [ ] The mobile local test suite still passes after native validation changes.
- [ ] The slice clearly marks which runtime checks remain unresolved, if any.

## Blocked by

- TB-04: Wire Supabase auth repository.
- TB-09: Group invite and Universal Link resolver.
- TB-16: Plan delete, leave, and Settings.

