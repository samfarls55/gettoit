---
title: Lists of Things
source_chapter: 7 — Lists of Things
purpose: Catalog of Chapter 7's list patterns, with audit-ready signals
---

# Lists of Things

Patterns for presenting interactive collections — articles, photos, messages, search results, files, products, comments — in a screen. The audit lens for this chapter is: given the use case (overview / browse / find / sort / rearrange) and the list's structural traits (length, order, grouping, item type, dynamic behavior), is the chosen pattern the right fit, and is the chosen pattern faithfully implemented?

## Picking a list pattern

A 5-step decision tree (Ch.7 intro, pp.335-339):

1. **What's the use case?** Overview, browse, find specific, sort/filter, or rearrange? Multi-selection or single?
2. **Where do item details land when an item is selected?** Adjacent panel = `Two-Panel Selector or Split View`; replace the screen = `One-Window Drilldown`; expand in place inside the list = `List Inlay`.
3. **Are items visually heavy?** Mixed image+text+actions per item = `Cards`; pure 2D image grid = `Thumbnail Grid`; horizontal strip with browse-and-discover feel = `Carousel`.
4. **Is the list very long or bottomless?** Chunked with explicit nav = `Pagination`; auto-extending = Infinite List / Continuous Scrolling (Ch.6); alphabetised long list = `Alpha/Numeric Scroller` or `Jump to Item`.
5. **Does the user create items?** Use `New-Item Row` at the head or tail of the list instead of a separate creation surface.

## Patterns

### Two-Panel Selector or Split View

- Use when: You need both the overall list structure and the selected item's content visible simultaneously, and the display is wide enough for two panels (desktop, tablet).
- What it is: Two side-by-side panels — list on the left/top, content of the selected item on the right/bottom.
- Why it works: Eliminates the context switch of a full screen reload; the list acts as a permanent "You are here" signpost while the user browses items.
- How to apply:
  - Place list on left or top; details on right or bottom (mirror for RTL).
  - Single click selects; arrow keys also change selection.
  - Visually mark the selected row (inverted, tinted, or bordered).
  - Reload only the details panel, not the surrounding chrome.
- Signals present (in code/spec): a layout with a persistent list view + detail view rendered in the same route (e.g., `MailListView` + `MessageDetailView` siblings under one screen); selection state lives in the parent.
- Signals missing (red flag): A wide-screen list view that pushes detail to a new route forcing the user to use back-button to return to the list; selection state lost on detail load.
- Anti-patterns / mis-applications: Cramming a Two-Panel layout onto a phone where the detail panel ends up unreadable; detail panel reloads chrome on every selection.
- Related: [[#One-Window Drilldown]], [[#List Inlay]], [[01-foundations-cognition#P-04. Changes in Midstream]]

### One-Window Drilldown

- Use when: Small screens (mobile, narrow panels) or list-and-item content that both demand the full width; only one of list-or-item can be on screen at once.
- What it is: List occupies the screen; selecting an item replaces the list view with the item view, with a Back affordance returning to the list.
- Why it works: Shallow hierarchy is easy to navigate; each view gets the entire viewport.
- How to apply:
  - Render the list with whatever layout fits (rows, cards, grid, tree).
  - On selection, replace screen contents with the item view; provide explicit Back/Cancel (or rely on platform hardware back).
  - Optionally add Previous/Next links inside the item view to mitigate "pogo-sticking" back to the list.
  - Keep the back transition fast — no full reload of the list state.
- Signals present (in code/spec): Mobile route pairs like `/items` and `/items/:id` with the list view unmounting on navigation; a NavigationStack push (iOS) / Navigator (RN) per item.
- Signals missing (red flag): Mobile list where tapping an item opens a modal sheet that covers the list partially but does not give the item full space; no Back affordance leaves user stranded.
- Anti-patterns / mis-applications: Forcing One-Window Drilldown on a wide desktop layout when Two-Panel would let the user compare items; losing scroll position on the list when returning from item view.
- Related: [[#Two-Panel Selector or Split View]], [[#List Inlay]], [[03-navigation#Menu Screen]]

### List Inlay

- Use when: Users need to expand item details inline without losing list context, and may want to compare two or more items side-by-side within the list.
- What it is: A vertical column of items; tapping an item expands its detail beneath the row, pushing later items down; multiple items can be open at once.
- Why it works: Detail appears in the context of its neighbours; supports comparison; avoids the screen swap of drilldown.
- How to apply:
  - One column of rows; click toggles open/close in place.
  - Animate the expand/collapse to keep the user oriented.
  - Place the close control near the open control AND at the bottom of long inlays.
  - Use a scrolled container — the column can grow arbitrarily tall.
- Signals present (in code/spec): Accordion-style row components with per-row `expanded` state; ordered list whose items render conditional detail subviews.
- Signals missing (red flag): Long rows where the only way to see detail is full screen swap, even though item details are short; comparison use case forced into a back-and-forth drilldown.
- Anti-patterns / mis-applications: Inlay used for grid-style item layouts where adjacent items get visually broken; close control hidden so user can't easily collapse a long inlay.
- Related: [[#Two-Panel Selector or Split View]], [[#One-Window Drilldown]], [[04-layout#Accordion]]

### Cards

- Use when: A list of heterogeneous items where each item carries a consistent bundle of image + text + a small set of actions (favorite, share, open detail).
- What it is: Self-contained UI tiles — image, title, body, optional actions — laid out in a responsive grid or stream.
- Why it works: Recognisable convention (web/mobile); accommodates variable content lengths and aspect ratios; gives no one item more visual weight than another.
- How to apply:
  - Identify the common shape: image, title, body, rating, actions.
  - Mock the longest and shortest content variants; tune the layout so both read well.
  - Decide which actions are icons vs text links inside the card.
  - Pick a portrait or landscape orientation based on the actual photography.
- Signals present (in code/spec): A reusable `Card` component (`Card.Image`, `Card.Title`, `Card.Actions`) consumed across multiple lists; responsive CSS grid / `LazyVGrid`.
- Signals missing (red flag): Lists of mixed-content items implemented as ad-hoc rows; long items dominate the page because no card primitive normalises their size.
- Anti-patterns / mis-applications: Cards used where items have no commonality (pretending uniformity); over-densely packed cards that lose the breathing room that defines the pattern.
- Related: [[#Thumbnail Grid]], [[04-layout#Grid of Equals]]

### Thumbnail Grid

- Use when: Items have small visual representations of similar size/style (images, logos, screen captures) and users want a dense overview and quick scanning.
- What it is: A 2D grid of equally sized thumbnails with small text metadata.
- Why it works: A specialisation of Grid of Equals — visually powerful, scannable, and a strong fingertip target on touch.
- How to apply:
  - Scale all thumbnails to the same size; keep metadata small relative to the picture.
  - Decide cropping policy: uniform aspect for product catalogues; preserved aspect for personal photos.
  - Group into Titled Sections if the list is long.
  - Support multi-select for move/delete/view.
- Signals present (in code/spec): A `Grid`/`LazyVGrid` with fixed-aspect image cells; image-resize pipeline producing consistent thumbnails.
- Signals missing (red flag): Visual gallery rendered as a vertical column of full-width images; user has to scroll a lot to scan; no multi-select.
- Anti-patterns / mis-applications: Forcing portrait crops on personal photos where orientation is meaningful; mixing thumbnail sizes/aspects without intent, producing a ragged grid.
- Related: [[#Cards]], [[#Carousel]], [[04-layout#Grid of Equals]]

### Carousel

- Use when: A flat list of visually interesting items that the user will casually browse (not search), and vertical space is tight.
- What it is: A horizontal strip or arc of thumbnails the user scrolls/swipes; often with a focused central item.
- Why it works: Encourages browsing and serendipity; compact vertically; "focus plus context" when the centre item is enlarged.
- How to apply:
  - Build uniform thumbnails (stricter than Thumbnail Grid).
  - Show fewer than 10 at a time; hide the rest on either side.
  - Provide large prev/next arrows; animate transitions.
  - Add a scrollbar for long lists; consider enlarging the centre item.
- Signals present (in code/spec): A horizontal scroll view with paged snapping; explicit prev/next controls; possibly a `featured` index in state.
- Signals missing (red flag): Long horizontal list of small items with no visible prev/next affordance; users on desktop have no way to swipe.
- Anti-patterns / mis-applications: Carousel used for items the user needs to search or compare; auto-advancing hero carousels that move before the user finishes reading.
- Related: [[#Thumbnail Grid]], [[06-mobile#Filmstrip]]

### Pagination

- Use when: The list is very long or bottomless, loading the entire list is too slow, and most users will find what they need in the first screen (typical of search results).
- What it is: The list is sliced into pages; navigation controls move between pages.
- Why it works: Bounds load time and rendering cost; puts "see more" in the user's hands; easy to implement and well understood on the web.
- How to apply:
  - Tune page size to the device and item height; ensure the first page is genuinely useful.
  - Place controls at the bottom (and optionally at the top for long pages).
  - Include Prev/Next, a link to page 1, numbered page links, ellipses for elided ranges, and the current page rendered non-clickable.
  - Optionally show total page count.
- Signals present (in code/spec): API calls with `?page=` or `?offset=&limit=`; a `<Pagination>` component rendering numbered page links.
- Signals missing (red flag): Long server-side lists loaded all at once causing slow first paint; bottomless lists rendered as one giant DOM tree.
- Anti-patterns / mis-applications: Pagination used where Infinite List would be more natural (e.g., social feeds); pagination controls that hide the current page index so the user loses orientation.
- Related: [[06-mobile#Infinite List]], [[06-mobile#Continuous Scrolling]]

### Jump to Item

- Use when: A long sorted list (alphabetical or numeric) in a scrolling list, table, drop-down, combo box, or tree, and the user wants to reach a specific item quickly from the keyboard.
- What it is: As the user types characters, the list selection jumps to the first matching item; rapid typing refines the match.
- Why it works: Computers scan faster than humans; keeps the user's hands on the keyboard during form filling.
- How to apply:
  - On first keystroke, scroll to and select the first match for the typed string.
  - On subsequent rapid keystrokes, refine to the first exact match for the accumulated string.
  - If no match, stay at the nearest match; optionally beep.
  - Pair with incremental-search variants (live results filter as typed) where appropriate.
- Signals present (in code/spec): Native `<select>` elements (which get this for free); custom comboboxes that handle keystrokes; search-as-you-type fields.
- Signals missing (red flag): Long custom dropdowns of countries/timezones with no keyboard jump; user must scroll hundreds of items by hand.
- Anti-patterns / mis-applications: Jump that requires the user to type the exact full string before moving; jump applied to unsorted lists (the result is unpredictable).
- Related: [[#Alpha/Numeric Scroller]], [[10-forms#Autocompletion]]

### Alpha/Numeric Scroller

- Use when: Very long alphabetised or date-indexed list inside a scrolled area, and users need to jump to a known letter or date.
- What it is: The alphabet (or numeric/date range) is displayed along the scroll bar/edge; tapping a letter scrolls the list to that section.
- Why it works: Acts as an interactive map to list content — same idea as a dictionary's thumb tabs.
- How to apply:
  - Render the alphabet (or date range) vertically along one edge of the scrolled list.
  - On click/tap, scroll the list to that letter's section.
  - Provide visual feedback on the active letter while dragging.
- Signals present (in code/spec): A sidebar of letter buttons next to a `UITableView` / `LazyVStack`; the iOS Contacts-style index strip.
- Signals missing (red flag): Long contacts or city list with only a free-text search; no quick way to land on the "M"s.
- Anti-patterns / mis-applications: Alpha scroller on a list that is not actually sorted alphabetically; tiny letter targets that fingertips can't hit.
- Related: [[#Jump to Item]], [[06-mobile#Annotated Scroll Bar]]

### New-Item Row

- Use when: A table, list, or tree where users add items, and you want to avoid spending space on a separate "create" button or form.
- What it is: The first or last row of the list is a dedicated row that creates a new item when clicked or typed into.
- Why it works: Creation happens where the item will live — no navigation away, less screen real estate, conceptually coherent.
- How to apply:
  - Reserve the first (or last) row for a clearly labelled "New X" affordance.
  - On activation, turn the row into an editable record with appropriate fields per column.
  - Pre-fill with Good Defaults so even an abandoned row is a valid item.
  - Decide abandonment behaviour: either keep the row as a valid default-only item, or delete it on cancel.
- Signals present (in code/spec): A list whose last item is rendered as an `Add row` cell or input; inline editing components per column.
- Signals missing (red flag): A "+ Add" button that opens a modal for items users add frequently (friction); creation flow disconnected from where the item appears.
- Anti-patterns / mis-applications: New-Item Row on a list where creation needs many fields not visible as columns; abandoned rows leaving invalid records in storage.
- Related: [[10-forms#Good Defaults and Smart Prefills]], [[10-forms#Input Prompt]]
