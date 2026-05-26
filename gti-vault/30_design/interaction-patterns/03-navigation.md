---
title: Getting Around — Navigation, Signposts, and Wayfinding
source_chapter: 3 — Getting Around: Navigation, Signposts, and Wayfinding
purpose: Catalog of Ch.3's navigation, signpost, and wayfinding patterns, with audit-ready signals
---

# Getting Around — Navigation, Signposts, and Wayfinding

Patterns that decide how the user moves between screens, knows where they are, and gets unstuck. Audit lens: name the navigational model first (Hub-and-Spoke, Fully Connected, Multilevel, Step by Step, Pyramid, Pan-and-Zoom, Flat). Then check (a) every screen has a "you are here" cue, (b) every dead-end has an Escape Hatch, (c) global nav doesn't appear where it interferes (slideshow, modal, focused flows).

## Navigational models

Source: Ch.3 intro (book p.135-141). Pick one — or knowingly mix — before applying any specific pattern below.

- **Hub and Spoke** — home/hub screen lists major destinations; user goes out to a spoke, does the job, returns to the hub. *When to choose:* small-screen mobile apps; suites with a small fixed number of major sections. *Audit signal:* there's a clearly-named home screen (or `Tab 0`) every spoke screen returns to; spokes have a "Back to home" affordance and no global nav of their own.
- **Fully Connected** — every screen carries global nav that reaches every other screen in one hop. *When to choose:* websites and apps with under ~7 top-level sections where users need to jump anywhere from anywhere. *Audit signal:* a `GlobalNav` / `Header` / `Sidebar` component rendered on every layout; every route in it links to a top-level destination.
- **Multilevel / Tree** — top sections fully connected, but subpages only reach siblings within their section. *When to choose:* large content sites where subpage-to-subpage jumps across sections are rare. *Audit signal:* nav rail changes per-section; subpages list siblings in a sidebar; cross-section nav requires going up one level then over.
- **Step by Step** — prescribed linear sequence with prominent Back/Next; common for wizards, checkouts, onboarding, slideshows. *When to choose:* tasks with required order, branching, or guided learning. *Audit signal:* route is `/flow/:step` or stateful `step` variable; Back/Next buttons are the only nav; global nav is hidden.
- **Pyramid** — variant of step-by-step where a hub/menu page lists the whole sequence; user can pick any item and then Back/Next from there. *When to choose:* a gallery, photo album, or article series where users sometimes want one item and sometimes the whole. *Audit signal:* an index route plus item detail routes that include `prev`/`next` siblings and a "back to index" link.
- **Pan and Zoom** — single large virtual space (map, large image, doc); navigation is pan/zoom/reset, not page-to-page. *When to choose:* maps, image viewers, info graphics, time-based media. *Audit signal:* a `MapView` / `Canvas` / `ZoomableImage` component with pan/zoom/reset controls and no page chrome inside the artifact.
- **Flat Navigation** — almost no navigation between screens; everything reachable via menus, toolbars, palettes within one workspace (Photoshop, Excel). *When to choose:* tool-dominant apps where users live in one canvas for a session. *Audit signal:* one main workspace component; tool access via menus/toolbars/palettes; modal panels for transient sub-tasks.

Mix-and-match is normal. The cost of fully-connected nav everywhere: screen clutter, cognitive load, and signalling that leaving the page is fine. Hide global nav inside focused flows.

## Patterns

### Clear Entry Points

- Use when: surface gets many first-time or infrequent users who need direction on what to do first; a small set of tasks covers most arrivals.
- What it is: a small number (1-3) of large, plainly-labelled "front doors" that dominate the landing surface, with other navigation visually demoted.
- Why it works: removes "OK, now what?" paralysis; gives a confused user one obvious next step. Supports [[01-foundations-cognition#P-02. Instant Gratification]].
- How to apply:
  - List the top tasks new users want; cover most of them in 1-3 entry points.
  - Use plain task-language, never product/tool jargon.
  - Make the entry points visually proportional to their importance (big, well-spaced, high-contrast).
  - Demote global nav, utility nav, etc. — they're hallways, not front doors.
  - On app launch, a startup dialog with a few labelled actions counts (Illustrator: New, Open, Recent).
- Signals present (in code/spec): landing route has 1-3 large CTAs above the fold; secondary nav is smaller; copy uses verbs ("Start a new trip", "Buy a Tesla").
- Signals missing (red flag): home/launch screen is a wall of equal-weight tiles, a hero carousel with no CTA, or a chrome shell that defers to global nav for the next click.
- Anti-patterns / mis-applications: 6+ CTAs labelled "Learn more" with no differentiation; entry point that opens a modal that opens a modal; expert app with required entry-point modal that experts must dismiss every launch.
- Related: [[02-information-architecture#Mobile Direct Access]], [[01-foundations-cognition#P-02. Instant Gratification]]

### Menu Page

- Use when: a screen's sole purpose is to be a table of contents — show where the user can go and let them pick.
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
- Related: [[02-information-architecture#Feature, Search, and Browse]], [[02-information-architecture#Settings Editor]]

### Pyramid

- Use when: surface contains a sequence (slideshow, photo album, article series, product variants) that users sometimes traverse in order and sometimes hit a single item out of context.
- What it is: each item has Back/Next/Up links; an index/parent page lists the whole sequence so users can jump in anywhere.
- Why it works: gives three navigation choices (Back, Next, Up) instead of two; serves both browsers (item-at-a-time) and pickers (jump from index) without forcing pogo-sticking.
- How to apply:
  - Build an index/parent page that lists all items (grid, thumb list, or rich list).
  - On each item page: Back, Next, and Up (return to index) links/buttons; preview next item's title/thumb if space allows.
  - For loops (last → first), check that users know they've wrapped; usually safer to terminate at the index.
- Signals present (in code/spec): an index route plus item routes with `prev`/`next`/`index` props; URL includes both the item id and the sequence (`/album/:id/photo/:n`).
- Signals missing (red flag): photo gallery / slideshow where users must back out to grid for every navigation; article series with no "next article" link; product variants requiring 5+ clicks to compare.
- Anti-patterns / mis-applications: Next button that wraps silently to start with no signal; missing Up link traps user in 50-item slideshow; Back button does browser-back instead of pyramid-back.
- Related: [[02-information-architecture#Media Browser]], [[03-navigation#Breadcrumbs]]

### Modal Panel

- Use when: a small focused task or a required decision must be handled before the user can continue (sign-in mid-checkout, "save as" filename, important confirmation).
- What it is: a panel rendered atop the current screen with all other navigation suppressed (often a lightbox/dim layer behind it).
- Why it works: forces one decision in one place; eliminates competing nav so user's attention channels into the next step.
- How to apply:
  - Place it visually centred over the screen the user came from.
  - One, two, or at most three labelled exit buttons with verb labels ("Save", "Don't save", "Cancel"); plus a Close/X.
  - Use lightbox/dim to focus the eye; make the panel large enough to find effortlessly.
  - Use sparingly — it interrupts; if input can be deferred (asked inline, later), prefer that.
  - On web prefer overlay components, not OS-level modals.
- Signals present (in code/spec): a `Modal`/`Dialog`/`Sheet` component portal-rendered with a backdrop; route or state has `isOpen`; focus is trapped; ESC closes; primary action has prominent button styling.
- Signals missing (red flag): a destructive action (delete, irreversible) fires with no confirmation; mid-flow "extra info" rendered as a new page instead of a modal, losing context.
- Anti-patterns / mis-applications: modal cascade (modal opens modal opens modal); no close affordance; modal used for routine choices that could be inline; modal that the user can dismiss to nowhere (e.g. lands on a blank screen); modal with no focus trap so keyboard users tab into the page behind.
- Related: [[03-navigation#Escape Hatch]], [[08-actions]], [[01-foundations-cognition#P-01. Safe Exploration]]

### Deep Links

- Use when: surface has rich, specific, parameterised state (map location + zoom, video timestamp, search-with-filters, multi-tab view) worth saving and sharing.
- What it is: a URL (or app-link) that captures both content position and application state, so loading it restores what the user was seeing.
- Why it works: lets users bookmark or share an exact state; converts ephemeral UI configurations into permanent addressable resources; in mobile, lets URLs route into native apps for richer playback.
- How to apply:
  - Reflect user state in the URL continuously as they navigate/configure.
  - Decide what to capture (position, filters, view mode, search) and what to leave personal (zoom, magnification).
  - Provide an explicit "Link" / "Share" affordance that copies the URL — most users won't think to copy from the address bar.
  - Optionally provide an Embed snippet for sites that allow embedding.
  - Mobile: register universal links (iOS) / app links (Android) so shared URLs open the native app.
- Signals present (in code/spec): query params reflect filter/sort/view state; the back button restores prior state; share button copies current URL; on mobile, `apple-app-site-association` / `assetlinks.json` declares deep-link routes.
- Signals missing (red flag): filters/sort/search live in client state only and reset on reload; sharing a URL drops the user on a blank landing page; mobile share opens browser when an installed app exists.
- Anti-patterns / mis-applications: URL captures so much that loading it overwrites user-pref settings (font, theme); URL stale within minutes because content moved; sensitive state (auth tokens, personal filters) embedded in shareable URL.
- Related: [[02-information-architecture#Alternative Views]], [[09-complex-data]]

### Escape Hatch

- Use when: a screen has limited navigation (modal, wizard step, OS error, 404, deep-linked page out of context) and the user might want a one-tap return to a known place.
- What it is: a well-labelled button/link that returns the user to a safe known location (home, hub, parent, the main app shell).
- Why it works: prevents trapping users; makes the surface safe to explore (matches [[01-foundations-cognition#P-01. Safe Exploration]]); recovers users from dead-ends rather than losing them.
- How to apply:
  - Every modal, every wizard step, every error/404, every limited-nav screen carries one.
  - Label it plainly ("Cancel", "Back to home", "Go back to LinkedIn.com").
  - Common forms: clickable logo top-left → home; Cancel button in dialog; "Back to X" link with user's avatar on settings detached pages.
  - On 404/500 error pages, link to home + offer search.
- Signals present (in code/spec): every modal has a Close button; every error page has a "back to home" link; logo in header is a Link to `/`.
- Signals missing (red flag): a settings sub-page with no global nav and no "back to app" link; a wizard final step with no Cancel; a 404 page that has no nav at all; "loading" screen that never resolves and has no abort.
- Anti-patterns / mis-applications: Cancel button that requires confirmation to cancel; logo that's an `<img>` not a link; "back" button that does `history.back()` and ends up on the prior site; multiple escape hatches with different destinations on the same screen.
- Related: [[03-navigation#Modal Panel]], [[01-foundations-cognition#P-01. Safe Exploration]], [[01-foundations-cognition#P-04. Changes in Midstream]]

### Fat Menus

- Use when: site has many pages in multiple categories (often 3+ levels deep) and you want to expose most of the structure to casual browsers from any page.
- What it is: a drop-down or fly-out menu rich enough to show dozens of links organised into Titled Sections, often spanning the page horizontally.
- Why it works: makes a multilevel site behave fully-connected — users jump between any two leaves in one click; surfaces complexity progressively (hidden until hover/click) without burying it.
- How to apply:
  - Group links into Titled Sections ([[04-layout]]) with sensible category names.
  - Spread horizontally; use multiple columns; avoid going taller than the browser viewport.
  - Use whitespace, headers, dividers, modest graphics; blend with site visual style.
  - Verify with screen readers — many fat-menu implementations break a11y; fall back to [[03-navigation#Sitemap Footer]] when in doubt.
  - On mobile: linearise into stacked vertical sections, or move to a dedicated nav route.
- Signals present (in code/spec): `MegaMenu` / `FatMenu` component; top-level nav items have `subMenu` data with grouped children; hover/click opens a panel spanning header width.
- Signals missing (red flag): big multilevel site with only a thin 5-item top nav; users must drill 3 clicks deep to discover a leaf page; sitemap exists only in robots.txt.
- Anti-patterns / mis-applications: fat menu opens on hover with no delay so it flashes during cursor traverse; menu so tall it overflows the viewport; menu disappears the moment the cursor leaves the trigger word with no slack; keyboard users can't navigate columns.
- Related: [[03-navigation#Sitemap Footer]], [[04-layout#Titled Sections]]

### Sitemap Footer

- Use when: site has many sections, you don't want to burden header/sidebar with all of them, and you have vertical space at page-bottom; or fat menus aren't accessible/feasible.
- What it is: a comprehensive directory of links at page footer, grouped into named categories — an index of the site below every page.
- Why it works: turns multilevel into fully-connected without header clutter; catches users who scroll to bottom; static links work with screen readers and require no fine pointer control.
- How to apply:
  - Include main content categories, "about/contact/careers", help/support, partner/sister sites, community, current promotions, donate (non-profit).
  - Place on every page as part of global layout.
  - Pair with a task-oriented header — header answers "what's this / where do I go right now", footer answers "what else is here".
  - Keep within ~half a viewport tall; multi-column.
- Signals present (in code/spec): a `Footer` / `SiteFooter` component rendered in the root layout; contains 3-6 columns of categorised links; not just legal/social icons.
- Signals missing (red flag): footer is one row of "© 2026" + social icons; complex content site with no flat link index anywhere; users have no way to discover deep pages without using header dropdowns.
- Anti-patterns / mis-applications: footer that duplicates header exactly (no extra coverage); footer styled so small/grey users skip it; footer with disabled or broken legacy links never audited.
- Related: [[03-navigation#Fat Menus]], [[03-navigation#Menu Page]]

### Sign-In Tools

- Use when: site/app has user accounts and users sign in regularly — need ambient access to account/profile/cart/notifications/help/sign-out.
- What it is: a cluster of utility nav placed in the upper-right corner (by convention), typically a small avatar/name that expands into a menu.
- Why it works: pure convention — users have learned to look upper-right for "me". Honour the convention.
- How to apply:
  - Reserve upper-right for signed-in user tools across every page.
  - Show user name and small avatar (if not already elsewhere).
  - Cluster: Sign Out (mandatory), Account Settings, Profile, Help, Customer Service, Cart, Notifications, Favourites/Wishlist, Home.
  - Keep visually quiet — utility, not feature.
  - Use standard icons (cart, bell) where recognisable.
  - When signed out, replace with a sign-in box or "Sign in" CTA.
  - Site Search often lives adjacent.
- Signals present (in code/spec): a `UserMenu` / `AccountDropdown` rendered top-right in the header; clicking expands a menu with the canonical actions; Sign Out is present and visible.
- Signals missing (red flag): no obvious way to sign out; account settings reachable only by deep URL; cart/notifications scattered across different corners; avatar shows but has no menu.
- Anti-patterns / mis-applications: Sign Out hidden 3 levels into Settings; avatar links directly to profile with no menu (so no Sign Out); notification bell with no clear "see all" route; cart icon that opens a modal instead of going to cart route (so back button breaks).
- Related: [[02-information-architecture#Settings Editor]]

### Progress Indicator

- Use when: a linear or near-linear flow of steps (wizard, checkout, slideshow, onboarding survey) where the user benefits from knowing where they are and how much remains.
- What it is: a compact map of all steps with the current step highlighted, placed near the page edge.
- Why it works: reduces anxiety ("how long is this?"); supports goal-completion; doubles as a back-jump nav to earlier completed steps.
- How to apply:
  - One-line or one-column placement, near Back/Next buttons.
  - Style current step distinctly; mark completed steps differently from upcoming.
  - Label each step with a short title (numbers alone work for very short titles).
  - When jumping back is allowed, make completed steps clickable; disable not-yet-reachable steps in flows with hard preconditions.
  - For non-linear large trees, use [[03-navigation#Breadcrumbs]] instead.
- Signals present (in code/spec): a `Stepper` / `ProgressBar` / `Steps` component above or beside the step content; bound to a step index; completed steps clickable.
- Signals missing (red flag): user in step 4 of unknown-many; checkout flow with no indication of remaining work; slideshow with no page count.
- Anti-patterns / mis-applications: progress bar that lies (animates to 100% but flow continues); steps clickable to jump forward past required input; "step 1 of 1" rendered when there's nothing to indicate.
- Related: [[02-information-architecture#Wizard]], [[03-navigation#Breadcrumbs]]

### Breadcrumbs

- Use when: surface has a hierarchical content structure 2+ levels deep, and users arrive at deep pages via search, filters, deep links, or drilling — need a "you are here" + a way out.
- What it is: a horizontal line of parent-link-arrow-link-arrow-current showing the path from root to the current page.
- Why it works: tells users where they are *relative to the rest of the site*, not just how they got here; lets them ascend any level in one click; supports comparison shopping by jumping to sibling category.
- How to apply:
  - Render on pages below the top level; place near the top of the content area.
  - Use page titles as labels; separator can be `>`, `/`, `»`, or right-pointing arrow.
  - Each ancestor is a link to that level; current page is styled differently (not a link).
  - In tools (Chrome DevTools-style), can also represent in-document hierarchy, not just URL path.
- Signals present (in code/spec): a `Breadcrumbs` component bound to the route ancestor chain; visible on detail/sub-routes; ancestor labels are clickable.
- Signals missing (red flag): deep ecommerce category page with no breadcrumb (so user must use browser back); search results land users on detail pages with no context of category; wiki/doc pages show only the leaf title.
- Anti-patterns / mis-applications: breadcrumbs that show the user's actual click trail instead of the hierarchy (confuses on re-entry); current page is a link to itself; breadcrumb truncated with "…" so middle ancestors are unreachable; breadcrumb separators that look like dividers between unrelated nav items.
- Related: [[03-navigation#Progress Indicator]], [[02-information-architecture#Feature, Search, and Browse]]

### Annotated Scroll Bar

- Use when: long document or data-centric surface where the user scrolls quickly looking for specific items — page numbers, headings, search results, diff regions, alerts.
- What it is: a scroll bar augmented with position-aware indicators — either tooltips that change with scroll position, or static marks in the scroll track.
- Why it works: puts signposts exactly where the user's eyes are during scroll; functions as a 1-D Overview Plus Detail map.
- How to apply:
  - Dynamic indicator: tooltip on the scroll thumb showing nearest section/page/heading, updating as the user drags.
  - Static indicator: coloured marks in the scroll track for diff regions, search matches, errors, comments.
  - Make purpose unambiguous — random colours in a track will baffle users.
  - Tie to current task: if user is searching, show search hits; if comparing files, show diffs; if reading code, show function/symbol.
- Signals present (in code/spec): custom scrollbar/minimap component; on long routes there's a `Minimap` / `ScrollAnnotations` with marks for search hits / diff / cursor position; Find (Cmd-F) decorates scroll track.
- Signals missing (red flag): users scroll through a 500-row table or 50-page doc with no way to find a specific row/page short of reading; in-page search highlights matches in the body but not in the scroll bar.
- Anti-patterns / mis-applications: scroll annotations so dense they obscure the thumb itself; tooltip that lags 500ms behind scroll position; static marks that aren't keyboard-navigable.
- Related: [[09-complex-data]], [[07-lists]]

### Animated Transition

- Use when: transitioning between states that would otherwise feel jarring — zooming, pan, opening/closing panels, route changes, modal mount/unmount, mobile gestures, dock/launch effects.
- What it is: short, purposeful motion that connects two visual states so the eye can track the change.
- Why it works: physical-world transitions are continuous; abrupt jumps disrupt spatial memory and disorient. Animation gives eyes a track; communicates feedback (input received) and hierarchy (where things came from / went to).
- How to apply:
  - Animate state changes that would otherwise dislocate: open/close panels, route transitions, zoom, accordion expand/collapse, list reorder, modal in/out.
  - Keep durations short (typically 150-300ms); easings should feel natural (ease-out for entry, ease-in for exit).
  - Use animation to *show where things came from*: dock magnification on hover, window-minimise-to-icon.
  - Respect `prefers-reduced-motion` and provide an "off" path.
  - Don't animate just to animate — motion has cost (attention, battery, accessibility).
- Signals present (in code/spec): use of motion library (`framer-motion`, `react-spring`, native `Animated`, CSS transitions); shared element transitions across routes; `prefers-reduced-motion` honoured in tokens.
- Signals missing (red flag): modals snap in/out; route changes are instant white-flash; list reorder jumps without animation, losing user's place; zoom is a hard scale change.
- Anti-patterns / mis-applications: transitions so long users wait on them (400ms+ on every click); animated chrome over performance-critical surfaces (typing latency); ignoring `prefers-reduced-motion`; bounces and overshoots on every interaction so the app feels twitchy.
- Related: [[01-foundations-cognition#P-08. Spatial Memory]], [[05-visual-style]]
