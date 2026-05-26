---
title: Organizing the Content — Information Architecture and Application Structure
source_chapter: 2 — Organizing the Content: Information Architecture and Application Structure
purpose: Catalog of Ch.2's IA and application-structure patterns, with audit-ready signals
---

# Organizing the Content — Information Architecture and Application Structure

Patterns that decide what a surface *is*: a list of things, one thing, a tool to make a thing, or a job to do. Use this chapter when auditing top-level app structure, home/landing screens, settings sections, browse + search shells, dashboards, editors, and onboarding flows. The audit lens: for each major screen, name its screen type (Overview / Focus / Make / Do), then check that its dominant pattern matches that type and serves frequency-of-use rules.

## Screen-type system

Source: Ch.2 intro (book p.33-38). Use this taxonomy before reaching for any pattern below — name the screen type first, then check the pattern fits.

- **Overview** — show a list or set of things (home pages, search results, feeds, grids, tables, trees). Patterns: Feature/Search/Browse, Streams and Feeds, Media Browser, Dashboard.
- **Focus** — show one single thing (article, map, video, game). Patterns: Mobile Direct Access, Alternative Views, Many Workspaces, [[03-navigation#Deep Links]].
- **Make** — provide tools to create or update a digital object. Patterns: Canvas Plus Palette, Many Workspaces.
- **Do** — facilitate a single task (sign in, register, purchase, change a setting). Patterns: Wizard, Settings Editor; plus forms ([[10-forms]]) and verbs ([[08-actions]]).

Task/workflow rules from p.33: (a) frequently-used controls must be immediately visible; rarely-used controls live behind a drilldown (settings, help). (b) Chunk long tasks into a sequence of steps; communicate "where am I" to the user. (c) Design for both novice (overlays, wizards, onboarding) and expert (shortcuts, customisation, keyboard-only). (d) Plan for multiple channels (desktop, mobile, voice) — IA must scale. (e) Cards are the default building block — design for one card on small screens, then compose into lists/grids on large.

Audit usage: a screen that tries to be two types at once (e.g. Make + Overview crammed together) is the common failure mode. Split or pick.

## Patterns

### Feature, Search, and Browse

- Use when: site offers long lists of items (articles, products, videos) that users browse and search; you want to engage new visitors immediately with featured content.
- What it is: three co-located elements on the main page — a featured item, a search box, and a browseable list of categories/items.
- Why it works: searchers and browsers are different user types; serving both on one page covers both. Featured content gives a passive arrival a reason to stay.
- How to apply:
  - Place search box in a prominent slot (upper corner or banner-top), demarcated by whitespace/background colour; collapse to icon only when space is tight.
  - Allocate Center Stage to the featured item, near the top.
  - Show a browseable list/grid of categories or items adjacent to the feature; cards or category labels (Amazon-style menus optional).
  - Use [[03-navigation#Breadcrumbs]] once the user drills into a category.
  - On task-centric sites (booking, transactional), promote search to dominant; demote feature/browse.
- Signals present (in code/spec): a landing/home route renders three siblings — a `SearchInput`/`SearchBar`, a `Featured`/`Hero` block, and a `CategoryGrid`/`BrowseList`. Faceted filters appear on results route.
- Signals missing (red flag): landing screen has only browse OR only search; first-time visitor sees a chrome shell with no anchor item; search box buried in a menu.
- Anti-patterns / mis-applications: featured slot is a marketing carousel of 5+ items that auto-rotates past attention; search bar collapsed behind an icon on a search-dominant site; category list that looks like a tree but is actually a flat dropdown with hidden subcategories.
- Related: [[03-navigation#Menu Page]], [[03-navigation#Breadcrumbs]], [[07-lists]], [[04-layout]]

### Mobile Direct Access

- Use when: a mobile app generates value by doing one thing really well; the user opens it for that one thing.
- What it is: the first screen presents actionable information or a primed primary action with no required input, using device signals (location, time, camera).
- Why it works: removes friction between launch and value; satisfies [[01-foundations-cognition#P-02. Instant Gratification]] on mobile where typing is expensive.
- How to apply:
  - On launch, use device signals (location, time, camera, mic) with permission to populate the first screen.
  - Pick the single most likely action and prime it (camera on, location-filtered list, weather for current location).
  - Prefill smart defaults (e.g. ParkMe defaulting "1 hour").
  - Keep secondary search/configuration accessible but not the first thing.
- Signals present (in code/spec): app entry route fires location/time/camera permission and renders result-first; no required onboarding gate; first screen has zero required text input.
- Signals missing (red flag): cold-start screen is a sign-in wall, a tour carousel, or an empty search box with no defaults; first screen requires typing to produce any value.
- Anti-patterns / mis-applications: forcing a tutorial overlay over the direct-access screen; asking for permission *and* a manual search before showing anything; pre-fetching nothing until user taps.
- Related: [[01-foundations-cognition#P-02. Instant Gratification]], [[03-navigation#Clear Entry Points]], [[06-mobile]]

### Streams and Feeds

- Use when: content updates frequently and the user checks it many times a day; or a team collaborates asynchronously around posts/comments/documents.
- What it is: a scrollable, dynamically-updated vertical (sometimes horizontal) ribbon of cards in reverse-chronological (or algorithmic) order.
- Why it works: latest-first ordering rewards every visit with novelty; matches [[01-foundations-cognition#P-06. Microbreaks]] — short visits, low cost, high reward.
- How to apply:
  - Order newest-first by default; for chat/collab, newest-at-bottom is standard.
  - Each card shows what (title + teaser + thumb), who (author/source), when (relative time, then absolute as it ages), where (link).
  - Offer pull-to-refresh / explicit refresh control plus auto-prepend on new items.
  - Show "More" or drill-down to full content via [[07-lists#Two-Panel Selector or Split View]], One-Window Drilldown, or List Inlay.
  - Low-effort feedback inline on each card (like, thumb, star, reply field).
  - Use Infinite List ([[06-mobile]]) for long scroll history.
- Signals present (in code/spec): a `Feed`/`Stream`/`Timeline` component renders a virtualised list of `Card` items sorted by created_at desc; pagination is cursor- or infinite-scroll; cards have inline reaction/reply affordances.
- Signals missing (red flag): user's primary surface is a static list that requires manual refresh; new items appear only on hard reload; cards lack timestamp and author; engagement requires drilling into a full page.
- Anti-patterns / mis-applications: algorithmic re-ordering with no recency fallback; "newest" tab buried behind a "for you" default the user cannot disable; feed that hides timestamps to disguise stale content; in-feed ads that mimic the card pattern with no label.
- Related: [[07-lists]], [[06-mobile]], [[01-foundations-cognition#P-06. Microbreaks]]

### Media Browser

- Use when: surface presents a large set of pictorial or playable items (photos, videos, documents) for browse + select + view/edit.
- What it is: a two-view structure — a grid of thumbnails (with optional metadata) and a single-item view, plus a browsing interface (search, filters, folders, tags).
- Why it works: images compress meaning; recognition is faster than reading. A familiar grid + detail pair sets correct expectations.
- How to apply:
  - Grid view: thumbnails with minimal metadata (title, date); optional thumb-size control; sort and filter.
  - Single-item view: full media + metadata, prev/next, [[03-navigation#Pyramid]] back to grid.
  - Browsing interface: search box, folder/album list, faceted filters (Adobe Bridge: keywords, modification date, camera type, ISO).
  - If user owns items: multi-select (shift/checkboxes/lasso), cut/copy/paste, move/reorder/delete, keyboard traversal (arrows + space).
  - Inline edits (crop, brightness) on the single-item view; escape hatch to a "real" editor when needed.
- Signals present (in code/spec): route pair like `/library` (grid) and `/library/:id` (detail) with prev/next; `Thumbnail` component grid + filter sidebar; multi-select state in store.
- Signals missing (red flag): media collection rendered as a long text list with no thumbnails; no way to multi-select; detail view has no prev/next so user must back to grid each time.
- Anti-patterns / mis-applications: thumbnails so small they require hover-to-distinguish; metadata noise crowding the grid (8 columns of fields per item); detail view that loses scroll position when you return to the grid.
- Related: [[07-lists#Thumbnail Grid]], [[07-lists#Two-Panel Selector or Split View]], [[03-navigation#Pyramid]]

### Dashboard

- Use when: the user needs a continuous, at-a-glance view of incoming information (metrics, alerts, status) and key next-actions — usually the first screen after login.
- What it is: a single information-dense page combining titled sections, charts, lists, and shortcuts to key workflows.
- Why it works: aggregates "what changed" + "what to do" in one scan; matches the at-a-glance newspaper/cockpit mental model.
- How to apply:
  - Pick what to show by user need, not data availability — remove or demote noise.
  - Group with [[04-layout#Titled Sections]]; only use tabs when items genuinely don't need side-by-side comparison.
  - Use One-Window Drilldown for "more detail" — click a chart to dive in.
  - Use simple line/bar charts for at-a-glance comparison; avoid 3D/dial/pie unless data demands it.
  - Highlight keywords/numbers within text so eye-scanning works.
  - Try to fit on one screen with little or no scroll.
  - Consider optional Movable Panels for customisation when user roles vary.
- Signals present (in code/spec): a `Dashboard`/`Home` route renders multiple `Card`/`Widget` siblings in a grid; each widget has a title and a "see details" link; default user lands here post-auth.
- Signals missing (red flag): post-login screen is an empty state, a generic profile, or a single chart; user must navigate 2+ levels to find current status; charts have no "drill in" affordance.
- Anti-patterns / mis-applications: cramming every metric the team has ever built; tabs hiding things that should be side-by-side; pie charts comparing 10 categories; live-updating numbers with no timestamp or quiet hours.
- Related: [[04-layout#Titled Sections]], [[09-complex-data]], [[07-lists]]

### Canvas Plus Palette

- Use when: building any graphical editor where users create and arrange objects on a virtual space (image/vector/wireframe/3D/slide).
- What it is: a large empty central canvas surrounded by palettes of tool icons (and property/colour/layer panels at the sides).
- Why it works: maps directly to the familiar physical workbench; icon palettes leverage cross-app recognition (brush, hand, magnifier).
- How to apply:
  - Large central canvas, framed by palettes on edges (left/top primary, right/bottom for properties).
  - Palette = grid of iconic buttons; labels optional when icons are recognisable, required when not.
  - Group palette into subgroups via Module Tabs or Collapsible Panels.
  - Decide one consistent gesture per tool (drag-drop OR click-canvas) and stick to it; usability-test heavily — tool behaviour isn't self-evident.
  - Most palette buttons create the pictured object; reserve a few for modes (zoom, select, lasso).
- Signals present (in code/spec): an `Editor`/`Canvas` component with sibling `Palette` / `Toolbar` / `PropertiesPanel` / `LayersPanel`; tool state lives in a global editor store; cursor mode changes per selected tool.
- Signals missing (red flag): editor crams tools into a single linear menu; no central blank space; tools change behaviour per-mode without communicating it.
- Anti-patterns / mis-applications: icon-only palette with no tooltips so every tool is a guess; canvas that resizes with palette open/close (loses user's spatial position); two contradictory gestures for the same tool depending on selection state.
- Related: [[04-layout#Module Tabs]], [[08-actions]], [[01-foundations-cognition#P-13. Keyboard Only]]

### Wizard

- Use when: a long, branched, or novel task that the user will do rarely and where the designer knows the right order better than the user (install, import, first-time setup).
- What it is: a feature that leads the user step-by-step through a prescribed sequence of chunks, with Back/Next navigation.
- Why it works: divide-and-conquer reduces working-memory load; sparing the user from figuring out task structure converts a complex job into a sequence of small decisions.
- How to apply:
  - Chunk the task into 3-10 steps; two steps = too few, fifteen = too many.
  - Split at decision points so later steps can depend on earlier choices (dynamic branching).
  - Show a map of all steps (or a Progress Indicator) so user knows where they are.
  - Allow free movement back and forward; never trap forward-only.
  - On a single page, alternatives: Titled Sections with step numbers, Responsive Enabling (later steps disabled until prereq), or Progressive Disclosure (reveal next step as previous finishes).
  - Use Good Defaults / Smart Prefills on every step.
- Signals present (in code/spec): a `/onboarding/step-N` or `/setup/:slug` route; a `WizardContainer` with `step` state, `Back`/`Next` buttons, and a step-map header; partial save state between steps.
- Signals missing (red flag): long branched task crammed into one giant form; user lost in install/import flow with no progress signal; can't go back to change an earlier choice.
- Anti-patterns / mis-applications: 2-step wizard for a task that could be one form; 15-step wizard with no map; forward-only flow with no draft saving; using a wizard for a task that experts do daily (rigid + patronising).
- Related: [[03-navigation#Progress Indicator]], [[04-layout]], [[10-forms]], [[01-foundations-cognition#P-04. Changes in Midstream]]

### Settings Editor

- Use when: any surface where users need to view + change configuration — app preferences, OS settings, account/profile, document properties, product configurator.
- What it is: a findable, self-contained page (or window) with settings grouped into named pages/tabs; random-access, not sequential.
- Why it works: settings are looked up *and* edited; users come back repeatedly and need to find the same control twice. Conventions (top-right, gear icon) are deeply learned — break at your peril.
- How to apply:
  - Findable: follow platform convention (top-right avatar menu on web; Settings app on mobile; menu bar on desktop).
  - Group settings into named pages whose titles let users guess contents; card-sort with real users to validate.
  - Present groups via tabs, Two-Panel Selector, or One-Window Drilldown with a top-page menu.
  - Show current values at a glance — this is a viewing surface as much as an editing one.
  - Decide one save model: immediate-apply (OS-style) or explicit Save/Cancel (web-style). Follow platform convention.
  - For huge spaces: top-page shortcut list to most-used items + search box.
- Signals present (in code/spec): a `/settings` (or `/account`, `/preferences`) route with a left rail or tab strip of categories; gear/avatar entry from global nav; each category is its own subroute with a form.
- Signals missing (red flag): settings scattered across multiple unrelated screens; no single "settings" entry point; settings only reachable from inside the feature they configure; mobile app with no Settings screen at all.
- Anti-patterns / mis-applications: deep 4-level hierarchy with no search; settings that auto-save silently with no confirmation OR save button you must hunt for; "advanced" tab hiding things 80% of users need; mixing destructive actions (delete account) with cosmetic ones (theme).
- Related: [[03-navigation#Menu Page]], [[07-lists#Two-Panel Selector or Split View]], [[10-forms]]

### Alternative Views

- Use when: one design can't serve all usage scenarios for the same content — print vs screen, map vs list, structural-edit vs preview, dense vs sparse.
- What it is: a switch between two or more substantially different visual presentations of the same underlying content.
- Why it works: lets a single dataset be inspected through different lenses without forking the data model or building two apps.
- How to apply:
  - Identify the small set of scenarios the default can't serve; design a view for each.
  - Keep the core content identical across views; add/remove only chrome and density.
  - Put a clearly-iconed view switch on the main surface (often a small icon group; lower corner acceptable).
  - Preserve state across switches: selection, scroll position, undo stack, uncommitted edits.
  - Remember user's last-chosen view (cookie / local storage / per-user pref).
  - Common pair: map view + list view of the same search results, with optional side-by-side on large screens.
- Signals present (in code/spec): a `view` query param or local store flag (`map`/`list`, `outline`/`canvas`, `edit`/`preview`); a toggle component near the content; state shared via context/store across views.
- Signals missing (red flag): two-view feature implemented as two separate routes with no shared state; user loses selection or scroll on switching; print outputs the screen layout verbatim.
- Anti-patterns / mis-applications: switching views resets filters/selection; default view chosen by engineer convenience, not user task; "compact mode" hiding actions instead of just chrome.
- Related: [[07-lists]], [[09-complex-data]]

### Many Workspaces

- Use when: the user works across multiple files/projects/contexts at once and needs to compare, monitor, or multitask — editors, browsers, IDEs, social-media managers.
- What it is: a UI that lets a user have multiple parallel workspaces open — tabs, panels, split-windows, or separate OS windows.
- Why it works: supports real human multitasking, side-by-side comparison, and Prospective Memory (leaving a window open as a self-reminder). Aligns with [[01-foundations-cognition#P-01. Safe Exploration]] — a new workspace costs nothing.
- How to apply:
  - Pick a workspace primitive: tabs (lightweight), columns/panels (always-visible), split-window (resizeable), separate OS windows (heaviest).
  - For simple text/list content, split panels work; for complex content (editors, full pages), tabs/windows.
  - Persist workspace set across restart (Chrome-style "reopen all tabs").
  - Allow side-by-side comparison (split view) and easy switching (cmd-tab analog).
- Signals present (in code/spec): tab strip with reorderable tabs; split-pane component; window manager state persisted to disk; route supports multiple parallel instances (e.g. `/doc/:id` openable in multiple tabs without state collision).
- Signals missing (red flag): an editor or IDE that only opens one file at a time; comparing two records requires manual copy-paste; closing the app loses tab set.
- Anti-patterns / mis-applications: tabs that don't survive reload; tabs that share state and overwrite each other; "multiple windows" implemented as iframes that confuse browser back-button; unlimited tabs with no overflow handling.
- Related: [[01-foundations-cognition#P-01. Safe Exploration]], [[01-foundations-cognition#P-04. Changes in Midstream]]

### Help Systems

- Use when: every well-designed surface — labels and prompts are mandatory; richer help is needed when tasks are non-obvious, novel, or expert-targeted.
- What it is: a layered set of help techniques (inline copy, tooltips, full docs, guided tours, knowledge base, community) deployed in proportion to task complexity.
- Why it works: users span novice→expert with different needs; layered help reaches each without forcing one approach on all.
- How to apply:
  - Inline (mandatory): meaningful headings, on-screen instructions, form labels, Input Hints / Input Prompt ([[10-forms]]).
  - Tooltips: brief one- or two-line descriptions for icon-only or non-obvious controls; 1-2s hover delay; mobile = tap-to-show.
  - Hover Tools ([[08-actions]]) for slightly longer descriptions.
  - Longer help: Collapsible Panels for inline expansion.
  - Full help system: separate window/site with manual, glossary, FAQs, how-tos, videos.
  - Guided tours: lightbox/popover step-by-step overlays for onboarding or "show me how".
  - Knowledge base: Q&A database open to customers, with "submit a question" path.
  - Online community: forum or social group for power users (only worth the cost for heavily-used products).
- Signals present (in code/spec): every form field has a `label` + optional `hint`; icon-only buttons have `aria-label`/`title`; a `Help` route or external docs link in global nav; tour library (Userlane/Pendo/in-house) wired to first-launch events.
- Signals missing (red flag): icon-only toolbar with no tooltips; form labels missing or vague; new-user has no path other than poke-and-pray; FAQs are a static PDF with no search.
- Anti-patterns / mis-applications: tooltip appears instantly on hover and blocks the control underneath; tour cannot be dismissed/replayed; help link opens a wiki edit page; "knowledge base" is one outdated FAQ from 2019.
- Related: [[10-forms]], [[08-actions]], [[01-foundations-cognition#P-02. Instant Gratification]]

### Tags

- Use when: surface has a large body of content (news, posts, articles, threads) and you want user- or editor-supplied topic facets for browsing, search, and sharing.
- What it is: descriptive keyword labels attached to content items, displayed as clickable links that lead to a feed of co-tagged items.
- Why it works: crowdsources an organisation scheme that would be too expensive to maintain top-down; investing users (taggers) become more engaged; hashtag conventions enable viral discovery across surfaces.
- How to apply:
  - Allow tags on each content item (author-added, reader-added, or both).
  - Render tags as visually distinct links (chips, hashtag prefix, round-cornered rectangles).
  - Selecting a tag generates a search/filter results page of all co-tagged items.
  - Show "related tags" on results pages to extend discovery.
  - Provide a tag index/cloud sorted by popularity or recency.
  - Search must index tag content first-class.
- Signals present (in code/spec): a `tags` array on the content model; `/tag/:slug` route returning a feed; tag chips rendered on cards and detail; tag autocomplete on the post editor.
- Signals missing (red flag): rich content (forum posts, articles) has only a flat category dropdown; no way for users to discover related content; search ignores manually-added topic labels.
- Anti-patterns / mis-applications: tag input free-form with no autocomplete, leading to "javascript" / "JavaScript" / "js" fragmentation; tag clouds that font-size tags so small popular ones can't be clicked; tag pages that don't show what the tag means.
- Related: [[07-lists]], [[03-navigation#Deep Links]]
