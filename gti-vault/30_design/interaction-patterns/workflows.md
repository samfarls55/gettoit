---
title: Workflows -- end-to-end recipes for complete user flows
purpose: Portable recipe compositions of surfaces and patterns. Starting points to copy, swap, and validate.
---

# Workflows

End-to-end recipes for designing complete user flows. Each recipe is a composition of surfaces and patterns linked to the canonical entries in [[patterns]] and [[surfaces]]. Use as starting points: copy the recipe, swap patterns to fit your domain, validate against [[principles]].

For atomic pattern entries see [[patterns]]. For surface-by-surface playbooks see [[surfaces]]. For foundation rules see [[principles]].

---

## Recipe schema

Each recipe has:
- **User goal** -- one sentence.
- **Surface composition** -- ordered list of which surfaces the user touches.
- **Required patterns** -- patterns that must appear, with `[[patterns#Name]]` links.
- **Optional patterns** -- common variants.
- **Foundation gates** -- `[[principles#P-XX. Name]]` rules that bite hardest here.
- **Common anti-patterns** -- what goes wrong in this kind of flow.

Recipes are pointers, not tutorials. Read the linked patterns for implementation detail.

---

## Recipes

## Checkout

**User goal:** Buy items in my cart with minimum friction and full confidence in the total before I pay.

**Surface composition:**
- Cart (Overview surface)
- Address + Payment (Form surface)
- Review (Focus surface)
- Confirmation (Do surface)

**Required patterns:**
- [[patterns#Progress Indicator]] -- multi-step checkout needs a visible step count and current position
- [[patterns#Good Defaults and Smart Prefills]] -- saved addresses and cards collapse the form to one tap
- [[patterns#Prominent "Done" Button or Assumed Next Step]] -- single dominant action per step removes hesitation
- [[patterns#Input Hints]] -- card and postal-code fields need format guidance inline
- [[patterns#Error Messages]] -- declined cards, invalid addresses must surface at the field, not at the top
- [[patterns#Cancelability]] -- a "back to cart" / "edit address" escape must work from every step without losing entered data

**Optional patterns:**
- [[patterns#Autocompletion]] -- address autocomplete cuts form length dramatically
- [[patterns#Password Strength Meter]] -- only if guest checkout creates an account at the end
- [[patterns#Forgiving Format]] -- accept card numbers with or without spaces, phone with or without dashes

**Foundation gates:**
- [[principles#P-05. Deferred Choices]] -- do not ask for newsletter, gift wrap, account creation before payment completes
- [[principles#P-04. Changes in Midstream]] -- editing cart from review step must not wipe entered address
- [[principles#P-12. Keyboard Only]] -- entire flow completable with Tab + Enter; payment field focus order predictable
- [[principles#V-01. Visual hierarchy]] -- order total and pay button are unambiguously the largest, heaviest elements on review

**Common anti-patterns:**
- Surprise fees revealed only at the final step: violates trust, drives abandonment
- Required account creation before purchase: blocks [[principles#P-02. Instant Gratification]]
- Multiple competing CTAs on review (Pay, Save for later, Add coupon all same weight): scanner cannot find the primary
- Inline form errors that appear only after submit, not on blur: forces user to scroll back and re-find each broken field

---

## Onboarding

**User goal:** Get into the product and accomplish one real task fast enough that I form an early belief it is worth my time.

**Surface composition:**
- Landing / first-run (Overview surface)
- Account creation (Form surface, optional / deferred)
- First-task scaffold (Make or Do surface)
- Empty state with next-step prompt (Overview surface)

**Required patterns:**
- [[patterns#Clear Entry Points]] -- two or three obvious starting paths, not a wall of options
- [[patterns#Good Defaults and Smart Prefills]] -- sample content, suggested name, prefilled timezone
- [[patterns#Prominent "Done" Button or Assumed Next Step]] -- the single next action on each screen is obvious
- [[patterns#Input Prompt]] -- empty fields show example text describing what belongs there

**Optional patterns:**
- [[patterns#Wizard]] -- only when first task genuinely requires several decisions in order
- [[patterns#Help Systems]] -- contextual tips on hover or first-encounter, never blocking modal tours
- [[patterns#Sign-In Tools]] -- third-party sign-in placed in the standard header location

**Foundation gates:**
- [[principles#P-02. Instant Gratification]] -- user reaches first useful action in seconds, before sign-up
- [[principles#P-05. Deferred Choices]] -- defer email verification, profile photo, role selection until after first value
- [[principles#V-05. Evoking a feeling]] -- first-run visual register sets the product's emotional tone; mismatch hurts trust

**Common anti-patterns:**
- Forced multi-screen product tour before any action: violates [[principles#P-02. Instant Gratification]]
- 20-field registration form gating the entire app: violates [[principles#P-05. Deferred Choices]]
- Empty state that just says "No items" with no prompt to create one: dead end
- Permissions requested up-front (camera, contacts, notifications) before user understands why

---

## Search results

**User goal:** Find the specific item I had in mind, or learn that it does not exist here.

**Surface composition:**
- Query entry (Form surface, usually a single input in a header)
- Results list with filters (Overview surface)
- Item detail (Focus surface)

**Required patterns:**
- [[patterns#Autocompletion]] -- typeahead suggestions shorten the path for known-item search
- [[patterns#Dynamic Queries]] -- filters update results live without a separate "apply" step
- [[patterns#Pagination]] or [[patterns#Infinite List]] -- pick one based on whether ordering or position matters
- [[patterns#Jump to Item]] -- type-to-jump or alpha scroller for long ordered result sets
- [[patterns#Forgiving Format]] -- accept typos, plurals, casing variation in the query

**Optional patterns:**
- [[patterns#Alternative Views]] -- toggle list vs grid vs map depending on result type
- [[patterns#Data Brushing]] -- when results include charts, hovering one view highlights related items in others
- [[patterns#Tags]] -- filter chips that show, and let user remove, active filters

**Foundation gates:**
- [[principles#P-03. Satisficing]] -- result rows must be scannable; key fields visible without click
- [[principles#P-09. Spatial Memory]] -- result ordering must be stable on identical query; do not silently re-rank between visits
- [[principles#P-12. Keyboard Only]] -- arrow keys move selection through results, Enter opens

**Common anti-patterns:**
- "No results" page with no spelling suggestion, no broader-search link, no contact path
- Filters that wipe the query when toggled
- Infinite list with no count or jump-to-end: user cannot estimate how much is here
- Result snippets that hide the matching term in a collapsed area: user cannot tell why each hit matched

---

## Editor

**User goal:** Create or modify a document, design, or piece of code with fast feedback on every change.

**Surface composition:**
- Canvas (Make surface, the central work area)
- Tool palettes and inspector panels (Make surface, secondary)
- File / save / version controls (Do surface, peripheral)

**Required patterns:**
- [[patterns#Canvas Plus Palette]] -- the canonical editor frame: large content area with tool strips
- [[patterns#Multilevel Undo]] -- non-negotiable in any creation tool
- [[patterns#Preview]] -- live or near-live render of what the user is building
- [[patterns#Hover or Pop-Up Tools]] -- contextual controls appear on the object being edited
- [[patterns#Command History]] -- a visible action stack supports both undo and "what did I just do"

**Optional patterns:**
- [[patterns#Macros]] -- record and replay repeated editing actions
- [[patterns#Movable Panels]] -- power users want to rearrange their workspace
- [[patterns#Many Workspaces]] -- tabs or windows for multiple documents open at once

**Foundation gates:**
- [[principles#P-06. Incremental Construction]] -- sub-500ms feedback on edits; no mandatory save-then-render cycle
- [[principles#P-01. Safe Exploration]] -- every action must be undoable; nothing destructive without confirm
- [[principles#P-07. Habituation]] -- Ctrl-S saves, Ctrl-Z undoes, Esc cancels in-progress action
- [[principles#P-12. Keyboard Only]] -- power users need shortcuts on every frequent action

**Common anti-patterns:**
- "Save before preview" gate: violates [[principles#P-06. Incremental Construction]]
- Auto-save with no version history: indistinguishable from data loss when user makes a mistake
- Modal "settings" dialog for a property that should live inline on the selected object
- Toolbars that reorder based on recent use: violates [[principles#P-09. Spatial Memory]]

---

## Settings management

**User goal:** Find a specific preference, change it, and trust that the change took effect.

**Surface composition:**
- Settings entry point (Overview surface, usually from header or profile menu)
- Settings index (Overview surface, grouped sections)
- Specific setting form (Form surface)

**Required patterns:**
- [[patterns#Settings Editor]] -- the canonical surface for this whole flow
- [[patterns#Titled Sections]] -- group related preferences under clear, scannable headings
- [[patterns#Good Defaults and Smart Prefills]] -- current values always shown in controls; never blank fields
- [[patterns#Error Messages]] -- invalid combinations surface at the field, with explanation of the conflict

**Optional patterns:**
- [[patterns#Module Tabs]] or [[patterns#Two-Panel Selector or Split View]] -- for settings with many categories
- [[patterns#Feature, Search, and Browse]] -- a settings search bar pays off once there are more than ~20 settings
- [[patterns#Smart Menu Items]] -- option labels that reflect current state ("Notifications: On")

**Foundation gates:**
- [[principles#P-09. Spatial Memory]] -- settings groups in stable order across releases; do not reshuffle "for clarity"
- [[principles#P-01. Safe Exploration]] -- destructive settings (delete account, revoke all sessions) require confirm with consequences spelled out
- [[principles#P-03. Satisficing]] -- labels say what the toggle does, not what marketing calls the feature

**Common anti-patterns:**
- Save button buried at bottom; user toggles, navigates away, change silently lost
- Toggles with no immediate visible effect and no confirmation feedback
- Settings reorganized between releases so muscle memory breaks
- Modal "are you sure?" on every trivial change: user habituates and clicks past the real warnings

---

## Sign-in / sign-up

**User goal:** Get into my account, or create one, with the smallest credential burden possible.

**Surface composition:**
- Entry (Form surface; can be a modal or full page)
- Account creation (Form surface)
- Recovery (Form surface, off the main path)

**Required patterns:**
- [[patterns#Sign-In Tools]] -- standard placement in the header; third-party sign-in offered alongside email
- [[patterns#Input Hints]] -- format guidance on email, password requirements
- [[patterns#Password Strength Meter]] -- live feedback while user types a new password
- [[patterns#Error Messages]] -- "wrong password" must not reveal whether the email exists; inline at field
- [[patterns#Forgiving Format]] -- trim whitespace, accept email casing variation

**Optional patterns:**
- [[patterns#Autocompletion]] -- email autocomplete from browser is welcome; do not block it
- [[patterns#Good Defaults and Smart Prefills]] -- prefill email from URL parameter or remembered session

**Foundation gates:**
- [[principles#P-02. Instant Gratification]] -- if any feature can run anonymously, do not gate it behind sign-in
- [[principles#P-07. Habituation]] -- password managers must work; do not block autofill with non-standard inputs
- [[principles#P-12. Keyboard Only]] -- Enter submits from any field; Tab order email then password then submit
- [[principles#V-01. Visual hierarchy]] -- one primary action per surface (sign in OR sign up, not both equally weighted)

**Common anti-patterns:**
- Password rules revealed only after submit, not next to the field while typing
- Captchas on every attempt: legitimate users punished for bot traffic
- "Forgot password" link hidden or visually de-emphasized: increases support load
- Forced password rotation with no breach signal: violates trust, drives password reuse

---

## Monitoring dashboard

**User goal:** Glance to see if anything is wrong, then drill into the specific issue when something is.

**Surface composition:**
- Top-level dashboard (Overview surface)
- Detail / drill-down (Focus surface)
- Action panel for response (Do surface)

**Required patterns:**
- [[patterns#Dashboard]] -- the canonical surface for this whole flow
- [[patterns#Center Stage]] -- the most urgent signal occupies the largest, most central area
- [[patterns#Datatips]] -- hover on any chart point reveals exact values and timestamp
- [[patterns#Small Multiples]] -- comparable metrics shown as a grid of identically-scaled small charts
- [[patterns#Dynamic Queries]] -- time-range and filter controls update all panels live

**Optional patterns:**
- [[patterns#Multi-Y Graph]] -- when two related metrics with different units must overlay
- [[patterns#Data Brushing]] -- selecting a time range on one chart highlights the same range on all others
- [[patterns#Data Spotlight]] -- callouts on anomalies the user should notice
- [[patterns#Annotated Scroll Bar]] -- in long log views, marks where errors clustered

**Foundation gates:**
- [[principles#V-01. Visual hierarchy]] -- alarms read as alarms; normal reads as normal; intermediate states distinguishable
- [[principles#V-02. Color]] -- red/green status must also be encoded by shape or icon for color-blind users
- [[principles#P-08. Microbreaks]] -- glanceable on phone in 5 seconds; key status visible without interaction
- [[principles#P-09. Spatial Memory]] -- panel layout stable across sessions; do not auto-reorder by "importance"

**Common anti-patterns:**
- Wall of charts with no hierarchy: scanner cannot find the one thing that matters
- Auto-refresh that resets scroll position or selection mid-investigation
- Alerts with no link to the underlying logs or drill-down path: dead-end
- Color-only state encoding: red bar, green bar, no icon, no label

---

## Browse and detail

**User goal:** Scan a collection of items, pick one, examine it, and return to the list without losing my place.

**Surface composition:**
- Collection (Overview surface)
- Item detail (Focus surface)

**Required patterns:**
- [[patterns#Two-Panel Selector or Split View]] or [[patterns#One-Window Drilldown]] -- pick based on screen size and item complexity
- [[patterns#List Inlay]] -- expand-in-place for quick peek without losing list context
- [[patterns#Thumbnail Grid]] or [[patterns#Cards]] -- visual collection layouts for browse-heavy content
- [[patterns#Pyramid]] -- previous / next navigation within the detail view, anchored back to the list
- [[patterns#Pagination]] or [[patterns#Infinite List]] -- collection navigation

**Optional patterns:**
- [[patterns#Alternative Views]] -- toggle list, grid, gallery for the same collection
- [[patterns#Tags]] -- filter chips that narrow the collection
- [[patterns#Breadcrumbs]] -- when item nests inside categories deeper than two levels

**Foundation gates:**
- [[principles#P-09. Spatial Memory]] -- returning from detail restores list scroll position and selection
- [[principles#P-04. Changes in Midstream]] -- jumping to a different item from detail must not lose state on the first
- [[principles#P-12. Keyboard Only]] -- arrows move through list, Enter opens, Esc or Back returns

**Common anti-patterns:**
- Back button reloads the list at the top, losing scroll: user must rebuild context
- Detail view replaces the list entirely on desktop where split-view would fit
- Selection state in the list cleared when detail opens: user cannot see which item they are reading
- Next / previous in detail in a different order than the list the user came from

---

## Media library viewer

**User goal:** Find and play a piece of media from my collection without losing my browsing place.

**Surface composition:**
- Library grid (Overview surface)
- Player (Focus surface)
- Now-playing or queue (Overview surface, persistent)

**Required patterns:**
- [[patterns#Media Browser]] -- the canonical surface for the whole flow
- [[patterns#Thumbnail Grid]] -- visual scanning of large libraries
- [[patterns#Filmstrip]] -- horizontal strip of related items at the bottom of the player
- [[patterns#Carousel]] -- featured / recommended rows on the library landing
- [[patterns#Cancelability]] -- skip, stop, exit player at any moment

**Optional patterns:**
- [[patterns#Alternative Views]] -- grid, list, by-album, by-artist
- [[patterns#Tags]] -- genre and mood filters
- [[patterns#Jump to Item]] -- alpha scroller for large libraries

**Foundation gates:**
- [[principles#P-01. Safe Exploration]] -- no autoplay with sound on entry; mute by default until user opts in
- [[principles#P-07. Habituation]] -- space to play/pause, arrows to scrub, escape to exit fullscreen
- [[principles#V-06. Images]] -- thumbnails load progressively; placeholder never blocks layout
- [[principles#P-08. Microbreaks]] -- resume-where-you-left-off on every item

**Common anti-patterns:**
- Autoplay-with-sound on library load: violates user trust on first visit
- Player overlay that traps Back / Esc, forcing user to tap a specific X
- Thumbnails that pop in after layout, shifting click targets under the user's finger
- No queue or play-next visibility: user cannot see what comes after

---

## Multi-step survey or form

**User goal:** Complete a long form in chunks without losing my work or my place if I step away.

**Surface composition:**
- Intro / consent (Overview surface)
- Step pages (Form surface, repeated)
- Review (Focus surface)
- Submit + receipt (Do surface)

**Required patterns:**
- [[patterns#Wizard]] -- the canonical structure for chunked forms with clear order
- [[patterns#Progress Indicator]] -- step count and current position always visible
- [[patterns#Fill-in-the-Blanks]] -- inline sentences with embedded inputs read more naturally than stacked labels
- [[patterns#Good Defaults and Smart Prefills]] -- carry forward known data; never make user retype
- [[patterns#Error Messages]] -- block forward navigation only on this-step errors; let user see all errors at once

**Optional patterns:**
- [[patterns#Input Hints]] -- format guidance for date, phone, currency fields
- [[patterns#Drop-down Chooser]] -- when the answer set is fixed and longer than four options
- [[patterns#Structured Format]] -- mask inputs for known formats (phone, SSN, postal)

**Foundation gates:**
- [[principles#P-04. Changes in Midstream]] -- closing the tab and returning resumes at the right step with answers intact
- [[principles#P-10. Prospective Memory]] -- drafts persist for days; nothing auto-deletes on idle
- [[principles#P-05. Deferred Choices]] -- mark optional fields clearly; do not require answers the user can supply later
- [[principles#P-12. Keyboard Only]] -- Tab order matches visual order; Enter advances to next step from any field

**Common anti-patterns:**
- Single submit at the end that reveals all errors at once with no field anchors
- "Back" button that wipes the current step's answers
- Progress indicator that shows step number but not total: user cannot estimate remaining effort
- Required fields revealed only on submit, not marked while user fills the form
