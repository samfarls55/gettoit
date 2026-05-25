---
surface: 00-plan-list
status: locked
locked-date: 2026-05-20
supersedes:
  - 00-landing
jsx:
  - code/screens/ScreenPlanList.jsx
---

# S00 · Plan list

> **Code:** [`../code/screens/ScreenPlanList.jsx`](../code/screens/ScreenPlanList.jsx)

The new app entry surface. Replaces [[00-landing|S00 Landing]] as the post-sign-in landing on iOS. A sectioned list of the user's Plans, in Reminders-app spirit, with a floating create affordance and per-card three-dot menus for the destructive actions.

Locked outcomes are in [[../../gti-vault/50_product/0.1.0-workflow-overhaul-plan-list|0.1.0-workflow-overhaul-plan-list]] (decisions doc) and inlined under [[../../gti-vault/15_issues/0.1.0/issues/sg-wf-4-plan-list-surface|sg-WF-4]] (#157). This file is the design-system contract; the iOS port is the paired tracer-bullet **tb-WF-5** (#174) and follow-ups tb-WF-6/7/8/9.

## What this surface defends against

- **Hidden-state Plans.** Before workflow-overhaul, the app dropped users into S01 Initiator on every launch — a session-bound flow with no persistent surface for Plans the user had already created, joined, or run. Plans were ephemeral, the list was implicit. This surface makes Plans a first-class persistent object the user can see, return to, and act on.
- **Status creep into per-card chrome.** Sunset Pop has exactly one accent color (`var(--sun)`); status badges per card would either dilute sun or invent a new state palette. Sectioning by status (`Pending` → `Decided` → `History`) carries status meaning in the headers, freeing each card to be name-first or name-plus-verdict and nothing else.
- **Destructive-action discoverability.** Plan deletion kills an active room and punts joiners (CONTEXT.md → Plan delete). Hiding the affordance behind a swipe gesture or a settings sub-screen invites accidental loss and unfindable cleanup. The trailing `⋯` is always visible on owned cards; the friction lives in the confirm sheet, not the discovery.
- **Algorithmic / suggestion framing.** No "Recommended for you", no "We picked", no rank score. The list is mechanical — newest section-relevant event first — and the cards say what they are. The product is plumbing.
- **Pre-commitment paralysis on create.** The FAB → disambig sheet → Setup flow makes the most-discrete binary (Solo vs Group) explicit at the moment of intent, so the Setup screen renders exactly the controls the chosen path needs (5 for solo, 6 for group) and never asks the user to disambiguate inside the form. See [[01-setup|S01 Setup]] for the consuming side.

## Components used

`GradientSurface` (initiator stop) · `GTIMark` · `Eyebrow` · `PlanCard` (new, this surface) · `PlanSectionHeader` (new, this surface) · `C-25 ActionDotMenu` · `C-26 FloatingActionButton` · `PillCTA` white (empty-state hero) · **`C-27 ActionSheet` (consumer)** — backs both the disambig sheet and the delete-confirm sheet (added 2026-05-24 for bug-24, replaces the inline C-16-language compositions that previously composed these sheets).

Three component primitives back this surface — all spec'd in `components.md` and exported from `code/components.jsx`:

- **C-25 Action Dot Menu** — the trailing `⋯` glyph + popover menu. Reusable elsewhere (e.g. Verdict overflow, future plan-detail surfaces).
- **C-26 Floating Action Button** — bottom-right glass + sun-glyph circular button.
- **C-27 Action Sheet** — the native-iOS action-sheet container that hosts both the **disambig sheet** (Solo / Group) and the **delete-confirm sheet**. Added 2026-05-24 for bug-24 — these sheets previously inlined the C-16 modal-editor language, which produced a non-native shape with dead vertical space; C-27 supplies the native rounded-top + grabber + content-height container. C-16 itself is unchanged (S07 reroll, C-23 LocationPicker continue to inherit it).

## Gradient choice — initiator

Reuses the existing `initiator` gradient stop (`tokens.json` → `gradient.surfaces.initiator`). This surface is the user's first interaction after the (optional) sign-in gate; the warm yellow-to-coral wash that opens the Sunset Pop ritual arc is the right frame for "your Plans live here, and starting a new one continues the same warmth." When the user taps the FAB → picks Solo or Group → lands on S01 Setup, the gradient does not need to retransition; entry-to-Setup motion stays quiet by construction.

## Surface structure (locked Q1)

Sectioned scroll, three sections in fixed order. Empty sections render nothing — `Pending` only appears when there is at least one Pending Plan, and so on. When all three are empty, the surface flips to the empty-state hero (see below).

| Section | Header label | Default state | Notes |
|---|---|---|---|
| Pending | `Pending` | always expanded | Cards = 1-line (name only). |
| Decided | `Decided` | always expanded | Cards = 2-line (name + verdict place). |
| History | `History` | expanded on first viewing, sticky-collapsed thereafter per session | Cards = 2-line. iOS-native disclosure chevron on the header row. |

The History collapse uses a single `chevronRotate` rotation animation (180° at 200ms `var(--ease-out)`) with a `gti-fade-up` body animation on expand. No bespoke motion token — composed from existing easing + duration.

### Section header treatment

`PlanSectionHeader` is a small primitive specific to this surface (lives in `code/screens/ScreenPlanList.jsx`, not in `components.jsx` — single-surface use).

| Element | Spec |
|---|---|
| Container | full-width row, padding `12px 22px 8px`, no background |
| Label | `eyebrow` token (Inter 700 / 11 / tracking 0.18em UPPERCASE), white 0.78 |
| Count badge (optional) | Inter 700 / 11, white 0.55, parenthesized (`(3)`), 6px left-gap from label |
| History chevron | Inter 900 / 14, white 0.55, trailing, rotates 0° → 180° on expand |
| Tap target | full row, min-height 44 (matches HIG); only tappable on the History header |

The Pending and Decided headers are visually identical to History but non-interactive (no chevron, no tap row). The count badge is present on every header to telegraph list density without forcing the user to count rows themselves; counts update live as Plans transition between sections.

## Card content (locked Q2)

`PlanCard` is the per-Plan row primitive. Variants by section, with the `JOINED` eyebrow chip composed in for Joined cards.

### Visual spec — common

| Element | Spec |
|---|---|
| Container | full-width row, padding `14px 18px`, radius `var(--r-card)` (18), `--glass-fill-soft` bg + `1px white 0.18` border, `backdrop-filter: blur(12px) saturate(160%)` |
| Press state | Background → `--glass-fill-soft-press` (white 0.16), 140ms `var(--ease-out)` |
| Tap target | full row, min-height 64 (1-line) or 76 (2-line) — clears HIG 44 with breathing room |
| Trailing `⋯` slot | reserved 36×36 hit row on the trailing edge; the C-25 trigger renders there |
| Row gap (between cards) | 10 |

### Created Pending card (1-line)

| Element | Spec |
|---|---|
| Plan name | Inter 700 / 17 / line 1.2, white, 1 line, ellipsis on overflow |
| Trailing menu | C-25 `ActionDotMenuTrigger`, glyph `⋯` Inter 900 / 18 / white 0.6 |

### Created Decided / History card (2-line)

| Element | Spec |
|---|---|
| Plan name | Inter 700 / 17 / line 1.2, white, 1 line, ellipsis on overflow |
| Verdict place | Inter 500 / 13 / line 1.3, white 0.7, 1 line, ellipsis on overflow, top-margin 4 |
| Trailing menu | C-25 trigger (as above) |

### Joined card (any status)

Renders the `JOINED` eyebrow chip above the name. C-25 trigger menu offers `Leave plan` instead of `Delete plan`.

| Element | Spec |
|---|---|
| `JOINED` chip | `eyebrow` token (Inter 700 / 11 / tracking 0.18em UPPERCASE), `var(--sun)`, bottom-margin 6 |
| Plan name | as above |
| Verdict place (Decided/History only) | as above |
| Trailing menu | C-25 trigger (menu items differ per status — see §"Three-dot menu") |

No avatar dot, no per-member rendering on the list. The chip simply marks the exception ("this one was someone else's invite") against the default ("Created by me").

## Three-dot menu (locked Q4)

The C-25 Action Dot Menu primitive renders the trailing `⋯` and the popover menu. Items vary by card type + status:

| Card | Menu items |
|---|---|
| Created Pending | `Edit plan` · `Delete plan` |
| Created Decided | `Delete plan` |
| Created History | `Delete plan` |
| Joined (any) | `Leave plan` |

All items render as menu rows (see C-25 spec for visual). `Edit plan` routes to [[01-setup|S01 Setup]] in `edit` mode for the tapped Plan. The destructive items open a context-sensitive **confirm sheet** that reuses the C-16 sheet primitive language (radius 26, dark glass, sun-yellow `KEEP`/`STAY` dismiss eyebrow, no red).

### Confirm sheet copy (LOCKED)

| Section | Title | Body | Primary pill | Dismiss eyebrow |
|---|---|---|---|---|
| Pending | `Delete this plan?` | `Nothing's been decided yet — no one's been notified.` | `Delete plan` (white) | `KEEP` |
| Decided-active | `Delete this plan?` | `The active room will end. Joiners will see a session-ended notice.` | `Delete plan` (white) | `KEEP` |
| Decided-expired | `Remove from history?` | `The verdict will be deleted permanently.` | `Remove` (white) | `KEEP` |
| Joined (Leave) | `Leave this plan?` | `Your answers will be removed. The room continues for everyone else.` | `Leave plan` (white) | `STAY` |

Primary pill is `PillCTA fill="white"` — **never** sun, never any red token. The destructive weight is carried by the copy and by the sheet's visual register (dark glass, no celebration motion), not by a colored button. The dismiss is an `eyebrow`-token label in white 0.6 below the pill, 44pt-tall hit row.

## Create affordance (locked Q5 + Q6)

Two entry points, both routing through the same disambig sheet — so Setup's render state is exactly two shapes (5-control solo, 6-control group), never three.

### Populated state — Floating Action Button (C-26)

Persistent bottom-right circular button. See `components.md §C-26` for the full primitive spec.

| Property | Spec |
|---|---|
| Position | `position: fixed`, right 18, bottom 18 (offsets from the surface's trailing + bottom edges) |
| Tap | opens the disambig sheet (no navigation; the sheet rises over the list) |
| Glyph | `+` Inter 900 / 28, `var(--sun)` |

### Empty state — hero pill

When all three sections are empty (first-launch user, or all Plans deleted), the sectioned list is replaced by a centered hero block. The FAB does NOT render in empty state — the hero pill is the only create affordance there.

| Element | Spec |
|---|---|
| Container | centered column, max-width 320, gap 16, padding 48 |
| Eyebrow | `eyebrow` token, white 0.6, label `"No plans yet"` |
| Body | Inter 600 / 15 / line 1.4, white 0.78, max 260, `text-wrap: balance`, label `"This is where your Plans live — solo nights, group dinners, anything you'd rather decide once and forget."` |
| Hero pill | `PillCTA fill="white"`, label `"Create your first plan"`, full-width within the column, top-margin 8 |
| Tap | opens the disambig sheet (same path as the FAB) |

### Disambig sheet

C-27 ActionSheet consumer (composed inline from the C-27 container + two stacked C-05 `ghost` pills). Previously inlined the C-16 modal-editor language; bug-24 (2026-05-24) split off C-27 for the native-iOS action-sheet register and migrated this sheet over.

| Element | Spec |
|---|---|
| Container | C-27 ActionSheet — full-width, rounded-top-only, content-height (no `.medium` fallback), native iOS grabber via `.presentationDragIndicator(.visible)` on iOS / equivalent web JSX |
| Inside background | `rgba(20,20,30,0.92)` dark-glass register (carried through via `.presentationBackground` so the native container paints in Sunset Pop colors); 24px backdrop blur on web |
| Eyebrow | `eyebrow` token, white 0.6, label `"Start a plan"`, bottom-margin 6, top-margin 20 (clears the native grabber) |
| Headline | Inter 900 / 26 / line 0.95, `letterSpacing: -0.02em`, white, UPPERCASE, label `"Who's coming?"`, bottom-margin 18 |
| Solo pill | `PillCTA fill="ghost"`, label `"Solo"`, bottom-margin 10 |
| Group pill | `PillCTA fill="ghost"`, label `"Group"` |
| Dismiss | swipe-down on the native grabber (iOS) or backdrop tap (web). **No Cancel button.** |
| Open motion | native iOS sheet motion (system-owned); web `gti-fade-up` 280ms `var(--ease-out)` |
| Content height | ~240pt iOS detent (handle + eyebrow + headline + two 60pt pills + breathing); iOS pins this so the sheet does not snap to `.medium` and stretch upward into empty space |

Tapping Solo or Group navigates to [[01-setup|S01 Setup]] with the corresponding `groupContext` pre-set. Setup renders 5 controls in solo (no `Who's coming` row) or 6 controls in group (with `Who's coming` chips reduced to `Two of us / A group`); the `Just me` chip is removed because the disambig already captured it. Setup's primary CTA copy follows the locked sg-WF-1 rule (solo → `Start the quiz`, group → `Drop the invite link`).

### Delete confirm sheet

C-27 ActionSheet consumer (composed inline from the C-27 container + the locked copy table above + a C-05 `PillCTA fill="white"` primary + an eyebrow-token dismiss row). Added 2026-05-24 for bug-24 — previously inlined the C-16 modal-editor language alongside the disambig.

| Element | Spec |
|---|---|
| Container | C-27 ActionSheet (same shape as the disambig) — full-width, rounded-top-only, content-height per variant, native iOS grabber |
| Inside background | `rgba(20,20,30,0.92)` dark-glass register, matched to the disambig |
| Title | Inter 900 / 26 / line 0.95, `letterSpacing: -0.02em`, white, UPPERCASE, top-margin 20 (clears the native grabber), bottom-margin 10. Variant-specific per the §"Confirm sheet copy (LOCKED)" table above. |
| Body | Inter 500 / 14 / line 1.45, white 0.78, `text-wrap: balance`, max-width 320, bottom-margin 22 |
| Primary pill | `PillCTA fill="white"` — **never** sun, **never** any red token. Variant-specific label per the locked copy table. |
| Dismiss | eyebrow-token label (Inter 700 / 11 / tracking 0.18em UPPERCASE) in white 0.6, 44pt-tall hit row below the primary pill. Variant-specific copy — `KEEP` for delete variants, `STAY` for leave |
| Open motion | native iOS sheet motion (system-owned); web `gti-fade-up` 280ms `var(--ease-out)` |
| Content height | ~240pt iOS detent for the 1-line `historyDelete` body, ~280pt for the 2-line `pendingDelete` / `decidedActiveDelete` / `joinedLeave` bodies |

The destructive weight is carried by the copy and the sheet's visual register (dark glass, no celebration motion), not by a colored button — the HARD RULE no-red contract from `components.md §C-25` continues to govern.

## Ordering within sections (locked Q7)

Each section sorts by its own dominant temporal event, newest first.

| Section | Sort key | Tiebreaker |
|---|---|---|
| Pending | `created_at DESC` | — |
| Decided | `verdict_fired_at DESC` | `created_at DESC` |
| History | `expired_at DESC` | `created_at DESC` |

Section transitions surface at top — when a Plan moves Pending → Decided (verdict fires), it lands at the top of Decided; when it moves Decided → History (window close / third burn / check-in), it lands at the top of History. The user sees state changes immediately rather than having to hunt for them.

The JSX is data-agnostic — the host surface supplies pre-sorted `pending`, `decided`, `history` arrays. The iOS port owns the SQL.

## Tap behavior

### Created cards (clarifies parent Q11)

| Status | Tap destination |
|---|---|
| Pending | [[01-setup|S01 Setup]] in `edit` mode, seeded with the Plan's saved values |
| Decided-active | [[05-verdict|S05 Verdict]] with reroll affordance |
| Decided-expired | [[05-verdict|S05 Verdict]] read-only |

### Joined cards (Q8 — resume-from-state)

| State | Tap destination |
|---|---|
| Pending, joiner hasn't opened the quiz | [[03-quiz|S03 Quiz Q1]] |
| Pending, joiner mid-quiz | [[03-quiz|S03 Quiz]] at the last-answered question |
| Pending, joiner finished the quiz | [[04-waiting|S04 Waiting]] |
| Decided-active | [[05-verdict|S05 Verdict]] read-only (no reroll — initiator-only per parent Q9) |
| Decided-expired | [[05-verdict|S05 Verdict]] read-only history |

The Joined-card resume-from-state contract matches the Web invitee model from CONTEXT.md → `Plan member` ("return to the Plan's current state"). The iOS port queries per-joiner quiz progress for Joined cards on list render — one extra column or one batched query, owned by tb-WF-7.

## Copy register

- **Eyebrow `"Welcome back"`** — top-leading eyebrow on the populated list. Not `"Your plans"` (label-as-title is procedural). Hidden on the empty-state hero — the empty-state eyebrow `"No plans yet"` carries the moment.
- **Display headline (populated)** — none. The list itself is the page. There is no `"What's next?"` or `"Tonight"` display headline competing with the section headers for hierarchy. Eyebrow → GTI wordmark → list, top to bottom.
- **Section headers** — `Pending`, `Decided`, `History`. Title-case, single word, eyebrow token. NEVER `"In progress"`, `"Resolved"`, `"Past"`.
- **`JOINED` chip** — UPPERCASE via eyebrow token. NEVER `"Invited"`, `"From Sam"`, `"You joined"`. The eyebrow casing telegraphs "label, not headline."
- **Empty-state hero pill** — `"Create your first plan"`. Verb-first, sentence-case literal (the pill renders uppercase via `cta` token). NEVER `"Get started"`, `"Begin"`, `"New plan"`.
- **Disambig sheet** — eyebrow `"Start a plan"`, headline `"Who's coming?"`. The headline is question-form because the user is making a binary call right then. Two pills: `Solo` and `Group`. NEVER `"Just me"` on this surface (lifted away to make the disambig binary clean — `Just me` lives nowhere now).
- **Three-dot menu items** — `Edit plan`, `Delete plan`, `Leave plan`. Sentence-case in source, rendered as menu rows (see C-25). The verb is first, the noun is `plan` (lowercase — matches the warm-friend register; we don't talk about `the Plan` like a system noun).
- **Confirm sheet** — locked table above. Title is the question (`Delete this plan?`), body explains the consequence in one sentence, primary pill is the verb, dismiss is `KEEP` / `STAY` in the eyebrow voice (single word, system-of-record register).

## Behavior

1. **Entry:** the app routes here on every launch where a valid auth session exists. First-launch installs hit S00a (forced sign-in) → S00b (location pre-prime) → S00 Plan list. Web fallback never reaches this surface.
2. **Empty state:** if Pending + Decided + History are all empty, the surface renders the hero block (eyebrow + body + hero pill). The FAB is suppressed in empty state.
3. **Populated state:** the surface renders the sectioned list + FAB. Sections render in `Pending → Decided → History` order; empty sections are omitted entirely.
4. **Tap a Plan card:** routes per the tap-behavior tables above (Created vs Joined, status-dependent).
5. **Tap `⋯` on a card:** opens the C-25 popover anchored to the trigger. Items vary by card type + status.
6. **Tap a destructive menu item:** opens the confirm sheet (C-16 register, dark glass, sun `KEEP`/`STAY` dismiss). Confirm fires the destructive action; dismiss closes the sheet and returns focus to the card.
7. **Tap the FAB (or empty-state hero pill):** opens the disambig sheet. Tap Solo or Group → navigate to S01 Setup with the corresponding `groupContext`.
8. **History header tap:** toggles section expand/collapse. Default expanded on first viewing; collapsed-or-expanded state persists per-session.

## 0.1.0 (workflow-overhaul) scope

- **Exactly three sections.** No `Drafts`, no `Templates`, no `Shared with me` (Joined cards live inline in their status section, marked by the chip). Adding a fourth section is a spec change.
- **No thumbnails on cards.** Verdict-place thumbnails (Foursquare / MapKit photo) were considered and rejected (expensive fetch per list render; not load-bearing for at-a-glance recall). Deferred — re-open if testing surfaces a real signal.
- **No search.** 0.1.0 lists are bounded (<20 Plans for the foreseeable founder dogfood); add search when the list breaks the one-screen scroll for a real user.
- **No multi-select / bulk-delete.** Single-card delete via the menu is sufficient at this scale.
- **No drag-to-reorder.** Ordering is mechanical per the locked sort keys; manual ordering would invite "why isn't this at the top" friction without a clear win.
- **No swipe-to-delete fallback.** Sunset Pop forbids red (the iOS-native swipe-to-delete trailing reveal); the C-25 menu is the single delete affordance.
- **No category selector / vertical picker on the list.** That decision lives on S01 Setup (when categories beyond food ship), not here.

## Edge cases

- **Returning user with an active room mid-session.** Out of scope here — the resume-from-state path is owned by the iOS routing layer (tb-WF-5). If a user backgrounds the app mid-quiz and returns, the existing behavior takes precedence over routing through S00 Plan list. The surface is for cold-start and post-completion bootstraps.
- **User taps the FAB, then dismisses the disambig sheet without choosing.** Sheet closes, list reappears as it was. No state mutation.
- **User taps Delete on a Pending card, then dismisses the confirm sheet.** Sheet closes, card reappears in the list. No state mutation.
- **User leaves a Joined Plan that is the only Plan in their list.** The card disappears; if no other sections have rows, the surface flips to the empty-state hero on the next render.
- **Plan moves Pending → Decided while the surface is open.** Section transitions are owned by the data layer; the JSX re-renders with the new section assignment when the host pushes a fresh data prop. The surface itself does no real-time subscription work.
- **All Plans deleted via the menu.** Surface flips to empty-state hero on next render. The FAB is suppressed; the hero pill takes its place.

## Adjacencies

- **[[01-setup|S01 Setup]]** — downstream of every create / edit flow on this surface. The disambig sheet's choice (Solo / Group) determines Setup's render mode (5 controls / 6 controls). The Setup amendment (5-control solo, 6-control group with `Two of us / A group` chips) is captured in [[../../gti-vault/15_issues/0.1.0/issues/tb-wf-4-wire-plan-setup-surface|tb-WF-4]] and re-spec'd inline in `01-setup.md` when tb-WF-4 lands.
- **[[03-quiz|S03 Quiz]]** — downstream of Joined-card tap (when the joiner hasn't finished the quiz). The resume-from-state contract reads per-joiner quiz progress.
- **[[04-waiting|S04 Waiting]]** — downstream of Joined-card tap (when the joiner finished the quiz but the verdict hasn't fired).
- **[[05-verdict|S05 Verdict]]** — downstream of Created-card tap (Decided / History) and Joined-card tap (Decided / History).
- **[[00-landing|S00 Landing]] (superseded)** — replaced by this surface. The 00-landing file remains in the tree until the paired iOS port (tb-WF-5) retires `ScreenLanding.jsx`.

## Out of scope (deferred)

- **Reroll-window deadline mechanism** — sibling HITL issue [[../../gti-vault/15_issues/0.1.0/issues/sg-wf-6-reroll-window-deadline|sg-WF-6]]. The Decided section's section transition (→ History) needs a defined deadline; until that grills, the JSX treats `expired_at` as the host-supplied signal.
- **Web invitee surface design** — sibling HITL issue [[../../gti-vault/15_issues/0.1.0/issues/sg-wf-5-web-invitee-flow|sg-WF-5]]. The Joined-card behavior on this surface assumes the joiner is on iOS; the Web fallback has its own surface tree.
- **Push notification semantics** — "Plan moved to Decided" / "reroll window closing" / "verdict ready" notifications for joiners and initiators. Parent-grill followup; not resolved here.
- **Reroll-window-closing visual hint on Decided cards** (e.g. small time-remaining chip when window has <6h left). Deferred — first ship the section structure, layer this in once we observe whether users miss rerolls.
- **Section header sticky-on-scroll behavior** — light polish, deferred. The current spec is non-sticky; the headers scroll away with their cards. Flip to sticky if the populated state grows past ~6 cards per section.
