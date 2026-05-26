---
title: Patterns — flat alphabetical catalog of 81 UI patterns
purpose: Single canonical reference for every named interaction pattern, with tags, signals, and anti-patterns
---

# Interaction Patterns

Flat alphabetical catalog of 81 named UI patterns. Each entry pairs a usage signal with foundation gates and anti-pattern checks. Source: Jenifer Tidwell et al, *Designing Interfaces* (3rd ed., 2020), chapters 2-10.

For cognition/visual/system principles see [[principles]]. For surface playbooks see [[surfaces]]. For workflow recipes see [[workflows]].

## Index

- [[#Accordion]]
- [[#Action Panel]]
- [[#Alpha/Numeric Scroller]]
- [[#Alternative Views]]
- [[#Animated Transition]]
- [[#Annotated Scroll Bar]]
- [[#Autocompletion]]
- [[#Bottom Navigation]]
- [[#Breadcrumbs]]
- [[#Button Groups]]
- [[#Cancelability]]
- [[#Canvas Plus Palette]]
- [[#Cards]]
- [[#Carousel]]
- [[#Center Stage]]
- [[#Clear Entry Points]]
- [[#Collapsible Panels]]
- [[#Collections and Cards]]
- [[#Command History]]
- [[#Dashboard]]
- [[#Data Brushing]]
- [[#Data Spotlight]]
- [[#Datatips]]
- [[#Deep Links]]
- [[#Drop-down Chooser]]
- [[#Dynamic Queries]]
- [[#Error Messages]]
- [[#Escape Hatch]]
- [[#Fat Menus]]
- [[#Feature, Search, and Browse]]
- [[#Fill-in-the-Blanks]]
- [[#Filmstrip]]
- [[#Forgiving Format]]
- [[#Generous Borders]]
- [[#Good Defaults and Smart Prefills]]
- [[#Grid of Equals]]
- [[#Help Systems]]
- [[#Hover or Pop-Up Tools]]
- [[#Infinite List]]
- [[#Input Hints]]
- [[#Input Prompt]]
- [[#Jump to Item]]
- [[#List Builder]]
- [[#List Inlay]]
- [[#Loading or Progress Indicators]]
- [[#Macros]]
- [[#Make It Mobile]]
- [[#Many Workspaces]]
- [[#Media Browser]]
- [[#Menu Page]]
- [[#Mobile Direct Access]]
- [[#Modal Panel]]
- [[#Module Tabs]]
- [[#Movable Panels]]
- [[#Multi-Y Graph]]
- [[#Multilevel Undo]]
- [[#New-Item Row]]
- [[#One-Window Drilldown]]
- [[#Pagination]]
- [[#Password Strength Meter]]
- [[#Preview]]
- [[#Progress Indicator]]
- [[#Prominent "Done" Button or Assumed Next Step]]
- [[#Pyramid]]
- [[#Richly Connected Apps]]
- [[#Settings Editor]]
- [[#Sign-In Tools]]
- [[#Sitemap Footer]]
- [[#Small Multiples]]
- [[#Smart Menu Items]]
- [[#Spinners and Loading Indicators]]
- [[#Streams and Feeds]]
- [[#Structured Format]]
- [[#Tags]]
- [[#Thumbnail Grid]]
- [[#Titled Sections]]
- [[#Touch Tools]]
- [[#Two-Panel Selector or Split View]]
- [[#Vertical Stack]]
- [[#Visual Framework]]
- [[#Wizard]]

---

### Accordion

`tags: surface=[settings,data], platform=any, foundations=[P-09,V-01], source=ch.4`

- Use when: a screen has multiple modules of varying height and the user might want to open more than one at once and preserve their order.
- What it is: a vertical stack of titled panels, each independently expandable/collapsible inline.
- Why it works: keeps the linear order of modules while letting users manage their own view; preserves spatial memory across sessions; better than tabs when modules vary widely in height.
- How to apply:
  - Give each section a concise title that previews the content.
  - Use a chevron or rotating triangle to indicate expandable affordance.
  - Allow more than one section open at a time unless there's a clear reason otherwise.
  - Persist open/closed state across sessions for tool palettes and signed-in apps.
  - Watch for tall expansions pushing later titles off-screen - pick a different pattern if it gets unmanageable.
- Signals present (in code/spec): `Accordion` / `AccordionItem` components; each item has its own `expanded` state; chevron rotates on toggle; multi-expand supported.
- Signals missing (red flag): FAQ page rendered as a wall of Q+A text; navigation menu with deeply nested children flattened into one long list; settings page with very tall, very heterogeneous sections all visible.
- Anti-patterns / mis-applications: forcing single-expand when users want to compare; collapsing every section on revisit instead of remembering state; using accordion for content that should stay visible (e.g., a critical warning); nested accordions more than one level deep.
- Related: [[#Module Tabs]], [[#Collapsible Panels]], [[#Titled Sections]], [[principles#P-09. Spatial Memory]]

### Action Panel

`tags: surface=[do,make], platform=any, foundations=[P-03,V-01], source=ch.8`

- Use when: a surface has too many possible actions for hover/per-item tools and too many or too non-linear for a menu bar; actions need to be highly visible and discoverable.
- What it is: a panel - often beside or beneath the target - that displays grouped actions as a free-form, structured menu always rendered on the main UI.
- Why it works: full visibility removes the discovery cost of hidden menus; free-form layout lets you organise actions by task instead of forcing a linear list; can change contents based on selection/state.
- How to apply:
  - Place beside or beneath the target object; proximity makes the link.
  - Structure actions however the task demands: simple list, multicolumn, categorised headings, tables, trees, or a mix.
  - Choose label style - text, icons, or both - based on what conveys the action best; longer labels are OK for occasional users.
  - Let the panel be dynamic - show different actions in different contexts.
  - If closable, make reopening trivial; never hide actions that exist only there.
- Signals present (in code/spec): a persistent side panel or drawer component that reads selection state and renders contextual action lists; route-level shells that always render an action sidebar.
- Signals missing (red flag): hard-to-find actions stuffed into a kebab menu on a surface with screen space to spare; new users unable to discover what the screen can do.
- Anti-patterns / mis-applications: Action Panel on small mobile screens where it crowds out content; static panel that never reflects what's selected (forces a hunt every time).
- Related: [[#Button Groups]], [[#Movable Panels]], [[#Center Stage]]

### Alpha/Numeric Scroller

`tags: surface=[data], platform=mobile, foundations=[P-08,P-12], source=ch.7`

- Use when: very long alphabetised or date-indexed list inside a scrolled area, and users need to jump to a known letter or date.
- What it is: the alphabet (or numeric/date range) is displayed along the scroll bar/edge; tapping a letter scrolls the list to that section.
- Why it works: acts as an interactive map to list content - same idea as a dictionary's thumb tabs.
- How to apply:
  - Render the alphabet (or date range) vertically along one edge of the scrolled list.
  - On click/tap, scroll the list to that letter's section.
  - Provide visual feedback on the active letter while dragging.
- Signals present (in code/spec): a sidebar of letter buttons next to a `UITableView` / `LazyVStack`; the iOS Contacts-style index strip.
- Signals missing (red flag): long contacts or city list with only a free-text search; no quick way to land on the "M"s.
- Anti-patterns / mis-applications: alpha scroller on a list that is not actually sorted alphabetically; tiny letter targets that fingertips can't hit.
- Related: [[#Jump to Item]], [[#Annotated Scroll Bar]]

### Alternative Views

`tags: surface=[overview,focus,data], platform=any, foundations=[P-04,P-09], source=ch.2`

- Use when: one design can't serve all usage scenarios for the same content - print vs screen, map vs list, structural-edit vs preview, dense vs sparse.
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
- Related: [[#Deep Links]], [[#Dynamic Queries]]

### Animated Transition

`tags: surface=[overview,focus,mobile-overlay], platform=any, foundations=[P-09,V-01], source=ch.3`

- Use when: transitioning between states that would otherwise feel jarring - zooming, pan, opening/closing panels, route changes, modal mount/unmount, mobile gestures, dock/launch effects.
- What it is: short, purposeful motion that connects two visual states so the eye can track the change.
- Why it works: physical-world transitions are continuous; abrupt jumps disrupt spatial memory and disorient. Animation gives eyes a track; communicates feedback (input received) and hierarchy (where things came from / went to).
- How to apply:
  - Animate state changes that would otherwise dislocate: open/close panels, route transitions, zoom, accordion expand/collapse, list reorder, modal in/out.
  - Keep durations short (typically 150-300ms); easings should feel natural (ease-out for entry, ease-in for exit).
  - Use animation to *show where things came from*: dock magnification on hover, window-minimise-to-icon.
  - Respect `prefers-reduced-motion` and provide an "off" path.
  - Don't animate just to animate - motion has cost (attention, battery, accessibility).
- Signals present (in code/spec): use of motion library (`framer-motion`, `react-spring`, native `Animated`, CSS transitions); shared element transitions across routes; `prefers-reduced-motion` honoured in tokens.
- Signals missing (red flag): modals snap in/out; route changes are instant white-flash; list reorder jumps without animation, losing user's place; zoom is a hard scale change.
- Anti-patterns / mis-applications: transitions so long users wait on them (400ms+ on every click); animated chrome over performance-critical surfaces (typing latency); ignoring `prefers-reduced-motion`; bounces and overshoots on every interaction so the app feels twitchy.
- Related: [[principles#P-09. Spatial Memory]], [[#Modal Panel]]

### Annotated Scroll Bar

`tags: surface=[data,focus], platform=any, foundations=[P-12,V-01], source=ch.3`

- Use when: long document or data-centric surface where the user scrolls quickly looking for specific items - page numbers, headings, search results, diff regions, alerts.
- What it is: a scroll bar augmented with position-aware indicators - either tooltips that change with scroll position, or static marks in the scroll track.
- Why it works: puts signposts exactly where the user's eyes are during scroll; functions as a 1-D Overview Plus Detail map.
- How to apply:
  - Dynamic indicator: tooltip on the scroll thumb showing nearest section/page/heading, updating as the user drags.
  - Static indicator: coloured marks in the scroll track for diff regions, search matches, errors, comments.
  - Make purpose unambiguous - random colours in a track will baffle users.
  - Tie to current task: if user is searching, show search hits; if comparing files, show diffs; if reading code, show function/symbol.
- Signals present (in code/spec): custom scrollbar/minimap component; on long routes there's a `Minimap` / `ScrollAnnotations` with marks for search hits / diff / cursor position; Find (Cmd-F) decorates scroll track.
- Signals missing (red flag): users scroll through a 500-row table or 50-page doc with no way to find a specific row/page short of reading; in-page search highlights matches in the body but not in the scroll bar.
- Anti-patterns / mis-applications: scroll annotations so dense they obscure the thumb itself; tooltip that lags 500ms behind scroll position; static marks that aren't keyboard-navigable.
- Related: [[#Alpha/Numeric Scroller]], [[#Datatips]]

### Autocompletion

`tags: surface=[form,entry], platform=any, foundations=[P-11,P-03], source=ch.10`

- Use when: the user types something predictable - URLs, email addresses, names, stock symbols, search terms, file paths, code - and there's a known set of likely values (user history, popular queries, dictionary, content corpus).
- What it is: as the user types, the UI surfaces likely completions (drop-down list, inline ghost text, tab-completion) that the user can accept with one keystroke / tap.
- Why it works: cuts typing effort, reduces typo / memory errors, and works as a soft map of valid values. Especially valuable on mobile, where typing is expensive.
- How to apply:
  - Source the suggestions: user history, common-phrase dictionary, content corpus (for site search), contacts, popular queries - pick what fits.
  - Two interaction styles: (a) explicit completions list shown below the field, picked with arrow keys / tap; (b) inline ghost-text completion accepted with Tab / right-arrow / swipe.
  - Default to *not* accepting the completion - the user must opt in (key press or tap). Never auto-commit.
  - Allow straight-through typing: if the user keeps typing past the suggestion, treat their text as authoritative.
  - Stop offering a suggestion the user has rejected repeatedly in the same session.
  - Highlight the matched substring in each suggestion.
  - Debounce server requests for remote suggestions; cap list length.
- Signals present (in code/spec): `<Combobox>` / `<Autocomplete>` component with async suggestion fetcher; `aria-autocomplete="list"` / `"inline"`; search field with debounced query and dropdown of results.
- Signals missing (red flag): search field with no suggestions on a corpus where the user is guessing at exact terms; email composer with no contact completion; "username" field that lets the user type a duplicate and only fails on submit.
- Anti-patterns / mis-applications: auto-committing the top suggestion when the user blurs (silently changes their input); suggestions that block typing (keystrokes lost while the dropdown is rendering); offensive / wrong popular-search suggestions surfaced without guardrails; suggestions hide the next field on mobile.
- Related: [[#Input Prompt]], [[#Forgiving Format]], [[#Good Defaults and Smart Prefills]], [[principles#P-11. Streamlined Repetition]]

### Bottom Navigation

`tags: surface=[mobile-overlay], platform=mobile, foundations=[P-07,P-08], source=ch.6`

- Use when: a mobile site or app needs global navigation links but the front screen's primary job is content, not navigation.
- What it is: a row of nav links anchored to the bottom of the screen (footer-style for web; persistent tab bar for native).
- Why it works: keeps the top of the screen for content and brand; bottom-of-screen links are thumb-reachable; users can scroll to them on a long screen without losing context.
- How to apply:
  - Stretch nav items across the full width with comfortable height for thumb tapping.
  - Keep the count small - only the most important destinations.
  - Make labels large, readable, and high-contrast.
  - For native apps, use the platform tab bar conventions (icons + labels, current-tab indicator).
- Signals present (in code/spec): `BottomTabBar` / `TabBar` / `BottomNavigation` component; route tree organized around 3-5 top-level tabs; sticky-positioned footer nav on mobile web.
- Signals missing (red flag): top of mobile screen filled by 6+ nav links pushing content below the fold; users have to scroll to the top to switch sections in a long content app.
- Anti-patterns / mis-applications: cramming 6+ tabs into the bottom bar (each tap target shrinks below the 44pt/48dp floor); icon-only tabs with no labels; bottom nav that hides on scroll and is hard to recover; duplicating top-bar nav at the bottom.
- Related: [[#Vertical Stack]], [[#Generous Borders]], [[#Filmstrip]]

### Breadcrumbs

`tags: surface=[overview,data], platform=any, foundations=[P-09,P-03], source=ch.3`

- Use when: surface has a hierarchical content structure 2+ levels deep, and users arrive at deep pages via search, filters, deep links, or drilling - need a "you are here" + a way out.
- What it is: a horizontal line of parent-link-arrow-link-arrow-current showing the path from root to the current page.
- Why it works: tells users where they are *relative to the rest of the site*, not just how they got here; lets them ascend any level in one click; supports comparison shopping by jumping to sibling category.
- How to apply:
  - Render on pages below the top level; place near the top of the content area.
  - Use page titles as labels; separator can be `>`, `/`, or right-pointing arrow.
  - Each ancestor is a link to that level; current page is styled differently (not a link).
  - In tools (Chrome DevTools-style), can also represent in-document hierarchy, not just URL path.
- Signals present (in code/spec): a `Breadcrumbs` component bound to the route ancestor chain; visible on detail/sub-routes; ancestor labels are clickable.
- Signals missing (red flag): deep ecommerce category page with no breadcrumb (so user must use browser back); search results land users on detail pages with no context of category; wiki/doc pages show only the leaf title.
- Anti-patterns / mis-applications: breadcrumbs that show the user's actual click trail instead of the hierarchy (confuses on re-entry); current page is a link to itself; breadcrumb truncated with ellipsis so middle ancestors are unreachable; breadcrumb separators that look like dividers between unrelated nav items.
- Related: [[#Progress Indicator]], [[#Feature, Search, and Browse]]

### Button Groups

`tags: surface=[do,make,form], platform=any, foundations=[V-01,P-03], source=ch.8`

- Use when: there are many always-visible actions on a surface and some of them are semantically related; you need to organise them so the layout doesn't read as chaos.
- What it is: a small cluster of buttons aligned and visually styled the same way, sharing scope (app-wide, per-item, per-document, etc.).
- Why it works: Gestalt proximity and similarity announce "these belong together"; uniform sizing creates a composite shape via closure; primary action standing out provides hierarchy.
- How to apply:
  - Group only buttons that share scope and verb-family; separate buttons with different scope.
  - Match graphic treatment: border, color, height, icon style, hover behaviour.
  - Use short unambiguous verbs / verb phrases.
  - Place groups adjacent to their target object (left, right, or above - bottom blind spots are real).
  - Promote a single primary action with a stronger graphic treatment.
- Signals present (in code/spec): a `ButtonGroup` / `HStack` component containing buttons with shared styling; toolbars structured as labelled segments separated by dividers.
- Signals missing (red flag): a flat row of styled-differently buttons jumbled together; no visible primary action on a surface that has an obvious next step.
- Anti-patterns / mis-applications: mixing app-level and item-level actions in the same group; treating every button as a primary with a saturated color (nothing stands out).
- Related: [[#Prominent "Done" Button or Assumed Next Step]], [[#Visual Framework]]

### Cancelability

`tags: surface=[do,make], platform=any, foundations=[P-01,P-04], source=ch.8`

- Use when: any operation longer than ~2 seconds (print, query, file load, network request) or any modal state that locks the user out of other actions.
- What it is: a way to instantly abort the in-progress operation with no side effects.
- Why it works: supports user control and freedom; enables Safe Exploration; lets users abandon a clearly doomed operation (unreachable URL) without waiting it out.
- How to apply:
  - First, see if the operation can be made *fast enough* that cancel isn't needed.
  - Otherwise, place a Cancel/Stop button next to the loading indicator, with a recognisable icon (red X / stop sign).
  - On click, abort immediately - within 1-2 seconds - and visibly confirm the cancel (halt the indicator, show a status message).
  - For multiple parallel operations, give each its own Cancel control and label it with what it cancels.
- Signals present (in code/spec): `AbortController` / `CancellationToken` wired into long-running fetches; Cancel button rendered alongside every loading state.
- Signals missing (red flag): modal "Loading..." dialogs with no Cancel; long downloads that the user can't stop without killing the app.
- Anti-patterns / mis-applications: a Cancel button that takes 10+ seconds to actually stop the operation; a Cancel that leaves partial side effects (half-written files, partial database commits).
- Related: [[#Spinners and Loading Indicators]], [[principles#P-01. Safe Exploration]]

### Canvas Plus Palette

`tags: surface=[make], platform=desktop, foundations=[P-06,P-12,V-01], source=ch.2`

- Use when: building any graphical editor where users create and arrange objects on a virtual space (image/vector/wireframe/3D/slide).
- What it is: a large empty central canvas surrounded by palettes of tool icons (and property/colour/layer panels at the sides).
- Why it works: maps directly to the familiar physical workbench; icon palettes leverage cross-app recognition (brush, hand, magnifier).
- How to apply:
  - Large central canvas, framed by palettes on edges (left/top primary, right/bottom for properties).
  - Palette = grid of iconic buttons; labels optional when icons are recognisable, required when not.
  - Group palette into subgroups via Module Tabs or Collapsible Panels.
  - Decide one consistent gesture per tool (drag-drop OR click-canvas) and stick to it; usability-test heavily - tool behaviour isn't self-evident.
  - Most palette buttons create the pictured object; reserve a few for modes (zoom, select, lasso).
- Signals present (in code/spec): an `Editor`/`Canvas` component with sibling `Palette` / `Toolbar` / `PropertiesPanel` / `LayersPanel`; tool state lives in a global editor store; cursor mode changes per selected tool.
- Signals missing (red flag): editor crams tools into a single linear menu; no central blank space; tools change behaviour per-mode without communicating it.
- Anti-patterns / mis-applications: icon-only palette with no tooltips so every tool is a guess; canvas that resizes with palette open/close (loses user's spatial position); two contradictory gestures for the same tool depending on selection state.
- Related: [[#Module Tabs]], [[#Center Stage]], [[principles#P-12. Keyboard Only]]

### Cards

`tags: surface=[data,overview], platform=any, foundations=[V-01,P-03], source=ch.7`

- Use when: a list of heterogeneous items where each item carries a consistent bundle of image + text + a small set of actions (favorite, share, open detail).
- What it is: self-contained UI tiles - image, title, body, optional actions - laid out in a responsive grid or stream.
- Why it works: recognisable convention (web/mobile); accommodates variable content lengths and aspect ratios; gives no one item more visual weight than another.
- How to apply:
  - Identify the common shape: image, title, body, rating, actions.
  - Mock the longest and shortest content variants; tune the layout so both read well.
  - Decide which actions are icons vs text links inside the card.
  - Pick a portrait or landscape orientation based on the actual photography.
- Signals present (in code/spec): a reusable `Card` component (`Card.Image`, `Card.Title`, `Card.Actions`) consumed across multiple lists; responsive CSS grid / `LazyVGrid`.
- Signals missing (red flag): lists of mixed-content items implemented as ad-hoc rows; long items dominate the page because no card primitive normalises their size.
- Anti-patterns / mis-applications: cards used where items have no commonality (pretending uniformity); over-densely packed cards that lose the breathing room that defines the pattern.
- Related: [[#Thumbnail Grid]], [[#Grid of Equals]]

### Carousel

`tags: surface=[data,overview], platform=any, foundations=[P-08,V-01], source=ch.7`

- Use when: a flat list of visually interesting items that the user will casually browse (not search), and vertical space is tight.
- What it is: a horizontal strip or arc of thumbnails the user scrolls/swipes; often with a focused central item.
- Why it works: encourages browsing and serendipity; compact vertically; "focus plus context" when the centre item is enlarged.
- How to apply:
  - Build uniform thumbnails (stricter than Thumbnail Grid).
  - Show fewer than 10 at a time; hide the rest on either side.
  - Provide large prev/next arrows; animate transitions.
  - Add a scrollbar for long lists; consider enlarging the centre item.
- Signals present (in code/spec): a horizontal scroll view with paged snapping; explicit prev/next controls; possibly a `featured` index in state.
- Signals missing (red flag): long horizontal list of small items with no visible prev/next affordance; users on desktop have no way to swipe.
- Anti-patterns / mis-applications: Carousel used for items the user needs to search or compare; auto-advancing hero carousels that move before the user finishes reading.
- Related: [[#Thumbnail Grid]], [[#Filmstrip]]

### Center Stage

`tags: surface=[focus,make,overview], platform=any, foundations=[V-01,P-03], source=ch.4`

- Use when: the screen's primary job is one document, one task, or one piece of content; secondary tools and metadata are decoration around it.
- What it is: a layout that gives the dominant content the largest region of the screen, with smaller side/top panels for tools and supporting content.
- Why it works: an unambiguous focal anchor tells the user what the screen is for in one glance; the periphery is interpreted relative to the center rather than competing with it.
- How to apply:
  - Make the center region at least twice as wide as side margins and twice as tall as top/bottom margins on first paint.
  - Keep the center region above the fold on the smallest target viewport.
  - Reserve big headlines for the top of the center stage to pull the eye in.
  - Use platform genre conventions for what goes in margins (toolbars on top of an editor, nav on the left of a content site).
  - Don't worry about exact position - make it large enough that it's clearly central.
- Signals present (in code/spec): a single dominant route component (canvas, document, map, article) takes most viewport width; toolbars/panels are narrow strips around it; route name maps to one primary object.
- Signals missing (red flag): screen built for a single task but split into 3+ equal columns; primary canvas pushed below the fold by promo banners; multiple competing focal points.
- Anti-patterns / mis-applications: stretching a list/index page into center stage when it's really a Grid of Equals; surrounding the stage with so many tool panels that the center shrinks below its 2x ratio; placing ads in the largest slot.
- Related: [[principles#P-03. Satisficing]], [[#Collapsible Panels]], [[#Movable Panels]]

### Clear Entry Points

`tags: surface=[entry,overview], platform=any, foundations=[P-02,P-03,V-01], source=ch.3`

- Use when: surface gets many first-time or infrequent users who need direction on what to do first; a small set of tasks covers most arrivals.
- What it is: a small number (1-3) of large, plainly-labelled "front doors" that dominate the landing surface, with other navigation visually demoted.
- Why it works: removes "OK, now what?" paralysis; gives a confused user one obvious next step. Supports Instant Gratification.
- How to apply:
  - List the top tasks new users want; cover most of them in 1-3 entry points.
  - Use plain task-language, never product/tool jargon.
  - Make the entry points visually proportional to their importance (big, well-spaced, high-contrast).
  - Demote global nav, utility nav, etc. - they're hallways, not front doors.
  - On app launch, a startup dialog with a few labelled actions counts (e.g., New / Open / Recent).
- Signals present (in code/spec): landing route has 1-3 large CTAs above the fold; secondary nav is smaller; copy uses verbs.
- Signals missing (red flag): home/launch screen is a wall of equal-weight tiles, a hero carousel with no CTA, or a chrome shell that defers to global nav for the next click.
- Anti-patterns / mis-applications: 6+ CTAs labelled "Learn more" with no differentiation; entry point that opens a modal that opens a modal; expert app with required entry-point modal that experts must dismiss every launch.
- Related: [[#Mobile Direct Access]], [[principles#P-02. Instant Gratification]]

### Collapsible Panels

`tags: surface=[make,focus,settings], platform=any, foundations=[P-09,V-01], source=ch.4`

- Use when: a screen has a primary Center Stage and one or more side/supporting panels whose value varies per user or per session.
- What it is: individual panels that the user can hide or show, returning the freed space to the main content.
- Why it works: progressive disclosure of optional context; lets each user shape the workspace to their task; preserves the primacy of the central content when peripheral panels aren't needed.
- How to apply:
  - Each panel toggles independently via a single click on a clearly affordant control (chevron, panel icon).
  - When a panel collapses, give its space back to the main content (or whitespace) - don't leave dead margins.
  - Animate open/close to anchor the user's spatial model.
  - Decide a sensible default (open or closed) per panel; flip the default if telemetry shows most users open a closed one.
- Signals present (in code/spec): sidebar/aside components with their own `visible`/`collapsed` state; layout uses flex/grid where the main content reflows when the panel hides; toggle button on the panel edge or in the main toolbar.
- Signals missing (red flag): supporting tools forced into a modal because there was nowhere to dock them; sidebar always visible even when it competes with the central task; users complain about cramped main area on small screens.
- Anti-patterns / mis-applications: collapse buttons hidden inside menus rather than directly on the panel; the panel collapses but reserves its grid column so the main content doesn't reflow; multiple peer panels treated as Collapsible Panels when they should be grouped in Module Tabs or an Accordion (implying relatedness).
- Related: [[#Center Stage]], [[#Movable Panels]], [[#Accordion]], [[#Module Tabs]]

### Collections and Cards

`tags: surface=[data,mobile-overlay], platform=mobile, foundations=[P-03,V-01], source=ch.6`

- Use when: showing lists of articles, videos, products, blog entries, or any complex items that benefit from a thumbnail or image preview.
- What it is: list items rendered with a thumbnail (collections) or full-content card (cards) per item, stacked vertically.
- Why it works: images aid scanning, identification, and visual differentiation; generous item height accommodates touch targets; cards feel finished and inviting compared to text-only lists.
- How to apply:
  - Place thumbnail on the left, text on the right (most common pattern).
  - Use bright/saturated colors - small screens carry strong color well.
  - Add secondary visual markers (ratings, badges, avatars) where they help scanning.
  - Make the whole row/card tappable, not just the title.
  - For cards (vs. collections), include richer in-card actions, summaries, and metadata.
- Signals present (in code/spec): a `Card` / `ListItem` component used inside a `FlatList` / `RecyclerView` / `.map()`; consistent `aspect-ratio` on thumbnails; entire item wrapped in a single `Pressable`/`Link`.
- Signals missing (red flag): mobile feed shown as text-only headlines; items missing thumbnails where the source data has them; only the title is tappable, the rest of the row inert.
- Anti-patterns / mis-applications: cards so tall only one fits on screen, killing scanability; mixing heterogeneous item types into one feed with inconsistent card shapes; placeholder gray boxes shipped to production instead of real thumbnails.
- Related: [[#Grid of Equals]], [[#Vertical Stack]], [[#Infinite List]]

### Command History

`tags: surface=[make,do], platform=desktop, foundations=[P-10,P-11], source=ch.8`

- Use when: users perform long sequences of actions in graphical editors, programming environments, or command-line interfaces, and might want to review, repeat, or script what they did.
- What it is: a visible, scrollable record of the user's actions - what was done, to what, in what order.
- Why it works: supports reviewing prior work, repeating older actions, applying a sequence to a new object, audit logging, and converting interactive work into Macros.
- How to apply:
  - Record every undoable command in a chronological list; same granularity rules as Multilevel Undo.
  - Express each action consistently and concisely (text or icon).
  - Persist history across sessions if feasible.
  - Display in an optional panel (history palette); allow search, optional timestamps.
- Signals present (in code/spec): a History sidebar / panel reading from the same action log that powers undo; browser-style history in any app that needs traceability.
- Signals missing (red flag): editor where users can't see what they did 10 minutes ago; CLI with no `history` equivalent.
- Anti-patterns / mis-applications: history that records UI noise (mouse-overs, focus changes); history with no way to act on entries (replay / share / convert to macro).
- Related: [[#Multilevel Undo]], [[#Macros]]

### Dashboard

`tags: surface=[overview,data], platform=any, foundations=[P-08,V-01], source=ch.2`

- Use when: the user needs a continuous, at-a-glance view of incoming information (metrics, alerts, status) and key next-actions - usually the first screen after login.
- What it is: a single information-dense page combining titled sections, charts, lists, and shortcuts to key workflows.
- Why it works: aggregates "what changed" + "what to do" in one scan; matches the at-a-glance newspaper/cockpit mental model.
- How to apply:
  - Pick what to show by user need, not data availability - remove or demote noise.
  - Group with [[#Titled Sections]]; only use tabs when items genuinely don't need side-by-side comparison.
  - Use One-Window Drilldown for "more detail" - click a chart to dive in.
  - Use simple line/bar charts for at-a-glance comparison; avoid 3D/dial/pie unless data demands it.
  - Highlight keywords/numbers within text so eye-scanning works.
  - Try to fit on one screen with little or no scroll.
  - Consider optional Movable Panels for customisation when user roles vary.
- Signals present (in code/spec): a `Dashboard`/`Home` route renders multiple `Card`/`Widget` siblings in a grid; each widget has a title and a "see details" link; default user lands here post-auth.
- Signals missing (red flag): post-login screen is an empty state, a generic profile, or a single chart; user must navigate 2+ levels to find current status; charts have no "drill in" affordance.
- Anti-patterns / mis-applications: cramming every metric the team has ever built; tabs hiding things that should be side-by-side; pie charts comparing 10 categories; live-updating numbers with no timestamp or quiet hours.
- Related: [[#Titled Sections]], [[#Multi-Y Graph]], [[#Small Multiples]]

### Data Brushing

`tags: surface=[data,overview], platform=desktop, foundations=[P-06,P-01], source=ch.9`

- Use when: two or more views render the *same* data set (e.g., map + table, scatter + bar chart, timeline + map), and users would benefit from selecting in one view and seeing the same items light up in the others.
- What it is: linked / coordinated views - selecting (or "brushing") a subset in one graphic immediately highlights those same items in every other graphic with matching visual encoding.
- Why it works: lets the user pick points by whatever is *visually easy* in one view (outliers on a scatter, a region on a map) and then study those exact points under a *different* organizing principle. Coordination reinforces that the views are different perspectives on one data set, surfacing relationships that no single view could.
- How to apply:
  - Define a single selection-state shared across all views (one source of truth).
  - Support multiple selection modes (single click, range drag, marquee, lasso, keyword tap).
  - Brushed items must appear with the *same* preattentive cue (typically a saturated hue) in every linked view.
  - Updates across views must feel simultaneous - sub-frame latency is the target.
  - Don't replace [[#Dynamic Queries]] with brushing alone; brushing is best for visually obvious subsets, filtering for numeric / categorical conditions.
- Signals present (in code/spec): a shared selection store (Redux slice, Zustand store, context) subscribed to by multiple chart/map components; chart `onSelectionChange` handlers that mutate the shared state; consistent `selectedColor` token across views.
- Signals missing (red flag): a dashboard with two views of the same data where clicking a row in the table does nothing to the chart, or hovering a region on the map doesn't affect the list; multi-view screen where each view holds its own filter state.
- Anti-patterns / mis-applications: brushing without visual feedback in the *source* view (user can't see what they selected); brushing that triggers a server roundtrip for each linked view; selections that survive navigation in ways the user can't undo.
- Related: [[#Dynamic Queries]], [[#Data Spotlight]], [[principles#P-01. Safe Exploration]]

### Data Spotlight

`tags: surface=[data,focus], platform=any, foundations=[V-01,P-09], source=ch.9`

- Use when: an info-graphic so dense that connections and slices get visually tangled - many overlapping lines, a packed network, layered map polygons, a chord-chart of relationships.
- What it is: on hover or tap of a slice, brighten/saturate that slice and dim everything else, while leaving the dimmed data visible for context.
- Why it works: implements "focus plus context" - quiets the clutter so the user can trace a single thread without losing the surrounding shape of the data. Quick flicks across slices expose differences (even tiny ones) that static rendering can't.
- How to apply:
  - The graphic must still be coherent without the spotlight (someone may print it).
  - Spotlight transition must be fast and flicker-free; ease the dim, not the highlight.
  - Encode spotlight with saturation/lightness, not just color shift.
  - Add "hot spots" on legends and references - hovering a legend entry triggers the same spotlight.
  - Consider a "spotlight mode" (longer initial hover before turning on) to prevent accidental triggering on incidental mouse drift.
  - On touch, use tap (not long-press) to engage; reserve double-tap or a dedicated control for drill-down.
  - Combine with [[#Datatips]] - spotlight highlights the slice, datatip names the point.
- Signals present (in code/spec): chart code that mutates per-series opacity / fill on hover state; legend rows wired to the same hover handler as the chart marks; CSS transitions on `opacity` for non-focused series.
- Signals missing (red flag): a network graph or multi-line chart where users complain they "can't follow which line is which"; legend-only differentiation in a chart with >5 series; no way to isolate one category without unchecking everything else.
- Anti-patterns / mis-applications: hiding non-focused data entirely (loses context, becomes filtering not spotlighting); spotlight that overrides a primary click intended for drill-down; spotlight on touch surfaces fired on accidental scroll-over.
- Related: [[#Datatips]], [[#Dynamic Queries]], [[principles#P-09. Spatial Memory]]

### Datatips

`tags: surface=[data,focus], platform=any, foundations=[P-01,V-01], source=ch.9`

- Use when: showing an overview of a data set (chart, map, plot) where additional values are "hidden behind" each point and the user can hover/tap to probe.
- What it is: a small temporary tool-tip-like overlay anchored to the cursor / fingertip that surfaces data for the point underneath.
- Why it works: puts the data exactly where the user's eye is already focused, without cluttering the overview with labels for every point. Encourages exploration ("what else is here?") at near-zero interaction cost.
- How to apply:
  - Render as a layered, temporary overlay (not a new screen / modal); auto-position to avoid covering the probed point.
  - Format densely; cap size so it never obscures more graphic than it reveals.
  - Vary contents by context (e.g., different fields per data series).
  - Include drill-down links inside the tip for data not on the overview.
  - Alternative: a static reserved data panel beside the graphic that updates on hover - preserves view, but costs an eye shift.
  - Pair with [[#Data Spotlight]] when the data slice (line, region) also needs to be highlighted.
- Signals present (in code/spec): `onMouseEnter` / `onPointerOver` / `onPress` handlers on chart marks that mount a positioned tooltip component; chart libraries with `tooltip` config (Recharts, Victory, d3-tip, MapboxGL popups, Apple `Annotation`).
- Signals missing (red flag): a data-dense chart or map with no hover/tap response; users must read off axes or guess at point values; multiple overlapping series with no way to tell which is which without a legend round-trip.
- Anti-patterns / mis-applications: tooltip so large it covers the very point being probed; tooltip that flickers / re-mounts on every mouse move; touch-only surface with hover-only tooltips (no tap fallback); tooltip text in computerese instead of the user's labels.
- Related: [[#Data Spotlight]], [[principles#P-01. Safe Exploration]]

### Deep Links

`tags: surface=[overview,focus,entry], platform=any, foundations=[P-10,P-08], source=ch.3`

- Use when: surface has rich, specific, parameterised state (map location + zoom, video timestamp, search-with-filters, multi-tab view) worth saving and sharing.
- What it is: a URL (or app-link) that captures both content position and application state, so loading it restores what the user was seeing.
- Why it works: lets users bookmark or share an exact state; converts ephemeral UI configurations into permanent addressable resources; in mobile, lets URLs route into native apps for richer playback.
- How to apply:
  - Reflect user state in the URL continuously as they navigate/configure.
  - Decide what to capture (position, filters, view mode, search) and what to leave personal (zoom, magnification).
  - Provide an explicit "Link" / "Share" affordance that copies the URL - most users won't think to copy from the address bar.
  - Optionally provide an Embed snippet for sites that allow embedding.
  - Mobile: register universal links (iOS) / app links (Android) so shared URLs open the native app.
- Signals present (in code/spec): query params reflect filter/sort/view state; the back button restores prior state; share button copies current URL; on mobile, `apple-app-site-association` / `assetlinks.json` declares deep-link routes.
- Signals missing (red flag): filters/sort/search live in client state only and reset on reload; sharing a URL drops the user on a blank landing page; mobile share opens browser when an installed app exists.
- Anti-patterns / mis-applications: URL captures so much that loading it overwrites user-pref settings (font, theme); URL stale within minutes because content moved; sensitive state (auth tokens, personal filters) embedded in shareable URL.
- Related: [[#Alternative Views]], [[#Dynamic Queries]]

### Drop-down Chooser

`tags: surface=[form,make], platform=any, foundations=[P-03,V-01], source=ch.10`

- Use when: the user needs to pick a value (color, date, time, number, file, font, brush, location, asset) and a richer UI than a flat list would help - but you can't spare main-canvas space for it.
- What it is: a control that looks like a closed combo box / button in its resting state and expands on click to reveal a complex picker - calendar, color wheel, grid of thumbnails, tree, calculator, slider, file browser.
- Why it works: encapsulates a rich picker in a small footprint; the main surface stays clean and the chooser appears only when invoked. Users already understand the down-arrow disclosure idiom.
- How to apply:
  - Closed state: show the current value plus a down-arrow.
  - Click anywhere on the control (not just the arrow) opens the chooser; click again or click outside closes it.
  - Choose a picker layout that matches the data: list, table, tree, calendar, swatch grid, tabbed panel.
  - For very large source sets (filesystems), allow scrolling but consider a "Browse..." link to a full modal as escape hatch.
  - The chooser can expose recent / favorite picks at the top to short-circuit the full picker.
  - Echo the chosen value back in the closed control immediately on selection.
  - Don't trap focus; pressing Esc closes the chooser without changing value.
- Signals present (in code/spec): Popover / floating-panel components anchored to a button with `aria-haspopup` / `aria-expanded`; custom pickers built on top of `<Popover>` (date picker, color picker, font picker); MUI `<Select>` with custom render.
- Signals missing (red flag): a toolbar with a "Color..." button that opens a full modal dialog for one swatch pick; a date field that's just a free-text input with no calendar affordance; a font picker that requires typing the font name.
- Anti-patterns / mis-applications: chooser that's too small to use (date picker with 8px touch targets); chooser that doesn't close on outside click; closed state that doesn't show the current value (just a generic label); committing on hover instead of click.
- Related: [[#Autocompletion]], [[#Fill-in-the-Blanks]], [[#Escape Hatch]]

### Dynamic Queries

`tags: surface=[data,overview], platform=any, foundations=[P-06,P-12], source=ch.9`

- Use when: showing a large multivariate data set where users need to filter on several attributes at once - price + bedrooms + distance, date + category + region, etc.
- What it is: standard form controls (sliders, checkboxes, range pickers, dropdowns) wired to a data view that updates *immediately* as each control changes.
- Why it works: no query language to learn; controls expose the queryable attributes themselves; immediate visual feedback closes the iteration loop and supports flow-state exploration ("tweak, observe, tweak").
- How to apply:
  - Each control maps to one attribute; choose the control by data type (slider for number range, double-slider for range subset, radio/dropdown for single-pick incl. "All", checkbox for arbitrary subsets, text for precise values).
  - Update the view on every commit (and on drag for sliders if perf allows); debounce keystrokes but not slider thumbs.
  - Show how many results survive the filter at all times (counter, empty-state).
  - Place controls adjacent to the data view, not behind a separate modal.
  - For spatial data, also offer direct "draw a box around the region" selection (compare with [[#Data Brushing]]).
- Signals present (in code/spec): a filter side-panel or filter-bar component bound to derived state (`useMemo` over data + filter state); URL query params encode each filter; result count updates live; sliders backed by a `Range`/`MultiRange` primitive.
- Signals missing (red flag): a list / map view with a "Filter" button that opens a modal, the user fills it out, taps Apply, and only then sees results; filter changes require a "Search" button press; result count not shown.
- Anti-patterns / mis-applications: refetching from the server on every keystroke and stalling the UI; filters that silently reset on navigation; "All" missing as an option (forcing users to check every box); applying filters on form submit instead of immediately.
- Related: [[#Data Brushing]], [[principles#P-06. Incremental Construction]]

### Error Messages

`tags: surface=[form,entry], platform=any, foundations=[P-01,P-03], source=ch.10`

- Use when: a form input is rejected - required field skipped, format unparseable, value out of range, server-side validation failure - and the user needs to fix it.
- What it is: an inline message rendered on the form itself, next to the offending field, naming what's wrong and how to fix it.
- Why it works: keeping the message *next to* the field means the user can read and act simultaneously, with no dismissal-then-memory step. Field-level marking shows at a glance where the problem is.
- How to apply:
  - Validate as early as feasible - on blur (after typing settles), or live for password-strength-style feedback. Never validate only on submit when client-side checks would catch it.
  - Mark every offending field with: color (red), icon (warning), inline message - not color alone (colorblind users).
  - Message structure: name the field, name the problem, suggest the fix. "Email must include an '@'." not "Invalid input."
  - For long forms, also render a top-of-form summary that lists each error with a link to its field (good for screen readers and long scroll forms).
  - Clear the error as soon as the user starts fixing it - but don't fire a *new* error while they're still typing a valid string.
  - Use plain language, not computerese.
  - Be polite; phrase the error as helpful, not accusatory.
  - Prevent errors up front with [[#Input Hints]], [[#Input Prompt]], [[#Forgiving Format]], [[#Autocompletion]], [[#Good Defaults and Smart Prefills]].
- Signals present (in code/spec): form library (`react-hook-form`, `Formik`, native `<Form>`) with field-level error rendering; `aria-invalid` and `aria-describedby` on inputs wired to error messages; blur-triggered validation in field components.
- Signals missing (red flag): validation only on submit; "Invalid input" with no field reference; modal alert that disappears before the user reaches the broken field; entire-form red border with no per-field marking; errors reported only as native browser tooltips.
- Anti-patterns / mis-applications: clearing the form on a validation failure (forces retype); error message that appears mid-typing while the user is still constructing a valid string; throwing a stack trace or HTTP status code at the user; locking the Submit button without explaining which field is invalid; one error at a time (user fixes, submits, sees the next, fixes, submits...).
- Related: [[#Password Strength Meter]], [[#Forgiving Format]], [[#Input Hints]], [[#Cancelability]], [[principles#P-01. Safe Exploration]]

### Escape Hatch

`tags: surface=[overview,entry,mobile-overlay], platform=any, foundations=[P-01,P-04], source=ch.3`

- Use when: a screen has limited navigation (modal, wizard step, OS error, 404, deep-linked page out of context) and the user might want a one-tap return to a known place.
- What it is: a well-labelled button/link that returns the user to a safe known location (home, hub, parent, the main app shell).
- Why it works: prevents trapping users; makes the surface safe to explore (matches Safe Exploration); recovers users from dead-ends rather than losing them.
- How to apply:
  - Every modal, every wizard step, every error/404, every limited-nav screen carries one.
  - Label it plainly ("Cancel", "Back to home", "Go back to LinkedIn.com").
  - Common forms: clickable logo top-left to home; Cancel button in dialog; "Back to X" link with user's avatar on settings detached pages.
  - On 404/500 error pages, link to home + offer search.
- Signals present (in code/spec): every modal has a Close button; every error page has a "back to home" link; logo in header is a Link to `/`.
- Signals missing (red flag): a settings sub-page with no global nav and no "back to app" link; a wizard final step with no Cancel; a 404 page that has no nav at all; "loading" screen that never resolves and has no abort.
- Anti-patterns / mis-applications: Cancel button that requires confirmation to cancel; logo that's an `<img>` not a link; "back" button that does `history.back()` and ends up on the prior site; multiple escape hatches with different destinations on the same screen.
- Related: [[#Modal Panel]], [[principles#P-01. Safe Exploration]], [[principles#P-04. Changes in Midstream]]

### Fat Menus

`tags: surface=[overview,settings], platform=any, foundations=[P-09,V-01], source=ch.3`

- Use when: site has many pages in multiple categories (often 3+ levels deep) and you want to expose most of the structure to casual browsers from any page.
- What it is: a drop-down or fly-out menu rich enough to show dozens of links organised into Titled Sections, often spanning the page horizontally.
- Why it works: makes a multilevel site behave fully-connected - users jump between any two leaves in one click; surfaces complexity progressively (hidden until hover/click) without burying it.
- How to apply:
  - Group links into [[#Titled Sections]] with sensible category names.
  - Spread horizontally; use multiple columns; avoid going taller than the browser viewport.
  - Use whitespace, headers, dividers, modest graphics; blend with site visual style.
  - Verify with screen readers - many fat-menu implementations break a11y; fall back to [[#Sitemap Footer]] when in doubt.
  - On mobile: linearise into stacked vertical sections, or move to a dedicated nav route.
- Signals present (in code/spec): `MegaMenu` / `FatMenu` component; top-level nav items have `subMenu` data with grouped children; hover/click opens a panel spanning header width.
- Signals missing (red flag): big multilevel site with only a thin 5-item top nav; users must drill 3 clicks deep to discover a leaf page; sitemap exists only in robots.txt.
- Anti-patterns / mis-applications: fat menu opens on hover with no delay so it flashes during cursor traverse; menu so tall it overflows the viewport; menu disappears the moment the cursor leaves the trigger word with no slack; keyboard users can't navigate columns.
- Related: [[#Sitemap Footer]], [[#Titled Sections]]

### Feature, Search, and Browse

`tags: surface=[overview,entry], platform=any, foundations=[P-02,P-03,V-01], source=ch.2`

- Use when: site offers long lists of items (articles, products, videos) that users browse and search; you want to engage new visitors immediately with featured content.
- What it is: three co-located elements on the main page - a featured item, a search box, and a browseable list of categories/items.
- Why it works: searchers and browsers are different user types; serving both on one page covers both. Featured content gives a passive arrival a reason to stay.
- How to apply:
  - Place search box in a prominent slot (upper corner or banner-top), demarcated by whitespace/background colour; collapse to icon only when space is tight.
  - Allocate Center Stage to the featured item, near the top.
  - Show a browseable list/grid of categories or items adjacent to the feature; cards or category labels.
  - Use [[#Breadcrumbs]] once the user drills into a category.
  - On task-centric sites (booking, transactional), promote search to dominant; demote feature/browse.
- Signals present (in code/spec): a landing/home route renders three siblings - a `SearchInput`/`SearchBar`, a `Featured`/`Hero` block, and a `CategoryGrid`/`BrowseList`. Faceted filters appear on results route.
- Signals missing (red flag): landing screen has only browse OR only search; first-time visitor sees a chrome shell with no anchor item; search box buried in a menu.
- Anti-patterns / mis-applications: featured slot is a marketing carousel of 5+ items that auto-rotates past attention; search bar collapsed behind an icon on a search-dominant site; category list that looks like a tree but is actually a flat dropdown with hidden subcategories.
- Related: [[#Menu Page]], [[#Breadcrumbs]], [[#Cards]]

### Fill-in-the-Blanks

`tags: surface=[form,make], platform=any, foundations=[P-03,P-12], source=ch.10`

- Use when: a control or set of controls is easier to understand when read as a sentence than as a labeled field - query builders, rule editors, conditional logic, filter conditions, "remind me X days before Y."
- What it is: a natural-language sentence with controls (dropdowns, text fields, combo boxes) embedded inline as the "blanks."
- Why it works: sentences are self-explanatory; users complete them without reading instructions. Inline controls inherit context from the surrounding words, eliminating the cognitive jump from label to value.
- How to apply:
  - Write the sentence first in plain prose; then replace nouns/values with controls.
  - Use inline controls with the same form-factor as words (compact dropdowns, short text fields). Avoid embedding large multi-line inputs mid-sentence.
  - Align text baselines between prose and controls; maintain word spacing.
  - Size controls just wide enough for the expected value.
  - For complex logic, stack multiple fill-in sentences vertically rather than nesting one giant sentence.
  - Plan for i18n: word order changes by language. Either commit to a separate layout per locale or fall back to labeled fields.
- Signals present (in code/spec): inline `<select>` / `<input>` elements within flowing text spans; rule-builder / query-builder components where the rule reads as a sentence; conditional-formatting UIs.
- Signals missing (red flag): a modal full of "Operator: [equals]", "Value: [...]" labels for what is conceptually "show items where price equals X"; complex rule-builder UI that requires a help doc to interpret.
- Anti-patterns / mis-applications: sentence so long it wraps unpredictably and breaks alignment; localizing word-for-word into a language with different syntax and ending up with a non-sentence; using fill-in-the-blanks for simple short fields where a plain label would have done.
- Related: [[#Drop-down Chooser]], [[#Smart Menu Items]]

### Filmstrip

`tags: surface=[mobile-overlay,overview], platform=mobile, foundations=[P-07,P-08], source=ch.6`

- Use when: the app has a small set of conceptually parallel top-level screens (cities in a weather app, sports in a scores app, news categories) and the user is happy to browse rather than jump.
- What it is: full-screen panels the user swipes left/right between; each panel uses the entire screen with no persistent tab strip.
- Why it works: each item gets the whole screen; swiping is a satisfying, low-effort gesture; encourages serendipitous browsing.
- How to apply:
  - Keep the number of top-level screens small - swiping through many panels becomes tedious.
  - Show a dot/page indicator so users discover that more screens exist.
  - Allow tap as well as swipe on the indicator for users who want direct jump.
  - Don't use this when users need direct access to a specific screen by name.
- Signals present (in code/spec): horizontal pager / `PageView` / `ViewPager` / `swiper` component at top-level navigation; page indicator dots component; route state tracks the active page index.
- Signals missing (red flag): app has 8+ peer screens with no obvious selector; new users can't discover swiping is how to switch context (no indicator at all).
- Anti-patterns / mis-applications: hiding important features behind swipe-only access with no affordance; using Filmstrip for non-parallel content (e.g., settings, account, browse - they belong in tabs/menu); pagination across 15+ panels.
- Related: [[#Bottom Navigation]], [[#Collections and Cards]]

### Forgiving Format

`tags: surface=[form,entry], platform=any, foundations=[P-03,P-05], source=ch.10`

- Use when: the field accepts data users might type in many shapes (date, address, phone, credit card, search query, name) and you'd rather make the parser smart than the UI fussy.
- What it is: a single input that accepts a wide range of formats and the software normalizes/disambiguates after entry.
- Why it works: users don't want to think about format; computers can. Removes a whole class of "format error" frustration and keeps the UI visually simple - often eliminates the need for an [[#Input Hints]] or [[#Input Prompt]].
- How to apply:
  - Identify the legitimate variations (whitespace, separators, capitalization, abbreviations, partial values like "7/20" without a year).
  - Implement parsing on commit or blur; *don't* re-format mid-typing while the user is still entering.
  - Echo the normalized value back so the user sees how the system interpreted it ("Saturday, July 20, 2026").
  - Fall back to a clear [[#Error Messages|error message]] when the input is truly unparseable - name what was ambiguous.
  - Test against real user input, not just synthetic cases.
- Signals present (in code/spec): server-side or client-side normalization function (`parseDate`, `parsePhone`, `parseCreditCard`); regex with multiple capture alternatives; libraries like `libphonenumber`, `chrono-node`, `date-fns/parseISO` with fallback parsers.
- Signals missing (red flag): a field that rejects "07/20/26" because it wanted "2026-07-20"; a credit card field that errors on spaces; a search box that only matches exact stock tickers.
- Anti-patterns / mis-applications: silently parsing an ambiguous input wrong; stripping characters mid-keystroke so cursor jumps; "smart" parser that throws on edge cases without explanation.
- Related: [[#Structured Format]], [[#Input Hints]], [[#Autocompletion]], [[#Error Messages]]

### Generous Borders

`tags: surface=[mobile-overlay], platform=mobile, foundations=[P-03,V-01], source=ch.6`

- Use when: any touch target - buttons, links, list rows, icons - exists on a mobile screen.
- What it is: ample inner padding, outer margin, and surrounding whitespace around every tappable element so finger taps land reliably.
- Why it works: fingers are imprecise, especially under motion or poor light; oversized touch zones reduce mis-taps; whitespace also reads as "polished".
- How to apply:
  - Target >= 44pt x 44pt (iOS) or >= 48dp x 48dp (Android) per touch zone.
  - Put space between adjacent targets so the user can't trigger the wrong one.
  - Where visual design demands a smaller visible button, extend the hit area into surrounding whitespace (extended `hitSlop`).
  - Verify with a device test, not just a simulator - fingers behave differently than mice.
- Signals present (in code/spec): `hitSlop` / `padding` on `Pressable`/`Button`; minHeight 44/48 enforced via a `Button` design-system primitive; spacing tokens applied between list rows.
- Signals missing (red flag): icon-only buttons in a tight toolbar; close (X) buttons sized to their glyph; inline text links with no extra padding; multiple adjacent CTAs with no gap.
- Anti-patterns / mis-applications: huge visible buttons that waste screen but leave no whitespace between them (still mis-tap); pretending CSS padding is enough when the actual `Pressable` hit area is smaller; tiny "x" close buttons on toasts and modals.
- Related: [[#Vertical Stack]], [[#Bottom Navigation]], [[principles#P-03. Satisficing]]

### Good Defaults and Smart Prefills

`tags: surface=[form,entry], platform=any, foundations=[P-05,P-11,P-03], source=ch.10`

- Use when: a field has a high-probability answer based on user context (account info, location, prior session, common case) that would save the user typing or thinking.
- What it is: pre-populated values in form controls - text fields, dropdowns, checkboxes - chosen because most users, most of the time, will accept them.
- Why it works: halves the time to complete the form for the common case; provides an example of the expected answer type even when the user changes it; supplies graceful guesses where the user genuinely doesn't care (install location, theme).
- How to apply:
  - Identify each field's most-likely value from: session context, user account, prior input, derived data (city/state from zip; timezone from locale; "From" city from current location).
  - Prefill on first render or dynamically as earlier fields are filled.
  - **Don't prefill sensitive or politically-charged values** (gender, citizenship, password) - let the user choose explicitly.
  - **Don't pre-check opt-in boxes for marketing / data sharing / "I agree to be contacted"** - implicit consent is dark-pattern territory.
  - Make defaults easy to change - never hide the underlying control.
  - Watch for the "auto-skip" failure: a prefilled field may not register in the user's awareness; for important decisions, prefer an explicit prompt.
- Signals present (in code/spec): `defaultValue` populated from user context / profile / session; derived state effects that auto-fill dependent fields (`useEffect(() => setState(...))`); zip-to-city lookup wired to a form effect.
- Signals missing (red flag): a profile form that asks the user to retype their name and email they already gave during signup; a checkout that re-asks the shipping address every time; a calendar form that defaults date to 1970-01-01.
- Anti-patterns / mis-applications: pre-checked marketing / newsletter / "share my data" boxes; defaults that imply consent or commitment (pre-selected paid plan); defaults users don't notice silently changing their submission; defaulting destructive options (delete all, share publicly).
- Related: [[#Input Prompt]], [[#Autocompletion]], [[principles#P-11. Streamlined Repetition]], [[principles#P-01. Safe Exploration]]

### Grid of Equals

`tags: surface=[overview,data], platform=any, foundations=[P-09,V-01,P-03], source=ch.4`

- Use when: the screen lists many items of similar style and importance (news articles, products, blog posts, videos, categories) and the user is browsing/previewing.
- What it is: items arranged in a row or matrix using one shared template, each cell with similar visual weight.
- Why it works: equal space + shared template signals "these are peers, pick any"; users learn one cell's interaction model and apply it to all; supports scanning by image, title, or metadata.
- How to apply:
  - Design one cell template (thumbnail + headline + optional subhead/summary) and reuse it across all items.
  - Pick a column count that holds up across viewport widths; verify the narrowest target.
  - Allow static or hover-state highlighting via color/contrast - never change cell position or size.
  - Make every cell linkable to a detail view.
- Signals present (in code/spec): a `.map()` over a homogeneous array rendering one `Card`/`Tile` component; CSS grid or flex-wrap container; uniform `aspect-ratio` on thumbnails.
- Signals missing (red flag): peer items rendered with bespoke per-item layouts; visually inconsistent tile sizes implying false hierarchy; list of similar items shown as a vertical text-only stack with no preview.
- Anti-patterns / mis-applications: one "featured" cell made dramatically larger, breaking the equality contract without justification; mixing genuinely heterogeneous items into a single grid; varying cell height per content length so the grid loses rhythm.
- Related: [[#Collections and Cards]], [[#Titled Sections]], [[principles#P-09. Spatial Memory]]

### Help Systems

`tags: surface=[overview,form,entry], platform=any, foundations=[P-03,P-13,P-12], source=ch.2`

- Use when: every well-designed surface - labels and prompts are mandatory; richer help is needed when tasks are non-obvious, novel, or expert-targeted.
- What it is: a layered set of help techniques (inline copy, tooltips, full docs, guided tours, knowledge base, community) deployed in proportion to task complexity.
- Why it works: users span novice to expert with different needs; layered help reaches each without forcing one approach on all.
- How to apply:
  - Inline (mandatory): meaningful headings, on-screen instructions, form labels, [[#Input Hints]] / [[#Input Prompt]].
  - Tooltips: brief one- or two-line descriptions for icon-only or non-obvious controls; 1-2s hover delay; mobile = tap-to-show.
  - [[#Hover or Pop-Up Tools]] for slightly longer descriptions.
  - Longer help: Collapsible Panels for inline expansion.
  - Full help system: separate window/site with manual, glossary, FAQs, how-tos, videos.
  - Guided tours: lightbox/popover step-by-step overlays for onboarding or "show me how".
  - Knowledge base: Q&A database open to customers, with "submit a question" path.
  - Online community: forum or social group for power users (only worth the cost for heavily-used products).
- Signals present (in code/spec): every form field has a `label` + optional `hint`; icon-only buttons have `aria-label`/`title`; a `Help` route or external docs link in global nav; tour library wired to first-launch events.
- Signals missing (red flag): icon-only toolbar with no tooltips; form labels missing or vague; new-user has no path other than poke-and-pray; FAQs are a static PDF with no search.
- Anti-patterns / mis-applications: tooltip appears instantly on hover and blocks the control underneath; tour cannot be dismissed/replayed; help link opens a wiki edit page; "knowledge base" is one outdated FAQ.
- Related: [[#Input Hints]], [[#Hover or Pop-Up Tools]], [[principles#P-02. Instant Gratification]]

### Hover or Pop-Up Tools

`tags: surface=[data,do], platform=desktop, foundations=[V-01,P-12], source=ch.8`

- Use when: a mouse-driven list where each item supports several actions, and showing every action on every row would clutter the surface.
- What it is: buttons or controls placed next to an item but kept hidden until the pointer hovers (mouse) or the item is tapped (touch surfaces use a pop-up panel instead).
- Why it works: keeps the resting UI clean; reveals tools exactly where and when needed; the rollover gesture itself draws attention.
- How to apply:
  - Reserve enough space in each row so revealed tools don't reflow neighbours.
  - Show/hide instantly - no animated transitions.
  - Optionally highlight the hovered row to reinforce the focus.
  - On touch, replace hover with a tap-revealed pop-up panel anchored to the item.
- Signals present (in code/spec): row components with CSS `:hover` toggling tool visibility; React `onMouseEnter`/`onMouseLeave` controlling a per-row tool overlay.
- Signals missing (red flag): long lists where the only way to delete/archive/share an item is a top-of-screen toolbar requiring a prior selection step; cluttered rows where every action is rendered always.
- Anti-patterns / mis-applications: Hover Tools on a touch-only surface (no hover state exists); animated reveals that delay access to the tool.
- Related: [[#Action Panel]], [[#List Inlay]], [[#Drop-down Chooser]]

### Infinite List

`tags: surface=[data,mobile-overlay], platform=any, foundations=[P-08,P-02], source=ch.6`

- Use when: the underlying list is effectively bottomless (search results, an inbox, a social feed, an archive) and users typically find what they want near the top but sometimes need more.
- What it is: a list that loads an initial chunk and appends additional chunks as the user scrolls toward the bottom - either via a "load more" button or silently (lazy loading).
- Why it works: fast first paint with a usable screenful; user controls when (and whether) more arrives; no context-shift to a new page like with pagination.
- How to apply:
  - Truncate the initial response to a reasonable chunk size based on item size and download cost.
  - Either show a "Load more" button at the bottom (with count if known), or prefetch the next chunk silently and append on scroll-end.
  - Show a small progress indicator at the bottom while loading more.
  - Don't reorder items already shown; only append.
  - Provide a way to jump to top after the user has scrolled far.
- Signals present (in code/spec): `FlatList` / `VirtualizedList` with `onEndReached`; paginated API with `cursor` / `page` / `offset`; loading spinner footer; "load more" button or intersection observer at list end.
- Signals missing (red flag): full result set loaded up front causing slow first paint; pagination implemented as separate route pages on a mobile feed; user reaches the end and has no way to get more.
- Anti-patterns / mis-applications: silent infinite scroll on content the user needs to commit decisions on (e.g., a checkout list) - they lose the bottom of the page; no virtualization, so memory grows unboundedly; "load more" button hidden below other footer content.
- Related: [[#Loading or Progress Indicators]], [[#Collections and Cards]], [[#Vertical Stack]]

### Input Hints

`tags: surface=[form,entry], platform=any, foundations=[P-03,P-05], source=ch.10`

- Use when: a text field's purpose or required format isn't obvious from its label alone, but you don't want to clutter the label itself.
- What it is: a short example or explanatory phrase placed below, beside, or above the field - *outside* the input - that clarifies what to enter.
- Why it works: visible help for users who need it, easy to skip for users who don't. The field stays empty (no placeholder confusion about whether it's already filled).
- How to apply:
  - Place the hint adjacent to the field, not inside it (avoid the placeholder-as-help anti-pattern).
  - Keep it short - one sentence or less.
  - Make it smaller and lighter than the label (typically 2pt smaller font, secondary color), still readable.
  - Use plain language; show one example value when possible ("e.g., name@example.com").
  - For longer explanations, link to a popover / modal - but don't depend on the link being followed.
  - Right-aligned hints work for label/control/hint triplets if vertical space is short.
- Signals present (in code/spec): a `<FormField>` component with a `helperText` / `description` slot rendered below the input; design-token-sized "caption" or "help" typography style; hints rendered even before focus.
- Signals missing (red flag): placeholder text used as the only explanation of what the field wants (disappears on focus, mistaken for filled value); cryptic labels with no clarifying example ("Reference number" with no format shown); critical context buried in a tooltip on a `?` icon.
- Anti-patterns / mis-applications: hint text that's longer than three lines (users skip it); using hints to communicate validation errors (errors should appear conditionally in their own slot); identical hint repeated under every field (sign you needed one section-level instruction instead).
- Related: [[#Input Prompt]], [[#Forgiving Format]], [[#Error Messages]], [[principles#P-03. Satisficing]]

### Input Prompt

`tags: surface=[form,entry], platform=any, foundations=[P-03,P-05], source=ch.10`

- Use when: a text field, dropdown, or combo box needs a hint *inside* the control itself - typically because there's no good default value and you want the user to notice the field is empty and actionable.
- What it is: placeholder text *inside* the control (e.g., "Type your message", "Choose a state") that disappears when the user begins entering.
- Why it works: sits exactly where the user will act, so it can't be missed. Imperative phrasing ("Pick a date") communicates that an action is required.
- How to apply:
  - Use a verb prompt: "Select / Choose / Pick..." for dropdowns; "Type / Enter..." for text fields.
  - End the phrase with a noun describing the data ("Enter your email address").
  - For dropdowns, the prompt is *not* a selectable value - selecting it returns to "no choice."
  - Disable the form's Submit until the prompt has been replaced with real input (no error message needed).
  - Restore the prompt when the user clears their entry.
  - Use [[#Good Defaults and Smart Prefills]] instead when you can guess accurately.
  - **Don't conflate with floating labels** - input prompts *disappear* on focus; floating labels shrink and stay. If you need both label + format hint, use a floating label with a separate [[#Input Hints]].
- Signals present (in code/spec): `placeholder` attribute on `<input>` / `<select>`; first dropdown `<option>` value is empty string with a verb-phrase label.
- Signals missing (red flag): dropdowns that default to the first real option (user can't tell if they picked it on purpose or by default); text fields with no label, no placeholder, no hint; "Enter information" as the only direction.
- Anti-patterns / mis-applications: using a prompt as a *substitute* for a label (kills a11y - screen readers may skip placeholder text; once the user types, no label is visible); prompts that are also valid values (user can't tell empty from selected); colored placeholder that looks like real input.
- Related: [[#Input Hints]], [[#Good Defaults and Smart Prefills]], [[#Autocompletion]]

### Jump to Item

`tags: surface=[data,form], platform=desktop, foundations=[P-12,P-11], source=ch.7`

- Use when: a long sorted list (alphabetical or numeric) in a scrolling list, table, drop-down, combo box, or tree, and the user wants to reach a specific item quickly from the keyboard.
- What it is: as the user types characters, the list selection jumps to the first matching item; rapid typing refines the match.
- Why it works: computers scan faster than humans; keeps the user's hands on the keyboard during form filling.
- How to apply:
  - On first keystroke, scroll to and select the first match for the typed string.
  - On subsequent rapid keystrokes, refine to the first exact match for the accumulated string.
  - If no match, stay at the nearest match; optionally beep.
  - Pair with incremental-search variants (live results filter as typed) where appropriate.
- Signals present (in code/spec): native `<select>` elements (which get this for free); custom comboboxes that handle keystrokes; search-as-you-type fields.
- Signals missing (red flag): long custom dropdowns of countries/timezones with no keyboard jump; user must scroll hundreds of items by hand.
- Anti-patterns / mis-applications: jump that requires the user to type the exact full string before moving; jump applied to unsorted lists (the result is unpredictable).
- Related: [[#Alpha/Numeric Scroller]], [[#Autocompletion]]

### List Builder

`tags: surface=[form,settings], platform=any, foundations=[P-12,P-04], source=ch.10`

- Use when: the user needs to assemble a subset out of a potentially large source set - recipients from a directory, tags from a tag library, files into a batch, columns to display, features to include.
- What it is: a two-pane widget with the source list on one side and the destination list on the other, with controls (Add/Remove buttons, drag-and-drop, click-to-jump) to move items between them.
- Why it works: both states - what's available and what's chosen - are visible at once, so the user always knows what's in their selection. Scales to large source lists better than a wall of checkboxes (where "what did I check?" is unanswerable).
- How to apply:
  - Lay out source and destination side-by-side (left/right) or stacked (top/bottom).
  - Provide bidirectional movement (Add and Remove, or drag both directions).
  - Support multi-select semantics - let users move several items at once.
  - Make each list searchable when long.
  - Allow ordering of the destination list when order matters (drag-handles, move-up/down buttons).
  - Decide whether items disappear from the source when moved (consumable lists) or stay (catalog-style); document the choice in the UI.
  - Confirm moves with motion (item visibly travels) or at minimum updates of both lists in the same tick.
- Signals present (in code/spec): dual `<List>` / `<DataTable>` components with a shared selection model; drag-and-drop library (`dnd-kit`, `react-beautiful-dnd`) wired across both panes; Add/Remove buttons between panes.
- Signals missing (red flag): a "Manage tags" UI that's just one long checklist where the user can't see at a glance what's checked; column-picker modal that hides the destination list under another tab; tag picker forcing the user to type each one even though a directory exists.
- Anti-patterns / mis-applications: drag-only with no button fallback (broken for keyboard users); destination list that doesn't preserve order; moves that don't take effect until the user clicks "Apply" elsewhere.
- Related: [[#Drop-down Chooser]], [[principles#P-12. Keyboard Only]]

### List Inlay

`tags: surface=[data,focus], platform=any, foundations=[P-04,P-09], source=ch.7`

- Use when: users need to expand item details inline without losing list context, and may want to compare two or more items side-by-side within the list.
- What it is: a vertical column of items; tapping an item expands its detail beneath the row, pushing later items down; multiple items can be open at once.
- Why it works: detail appears in the context of its neighbours; supports comparison; avoids the screen swap of drilldown.
- How to apply:
  - One column of rows; click toggles open/close in place.
  - Animate the expand/collapse to keep the user oriented.
  - Place the close control near the open control AND at the bottom of long inlays.
  - Use a scrolled container - the column can grow arbitrarily tall.
- Signals present (in code/spec): accordion-style row components with per-row `expanded` state; ordered list whose items render conditional detail subviews.
- Signals missing (red flag): long rows where the only way to see detail is full screen swap, even though item details are short; comparison use case forced into a back-and-forth drilldown.
- Anti-patterns / mis-applications: inlay used for grid-style item layouts where adjacent items get visually broken; close control hidden so user can't easily collapse a long inlay.
- Related: [[#Two-Panel Selector or Split View]], [[#One-Window Drilldown]], [[#Accordion]]

### Loading or Progress Indicators

`tags: surface=[mobile-overlay,do], platform=mobile, foundations=[P-02,P-08], source=ch.6`

- Use when: any user-initiated action causes a perceptible delay - screen load, content fetch, image render, multi-step task.
- What it is: a microinteraction animation (spinner, progress bar, skeleton, branded loader) shown in situ where the result will appear.
- Why it works: reassures the user something is happening; makes wait time feel shorter; ties feedback to the location the user gestured.
- How to apply:
  - Render whatever can paint immediately; reserve loaders only for slow parts.
  - Place the indicator in situ - where the missing content will appear - not in a generic top bar.
  - Use the platform default unless brand moment is worth the engineering cost.
  - Use determinate progress when the duration is known; indeterminate otherwise.
  - Use skeleton placeholders for content that has a known shape.
- Signals present (in code/spec): `Skeleton` / `Shimmer` components in the item slot; conditional rendering on `isLoading` flag; `ActivityIndicator` / `Spinner` next to the triggering control; per-section progress instead of full-screen blockers.
- Signals missing (red flag): blank screen during fetch; full-screen spinner blocking interaction even when only part is loading; user taps a button and gets no feedback for >100 ms.
- Anti-patterns / mis-applications: fake progress bars that always reach 90% then stick; per-pixel skeletons that mislead the user about content shape; auto-dismiss before the load finishes; spinners with no timeout for failed loads.
- Related: [[#Touch Tools]], [[#Infinite List]], [[principles#P-02. Instant Gratification]]

### Macros

`tags: surface=[make,do], platform=desktop, foundations=[P-11,P-06], source=ch.8`

- Use when: users repeat long sequences of actions over many objects (batch image edits, ETL on many files, repeated transformations); the app already has Multilevel Undo or Command History to draw on.
- What it is: a user-defined named command composed of a recorded sequence of smaller actions, replayable on demand with one gesture.
- Why it works: Streamlined Repetition automates what computers should automate; reduces finger slips; supports flow by collapsing many steps into one.
- How to apply:
  - Provide a Record / Stop mechanism that captures a sequence of commands.
  - Let users name, save, browse, and edit macros; allow one macro to invoke another.
  - Make playback a single click / keyboard shortcut / drag-and-drop.
  - Optionally parameterise - let the same macro act on different targets - and support batch application across many objects.
  - Don't call it "programming" if your users don't see themselves as programmers.
- Signals present (in code/spec): an `Action`/`Recording`/`Script` data model; a Record button in the UI; a macro library persisted per user.
- Signals missing (red flag): power users hand-repeating the same 10-step procedure on hundreds of files; feature requests for "batch X" with no way to compose existing commands.
- Anti-patterns / mis-applications: macros that can't be inspected or edited (black-box playback); macros that fail silently on the first error instead of reporting which step broke.
- Related: [[#Multilevel Undo]], [[#Command History]], [[principles#P-11. Streamlined Repetition]]

### Make It Mobile

`tags: surface=[mobile-overlay], platform=mobile, foundations=[P-02,P-08,V-05], source=ch.6`

- Use when: deciding how to treat mobile relative to a desktop product - at the product-strategy level, not the screen level.
- What it is: a stance, not a layout - treat smartphone and tablet experiences as primary (not afterthoughts), giving deliberate attention to microinteractions, usability, and mobile context of use.
- Why it works: for many users the mobile experience is their only experience of the brand; treating it as a downstream port hides product problems users can't articulate.
- How to apply:
  - Decide consciously per surface: mobile web, mobile-native app, or both - based on use cases and investment available.
  - Design mobile use cases first (quick fact lookup, time-killing, social connection, urgent alerts, location-relevant info).
  - Strip features that don't survive the mobile context rather than cramming them in.
  - Budget for microinteractions, animations, and platform-correct details; they read as quality.
  - Test on real devices under real conditions (sun, motion, noise), not just emulators.
- Signals present (in code/spec): mobile is a first-class build target with its own design tokens and component library; product analytics show parity (or better) for mobile sessions; per-platform conventions are followed (iOS HIG, Material).
- Signals missing (red flag): mobile is "responsive desktop" with no mobile-specific flows; mobile features ship after desktop with no parity timeline; product team has no on-device test devices.
- Anti-patterns / mis-applications: building a separate mobile app that only does 10% of what the site does without surfacing that gap; treating mobile as a marketing-only surface; copying desktop interaction patterns (hover, right-click, multi-select with shift) onto touch where they don't translate.
- Related: [[#Vertical Stack]], [[#Richly Connected Apps]]

### Many Workspaces

`tags: surface=[make,focus], platform=desktop, foundations=[P-01,P-04,P-10], source=ch.2`

- Use when: the user works across multiple files/projects/contexts at once and needs to compare, monitor, or multitask - editors, browsers, IDEs, social-media managers.
- What it is: a UI that lets a user have multiple parallel workspaces open - tabs, panels, split-windows, or separate OS windows.
- Why it works: supports real human multitasking, side-by-side comparison, and Prospective Memory (leaving a window open as a self-reminder). Aligns with Safe Exploration - a new workspace costs nothing.
- How to apply:
  - Pick a workspace primitive: tabs (lightweight), columns/panels (always-visible), split-window (resizeable), separate OS windows (heaviest).
  - For simple text/list content, split panels work; for complex content (editors, full pages), tabs/windows.
  - Persist workspace set across restart (Chrome-style "reopen all tabs").
  - Allow side-by-side comparison (split view) and easy switching (cmd-tab analog).
- Signals present (in code/spec): tab strip with reorderable tabs; split-pane component; window manager state persisted to disk; route supports multiple parallel instances (e.g. `/doc/:id` openable in multiple tabs without state collision).
- Signals missing (red flag): an editor or IDE that only opens one file at a time; comparing two records requires manual copy-paste; closing the app loses tab set.
- Anti-patterns / mis-applications: tabs that don't survive reload; tabs that share state and overwrite each other; "multiple windows" implemented as iframes that confuse browser back-button; unlimited tabs with no overflow handling.
- Related: [[principles#P-01. Safe Exploration]], [[principles#P-04. Changes in Midstream]], [[principles#P-10. Prospective Memory]]

### Media Browser

`tags: surface=[overview,focus,data], platform=any, foundations=[V-01,P-09], source=ch.2`

- Use when: surface presents a large set of pictorial or playable items (photos, videos, documents) for browse + select + view/edit.
- What it is: a two-view structure - a grid of thumbnails (with optional metadata) and a single-item view, plus a browsing interface (search, filters, folders, tags).
- Why it works: images compress meaning; recognition is faster than reading. A familiar grid + detail pair sets correct expectations.
- How to apply:
  - Grid view: thumbnails with minimal metadata (title, date); optional thumb-size control; sort and filter.
  - Single-item view: full media + metadata, prev/next, [[#Pyramid]] back to grid.
  - Browsing interface: search box, folder/album list, faceted filters (keywords, modification date, camera type, ISO).
  - If user owns items: multi-select (shift/checkboxes/lasso), cut/copy/paste, move/reorder/delete, keyboard traversal (arrows + space).
  - Inline edits (crop, brightness) on the single-item view; escape hatch to a "real" editor when needed.
- Signals present (in code/spec): route pair like `/library` (grid) and `/library/:id` (detail) with prev/next; `Thumbnail` component grid + filter sidebar; multi-select state in store.
- Signals missing (red flag): media collection rendered as a long text list with no thumbnails; no way to multi-select; detail view has no prev/next so user must back to grid each time.
- Anti-patterns / mis-applications: thumbnails so small they require hover-to-distinguish; metadata noise crowding the grid (8 columns of fields per item); detail view that loses scroll position when you return to the grid.
- Related: [[#Thumbnail Grid]], [[#Two-Panel Selector or Split View]], [[#Pyramid]]

### Menu Page

`tags: surface=[overview,entry,mobile-overlay], platform=any, foundations=[P-03,V-01], source=ch.3`

- Use when: a screen's sole purpose is to be a table of contents - show where the user can go and let them pick.
- What it is: a page filled with links to content-rich destinations, with enough context per link to choose well, and no other significant content.
- Why it works: removes distractions so user can focus on choosing; ideal for mobile small screens with many destinations.
- How to apply:
  - Short, plain link labels; enough context (description, image) to choose, never more.
  - Group/order links by category, hierarchy, or date as the data demands.
  - Include a search box at the top.
  - Mobile: one column, big tap targets, shallow hierarchy.
  - Don't be afraid to omit promotional content if the page is a pure index.
- Signals present (in code/spec): a route renders only a `LinkList` / `NavList` / category grid; no hero, no feed, no embedded content; mobile drawer/menu uses this pattern.
- Signals missing (red flag): big app with many features but the "menu" is a hamburger with 30 unsorted items; mobile root screen is a busy dashboard when users mostly need to pick one of many destinations.
- Anti-patterns / mis-applications: menu page padded with marketing carousel to "fill space"; links labelled identically ("Section A", "Section B"); a menu of menus 4 levels deep before any content.
- Related: [[#Feature, Search, and Browse]], [[#Settings Editor]]

### Mobile Direct Access

`tags: surface=[mobile-overlay,entry], platform=mobile, foundations=[P-02,P-08], source=ch.2`

- Use when: a mobile app generates value by doing one thing really well; the user opens it for that one thing.
- What it is: the first screen presents actionable information or a primed primary action with no required input, using device signals (location, time, camera).
- Why it works: removes friction between launch and value; satisfies Instant Gratification on mobile where typing is expensive.
- How to apply:
  - On launch, use device signals (location, time, camera, mic) with permission to populate the first screen.
  - Pick the single most likely action and prime it (camera on, location-filtered list, weather for current location).
  - Prefill smart defaults (e.g. defaulting "1 hour" for a parking app).
  - Keep secondary search/configuration accessible but not the first thing.
- Signals present (in code/spec): app entry route fires location/time/camera permission and renders result-first; no required onboarding gate; first screen has zero required text input.
- Signals missing (red flag): cold-start screen is a sign-in wall, a tour carousel, or an empty search box with no defaults; first screen requires typing to produce any value.
- Anti-patterns / mis-applications: forcing a tutorial overlay over the direct-access screen; asking for permission *and* a manual search before showing anything; pre-fetching nothing until user taps.
- Related: [[principles#P-02. Instant Gratification]], [[#Clear Entry Points]]

### Modal Panel

`tags: surface=[mobile-overlay,do,form], platform=any, foundations=[P-01,P-07,V-01], source=ch.3`

- Use when: a small focused task or a required decision must be handled before the user can continue (sign-in mid-checkout, "save as" filename, important confirmation).
- What it is: a panel rendered atop the current screen with all other navigation suppressed (often a lightbox/dim layer behind it).
- Why it works: forces one decision in one place; eliminates competing nav so user's attention channels into the next step.
- How to apply:
  - Place it visually centred over the screen the user came from.
  - One, two, or at most three labelled exit buttons with verb labels ("Save", "Don't save", "Cancel"); plus a Close/X.
  - Use lightbox/dim to focus the eye; make the panel large enough to find effortlessly.
  - Use sparingly - it interrupts; if input can be deferred (asked inline, later), prefer that.
  - On web prefer overlay components, not OS-level modals.
- Signals present (in code/spec): a `Modal`/`Dialog`/`Sheet` component portal-rendered with a backdrop; route or state has `isOpen`; focus is trapped; ESC closes; primary action has prominent button styling.
- Signals missing (red flag): a destructive action (delete, irreversible) fires with no confirmation; mid-flow "extra info" rendered as a new page instead of a modal, losing context.
- Anti-patterns / mis-applications: modal cascade (modal opens modal opens modal); no close affordance; modal used for routine choices that could be inline; modal that the user can dismiss to nowhere (e.g. lands on a blank screen); modal with no focus trap so keyboard users tab into the page behind.
- Related: [[#Escape Hatch]], [[principles#P-01. Safe Exploration]]

### Module Tabs

`tags: surface=[settings,data,make], platform=any, foundations=[P-09,V-01], source=ch.4`

- Use when: a screen has several (fewer than ~10) coherent, similarly-sized content modules and the user only needs to see one at a time.
- What it is: a row of selectable tab labels, each revealing one module's content in the same panel area.
- Why it works: declutters by hiding peer content the user is not currently using; preserves location (one panel area, one selector); cheaper than navigating to a new route.
- How to apply:
  - Split content into a small handful of self-contained, similarly-sized modules with 1-2 word titles.
  - Make the active tab unambiguously visible - connect it to its panel via shape/color, not color alone.
  - Place tabs at top, side, or bottom - but never wrap to a second row.
  - If tabs overflow, ellipsize labels, scroll the strip, or move to a left column. Do not stack rows.
  - Distinguish module tabs from navigational tabs that change route.
- Signals present (in code/spec): `Tabs` / `TabList` / `TabPanel` components with one `panel` rendered at a time; selected tab tracked by index/key in component state, not route.
- Signals missing (red flag): a single page renders 5+ heterogeneous content blocks the user has to scroll past every time; user has to refresh or navigate to switch context between peer modules.
- Anti-patterns / mis-applications: double-row tabs; tabs whose content forces the user to compare across panels (use Accordion or side-by-side instead); tabs disguised as nav (or vice versa); inactive tab styled so similarly to the active one the selection is ambiguous.
- Related: [[#Accordion]], [[#Collapsible Panels]], [[#Titled Sections]], [[#Movable Panels]]

### Movable Panels

`tags: surface=[make,settings,overview], platform=desktop, foundations=[P-09,P-07,P-04], source=ch.4`

- Use when: building a long-session desktop app or signed-in dashboard where users want to personalize layout - creator tools, IDEs, news portals, BI dashboards.
- What it is: titled, independently sized panels users can drag, rearrange, resize, hide, and add to the screen.
- Why it works: lets users place needed tools near where they work and exploit spatial memory; personalization increases engagement and buy-in; accommodates third-party / future modules without redesign.
- How to apply:
  - Give each panel a name, title bar, and sensible default size + position.
  - Support drag-and-drop reposition, ideally into a grid of slots (snap targets) rather than free-floating overlap.
  - Use ghosting (dotted drop target) during drag to show where the panel will land.
  - Let users close individual panels via an "X" on the title bar.
  - Provide a discoverable "add panel" surface that lists available modules - including new/third-party ones.
  - Persist the user's layout across sessions.
- Signals present (in code/spec): grid/dock layout library; per-user persisted layout config (positions, sizes, visibility); drag handles on panel headers; a panel registry/catalog.
- Signals missing (red flag): power-user app with fixed layout users repeatedly request "just let me move it"; multiple feature requests for "hide this panel"; dashboard whose default layout suits no one.
- Anti-patterns / mis-applications: free-floating overlap with no snap grid (panels obscure each other); no way to recover a closed panel; per-session-only state so layout resets on reload; using Movable Panels in a consumer app where most users won't invest in personalizing.
- Related: [[#Center Stage]], [[#Collapsible Panels]], [[principles#P-09. Spatial Memory]], [[principles#P-07. Habituation]]

### Multi-Y Graph

`tags: surface=[data,overview], platform=any, foundations=[V-01,P-09], source=ch.9`

- Use when: presenting two or more series that share the *same x-axis* (usually time) but have different units or scales on the y-axis (price, volume, temperature, humidity), and the user benefits from spotting vertical correlations.
- What it is: several plots stacked vertically, sharing one x-axis, each with its own y-axis (or no y-axis if exact values aren't needed).
- Why it works: shared x-axis says "these are aligned in the same dimension"; separate y-axes prevent unit-mismatch distortion. The eye is excellent at spotting "they both spike here" comparisons when graphs are vertically aligned.
- How to apply:
  - Stack along x; reserve separate vertical space for each y-axis.
  - Label every series unambiguously (title beside the plot or directly on the curve).
  - Use vertical grid lines so the eye can trace one x-value across all plots.
  - If exact y-values don't matter, drop y-axes and just float curves to non-interfering positions.
  - Pictograms or icons (weather symbols, event markers) can occupy one "row" alongside numeric plots.
  - For interactive multi-Y, link cursor/datatip across all stacked plots.
- Signals present (in code/spec): a composed chart that mounts multiple `<LineChart>` / `<BarChart>` instances with a shared x-domain; layout grid that constrains widths to match; cross-plot hover synced via shared cursor state.
- Signals missing (red flag): a dashboard packing multiple unrelated-unit series onto one chart with a single (lying) y-axis, or split into separate tabs that prevent vertical comparison.
- Anti-patterns / mis-applications: stacking series with *the same units* (should be a single plot or [[#Small Multiples]]); dual y-axes on a single panel (the classic "left axis vs right axis" - viewers misread correlation); inconsistent x-domains across stacked plots.
- Related: [[#Small Multiples]], [[#Datatips]], [[#Titled Sections]]

### Multilevel Undo

`tags: surface=[make,do], platform=any, foundations=[P-01,P-06], source=ch.8`

- Use when: highly interactive applications - editors, authoring tools, graphics, mail, database UIs - where users perform sequences of state-changing operations.
- What it is: a reversible action history; each commit pushes onto a stack, and successive Undos pop operations off in reverse order. Redo walks back up.
- Why it works: encourages Safe Exploration for novices; enables experts to try whole paths and roll back; supports flow because mistakes aren't expensive.
- How to apply:
  - Model every state-changing operation as a discrete, named, reversible command.
  - Reversible: text edits, DB transactions, image edits, layout changes, file ops, create/delete/rearrange, cut/copy/paste.
  - Not reversible (don't pollute the stack): selection, navigation, scroll, panel sizing, mouse position.
  - Define operation granularity around user intent (words, not letters).
  - Stack depth: at least 10-12; longer if feasible.
  - Surface as Edit > Undo / Redo with `Ctrl-Z` / `Cmd-Z`; pair with Smart Menu Items naming the next undoable action.
- Signals present (in code/spec): a `Command`/`Action` interface with `apply()` and `undo()`; a central `UndoManager` (UIKit's `NSUndoManager`, Redux undo middleware, etc.).
- Signals missing (red flag): a complex editor where undo only reverses the most recent action; no Redo; or undo is per-field instead of per-user-intent.
- Anti-patterns / mis-applications: undo that reverses navigation or selection (creates "what just happened?" confusion); undo across irreversible operations (purchase, sent email) without an explicit warning.
- Related: [[#Smart Menu Items]], [[#Command History]], [[principles#P-01. Safe Exploration]], [[principles#P-06. Incremental Construction]]

### New-Item Row

`tags: surface=[data,make], platform=any, foundations=[P-06,P-05], source=ch.7`

- Use when: a table, list, or tree where users add items, and you want to avoid spending space on a separate "create" button or form.
- What it is: the first or last row of the list is a dedicated row that creates a new item when clicked or typed into.
- Why it works: creation happens where the item will live - no navigation away, less screen real estate, conceptually coherent.
- How to apply:
  - Reserve the first (or last) row for a clearly labelled "New X" affordance.
  - On activation, turn the row into an editable record with appropriate fields per column.
  - Pre-fill with Good Defaults so even an abandoned row is a valid item.
  - Decide abandonment behaviour: either keep the row as a valid default-only item, or delete it on cancel.
- Signals present (in code/spec): a list whose last item is rendered as an `Add row` cell or input; inline editing components per column.
- Signals missing (red flag): a "+ Add" button that opens a modal for items users add frequently (friction); creation flow disconnected from where the item appears.
- Anti-patterns / mis-applications: New-Item Row on a list where creation needs many fields not visible as columns; abandoned rows leaving invalid records in storage.
- Related: [[#Good Defaults and Smart Prefills]], [[#Input Prompt]]

### One-Window Drilldown

`tags: surface=[data,focus,mobile-overlay], platform=mobile, foundations=[P-04,P-09], source=ch.7`

- Use when: small screens (mobile, narrow panels) or list-and-item content that both demand the full width; only one of list-or-item can be on screen at once.
- What it is: list occupies the screen; selecting an item replaces the list view with the item view, with a Back affordance returning to the list.
- Why it works: shallow hierarchy is easy to navigate; each view gets the entire viewport.
- How to apply:
  - Render the list with whatever layout fits (rows, cards, grid, tree).
  - On selection, replace screen contents with the item view; provide explicit Back/Cancel (or rely on platform hardware back).
  - Optionally add Previous/Next links inside the item view to mitigate "pogo-sticking" back to the list.
  - Keep the back transition fast - no full reload of the list state.
- Signals present (in code/spec): mobile route pairs like `/items` and `/items/:id` with the list view unmounting on navigation; a NavigationStack push (iOS) / Navigator (RN) per item.
- Signals missing (red flag): mobile list where tapping an item opens a modal sheet that covers the list partially but does not give the item full space; no Back affordance leaves user stranded.
- Anti-patterns / mis-applications: forcing One-Window Drilldown on a wide desktop layout when Two-Panel would let the user compare items; losing scroll position on the list when returning from item view.
- Related: [[#Two-Panel Selector or Split View]], [[#List Inlay]], [[#Menu Page]]

### Pagination

`tags: surface=[data], platform=any, foundations=[P-08,P-09], source=ch.7`

- Use when: the list is very long or bottomless, loading the entire list is too slow, and most users will find what they need in the first screen (typical of search results).
- What it is: the list is sliced into pages; navigation controls move between pages.
- Why it works: bounds load time and rendering cost; puts "see more" in the user's hands; easy to implement and well understood on the web.
- How to apply:
  - Tune page size to the device and item height; ensure the first page is genuinely useful.
  - Place controls at the bottom (and optionally at the top for long pages).
  - Include Prev/Next, a link to page 1, numbered page links, ellipses for elided ranges, and the current page rendered non-clickable.
  - Optionally show total page count.
- Signals present (in code/spec): API calls with `?page=` or `?offset=&limit=`; a `<Pagination>` component rendering numbered page links.
- Signals missing (red flag): long server-side lists loaded all at once causing slow first paint; bottomless lists rendered as one giant DOM tree.
- Anti-patterns / mis-applications: pagination used where Infinite List would be more natural (e.g., social feeds); pagination controls that hide the current page index so the user loses orientation.
- Related: [[#Infinite List]]

### Password Strength Meter

`tags: surface=[form,entry], platform=any, foundations=[P-06,P-03], source=ch.10`

- Use when: the user is choosing a new password and the system has password-strength requirements, or you want to actively help users avoid weak passwords.
- What it is: live feedback (color bar, checklist, text label) that appears while the user types, indicating whether the password meets requirements / is strong enough.
- Why it works: immediate, in-place feedback lets the user iterate to a valid password before submitting - no submit-error-resubmit loop. Concrete requirements (length, character class) reduce frustration vs. a vague "weak."
- How to apply:
  - Update while the user types (or on blur of the password field).
  - Show at minimum: weak / medium / strong (or pass / fail). Colors: red unacceptable, yellow intermediate, green acceptable.
  - Pair colors with text *and* iconography (red-green colorblindness).
  - If you reject weak passwords, surface the rules up-front via [[#Input Hints]] - don't let the user discover them by repeated rejection.
  - Best contemporary form is a *checklist* of explicit requirements (>=8 chars, includes a number, includes a symbol) that tick green as satisfied.
  - Offer a show/hide-password toggle (default hidden).
  - Don't suggest replacement passwords (security risk).
- Signals present (in code/spec): a `PasswordField` component with a strength estimator (`zxcvbn`, custom regex checklist); render of requirement-checkmark rows that update on `onChange`; explicit `aria-live="polite"` on the meter so screen readers hear strength updates.
- Signals missing (red flag): password field that accepts anything, then rejects on submit with "password too weak - must contain X, Y, Z" *after* the user committed; password rules listed in the legal copy or a separate help page.
- Anti-patterns / mis-applications: meter that says "strong" for any 8+ char string regardless of dictionary attacks; rules so onerous and unstated that users build a password by trial and error; auto-clearing the password field when validation fails (user retypes from scratch).
- Related: [[#Input Hints]], [[#Error Messages]], [[principles#P-06. Incremental Construction]]

### Preview

`tags: surface=[do,make,form], platform=any, foundations=[P-01,P-06], source=ch.8`

- Use when: the user is about to commit a heavyweight action (large file open, multi-page print, form submit, purchase, irreversible photo filter) and needs reassurance the outcome will be right.
- What it is: a lightweight rendering of the action's likely result, shown *before* commit, with one-click commit and an escape hatch.
- Why it works: prevents errors caused by typos or misunderstandings; makes the action self-describing - the user learns the verb by seeing its effect.
- How to apply:
  - Show only what's relevant to confirming the outcome - print layout, image-with-filter, transaction summary.
  - Include a commit control directly on the preview surface.
  - Provide a back / cancel / "change X" path for every editable input that fed into the preview.
  - For multi-option actions (filters, skin tones, configurations), render a preview per option so the user picks by recognition.
- Signals present (in code/spec): a `ReviewOrder` / `PreviewFilter` / `PrintPreview` screen between the form and the commit endpoint; thumbnail-per-option components.
- Signals missing (red flag): one-shot destructive or expensive actions that commit on first click with no intermediate review.
- Anti-patterns / mis-applications: preview screens that strip out "Edit" links so the user has to navigate all the way back to the start to fix one field; previews that take longer to render than the action itself.
- Related: [[#Cancelability]], [[#Multilevel Undo]], [[#Forgiving Format]]

### Progress Indicator

`tags: surface=[form,do], platform=any, foundations=[P-04,P-09], source=ch.3`

- Use when: a linear or near-linear flow of steps (wizard, checkout, slideshow, onboarding survey) where the user benefits from knowing where they are and how much remains.
- What it is: a compact map of all steps with the current step highlighted, placed near the page edge.
- Why it works: reduces anxiety ("how long is this?"); supports goal-completion; doubles as a back-jump nav to earlier completed steps.
- How to apply:
  - One-line or one-column placement, near Back/Next buttons.
  - Style current step distinctly; mark completed steps differently from upcoming.
  - Label each step with a short title (numbers alone work for very short titles).
  - When jumping back is allowed, make completed steps clickable; disable not-yet-reachable steps in flows with hard preconditions.
  - For non-linear large trees, use [[#Breadcrumbs]] instead.
- Signals present (in code/spec): a `Stepper` / `ProgressBar` / `Steps` component above or beside the step content; bound to a step index; completed steps clickable.
- Signals missing (red flag): user in step 4 of unknown-many; checkout flow with no indication of remaining work; slideshow with no page count.
- Anti-patterns / mis-applications: progress bar that lies (animates to 100% but flow continues); steps clickable to jump forward past required input; "step 1 of 1" rendered when there's nothing to indicate.
- Related: [[#Wizard]], [[#Breadcrumbs]]

### Prominent "Done" Button or Assumed Next Step

`tags: surface=[do,form], platform=any, foundations=[P-03,V-01], source=ch.8`

- Use when: a screen, form, or transaction has an obvious final step - Submit, Done, Continue, Buy, Send.
- What it is: a visually prominent button that lands exactly where the user's eye comes to rest at the end of the task flow.
- Why it works: gives closure - the user has no doubt the transaction will complete; layout hierarchy and visual flow funnel attention to that one button.
- How to apply:
  - Style as a real button (border, fill, size), not a link.
  - Place at the end of the task flow's visual path - usually bottom-right or below the last field.
  - Use a specific verb where possible ("Send", "Buy", "Change Record") over generic "Done"/"Submit".
  - Set off with whitespace and contrasting color; keep adjacent to the last input so the user doesn't hunt.
- Signals present (in code/spec): a single `<PrimaryButton>` per form/screen, styled distinctly from `<SecondaryButton>`; design tokens for `primary`/`secondary` action color.
- Signals missing (red flag): form with three equally weighted buttons at the bottom and no clear "next"; primary action rendered as a text link far from the last field.
- Anti-patterns / mis-applications: multiple equally prominent primaries on one screen splitting the user's attention; icon-only primary buttons that force interpretation work.
- Related: [[#Button Groups]], [[principles#P-03. Satisficing]], [[#Visual Framework]]

### Pyramid

`tags: surface=[overview,focus], platform=any, foundations=[P-04,P-09], source=ch.3`

- Use when: surface contains a sequence (slideshow, photo album, article series, product variants) that users sometimes traverse in order and sometimes hit a single item out of context.
- What it is: each item has Back/Next/Up links; an index/parent page lists the whole sequence so users can jump in anywhere.
- Why it works: gives three navigation choices (Back, Next, Up) instead of two; serves both browsers (item-at-a-time) and pickers (jump from index) without forcing pogo-sticking.
- How to apply:
  - Build an index/parent page that lists all items (grid, thumb list, or rich list).
  - On each item page: Back, Next, and Up (return to index) links/buttons; preview next item's title/thumb if space allows.
  - For loops (last to first), check that users know they've wrapped; usually safer to terminate at the index.
- Signals present (in code/spec): an index route plus item routes with `prev`/`next`/`index` props; URL includes both the item id and the sequence (`/album/:id/photo/:n`).
- Signals missing (red flag): photo gallery / slideshow where users must back out to grid for every navigation; article series with no "next article" link; product variants requiring 5+ clicks to compare.
- Anti-patterns / mis-applications: Next button that wraps silently to start with no signal; missing Up link traps user in 50-item slideshow; Back button does browser-back instead of pyramid-back.
- Related: [[#Media Browser]], [[#Breadcrumbs]]

### Richly Connected Apps

`tags: surface=[mobile-overlay,do], platform=mobile, foundations=[P-07,P-11,B-01], source=ch.6`

- Use when: the app handles data types the OS already knows how to act on - phone numbers, addresses, dates, email, links, media - or could capture data via device features (camera, mic, GPS).
- What it is: data and affordances inside the app that hand off seamlessly to the dialer, map, calendar, mail, browser, camera, contacts, media player, or share sheet.
- Why it works: mobile OSes lack arbitrary copy/paste between apps; switching apps manually is annoying; deep-linking lets each app do what it does best.
- How to apply:
  - Phone numbers to dialer; addresses to map / contacts; dates to calendar; emails to mail; URLs to browser; media to players.
  - Use platform intents (`tel:`, `mailto:`, `geo:`, `Linking.openURL`, share sheet) instead of building in-app equivalents.
  - Where the user needs to capture data (check deposit, social post, ticket scan), invoke the camera or mic directly inside the flow.
  - Use auto-fill / contact suggestions / location prefill where available to skip typing.
- Signals present (in code/spec): `Linking.openURL` calls; `UIActivityViewController` / `Intent` invocations; camera/mic permission requests scoped to the flow that needs them; `tel:`/`mailto:`/`geo:` schemes in templates.
- Signals missing (red flag): the app re-implements a contact picker, address-book search, or in-app dialer; the user has to leave the app, copy a number, switch apps, paste, then come back; capture flows require manual data entry that the camera could read.
- Anti-patterns / mis-applications: walling the user in to prevent app-switching; opening external apps without warning during a destructive flow (e.g., mid-checkout); requesting permissions the user can't yet motivate (camera permission on first launch with no context).
- Related: [[#Make It Mobile]], [[principles#P-13. Social Proof + Collaboration]]

### Settings Editor

`tags: surface=[settings,form], platform=any, foundations=[P-07,P-09,P-03], source=ch.2`

- Use when: any surface where users need to view + change configuration - app preferences, OS settings, account/profile, document properties, product configurator.
- What it is: a findable, self-contained page (or window) with settings grouped into named pages/tabs; random-access, not sequential.
- Why it works: settings are looked up *and* edited; users come back repeatedly and need to find the same control twice. Conventions (top-right, gear icon) are deeply learned - break at your peril.
- How to apply:
  - Findable: follow platform convention (top-right avatar menu on web; Settings app on mobile; menu bar on desktop).
  - Group settings into named pages whose titles let users guess contents; card-sort with real users to validate.
  - Present groups via tabs, Two-Panel Selector, or One-Window Drilldown with a top-page menu.
  - Show current values at a glance - this is a viewing surface as much as an editing one.
  - Decide one save model: immediate-apply (OS-style) or explicit Save/Cancel (web-style). Follow platform convention.
  - For huge spaces: top-page shortcut list to most-used items + search box.
- Signals present (in code/spec): a `/settings` (or `/account`, `/preferences`) route with a left rail or tab strip of categories; gear/avatar entry from global nav; each category is its own subroute with a form.
- Signals missing (red flag): settings scattered across multiple unrelated screens; no single "settings" entry point; settings only reachable from inside the feature they configure; mobile app with no Settings screen at all.
- Anti-patterns / mis-applications: deep 4-level hierarchy with no search; settings that auto-save silently with no confirmation OR save button you must hunt for; "advanced" tab hiding things 80% of users need; mixing destructive actions (delete account) with cosmetic ones (theme).
- Related: [[#Menu Page]], [[#Two-Panel Selector or Split View]]

### Sign-In Tools

`tags: surface=[entry,settings], platform=any, foundations=[P-07,P-09], source=ch.3`

- Use when: site/app has user accounts and users sign in regularly - need ambient access to account/profile/cart/notifications/help/sign-out.
- What it is: a cluster of utility nav placed in the upper-right corner (by convention), typically a small avatar/name that expands into a menu.
- Why it works: pure convention - users have learned to look upper-right for "me". Honour the convention.
- How to apply:
  - Reserve upper-right for signed-in user tools across every page.
  - Show user name and small avatar (if not already elsewhere).
  - Cluster: Sign Out (mandatory), Account Settings, Profile, Help, Customer Service, Cart, Notifications, Favourites/Wishlist, Home.
  - Keep visually quiet - utility, not feature.
  - Use standard icons (cart, bell) where recognisable.
  - When signed out, replace with a sign-in box or "Sign in" CTA.
  - Site Search often lives adjacent.
- Signals present (in code/spec): a `UserMenu` / `AccountDropdown` rendered top-right in the header; clicking expands a menu with the canonical actions; Sign Out is present and visible.
- Signals missing (red flag): no obvious way to sign out; account settings reachable only by deep URL; cart/notifications scattered across different corners; avatar shows but has no menu.
- Anti-patterns / mis-applications: Sign Out hidden 3 levels into Settings; avatar links directly to profile with no menu (so no Sign Out); notification bell with no clear "see all" route; cart icon that opens a modal instead of going to cart route (so back button breaks).
- Related: [[#Settings Editor]]

### Sitemap Footer

`tags: surface=[overview,settings], platform=any, foundations=[P-09,P-12], source=ch.3`

- Use when: site has many sections, you don't want to burden header/sidebar with all of them, and you have vertical space at page-bottom; or fat menus aren't accessible/feasible.
- What it is: a comprehensive directory of links at page footer, grouped into named categories - an index of the site below every page.
- Why it works: turns multilevel into fully-connected without header clutter; catches users who scroll to bottom; static links work with screen readers and require no fine pointer control.
- How to apply:
  - Include main content categories, "about/contact/careers", help/support, partner/sister sites, community, current promotions, donate (non-profit).
  - Place on every page as part of global layout.
  - Pair with a task-oriented header - header answers "what's this / where do I go right now", footer answers "what else is here".
  - Keep within ~half a viewport tall; multi-column.
- Signals present (in code/spec): a `Footer` / `SiteFooter` component rendered in the root layout; contains 3-6 columns of categorised links; not just legal/social icons.
- Signals missing (red flag): footer is one row of "(c) 2026" + social icons; complex content site with no flat link index anywhere; users have no way to discover deep pages without using header dropdowns.
- Anti-patterns / mis-applications: footer that duplicates header exactly (no extra coverage); footer styled so small/grey users skip it; footer with disabled or broken legacy links never audited.
- Related: [[#Fat Menus]], [[#Menu Page]]

### Small Multiples

`tags: surface=[data,overview], platform=desktop, foundations=[V-01,P-09], source=ch.9`

- Use when: the data has more than two dimensions and a single plot can't show them all; users would otherwise be flipping between separate charts to compare slices.
- What it is: a grid (1D strip or 2D matrix) of *small, identically-formatted* mini-pictures, where each cell varies along one or two extra dimensions (e.g., one map per year, one chart per region).
- Why it works: side-by-side placement removes the memory burden of flipping between views - every difference is visible in one glance. Identical framing turns *every* visual difference into a meaningful signal.
- How to apply:
  - Decide whether to encode 1 extra dimension (strip / comic) or 2 (matrix); for 2D, columns = one dim, rows = the other.
  - Hold every non-varying property constant: axis ranges, scale, color encoding, aspect ratio, size.
  - Label each tile minimally; rely on row/column headers for the varying dimension.
  - Bin or "shingle" if a continuous dimension has too many values (5-10 tiles per row max).
  - Requires real screen real estate - defer to a different pattern (or sparklines) on small mobile screens.
  - Sparklines are tiny Small Multiples for inline / column-cell use; strip labels and axes entirely.
- Signals present (in code/spec): a `grid` / `flex-wrap` layout of identical chart components mapped over a dimension; shared scale config (`yDomain`, `colorScale`) passed to every tile; `sparkline` cells inside table rows.
- Signals missing (red flag): a "View by year" dropdown that swaps one chart in place, forcing users to remember the previous view; a dashboard with many disparate plots of the *same* metric across categories, each styled differently.
- Anti-patterns / mis-applications: tiles with different y-axis ranges (defeats comparison); tiles with cosmetic styling differences that aren't data; too many tiles (100 sparklines is just noise without binning); using small multiples on a phone-sized viewport where each tile becomes unreadable.
- Related: [[#Multi-Y Graph]], [[#Cards]]

### Smart Menu Items

`tags: surface=[do,make], platform=any, foundations=[P-01,P-03], source=ch.8`

- Use when: menu items, button labels, or links that operate on a specific object or context (Close X, Undo Y, Delete Z) where the target can change at runtime.
- What it is: labels that dynamically include the name of the object or last action they will affect, instead of generic verbs.
- Why it works: the UI becomes self-explanatory; reduces accidental destructive operations; supports Safe Exploration.
- How to apply:
  - When selection or last action changes, update the label to include the specific name ("Undo Increase Clarity", "Delete 'Chapter 8'").
  - Disable the item entirely when there is no valid target.
  - For multi-selection, use plural form ("Delete Selected Objects").
  - Apply equally to buttons, links, tooltips - not only menu bars.
- Signals present (in code/spec): menu/button labels built from a template that interpolates `currentSelection.name` or `lastAction.name`; disabled state bound to selection.
- Signals missing (red flag): "Delete" / "Undo" labels that never specify *what* - user has to remember context to act safely.
- Anti-patterns / mis-applications: smart labels that overflow narrow menus, truncating mid-word; using object IDs instead of human names ("Delete 0x7F3E").
- Related: [[#Multilevel Undo]], [[#Cancelability]], [[principles#P-01. Safe Exploration]]

### Spinners and Loading Indicators

`tags: surface=[do,make], platform=any, foundations=[P-02,P-08], source=ch.8`

- Use when: a user-initiated operation will take longer than ~1 second, blocking the UI or running in the background.
- What it is: a spinner (stateless animation) for short waits; a loading indicator (meter with percent / bytes / time-remaining) for longer ones.
- Why it works: tells the user the system is alive; experiments show users tolerate longer waits when there is feedback; sets expectation for "wait" vs "switch tasks".
- How to apply:
  - <0.1s: no indicator needed.
  - 0.1-1s: usually no indicator; maybe a pointer change.
  - >1s and indeterminate: stateless spinner.
  - >1s and measurable: loading indicator with proportion complete, time remaining, what's happening, and a way to stop.
  - Don't lock the rest of the UI if you can avoid it.
- Signals present (in code/spec): a shared `<Spinner>` and `<ProgressBar>` component; async actions wrap state with `pending`/`progress`/`done`; thread-safe progress updates.
- Signals missing (red flag): buttons that go quiet after click with no visible state change; long fetches that show no progress and no cancel.
- Anti-patterns / mis-applications: spinner that runs forever after the operation finished (forgotten teardown); progress bar with no relationship to actual progress (cosmetic only).
- Related: [[#Cancelability]], [[#Loading or Progress Indicators]]

### Streams and Feeds

`tags: surface=[overview,data,mobile-overlay], platform=any, foundations=[P-08,P-13], source=ch.2`

- Use when: content updates frequently and the user checks it many times a day; or a team collaborates asynchronously around posts/comments/documents.
- What it is: a scrollable, dynamically-updated vertical (sometimes horizontal) ribbon of cards in reverse-chronological (or algorithmic) order.
- Why it works: latest-first ordering rewards every visit with novelty; matches Microbreaks - short visits, low cost, high reward.
- How to apply:
  - Order newest-first by default; for chat/collab, newest-at-bottom is standard.
  - Each card shows what (title + teaser + thumb), who (author/source), when (relative time, then absolute as it ages), where (link).
  - Offer pull-to-refresh / explicit refresh control plus auto-prepend on new items.
  - Show "More" or drill-down to full content via [[#Two-Panel Selector or Split View]], [[#One-Window Drilldown]], or [[#List Inlay]].
  - Low-effort feedback inline on each card (like, thumb, star, reply field).
  - Use [[#Infinite List]] for long scroll history.
- Signals present (in code/spec): a `Feed`/`Stream`/`Timeline` component renders a virtualised list of `Card` items sorted by created_at desc; pagination is cursor- or infinite-scroll; cards have inline reaction/reply affordances.
- Signals missing (red flag): user's primary surface is a static list that requires manual refresh; new items appear only on hard reload; cards lack timestamp and author; engagement requires drilling into a full page.
- Anti-patterns / mis-applications: algorithmic re-ordering with no recency fallback; "newest" tab buried behind a "for you" default the user cannot disable; feed that hides timestamps to disguise stale content; in-feed ads that mimic the card pattern with no label.
- Related: [[#Infinite List]], [[principles#P-08. Microbreaks]]

### Structured Format

`tags: surface=[form,entry], platform=any, foundations=[P-07,P-12], source=ch.10`

- Use when: the field captures a value with a *universal*, *predictable*, *fixed-length* format that doesn't vary by user or locale - security codes, card CVV chunks, single-country phone numbers, license keys.
- What it is: a row of small text fields, each sized to one segment of the value, with focus auto-advancing as each fills.
- Why it works: the shape of the inputs tells the user the expected format without requiring instructions. Short segments are easier to scan, double-check, and dictate. Auto-advance reduces typing friction.
- How to apply:
  - One sub-field per natural segment; size to match segment length.
  - Auto-advance focus on segment completion; allow backspace to retreat into the previous segment.
  - Show separators (dashes, slashes, colons) between fields as static text.
  - Pair with an [[#Input Prompt]] for date / time segments ("MM", "DD", "YYYY").
  - Never use for any field that varies internationally (postal codes, phone numbers, addresses, names) - fall back to [[#Forgiving Format]].
  - Support paste across all segments (paste of "123456" should populate all six boxes, not just the first).
- Signals present (in code/spec): multi-input OTP / PIN / code components (`<OTPInput>`, `<PinInput>`); explicit `onChange` handlers that advance `ref.current.focus()`; `inputMode="numeric"` with `maxLength={1}` per segment.
- Signals missing (red flag): a "phone number" field that's one box and rejects spaces (use [[#Forgiving Format]] instead); a verification-code field that's one long text input asking for "6 digits."
- Anti-patterns / mis-applications: using structured format for international phone numbers (US-shape `(___) ___-____` breaks for everyone else); blocking paste because the input is split; no backspace-retreat (user has to click into the previous box to fix a typo); structured format on a field that *could* legitimately vary.
- Related: [[#Forgiving Format]], [[#Input Prompt]], [[principles#P-07. Habituation]]

### Tags

`tags: surface=[data,overview], platform=any, foundations=[P-10,P-13], source=ch.2`

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
- Related: [[#Deep Links]]

### Thumbnail Grid

`tags: surface=[data,overview], platform=any, foundations=[V-01,P-09], source=ch.7`

- Use when: items have small visual representations of similar size/style (images, logos, screen captures) and users want a dense overview and quick scanning.
- What it is: a 2D grid of equally sized thumbnails with small text metadata.
- Why it works: a specialisation of Grid of Equals - visually powerful, scannable, and a strong fingertip target on touch.
- How to apply:
  - Scale all thumbnails to the same size; keep metadata small relative to the picture.
  - Decide cropping policy: uniform aspect for product catalogues; preserved aspect for personal photos.
  - Group into Titled Sections if the list is long.
  - Support multi-select for move/delete/view.
- Signals present (in code/spec): a `Grid`/`LazyVGrid` with fixed-aspect image cells; image-resize pipeline producing consistent thumbnails.
- Signals missing (red flag): visual gallery rendered as a vertical column of full-width images; user has to scroll a lot to scan; no multi-select.
- Anti-patterns / mis-applications: forcing portrait crops on personal photos where orientation is meaningful; mixing thumbnail sizes/aspects without intent, producing a ragged grid.
- Related: [[#Cards]], [[#Carousel]], [[#Grid of Equals]]

### Titled Sections

`tags: surface=[overview,settings,form], platform=any, foundations=[V-01,P-03], source=ch.4`

- Use when: a screen has a lot of content that must stay visible (no hiding) but needs to break into a few thematic chunks the user can scan.
- What it is: each section gets a strong, short title and a visual separator (whitespace, contrast strip, background block) so the chunks read as distinct units.
- Why it works: chunked content with named labels gives the user the information architecture for free; titles act as scan landmarks; eye is guided through coherent units rather than a wall of content.
- How to apply:
  - Split content into named chunks first; titles should be 1-3 words and self-explanatory.
  - Style titles with clearly higher visual weight (size, weight, color, or contrasting strip).
  - Separate sections with whitespace, a tinted background, or a thin rule - pick one and apply consistently.
  - If chunks resist naming, the grouping is probably wrong - re-cut the content.
  - If the page still overwhelms, consider Module Tabs, Accordion, or Collapsible Panels instead.
- Signals present (in code/spec): repeated `Section` component with a `title` prop; semantic `<section>` + `<h2>` pairs; consistent vertical rhythm between titled blocks.
- Signals missing (red flag): a long settings or profile page with no headers; multiple unrelated forms stacked with no separators; "Miscellaneous"/"Other" buckets covering most of the content.
- Anti-patterns / mis-applications: deeply nested boxed sections that become visual noise; titles styled so weakly they don't act as landmarks; using Titled Sections when content really needs to be hidden behind tabs/accordion.
- Related: [[#Module Tabs]], [[#Accordion]], [[#Collapsible Panels]]

### Touch Tools

`tags: surface=[mobile-overlay,focus], platform=mobile, foundations=[P-08,V-01], source=ch.6`

- Use when: designing an immersive full-screen experience (video, photo, map, game, book reader) where controls are needed sometimes but should not steal space the rest of the time.
- What it is: controls that appear in a small translucent overlay on tap and disappear after a few seconds of inactivity.
- Why it works: content gets the full screen by default; user reclaims controls on demand; translucency signals impermanence.
- How to apply:
  - Show the unadorned content first, full-bleed.
  - Reveal controls on tap (or tap of a specific region to avoid accidental activation).
  - Render controls in a small translucent floating area, not a solid bar.
  - Auto-hide after ~5 seconds of nonuse, or immediately on outside tap.
  - Make sure essential safety/exit affordances aren't only behind Touch Tools.
- Signals present (in code/spec): a `ControlsOverlay` component with a visible-on-tap timer; translucent background style; gesture handler on the content area; auto-hide via `setTimeout`.
- Signals missing (red flag): persistent toolbar covering a quarter of a video screen; no way to clear the chrome on a full-screen photo viewer.
- Anti-patterns / mis-applications: hiding controls users need constantly (e.g., volume in a video they're learning from); auto-hiding so fast users can't tap a button; no visual feedback that a tap will summon controls; placing destructive actions in the auto-hiding overlay.
- Related: [[principles#P-08. Microbreaks]], [[#Loading or Progress Indicators]]

### Two-Panel Selector or Split View

`tags: surface=[data,focus,overview], platform=desktop, foundations=[P-04,P-09], source=ch.7`

- Use when: you need both the overall list structure and the selected item's content visible simultaneously, and the display is wide enough for two panels (desktop, tablet).
- What it is: two side-by-side panels - list on the left/top, content of the selected item on the right/bottom.
- Why it works: eliminates the context switch of a full screen reload; the list acts as a permanent "You are here" signpost while the user browses items.
- How to apply:
  - Place list on left or top; details on right or bottom (mirror for RTL).
  - Single click selects; arrow keys also change selection.
  - Visually mark the selected row (inverted, tinted, or bordered).
  - Reload only the details panel, not the surrounding chrome.
- Signals present (in code/spec): a layout with a persistent list view + detail view rendered in the same route (e.g., `MailListView` + `MessageDetailView` siblings under one screen); selection state lives in the parent.
- Signals missing (red flag): a wide-screen list view that pushes detail to a new route forcing the user to use back-button to return to the list; selection state lost on detail load.
- Anti-patterns / mis-applications: cramming a Two-Panel layout onto a phone where the detail panel ends up unreadable; detail panel reloads chrome on every selection.
- Related: [[#One-Window Drilldown]], [[#List Inlay]], [[principles#P-04. Changes in Midstream]]

### Vertical Stack

`tags: surface=[mobile-overlay,form], platform=mobile, foundations=[P-03,V-01], source=ch.6`

- Use when: designing most mobile web or content-heavy mobile screens, especially forms and text-based content that must work across many device widths.
- What it is: a single scrolling column of content with line-wrapping text and stacked controls; little or no side-by-side layout.
- Why it works: adapts gracefully to unknown device widths and font sizes; vertical scrolling is cheaper than horizontal scroll or zoom; lets the most important content take the top of the screen.
- How to apply:
  - Lay out content in one column, most important on top.
  - Put form labels above their controls, not beside them, to reclaim horizontal space.
  - Put buttons side-by-side only when total width is guaranteed to fit (no localization risk).
  - Use thumbnail-beside-text only via Collections and Cards pattern.
  - Don't waste the top ~100 px on logos, ads, or stacked toolbars.
  - Verify the design at the smallest realistic width (e.g., 320-360 px).
- Signals present (in code/spec): one vertically scrolling container per screen; flex column or stack layout primitive; labels rendered above inputs; no fixed-width pixel measurements on outer containers.
- Signals missing (red flag): mobile screen requires horizontal scroll or pinch-zoom; side-by-side form labels; "above the fold" filled by logo/banner before any useful content; design breaks at small widths.
- Anti-patterns / mis-applications: porting a desktop two-column layout untouched; cramming buttons side-by-side that overflow once translated; stacking so many toolbars at the top that content begins below the fold.
- Related: [[#Collections and Cards]], [[#Bottom Navigation]], [[#Generous Borders]]

### Visual Framework

`tags: surface=[overview,settings], platform=any, foundations=[P-07,P-09,V-01], source=ch.4`

- Use when: building any multi-page site or multi-window app that must feel like one designed product.
- What it is: a shared template (color, fonts, layout grid, header/footer, nav placement, writing style) reused across every screen with enough flexibility to host varying content.
- Why it works: consistency lets the framework fade into the background so changing content stands out; users orient by remembered position rather than re-parsing each screen; reinforces brand identity.
- How to apply:
  - Define one place (CSS, design tokens, component library) for color, type, spacing, and layout rules.
  - Keep "you are here" signposts (titles, logos, breadcrumbs, current-nav indicator) in the same place every screen.
  - Standardize navigation devices (global nav, OK/Cancel, Back, Quit, Progress Indicator, Breadcrumbs).
  - Standardize the technique used for Titled Sections, gutters, margins, label/control gaps.
  - Allow the home/landing screen to deviate while still sharing the framework's color, type, and grid.
- Signals present (in code/spec): shared layout components (`AppShell`, `PageHeader`, `PageFooter`); single source of design tokens; per-route content slots inside a fixed shell.
- Signals missing (red flag): pages roll their own header/footer; tokens duplicated per route; "themed" sections of the app feel like a different product.
- Anti-patterns / mis-applications: framework so heavy that home and inner pages look identical, killing the home page's job to orient; framework that locks per-page content into rigid widths the content can't fill.
- Related: [[principles#P-07. Habituation]], [[principles#P-09. Spatial Memory]]

### Wizard

`tags: surface=[form,do,entry], platform=any, foundations=[P-04,P-05], source=ch.2`

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
- Related: [[#Progress Indicator]], [[#Good Defaults and Smart Prefills]], [[principles#P-04. Changes in Midstream]]
