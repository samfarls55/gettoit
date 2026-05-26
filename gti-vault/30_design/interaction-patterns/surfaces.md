---
title: Surfaces — per-surface design and audit playbooks
purpose: Surface-by-surface recipes for designing or auditing by intent; the bridge between principles and the named pattern catalog
---

# Surfaces

Playbooks for designing or auditing by surface intent. Each section gives: when this surface applies, a pattern recipe (required + optional), the foundation gates that fire here, and the common anti-pattern sweep. For the pattern catalog itself see [[patterns]]. For foundation rules see [[principles]]. For end-to-end workflow recipes see [[workflows]].

## Screen-type taxonomy

Source: Tidwell/Brewer/Valencia Ch.2 intro. Name the screen type before reaching for a pattern.

- **Overview** — show a list or set of things. Home pages, search results, feeds, grids, tables, dashboards, trees.
- **Focus** — show one single thing. Articles, item detail, single record, map, video, game.
- **Make** — provide tools to create or update a digital object. Editors, builders, canvases, IDEs.
- **Do** — facilitate a single task. Sign in, register, purchase, change a setting, run a wizard.

Most screens collapse to one of these. The common failure mode is a screen that tries to be two at once (Make + Overview crammed together); split or pick. Settings, Entry, Form, Data, and Mobile are framed as sub-shapes of the above and get their own playbooks below.

## Navigation models

Source: Tidwell/Brewer/Valencia Ch.3 intro. Pick one — or knowingly mix — before applying any specific nav pattern.

- **Hub and Spoke** — a hub lists destinations; user goes to a spoke, does the job, returns. Pick for small-screen mobile or suites with a small fixed set of major sections.
- **Fully Connected** — every screen carries global nav reaching every other screen in one hop. Pick for sites with under ~7 top-level sections where any-to-any jumps are normal.
- **Multilevel / Tree** — top sections fully connected, subpages reach siblings only. Pick for large content sites where cross-section jumps are rare.
- **Step by Step** — prescribed linear sequence with Back/Next. Pick for tasks with required order, branching, or guided learning (wizard, checkout, onboarding).
- **Pyramid** — step-by-step plus a hub/menu page listing the whole sequence. Pick for galleries, photo albums, article series, product variants.
- **Pan and Zoom** — one large virtual space; navigation is pan/zoom/reset. Pick for maps, image viewers, info graphics.
- **Flat** — almost no inter-screen navigation; tools live inside one workspace. Pick for tool-dominant apps where users live in one canvas (Photoshop, Excel).

Mix-and-match is normal. Cost of fully-connected nav everywhere is screen clutter and signalling that leaving the page is fine. Hide global nav inside focused flows.

---

## Surface playbooks

Each section below covers one surface intent. Required patterns are the floor; optional patterns are warranted only when conditions in [[patterns]] match.

## Overview

Lists, search results, feeds, grids, tables, dashboards.

**When to use**

- User scans a set of items to pick one.
- User checks recent activity, status, or aggregate state.
- User explores by browse/search/filter rather than direct address.
- Landing surface after sign-in for users with no single dominant task.

**Required patterns**

- [[patterns#Feature, Search, and Browse]] — give searchers, browsers, and passive arrivals an anchor on one page.
- [[patterns#Center Stage]] — the dominant content (featured item, primary list) outweighs chrome.
- [[patterns#Titled Sections]] — group widgets / categories with named headers.
- [[patterns#Clear Entry Points]] — 1-3 plain-language CTAs for the top tasks.
- A list pattern matched to content shape: [[patterns#Cards]], [[patterns#Thumbnail Grid]], [[patterns#Two-Panel Selector or Split View]], [[patterns#List Inlay]], [[patterns#Pagination]], or [[patterns#Infinite List]].

**Optional patterns**

- [[patterns#Dashboard]] — when the surface aggregates status across domains.
- [[patterns#Streams and Feeds]] — when content updates frequently and recency matters.
- [[patterns#Media Browser]] — when items are pictorial/playable.
- [[patterns#Dynamic Queries]] — live filter/sort controls.
- [[patterns#Jump to Item]] / [[patterns#Alpha/Numeric Scroller]] — quick jump for long lists.
- [[patterns#New-Item Row]] — clear add-an-item affordance from the list.
- [[patterns#Carousel]] — featured-then-tail content (use with care; avoid auto-rotating 5+ slides).
- [[patterns#Movable Panels]] — when user roles vary enough to justify customisation.

**Foundation gates**

- [[principles#P-02. Instant Gratification]] — first useful item visible without sign-in, tour, or empty state.
- [[principles#P-03. Satisficing]] — labels scan-readable; primary CTA reads as a verb.
- [[principles#P-08. Microbreaks]] — returning user sees fresh content in one tap.
- [[principles#P-09. Spatial Memory]] — list order, nav placement, and chrome stable across visits.
- [[principles#V-01. Visual hierarchy]] — most actionable info is visually dominant; charts honest.

**Anti-pattern sweep**

- Marketing carousel of 5+ auto-rotating items in the featured slot.
- Search bar collapsed behind an icon on a search-dominant site.
- Dashboard cramming every available metric instead of curating to user need.
- Tabs hiding things that should be side-by-side.
- Algorithmic re-ordering with no recency fallback or "newest" toggle.
- Cards lacking timestamp, author, or affordance for inline action.
- Post-login lands on an empty state, generic profile, or single chart.
- Charts with truncated axes, 3D effects, or rainbow categorical palettes.

---

## Focus

Item detail, single record, article, map, video, document.

**When to use**

- User is reading, watching, or inspecting one thing.
- User arrived via search, deep link, or drill from an Overview.
- User may want to act on the item or move sideways to siblings.

**Required patterns**

- [[patterns#Center Stage]] — the primary content visually dominates; chrome demoted.
- [[patterns#Breadcrumbs]] — "you are here" plus one-click ascent (when hierarchy is 2+ levels).
- [[patterns#Deep Links]] — stable shareable URL captures content + relevant state.
- [[patterns#Escape Hatch]] — every limited-nav variant carries a one-tap return to a known place.
- [[patterns#Action Panel]] or [[patterns#Button Groups]] — actions on the item are collected and discoverable.

**Optional patterns**

- [[patterns#Pyramid]] — sibling prev/next plus an Up link to the index, when the item is one of a sequence.
- [[patterns#Alternative Views]] — when one design cannot serve all scenarios for the same content (map vs list, edit vs preview).
- [[patterns#Annotated Scroll Bar]] — long documents where the user scrolls for specific items.
- [[patterns#Hover or Pop-Up Tools]] — secondary actions surfaced on hover when chrome would clutter.
- [[patterns#Animated Transition]] — shared-element transitions when arriving from a list.

**Foundation gates**

- [[principles#P-01. Safe Exploration]] — every action reversible or confirmable; Back works.
- [[principles#P-04. Changes in Midstream]] — leaving and returning restores scroll, selection, draft state.
- [[principles#P-09. Spatial Memory]] — header, breadcrumbs, action panel in stable positions.
- [[principles#P-13. Social Proof + Collaboration]] — reviews, ratings, or "N others" signal where decisions are made.
- [[principles#V-04. Readability]] — line length 45-75ch on long-form content.

**Anti-pattern sweep**

- Detail view that requires Back-to-grid for every sibling move.
- Breadcrumbs reflecting click trail instead of hierarchy.
- Sharing the URL drops the recipient on a blank landing.
- Pop-up tools that appear instantly on hover and block the control underneath.
- Action panel scattered across the page instead of grouped.
- Current page rendered as a link to itself in the breadcrumb.

---

## Make

Editors, builders, canvases, IDEs, layout tools.

**When to use**

- User creates or modifies a digital object (image, vector, document, slide, layout, model).
- User iterates in small steps and wants immediate feedback.
- Session is long; user may want multiple parallel artifacts open.

**Required patterns**

- [[patterns#Canvas Plus Palette]] — central work area framed by tool, property, and layer palettes.
- [[patterns#Preview]] — live or near-live result of edits.
- [[patterns#Multilevel Undo]] — full undo history, not just last action.
- [[patterns#Command History]] — companion to undo; lets users review and redo.
- [[patterns#Many Workspaces]] — tabs, panels, or windows for parallel work.

**Optional patterns**

- [[patterns#Module Tabs]] / [[patterns#Collapsible Panels]] — group palette subgroups.
- [[patterns#Movable Panels]] — user-controlled palette layout (system-controlled reflow defeats spatial memory).
- [[patterns#Macros]] — record-and-replay for repeated action sequences.
- [[patterns#Smart Menu Items]] — context-aware menu state (greyed when not applicable, with last-used filename, etc).
- [[patterns#Hover or Pop-Up Tools]] — surface secondary actions without occupying the palette.
- [[patterns#Visual Framework]] — common shell across multiple editor views.

**Foundation gates**

- [[principles#P-01. Safe Exploration]] — undo reaches arbitrarily back; no irreversible destructive defaults.
- [[principles#P-04. Changes in Midstream]] — switch tabs, switch tools, return without losing state.
- [[principles#P-06. Incremental Construction]] — feedback under 500ms; non-blocking saves.
- [[principles#P-07. Habituation]] — Ctrl-S saves; standard shortcuts wired; gesture per tool consistent.
- [[principles#P-11. Streamlined Repetition]] — bulk operations, find/replace, recorded actions on high-traffic actions.
- [[principles#P-12. Keyboard Only]] — every primary tool reachable from the keyboard with predictable Tab order.

**Anti-pattern sweep**

- Icon-only palette with no tooltips so every tool is a guess.
- Canvas that resizes when a palette opens/closes, losing the user's spatial position.
- Two contradictory gestures for the same tool depending on selection state.
- Mandatory save-then-render cycle; modal "preview" windows.
- Editor that only opens one document at a time.
- Tabs that don't survive reload, or share state and overwrite each other.
- Confirmation dialogs on routine edits that users habitually click past.

---

## Do

Single-task flows: checkout, sign-up, run-a-workflow, multi-step setup.

**When to use**

- User has one task with a defined end state.
- Task has required order (wizard) or branching that depends on earlier choices.
- Task is done rarely enough that hand-holding is welcome.

**Required patterns**

- [[patterns#Wizard]] — for branched or novel multi-step tasks (3-10 steps).
- [[patterns#Progress Indicator]] — current step plus total visible near Back/Next.
- [[patterns#Prominent "Done" Button or Assumed Next Step]] — the finish action is visually dominant on each step.
- [[patterns#Escape Hatch]] — Cancel works on every step and returns to a safe place.
- [[patterns#Good Defaults and Smart Prefills]] — every step preloads sensible values.

**Optional patterns**

- [[patterns#Forgiving Format]] — accept multiple formats on strict fields (dates, phone numbers).
- [[patterns#Input Hints]] / [[patterns#Input Prompt]] — visible without focus required.
- [[patterns#Error Messages]] — localised to the field, plain language, concrete fix.
- [[patterns#Autocompletion]] — for domain-known values (city, country, product names).
- [[patterns#Animated Transition]] — step-to-step transitions that preserve spatial continuity.

**Foundation gates**

- [[principles#P-04. Changes in Midstream]] — back to any prior step without losing data; drafts persist.
- [[principles#P-05. Deferred Choices]] — non-required fields skippable; "change later" affordances.
- [[principles#P-07. Habituation]] — Enter submits; Esc cancels; Tab order matches visual order.
- [[principles#P-12. Keyboard Only]] — every step completable without the mouse.
- [[principles#V-01. Visual hierarchy]] — one primary CTA per step; no competing primaries.

**Anti-pattern sweep**

- Forward-only flow with no draft saving.
- 15-step wizard with no step map; or 2-step wizard for a task that could be one form.
- Wizard used for a task experts do daily (rigid and patronising).
- Progress bar that animates to 100% but the flow continues.
- Validation that fires only on submit instead of on blur.
- Placeholder-as-label that disappears once the user starts typing.

---

## Settings

Preferences, account, profile, configuration, document properties.

**When to use**

- User views and changes configuration random-access (not sequential).
- Surface is returned to repeatedly; users need to find the same control twice.
- Domain has more than ~5 configurable values.

**Required patterns**

- [[patterns#Settings Editor]] — findable, self-contained, named groups, conventional placement.
- [[patterns#Menu Page]] or [[patterns#Two-Panel Selector or Split View]] — categorise so users can guess where a setting lives.
- [[patterns#Sign-In Tools]] — entry from the upper-right user menu by convention.
- [[patterns#Escape Hatch]] — return-to-app affordance from any sub-page.

**Optional patterns**

- [[patterns#Module Tabs]] — alternative to a left rail when categories are few.
- [[patterns#Collapsible Panels]] — for long settings pages that group naturally.
- [[patterns#Smart Menu Items]] — show current value at a glance in the entry control.
- [[patterns#Good Defaults and Smart Prefills]] — sane out-of-box values; per-setting and global revert.

**Foundation gates**

- [[principles#P-07. Habituation]] — gear/avatar in the conventional spot; settings reachable from there.
- [[principles#P-09. Spatial Memory]] — categories do not reorder between visits.
- [[principles#P-10. Prospective Memory]] — drafts/changes persist if the user navigates away mid-edit.
- [[principles#V-01. Visual hierarchy]] — destructive actions (delete account) visually separated from cosmetic ones.

**Anti-pattern sweep**

- Settings scattered across multiple unrelated screens; no single entry point.
- Mobile app with no Settings screen at all.
- Deep 4-level hierarchy with no search box.
- Settings that auto-save silently with no confirmation, or require hunting for a Save button.
- "Advanced" tab hiding things 80% of users need.
- Sign Out buried three levels deep.
- Inconsistent save model (some pages live-apply, others require Save).

---

## Entry

First-run, empty-state, landing, cold-start.

**When to use**

- User arrives without prior context: new install, signed-out home, empty inbox/list.
- Surface must teach what to do next while still letting the user explore.
- Surface is also encountered by infrequent users who need a refresher.

**Required patterns**

- [[patterns#Clear Entry Points]] — 1-3 large plain-language CTAs covering the top tasks.
- [[patterns#Mobile Direct Access]] (on mobile) — first screen primes the most likely action using device signals.
- [[patterns#Escape Hatch]] — skip / dismiss / explore-without-completing always available.
- [[patterns#Help Systems]] — inline labels, hints, and at least a "Help" link to fuller docs.

**Optional patterns**

- [[patterns#Good Defaults and Smart Prefills]] — empty state seeded with a working example or template.
- [[patterns#Animated Transition]] — short, purposeful entrance motion.
- [[patterns#New-Item Row]] — clear first action when the empty state is a list.
- [[patterns#Wizard]] — only for genuinely branched first-time setup; otherwise a single page wins.

**Foundation gates**

- [[principles#P-01. Safe Exploration]] — onboarding skippable; nothing destructive on first run.
- [[principles#P-02. Instant Gratification]] — first useful action under 5 seconds, before sign-up wall.
- [[principles#P-05. Deferred Choices]] — registration deferred until the user has experienced value.
- [[principles#V-05. Evoking a feeling]] — visual register matches the user's emotional state on arrival.

**Anti-pattern sweep**

- Cold-start screen is a sign-in wall or a tour carousel.
- Forced sign-up before any value delivered.
- Required tour that cannot be dismissed or replayed.
- 20-field registration before any feature is reachable.
- Empty state that shows a blank box instead of teaching the next step.
- Tutorial overlay over a direct-access screen so users must dismiss before acting.

---

## Form

Anywhere data is entered: contact, profile edit, search refinement, content editor.

**When to use**

- User supplies structured input.
- Embedded inside a Do flow, a Settings page, or a Make surface.
- Field count exceeds one or two so layout decisions matter.

**Required patterns**

- [[patterns#Input Hints]] — format hints visible without focus required.
- [[patterns#Input Prompt]] — short prompt inside empty fields when helpful.
- [[patterns#Good Defaults and Smart Prefills]] — reasonable defaults; never an empty form when context exists.
- [[patterns#Error Messages]] — field-local, plain language, concrete fix.
- [[patterns#Forgiving Format]] — accept multiple formats on date, phone, currency, address fields.
- [[patterns#Prominent "Done" Button or Assumed Next Step]] — one dominant submit, in a predictable location.

**Optional patterns**

- [[patterns#Autocompletion]] — for known value sets.
- [[patterns#Drop-down Chooser]] — when the choice is small, mutually exclusive, and known in advance.
- [[patterns#Fill-in-the-Blanks]] — inline form-as-sentence for short focused inputs.
- [[patterns#Structured Format]] — segmented inputs (credit card, phone) where structure aids correctness.
- [[patterns#Password Strength Meter]] — on password creation fields.
- [[patterns#List Builder]] — when the input is "pick N from this set".

**Foundation gates**

- [[principles#P-03. Satisficing]] — short plain labels; CTAs name the verb.
- [[principles#P-05. Deferred Choices]] — required field set as small as possible; optional fields marked.
- [[principles#P-07. Habituation]] — Enter submits; Esc cancels; Tab order matches visual order.
- [[principles#P-12. Keyboard Only]] — every field reachable and operable without the mouse; visible focus rings.
- [[principles#V-03. Typography]] — body 12pt-ish; generous leading on multi-field forms.

**Anti-pattern sweep**

- Placeholder text used as the only label (disappears on type).
- Format-strict fields that reject valid input (no spaces in card numbers, no parens in phone).
- Validation that fires only on submit, blowing past the user with a wall of red.
- Required and optional fields visually indistinguishable.
- "Reset" button adjacent to "Submit" with no confirmation when clicked.
- Multi-page form that loses entered data on navigation.
- Tab order skipping controls or following visual disorder.

---

## Data

Tables, charts, graphs, complex visualisations.

**When to use**

- Surface presents structured numeric or relational data the user inspects.
- User compares, filters, drills, or exports.
- Truth-faithfulness matters as much as aesthetics.

**Required patterns**

- [[patterns#Datatips]] — hover reveals the underlying number on points/cells.
- [[patterns#Dynamic Queries]] — filters apply live, not on a submit click.
- [[patterns#Small Multiples]] — many-series comparison; one chart per series instead of overplotting.
- Sortable-table-style affordances via [[patterns#Two-Panel Selector or Split View]] or [[patterns#List Inlay]] when each row has detail.

**Optional patterns**

- [[patterns#Data Brushing]] — selecting in one chart highlights the same rows in others.
- [[patterns#Data Spotlight]] — highlight a subset without losing surrounding context.
- [[patterns#Multi-Y Graph]] — compare series with different units on one frame.
- [[patterns#Annotated Scroll Bar]] — surface position markers on long tables (errors, search hits).
- [[patterns#Pagination]] / [[patterns#Infinite List]] — for long rowsets where the right choice depends on whether the user scans or jumps.
- [[patterns#Jump to Item]] — quick row access on long tables.

**Foundation gates**

- [[principles#P-03. Satisficing]] — labels and units immediately legible; no decoder ring required.
- [[principles#P-09. Spatial Memory]] — column order, axis scale, palette stable across visits.
- [[principles#V-01. Visual hierarchy]] — dominant metric reads first; minor ones recede.
- [[principles#V-02. Color]] — survives desaturation; categorical encodings reinforced with shape/text.
- [[principles#V-06. Images]] — chart imagery carries meaning; no decorative chartjunk.

**Anti-pattern sweep**

- Truncated axes that exaggerate change; 3D/dial/pie charts where a bar would do.
- Rainbow categorical palette across 10+ categories.
- Live-updating numbers with no timestamp or quiet hours.
- Hovering a point yields nothing; underlying value is hidden.
- Filters re-run a full page load instead of updating in place.
- Selecting in one chart leaves linked charts un-highlighted.
- 500-row table with no search, jump, or scroll annotation.

---

## Mobile overlay

Run this overlay on any surface above when the target is mobile (phone or small tablet).

**When to use**

- Surface is rendered on a touch-first device with constrained width.
- User session is short and interleaved with attention elsewhere.
- Network and input cost are higher than on desktop.

**Required patterns**

- [[patterns#Vertical Stack]] — primary content in a single column.
- [[patterns#Bottom Navigation]] — top-level sections within thumb reach.
- [[patterns#Touch Tools]] — taps, swipes, long-presses where the gesture matches the verb.
- [[patterns#Generous Borders]] — 44pt+ tap targets per platform HIG.
- [[patterns#Loading or Progress Indicators]] — progress, not just spinners, for waits over 1s.

**Optional patterns**

- [[patterns#Mobile Direct Access]] — first screen primes the most likely action using device signals.
- [[patterns#Collections and Cards]] — multi-field items rendered as cards.
- [[patterns#Filmstrip]] — swipe-paging when the user compares items.
- [[patterns#Infinite List]] — long single-column lists.
- [[patterns#Richly Connected Apps]] — universal links / app links so external URLs route to the right destination.
- [[patterns#Make It Mobile]] — derive the mobile experience from mobile-first thinking, not shrunk-down desktop.

**Foundation gates**

- [[principles#P-02. Instant Gratification]] — value within one or two taps of launch.
- [[principles#P-07. Habituation]] — platform-standard gestures (back swipe, pull-to-refresh) work as expected.
- [[principles#P-08. Microbreaks]] — persistent auth; restore-to-where; quick triage on cards.
- [[principles#V-04. Readability]] — body legible in sun, under bifocals; line length 45-75ch.
- [[principles#B-04. Natural user interfaces]] — touch/gesture affordances discoverable; fallback for users who can't or won't gesture.

**Anti-pattern sweep**

- Desktop layout reflowed into a narrow column without rethinking touch targets.
- Bottom nav with 6+ items so each target shrinks below 44pt.
- Hover-only affordances (no equivalent tap path).
- Spinners on every wait with no progress signal for waits over 1s.
- Modals that swallow the system back gesture.
- External URL shares open the mobile browser when the installed app should claim them.
- Pull-to-refresh missing on a primary stream surface.

---

## How to use this file

- Pick the surface intent first; consult the playbook for that surface.
- For mobile renderings of any surface, run the [[#Mobile overlay]] checklist on top.
- Confirm the required patterns are present and named correctly; check optional ones against the condition phrases in [[patterns]].
- Walk the foundation gates as yes/no checks. A miss here is systemic; document it once at the [[principles]] level rather than per surface.
- Sweep for the listed anti-patterns. Each one cites a fix in [[patterns]] or [[principles]].
