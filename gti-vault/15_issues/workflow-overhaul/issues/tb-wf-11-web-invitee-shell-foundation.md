---
issue: tb-WF-11
title: Web invitee shell foundation — landing, name entry, members.display_name
status: done
type: AFK
feature: workflow-overhaul
github_issue: 192
created: 2026-05-21
---

# tb-WF-11 — Web invitee shell foundation

## Parent

[[sg-wf-5-web-invitee-flow|sg-WF-5]] — the web invitee shell design-system surface doc. Behavior locked in [[../../../50_product/workflow-overhaul-web-invitee-flow|workflow-overhaul-web-invitee-flow]] §Q3 (identity) and §Q4 (name entry).

First of the two shell-wiring tracer-bullets; [[tb-wf-12-web-invitee-shell-reclick|tb-WF-12]] builds the re-click behaviors on top of this foundation. Delivery pair with [[tb-wf-10-web-quiz-v11-port|tb-WF-10]] (the v1.1 web quiz the shell hands off to).

## What to build

The web invitee shell scaffold and the first-landing name entry, end-to-end: a cold invitee clicks the shared `/join/<roomId>` link, gets an anonymous Supabase session (status quo), enters a name on a name-entry-alone surface, becomes a `members` row carrying that name, and is handed into the quiz. The name then renders wherever the system shows members, instead of the `m<uuid>` placeholder.

**Journey demoed:** a brand-new invitee opens the SMS link in a browser → name-entry surface → types a name → taps the CTA → `members` row created with `display_name` set → quiz begins. After a verdict, the member's chosen name (not `m<uuid>`) appears in `compute-verdict`'s output.

### Schema

- Add a **nullable** `members.display_name` column — additive migration. This is the system's first real display-name source (no such column exists across the 26 prior migrations).

### Server

- `compute-verdict`'s `fetchVotes` joins `members.display_name` and uses it for the member name, keeping the existing `"m" + userId.slice(0,4)` placeholder as the fallback when the column is null (iOS members, which have no name-entry surface, keep the placeholder).

### Web

- The `/join/[roomId]` route + the shell scaffold — the state machine that will (in tb-WF-12) dispatch a re-click to the right surface. This slice lands the scaffold and the first-landing path through it.
- The name-entry surface per the sg-WF-5 surface doc: single text input, one CTA, 30-char cap, placeholder `Your name`, CTA disabled until trimmed-non-empty, duplicate names allowed, not editable after entry.
- Identity is the anonymous Supabase session in `localStorage` (decision doc §Q3) — no URL token, no separate cookie.
- On CTA: create the `members` row with `display_name`, then hand into the quiz.

### Out of scope

- Re-click resume / read-only verdict card / "plan closed" terminal / Leave — all [[tb-wf-12-web-invitee-shell-reclick|tb-WF-12]].
- The v1.1 quiz screens themselves — [[tb-wf-10-web-quiz-v11-port|tb-WF-10]]. The scaffold hands off to whatever quiz currently renders; tb-WF-10 swaps it to the v1.1 quiz.

## Acceptance criteria

- [ ] `members.display_name` nullable column added via additive migration.
- [ ] `compute-verdict.fetchVotes` joins `display_name`; the `m<uuid>` fallback is preserved for null rows (iOS members unaffected).
- [ ] A cold link click renders the name-entry surface; submitting a non-empty name creates a `members` row with `display_name` set and proceeds into the quiz.
- [ ] Identity uses the anonymous Supabase session; no URL token or extra cookie is introduced.
- [ ] Web CI lane (`npm test`, `npm run build`, `npm run lint`) and the edge-function `deno test` lane are green.

## Blocked by

- [[sg-wf-5-web-invitee-flow|sg-WF-5]] — the design-system surface doc this slice implements.

## Comments

**Done 2026-05-21** (AFK, branch `afk/tb-WF-11`). Landed the three pieces:

- **Migration** `20260524000000000_members_display_name.sql` — additive nullable `members.display_name text` column, no default. NULL is the explicit "no name entered" signal the verdict fallback keys on (iOS members keep it).
- **Server** — `compute-verdict.fetchVotes` now reads `members.display_name` for the room and resolves each member's name through the new pure `compute-verdict/member-display-name.ts` helper: joined name when set, the legacy `m<uuid>` placeholder when NULL. `votes`/`members` carry no FK, so the join is a separate read folded into a map rather than a PostgREST embed; a failed members read degrades to "all placeholders" (pre-column behavior).
- **Web** — `/join/[roomId]` now renders the new `InviteShell` state machine (`components/InviteShell.tsx`): ensures the anon Supabase session, looks up the `members` row, and on a first landing shows the name-entry surface (`components/NameEntry.tsx`, web-01 §A) before handing into the quiz. Surface A built per the sg-WF-5 surface doc — single text input, 30-char `maxLength` cap, CTA disabled until trimmed-non-empty, `Your name` placeholder. Data layer in `lib/invitee-shell.ts`.

All five acceptance criteria met; web suite (69 tests) + edge-function suite (394 tests) + `design-system/scripts/verify.mjs` all green. Adjacency flagged: `InviteWebCard` + the `/s/[roomId]` route are now unreferenced (the old invite-card flow) — left in place, candidate cleanup for tb-WF-12.
