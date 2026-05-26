---
title: Showing Complex Data
source_chapter: 9 — Showing Complex Data
purpose: Catalog of Ch.9's data-visualization + exploration patterns, with audit-ready signals
---

# Showing Complex Data

Patterns for surfaces that present multidimensional data — maps, charts, tables, plots, timelines, trees, dashboards — and let users explore it. Apply when a screen's primary job is *showing* a data set, not transacting on it. Audit lens: does the surface let the user form their own questions and answer them, or does it dump data without affordances for browsing, filtering, comparing, or drilling in?

## Information-graphics fundamentals

Six audit lenses for any data surface. Apply before reaching for a pattern.

- **How is the data organized?** Pick the organizational model that matches the data's inherent shape: *linear* (single-variable plot), *tabular* (sortable table, multi-Y), *hierarchical* (tree, tree table), *network* (directed graph, flowchart), *geographic / spatial* (map, scatter), *textual* (word cloud), or *other* (treemap, parallel coords). If two models fit, show both — collapsing geographic data into a pure table loses the geographic story.

- **What's preattentively pre-grouped?** Color, size, position, shape, orientation, and alignment are read in *constant time* before conscious attention. Use them to encode dimensions and create perceptual layers; never make users *read text* to spot the thing that matters. Multi-dim plots should redundantly encode (color + shape) so groups separate visually.

- **How can the user explore?** Provide at least one of: *scroll/pan*, *zoom*, *open/close points of interest in place*, *drill down into a sub-view*. Follow the "focus + context" mantra — a detail view should preserve enough surrounding data that the user knows where they are. Wire search results into the same nav (search → pan/zoom to result, not jump to a new screen).

- **Can the user sort or rearrange?** Default ordering biases what questions get asked. Offer at minimum alphabetic + numeric ordering; consider date, location, category, popularity, user-defined, or random. Stacked bars: let the user pick which series sits on the baseline.

- **How can the user filter to just what they need?** Simple checkboxes for layer toggles; [[#Dynamic Queries]] for multi-variable filtering; [[#Data Brushing]] for selecting visually. The best filter UIs are highly interactive, iterative, contextual (results shown in place), and complex enough to express AND/OR/NOT across multiple attributes.

- **How does the user read specific values?** Direct *labels* are unambiguous but clutter; *legends* belong on the same screen as the graphic; *axes/scales* burden the user with interpolation but stay clean; [[#Datatips]] give label-precision on demand; [[#Data Spotlight]] highlights a slice in context. Pick per audience — qualitative readers don't need every number.

## Patterns

### Datatips

- Use when: Showing an overview of a data set (chart, map, plot) where additional values are "hidden behind" each point and the user can hover/tap to probe.
- What it is: A small temporary tool-tip-like overlay anchored to the cursor / fingertip that surfaces data for the point underneath.
- Why it works: Puts the data exactly where the user's eye is already focused, without cluttering the overview with labels for every point. Encourages exploration ("what else is here?") at near-zero interaction cost.
- How to apply:
  - Render as a layered, temporary overlay (not a new screen / modal); auto-position to avoid covering the probed point.
  - Format densely; cap size so it never obscures more graphic than it reveals.
  - Vary contents by context (e.g., different fields per data series).
  - Include drill-down links inside the tip for data not on the overview.
  - Alternative: a static reserved data panel beside the graphic that updates on hover — preserves view, but costs an eye shift.
  - Pair with [[#Data Spotlight]] when the data slice (line, region) also needs to be highlighted.
- Signals present (in code/spec): `onMouseEnter` / `onPointerOver` / `onPress` handlers on chart marks that mount a positioned tooltip component; chart libraries with `tooltip` config (Recharts, Victory, d3-tip, MapboxGL popups, Apple `Annotation`).
- Signals missing (red flag): A data-dense chart or map with no hover/tap response; users must read off axes or guess at point values; multiple overlapping series with no way to tell which is which without a legend round-trip.
- Anti-patterns / mis-applications: Tooltip so large it covers the very point being probed; tooltip that flickers / re-mounts on every mouse move; touch-only surface with hover-only tooltips (no tap fallback); tooltip text in computerese instead of the user's labels.
- Related: [[#Data Spotlight]], [[07-lists]] (hover affordances), [[01-foundations-cognition#P-01. Safe Exploration]]

### Data Spotlight

- Use when: An info-graphic so dense that connections and slices get visually tangled — many overlapping lines, a packed network, layered map polygons, a chord-chart of relationships.
- What it is: On hover or tap of a slice, brighten/saturate that slice and dim everything else, while leaving the dimmed data visible for context.
- Why it works: Implements "focus plus context" — quiets the clutter so the user can trace a single thread without losing the surrounding shape of the data. Quick flicks across slices expose differences (even tiny ones) that static rendering can't.
- How to apply:
  - The graphic must still be coherent without the spotlight (someone may print it).
  - Spotlight transition must be fast and flicker-free; ease the dim, not the highlight.
  - Encode spotlight with saturation/lightness, not just color shift.
  - Add "hot spots" on legends and references — hovering a legend entry triggers the same spotlight.
  - Consider a "spotlight mode" (longer initial hover before turning on) to prevent accidental triggering on incidental mouse drift.
  - On touch, use tap (not long-press) to engage; reserve double-tap or a dedicated control for drill-down.
  - Combine with [[#Datatips]] — spotlight highlights the slice, datatip names the point.
- Signals present (in code/spec): Chart code that mutates per-series opacity / fill on hover state; legend rows wired to the same hover handler as the chart marks; CSS transitions on `opacity` for non-focused series.
- Signals missing (red flag): A network graph or multi-line chart where users complain they "can't follow which line is which"; legend-only differentiation in a chart with >5 series; no way to isolate one category without unchecking everything else.
- Anti-patterns / mis-applications: Hiding non-focused data entirely (loses context, becomes filtering not spotlighting); spotlight that overrides a primary click intended for drill-down; spotlight on touch surfaces fired on accidental scroll-over.
- Related: [[#Datatips]], [[#Dynamic Queries]], [[01-foundations-cognition#P-09. Spatial Memory]]

### Dynamic Queries

- Use when: Showing a large multivariate data set where users need to filter on several attributes at once — price + bedrooms + distance, date + category + region, etc.
- What it is: Standard form controls (sliders, checkboxes, range pickers, dropdowns) wired to a data view that updates *immediately* as each control changes.
- Why it works: No query language to learn; controls expose the queryable attributes themselves; immediate visual feedback closes the iteration loop and supports flow-state exploration ("tweak, observe, tweak").
- How to apply:
  - Each control maps to one attribute; choose the control by data type (slider for number range, double-slider for range subset, radio/dropdown for single-pick incl. "All", checkbox for arbitrary subsets, text for precise values).
  - Update the view on every commit (and on drag for sliders if perf allows); debounce keystrokes but not slider thumbs.
  - Show how many results survive the filter at all times (counter, empty-state).
  - Place controls adjacent to the data view, not behind a separate modal.
  - For spatial data, also offer direct "draw a box around the region" selection (compare with [[#Data Brushing]]).
- Signals present (in code/spec): A filter side-panel or filter-bar component bound to derived state (`useMemo` over data + filter state); URL query params encode each filter; result count updates live; sliders backed by a `Range`/`MultiRange` primitive.
- Signals missing (red flag): A list / map view with a "Filter" button that opens a modal, the user fills it out, taps Apply, and only then sees results; filter changes require a "Search" button press; result count not shown.
- Anti-patterns / mis-applications: Refetching from the server on every keystroke and stalling the UI; filters that silently reset on navigation; "All" missing as an option (forcing users to check every box); applying filters on form submit instead of immediately.
- Related: [[#Data Brushing]], [[07-lists]] (faceted filtering), [[01-foundations-cognition#P-06. Incremental Construction]]

### Data Brushing

- Use when: Two or more views render the *same* data set (e.g., map + table, scatter + bar chart, timeline + map), and users would benefit from selecting in one view and seeing the same items light up in the others.
- What it is: Linked / coordinated views — selecting (or "brushing") a subset in one graphic immediately highlights those same items in every other graphic with matching visual encoding.
- Why it works: Lets the user pick points by whatever is *visually easy* in one view (outliers on a scatter, a region on a map) and then study those exact points under a *different* organizing principle. Coordination reinforces that the views are different perspectives on one data set, surfacing relationships that no single view could.
- How to apply:
  - Define a single selection-state shared across all views (one source of truth).
  - Support multiple selection modes (single click, range drag, marquee, lasso, keyword tap).
  - Brushed items must appear with the *same* preattentive cue (typically a saturated hue) in every linked view.
  - Updates across views must feel simultaneous — sub-frame latency is the target.
  - Don't replace [[#Dynamic Queries]] with brushing alone; brushing is best for visually obvious subsets, filtering for numeric / categorical conditions.
- Signals present (in code/spec): A shared selection store (Redux slice, Zustand store, context) subscribed to by multiple chart/map components; chart `onSelectionChange` handlers that mutate the shared state; consistent `selectedColor` token across views.
- Signals missing (red flag): A dashboard with two views of the same data where clicking a row in the table does nothing to the chart, or hovering a region on the map doesn't affect the list; multi-view screen where each view holds its own filter state.
- Anti-patterns / mis-applications: Brushing without visual feedback in the *source* view (user can't see what they selected); brushing that triggers a server roundtrip for each linked view; selections that survive navigation in ways the user can't undo.
- Related: [[#Dynamic Queries]], [[#Data Spotlight]], [[01-foundations-cognition#P-01. Safe Exploration]]

### Multi-Y Graph

- Use when: Presenting two or more series that share the *same x-axis* (usually time) but have different units or scales on the y-axis (price, volume, temperature, humidity), and the user benefits from spotting vertical correlations.
- What it is: Several plots stacked vertically, sharing one x-axis, each with its own y-axis (or no y-axis if exact values aren't needed).
- Why it works: Shared x-axis says "these are aligned in the same dimension"; separate y-axes prevent unit-mismatch distortion. The eye is excellent at spotting "they both spike here" comparisons when graphs are vertically aligned.
- How to apply:
  - Stack along x; reserve separate vertical space for each y-axis.
  - Label every series unambiguously (title beside the plot or directly on the curve).
  - Use vertical grid lines so the eye can trace one x-value across all plots.
  - If exact y-values don't matter, drop y-axes and just float curves to non-interfering positions.
  - Pictograms or icons (weather symbols, event markers) can occupy one "row" alongside numeric plots.
  - For interactive multi-Y, link cursor/datatip across all stacked plots.
- Signals present (in code/spec): A composed chart that mounts multiple `<LineChart>` / `<BarChart>` instances with a shared x-domain; layout grid that constrains widths to match; cross-plot hover synced via shared cursor state.
- Signals missing (red flag): A dashboard packing multiple unrelated-unit series onto one chart with a single (lying) y-axis, or split into separate tabs that prevent vertical comparison.
- Anti-patterns / mis-applications: Stacking series with *the same units* (should be a single plot or [[#Small Multiples]]); dual y-axes on a single panel (the classic "left axis vs right axis" — viewers misread correlation); inconsistent x-domains across stacked plots.
- Related: [[#Small Multiples]], [[#Datatips]], [[04-layout]] (Titled Sections for grouping plots)

### Small Multiples

- Use when: The data has more than two dimensions and a single plot can't show them all; users would otherwise be flipping between separate charts to compare slices.
- What it is: A grid (1D strip or 2D matrix) of *small, identically-formatted* mini-pictures, where each cell varies along one or two extra dimensions (e.g., one map per year, one chart per region).
- Why it works: Side-by-side placement removes the memory burden of flipping between views — every difference is visible in one glance. Identical framing turns *every* visual difference into a meaningful signal.
- How to apply:
  - Decide whether to encode 1 extra dimension (strip / comic) or 2 (matrix); for 2D, columns = one dim, rows = the other.
  - Hold every non-varying property constant: axis ranges, scale, color encoding, aspect ratio, size.
  - Label each tile minimally; rely on row/column headers for the varying dimension.
  - Bin or "shingle" if a continuous dimension has too many values (5–10 tiles per row max).
  - Requires real screen real estate — defer to a different pattern (or sparklines) on small mobile screens.
  - Sparklines are tiny `Small Multiples` for inline / column-cell use; strip labels and axes entirely.
- Signals present (in code/spec): A `grid` / `flex-wrap` layout of identical chart components mapped over a dimension; shared scale config (`yDomain`, `colorScale`) passed to every tile; `sparkline` cells inside table rows.
- Signals missing (red flag): A "View by year" dropdown that swaps one chart in place, forcing users to remember the previous view; a dashboard with many disparate plots of the *same* metric across categories, each styled differently.
- Anti-patterns / mis-applications: Tiles with different y-axis ranges (defeats comparison); tiles with cosmetic styling differences that aren't data; too many tiles (100 sparklines is just noise without binning); using small multiples on a phone-sized viewport where each tile becomes unreadable.
- Related: [[#Multi-Y Graph]], [[07-lists]] (cards / grids), [[06-mobile]] (when to avoid on mobile)
