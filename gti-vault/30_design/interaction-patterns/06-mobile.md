---
title: Mobile Interfaces
source_chapter: 6 — Mobile Interfaces
purpose: Catalog of chapter 6's patterns, with audit-ready signals
---

# Mobile Interfaces

Patterns for designing native apps and mobile web on small, touch-driven, location-aware, distraction-prone devices. Audit lens: do screen size, touch ergonomics, typing cost, environment, location, and divided attention each get addressed by the design, or is this a desktop layout shrunk down?

## Mobile design constraints

Pre-pattern audit lenses drawn from Ch.6 intro.

- Tiny screen sizes: has every non-essential element been cut from the front screen? Are sidebars, big decorative imagery, and long header menus removed?
- Variable screen widths: does the layout work fluidly between ~360 px and tablet widths without fixed-width assumptions or horizontal scroll?
- Touch screens: are tappable targets at least 44pt (iOS) / 48dp (Android) on each side, with whitespace between them?
- Typing difficulty: is text entry minimized via autocomplete, prefilled fields, numeric keyboards, and choice controls instead of free text?
- Challenging environments: does the design hold up in bright sun (contrast), dark rooms (no glare), loud rooms (no audio-only signal), quiet rooms (no surprise sound), and motion (large targets, easy correction)?
- Location awareness: does the app exploit device location to personalize content or anticipate user need where appropriate?
- Social + attention limits: are task sequences short, reentrant, self-explanatory, and tolerant of interruption? Will the screen behave gracefully when shown to someone else mid-task?

## Patterns

### Vertical Stack

- Use when: designing most mobile web or content-heavy mobile screens, especially forms and text-based content that must work across many device widths.
- What it is: a single scrolling column of content with line-wrapping text and stacked controls; little or no side-by-side layout.
- Why it works: adapts gracefully to unknown device widths and font sizes; vertical scrolling is cheaper than horizontal scroll or zoom; lets the most important content take the top of the screen.
- How to apply:
  - Lay out content in one column, most important on top.
  - Put form labels above their controls, not beside them, to reclaim horizontal space.
  - Put buttons side-by-side only when total width is guaranteed to fit (no localization risk).
  - Use thumbnail-beside-text only via Collections and Cards pattern.
  - Don't waste the top ~100 px on logos, ads, or stacked toolbars.
  - Verify the design at the smallest realistic width (e.g., 320–360 px).
- Signals present (in code/spec): one vertically scrolling container per screen; flex column or stack layout primitive; labels rendered above inputs; no fixed-width pixel measurements on outer containers.
- Signals missing (red flag): mobile screen requires horizontal scroll or pinch-zoom; side-by-side form labels; "above the fold" filled by logo/banner before any useful content; design breaks at small widths.
- Anti-patterns / mis-applications: porting a desktop two-column layout untouched; cramming buttons side-by-side that overflow once translated; stacking so many toolbars at the top that content begins below the fold.
- Related: Collections and Cards, Bottom Navigation, Generous Borders

### Filmstrip

- Use when: the app has a small set of conceptually parallel top-level screens (cities in a weather app, sports in a scores app, news categories) and the user is happy to browse rather than jump.
- What it is: full-screen panels the user swipes left/right between; each panel uses the entire screen with no persistent tab strip.
- Why it works: each item gets the whole screen; swiping is a satisfying, low-effort gesture; encourages serendipitous browsing.
- How to apply:
  - Keep the number of top-level screens small — swiping through many panels becomes tedious.
  - Show a dot/page indicator so users discover that more screens exist.
  - Allow tap as well as swipe on the indicator for users who want direct jump.
  - Don't use this when users need direct access to a specific screen by name.
- Signals present (in code/spec): horizontal pager / `PageView` / `ViewPager` / `swiper` component at top-level navigation; page indicator dots component; route state tracks the active page index.
- Signals missing (red flag): app has 8+ peer screens with no obvious selector; new users can't discover swiping is how to switch context (no indicator at all).
- Anti-patterns / mis-applications: hiding important features behind swipe-only access with no affordance; using Filmstrip for non-parallel content (e.g., settings, account, browse — they belong in tabs/menu); pagination across 15+ panels.
- Related: Bottom Navigation, Collections and Cards

### Touch Tools

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
- Related: [[01-foundations-cognition#P-08. Microbreaks]], Loading or Progress Indicators

### Bottom Navigation

- Use when: a mobile site or app needs global navigation links but the front screen's primary job is content, not navigation.
- What it is: a row of nav links anchored to the bottom of the screen (footer-style for web; persistent tab bar for native).
- Why it works: keeps the top of the screen for content and brand; bottom-of-screen links are thumb-reachable; users can scroll to them on a long screen without losing context.
- How to apply:
  - Stretch nav items across the full width with comfortable height for thumb tapping.
  - Keep the count small — only the most important destinations.
  - Make labels large, readable, and high-contrast.
  - For native apps, use the platform tab bar conventions (icons + labels, current-tab indicator).
- Signals present (in code/spec): `BottomTabBar` / `TabBar` / `BottomNavigation` component; route tree organized around 3–5 top-level tabs; sticky-positioned footer nav on mobile web.
- Signals missing (red flag): top of mobile screen filled by 6+ nav links pushing content below the fold; users have to scroll to the top to switch sections in a long content app.
- Anti-patterns / mis-applications: cramming 6+ tabs into the bottom bar (each tap target shrinks below the 44pt/48dp floor); icon-only tabs with no labels; bottom nav that hides on scroll and is hard to recover; duplicating top-bar nav at the bottom.
- Related: Vertical Stack, Generous Borders, Filmstrip

### Collections and Cards

- Use when: showing lists of articles, videos, products, blog entries, or any complex items that benefit from a thumbnail or image preview.
- What it is: list items rendered with a thumbnail (collections) or full-content card (cards) per item, stacked vertically.
- Why it works: images aid scanning, identification, and visual differentiation; generous item height accommodates touch targets; cards feel finished and inviting compared to text-only lists.
- How to apply:
  - Place thumbnail on the left, text on the right (most common pattern).
  - Use bright/saturated colors — small screens carry strong color well.
  - Add secondary visual markers (ratings, badges, avatars) where they help scanning.
  - Make the whole row/card tappable, not just the title.
  - For cards (vs. collections), include richer in-card actions, summaries, and metadata.
- Signals present (in code/spec): a `Card` / `ListItem` component used inside a `FlatList` / `RecyclerView` / `.map()`; consistent `aspect-ratio` on thumbnails; entire item wrapped in a single `Pressable`/`Link`.
- Signals missing (red flag): mobile feed shown as text-only headlines; items missing thumbnails where the source data has them; only the title is tappable, the rest of the row inert.
- Anti-patterns / mis-applications: cards so tall only one fits on screen, killing scanability; mixing heterogeneous item types into one feed with inconsistent card shapes; placeholder gray boxes shipped to production instead of real thumbnails.
- Related: Grid of Equals ([[04-layout#Grid of Equals]]), Vertical Stack, Infinite List

### Infinite List

- Use when: the underlying list is effectively bottomless (search results, an inbox, a social feed, an archive) and users typically find what they want near the top but sometimes need more.
- What it is: a list that loads an initial chunk and appends additional chunks as the user scrolls toward the bottom — either via a "load more" button or silently (lazy loading).
- Why it works: fast first paint with a usable screenful; user controls when (and whether) more arrives; no context-shift to a new page like with pagination.
- How to apply:
  - Truncate the initial response to a reasonable chunk size based on item size and download cost.
  - Either show a "Load more" button at the bottom (with count if known), or prefetch the next chunk silently and append on scroll-end.
  - Show a small progress indicator at the bottom while loading more.
  - Don't reorder items already shown; only append.
  - Provide a way to jump to top after the user has scrolled far.
- Signals present (in code/spec): `FlatList` / `VirtualizedList` with `onEndReached`; paginated API with `cursor` / `page` / `offset`; loading spinner footer; "load more" button or intersection observer at list end.
- Signals missing (red flag): full result set loaded up front causing slow first paint; pagination implemented as separate route pages on a mobile feed; user reaches the end and has no way to get more.
- Anti-patterns / mis-applications: silent infinite scroll on content the user needs to commit decisions on (e.g., a checkout list) — they lose the bottom of the page; no virtualization, so memory grows unboundedly; "load more" button hidden below other footer content.
- Related: Loading or Progress Indicators, Collections and Cards, Vertical Stack

### Generous Borders

- Use when: any touch target — buttons, links, list rows, icons — exists on a mobile screen.
- What it is: ample inner padding, outer margin, and surrounding whitespace around every tappable element so finger taps land reliably.
- Why it works: fingers are imprecise, especially under motion or poor light; oversized touch zones reduce mis-taps; whitespace also reads as "polished".
- How to apply:
  - Target ≥ 44pt × 44pt (iOS) or ≥ 48dp × 48dp (Android) per touch zone.
  - Put space between adjacent targets so the user can't trigger the wrong one.
  - Where visual design demands a smaller visible button, extend the hit area into surrounding whitespace (extended `hitSlop`).
  - Verify with a device test, not just a simulator — fingers behave differently than mice.
- Signals present (in code/spec): `hitSlop` / `padding` on `Pressable`/`Button`; minHeight 44/48 enforced via a `Button` design-system primitive; spacing tokens applied between list rows.
- Signals missing (red flag): icon-only buttons in a tight toolbar; close (X) buttons sized to their glyph; inline text links with no extra padding; multiple adjacent CTAs with no gap.
- Anti-patterns / mis-applications: huge visible buttons that waste screen but leave no whitespace between them (still mis-tap); pretending CSS padding is enough when the actual `Pressable` hit area is smaller; tiny "x" close buttons on toasts and modals.
- Related: Vertical Stack, Bottom Navigation, [[01-foundations-cognition#P-03. Satisficing]]

### Loading or Progress Indicators

- Use when: any user-initiated action causes a perceptible delay — screen load, content fetch, image render, multi-step task.
- What it is: a microinteraction animation (spinner, progress bar, skeleton, branded loader) shown in situ where the result will appear.
- Why it works: reassures the user something is happening; makes wait time feel shorter; ties feedback to the location the user gestured.
- How to apply:
  - Render whatever can paint immediately; reserve loaders only for slow parts.
  - Place the indicator in situ — where the missing content will appear — not in a generic top bar.
  - Use the platform default unless brand moment is worth the engineering cost.
  - Use determinate progress when the duration is known; indeterminate otherwise.
  - Use skeleton placeholders for content that has a known shape.
- Signals present (in code/spec): `Skeleton` / `Shimmer` components in the item slot; conditional rendering on `isLoading` flag; `ActivityIndicator` / `Spinner` next to the triggering control; per-section progress instead of full-screen blockers.
- Signals missing (red flag): blank screen during fetch; full-screen spinner blocking interaction even when only part is loading; user taps a button and gets no feedback for >100 ms.
- Anti-patterns / mis-applications: fake progress bars that always reach 90% then stick; per-pixel skeletons that mislead the user about content shape; auto-dismiss before the load finishes; spinners with no timeout for failed loads.
- Related: Touch Tools, Infinite List, [[01-foundations-cognition#P-02. Instant Gratification]]

### Richly Connected Apps

- Use when: the app handles data types the OS already knows how to act on — phone numbers, addresses, dates, email, links, media — or could capture data via device features (camera, mic, GPS).
- What it is: data and affordances inside the app that hand off seamlessly to the dialer, map, calendar, mail, browser, camera, contacts, media player, or share sheet.
- Why it works: mobile OSes lack arbitrary copy/paste between apps; switching apps manually is annoying; deep-linking lets each app do what it does best.
- How to apply:
  - Phone numbers → dialer; addresses → map / contacts; dates → calendar; emails → mail; URLs → browser; media → players.
  - Use platform intents (`tel:`, `mailto:`, `geo:`, `Linking.openURL`, share sheet) instead of building in-app equivalents.
  - Where the user needs to capture data (check deposit, social post, ticket scan), invoke the camera or mic directly inside the flow.
  - Use auto-fill / contact suggestions / location prefill where available to skip typing.
- Signals present (in code/spec): `Linking.openURL` calls; `UIActivityViewController` / `Intent` invocations; camera/mic permission requests scoped to the flow that needs them; `tel:`/`mailto:`/`geo:` schemes in templates.
- Signals missing (red flag): the app re-implements a contact picker, address-book search, or in-app dialer; the user has to leave the app, copy a number, switch apps, paste, then come back; capture flows require manual data entry that the camera could read.
- Anti-patterns / mis-applications: walling the user in to prevent app-switching; opening external apps without warning during a destructive flow (e.g., mid-checkout); requesting permissions the user can't yet motivate (camera permission on first launch with no context).
- Related: Make It Mobile, [[01-foundations-cognition#P-13. Social Media, Social Proof, Collaboration]]

### Make It Mobile

- Use when: deciding how to treat mobile relative to a desktop product — at the product-strategy level, not the screen level.
- What it is: a stance, not a layout — treat smartphone and tablet experiences as primary (not afterthoughts), giving deliberate attention to microinteractions, usability, and mobile context of use.
- Why it works: for many users the mobile experience is their only experience of the brand; treating it as a downstream port hides product problems users can't articulate.
- How to apply:
  - Decide consciously per surface: mobile web, mobile-native app, or both — based on use cases and investment available.
  - Design mobile use cases first (quick fact lookup, time-killing, social connection, urgent alerts, location-relevant info).
  - Strip features that don't survive the mobile context rather than cramming them in.
  - Budget for microinteractions, animations, and platform-correct details; they read as quality.
  - Test on real devices under real conditions (sun, motion, noise), not just emulators.
- Signals present (in code/spec): mobile is a first-class build target with its own design tokens and component library; product analytics show parity (or better) for mobile sessions; per-platform conventions are followed (iOS HIG, Material).
- Signals missing (red flag): mobile is "responsive desktop" with no mobile-specific flows; mobile features ship after desktop with no parity timeline; product team has no on-device test devices.
- Anti-patterns / mis-applications: building a separate mobile app that only does 10% of what the site does without surfacing that gap; treating mobile as a marketing-only surface; copying desktop interaction patterns (hover, right-click, multi-select with shift) onto touch where they don't translate.
- Related: All patterns in this chapter
