---
surface: 01-setup
status: locked
locked-date: 2026-06-03
supersedes:
  - 01-initiator
  - 01b-parameters
jsx:
  - code/screens/ScreenSetup.jsx
---

# S01 · Plan setup

> **Code:** [`../code/screens/ScreenSetup.jsx`](../code/screens/ScreenSetup.jsx)

The canonical **Plan creation + Plan edit** surface — one screen that collapses today's S01 (Initiator landing) + S01b (Pre-quiz parameters) into a single Setup screen. Lands the design-system contract for the workflow-overhaul phase per [[../../gti-vault/50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]] (the locked outcomes of the 2026-05-19 `/grill-with-docs` session), amended by sg-SA-1 to replace active Setup geography with **C-28 SearchAreaPicker**.

This surface ships once; the iOS wiring (replacing the existing `ScreenInitiator` + `ScreenParameters` paths) lives in the paired tracer-bullet **tb-WF-4**. Until that lands, the legacy S01 + S01b surfaces remain in the tree, marked `superseded`.

## Modes

The surface has two modes — `create` (new Plan) and `edit` (existing `pending` Plan) — driven by a single `mode` prop. Both modes share layout; only the headline and the secondary CTA label differ.

| Mode | Headline | Body | Secondary CTA | Primary CTA |
|---|---|---|---|---|
| `create` | `Start a new plan` | `One screen. Set it once. Share when you're ready.` | `SAVE FOR LATER` | `Drop the invite link` (group) / `Start the quiz` (solo) |
| `edit` | `Edit your plan` | `One screen. Set it once. Share when you're ready.` | `SAVE CHANGES` | `Drop the invite link` (group) / `Start the quiz` (solo) |

The primary CTA's label swaps on the live `groupContext` selection — `A group` / `Two of us` reads `Drop the invite link`, `Just me` reads `Start the quiz`. The `groupContext` chip group defaults to `A group`, so the canonical first-paint label is `Drop the invite link`.

## What this surface defends against

The new surface deliberately **overrides** S01-initiator's "no name your night" defense. The original surface forbade naming the session up front (the framing was that pre-commitment killed momentum). With Plans now persistent, named, list-backed items in the Reminders-app spirit, **naming is the load-bearing differentiator** — without a name, the Plan can't be re-found on the list, an Edit-mode return is meaningless, and the rename of *decision → Plan* (workflow-overhaul Q2) loses its motivating ground.

This spec exception is the only intentional override against the locked S01 rule set. Other S01 defenses still hold:

- **Algorithm framing** — still suppressed. No "AI", "smart", "suggestions" copy anywhere.
- **Group-size friction** — still suppressed. The `Who's coming` chip group is **occasion framing**, not headcount; actual group size is inferred from who accepts the invite.
- **Pre-commitment paralysis** — still defended. Every control except `Name this plan` opens on a sensible default; an initiator can ship a valid Plan by typing a name and tapping the primary CTA.

If a future spec change wants to add a sixth control, it has to justify the addition against the same locked rule: every knob beyond name must either ship a sensible default or be explicitly load-bearing.

## Locked inventory — five controls, flat eyebrow-per-control rhythm

| # | Eyebrow | Control | Default |
|---|---|---|---|
| 1 | `Name this plan` | Text input, **required**, 40-char cap, placeholder `"Name this plan"` | empty |
| 2 | `Who's coming` | Single-select chips (C-04): `Just me · Two of us · A group` | `A group` |
| 3 | `Search area` | `C-28 SearchAreaPicker` chip | empty / committed Search area |
| 4 | `When are you eating` | Single-select chips (C-04): `Breakfast · Lunch · Dinner · Late night` | `Dinner` |
| 5 | `How you want to eat` | Single-select chips (C-04): `Dine in · Outdoor seating · Takeout · Delivery` | `Dine in` |

**Removed from the merged S01 + S01b inventory:**

- **Category picker** — food only in 0.1.0, so no picker rendered (S01-initiator's drinks/movie placeholder rows are not carried forward).
- **Timer chip group** — retired by 0.1.0 PRD US34 / US35 / §line 115. There is no session timer in 0.1.0+.
- **Split geography controls** (`Where to` C-23 LocationPicker + `How far` C-21 distance slider) — replaced by one C-28 SearchAreaPicker chip and full-screen Search area editor. The user selects center + radius together on the map.
- **Transport mode chips** (S01b's `Walking / Driving`) — not resurrected. Search area radius is visual map geometry, not a walking/driving mode.

### Chip group treatment

All three chip groups are the **C-04 chip, single-select variant** — same primitive as today's S01 timer chips and S01b parameter chips. Selected: sun-yellow fill, ink text, `scale 1.02`, `shadow-chip-selected`. Default: glass row (white 0.04 bg, white 0.55 outline, `blur(var(--sp-1))`). Tap target ≥ 48. Chips wrap to as many rows as the labels need.

### Name input treatment

| Property | Value |
|---|---|
| Component | Glass row (matches the C-23 picker treatment — same `--r-row` radius, same soft-glass background) hosting a borderless `<input type="text">`. |
| Background | `var(--glass-fill-soft)` with `rgba(255,255,255,0.18)` outline |
| Backdrop | `blur(12px) saturate(160%)` |
| Min-height | `56` (matches the C-23 chip) |
| Padding | `12px 16px` |
| Border-radius | `var(--r-row)` |
| Font (input value) | Inter 700 / 17 / white |
| Placeholder | `"Name this plan"` in `rgba(255,255,255,0.6)` |
| Cap | `maxLength={40}` — hard cap. **wfr-24 (2026-05-26) override:** the original "no truncation indicator" line is replaced by the Input Hints adjacent hint (see §"Input hints" below) — users see the cap before they hit it. |
| Eyebrow | `Name this plan` in `eyebrow` token treatment, opacity `0.6`, above the row. **wfr-26 (2026-05-26) override:** the eyebrow above the name input is replaced by a persistent **field label** (sentence case `Name this plan`, body-sm semibold, `TextOnGradient.secondary` / white-0.78) so the label can't be mistaken for a section heading. The other five rows continue to use the eyebrow treatment as section heads. |

The label and the placeholder share the same copy (`Name this plan`). Voice register — sentence case in both. Never `"Plan name"` (form-field register) or `"Tonight's plan"` (occasion-coupling — Plans can be days out). **wfr-26 (2026-05-26):** the field label is the persistent label — it stays put during and after typing while the placeholder disappears on type. The two layers + the §"Input hints" hint compose the Input Prompt + Label + Hint group per `gti-vault/30_design/interaction-patterns/patterns.md` §"Input Prompt".

## Search area — C-28 SearchAreaPicker

The `Search area` row renders one **C-28 SearchAreaPicker** chip. It replaces the previous active `Where to` LocationPicker row and `How far` distance slider with a single geography primitive: a committed center + radius edited together on a map.

### Search area chip

| State | Main line | Supporting line |
|---|---|---|
| Empty | `Set search area` | `Tap to choose on map` |
| Committed | Best available center label | `Search area - N.N mi` |

The chip opens the full-screen **Search area editor**. It never opens the historical C-23 LocationPicker sheet and never exposes a separate distance slider on Setup.

### Search area editor

The editor contract is owned by C-28:

- Full-screen Apple MapKit surface.
- Close/back button in the top chrome.
- Top search field with placeholder `Search city, neighborhood, or address`.
- Current-location button.
- Visible selected circle centered on the map camera center.
- Bottom radius badge such as `2.0 MI RADIUS`.
- Minus/plus controls that step through the same allowed radius stops as gesture-driven zoom.
- Bottom `USE THIS AREA` commit CTA.
- Dirty close prompt when draft map state differs from the committed Search area, with actions `Use this area` and `Discard changes`.

### Radius and draft model

Search area radius is the **distance from the map camera center to the nearest visible map edge**. Pan changes the draft center. Pinch changes the draft radius. Minus/plus controls update the draft radius and keep the map zoom in sync. None of those draft changes commit until `USE THIS AREA`.

A **Search area jump** recenters the map without committing. Typed search result selection and the current-location button are both Search area jumps; after either jump, the user can still pan/pinch and must tap `USE THIS AREA` to commit.

### Density preview pins

Density preview pins are broad food/dining density feedback only. They render inside the selected circle, cap around 20 visible pins, are non-interactive, and are non-blocking. Empty preview results or preview fetch failure must not block `USE THIS AREA`. They are not candidate cards, recommendations, venue details, rankings, or final Candidate pool membership.

### Timing boundary

Search area has **no timezone or timing semantics**. It is only center + radius. The stale reroll-window "search-area timezone" language is separate follow-up work and must not be expanded in this surface.

## Input hints

One control carries an adjacent **Input Hints** affordance (per `gti-vault/30_design/interaction-patterns/patterns.md` §"Input Hints" — outside the field, smaller + lighter than the label, persists with and without focus). Surfaced by `/workflow-review` 2026-05-26, finding wfr-24.

| Field | Hint | Why |
|---|---|---|
| Name | `Up to 40 characters` | Surfaces the 40-char cap before the user hits it. Overrides the original "users feel the limit by hitting it" line. |

Hint treatment: `body` token at `14pt` regular weight, `TextOnGradient.tertiary` (white-at-0.55), sentence case, second-person casual register. Never form-field register (`required` / `error` / `field`).

## Dock

| Mode | Secondary | Primary |
|---|---|---|
| `create` | `SAVE FOR LATER` text link (eyebrow token treatment, white 0.55) | `PillCTA` white — `Drop the invite link` (group) / `Start the quiz` (solo) |
| `edit` | `SAVE CHANGES` text link (eyebrow token treatment, white 0.55) | `PillCTA` white — `Drop the invite link` (group) / `Start the quiz` (solo) |

Both dock affordances are inside a `CTADock`. The secondary uses the **same treatment** as today's S01 `SETTINGS` footer link — `eyebrow` token (Inter 700 / 11 / tracking 0.18em / UPPERCASE), `rgba(255,255,255,0.55)`, 44pt min-height hit row, sits below the primary `PillCTA` with `4px` margin-top. Plain `<button>`, no icon, no chevron. Mirrors the C-22 chip's primary-pill-plus-tertiary-text pattern.

### Validation

- **Name required for both dock CTAs.** Both `SAVE FOR LATER` (or `SAVE CHANGES` in edit mode) **and** `Drop the invite link` / `Start the quiz` are disabled until `name.trim().length > 0`.
- **Search area launch gating is owned by tb-SA-1.** This surface locks the C-28 visual and interaction contract; the persistence slice owns the exact Room-minting guard when no Search area is committed.

### Error placement (wfr-25)

Persistence failures route to the field that failed — the user reads the message next to the input that needs fixing per `patterns.md` §"Error Messages". Cross-field / network failures fall back to the top-of-dock slot reserved for them.

- **Name (`name`) CHECK violation** (e.g., `plans_name_check`, 1..40 char guard) → inline message beneath the name input, prefixed with a sun-tinted `exclamationmark.triangle.fill` glyph so the signal is icon + text + color, never color alone. Copy: `Name needs to be 1 to 40 characters.`
- **Search area radius (`distance_meters` / radius storage) CHECK violation** → inline message beneath the C-28 Search area chip, same icon + text treatment. Copy: `Search area radius is out of range — pick a value between 0.25 and 10 miles.`
- **Cross-field / network / RLS / unknown** → top-of-dock label, same icon + text treatment. Copy: `Something went wrong saving the plan. Try again in a moment.`

Routing is encoded as a pure classifier (`SetupScreen.classifyPersistFailure(_:)`) so the view body has a single source of truth and the routing is unit-testable independent of the network. The classifier is substring-based against the raw error description (`name`, `distance`, `distance_meters`, `radius`); anything else falls through to the cross-field bucket.

### Top-bar back / cancel behavior

Per workflow-overhaul Q11:

- `create` mode, name non-empty, user taps top-bar Back/Cancel → **auto-save** the Plan as `pending`, return to the Plan list. (Treat the secondary `SAVE FOR LATER` and a back-out as equivalent — no work lost.)
- `create` mode, name empty, user taps top-bar Back/Cancel → **discard**, return to the Plan list. No confirm prompt (nothing has been named, nothing to lose).
- `edit` mode, user taps top-bar Back/Cancel → **auto-save** changes, return to the list. The name is non-empty by definition (existing Plan), so the empty-discard branch is impossible from edit.

The top-bar itself is supplied by the surrounding navigation chrome (Plan list ↔ Setup is a push-style transition, not a quiz-style segmented progress); this surface does not render a `C-02 TopBar`. The chrome's `Back`/`Cancel` button is wired to the host (iOS — tb-WF-4).

## Components used

`GradientSurface` (initiator stop) · `GTIMark` · `Eyebrow` · display headline · Glass row (name input) · `Chip` (C-04 single-select) ×3 groups · `SearchAreaPickerChip` (C-28) · `SearchAreaEditor` (C-28, opened by the chip) · `CTADock` · `PillCTA` white · `eyebrow`-styled `<button>` secondary text link.

C-28 is the active Setup geography component. C-23 LocationPicker remains historical/superseded for active Setup use, and C-21 remains available for non-Setup radius controls such as Verdict widening.

## Copy register

Carries S01b's voice forward — second-person, casual, never form-field register.

- **`Start a new plan` / `Edit your plan`** — present-tense, declarative. Not `"Create a session"` (procedural) or `"Plan details"` (form-field).
- **`One screen. Set it once. Share when you're ready.`** — three short declarative sentences. Names the contract (one screen) and the asynchronous nature (share when ready, not on submit).
- **Eyebrows** — second-person and casual: `Name this plan`, `Who's coming`, `Search area`, `When are you eating`, `How you want to eat`. Never `Plan name` / `Group size` / `Meal time` / `Service type` / `Distance` (form-field register).
- **Search area chip** — empty `Set search area`; committed support line `Search area - N.N mi`. The editor commit is `USE THIS AREA`.
- **`Drop the invite link` / `Start the quiz`** — voluntary verb, casual register. The label swaps on `groupContext` — solo gets `Start the quiz` (no one to invite); group gets `Drop the invite link`.
- **`SAVE FOR LATER` / `SAVE CHANGES`** — eyebrow-token mono-tag treatment, deliberately understated. Mirrors `SETTINGS` on S01-initiator.

## Persistence + behavior

The Setup surface is the **Plan** surface, not the room surface. Persistence rules:

- **Save for later** (secondary tap, or back-out with name non-empty): mints a `plans` row with `status: 'pending'`, captures the five Setup controls onto the Plan, returns to the Plan list. No room created.
- **Primary CTA tap** (`Drop the invite link` / `Start the quiz`): mints the `plans` row as above **and** immediately mints the `rooms` row from the Plan's captured controls + fires the existing invite / quiz flow.
- **Edit mode primary tap**: writes back to the existing `plans` row, then immediately mints the room + fires the invite/quiz.
- **Edit mode secondary (`SAVE CHANGES`) tap**: writes back to the existing `plans` row, returns to the list. No room created.

Column-level mapping (Plan → captured controls) is owned by [[../../gti-vault/15_issues/0.1.0/issues/tb-wf-1-plans-table-schema|tb-WF-1]] (Plans table schema) plus the Search area persistence tracer bullet [[../../gti-vault/15_issues/0.1.0/issues/tb-sa-1-search-area-chip-persistence-foundation|tb-SA-1]]. Search area persists through existing center/radius storage; this design-system slice introduces no schema change.

## Accessibility

- **Tab/focus order:** Name input → Who's coming chip group → SearchAreaPicker chip → When chip group → How you want to eat chip group → primary CTA → secondary text link.
- **VoiceOver:**
  - Name input: announces the eyebrow as the field label ("Name this plan, text field").
  - Chip groups: VO announces selected state via `aria-pressed`.
  - SearchAreaPicker chip: empty announces `"Set search area, button"`; committed announces `"Search area, {center label}, {N.N miles}, button"`.
  - SearchAreaEditor: inherits the C-28 modal/editor VO contract from `components.md`.
- **Dynamic Type:** the screen is scrollable; all five rows tolerate text scaling up to AX5. The Search area chip uses one-line ellipsis for the center label and keeps the radius support line in eyebrow treatment.

## Versions / history

- `2026-06-03` — sg-SA-1 amendment: active Setup geography changed to C-28 SearchAreaPicker. The previous active `Where to` C-23 LocationPicker + `How far` C-21 distance slider split is superseded for Setup; C-23 remains historical in `components.md`, and Search area explicitly has no timezone or timing semantics.
- `2026-05-19` — surface specified per [[../../gti-vault/15_issues/0.1.0/issues/sg-wf-1-plan-setup-surface|sg-WF-1]] (#154). Locked from the 2026-05-19 `/grill-with-docs` decisions in [[../../gti-vault/50_product/0.1.0-workflow-overhaul-plan-setup|0.1.0-workflow-overhaul-plan-setup]]. iOS wiring deferred to tb-WF-4 (gated on sg-WF-4 Plan list landing). Until tb-WF-4 lands, `01-initiator.md` and `01b-parameters.md` remain in the tree marked `superseded`.
