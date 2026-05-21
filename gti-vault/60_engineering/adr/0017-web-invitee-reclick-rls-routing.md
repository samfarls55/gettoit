---
adr: 0017
title: Web invitee re-click routing under membership-gated RLS
status: accepted
date: 2026-05-21
supersedes: null
superseded_by: null
---

# 0017 — Web invitee re-click routing under membership-gated RLS

## Status

Accepted — 2026-05-21. Outcome of building tb-WF-12 (the web invitee shell re-click behaviors). Records a routing decision forced by an existing RLS constraint, not a fresh design choice.

## Context

The web invitee shell (`design-system/surfaces/web-01-invitee-shell.md`) specs four re-click surfaces: §B resume, §C read-only verdict card, §D "this plan is closed" terminal, and §E leave. tb-WF-12 wires them on the tb-WF-11 foundation, under a hard constraint: **no new schema, no new server code** — every server piece already exists.

On a re-click the shell must route the invitee to the right surface. Two of those surfaces — §A first-landing name entry and §D the closed terminal — both correspond to "this anon user has no `members` row for the room":

- A genuine first-timer (or a storage-cleared returner — surface doc §B explicitly treats these as the same) → §A name entry.
- A member whose row was purged by the 30-day anonymous-user TTL (ADR 0006), or a stranger opening a forwarded link → §D closed terminal.

To tell §A from §D the shell would need to read the room/Plan status for an invitee who has *no* `members` row. It cannot:

- `rooms` carries `rooms_select_members` — a SELECT policy that admits a row **only to a current member** of that room (migration `20260513210000000_rooms_and_members`). A non-member's `rooms` read returns zero rows.
- `plans_decided_for_user` / `plans_history_for_user` both join `members` and are themselves membership-gated — a non-member gets an empty result.

So with the existing server surface there is **no RLS-permitted way** for the shell to distinguish a first-timer from a TTL-purged member or a stranger on a *decided* Plan. The pre-existing `join_room_smart` RPC (TB-11) does resolve room status server-side for a late-joiner, but the tb-WF-12 issue deliberately enumerates the server pieces it reuses and `join_room_smart` is not among them; pulling it in would widen the slice past its locked behavior.

## Decision

The shell uses the presence of a `members` row as the primary routing signal, and accepts that §A and §D cannot always be told apart:

1. **No `members` row → §A name entry.** Always. This is explicitly blessed by surface doc §B: "treating the returning-with-cleared-storage invitee as a fresh first-landing keeps the routing logic single-path." The §A copy ("What should we call you?") reads correctly for a true first-timer, a storage-cleared returner, **and** a TTL-purged member alike. A stranger on a forwarded *open* Plan correctly lands on §A too. The only mis-route is a stranger on a *decided* Plan seeing §A instead of §D — they would type a name, get a `members` row, and be handed into a decided room as a late-joiner (routed to Waiting by `SessionRoom.boot`), not into a broken quiz. Acceptable, and self-correcting.

2. **`members` row present → resolve Plan state via `readRoomPlanState`.** This reads `rooms` (membership-gated) for `plan_id`, then probes the decided/history RPCs:
   - `rooms` read returns empty / errors → `unresolved` → **§D closed terminal**. Because the read is membership-gated, an empty result *is* "membership no longer resolves" — exactly the §D trigger. This fires when a member row resolved at `findMembership` time but the room read came back empty: a membership that aged out mid-session (the realistic anon-TTL race).
   - `rooms` resolves + the Plan is in `plans_decided_for_user` or `plans_history_for_user` → `decided` → **§C verdict card**.
   - `rooms` resolves + the Plan is not decided → `open` → hand into `SessionRoom` for **§B resume** (mid-quiz / Waiting / Verdict).

§D is therefore reachable, deterministic, and testable — it is the membership-purge race, which is the honest reading of "membership does not resolve." It is *not* reachable for a stranger with no row, because RLS makes that case indistinguishable from a first-timer.

## Consequences

- **The routing stays single-path and needs no new server code.** No `join_room_smart` dependency, no new RPC, no new RLS policy — the slice holds to its "no new server code" constraint.
- **A stranger forwarding a link to a *decided* Plan sees §A, not §D.** They become a no-op late-joiner rather than hitting the closed terminal. This is a cosmetic mis-route, not a data or identity leak — the capability-URL defenses (surface doc §"What this surface tree defends against") still hold: the stranger lands in their own fresh anon identity, never inside someone else's.
- **Closing the §A-vs-§D gap properly requires server help.** A future slice that wants a stranger-on-decided-Plan to land on §D would add a membership-free room-status read (a `SECURITY DEFINER` RPC, like `join_room_smart` already is). That is a deliberate server-surface decision, out of tb-WF-12's "no new server code" scope — flagged here so the trade-off is visible if it ever matters.

## References

- `design-system/surfaces/web-01-invitee-shell.md` §A / §B / §C / §D — the surface contract.
- [[../../50_product/workflow-overhaul-web-invitee-flow|workflow-overhaul-web-invitee-flow]] §Q5 / §Q6 — the locked re-click behavior.
- [[0006-privacy-posture-v1|ADR 0006]] — the 30-day anonymous-user TTL whose sweep purges the `members` row.
- `supabase/migrations/20260513210000000_rooms_and_members.sql` — the `rooms_select_members` membership-gated SELECT policy.
- [[../../15_issues/workflow-overhaul/issues/tb-wf-12-web-invitee-shell-reclick|tb-WF-12]] — the issue this ADR was written for.
