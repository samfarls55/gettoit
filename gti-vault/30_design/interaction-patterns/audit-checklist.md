---
title: Audit checklist — per-surface prompts
purpose: Concrete questions an agent walks through when reviewing a screen or codebase
---

# Audit checklist

Walk one of these sections for each surface in the app, based on the surface's *intent* (see [[00-how-to-audit]]). Each question is paired with the named patterns it implicates — drill into the pattern entry for *Signals present / missing / anti-pattern*.

Run the foundation checks ([[01-foundations-cognition]]) on every surface first. They are not duplicated here.

---

## Section A — Cross-cutting (run for every surface)

1. **Navigation model coherence**: Does this surface fit the app's chosen navigation model (hub-and-spoke / tree / step-by-step / pyramid / fully-connected / flat)? See [[03-navigation]] Navigational models.
2. **Global signposts present**: Is global navigation visible (or one tap/click away)? Are utility tools (search, account, settings) where users expect them? See [[03-navigation#Sign-In Tools]].
3. **Reentrance**: If a user leaves this surface mid-task, do they come back to where they were? See [[01-foundations-cognition#P-10. Prospective Memory]] and [[02-information-architecture#Many Workspaces]].
4. **Loading + skeleton states**: Does the surface show what's loading and roughly how long it'll take? See [[06-mobile#Loading or Progress Indicators]] and [[08-actions#Spinners and Loading Indicators]].
5. **Empty state**: What does the surface look like with zero content? Does it teach the user what to do next?
6. **Error state**: What does the surface look like when its data fetch fails? Is there a retry?
7. **Cancelability**: For any operation longer than ~1s, can the user cancel? See [[08-actions#Cancelability]].

---

## Section B — Overview surfaces (lists, search results, dashboards)

Ask:

1. **Is the list pattern right for the use case?** Decision tree in [[07-lists]]'s "Picking a list pattern". Specifically:
   - One row needs a lot of detail? → consider [[07-lists#Two-Panel Selector or Split View]] or [[07-lists#List Inlay]].
   - Image-dominant content? → [[07-lists#Thumbnail Grid]] or [[07-lists#Cards]].
   - Mobile, long list, single-column? → [[06-mobile#Infinite List]] or [[07-lists#Pagination]].
   - Featured/hero followed by long tail? → [[07-lists#Carousel]] (with care).
2. **Sort + filter affordances** present? See [[09-complex-data#Dynamic Queries]].
3. **Quick jump** for long lists? See [[07-lists#Jump to Item]] / [[07-lists#Alpha/Numeric Scroller]].
4. **Add affordance**: Is there a clear way to add a new item from this list? See [[07-lists#New-Item Row]].
5. **Faceted search / browse** wired to the right backing pattern? See [[02-information-architecture#Feature, Search, and Browse]].
6. **Dashboards specifically**: Is the most actionable info dominant? Are charts honest (no truncated axes, no rainbow categorical)? See [[02-information-architecture#Dashboard]] and [[09-complex-data]] heuristics.

---

## Section C — Focus surfaces (item detail, single record, article)

Ask:

1. **Center Stage**: Is the primary content visually dominant? Are utility chrome elements demoted? See [[04-layout#Center Stage]].
2. **Breadcrumbs / back path**: Can the user understand where they are in the hierarchy? Can they zoom out? See [[03-navigation#Breadcrumbs]] and [[03-navigation#Pyramid]].
3. **Deep linking**: Does this detail view have a stable, shareable URL? See [[03-navigation#Deep Links]].
4. **Related items / next item**: Can the user move sideways without going back? See [[03-navigation#Pyramid]] (sibling nav).
5. **Action panel**: Are the actions on this item collected and discoverable? See [[08-actions#Action Panel]] and [[08-actions#Button Groups]].

---

## Section D — Make surfaces (editors, builders, canvases)

Ask:

1. **Canvas + palette layout**: Does the surface separate the work area from the tools? See [[02-information-architecture#Canvas Plus Palette]].
2. **Live preview**: Does the user see results as they edit (P-06 Incremental Construction)? See [[08-actions#Preview]].
3. **Multilevel undo + redo**: Both wired? See [[08-actions#Multilevel Undo]] and [[08-actions#Command History]].
4. **Save semantics**: Is autosave the default, with explicit save still available? Are unsaved changes communicated?
5. **Tool affordances**: Are tools toggled with a clear state? Does the cursor change to indicate the active tool?
6. **Multiple workspaces / tabs**: Can a user work on more than one thing at a time? See [[02-information-architecture#Many Workspaces]].
7. **Repeatable actions**: Is there a way to record and replay an action? See [[08-actions#Macros]].

---

## Section E — Do surfaces (single-task, checkout, sign-up, wizard-like)

Ask:

1. **Progress indicator**: Does the user see how many steps and which one they're on? See [[03-navigation#Progress Indicator]].
2. **Forward + back symmetry**: Can the user move back to any prior step without losing data? See [[01-foundations-cognition#P-04. Changes in Midstream]].
3. **Defer optional choices**: Are non-required fields clearly optional? Can they be skipped? See [[01-foundations-cognition#P-05. Deferred Choices]] and [[10-forms#Good Defaults and Smart Prefills]].
4. **Input forgiveness**: Do format-strict fields accept multiple input formats? See [[10-forms#Forgiving Format]].
5. **Inline validation**: Does validation fire on blur, not only on submit? See [[10-forms#Error Messages]].
6. **Prominent done action**: Is the "submit/finish/place order" CTA visually dominant? See [[08-actions#Prominent "Done" Button or Assumed Next Step]].
7. **Wizard caveats**: Is this flow actually wizard-shaped, or have you forced a non-linear task into a linear flow? See [[02-information-architecture#Wizard]].

---

## Section F — Settings / configuration surfaces

Ask:

1. **Settings Editor pattern**: Are settings grouped, searchable, with sane defaults? See [[02-information-architecture#Settings Editor]].
2. **Apply vs. live**: Are changes applied live, or do they require an explicit "Save"? Is this consistent across all settings?
3. **Revert to defaults**: Per-setting and global revert available?
4. **Sign-out / account controls** in the conventional place? See [[03-navigation#Sign-In Tools]].

---

## Section G — Entry / empty / onboarding surfaces

Ask:

1. **Clear entry points**: Are the top 1-3 tasks visually featured, not buried in nav? See [[03-navigation#Clear Entry Points]].
2. **First useful action in <5 seconds**? (Foundation P-02 Instant Gratification.)
3. **Skip / defer**: Can a user skip onboarding entirely and explore? See [[01-foundations-cognition#P-01. Safe Exploration]].
4. **Mobile direct access**: For mobile, can a returning user reach the most-frequent task in 1-2 taps? See [[02-information-architecture#Mobile Direct Access]].

---

## Section H — Form surfaces (anywhere data is entered)

Ask:

1. **Field count**: Is the form as short as possible? Are optional fields collapsed or deferred?
2. **Label placement + style**: Labels visible, persistent, associated with the right field. (Placeholder-as-label is an anti-pattern.)
3. **Input hints**: Format hints visible without focus required. See [[10-forms#Input Hints]].
4. **Autocompletion**: Where domain-known values exist (city, country, etc.), is autocomplete wired? See [[10-forms#Autocompletion]].
5. **Smart defaults**: Are reasonable defaults pre-filled? See [[10-forms#Good Defaults and Smart Prefills]].
6. **Error recovery**: Errors localized to the field, in plain language, with a concrete fix? See [[10-forms#Error Messages]].
7. **Password fields**: If applicable, is strength visualized? See [[10-forms#Password Strength Meter]].
8. **Keyboard navigation**: Tab order matches visual order; Enter submits the form; Esc cancels modals. See [[01-foundations-cognition#P-12. Keyboard Only]].

---

## Section I — Complex-data surfaces (charts, tables, graphs)

Ask:

1. **Datatips on hover**: Does hover over a point/cell reveal the underlying number? See [[09-complex-data#Datatips]].
2. **Interactive querying**: Are filters live? See [[09-complex-data#Dynamic Queries]].
3. **Brushing + linked views**: Selecting one part of one chart highlights the same rows in others? See [[09-complex-data#Data Brushing]].
4. **Multiple comparable series**: Use [[09-complex-data#Small Multiples]] over jamming everything into one chart.
5. **Spotlight**: Can a user highlight a subset without losing context? See [[09-complex-data#Data Spotlight]].
6. **Multiple measure scales**: Use [[09-complex-data#Multi-Y Graph]] correctly when comparing series with different units.

---

## Section J — Mobile-specific overlay (run after the surface-type section)

For any mobile surface, also ask:

1. **Touch targets >=44pt** (per platform HIG)? See [[06-mobile#Touch Tools]] and [[06-mobile#Generous Borders]].
2. **Bottom-navigation depth + placement** appropriate for the IA? See [[06-mobile#Bottom Navigation]].
3. **Single-column vertical stack** for primary content? See [[06-mobile#Vertical Stack]].
4. **Card-based content blocks** where individual items have multiple fields? See [[06-mobile#Collections and Cards]].
5. **Filmstrip / swipe-paging** appropriate when the user is comparing items? See [[06-mobile#Filmstrip]].
6. **Loading indicators** with progress, not just spinners, for >1s waits? See [[06-mobile#Loading or Progress Indicators]].
7. **Deep-link / cross-app affordances**: Can content be opened from outside the app and is the destination right? See [[06-mobile#Richly Connected Apps]].
8. **"Make it mobile"**: Is the mobile experience derived from mobile-first thinking, or shrunk down from desktop? See [[06-mobile#Make It Mobile]].

---

## Producing the report

After walking the surfaces, aggregate:

- **Systemic findings** (same anti-pattern repeats across surfaces) — fix at the design-system or framework level. See [[11-ui-systems]].
- **Local findings** (one surface has the bug) — fix in place.
- **Foundation violations** (P-01..P-13) — top priority.
- **Missing patterns of high value** — patterns whose absence is hurting workflows.
- **Misapplied patterns** — patterns present but used wrong (anti-pattern).

Each finding must cite the named pattern or principle and propose one concrete next step.
