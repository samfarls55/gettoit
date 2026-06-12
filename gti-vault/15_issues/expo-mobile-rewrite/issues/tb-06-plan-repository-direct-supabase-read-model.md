---
status: done
type: AFK
github_issue: 331
---

# TB-06: Plan repository direct Supabase read model

## Parent

- [[../PRD|Expo Mobile Rewrite PRD]] - GH [#325](https://github.com/samfarls55/gettoit/issues/325)

## What to build

Replace the fake Plan list data path with a typed Supabase-backed Plan repository. The repository should own direct reads for Plan list buckets and keep UI independent from table/RPC details. Supabase contract cleanup is allowed if it simplifies this migrated flow and the web fallback is updated when shared contracts change.

## Acceptance criteria

- [ ] Plan repository exposes a typed read model for Created, Joined, Decided, and History Plan list buckets.
- [ ] Plan list UI consumes only the repository interface, not direct Supabase table/RPC calls.
- [ ] Repository tests cover successful mapping, empty results, and representative error behavior.
- [ ] Any Supabase contract cleanup is migration-backed and documented in the issue/PR notes.
- [ ] The Plan list still supports fake repository data for local UI tests.
- [ ] Typecheck and mobile tests pass.

## Blocked by

- TB-05: Plan list landing with fake repository.

## Implementation notes

- 2026-06-04: Expo Plan list repository now has an async Supabase-backed read model that reads `members`, `rooms`, and `plans` directly, then buckets Created, Joined, Decided, and History behind the `PlanRepository` interface. The local fake repository remains for UI tests and Expo web preview. No Supabase contract cleanup or migration was needed for this slice.

