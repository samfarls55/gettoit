---

issue: sg-WF-1
status: done
type: AFK
feature: 0.1.0
github_issue: 154
created: 2026-05-19
---

> **Legacy mobile note (2026-06-05):** References to iOS, Swift, SwiftUI, TestFlight, or ios/ in this historical note refer to the retired Swift app unless explicitly stated otherwise. Active mobile app work now lives in React Native / Expo under mobile/.


# sg-WF-1 â€” Plan setup surface

## Parent


## What to build


The surface has two modes â€” **Create** (new Plan) and **Edit** (existing `pending` Plan) â€” driven by a single prop. Both modes share layout; only the headline and the secondary CTA label differ.

### Locked inventory (six controls, flat eyebrow-per-control rhythm)

| # | Eyebrow | Control |
|---|---|---|
| 1 | `Name this plan` | Text input, **required**, 40-char cap, placeholder `"Name this plan"` |
| 2 | `Who's coming` | Single-select chips (C-04): `Just me / Two of us / A group`. Default `A group`. Occasion framing, not headcount. |
| 3 | `Where to` | C-23 LocationPicker (existing) |
| 4 | `When are you eating` | Single-select chips: `Breakfast / Lunch / Dinner / Late night`. Default `Dinner`. |
| 5 | `How you want to eat` | Single-select chips: `Dine in / Outdoor seating / Takeout / Delivery`. Default `Dine in`. |
| 6 | `How far` | Distance slider (see below) |

**Removed from the merged S01 + S01b inventory:** Category picker (food only in 0.1.0, no picker rendered), Timer chip group (retired by 0.1.0 PRD US34/US35/Â§115), Transport mode chips (collapsed into the distance slider).

### Distance slider semantics

- **Range:** 0.25 mi (tightest walk) to 10.0 mi (suburban-friendly drive).
- **Step schedule:** 0.25 mi below 1.0 mi (the walking range), 0.5 mi from 1.0â€“5.0 mi, 1.0 mi from 5.0â€“10.0 mi.
- **Default value:** 1.0 mi â€” sits exactly at the implicit walk/drive boundary.
- **Visual hint:** subtle tick at 1.0 mi on the track (no words, just an anchor). Mono-tag value reads `"1.0 MI"` only â€” no verbose `"WALKING DISTANCE"` label.
- New tokens may need to land (e.g. a `slider.tick` color) â€” if so, propose them in `tokens.json` rather than inlining hex.

### Headline + body

| Mode | Headline | Body |
|---|---|---|
| Create | `Start a new plan` | `One screen. Set it once. Share when you're ready.` |
| Edit | `Edit your plan` | `One screen. Set it once. Share when you're ready.` |

### Dock â€” both modes

| Mode | Secondary (eyebrow text, same treatment as today's `SETTINGS` link) | Primary (`PillCTA` white) |
|---|---|---|
| Create | `SAVE FOR LATER` | `Drop the invite link` (group) / `Start the quiz` (solo) |
| Edit | `SAVE CHANGES` | `Drop the invite link` (group) / `Start the quiz` (solo) |

### Validation

- Name is required for **both** dock CTAs. Both are disabled until `name.trim().length > 0`.
- Location is **not** gated separately on this screen â€” the C-23 LocationPicker's existing `loading` / `empty` states handle resolution and the room can write a `null` location to be filled in via the existing S04 mechanism.
- Top-bar `Back`/`Cancel` with name non-empty auto-saves as `pending` and returns to the Plan list.
- Top-bar `Back`/`Cancel` with name empty discards and returns to the Plan list (no confirm prompt).
- In Edit mode, top-bar `Back` with changes auto-saves changes (name already non-empty by definition).

### Copy register

Carry S01b's voice forward â€” second-person, casual, never form-field register. The full copy table is in the inventory above.

### Spec exception against S01's "no name your night" rule


### Files to write / edit


## Acceptance criteria

- [ ] Distance slider behavior matches the locked semantics (0.25â€“10.0 mi range, non-uniform step, 1.0 default, 1.0 tick). If a new component variant is introduced, document it in `components.md`.
- [ ] `01-initiator.md` and `01b-parameters.md` carry `status: superseded` + `superseded-by:` frontmatter and a top-of-file banner. (Files remain in the tree until tb-WF-4 retires the iOS code.)
- [ ] `CHANGELOG.md` carries a one-line entry.

## Blocked by

None â€” can start immediately. The eleven grilled decisions are all locked in [[../../../50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]].

## Comments

