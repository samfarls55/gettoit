---
title: Workflow overhaul — Plan setup screen
status: decisions-locked
date: 2026-05-19
scope: setup-screen-only
supersedes-portions-of:
  - "[[../../design-system/surfaces/01-initiator|S01 Initiator Landing]]"
  - "[[../../design-system/surfaces/01b-parameters|S01b Pre-quiz Parameters]]"
amends:
  - "[[../../CONTEXT|CONTEXT.md]]"
  - "[[v1-design-locks|v1-design-locks]]"
followups:
  - "Sweep S00 landing — Plan list replaces it as the app entry"
  - "Retire S01 + S01b as separate surfaces (collapsed into new Setup surface)"
  - "Sweep S04 — remove timer-elapse / countdown / Auto-fires copy (v1.1 PRD already retired the mechanism)"
  - "Layer reroll-window-boundary onto S07 — window-close = end of next calendar day local TZ"
  - "Design the new Setup surface JSX + add to design-system/surfaces/"
  - "Design the new Plan list surface (app landing) JSX + add to design-system/surfaces/"
  - "Design web invitee single-link flow (name entry → quiz → waiting/verdict) as a separate web surface"
  - "Spec Plan list card visuals — Created/Joined badge, pending/decided-active/decided-expired states"
  - "Spec empty-list state + first-launch copy"
  - "Spec push notification semantics for joined Plans + reroll-window-close"
---

# Workflow overhaul — Plan setup screen

Outcome of the `/grill-with-docs` session on 2026-05-19. Scope locked to **setup screen only** by founder direction. Downstream surfaces and behaviors are flagged in `followups` for separate grilling.

## Headline framing

The current flow has no back/cancel, no persistence, and asks an awkward walking-vs-driving question. The workflow overhaul:

1. Renames "decision" to **Plan** (1 syllable, casual, scales to v2+ categories).
2. Makes Plans **persistent, named, list-backed items** in the spirit of the Reminders app.
3. Collapses today's S01 + S01b into a **single Setup screen**.
4. Replaces the walking-vs-driving binary with a **distance-only slider** (walk-vs-drive is implicit, anchored at 1.0 mi).
5. Defines three navigation verbs (`Back`, `Exit`, `Delete`) with clear scope so users are never stuck on a question.

See `[[../../CONTEXT|CONTEXT.md]] → Plan vocabulary` for the canonical terms.

## Grilled decisions (Q1–Q11)

### Q1 — Plan lifecycle model
**Locked:** stateful run with reroll, then read-only history.

A Plan is a one-shot stateful instance, not a reusable template. States: `pending → decided-active → decided-expired`. Verdict is stamped onto the Plan on fire. Reroll allowed during `decided-active` window only; after that, Plan is read-only history. Recurring use ("Thursday office lunch") creates fresh Plans each time.

**Rejected:** template model (loses verdict-as-record property), pure stateful without reroll-in-place (loses the v1 friction-controlled reroll mechanism).

### Q2 — The noun
**Locked:** "Plan."

One syllable, casual, scales to drinks/movie categories in v2+. No collision with existing engineering terms (`session`, `room`, `verdict`, `candidate`, `parameter`, `profile`).

**Considered + rejected:** Run (food-coded — "movie run" reads off), Outing (2 syllables, older register), Pick (collides with verdict semantics — the *Plan* is the question, the *verdict* is the pick).

### Q3 — Plan list location
**Locked:** new app landing.

Tap-target landing surface for every app open. First-launch shows empty state with a giant `Create your first plan` empty-state CTA. Returning users see their list with `pending` / `decided-active` / `decided-expired` Plans.

Existing S01's "Figure it out together" headline + the zero-tap path are deprecated. The Plan creation path moves to the new Setup surface; the runtime path moves to the list-tap-launches semantic.

**Rejected:** tab bar adjacent to S01 (padded for a single-purpose app), secondary surface off S01 (contradicts Reminders metaphor, awkward back-stack).

### Q4 — Create-and-start vs create-and-defer
**Locked:** both CTAs in the dock.

Setup screen exposes two parallel CTAs:

- **Primary `PillCTA` white** — `Drop the invite link` (group) / `Start the quiz` (solo). Mints Plan as `pending` *and* immediately fires the room/invite/quiz.
- **Secondary eyebrow text link below** — `SAVE FOR LATER`. Mints Plan as `pending`, returns to list, room not yet minted.

Treatment matches the existing C-22 "primary pill + tertiary dismiss" pattern. The `SAVE FOR LATER` link uses the same eyebrow token treatment as today's `SETTINGS` footer link.

**Rejected:** single `Drop the invite link` CTA (pending state becomes meaningless), single `Save plan` CTA (extra tap to fire — founder rejected).

### Q5 — Back / Exit / Delete verbs
**Locked:** three verbs, three surfaces, three scopes.

- **`Back`** — In-quiz, available Q2–Q5. Steps backward by one question with prior answer preserved and re-editable. Per-member; never affects room state.
- **`Exit`** — In-quiz chrome on all of Q1–Q5. Member-scoped: exiter's answers discarded, exiter dropped from the room, room continues for the remaining participants. Solo collapse: exit == abandon, Plan returns to `pending`. Initiator exit: room keeps running for remaining joiners; Plan stays `pending` if quorum lost, advances to `decided-active` if quorum holds and verdict fires.
- **`Delete`** — Plan list, owner-only (Plan creator). Kills the active room (if any), removes the Plan from the initiator's list entirely. Joiners get a "session ended" toast and are punted.

Q1 has no `Back` (no prior question); the Q1 chrome carries only `Exit`.

Definitions in `[[../../CONTEXT|CONTEXT.md]] → Plan exit / Plan delete / Plan back`.

### Q6 — Joiner experience (Account vs Web invitee)
**Locked:** two disjoint subtypes.

- **Account member** (Linked-Apple iOS user) — has a Plan list. Joined-via-deep-link Plans appear on it with a `Joined` badge. Can Exit; cannot Delete (creator-only).
- **Web invitee** (no account, web-fallback user) — no Plan list. Single Plan accessed via the iMessage/SMS deep-link, which is their only persistent handle. Re-clicking the link resumes them at whatever state the Plan is in (quiz / waiting / verdict / read-only). Identified by name they enter on first landing.

Plan creators are always Account members (iOS-only creation per [[../../gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]). Joiners may be any mix of Account members and Web invitees.

See `[[../../CONTEXT|CONTEXT.md]] → Plan member`.

### Q7 — Setup screen inventory + layout
**Locked:** 6 controls, flat eyebrow-per-control layout.

Inventory:

| # | Eyebrow | Control |
|---|---|---|
| 1 | `Name this plan` | Text input, 40-char cap, placeholder `"Name this plan"` |
| 2 | `Who's coming` | Single-select chips: `Just me / Two of us / A group` |
| 3 | `Where to` | LocationPicker (C-23, existing) |
| 4 | `When are you eating` | Single-select chips: `Breakfast / Lunch / Dinner / Late night` |
| 5 | `How you want to eat` | Single-select chips: `Dine in / Outdoor seating / Takeout / Delivery` |
| 6 | `How far` | Distance slider (semantics in Q8) |

**Removed:** Category picker (hidden in v1, food-only — no drinks/movie placeholder rows on this surface), Timer chip group (retired by v1.1 PRD), Transport mode chips (collapsed into distance).

Layout is **flat** — one eyebrow per control, no higher-level section headers. Six pairs in a scrollable column. Matches S01b's existing locked rhythm.

Headline (Create mode): `Start a new plan`. Headline (Edit mode): `Edit your plan`. Body line: `One screen. Set it once. Share when you're ready.`

> **Amendment 2026-05-20** (from [[workflow-overhaul-plan-list|workflow-overhaul-plan-list]] §Q5): the `Who's coming` row has been lifted out of the Setup screen into a pre-Setup disambig sheet attached to the create-Plan affordance (FAB / empty-state pill). Solo path renders 5 controls on Setup (this row omitted); Group path renders 6 controls with the `Just me` option removed (chips become `Two of us / A group`). Primary CTA copy in Q4 is unchanged.

### Q8 — Distance slider
**Locked:** 0.25–10.0 mi range, non-uniform step, walk-anchored tick at 1.0 mi.

- **Range:** 0.25 mi (tightest walk) to 10.0 mi (suburban-friendly drive).
- **Step schedule:** 0.25 mi below 1.0 mi (the walking range), 0.5 mi from 1.0–5.0 mi, 1.0 mi from 5.0–10.0 mi. Granularity tracks the walk/drive cognitive shift.
- **Default value:** 1.0 mi — sits exactly at the implicit walk/drive boundary. Most neutral starting point.
- **Visual hint:** subtle tick at 1.0 mi on the track (no words, just a visual anchor). Mono-tag value reads `"1.0 MI"` — no verbose `"WALKING DISTANCE"` label, since that would resurrect the very transport-mode question this kills.

**Rejected:** uniform 0.5 step (too coarse close-in, too fine far-out), verbose walk/drive label (re-introduces the rejected question), no visual hint at all (loses the walk/drive intuition entirely).

### Q9 — Reroll window
**Locked:** end of next calendar day in user's local TZ.

Window closes at `23:59:59` of the calendar day *after* the verdict fired. Verdict at 5 PM Tuesday → window closes Wednesday 23:59:59. Inherits existing v1 reroll friction: 3-burn cap, reason-as-constraint, initiator-only. Window is an *outer* time bound; unused burns expire on window close. Plan transitions to `decided-expired` on whichever happens first — window close, third burn used, or check-in completed.

Full def in `[[../../CONTEXT|CONTEXT.md]] → Plan reroll window`.

**Rejected:** end of same calendar day (punishingly short for late-night verdicts), rolling 24h (cuts at unintuitive times), meal-occasion-based (couples reroll to a parameter that should be orthogonal), until-commit (abandoned Plans sit in `decided-active` forever).

### Q10 — Validation
**Locked:** name required for both CTAs, rest defaults.

- **Name** — required, 40-char cap. Both `Save for later` and `Drop the invite link` are disabled until name is non-empty.
- **Location** — uses GPS via existing C-23 LocationPicker. The picker's `loading` / `empty` states handle resolution; not gated separately on this screen.
- **Scope, meal time, service shape, distance** — sensible defaults locked in (Dinner / A group / Dine in / 1.0 mi). User can ship without tapping them.

**Rejected:** zero-validation auto-name (defeats the rename — every Plan would read "Plan 1, Plan 2"), strict name+location validation (duplicates the LocationPicker's own state gating).

### Q11 — Edit mode + back-stack
**Locked:**

- Plans editable only while `pending`. Tap a `pending` Plan → opens Setup in Edit mode (same surface, prefilled).
- Edit mode dock CTAs: secondary `SAVE CHANGES` (eyebrow, returns to list), primary `DROP THE INVITE LINK` (saves and launches).
- Top-bar `Back`/`Cancel` from Setup with name non-empty → auto-saves as `pending`, returns to list.
- Top-bar `Back`/`Cancel` from Setup with name empty → discards, returns to list (nothing to save).
- Top-bar `Back` from Edit mode with changes → auto-saves changes (name already validated by definition).
- Tap `decided-active` / `decided-expired` Plan → goes to verdict screen (S05 territory), not Setup. Decided Plans are not editable.

> **Clarification 2026-05-20** (from [[workflow-overhaul-plan-list|workflow-overhaul-plan-list]] §Q8): the tap-pending → Setup-Edit rule applies to **Created Plans only**. Tapping a **Joined** Plan card invokes resume-from-state: route to S03 Quiz at the joiner's last-answered question, S04 Waiting if quiz complete, or S05 Verdict if decided. Mirrors the locked Web invitee re-clicking-the-link behavior.

## Cross-references

- `[[../../CONTEXT|CONTEXT.md]]` — Plan vocabulary (Plan, Plan reroll window, Plan history, Plan exit, Plan delete, Plan back, Plan member, Verdict trigger).
- `[[../../design-system/surfaces/01-initiator|S01]]` + `[[../../design-system/surfaces/01b-parameters|S01b]]` — partially superseded by this doc; full retirement comes in the design-system update task.
- `[[../../design-system/surfaces/04-waiting|S04]]` — partially superseded on timer/countdown (v1.1 PRD).
- `[[../../design-system/surfaces/07-reroll|S07]]` — reroll surface inherits the time-window outer bound from this doc; friction model unchanged.
- `[[v1.1-quiz-amendments|v1.1-quiz-amendments]]` — retired the session timer; this doc extends the workflow direction.
- `[[../../gti-vault/60_engineering/adr/0007-auth-anonymous-default-apple-upgrade|ADR 0007]]` — Plan creators are always Account members.

## Open follow-ups (NOT in this grill's scope)

These came up during the grill but are flagged for separate decisions, not bundled into the setup-screen spec:

- **Plan list surface design.** Card visuals, status badges (Created vs Joined, pending vs decided-active vs decided-expired), ordering, hidden/visible history.
- **Empty list state.** First-launch copy, the `Create your first plan` CTA treatment.
- **S00 landing retirement.** The Plan list replaces S00 as the app entry; S00-landing.md needs to be retired.
- **Web invitee surface design.** Single-link landing flow (name entry → quiz → waiting/verdict → resume-on-reclick) is a brand-new web surface.
- **Push notification semantics.** "Plan moved to decided-active" / "reroll window closing" / "verdict ready" for both initiators and joined Account members.
- **S01 + S01b retirement.** Full deprecation in the design-system surfaces directory once the new Setup surface lands.
- **S04 timer sweep.** Remove the countdown mono-tag + `Auto-fires` copy + timer-elapse fire branch (already marked partially-superseded in the file).
- **`rooms.timer_minutes` / `rooms.deadline_at` schema cleanup.** Columns may stay (additive migrations only) but should be marked unused in the schema docs.
- **S07 reroll window deadline.** Layer the calendar-day-+-1 boundary onto the existing 3-burn friction model.
