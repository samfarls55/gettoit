---
title: Layout of Screen Elements
source_chapter: 4 — Layout of Screen Elements
purpose: Catalog of chapter 4's patterns, with audit-ready signals
---

# Layout of Screen Elements

Patterns for arranging informational, functional, and framing elements on a screen so users can deduce importance, relationship, and next action at a glance. Apply to web pages, desktop apps, kiosks, and mobile surfaces. Audit lens: does the layout's structure (size, position, density, contrast, alignment) match the semantic priority of the content?

## Layout heuristics

Pre-pattern checks drawn from Ch.4 intro. Run these before reaching for a structural pattern.

- Visual hierarchy: does the relative size, position, density, contrast, and rhythm of each element match its actual importance? Headline > subhead > body > footer.
- Importance cues: are top, upper-left, or upper-right reserved for the most important small items, with whitespace + contrast to set them off?
- Alignment + grid: is the layout built on a consistent grid (margins, gutters) so content reads as harmonious and predictable across screens?
- Proximity (Gestalt): are related items grouped close together and unrelated items separated by whitespace?
- Similarity (Gestalt): do peer items share identical graphic treatment; do "special" items get a small consistent deviation rather than a wholly different treatment?
- Continuity (Gestalt): do edges + lines align so the eye is led where you want it?
- Closure (Gestalt): do groups of items imply a shape (rectangle, column) without needing literal borders?
- Visual flow: is there a clear scan path with only a few focal points, and do the focal points lead in the desired narrative order?
- Responsive enabling: are controls disabled (not hidden) until the user has done the prerequisite step?
- Progressive disclosure: is secondary detail revealed only after the user signals interest (click, hover, tap)?
- UI regions: are header, nav, main content, footer, and panels each present in the conventional location for the platform?

## Patterns

### Visual Framework

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
- Related: [[01-foundations-cognition#P-07. Habituation]], [[01-foundations-cognition#P-09. Spatial Memory]], [[05-visual-style#V-01. Visual hierarchy]]

### Center Stage

- Use when: the screen's primary job is one document, one task, or one piece of content; secondary tools and metadata are decoration around it.
- What it is: a layout that gives the dominant content the largest region of the screen, with smaller side/top panels for tools and supporting content.
- Why it works: an unambiguous focal anchor tells the user what the screen is for in one glance; the periphery is interpreted relative to the center rather than competing with it.
- How to apply:
  - Make the center region at least twice as wide as side margins and twice as tall as top/bottom margins on first paint.
  - Keep the center region above the fold on the smallest target viewport.
  - Reserve big headlines for the top of the center stage to pull the eye in.
  - Use platform genre conventions for what goes in margins (toolbars on top of an editor, nav on the left of a content site).
  - Don't worry about exact position — make it large enough that it's clearly central.
- Signals present (in code/spec): a single dominant route component (canvas, document, map, article) takes most viewport width; toolbars/panels are narrow strips around it; route name maps to one primary object.
- Signals missing (red flag): screen built for a single task but split into 3+ equal columns; primary canvas pushed below the fold by promo banners; multiple competing focal points.
- Anti-patterns / mis-applications: stretching a list/index page into center stage when it's really a Grid of Equals; surrounding the stage with so many tool panels that the center shrinks below its 2x ratio; placing ads in the largest slot.
- Related: [[01-foundations-cognition#P-03. Satisficing]], Collapsible Panels, Movable Panels, [[05-visual-style#V-01. Visual hierarchy]]

### Grid of Equals

- Use when: the screen lists many items of similar style and importance (news articles, products, blog posts, videos, categories) and the user is browsing/previewing.
- What it is: items arranged in a row or matrix using one shared template, each cell with similar visual weight.
- Why it works: equal space + shared template signals "these are peers, pick any"; users learn one cell's interaction model and apply it to all; supports scanning by image, title, or metadata.
- How to apply:
  - Design one cell template (thumbnail + headline + optional subhead/summary) and reuse it across all items.
  - Pick a column count that holds up across viewport widths; verify the narrowest target.
  - Allow static or hover-state highlighting via color/contrast — never change cell position or size.
  - Make every cell linkable to a detail view.
- Signals present (in code/spec): a `.map()` over a homogeneous array rendering one `Card`/`Tile` component; CSS grid or flex-wrap container; uniform `aspect-ratio` on thumbnails.
- Signals missing (red flag): peer items rendered with bespoke per-item layouts; visually inconsistent tile sizes implying false hierarchy; list of similar items shown as a vertical text-only stack with no preview.
- Anti-patterns / mis-applications: one "featured" cell made dramatically larger, breaking the equality contract without justification; mixing genuinely heterogeneous items into a single grid; varying cell height per content length so the grid loses rhythm.
- Related: [[01-foundations-cognition#P-09. Spatial Memory]], Collections and Cards ([[06-mobile#Collections and Cards]]), Titled Sections

### Titled Sections

- Use when: a screen has a lot of content that must stay visible (no hiding) but needs to break into a few thematic chunks the user can scan.
- What it is: each section gets a strong, short title and a visual separator (whitespace, contrast strip, background block) so the chunks read as distinct units.
- Why it works: chunked content with named labels gives the user the information architecture for free; titles act as scan landmarks; eye is guided through coherent units rather than a wall of content.
- How to apply:
  - Split content into named chunks first; titles should be 1–3 words and self-explanatory.
  - Style titles with clearly higher visual weight (size, weight, color, or contrasting strip).
  - Separate sections with whitespace, a tinted background, or a thin rule — pick one and apply consistently.
  - If chunks resist naming, the grouping is probably wrong — re-cut the content.
  - If the page still overwhelms, consider Module Tabs, Accordion, or Collapsible Panels instead.
- Signals present (in code/spec): repeated `Section` component with a `title` prop; semantic `<section>` + `<h2>` pairs; consistent vertical rhythm between titled blocks.
- Signals missing (red flag): a long settings or profile page with no headers; multiple unrelated forms stacked with no separators; "Miscellaneous"/"Other" buckets covering most of the content.
- Anti-patterns / mis-applications: deeply nested boxed sections that become visual noise; titles styled so weakly they don't act as landmarks; using Titled Sections when content really needs to be hidden behind tabs/accordion.
- Related: Module Tabs, Accordion, Collapsible Panels

### Module Tabs

- Use when: a screen has several (fewer than ~10) coherent, similarly-sized content modules and the user only needs to see one at a time.
- What it is: a row of selectable tab labels, each revealing one module's content in the same panel area.
- Why it works: declutters by hiding peer content the user is not currently using; preserves location (one panel area, one selector); cheaper than navigating to a new route.
- How to apply:
  - Split content into a small handful of self-contained, similarly-sized modules with 1–2 word titles.
  - Make the active tab unambiguously visible — connect it to its panel via shape/color, not color alone.
  - Place tabs at top, side, or bottom — but never wrap to a second row.
  - If tabs overflow, ellipsize labels, scroll the strip, or move to a left column. Do not stack rows.
  - Distinguish module tabs from navigational tabs that change route.
- Signals present (in code/spec): `Tabs` / `TabList` / `TabPanel` components with one `panel` rendered at a time; selected tab tracked by index/key in component state, not route.
- Signals missing (red flag): a single page renders 5+ heterogeneous content blocks the user has to scroll past every time; user has to refresh or navigate to switch context between peer modules.
- Anti-patterns / mis-applications: double-row tabs; tabs whose content forces the user to compare across panels (use Accordion or side-by-side instead); tabs disguised as nav (or vice versa); inactive tab styled so similarly to the active one the selection is ambiguous.
- Related: Accordion, Collapsible Panels, Titled Sections, Movable Panels

### Accordion

- Use when: a screen has multiple modules of varying height and the user might want to open more than one at once and preserve their order.
- What it is: a vertical stack of titled panels, each independently expandable/collapsible inline.
- Why it works: keeps the linear order of modules while letting users manage their own view; preserves spatial memory across sessions; better than tabs when modules vary widely in height.
- How to apply:
  - Give each section a concise title that previews the content.
  - Use a chevron or rotating triangle to indicate expandable affordance.
  - Allow more than one section open at a time unless there's a clear reason otherwise.
  - Persist open/closed state across sessions for tool palettes and signed-in apps.
  - Watch for tall expansions pushing later titles off-screen — pick a different pattern if it gets unmanageable.
- Signals present (in code/spec): `Accordion` / `AccordionItem` components; each item has its own `expanded` state; chevron rotates on toggle; multi-expand supported.
- Signals missing (red flag): FAQ page rendered as a wall of Q+A text; navigation menu with deeply nested children flattened into one long list; settings page with very tall, very heterogeneous sections all visible.
- Anti-patterns / mis-applications: forcing single-expand when users want to compare; collapsing every section on revisit instead of remembering state; using accordion for content that should stay visible (e.g., a critical warning); nested accordions more than one level deep.
- Related: Module Tabs, Collapsible Panels, Titled Sections, [[01-foundations-cognition#P-09. Spatial Memory]]

### Collapsible Panels

- Use when: a screen has a primary Center Stage and one or more side/supporting panels whose value varies per user or per session.
- What it is: individual panels that the user can hide or show, returning the freed space to the main content.
- Why it works: progressive disclosure of optional context; lets each user shape the workspace to their task; preserves the primacy of the central content when peripheral panels aren't needed.
- How to apply:
  - Each panel toggles independently via a single click on a clearly affordant control (chevron, panel icon).
  - When a panel collapses, give its space back to the main content (or whitespace) — don't leave dead margins.
  - Animate open/close to anchor the user's spatial model.
  - Decide a sensible default (open or closed) per panel; flip the default if telemetry shows most users open a closed one.
- Signals present (in code/spec): sidebar/aside components with their own `visible`/`collapsed` state; layout uses flex/grid where the main content reflows when the panel hides; toggle button on the panel edge or in the main toolbar.
- Signals missing (red flag): supporting tools forced into a modal because there was nowhere to dock them; sidebar always visible even when it competes with the central task; users complain about cramped main area on small screens.
- Anti-patterns / mis-applications: collapse buttons hidden inside menus rather than directly on the panel; the panel collapses but reserves its grid column so the main content doesn't reflow; multiple peer panels treated as Collapsible Panels when they should be grouped in Module Tabs or an Accordion (implying relatedness).
- Related: Center Stage, Movable Panels, Accordion, Module Tabs

### Movable Panels

- Use when: building a long-session desktop app or signed-in dashboard where users want to personalize layout — creator tools, IDEs, news portals, BI dashboards.
- What it is: titled, independently sized panels users can drag, rearrange, resize, hide, and add to the screen.
- Why it works: lets users place needed tools near where they work and exploit spatial memory; personalization increases engagement and buy-in; accommodates third-party / future modules without redesign.
- How to apply:
  - Give each panel a name, title bar, and sensible default size + position.
  - Support drag-and-drop reposition, ideally into a grid of slots (snap targets) rather than free-floating overlap.
  - Use ghosting (dotted drop target) during drag to show where the panel will land.
  - Let users close individual panels via an "X" on the title bar.
  - Provide a discoverable "add panel" surface that lists available modules — including new/third-party ones.
  - Persist the user's layout across sessions.
- Signals present (in code/spec): grid/dock layout library; per-user persisted layout config (positions, sizes, visibility); drag handles on panel headers; a panel registry/catalog.
- Signals missing (red flag): power-user app with fixed layout users repeatedly request "just let me move it"; multiple feature requests for "hide this panel"; dashboard whose default layout suits no one.
- Anti-patterns / mis-applications: free-floating overlap with no snap grid (panels obscure each other); no way to recover a closed panel; per-session-only state so layout resets on reload; using Movable Panels in a consumer app where most users won't invest in personalizing.
- Related: Center Stage, Collapsible Panels, [[01-foundations-cognition#P-09. Spatial Memory]], [[01-foundations-cognition#P-07. Habituation]]
